import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / 'public'

inventory = [
    {"id": 1, "name": "AeroBolt", "sku": "WB-1001", "stock": 28, "location": "A1-02", "reorderPoint": 15, "damage": 1, "status": "healthy"},
    {"id": 2, "name": "ServoGear", "sku": "WB-1002", "stock": 8, "location": "B4-07", "reorderPoint": 12, "damage": 0, "status": "low-stock"},
    {"id": 3, "name": "PowerCell", "sku": "WB-1003", "stock": 42, "location": "C2-11", "reorderPoint": 18, "damage": 2, "status": "healthy"},
    {"id": 4, "name": "SafetyClip", "sku": "WB-1004", "stock": 6, "location": "D3-05", "reorderPoint": 10, "damage": 1, "status": "critical"},
    {"id": 5, "name": "ThermalPad", "sku": "WB-1005", "stock": 19, "location": "E1-09", "reorderPoint": 14, "damage": 0, "status": "healthy"},
    {"id": 6, "name": "LiftArm", "sku": "WB-1006", "stock": 31, "location": "F2-04", "reorderPoint": 16, "damage": 0, "status": "healthy"}
]

orders = [
    {
        "id": 1,
        "customer": "Northwind Retail",
        "priority": "urgent",
        "status": "created",
        "due": "2026-08-17T18:00:00Z",
        "items": [{"productId": 1, "qty": 12, "allocated": 0}, {"productId": 4, "qty": 5, "allocated": 0}],
        "decision": "Pending stock allocation"
    },
    {
        "id": 2,
        "customer": "Atlas Medical",
        "priority": "standard",
        "status": "created",
        "due": "2026-08-17T21:00:00Z",
        "items": [{"productId": 2, "qty": 5, "allocated": 0}, {"productId": 5, "qty": 7, "allocated": 0}],
        "decision": "Awaiting priority review"
    },
    {
        "id": 3,
        "customer": "Mason Labs",
        "priority": "critical",
        "status": "created",
        "due": "2026-08-17T16:30:00Z",
        "items": [{"productId": 6, "qty": 9, "allocated": 0}],
        "decision": "High urgency - expedite picking"
    }
]

dispatches = []


def priority_score(priority):
    return {"critical": 4, "urgent": 3, "standard": 2, "low": 1}.get(priority, 1)


def recommend_reorder(product, shortage):
    reorder_qty = max(product["reorderPoint"] * 2, shortage + 8)
    return {
        "product": product["name"],
        "shortage": shortage,
        "recommendedOrderQty": reorder_qty,
        "reason": "Shortage detected during allocation" if shortage > 0 else "Reorder threshold reached"
    }


def allocate_order(order_id):
    order = next((o for o in orders if o["id"] == int(order_id)), None)
    if not order:
        return {"error": "Order not found"}

    decisions = []
    order_status = "allocated"

    for item in order["items"]:
        product = next((p for p in inventory if p["id"] == item["productId"]), None)
        if not product:
            decisions.append({"productId": item["productId"], "allocated": 0, "recommendation": "Product not found"})
            order_status = "exception"
            continue

        qty_needed = int(item["qty"])
        available = max(0, int(product["stock"]))
        qty_allocated = min(qty_needed, available)

        if qty_allocated == 0:
            decisions.append({
                "product": product["name"],
                "allocated": 0,
                "shortage": qty_needed,
                "recommendation": recommend_reorder(product, qty_needed)
            })
            order_status = "exception"
            continue

        product["stock"] -= qty_allocated
        item["allocated"] = qty_allocated

        if product["stock"] <= product["reorderPoint"]:
            product["status"] = "critical" if product["stock"] == 0 else "low-stock"
        else:
            product["status"] = "healthy"

        if qty_allocated < qty_needed:
            decisions.append({
                "product": product["name"],
                "allocated": qty_allocated,
                "shortage": qty_needed - qty_allocated,
                "recommendation": recommend_reorder(product, qty_needed - qty_allocated)
            })
            order_status = "partial"
        else:
            decisions.append({"product": product["name"], "allocated": qty_allocated, "shortage": 0, "recommendation": "No shortage"})

    order["status"] = order_status
    order["decision"] = (
        "Exception escalated to inventory team"
        if order_status == "exception"
        else "Partially allocated; follow-up replenishment recommended"
        if order_status == "partial"
        else "Fully allocated and ready for picking"
    )

    return {
        "orderId": order["id"],
        "priorityRank": priority_score(order["priority"]),
        "decisions": decisions,
        "finalStatus": order["status"],
        "nextAction": "Escalate to planner and trigger replenishment" if order_status == "exception" else "Release to picking and packing",
    }


class WarehouseHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/inventory':
            self._send_json(200, inventory)
            return

        if path == '/api/inventory/alerts':
            low_stock = [item for item in inventory if item['stock'] <= item['reorderPoint'] + 2]
            self._send_json(200, {'lowStock': low_stock})
            return

        if path == '/api/inventory/summary':
            total_items = len(inventory)
            total_units = sum(item['stock'] for item in inventory)
            active_orders = sum(1 for order in orders if order['status'] in {'created', 'allocated', 'partial', 'picking', 'packing'})
            dispatch_ready = sum(1 for order in orders if order['status'] in {'allocated', 'partial'})
            self._send_json(200, {'totalItems': total_items, 'totalUnits': total_units, 'activeOrders': active_orders, 'dispatchReady': dispatch_ready})
            return

        if path == '/api/orders':
            self._send_json(200, orders)
            return

        if path == '/api/dispatch':
            self._send_json(200, dispatches)
            return

        if path in ('/', '/index.html'):
            file_path = PUBLIC_DIR / 'index.html'
        else:
            file_path = PUBLIC_DIR / path.lstrip('/')

        if file_path.exists() and file_path.is_file():
            self.serve_file(file_path)
            return

        self._send_json(404, {'error': 'Not found'})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8') if length else ''
        payload = json.loads(body) if body else {}

        if path == '/api/orders':
            customer = payload.get('customer')
            priority = payload.get('priority', 'standard')
            items = payload.get('items', [])
            if not customer or not isinstance(items, list) or not items:
                self._send_json(400, {'error': 'Customer and items are required.'})
                return

            order_id = max((o['id'] for o in orders), default=0) + 1
            order = {
                'id': order_id,
                'customer': customer,
                'priority': priority,
                'status': 'created',
                'due': '2026-08-17T20:00:00Z',
                'items': [{'productId': item['productId'], 'qty': item['qty'], 'allocated': 0} for item in items],
                'decision': 'Awaiting inventory review'
            }
            orders.append(order)
            self._send_json(201, order)
            return

        if path.startswith('/api/orders/') and path.endswith('/allocate'):
            order_id = path.split('/')[2]
            result = allocate_order(order_id)
            self._send_json(200, result)
            return

        if path == '/api/dispatch':
            order_id = payload.get('orderId')
            carrier = payload.get('carrier', 'RouteFlow Express')
            dispatch_id = max((d['id'] for d in dispatches), default=0) + 1
            entry = {'id': dispatch_id, 'orderId': order_id, 'carrier': carrier, 'status': 'scheduled'}
            dispatches.append(entry)
            self._send_json(201, entry)
            return

        self._send_json(404, {'error': 'Not found'})

    def serve_file(self, file_path):
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
        }
        content = file_path.read_bytes()
        ext = file_path.suffix.lower()
        self.send_response(200)
        self.send_header('Content-Type', mime_types.get(ext, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    host = '0.0.0.0'
    port = 3000
    server = ThreadingHTTPServer((host, port), WarehouseHandler)
    print(f'Smart Warehouse OS running on http://localhost:{port}')
    server.serve_forever()

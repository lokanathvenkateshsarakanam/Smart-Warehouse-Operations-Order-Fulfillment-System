const API = '/api';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return response.json();
}

function renderKpis(summary) {
  const kpis = document.getElementById('kpis');
  const items = [
    { label: 'Total SKUs', value: summary.totalItems, meta: 'Live inventory count' },
    { label: 'Units available', value: summary.totalUnits, meta: 'Across all locations' },
    { label: 'Orders active', value: summary.activeOrders, meta: 'In flow today' },
    { label: 'Ready to dispatch', value: summary.dispatchReady, meta: 'Fulfillment ready' }
  ];

  kpis.innerHTML = items.map(item => `
    <div class="kpi-card">
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-meta">${item.meta}</div>
    </div>
  `).join('');
}

function renderInventory(items) {
  const list = document.getElementById('inventoryList');

  list.innerHTML = items.map(item => {
    const stockClass = item.stock <= item.reorderPoint ? 'badge-critical' : item.stock <= item.reorderPoint + 8 ? 'badge-low' : 'badge-good';
    return `
      <div class="inventory-item">
        <div>
          <div class="product-name">${item.name}</div>
          <div class="product-meta">SKU ${item.sku} · ${item.location}</div>
        </div>
        <div>
          <div class="product-meta">Reorder point</div>
          <strong>${item.reorderPoint}</strong>
        </div>
        <div>
          <div class="product-meta">Inventory</div>
          <strong>${item.stock}</strong>
        </div>
        <div class="stock-badge ${stockClass}">${item.status}</div>
      </div>
    `;
  }).join('');
}

function renderAlerts(items) {
  const list = document.getElementById('alertList');

  if (!items.length) {
    list.innerHTML = '<div class="alert-item"><span>No alerts. Inventory is healthy.</span></div>';
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="alert-item">
      <div>
        <div class="alert-label">${item.name}</div>
        <div class="product-meta">${item.stock} units left · reorder at ${item.reorderPoint}</div>
      </div>
      <span class="stock-badge badge-low">LOW</span>
    </div>
  `).join('');
}

function renderOrders(orders) {
  const list = document.getElementById('ordersList');

  list.innerHTML = orders.map(order => `
    <div class="order-card">
      <div>
        <div class="order-header">
          <strong>Order #${order.id}</strong>
          <span class="priority-tag priority-${order.priority}">${order.priority}</span>
        </div>
        <div class="order-meta">${order.customer}</div>
        <div class="order-meta">Items: ${order.items.map(item => `${item.qty} × ${item.productId}`).join(', ')}</div>
      </div>
      <div>
        <div class="order-meta">Status</div>
        <div class="status-text">${order.status}</div>
      </div>
      <div>
        <div class="order-meta">Due</div>
        <div class="status-text">${new Date(order.due).toLocaleString()}</div>
      </div>
      <div>
        <div class="order-meta">Decision</div>
        <div class="status-text">${order.decision}</div>
      </div>
      <div class="order-actions">
        <button data-action="allocate" data-id="${order.id}">Allocate</button>
        <button data-action="dispatch" data-id="${order.id}">Dispatch</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;
      if (action === 'allocate') {
        await fetchJson(`${API}/orders/${id}/allocate`, { method: 'POST' });
      } else {
        await fetchJson(`${API}/dispatch`, {
          method: 'POST',
          body: JSON.stringify({ orderId: id, carrier: 'RouteFlow Express' })
        });
      }
      loadAll();
    });
  });
}

function renderDispatches(items) {
  const list = document.getElementById('dispatchList');

  if (!items.length) {
    list.innerHTML = '<div class="dispatch-card"><span>No dispatches scheduled.</span></div>';
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="dispatch-card">
      <div>
        <strong>Dispatch #${item.id}</strong>
        <div class="order-meta">Order ${item.orderId} · ${item.carrier}</div>
      </div>
      <div class="status-text">${item.status}</div>
    </div>
  `).join('');
}

async function loadAll() {
  const [inventory, alerts, orders, dispatches, summary] = await Promise.all([
    fetchJson(`${API}/inventory`),
    fetchJson(`${API}/inventory/alerts`),
    fetchJson(`${API}/orders`),
    fetchJson(`${API}/dispatch`),
    fetchJson(`${API}/inventory/summary`)
  ]);

  renderKpis(summary);
  renderInventory(inventory);
  renderAlerts(alerts.lowStock || []);
  renderOrders(orders);
  renderDispatches(dispatches);
}

async function createDemoOrder() {
  await fetchJson(`${API}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      customer: 'Demo Distribution',
      priority: 'urgent',
      items: [
        { productId: 2, qty: 10 },
        { productId: 4, qty: 4 }
      ]
    })
  });
  await loadAll();
}

document.getElementById('refreshInventory').addEventListener('click', loadAll);
document.getElementById('createDemoOrder').addEventListener('click', createDemoOrder);

loadAll();

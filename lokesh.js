const express = require('express');
const path = require('path');

const { inventory, orders, dispatches } = require('./data/store');
const { allocateOrder } = require('./logic/allocation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/inventory', (req, res) => {
  res.json(inventory);
});

app.get('/api/inventory/alerts', (req, res) => {
  const lowStock = inventory.filter(item => item.stock <= item.reorderPoint + 2);
  res.json({ lowStock });
});

app.get('/api/inventory/summary', (req, res) => {
  const totalItems = inventory.length;
  const totalUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
  const activeOrders = orders.filter(order => ['created', 'allocated', 'partial', 'picking', 'packing'].includes(order.status)).length;
  const dispatchReady = orders.filter(order => order.status === 'allocated' || order.status === 'partial').length;

  res.json({ totalItems, totalUnits, activeOrders, dispatchReady });
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const { customer, priority = 'standard', items = [] } = req.body;

  if (!customer || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Customer and items are required.' });
  }

  const nextId = orders.length ? Math.max(...orders.map(order => order.id)) + 1 : 1;
  const order = {
    id: nextId,
    customer,
    priority,
    status: 'created',
    due: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    items: items.map(item => ({ productId: item.productId, qty: item.qty, allocated: 0 })),
    decision: 'Awaiting inventory review'
  };

  orders.push(order);
  res.status(201).json(order);
});

app.post('/api/orders/:id/allocate', (req, res) => {
  const result = allocateOrder(req.params.id);
  res.json(result);
});

app.get('/api/dispatch', (req, res) => {
  res.json(dispatches);
});

app.post('/api/dispatch', (req, res) => {
  const { orderId, carrier = 'RouteFlow Express' } = req.body;
  const id = dispatches.length ? Math.max(...dispatches.map(item => item.id)) + 1 : 1;
  const entry = { id, orderId, carrier, status: 'scheduled' };
  dispatches.push(entry);
  res.status(201).json(entry);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Warehouse OS running on http://localhost:${PORT}`);
});

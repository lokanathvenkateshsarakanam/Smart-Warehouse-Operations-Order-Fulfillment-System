const inventory = [
  { id: 1, name: 'AeroBolt', sku: 'WB-1001', stock: 28, location: 'A1-02', reorderPoint: 15, damage: 1, status: 'healthy' },
  { id: 2, name: 'ServoGear', sku: 'WB-1002', stock: 8, location: 'B4-07', reorderPoint: 12, damage: 0, status: 'low-stock' },
  { id: 3, name: 'PowerCell', sku: 'WB-1003', stock: 42, location: 'C2-11', reorderPoint: 18, damage: 2, status: 'healthy' },
  { id: 4, name: 'SafetyClip', sku: 'WB-1004', stock: 6, location: 'D3-05', reorderPoint: 10, damage: 1, status: 'critical' },
  { id: 5, name: 'ThermalPad', sku: 'WB-1005', stock: 19, location: 'E1-09', reorderPoint: 14, damage: 0, status: 'healthy' },
  { id: 6, name: 'LiftArm', sku: 'WB-1006', stock: 31, location: 'F2-04', reorderPoint: 16, damage: 0, status: 'healthy' }
];

const orders = [
  {
    id: 1,
    customer: 'Northwind Retail',
    priority: 'urgent',
    status: 'created',
    due: '2026-08-17T18:00:00Z',
    items: [
      { productId: 1, qty: 12, allocated: 0 },
      { productId: 4, qty: 5, allocated: 0 }
    ],
    decision: 'Pending stock allocation'
  },
  {
    id: 2,
    customer: 'Atlas Medical',
    priority: 'standard',
    status: 'created',
    due: '2026-08-17T21:00:00Z',
    items: [
      { productId: 2, qty: 5, allocated: 0 },
      { productId: 5, qty: 7, allocated: 0 }
    ],
    decision: 'Awaiting priority review'
  },
  {
    id: 3,
    customer: 'Mason Labs',
    priority: 'critical',
    status: 'created',
    due: '2026-08-17T16:30:00Z',
    items: [
      { productId: 6, qty: 9, allocated: 0 }
    ],
    decision: 'High urgency - expedite picking'
  }
];

const dispatches = [];

module.exports = { inventory, orders, dispatches };

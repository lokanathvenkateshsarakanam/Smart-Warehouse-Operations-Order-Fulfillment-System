const { inventory, orders } = require('../data/store');

function priorityScore(priority) {
  const map = { critical: 4, urgent: 3, standard: 2, low: 1 };
  return map[priority] || 1;
}

function recommendReorder(product, shortage) {
  const reorderQty = Math.max(product.reorderPoint * 2, shortage + 8);
  return {
    product: product.name,
    shortage,
    recommendedOrderQty: reorderQty,
    reason: shortage > 0 ? 'Shortage detected during allocation' : 'Reorder threshold reached'
  };
}

function allocateOrder(orderId) {
  const order = orders.find(item => item.id === Number(orderId));
  if (!order) return { error: 'Order not found' };

  const decisions = [];
  let orderStatus = 'allocated';

  order.items.forEach(item => {
    const product = inventory.find(p => p.id === item.productId);
    if (!product) {
      decisions.push({ productId: item.productId, allocated: 0, recommendation: 'Product not found' });
      orderStatus = 'exception';
      return;
    }

    const available = Math.max(0, product.stock);
    const qtyNeeded = item.qty;
    const qtyAllocated = Math.min(qtyNeeded, available);

    if (qtyAllocated === 0) {
      decisions.push({
        product: product.name,
        allocated: 0,
        shortage: qtyNeeded,
        recommendation: recommendReorder(product, qtyNeeded)
      });
      orderStatus = 'exception';
      return;
    }

    product.stock -= qtyAllocated;
    item.allocated = qtyAllocated;

    if (product.stock <= product.reorderPoint) {
      product.status = product.stock === 0 ? 'critical' : 'low-stock';
    } else {
      product.status = 'healthy';
    }

    if (qtyAllocated < qtyNeeded) {
      decisions.push({
        product: product.name,
        allocated: qtyAllocated,
        shortage: qtyNeeded - qtyAllocated,
        recommendation: recommendReorder(product, qtyNeeded - qtyAllocated)
      });
      orderStatus = 'partial';
    } else {
      decisions.push({ product: product.name, allocated: qtyAllocated, shortage: 0, recommendation: 'No shortage' });
    }
  });

  order.status = orderStatus;
  order.decision = orderStatus === 'exception'
    ? 'Exception escalated to inventory team'
    : orderStatus === 'partial'
      ? 'Partially allocated; follow-up replenishment recommended'
      : 'Fully allocated and ready for picking';

  const priorityRank = priorityScore(order.priority);
  const recommendation = {
    orderId: order.id,
    priorityRank,
    decisions,
    finalStatus: order.status,
    nextAction: orderStatus === 'exception' ? 'Escalate to planner and trigger replenishment' : 'Release to picking and packing'
  };

  return recommendation;
}

module.exports = { allocateOrder, priorityScore, recommendReorder };

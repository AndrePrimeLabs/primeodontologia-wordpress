const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

/**
 * SOP-PART-02: Supplier Procurement Auto-Replenishment on Low Stock Alert.
 * When RES-X emits `resource.low_stock`, PART-X identifies the preferred dental supply
 * partner and creates a replenishment order.
 */
function initResourceLowStockSubscriber() {
  subscribe('resource.low_stock', async (payload) => {
    const { tenantId, resource, reason } = payload;
    if (!tenantId || !resource) return;

    try {
      // 1. Fetch available supply partners
      const partnersRes = await tenantQuery(
        tenantId,
        `SELECT id, name, category, strategic_importance
         FROM key_partners
         WHERE tenant_id = $1 AND status = 'ativo'
         ORDER BY
           (category ILIKE '%fornec%' OR category ILIKE '%mater%' OR category ILIKE '%suppl%') DESC,
           created_at ASC
         LIMIT 1`,
        [tenantId]
      );

      const partner = partnersRes.rows[0];
      if (!partner) {
        console.warn(`[PART-X] SOP-PART-02: No active partner available for replenishing "${resource.name}"`);
        return;
      }

      const orderQty = Math.max(10, (resource.min_quantity || 5) * 2);
      const notes = `SOP-PART-02 Reabastecimento Automático: Pedido de ${orderQty} un. de "${resource.name}". Alerta: ${reason || 'Estoque abaixo do mínimo'}.`;

      // 2. Persist order in lab_orders
      const orderRes = await tenantQuery(
        tenantId,
        `INSERT INTO lab_orders (tenant_id, partner_id, order_type, status, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, partner.id, 'SUPPLIES_REPLENISHMENT', 'dispatched', notes]
      );

      const replenishmentOrder = orderRes.rows[0];
      console.log(`[PART-X] SOP-PART-02: Auto-replenishment order #${replenishmentOrder.id.slice(0, 8)} dispatched to "${partner.name}" for ${resource.name}`);

      // 3. Publish procurement.order.created
      await publish('procurement.order.created', {
        tenantId,
        order: replenishmentOrder,
        partner,
        resource
      });
    } catch (err) {
      console.error('[PART-X] Error in resource.low_stock subscriber:', err.message);
    }
  });
}

module.exports = { initResourceLowStockSubscriber };

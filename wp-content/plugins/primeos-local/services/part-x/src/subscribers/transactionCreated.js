const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initTransactionCreatedSubscriber() {
  subscribe('transaction.created', async (payload) => {
    const { tenantId, transaction } = payload;
    if (!tenantId || !transaction || transaction.amount === undefined) return;

    try {
      const amount = Number(transaction.amount);

      // Only dispatch supplier / lab fulfillment for confirmed/paid clinical transactions
      const status = (transaction.status || 'paid').toLowerCase();
      if (status !== 'paid' && status !== 'settled') {
        return;
      }

      // 1. Fetch active partners for this tenant
      const partnersRes = await tenantQuery(
        tenantId,
        `SELECT id, name, category, strategic_importance
         FROM key_partners
         WHERE tenant_id = $1 AND status = 'ativo'
         ORDER BY
           CASE strategic_importance WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 ELSE 3 END ASC`,
        [tenantId]
      );

      if (partnersRes.rows.length === 0) {
        console.warn(`[PART-X] No active partners found for tenant ${tenantId}`);
        return;
      }

      // 2. Resolve strategic partner and order type based on transaction value and domain
      let selectedPartner = null;
      let orderType = 'ALIGNER_FABRICATION';

      if (amount >= 5000) {
        // High-ticket clear aligner or comprehensive rehabilitation
        selectedPartner = partnersRes.rows.find(p => p.name.includes('Align') || p.category === 'fornecedor_estrategico');
        orderType = 'ALIGNER_FABRICATION';
      } else if (amount >= 2000) {
        // Implants or surgical guides
        selectedPartner = partnersRes.rows.find(p => p.name.includes('Straumann') || p.name.includes('Neodent') || p.category === 'implantes_cirurgia');
        orderType = 'IMPLANT_GUIDE_FABRICATION';
      }

      // Fallback to dental prosthetics lab or first available partner
      if (!selectedPartner) {
        selectedPartner = partnersRes.rows.find(p => p.category === 'laboratorio_dental') || partnersRes.rows[0];
        orderType = 'PROSTHETIC_MILLING';
      }

      const notes = `Fulfillment gerado automaticamente ref. Transação #${(transaction.id || '').slice(0, 8)} (R$ ${amount.toFixed(2)} - ${transaction.payment_method || 'PIX'}). Paciente #${(transaction.customer_id || '').slice(0, 8)}`;

      // 3. Persist order in lab_orders
      const orderRes = await tenantQuery(
        tenantId,
        `INSERT INTO lab_orders (tenant_id, partner_id, transaction_id, customer_id, order_type, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, selectedPartner.id, transaction.id || null, transaction.customer_id || null, orderType, 'dispatched', notes]
      );

      const labOrder = orderRes.rows[0];
      console.log(`[PART-X] Auto-dispatched ${orderType} order #${labOrder.id.slice(0, 8)} to partner "${selectedPartner.name}"`);

      // 4. Publish lab_order.created onto NATS mesh
      await publish('lab_order.created', { tenantId, labOrder, partner: selectedPartner });
    } catch (err) {
      console.error('[PART-X] Error in transaction.created subscriber:', err.message);
    }
  });
}

module.exports = { initTransactionCreatedSubscriber };

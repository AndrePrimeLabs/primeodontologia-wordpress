const { subscribe } = require('../events');
const { tenantQuery } = require('../db');

function initTransactionCreatedSubscriber() {
  subscribe('transaction.created', async (payload) => {
    const { tenantId, transaction } = payload;
    if (!tenantId || !transaction || !transaction.customer_id) return;

    try {
      const formattedAmount = Number(transaction.amount).toFixed(2);
      const notes = `Pagamento recebido no valor de R$ ${formattedAmount} via ${transaction.payment_method || 'PIX'} (${transaction.installments || 1}x). Status: ${transaction.status || 'pago'}`;

      await tenantQuery(
        tenantId,
        `INSERT INTO interactions (tenant_id, customer_id, channel, notes)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, transaction.customer_id, 'REV-X Financial Gateway', notes]
      );

      // Accrue loyalty points (1 point per R$ 10 spent, min 1 point)
      const points = Math.max(1, Math.floor(Number(transaction.amount) / 10));
      await tenantQuery(
        tenantId,
        `INSERT INTO loyalty_points (tenant_id, customer_id, points, reason)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, transaction.customer_id, points, `Cashback/Pontos sobre transação R$ ${formattedAmount}`]
      );

      console.log(`[CRM-X] Auto-logged financial interaction and accrued ${points} loyalty points for customer #${transaction.customer_id} (R$ ${formattedAmount})`);
    } catch (err) {
      console.error('[CRM-X] Error in transaction.created subscriber:', err.message);
    }
  });
}

module.exports = { initTransactionCreatedSubscriber };

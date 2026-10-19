const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initTransactionCreatedSubscriber() {
  subscribe('transaction.created', async (payload) => {
    const { tenantId, transaction } = payload;
    if (!tenantId || !transaction || !transaction.amount) return;

    try {
      const amount = Number(transaction.amount);
      const isPix = (transaction.payment_method || '').toLowerCase() === 'pix';
      const feeRate = isPix ? 0.0099 : 0.0299;
      const feeAmount = Number((amount * feeRate).toFixed(2));

      if (feeAmount <= 0) return;

      const desc = `Taxa Gateway (${isPix ? 'PIX 0.99%' : 'Cartão 2.99%'}) ref. Transação #${(transaction.id || '').slice(0, 8)}`;
      const result = await tenantQuery(
        tenantId,
        `INSERT INTO expenses (tenant_id, category_id, description, cost_type, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, 'CC-VAR-MKT', desc, 'VARIABLE', feeAmount, transaction.currency || 'BRL', 'settled']
      );

      const createdExpense = result.rows[0];
      console.log(`[COST-X] Auto-recorded payment fee expense of R$ ${feeAmount} for transaction #${transaction.id}`);

      await publish('expense.created', { tenantId, expense: createdExpense });
    } catch (err) {
      console.error('[COST-X] Error in transaction.created subscriber:', err.message);
    }
  });
}

module.exports = { initTransactionCreatedSubscriber };

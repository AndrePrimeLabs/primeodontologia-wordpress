const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initTicketCreatedSubscriber() {
  subscribe('ticket.created', async (payload) => {
    const { tenantId, ticket } = payload;
    if (!tenantId || !ticket || !ticket.id) return;

    try {
      const priorityInt = ticket.priority === 'urgent' ? 1 : ticket.priority === 'high' ? 2 : 3;
      const activityName = `Atendimento Clínico / Suporte: Chamado #${ticket.id.slice(0, 8)}`;

      const result = await tenantQuery(
        tenantId,
        `INSERT INTO key_activities (tenant_id, name, category, status, priority, frequency, customer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, activityName, 'CLINICAL_SUPPORT', 'active', priorityInt, 'ad-hoc', ticket.customer_id || null]
      );

      const createdActivity = result.rows[0];
      console.log(`[ACT-X] Auto-created key activity "${createdActivity.name}" for ticket #${ticket.id}`);

      await publish('activity.created', { tenantId, activity: createdActivity });
    } catch (err) {
      console.error('[ACT-X] Error in ticket.created subscriber:', err.message);
    }
  });
}

module.exports = { initTicketCreatedSubscriber };

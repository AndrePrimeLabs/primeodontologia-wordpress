const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initActivityCompletedSubscriber() {
  subscribe('activity.completed', async (payload) => {
    const { tenantId, activity, customer_id } = payload;
    const patientId = customer_id || (activity && activity.customer_id);
    if (!tenantId || !patientId) return;

    try {
      const activityTitle = (activity && activity.name) || 'Procedimento Clínico';

      // SOP-CRM-01: Post-Procedure Clinical Check-In sequence:
      // Day 1: WhatsApp check-in (pain/bleeding/medication)
      // Day 7: Concierge check-in (soft-tissue healing / suture removal)
      // Day 30: Digital progress review & aesthetic check-in
      const followUpPlans = [
        {
          days: 1,
          type: 'SOP-CRM-01-D1',
          notes: `Check-in D+1 WhatsApp pós-procedimento (${activityTitle}): monitoramento de dor, sangramento e adesão medicamentosa.`
        },
        {
          days: 7,
          type: 'SOP-CRM-01-D7',
          notes: `Check-in D+7 Concierge pós-procedimento (${activityTitle}): avaliação de cicatrização tecidual e agendamento de revisão/suturas.`
        },
        {
          days: 30,
          type: 'SOP-CRM-01-D30',
          notes: `Check-in D+30 Clínico pós-procedimento (${activityTitle}): avaliação oclusal/estética e comparação com escaneamento inicial.`
        }
      ];

      const createdFollowUps = [];
      for (const plan of followUpPlans) {
        const result = await tenantQuery(
          tenantId,
          `INSERT INTO follow_ups (tenant_id, customer_id, due_at, status, type, notes)
           VALUES ($1, $2, now() + ($3 || ' days')::interval, 'pending', $4, $5)
           RETURNING *`,
          [tenantId, patientId, plan.days, plan.type, plan.notes]
        );
        createdFollowUps.push(result.rows[0]);
      }

      // Log interaction in CRM timeline
      const interactionNotes = `Protocolo SOP-CRM-01 ativado para "${activityTitle}": 3 check-ins agendados (D+1, D+7, D+30).`;
      await tenantQuery(
        tenantId,
        `INSERT INTO interactions (tenant_id, customer_id, channel, notes)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, patientId, 'SOP-CRM-01 Automation', interactionNotes]
      );

      console.log(`[CRM-X] SOP-CRM-01 activated for customer #${patientId}: 3 follow-ups scheduled.`);

      // Broadcast event so UI / integrations can react
      await publish('crm.followups.scheduled', {
        tenantId,
        customerId: patientId,
        activityId: activity ? activity.id : null,
        followUps: createdFollowUps
      });
    } catch (err) {
      console.error('[CRM-X] Error in activity.completed subscriber:', err.message);
    }
  });
}

module.exports = { initActivityCompletedSubscriber };

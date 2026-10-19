const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initLeadCapturedSubscriber() {
  subscribe('lead.captured', async (payload) => {
    const { tenantId, lead } = payload;
    if (!tenantId || !lead || !lead.name) return;

    try {
      let customerId = null;

      // 1. Check if customer already exists by email or phone
      if (lead.email || lead.phone) {
        const checkRes = await tenantQuery(
          tenantId,
          `SELECT id, name, email, phone FROM customers
           WHERE tenant_id = $1 AND (
             ($2::text IS NOT NULL AND email = $2) OR
             ($3::text IS NOT NULL AND phone = $3)
           ) LIMIT 1`,
          [tenantId, lead.email || null, lead.phone || null]
        );
        if (checkRes.rows.length > 0) {
          customerId = checkRes.rows[0].id;
          console.log(`[CRM-X] Matched incoming lead "${lead.name}" to existing customer #${customerId}`);
        }
      }

      // 2. If not found, create new customer in CRM-X
      if (!customerId) {
        const custRes = await tenantQuery(
          tenantId,
          `INSERT INTO customers (tenant_id, name, email, phone)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [tenantId, lead.name, lead.email || null, lead.phone || null]
        );
        const newCustomer = custRes.rows[0];
        customerId = newCustomer.id;
        console.log(`[CRM-X] Converted lead "${lead.name}" to new customer #${customerId}`);

        // Trigger customer.created on NATS mesh so SEG-X can auto-segment!
        await publish('customer.created', {
          tenantId,
          customer: { ...newCustomer, notes: lead.notes, leadNotes: lead.notes }
        });
      }

      // 3. Log initial contact interaction in interactions table
      const channelName = lead.channel_name || 'Marketing Channel';
      const notes = `Lead capturado via ${channelName}. ${lead.notes ? `Observações: ${lead.notes}` : ''} (Campanha: ${lead.campaign_id || 'N/A'})`;

      const interactionRes = await tenantQuery(
        tenantId,
        `INSERT INTO interactions (tenant_id, customer_id, channel, notes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenantId, customerId, channelName, notes]
      );

      console.log(`[CRM-X] Logged lead interaction for customer #${customerId} via "${channelName}"`);
      await publish('interaction.logged', { tenantId, interaction: interactionRes.rows[0] });
    } catch (err) {
      console.error('[CRM-X] Error in lead.captured subscriber:', err.message);
    }
  });
}

module.exports = { initLeadCapturedSubscriber };

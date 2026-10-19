const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initCustomerSegmentedSubscriber() {
  subscribe('customer.segmented', async (payload) => {
    const { tenantId, customerId, segmentId, segmentName } = payload;
    if (!tenantId || !segmentId) return;

    try {
      // 1. Find the best matching value proposition for this segment
      const propRes = await tenantQuery(
        tenantId,
        `SELECT id, name, core_promise, segment_id, fit_score
         FROM value_propositions
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY (segment_id = $2) DESC, fit_score DESC
         LIMIT 1`,
        [tenantId, segmentId]
      );

      if (propRes.rows.length === 0) return;
      let proposition = propRes.rows[0];

      // If proposition is not yet linked to segment, associate it
      if (!proposition.segment_id) {
        const updateRes = await tenantQuery(
          tenantId,
          `UPDATE value_propositions SET segment_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
          [segmentId, proposition.id]
        );
        proposition = updateRes.rows[0];
      }

      console.log(`[VALUE-X] Matched proposition "${proposition.name}" to segment "${segmentName}" for customer #${(customerId || '').slice(0, 8)}`);

      // 2. Publish proposition.matched onto NATS mesh
      await publish('proposition.matched', {
        tenantId,
        customerId,
        segmentId,
        segmentName,
        proposition: {
          id: proposition.id,
          name: proposition.name,
          core_promise: proposition.core_promise
        }
      });
    } catch (err) {
      console.error('[VALUE-X] Error in customer.segmented subscriber:', err.message);
    }
  });
}

module.exports = { initCustomerSegmentedSubscriber };

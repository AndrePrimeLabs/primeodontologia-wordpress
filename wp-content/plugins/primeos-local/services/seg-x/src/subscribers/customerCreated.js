const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initCustomerCreatedSubscriber() {
  subscribe('customer.created', async (payload) => {
    const { tenantId, customer } = payload;
    if (!tenantId || !customer || !customer.id) return;

    try {
      // SOP-SEG-01: Rule-based segment evaluation using keywords criteria
      const segResult = await tenantQuery(
        tenantId,
        `SELECT id, name, criteria FROM customer_segments WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC`,
        [tenantId]
      );

      if (segResult.rows.length === 0) return;
      const segments = segResult.rows;

      // Match against lead notes, chief complaint, or customer name
      let selectedSegment = segments[0];
      const textToMatch = `${customer.name || ''} ${customer.notes || ''} ${customer.leadNotes || ''}`.toLowerCase();

      for (const seg of segments) {
        let keywords = [];
        if (seg.criteria && Array.isArray(seg.criteria.keywords)) {
          keywords = seg.criteria.keywords;
        } else if (typeof seg.criteria === 'string') {
          try {
            const parsed = JSON.parse(seg.criteria);
            if (Array.isArray(parsed.keywords)) keywords = parsed.keywords;
          } catch (_) {}
        }

        if (keywords.some((kw) => textToMatch.includes(kw.toLowerCase()))) {
          selectedSegment = seg;
          break;
        }
      }

      // Assign customer to segment if not already assigned
      await tenantQuery(
        tenantId,
        `UPDATE customers SET segment_id = $1 WHERE id = $2 AND segment_id IS NULL`,
        [selectedSegment.id, customer.id]
      );

      console.log(`[SEG-X] Auto-assigned customer "${customer.name}" to segment "${selectedSegment.name}" (${selectedSegment.id})`);

      await publish('customer.segmented', {
        tenantId,
        customerId: customer.id,
        segmentId: selectedSegment.id,
        segmentName: selectedSegment.name
      });
    } catch (err) {
      console.error('[SEG-X] Error in customer.created subscriber:', err.message);
    }
  });
}

module.exports = { initCustomerCreatedSubscriber };

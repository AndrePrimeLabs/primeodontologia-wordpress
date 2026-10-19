const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

function initLabOrderCreatedSubscriber() {
  subscribe('lab_order.created', async (payload) => {
    const { tenantId, labOrder, partner } = payload;
    if (!tenantId || !labOrder) return;

    try {
      // 1. Find key clinical physical resource (e.g. 3D Scanner or Dental Operatory)
      const resResult = await tenantQuery(
        tenantId,
        `SELECT id, name, resource_type, status, quantity
         FROM key_resources
         WHERE tenant_id = $1 AND status != 'maintenance'
         ORDER BY (resource_type = 'PHYSICAL') DESC, (status = 'available') DESC, created_at ASC
         LIMIT 1`,
        [tenantId]
      );

      const resource = resResult.rows[0];
      if (!resource) {
        console.warn(`[RES-X] No key resources found to allocate for tenant ${tenantId}`);
        return;
      }

      // 2. Mark resource as in_use / allocated for chairside preparation
      const updateRes = await tenantQuery(
        tenantId,
        `UPDATE key_resources SET status = 'in_use', updated_at = now() WHERE id = $1 RETURNING *`,
        [resource.id]
      );
      const allocatedResource = updateRes.rows[0] || resource;

      console.log(`[RES-X] Allocated Key Resource "${allocatedResource.name}" for lab order #${(labOrder.id || '').slice(0, 8)} (${partner?.name || 'Partner'})`);

      // 3. Publish resource.allocated
      await publish('resource.allocated', {
        tenantId,
        labOrderId: labOrder.id,
        partnerId: partner?.id,
        resource: {
          id: allocatedResource.id,
          name: allocatedResource.name,
          status: allocatedResource.status,
          resource_type: allocatedResource.resource_type
        }
      });
    } catch (err) {
      console.error('[RES-X] Error in lab_order.created subscriber:', err.message);
    }
  });
}

module.exports = { initLabOrderCreatedSubscriber };

const { subscribe, publish } = require('../events');
const { tenantQuery } = require('../db');

/**
 * SOP-RES-01: Resource Inventory Consumption & Release on Activity Completion.
 * 1. Releases any allocated physical equipment (status: 'in_use' -> 'available').
 * 2. Deducts consumable inventory if the activity consumes materials (e.g. 3D printing resin, surgical kits, impression materials).
 * 3. Emits `resource.released`, `resource.consumed`, and if quantity <= min_quantity, emits `resource.low_stock`.
 */
function initActivityCompletedSubscriber() {
  subscribe('activity.completed', async (payload) => {
    const { tenantId, activity } = payload;
    if (!tenantId || !activity) return;

    try {
      // 1. Release allocated PHYSICAL resources for this tenant
      const physicalResult = await tenantQuery(
        tenantId,
        `UPDATE key_resources
         SET status = 'available', updated_at = now()
         WHERE tenant_id = $1 AND status = 'in_use' AND resource_type = 'PHYSICAL'
         RETURNING *`,
        [tenantId]
      );

      for (const res of physicalResult.rows) {
        console.log(`[RES-X] SOP-RES-01 Released Key Resource "${res.name}" (status: available) on activity completion (#${activity.id})`);
        await publish('resource.released', {
          tenantId,
          activityId: activity.id,
          resource: {
            id: res.id,
            name: res.name,
            status: res.status,
            resource_type: res.resource_type
          }
        });
      }

      // 2. Consume relevant CONSUMABLE resources
      const consumableResult = await tenantQuery(
        tenantId,
        `SELECT id, name, resource_type, quantity, min_quantity, unit_value
         FROM key_resources
         WHERE tenant_id = $1 AND resource_type = 'CONSUMABLE' AND quantity > 0
         ORDER BY
           (CASE WHEN $2 ILIKE '%' || name || '%' THEN 1 ELSE 2 END) ASC,
           (name ILIKE '%Resina%' OR name ILIKE '%Consum%' OR name ILIKE '%Kit%') DESC,
           created_at DESC
         LIMIT 1`,
        [tenantId, activity.name || '']
      );

      const consumable = consumableResult.rows[0];
      if (consumable) {
        const consumptionQty = 1;
        const updateConsumableResult = await tenantQuery(
          tenantId,
          `UPDATE key_resources
           SET quantity = GREATEST(0, quantity - $2), updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [consumable.id, consumptionQty]
        );

        const updatedConsumable = updateConsumableResult.rows[0] || consumable;
        console.log(`[RES-X] SOP-RES-01 Consumed ${consumptionQty} of "${updatedConsumable.name}". Remaining stock: ${updatedConsumable.quantity}`);

        await publish('resource.consumed', {
          tenantId,
          activityId: activity.id,
          resource: {
            id: updatedConsumable.id,
            name: updatedConsumable.name,
            consumed_quantity: consumptionQty,
            remaining_quantity: Number(updatedConsumable.quantity)
          }
        });

        // 3. Low stock threshold detection
        const minQty = Number(updatedConsumable.min_quantity ?? 5);
        if (Number(updatedConsumable.quantity) <= minQty) {
          console.warn(`[RES-X] SOP-RES-01 LOW STOCK ALERT: "${updatedConsumable.name}" has ${updatedConsumable.quantity} remaining (min threshold: ${minQty})`);
          await publish('resource.low_stock', {
            tenantId,
            resource: {
              id: updatedConsumable.id,
              name: updatedConsumable.name,
              quantity: Number(updatedConsumable.quantity),
              min_quantity: minQty,
              unit_value: updatedConsumable.unit_value
            },
            reason: `Stock fell to ${updatedConsumable.quantity} (min threshold: ${minQty}) after activity completion`
          });
        }
      }
    } catch (err) {
      console.error('[RES-X] Error in activity.completed subscriber:', err.message);
    }
  });
}

module.exports = { initActivityCompletedSubscriber };

const express = require('express');
const { tenantQuery } = require('../db');
const { publish } = require('../events');

const router = express.Router();

// POST /api/partners
router.post('/', async (req, res) => {
  const { name, category, dependency_level = 'media', strategic_importance = 'alta', contact_info, contract_details, on_time_delivery_rate = 95.0, status = 'ativo' } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

  try {
    const result = await tenantQuery(
      req.tenantId,
      `INSERT INTO key_partners (tenant_id, name, category, dependency_level, strategic_importance, contact_info, contract_details, on_time_delivery_rate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.tenantId, name, category, dependency_level, strategic_importance, contact_info, contract_details, on_time_delivery_rate, status]
    );
    const partner = result.rows[0];
    await publish('partner.created', { tenantId: req.tenantId, partner });
    res.status(201).json(partner);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create key partner' });
  }
});

// GET /api/partners
router.get('/', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM key_partners ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch key partners' });
  }
});

// GET /api/partners/orders — list strategic partner / lab fulfillment orders
router.get('/orders', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT o.*, p.name AS partner_name, p.category AS partner_category
       FROM lab_orders o
       LEFT JOIN key_partners p ON o.partner_id = p.id
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch partner orders' });
  }
});

// PATCH /api/partners/orders/:id/status — SOP-PART-01 status progression
router.patch('/orders/:id/status', async (req, res) => {
  const { status, notes } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE lab_orders
       SET status = $2,
           notes = COALESCE($3, notes),
           updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, status, notes]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];

    await publish('lab.order.updated', { tenantId: req.tenantId, order });

    if (status === 'delivered_to_clinic') {
      await publish('lab.order.delivered', { tenantId: req.tenantId, order });
      console.log(`[PART-X] SOP-PART-01 Milestone: Lab order #${order.id} delivered to clinic!`);
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET /api/partners/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM key_partners WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Partner not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch partner' });
  }
});

// PUT /api/partners/:id
router.put('/:id', async (req, res) => {
  const { name, category, dependency_level, strategic_importance, contact_info, contract_details, on_time_delivery_rate, status } = req.body;
  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE key_partners
       SET name = COALESCE($2, name),
           category = COALESCE($3, category),
           dependency_level = COALESCE($4, dependency_level),
           strategic_importance = COALESCE($5, strategic_importance),
           contact_info = COALESCE($6, contact_info),
           contract_details = COALESCE($7, contract_details),
           on_time_delivery_rate = COALESCE($8, on_time_delivery_rate),
           status = COALESCE($9, status),
           updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, category, dependency_level, strategic_importance, contact_info, contract_details, on_time_delivery_rate, status]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Partner not found' });
    const partner = result.rows[0];
    await publish('partner.updated', { tenantId: req.tenantId, partner });
    res.json(partner);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

module.exports = router;

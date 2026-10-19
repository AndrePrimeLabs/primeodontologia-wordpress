const express = require('express');
const { tenantQuery } = require('../db');
const { publish } = require('../events');

const router = express.Router();

// POST /api/activities
router.post('/', async (req, res) => {
  const { name, category, owner_id, status = 'active', priority = 3, kpi_target, kpi_actual, frequency = 'daily', customer_id } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

  let priorityVal = priority;
  if (typeof priority === 'string') {
    const map = { urgent: 1, urgente: 1, high: 2, alta: 2, medium: 3, media: 3, normal: 3, low: 4, baixa: 4 };
    priorityVal = map[priority.toLowerCase()] || parseInt(priority, 10) || 3;
  }

  try {
    const result = await tenantQuery(
      req.tenantId,
      `INSERT INTO key_activities (tenant_id, name, category, owner_id, status, priority, kpi_target, kpi_actual, frequency, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.tenantId, name, category, owner_id, status, priorityVal, kpi_target, kpi_actual, frequency, customer_id || null]
    );
    const activity = result.rows[0];
    await publish('activity.created', { tenantId: req.tenantId, activity });
    if (activity.status === 'completed') {
      await publish('activity.completed', { tenantId: req.tenantId, activity, customer_id: activity.customer_id });
    }
    res.status(201).json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create key activity' });
  }
});

// GET /api/activities
router.get('/', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM key_activities ORDER BY priority ASC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// GET /api/activities/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM key_activities WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// PUT /api/activities/:id
router.put('/:id', async (req, res) => {
  const { name, category, owner_id, status, priority, kpi_target, kpi_actual, frequency, customer_id } = req.body;
  let priorityVal = priority;
  if (typeof priority === 'string') {
    const map = { urgent: 1, urgente: 1, high: 2, alta: 2, medium: 3, media: 3, normal: 3, low: 4, baixa: 4 };
    priorityVal = map[priority.toLowerCase()] || parseInt(priority, 10) || 3;
  }
  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE key_activities
       SET name = COALESCE($2, name),
           category = COALESCE($3, category),
           owner_id = COALESCE($4, owner_id),
           status = COALESCE($5, status),
           priority = COALESCE($6, priority),
           kpi_target = COALESCE($7, kpi_target),
           kpi_actual = COALESCE($8, kpi_actual),
           frequency = COALESCE($9, frequency),
           customer_id = COALESCE($10, customer_id),
           updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, category, owner_id, status, priorityVal, kpi_target, kpi_actual, frequency, customer_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    const activity = result.rows[0];
    await publish('activity.updated', { tenantId: req.tenantId, activity });
    if (activity.status === 'completed') {
      await publish('activity.completed', { tenantId: req.tenantId, activity, customer_id: activity.customer_id });
    }
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// PATCH /api/activities/:id/complete
router.patch('/:id/complete', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE key_activities
       SET status = 'completed',
           updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    const activity = result.rows[0];
    await publish('activity.completed', { tenantId: req.tenantId, activity, customer_id: activity.customer_id });
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete activity' });
  }
});

module.exports = router;

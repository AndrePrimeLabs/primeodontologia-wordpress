const express = require('express');
const { tenantQuery } = require('../db');
const { publish } = require('../events');

const router = express.Router();

// GET /api/follow-ups
router.get('/', async (req, res) => {
  const { customer_id, status } = req.query;

  try {
    let query = `
      SELECT f.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
      FROM follow_ups f
      LEFT JOIN customers c ON f.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (customer_id) {
      query += ` AND f.customer_id = $${paramIdx++}`;
      params.push(customer_id);
    }
    if (status) {
      query += ` AND f.status = $${paramIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY f.due_at ASC`;

    const result = await tenantQuery(req.tenantId, query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// POST /api/follow-ups
router.post('/', async (req, res) => {
  const { customer_id, due_at, type, notes } = req.body;
  if (!customer_id || !due_at) {
    return res.status(400).json({ error: 'customer_id and due_at are required' });
  }

  try {
    const result = await tenantQuery(
      req.tenantId,
      `INSERT INTO follow_ups (tenant_id, customer_id, due_at, status, type, notes)
       VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING *`,
      [req.tenantId, customer_id, due_at, type || 'manual', notes || null]
    );
    const followUp = result.rows[0];
    await publish('crm.followup.created', { tenantId: req.tenantId, followUp });
    res.status(201).json(followUp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

// PATCH /api/follow-ups/:id
router.patch('/:id', async (req, res) => {
  const { status, notes } = req.body;
  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE follow_ups
       SET status = COALESCE($2, status),
           notes = COALESCE($3, notes)
       WHERE id = $1 RETURNING *`,
      [req.params.id, status, notes]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
    const followUp = result.rows[0];
    await publish('crm.followup.updated', { tenantId: req.tenantId, followUp });
    res.json(followUp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update follow-up' });
  }
});

module.exports = router;

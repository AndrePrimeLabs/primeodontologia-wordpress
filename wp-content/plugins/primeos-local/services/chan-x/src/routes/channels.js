const express = require('express');
const { tenantQuery } = require('../db');
const { publish } = require('../events');

const router = express.Router();

// POST /api/channels
router.post('/', async (req, res) => {
  const { name, channel_type = 'DIGITAL', phase = 'AWARENESS', cost_per_acquisition = 0, conversion_rate = 0, is_active = true } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await tenantQuery(
      req.tenantId,
      `INSERT INTO channels (tenant_id, name, channel_type, phase, cost_per_acquisition, conversion_rate, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.tenantId, name, channel_type, phase, cost_per_acquisition, conversion_rate, is_active]
    );
    const channel = result.rows[0];
    await publish('channel.created', { tenantId: req.tenantId, channel });
    res.status(201).json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// POST /api/channels/capture-lead — generic omnichannel lead capture
router.post('/capture-lead', async (req, res) => {
  const { name, email, phone, channel_id, campaign_id, notes, metadata } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    let channelName = 'Direct Digital';
    let resolvedChannelId = channel_id;

    if (resolvedChannelId) {
      const chRes = await tenantQuery(req.tenantId, `SELECT id, name FROM channels WHERE id = $1`, [resolvedChannelId]);
      if (chRes.rows.length > 0) channelName = chRes.rows[0].name;
    } else {
      const chDefault = await tenantQuery(req.tenantId, `SELECT id, name FROM channels WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
      if (chDefault.rows.length > 0) {
        resolvedChannelId = chDefault.rows[0].id;
        channelName = chDefault.rows[0].name;
      }
    }

    if (campaign_id) {
      await tenantQuery(req.tenantId, `UPDATE campaigns SET leads_generated = leads_generated + 1 WHERE id = $1`, [campaign_id]);
    }

    const lead = {
      name,
      email,
      phone,
      channel_id: resolvedChannelId,
      channel_name: channelName,
      campaign_id,
      notes,
      metadata,
      captured_at: new Date().toISOString()
    };

    await publish('lead.captured', { tenantId: req.tenantId, lead });
    console.log(`[CHAN-X] Captured omnichannel lead "${lead.name}" via "${channelName}"`);

    res.status(201).json({ status: 'captured', lead });
  } catch (err) {
    console.error('[CHAN-X] Error capturing lead:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// POST /api/channels/:id/leads — capture lead attached to a specific channel
router.post('/:id/leads', async (req, res) => {
  const { name, email, phone, campaign_id, notes, metadata } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const chRes = await tenantQuery(req.tenantId, `SELECT id, name FROM channels WHERE id = $1`, [req.params.id]);
    const channelName = chRes.rows.length > 0 ? chRes.rows[0].name : 'Digital Channel';

    if (campaign_id) {
      await tenantQuery(req.tenantId, `UPDATE campaigns SET leads_generated = leads_generated + 1 WHERE id = $1`, [campaign_id]);
    }

    const lead = {
      name,
      email,
      phone,
      channel_id: req.params.id,
      channel_name: channelName,
      campaign_id,
      notes,
      metadata,
      captured_at: new Date().toISOString()
    };

    await publish('lead.captured', { tenantId: req.tenantId, lead });
    console.log(`[CHAN-X] Captured lead "${lead.name}" on channel "${channelName}"`);

    res.status(201).json({ status: 'captured', lead });
  } catch (err) {
    console.error('[CHAN-X] Error capturing lead for channel:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// GET /api/channels
router.get('/', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM channels ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /api/channels/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM channels WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// PUT /api/channels/:id
router.put('/:id', async (req, res) => {
  const { name, channel_type, phase, cost_per_acquisition, conversion_rate, is_active } = req.body;
  try {
    const result = await tenantQuery(
      req.tenantId,
      `UPDATE channels
       SET name = COALESCE($2, name),
           channel_type = COALESCE($3, channel_type),
           phase = COALESCE($4, phase),
           cost_per_acquisition = COALESCE($5, cost_per_acquisition),
           conversion_rate = COALESCE($6, conversion_rate),
           is_active = COALESCE($7, is_active),
           updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, channel_type, phase, cost_per_acquisition, conversion_rate, is_active]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    const channel = result.rows[0];
    await publish('channel.updated', { tenantId: req.tenantId, channel });
    res.json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// DELETE /api/channels/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `DELETE FROM channels WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    await publish('channel.deleted', { tenantId: req.tenantId, id: req.params.id });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

module.exports = router;

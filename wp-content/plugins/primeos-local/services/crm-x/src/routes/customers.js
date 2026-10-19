const express = require('express');
const { tenantQuery } = require('../db');
const { publish } = require('../events');

const router = express.Router();

// POST /api/customers
router.post('/', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await tenantQuery(
      req.tenantId,
      `INSERT INTO customers (tenant_id, name, email, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name, email, phone]
    );
    const customer = result.rows[0];

    // Other blocks (SEG-X for segmentation, Marketing for onboarding flows)
    // react to this without CRM-X needing to know about them.
    await publish('customer.created', {
      tenantId: req.tenantId,
      customer: { ...customer, notes: req.body.notes || req.body.chief_complaint }
    });

    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM customers WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// GET /api/customers/:id/history — merges interactions + tickets, matching
// the API shape from the original architecture doc.
router.get('/:id/history', async (req, res) => {
  try {
    const interactions = await tenantQuery(
      req.tenantId,
      `SELECT id, channel, notes, occurred_at AS "when", 'interaction' AS type
       FROM interactions WHERE customer_id = $1`,
      [req.params.id]
    );
    const tickets = await tenantQuery(
      req.tenantId,
      `SELECT id, status, priority, created_at AS "when", 'ticket' AS type
       FROM tickets WHERE customer_id = $1`,
      [req.params.id]
    );
    const history = [...interactions.rows, ...tickets.rows].sort(
      (a, b) => new Date(b.when) - new Date(a.when)
    );
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/customers — list (paginated, sortable, searchable)
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 25, 200);
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search ? `%${req.query.search}%` : null;
  const order = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  try {
    const result = search
      ? await tenantQuery(
          req.tenantId,
          `SELECT * FROM customers WHERE (name ILIKE $1 OR email ILIKE $1) ORDER BY created_at ${order} LIMIT $2 OFFSET $3`,
          [search, limit, offset]
        )
      : await tenantQuery(
          req.tenantId,
          `SELECT * FROM customers ORDER BY created_at ${order} LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

// POST /api/customers/:id/nps — SOP-CRM-03: NPS & Case Review Collection
router.post('/:id/nps', async (req, res) => {
  const { score, feedback } = req.body;
  const npsScore = parseInt(score, 10);
  if (isNaN(npsScore) || npsScore < 0 || npsScore > 10) {
    return res.status(400).json({ error: 'Valid score (0-10) is required' });
  }

  try {
    const customerResult = await tenantQuery(
      req.tenantId,
      `SELECT * FROM customers WHERE id = $1`,
      [req.params.id]
    );
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = customerResult.rows[0];

    // Log NPS interaction
    const npsNotes = `NPS Score: ${npsScore}/10. Comentário: "${feedback || 'Sem comentários'}"`;
    await tenantQuery(
      req.tenantId,
      `INSERT INTO interactions (tenant_id, customer_id, channel, notes)
       VALUES ($1, $2, $3, $4)`,
      [req.tenantId, customer.id, 'NPS Survey', npsNotes]
    );

    let urgentTicket = null;
    let loyaltyAccrued = null;

    if (npsScore <= 6) {
      // SOP-CRM-03: Detractor (Score <= 6) -> Immediate escalation to Clinical Director
      const ticketResult = await tenantQuery(
        req.tenantId,
        `INSERT INTO tickets (tenant_id, customer_id, priority, status)
         VALUES ($1, $2, 'urgent', 'open') RETURNING *`,
        [req.tenantId, customer.id]
      );
      urgentTicket = ticketResult.rows[0];

      // Publish urgent ticket event to mesh (triggers ACT-X urgent task within 4h SLA)
      await publish('ticket.created', { tenantId: req.tenantId, ticket: urgentTicket });
      await publish('crm.ticket.escalated', {
        tenantId: req.tenantId,
        customerId: customer.id,
        score: npsScore,
        feedback,
        ticket: urgentTicket
      });
      console.log(`[CRM-X] SOP-CRM-03 Escalation: Urgent ticket #${urgentTicket.id} created for detractor score ${npsScore}`);
    } else if (npsScore >= 9) {
      // SOP-CRM-03: Promoter (Score >= 9) -> Prompt for Google Review / Case study consent & loyalty points
      const points = 100;
      const loyaltyResult = await tenantQuery(
        req.tenantId,
        `INSERT INTO loyalty_points (tenant_id, customer_id, points, reason)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.tenantId, customer.id, points, 'Bônus NPS Promotor (Score >= 9)']
      );
      loyaltyAccrued = loyaltyResult.rows[0];

      await publish('crm.nps.promoter', {
        tenantId: req.tenantId,
        customerId: customer.id,
        score: npsScore,
        feedback,
        reviewPrompt: true
      });
      console.log(`[CRM-X] SOP-CRM-03 Promoter: Customer #${customer.id} awarded 100 loyalty points and invited to case review`);
    }

    await publish('crm.nps.recorded', {
      tenantId: req.tenantId,
      customerId: customer.id,
      score: npsScore,
      feedback,
      category: npsScore >= 9 ? 'promoter' : npsScore >= 7 ? 'passive' : 'detractor'
    });

    res.status(201).json({
      success: true,
      customerId: customer.id,
      score: npsScore,
      category: npsScore >= 9 ? 'promoter' : npsScore >= 7 ? 'passive' : 'detractor',
      ticket: urgentTicket,
      loyalty: loyaltyAccrued
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record NPS response' });
  }
});

// GET /api/customers/:id/loyalty — fetch loyalty points history and balance
router.get('/:id/loyalty', async (req, res) => {
  try {
    const result = await tenantQuery(
      req.tenantId,
      `SELECT * FROM loyalty_points WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    const totalPoints = result.rows.reduce((sum, row) => sum + (parseInt(row.points, 10) || 0), 0);
    res.json({
      totalPoints,
      history: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch loyalty points' });
  }
});

module.exports = router;

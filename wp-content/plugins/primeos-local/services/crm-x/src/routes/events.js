const express = require('express');
const { getConnection } = require('../events');
const { StringCodec } = require('nats');

const router = express.Router();
const sc = StringCodec();

// GET /api/events/stream — Server-Sent Events (SSE) realtime event mesh stream
router.get('/stream', async (req, res) => {
  const tenantId = req.tenantId;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent proxy buffering
  if (res.flushHeaders) res.flushHeaders();

  // Send initial handshake
  res.write(`: connected\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', tenantId })}\n\n`);

  let sub = null;
  let heartbeatTimer = null;

  try {
    const conn = await getConnection();
    // Subscribe to all subjects on NATS
    sub = conn.subscribe('>');

    console.log(`[CRM-X SSE] Client connected for tenant ${tenantId}`);

    // Heartbeat every 20 seconds to keep connection alive through proxies
    heartbeatTimer = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 20000);

    // Process incoming NATS events in background
    (async () => {
      try {
        for await (const msg of sub) {
          try {
            const data = JSON.parse(sc.decode(msg.data));
            // Filter strictly by active tenant for multi-tenant isolation
            if (data && data.tenantId === tenantId) {
              res.write(`event: ${msg.subject}\n`);
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
          } catch (parseErr) {
            // Ignore non-JSON or malformed messages
          }
        }
      } catch (subErr) {
        // Subscription closed or aborted
      }
    })();

  } catch (err) {
    console.error('[CRM-X SSE] Failed to establish NATS subscription for SSE:', err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  // Cleanup on client disconnect
  req.on('close', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (sub) {
      try {
        sub.unsubscribe();
      } catch {}
    }
    console.log(`[CRM-X SSE] Client disconnected for tenant ${tenantId}`);
  });
});

module.exports = router;

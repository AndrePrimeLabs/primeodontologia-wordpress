const { connect, StringCodec } = require('nats');

const sc = StringCodec();
let nc;

async function getConnection() {
  if (!nc) {
    nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    console.log('[NATS] Connected to NATS at', process.env.NATS_URL || 'nats://localhost:4222');
  }
  return nc;
}

async function publish(subject, payload) {
  try {
    const conn = await getConnection();
    conn.publish(subject, sc.encode(JSON.stringify(payload)));
  } catch (err) {
    console.error(`[NATS] Failed to publish ${subject}:`, err.message);
  }
}

async function subscribe(subject, handler) {
  try {
    const conn = await getConnection();
    const sub = conn.subscribe(subject);
    console.log(`[NATS] Subscribed to subject: ${subject}`);
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          await handler(data);
        } catch (handlerErr) {
          console.error(`[NATS] Error handling event on ${subject}:`, handlerErr.message);
        }
      }
    })();
    return sub;
  } catch (err) {
    console.error(`[NATS] Failed to subscribe to ${subject}:`, err.message);
  }
}

module.exports = { publish, subscribe, getConnection };

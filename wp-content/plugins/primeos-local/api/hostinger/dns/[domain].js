import { allowMethods, handle, hostingerFetch, requireApiKey } from '../../_lib/hostinger.js';

const VALID_RECORD_TYPES = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS', 'CAA']);
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;
  if (!requireApiKey(req, res)) return;

  const { domain } = req.query;
  if (!domain || typeof domain !== 'string' || !DOMAIN_REGEX.test(domain)) {
    res.status(400).json({ error: 'Invalid or missing :domain path parameter' });
    return;
  }

  if (req.method === 'GET') {
    await handle(res, () => hostingerFetch(`/api/dns/v1/zones/${encodeURIComponent(domain)}`));
    return;
  }

  // PUT: replace zone records. Body shape: { zone: [{ name, type, ttl, records: [{ content }] }, ...], overwrite?: boolean }
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body || !Array.isArray(body.zone)) {
    res.status(400).json({ error: 'Body must be { zone: [...], overwrite?: boolean }' });
    return;
  }

  // Validate zone record entries
  for (const record of body.zone) {
    if (!record || typeof record !== 'object') {
      res.status(400).json({ error: 'Each zone item must be a valid DNS record object' });
      return;
    }
    const type = typeof record.type === 'string' ? record.type.toUpperCase() : '';
    if (!VALID_RECORD_TYPES.has(type)) {
      res.status(400).json({ error: `Invalid DNS record type: ${record.type}. Allowed: ${Array.from(VALID_RECORD_TYPES).join(', ')}` });
      return;
    }
    if (!record.name || typeof record.name !== 'string') {
      res.status(400).json({ error: 'Each DNS record must have a string name' });
      return;
    }
  }

  await handle(res, () =>
    hostingerFetch(`/api/dns/v1/zones/${encodeURIComponent(domain)}`, {
      method: 'PUT',
      body,
    }),
  );
}

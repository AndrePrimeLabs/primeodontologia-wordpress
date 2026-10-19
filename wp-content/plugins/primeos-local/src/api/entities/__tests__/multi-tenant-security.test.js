import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import http from 'http';
import { apiHttpClient } from '../primeosClient.js';
import { isGatewayReachable, sleep } from './testHelpers.js';

describe('PrimeOS Multi-Tenant Security & Row-Level Security (RLS) Audit', () => {
  const TENANT_A = '00000000-0000-4000-a000-000000000001';
  const TENANT_B = '00000000-0000-4000-a000-000000000002';
  let gatewayLive = false;

  beforeAll(async () => {
    gatewayLive = await isGatewayReachable();
    if (!gatewayLive) {
      console.warn('⚠️  BMC Gateway (port 5001) is offline. Skipping live multi-tenant integration tests.');
    }
  });

  beforeEach((ctx) => {
    if (!gatewayLive) {
      ctx.skip();
    }
  });

  it('Enforces Tenant Context Validation: rejects missing or malformed tenant headers', async () => {
    // 1. Missing header
    try {
      await apiHttpClient.get('/customers', { headers: { 'X-Tenant-Id': '' } });
      expect.fail('Should have failed with 401');
    } catch (err) {
      expect(err.response?.status).toBe(401);
      expect(err.response?.data?.error).toContain('Missing X-Tenant-Id');
    }

    // 2. Malformed non-UUID tenant header
    try {
      await apiHttpClient.get('/customers', { headers: { 'X-Tenant-Id': 'invalid-tenant-123' } });
      expect.fail('Should have failed with 400');
    } catch (err) {
      expect(err.response?.status).toBe(400);
      expect(err.response?.data?.error).toContain('Invalid X-Tenant-Id format');
    }
  });

  it('Isolates Customer & Ticket Records: Tenant B cannot read or access Tenant A entities', async () => {
    // 1. Create customer in Tenant A
    const custResA = await apiHttpClient.post('/customers', {
      name: `Confidential Patient A ${Date.now()}`,
      email: `confidential-a-${Date.now()}@tenant-a.com`
    }, {
      headers: { 'X-Tenant-Id': TENANT_A }
    });
    expect(custResA.status).toBe(201);
    const customerA = custResA.data;

    // 2. Create ticket in Tenant A
    const ticketResA = await apiHttpClient.post('/tickets', {
      customer_id: customerA.id,
      priority: 'high'
    }, {
      headers: { 'X-Tenant-Id': TENANT_A }
    });
    expect(ticketResA.status).toBe(201);
    const ticketA = ticketResA.data;

    // 3. Tenant B queries customers list — must NOT contain Customer A
    const listResB = await apiHttpClient.get('/customers', {
      headers: { 'X-Tenant-Id': TENANT_B }
    });
    expect(listResB.status).toBe(200);
    const leakedCustomer = listResB.data.find((c) => c.id === customerA.id);
    expect(leakedCustomer).toBeUndefined();

    // 4. Tenant B attempts direct access by ID (/customers/:id) — must return 404
    try {
      await apiHttpClient.get(`/customers/${customerA.id}`, {
        headers: { 'X-Tenant-Id': TENANT_B }
      });
      expect.fail('Tenant B should receive 404 for Tenant A customer');
    } catch (err) {
      expect(err.response?.status).toBe(404);
    }

    // 5. Tenant B attempts direct access to customer history — must return empty or 404
    const historyResB = await apiHttpClient.get(`/customers/${customerA.id}/history`, {
      headers: { 'X-Tenant-Id': TENANT_B }
    });
    expect(historyResB.status).toBe(200);
    expect(historyResB.data).toHaveLength(0);

    // 6. Tenant B attempts mutation on Tenant A ticket — must return 404
    try {
      await apiHttpClient.patch(`/tickets/${ticketA.id}/resolve`, {}, {
        headers: { 'X-Tenant-Id': TENANT_B }
      });
      expect.fail('Tenant B should not be able to resolve Tenant A ticket');
    } catch (err) {
      expect(err.response?.status).toBe(404);
    }
  });

  it('Isolates Financial Transactions & Partner Lab Orders: strict cross-tenant barrier', async () => {
    // 1. Create a customer in Tenant A
    const custResA = await apiHttpClient.post('/customers', {
      name: `Fin Patient A ${Date.now()}`,
      email: `fin-a-${Date.now()}@tenant-a.com`
    }, {
      headers: { 'X-Tenant-Id': TENANT_A }
    });
    const customerA = custResA.data;

    // 2. Record transaction in Tenant A
    const txResA = await apiHttpClient.post('/transactions', {
      customer_id: customerA.id,
      amount: 12000,
      currency: 'BRL',
      payment_method: 'pix',
      status: 'paid'
    }, {
      headers: { 'X-Tenant-Id': TENANT_A }
    });
    expect(txResA.status).toBe(201);
    const txA = txResA.data;

    // 3. Tenant B queries transactions list — must NOT contain Transaction A
    const txListB = await apiHttpClient.get('/transactions', {
      headers: { 'X-Tenant-Id': TENANT_B }
    });
    expect(txListB.status).toBe(200);
    const leakedTx = txListB.data.find((t) => t.id === txA.id);
    expect(leakedTx).toBeUndefined();

    // 4. Tenant B attempts direct access to transaction by ID — must return 404
    try {
      await apiHttpClient.get(`/transactions/${txA.id}`, {
        headers: { 'X-Tenant-Id': TENANT_B }
      });
      expect.fail('Tenant B should receive 404 for Tenant A transaction');
    } catch (err) {
      expect(err.response?.status).toBe(404);
    }

    // 5. Tenant B queries partner orders — must NOT see Tenant A lab orders
    const ordersListB = await apiHttpClient.get('/partners/orders', {
      headers: { 'X-Tenant-Id': TENANT_B }
    });
    expect(ordersListB.status).toBe(200);
    const leakedOrder = ordersListB.data.find((o) => o.transaction_id === txA.id);
    expect(leakedOrder).toBeUndefined();
  });

  it('Isolates Realtime Event Streaming: Tenant B does NOT receive Tenant A SSE events', async () => {
    const tenantBEvents = [];
    let sseReq;

    // 1. Tenant B opens live SSE stream
    const sseConnectPromise = new Promise((resolve, reject) => {
      sseReq = http.get(`http://localhost:5001/api/events/stream?tenantId=${TENANT_B}`, (res) => {
        expect(res.statusCode).toBe(200);
        res.on('data', (chunk) => {
          const text = chunk.toString();
          tenantBEvents.push(text);
          if (text.includes('event: connected')) {
            resolve();
          }
        });
      });
      sseReq.on('error', reject);
    });

    await sseConnectPromise;

    // 2. Trigger high-priority lead capture exclusively in Tenant A
    const secretLeadEmail = `tenant-a-secret-lead-${Date.now()}@tenant-a.com`;
    await apiHttpClient.post('/channels/capture-lead', {
      name: 'Tenant A VIP Lead',
      email: secretLeadEmail,
      phone: '+5511999991111',
      notes: 'Strictly confidential Tenant A lead'
    }, {
      headers: { 'X-Tenant-Id': TENANT_A }
    });

    // 3. Wait 1 second to ensure any errant broadcast would have arrived
    await sleep(1000);

    sseReq.destroy();

    // 4. Assert Tenant B stream contains only its own connection handshake and zero Tenant A data
    const allStreamOutput = tenantBEvents.join('\n');
    expect(allStreamOutput).toContain(`"tenantId":"${TENANT_B}"`);
    expect(allStreamOutput).not.toContain(secretLeadEmail);
    expect(allStreamOutput).not.toContain('Tenant A VIP Lead');
    expect(allStreamOutput).not.toContain(TENANT_A);
  });
});

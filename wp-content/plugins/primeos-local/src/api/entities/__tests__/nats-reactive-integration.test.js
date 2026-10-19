import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import http from 'http';
import { apiHttpClient } from '../primeosClient.js';
import { isGatewayReachable, waitFor, sleep } from './testHelpers.js';

describe('BMC Reactive Event Mesh -> Cross-Service NATS Subscriptions', () => {
  const TENANT_ID = '00000000-0000-4000-a000-000000000001';
  let gatewayLive = false;

  beforeAll(async () => {
    gatewayLive = await isGatewayReachable();
    if (!gatewayLive) {
      console.warn('⚠️  BMC Gateway (port 5001) is offline. Skipping live NATS reactive mesh integration tests.');
    }
  });

  beforeEach((ctx) => {
    if (!gatewayLive) {
      ctx.skip();
    }
  });

  it('Flow 1 (CRM-X -> SEG-X): Creating a customer triggers asynchronous segmentation', async () => {
    // 1. Create a customer in CRM-X without segment_id
    const customerPayload = {
      name: `Vitest Mesh Test Customer ${Date.now()}`,
      email: `mesh-${Date.now()}@primeos.io`,
      phone: '+5511998877665'
    };

    const createRes = await apiHttpClient.post('/customers', customerPayload, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(createRes.status).toBe(201);
    const createdCustomer = createRes.data;
    expect(createdCustomer.id).toBeDefined();
    expect(createdCustomer.segment_id).toBeNull();

    // 2. Poll for SEG-X auto-assigned segment via NATS customer.created event
    await waitFor(async () => {
      const fetchRes = await apiHttpClient.get(`/customers/${createdCustomer.id}`, {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.data.segment_id).toBeDefined();
      expect(fetchRes.data.segment_id).not.toBeNull();
    }, { timeout: 3500 });
  });

  it('Flow 2 (CRM-X -> ACT-X): Creating an urgent ticket triggers clinical activity creation', async () => {
    // 1. Create customer first to attach ticket to
    const custRes = await apiHttpClient.post('/customers', {
      name: `Vitest Ticket Patient ${Date.now()}`,
      email: `patient-${Date.now()}@primeos.io`
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const customer = custRes.data;

    // 2. Create urgent ticket in CRM-X
    const ticketRes = await apiHttpClient.post('/tickets', {
      customer_id: customer.id,
      priority: 'urgent'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(ticketRes.status).toBe(201);
    const ticket = ticketRes.data;
    expect(ticket.id).toBeDefined();

    // 3. Poll for ACT-X auto-generated clinical activity from NATS ticket.created
    await waitFor(async () => {
      const actRes = await apiHttpClient.get('/activities', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(actRes.status).toBe(200);
      const activities = actRes.data;
      const matchingActivity = activities.find(
        (a) => a.category === 'CLINICAL_SUPPORT' && a.name.includes(ticket.id.slice(0, 8))
      );
      expect(matchingActivity).toBeDefined();
      expect(matchingActivity.priority).toBe(1); // urgent maps to priority 1
      expect(matchingActivity.status).toBe('active');
    }, { timeout: 3500 });
  });

  it('Flow 3 (REV-X -> CRM-X & COST-X): Creating a transaction triggers customer interaction and gateway fee expense', async () => {
    // 1. Create customer for financial transaction
    const custRes = await apiHttpClient.post('/customers', {
      name: `Vitest Financial Client ${Date.now()}`,
      email: `client-${Date.now()}@primeos.io`
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const customer = custRes.data;

    // 2. Record PIX transaction of R$ 10,000.00 in REV-X
    const txRes = await apiHttpClient.post('/transactions', {
      customer_id: customer.id,
      amount: 10000,
      currency: 'BRL',
      payment_method: 'pix',
      status: 'paid'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(txRes.status).toBe(201);
    const tx = txRes.data;
    expect(tx.id).toBeDefined();

    // 3. Poll CRM-X customer history for recorded interaction
    await waitFor(async () => {
      const historyRes = await apiHttpClient.get(`/customers/${customer.id}/history`, {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(historyRes.status).toBe(200);
      const history = historyRes.data;
      const financialInteraction = history.find(
        (h) => h.channel === 'REV-X Financial Gateway' && h.notes.includes('10000.00')
      );
      expect(financialInteraction).toBeDefined();
    }, { timeout: 3500 });

    // 4. Poll COST-X for 0.99% PIX fee expense (R$ 99.00) in CC-VAR-MKT
    await waitFor(async () => {
      const expensesRes = await apiHttpClient.get('/expenses', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(expensesRes.status).toBe(200);
      const expenses = expensesRes.data;
      const feeExpense = expenses.find(
        (e) => e.category_id === 'CC-VAR-MKT' && e.description.includes(tx.id.slice(0, 8))
      );
      expect(feeExpense).toBeDefined();
      expect(Number(feeExpense.amount)).toBe(99.00);
      expect(feeExpense.cost_type).toBe('VARIABLE');
    }, { timeout: 3500 });
  });

  it('Flow 4 (CHAN-X -> CRM-X -> SEG-X): Capturing a lead converts into customer, interaction, and auto-segmentation', async () => {
    const leadEmail = `lead-${Date.now()}@primeos.io`;
    const leadPhone = `+55119${Date.now().toString().slice(-8)}`;

    const leadPayload = {
      name: `Vitest Captured Lead ${Date.now()}`,
      email: leadEmail,
      phone: leadPhone,
      notes: 'Solicitou avaliação para prótese sobre implante e clareamento dental'
    };

    // 1. Capture lead via CHAN-X omnichannel endpoint
    const captureRes = await apiHttpClient.post('/channels/capture-lead', leadPayload, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(captureRes.status).toBe(201);
    expect(captureRes.data.status).toBe('captured');
    expect(captureRes.data.lead.name).toBe(leadPayload.name);

    // 2. Poll CRM-X and SEG-X cascade
    let convertedCust;
    await waitFor(async () => {
      const custsRes = await apiHttpClient.get('/customers', {
        headers: { 'X-Tenant-Id': TENANT_ID },
        params: { limit: 100 }
      });
      convertedCust = custsRes.data.find((c) => c.email === leadEmail);
      expect(convertedCust).toBeDefined();
      expect(convertedCust.name).toBe(leadPayload.name);
      expect(convertedCust.segment_id).toBeDefined();
      expect(convertedCust.segment_id).not.toBeNull();
    }, { timeout: 4000 });

    // 3. Verify interaction logged in customer history
    await waitFor(async () => {
      const historyRes = await apiHttpClient.get(`/customers/${convertedCust.id}/history`, {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(historyRes.status).toBe(200);
      const leadInteraction = historyRes.data.find(
        (h) => h.type === 'interaction' && h.notes.includes('Lead capturado')
      );
      expect(leadInteraction).toBeDefined();
    }, { timeout: 3500 });
  });

  it('Flow 5 (REV-X -> PART-X): Completed clinical transaction dispatches lab order to strategic partner', async () => {
    // 1. Create a customer for treatment
    const custRes = await apiHttpClient.post('/customers', {
      name: `Vitest Ortho Patient ${Date.now()}`,
      email: `ortho-patient-${Date.now()}@primeos.io`
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const customer = custRes.data;

    // 2. Record paid Invisalign comprehensive package of R$ 14,500.00 in REV-X
    const txRes = await apiHttpClient.post('/transactions', {
      customer_id: customer.id,
      amount: 14500,
      currency: 'BRL',
      payment_method: 'pix',
      status: 'paid'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(txRes.status).toBe(201);
    const tx = txRes.data;

    // 3. Poll PART-X for auto-created lab order
    await waitFor(async () => {
      const ordersRes = await apiHttpClient.get('/partners/orders', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(ordersRes.status).toBe(200);
      expect(Array.isArray(ordersRes.data)).toBe(true);

      const matchingOrder = ordersRes.data.find(
        (o) => o.transaction_id === tx.id || (o.notes && o.notes.includes(tx.id.slice(0, 8)))
      );
      expect(matchingOrder).toBeDefined();
      expect(matchingOrder.order_type).toBe('ALIGNER_FABRICATION');
      expect(matchingOrder.status).toBe('dispatched');
      expect(matchingOrder.partner_name).toContain('Align Technology');
    }, { timeout: 3500 });
  });

  it('Flow 6 (Gateway SSE Pipeline): Realtime event stream forwards NATS events to connected clients', async () => {
    const sseEvents = [];
    let sseReq;

    const ssePromise = new Promise((resolve, reject) => {
      sseReq = http.get(`http://localhost:5001/api/events/stream?tenantId=${TENANT_ID}`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');

        res.on('data', (chunk) => {
          const text = chunk.toString();
          sseEvents.push(text);
          if (text.includes('lead.captured')) {
            resolve();
          }
        });
      });
      sseReq.on('error', reject);
    });

    // Wait for SSE connection handshake
    await sleep(400);

    // Trigger an event on the mesh
    await apiHttpClient.post('/channels/capture-lead', {
      name: `SSE Test Lead ${Date.now()}`,
      email: `sse-flow6-${Date.now()}@primeos.io`,
      phone: '+5511955554444',
      notes: 'Testing realtime SSE mesh streaming in Flow 6'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    // Wait for event to arrive over SSE stream (timeout after 5s)
    await Promise.race([
      ssePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE stream timed out waiting for lead.captured')), 5000))
    ]);

    sseReq.destroy();

    const allOutput = sseEvents.join('\n');
    expect(allOutput).toContain('event: connected');
    expect(allOutput).toContain('event: lead.captured');
  });

  it('Flow 7 (Master 9-Block Operational Lifecycle): Full cascade across CHAN-X -> CRM-X -> SEG-X -> VALUE-X -> ACT-X -> REV-X -> PART-X -> RES-X -> COST-X', async () => {
    const timestamp = Date.now();
    const leadEmail = `vip-patient-${timestamp}@primeos.io`;
    const leadPhone = `+55119${timestamp.toString().slice(-8)}`;

    // BLOCK 1: CHAN-X — Omnichannel Lead Capture
    const captureRes = await apiHttpClient.post('/channels/capture-lead', {
      name: `VIP Patient Master Flow ${timestamp}`,
      email: leadEmail,
      phone: leadPhone,
      channel: 'whatsapp_vip',
      notes: 'Solicitou avaliação completa para reabilitação estética e alinhadores invisíveis'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    expect(captureRes.status).toBe(201);
    expect(captureRes.data.status).toBe('captured');

    // BLOCK 2 & 3: CRM-X & SEG-X Propagation
    let patient;
    await waitFor(async () => {
      const customersRes = await apiHttpClient.get('/customers', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      patient = customersRes.data.find((c) => c.email === leadEmail);
      expect(patient).toBeDefined();
      expect(patient.name).toContain('VIP Patient Master Flow');
      expect(patient.segment_id).toBeDefined();
      expect(patient.segment_id).not.toBeNull();
    }, { timeout: 4000 });

    // BLOCK 6: VALUE-X — Value Proposition Alignment
    const propsRes = await apiHttpClient.get('/propositions', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(propsRes.status).toBe(200);
    const matchedProp = propsRes.data.find((p) => p.segment_id === patient.segment_id);
    expect(matchedProp).toBeDefined();
    expect(matchedProp.name).toBeDefined();

    // BLOCK 5: ACT-X — Key Clinical Planning Activity
    const actRes = await apiHttpClient.post('/activities', {
      name: `Planejamento 3D ClinCheck VIP - Paciente #${patient.id.slice(0, 8)}`,
      category: 'planejamento_digital',
      status: 'active',
      priority: 1,
      frequency: 'once'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(actRes.status).toBe(201);
    expect(actRes.data.category).toBe('planejamento_digital');

    // BLOCK 4: REV-X — Monetization & High-Ticket Transaction
    const txAmount = 16000.00; // High-ticket Invisalign Comprehensive
    const txRes = await apiHttpClient.post('/transactions', {
      customer_id: patient.id,
      amount: txAmount,
      currency: 'BRL',
      payment_method: 'pix',
      status: 'paid'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(txRes.status).toBe(201);
    const tx = txRes.data;

    // BLOCK 7: PART-X — Strategic Partner Fulfillment (Align Technology)
    await waitFor(async () => {
      const ordersRes = await apiHttpClient.get('/partners/orders', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(ordersRes.status).toBe(200);
      const labOrder = ordersRes.data.find(
        (o) => o.transaction_id === tx.id || (o.notes && o.notes.includes(tx.id.slice(0, 8)))
      );
      expect(labOrder).toBeDefined();
      expect(labOrder.order_type).toBe('ALIGNER_FABRICATION');
      expect(labOrder.partner_name).toContain('Align Technology');
      expect(labOrder.status).toBe('dispatched');
    }, { timeout: 3500 });

    // BLOCK 8: RES-X — Key Equipment Resource Allocation
    const resourcesRes = await apiHttpClient.get('/resources', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(resourcesRes.status).toBe(200);
    const inUseResource = resourcesRes.data.find((r) => r.status === 'in_use');
    expect(inUseResource).toBeDefined();
    expect(inUseResource.resource_type).toBe('PHYSICAL');

    // BLOCK 9: COST-X — Variable Fee & Margin Reconcile
    await waitFor(async () => {
      const expensesRes = await apiHttpClient.get('/expenses', {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(expensesRes.status).toBe(200);
      const feeExpense = expensesRes.data.find(
        (e) => e.category_id === 'CC-VAR-MKT' && e.description.includes(tx.id.slice(0, 8))
      );
      expect(feeExpense).toBeDefined();
      expect(Number(feeExpense.amount)).toBe(158.40);
      expect(feeExpense.cost_type).toBe('VARIABLE');
    }, { timeout: 3500 });

    // COMPLETE CRM-X LIFECYCLE AUDIT: Full History Traceability
    await waitFor(async () => {
      const historyRes = await apiHttpClient.get(`/customers/${patient.id}/history`, {
        headers: { 'X-Tenant-Id': TENANT_ID }
      });
      expect(historyRes.status).toBe(200);
      const history = historyRes.data;

      const leadHistory = history.find((h) => h.notes && h.notes.includes('Lead capturado'));
      expect(leadHistory).toBeDefined();

      const finHistory = history.find((h) => h.channel === 'REV-X Financial Gateway');
      expect(finHistory).toBeDefined();
    }, { timeout: 3500 });
  });

  it('Flow 8 (SOP-SEG-01 Intelligent Rule-Based Segmentation): Categorizes patients into DTM vs Ortho vs Rehabilitation based on chief complaint', async () => {
    const timestamp = Date.now();

    // 1. Lead with DTM / Bruxism pain complaint
    const dtmLead = await apiHttpClient.post('/channels/capture-lead', {
      name: `Patient DTM Pain ${timestamp}`,
      email: `dtm-${timestamp}@primeos.io`,
      phone: `+55119${timestamp.toString().slice(-8)}`,
      notes: 'Queixa de dores na face, estalo na ATM e bruxismo noturno severo'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(dtmLead.status).toBe(201);

    // 2. Lead with Porcelain Veneers / Rehabilitation complaint
    const rehabLead = await apiHttpClient.post('/channels/capture-lead', {
      name: `Patient Veneers Rehab ${timestamp}`,
      email: `rehab-${timestamp}@primeos.io`,
      phone: `+55118${timestamp.toString().slice(-8)}`,
      notes: 'Avaliação para lentes de contato dental em porcelana e facetas estéticas'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(rehabLead.status).toBe(201);

    // Allow NATS lead.captured -> CRM-X -> customer.created -> SEG-X to propagate
    await sleep(800);

    // 3. Fetch segments to map names to IDs
    const segsRes = await apiHttpClient.get('/segments', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const dtmSegment = segsRes.data.find(s => s.name.includes('DTM') || s.name.includes('Bruxism'));
    const rehabSegment = segsRes.data.find(s => s.name.includes('Rehabilitation') || s.name.includes('Porcelain'));
    expect(dtmSegment).toBeDefined();
    expect(rehabSegment).toBeDefined();

    // 4. Verify CRM-X customer records have exact segment matching
    const custsRes = await apiHttpClient.get('/customers', {
      params: { limit: 100, order: 'desc' },
      headers: { 'X-Tenant-Id': TENANT_ID }
    });

    const dtmCustomer = custsRes.data.find(c => c.email === `dtm-${timestamp}@primeos.io`);
    const rehabCustomer = custsRes.data.find(c => c.email === `rehab-${timestamp}@primeos.io`);

    expect(dtmCustomer).toBeDefined();
    expect(dtmCustomer.segment_id).toBe(dtmSegment.id);

    expect(rehabCustomer).toBeDefined();
    expect(rehabCustomer.segment_id).toBe(rehabSegment.id);
  });

  it('Flow 9 (SOP-CRM-01 Post-Procedure Clinical Check-In): Completed activity schedules D+1, D+7, D+30 follow-ups', async () => {
    const timestamp = Date.now();

    // 1. Create patient in CRM-X
    const custRes = await apiHttpClient.post('/customers', {
      name: `Post-Care Patient ${timestamp}`,
      email: `postcare-${timestamp}@primeos.io`,
      phone: '+551199998888'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(custRes.status).toBe(201);
    const patient = custRes.data;

    // 2. Create clinical activity in ACT-X attached to patient
    const actRes = await apiHttpClient.post('/activities', {
      name: `Instalação de Alinhadores Invisíveis Stage 1 - ${patient.name}`,
      category: 'CLINICAL_PROCEDURE',
      customer_id: patient.id,
      status: 'active',
      priority: 2
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(actRes.status).toBe(201);
    const activity = actRes.data;
    expect(activity.customer_id).toBe(patient.id);

    // 3. Complete the clinical activity in ACT-X
    const completeRes = await apiHttpClient.patch(`/activities/${activity.id}/complete`, {}, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.data.status).toBe('completed');

    // Allow NATS activity.completed -> CRM-X subscriber to run
    await sleep(700);

    // 4. Verify CRM-X created 3 follow-ups (D+1, D+7, D+30)
    const followUpsRes = await apiHttpClient.get('/follow-ups', {
      params: { customer_id: patient.id },
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(followUpsRes.status).toBe(200);
    const followUps = followUpsRes.data;
    expect(followUps.length).toBe(3);

    const d1 = followUps.find(f => f.type === 'SOP-CRM-01-D1');
    const d7 = followUps.find(f => f.type === 'SOP-CRM-01-D7');
    const d30 = followUps.find(f => f.type === 'SOP-CRM-01-D30');

    expect(d1).toBeDefined();
    expect(d1.status).toBe('pending');
    expect(d1.notes).toContain('D+1 WhatsApp');

    expect(d7).toBeDefined();
    expect(d7.status).toBe('pending');
    expect(d7.notes).toContain('D+7 Concierge');

    expect(d30).toBeDefined();
    expect(d30.status).toBe('pending');
    expect(d30.notes).toContain('D+30 Clínico');

    // 5. Verify interaction logged in patient history
    const historyRes = await apiHttpClient.get(`/customers/${patient.id}/history`, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(historyRes.status).toBe(200);
    const sopInteraction = historyRes.data.find(h => h.channel === 'SOP-CRM-01 Automation');
    expect(sopInteraction).toBeDefined();
  });

  it('Flow 10 (SOP-CRM-03 NPS Survey & Detractor Escalation): Detractor score triggers urgent clinical ticket in ACT-X, Promoter score awards loyalty points', async () => {
    const timestamp = Date.now();

    // 1. Create Detractor Patient
    const detractorRes = await apiHttpClient.post('/customers', {
      name: `Detractor Patient ${timestamp}`,
      email: `detractor-${timestamp}@primeos.io`
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const detractor = detractorRes.data;

    // 2. Submit Detractor NPS Score (4/10)
    const detractorNps = await apiHttpClient.post(`/customers/${detractor.id}/nps`, {
      score: 4,
      feedback: 'Alinhador machucou o bordo gengival e causou desconforto'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(detractorNps.status).toBe(201);
    expect(detractorNps.data.category).toBe('detractor');
    expect(detractorNps.data.ticket).toBeDefined();
    expect(detractorNps.data.ticket.priority).toBe('urgent');

    // Allow NATS ticket.created -> ACT-X subscriber to run
    await sleep(700);

    // Verify ACT-X auto-created an urgent activity for this ticket
    const activitiesRes = await apiHttpClient.get('/activities', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const escalatedActivity = activitiesRes.data.find(
      a => a.category === 'CLINICAL_SUPPORT' && a.customer_id === detractor.id
    );
    expect(escalatedActivity).toBeDefined();
    expect(escalatedActivity.priority).toBe(1); // Urgent priority

    // 3. Create Promoter Patient
    const promoterRes = await apiHttpClient.post('/customers', {
      name: `Promoter Patient ${timestamp}`,
      email: `promoter-${timestamp}@primeos.io`
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    const promoter = promoterRes.data;

    // 4. Submit Promoter NPS Score (10/10)
    const promoterNps = await apiHttpClient.post(`/customers/${promoter.id}/nps`, {
      score: 10,
      feedback: 'Resultado incrível! Muito satisfeita com o alinhamento em tempo recorde.'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(promoterNps.status).toBe(201);
    expect(promoterNps.data.category).toBe('promoter');
    expect(promoterNps.data.loyalty).toBeDefined();
    expect(promoterNps.data.loyalty.points).toBe(100);

    // 5. Verify Promoter Loyalty Points API
    const loyaltyRes = await apiHttpClient.get(`/customers/${promoter.id}/loyalty`, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(loyaltyRes.status).toBe(200);
    expect(loyaltyRes.data.totalPoints).toBe(100);
    expect(loyaltyRes.data.history.length).toBe(1);
  });

  it('Flow 11 (SOP-PART-01 Laboratory Delivery Tracking): Partner lab order transitions through manufacturing stages to delivery', async () => {
    // 1. Fetch existing lab orders from PART-X
    const ordersRes = await apiHttpClient.get('/partners/orders', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.data.length).toBeGreaterThan(0);
    const targetOrder = ordersRes.data[0];

    // 2. Advance order to in_fabrication
    const fabRes = await apiHttpClient.patch(`/partners/orders/${targetOrder.id}/status`, {
      status: 'in_fabrication',
      notes: 'Termoformagem de alinhadores em andamento no laboratório Align Tech'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(fabRes.status).toBe(200);
    expect(fabRes.data.status).toBe('in_fabrication');

    // 3. Advance order to quality_control
    const qcRes = await apiHttpClient.patch(`/partners/orders/${targetOrder.id}/status`, {
      status: 'quality_control',
      notes: 'Controle de qualidade dimensional e polimento a laser concluído'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(qcRes.status).toBe(200);
    expect(qcRes.data.status).toBe('quality_control');

    // 4. Advance order to delivered_to_clinic (emits lab.order.delivered)
    const deliverRes = await apiHttpClient.patch(`/partners/orders/${targetOrder.id}/status`, {
      status: 'delivered_to_clinic',
      notes: 'Entrega confirmada na recepção clínica Prime Labs - pronto para instalação'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.data.status).toBe('delivered_to_clinic');
  });

  it('Flow 12 (SOP-RES-01 & SOP-PART-02): Activity completion releases physical resource, depletes consumable inventory, and triggers supplier replenishment on low stock', async () => {
    // 1. Create a physical resource that is currently allocated (in_use)
    const physicalRes = await apiHttpClient.post('/resources', {
      name: `Scanner 3D PrimeScan #${Date.now().toString().slice(-4)}`,
      resource_type: 'PHYSICAL',
      status: 'in_use',
      quantity: 1
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(physicalRes.status).toBe(201);
    const physicalId = physicalRes.data.id;

    // 2. Create a consumable resource with quantity near the minimum threshold (6 with min 5)
    const consumableRes = await apiHttpClient.post('/resources', {
      name: `Resina 3D PriZma Bio Crown #${Date.now().toString().slice(-4)}`,
      resource_type: 'CONSUMABLE',
      status: 'available',
      quantity: 6,
      min_quantity: 5,
      unit_value: 450
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(consumableRes.status).toBe(201);
    const consumableId = consumableRes.data.id;

    // 3. Create and complete an activity in ACT-X
    const actRes = await apiHttpClient.post('/activities', {
      name: 'Confecção e Instalação de Prótese 3D',
      category: 'Clinical',
      priority: 'high',
      status: 'in_progress'
    }, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(actRes.status).toBe(201);

    // Complete the activity (publishes activity.completed)
    const completeRes = await apiHttpClient.patch(`/activities/${actRes.data.id}/complete`, {}, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.data.status).toBe('completed');

    // 4. Wait for NATS reactive chain (ACT-X -> RES-X -> PART-X)
    await sleep(800);

    // 5. Assert SOP-RES-01: Physical resource is released to 'available'
    const checkPhysical = await apiHttpClient.get(`/resources/${physicalId}`, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(checkPhysical.status).toBe(200);
    expect(checkPhysical.data.status).toBe('available');

    // 6. Assert SOP-RES-01: Consumable inventory is decremented by 1 (6 -> 5)
    const checkConsumable = await apiHttpClient.get(`/resources/${consumableId}`, {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(checkConsumable.status).toBe(200);
    expect(Number(checkConsumable.data.quantity)).toBe(5);

    // 7. Assert SOP-PART-02: Low stock threshold triggered automatic supplier replenishment order in PART-X
    const ordersRes = await apiHttpClient.get('/partners/orders', {
      headers: { 'X-Tenant-Id': TENANT_ID }
    });
    expect(ordersRes.status).toBe(200);
    const replenishmentOrder = ordersRes.data.find(o => 
      o.order_type === 'SUPPLIES_REPLENISHMENT' && 
      o.notes?.includes(consumableRes.data.name)
    );
    expect(replenishmentOrder).toBeDefined();
    expect(replenishmentOrder.status).toBe('dispatched');
  });
});


import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { primeos } from '../primeosClient.js';
import { isGatewayReachable } from './testHelpers.js';

describe('PrimeOS Entity Layer -> Traefik BMC Gateway Integration', () => {
  let gatewayLive = false;

  beforeAll(async () => {
    gatewayLive = await isGatewayReachable();
    if (!gatewayLive) {
      console.warn('⚠️  BMC Gateway (port 5001) is offline. Skipping live gateway integration tests.');
    }
  });

  beforeEach((ctx) => {
    if (!gatewayLive) {
      ctx.skip();
    }
  });
  it('should fetch customers from CRM-X through gateway', async () => {
    const customers = await primeos.entities.Customer.list();
    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeGreaterThanOrEqual(3);
    expect(customers[0].name).toBeDefined();
    expect(customers[0].id).toBeDefined();
  });

  it('should fetch products from REV-X through gateway and normalize price/status', async () => {
    const products = await primeos.entities.Product.list();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThanOrEqual(4);
    const invisalign = products.find(p => p.sku === 'PROD-ALN-COMP');
    expect(invisalign).toBeDefined();
    expect(invisalign.price).toBe(14500);
    expect(invisalign.status).toBe('active');
  });

  it('should fetch marketing channels from CHAN-X and normalize funnel phase', async () => {
    const channels = await primeos.entities.MarketingChannel.list();
    expect(Array.isArray(channels)).toBe(true);
    expect(channels.length).toBeGreaterThanOrEqual(4);
    const whatsapp = channels.find(c => c.name.includes('WhatsApp'));
    expect(whatsapp).toBeDefined();
    expect(whatsapp.status).toBe('ativo');
    expect(whatsapp.funcao_funil).toBeDefined();
  });

  it('should fetch customer segments from SEG-X through gateway', async () => {
    const segments = await primeos.entities.CustomerSegment.list();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThanOrEqual(4);
    const ortho = segments.find(s => s.name.includes('Aesthetic Orthodontics'));
    expect(ortho).toBeDefined();
    expect(ortho.ativo).toBe(true);
  });

  it('should fetch partners, resources, and SOPs from respective microservices', async () => {
    const partners = await primeos.entities.KeyPartner.list();
    expect(partners.length).toBeGreaterThanOrEqual(3);

    const resources = await primeos.entities.KeyResource.list();
    expect(resources.length).toBeGreaterThanOrEqual(3);

    const sops = await primeos.entities.Sop.list();
    expect(sops.length).toBeGreaterThanOrEqual(2);
  });
});

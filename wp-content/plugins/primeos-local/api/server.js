// ============================================================================
// PrimeOS/OmniOS Multi-Tenant Express API Server
// ============================================================================
// Supports both PrimeOS and OmniOS with separate Supabase projects
// Domain-based routing and tenant context
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';

// Load environment files
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.omnios' });

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// TENANT CONFIGURATION
// ============================================================================

const TENANTS = {
  PRIMEOS: {
    id: 'primeos',
    tenantId: process.env.PRIMEOS_TENANT_ID || '00000000-0000-4000-a000-000000000001',
    name: 'PrimeOS',
    domain: 'primeos.primeodontologia.com.br',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.VITE_SUPABASE_ANON_KEY,
    port: 5001,
  },
  OMNIOS: {
    id: 'omnios',
    tenantId: process.env.OMNIOS_TENANT_ID || '00000000-0000-4000-b000-000000000002',
    name: 'OmniOS',
    domain: 'omnios.primeodontologia.com.br',
    supabaseUrl: process.env.OMNIOS_SUPABASE_URL,
    supabaseKey: process.env.OMNIOS_SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.OMNIOS_SUPABASE_ANON_KEY,
    port: 5002,
  },
};

// Create Supabase clients for each tenant
const supabaseClients = {};
Object.values(TENANTS).forEach(tenant => {
  if (tenant.supabaseUrl && tenant.supabaseKey) {
    supabaseClients[tenant.id] = createClient(tenant.supabaseUrl, tenant.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log(`✅ Supabase client initialized for ${tenant.name}`);
  }
});

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});
app.use(limiter);

// CORS with multi-domain support
const allowedOrigins = [
  'https://primeos.primeodontologia.com.br',
  'https://omnios.primeodontologia.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,
}));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.path === '/health',
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// TENANT DETECTION MIDDLEWARE
// ============================================================================

app.use((req, res, next) => {
  // Detect tenant from hostname or X-Tenant-ID header
  const host = req.hostname;
  const headerTenant = req.headers['x-tenant-id'];

  let tenant = null;

  // Try to match by domain
  if (host.includes('omnios')) {
    tenant = { ...TENANTS.OMNIOS };
  } else if (host.includes('primeos') || host.includes('primeodontologia')) {
    tenant = { ...TENANTS.PRIMEOS };
  }

  // Fall back to header
  if (!tenant && headerTenant) {
    const found = Object.values(TENANTS).find(t => t.id === headerTenant || t.tenantId === headerTenant);
    if (found) {
      tenant = { ...found };
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(headerTenant)) {
      tenant = { ...TENANTS.PRIMEOS, tenantId: headerTenant };
    } else {
      return res.status(400).json({ error: 'Invalid X-Tenant-Id format: must be a valid UUID' });
    }
  }

  // Default to PrimeOS
  if (!tenant) {
    tenant = { ...TENANTS.PRIMEOS };
  }

  req.tenant = tenant;
  req.supabase = supabaseClients[tenant.id] || supabaseClients[TENANTS.PRIMEOS.id];

  console.log(`🏢 Tenant: ${tenant.name} [${tenant.tenantId}] (${req.method} ${req.path})`);
  next();
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    tenant: req.tenant.name,
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    name: req.tenant.name,
    version: '1.0.0',
    status: 'healthy',
    domain: req.tenant.domain,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/tenant-info', (req, res) => {
  res.json({
    tenantId: req.tenant.id,
    tenantName: req.tenant.name,
    domain: req.tenant.domain,
    features: ['api', 'database', 'auth'],
    status: 'active',
  });
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await req.supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }

    req.user = user;

    // Strict tenant claim check: prevent cross-tenant access with valid tokens from another tenant
    const userTenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    if (
      userTenantId &&
      req.tenant?.tenantId &&
      userTenantId !== req.tenant.tenantId &&
      user.role !== 'service_role' &&
      user.app_metadata?.role !== 'superadmin'
    ) {
      return res.status(403).json({ error: 'Forbidden', message: 'User is not authorized for this tenant' });
    }

    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    res.status(401).json({ error: 'Unauthorized', message: 'Token verification failed' });
  }
};

// ============================================================================
// PROTECTED ROUTES - CRUD OPERATIONS
// ============================================================================

app.use('/api/entities', authenticateToken);

const createCRUDRoutes = (router, tableName) => {
  // GET all
  router.get(`/${tableName}`, async (req, res) => {
    try {
      let query = req.supabase
        .from(tableName)
        .select('*');

      if (req.tenant && req.tenant.tenantId) {
        query = query.eq('tenant_id', req.tenant.tenantId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      res.json({
        data: data || [],
        tenant: req.tenant.name,
        table: tableName,
      });
    } catch (err) {
      console.error(`❌ GET ${tableName}:`, err.message);
      res.status(500).json({ error: 'Database query failed' });
    }
  });

  // GET single
  router.get(`/${tableName}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      let query = req.supabase
        .from(tableName)
        .select('*')
        .eq('id', id);

      if (req.tenant && req.tenant.tenantId) {
        query = query.eq('tenant_id', req.tenant.tenantId);
      }

      const { data, error } = await query.single();

      if (error || !data) throw error || new Error('Not found');
      res.json(data);
    } catch (err) {
      console.error(`❌ GET ${tableName}/:id:`, err.message);
      res.status(404).json({ error: 'Record not found' });
    }
  });

  // POST create
  router.post(`/${tableName}`, async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
      }

      const payload = {
        ...req.body,
        tenant_id: req.tenant.tenantId,
      };

      const { data, error } = await req.supabase
        .from(tableName)
        .insert([payload])
        .select();

      if (error) throw error;
      res.status(201).json({
        ...data[0],
        _tenant: req.tenant.name,
      });
    } catch (err) {
      console.error(`❌ POST ${tableName}:`, err.message);
      res.status(400).json({ error: 'Failed to create record' });
    }
  });

  // PUT update
  router.put(`/${tableName}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      const { tenant_id, id: bodyId, ...updatePayload } = req.body;

      let query = req.supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', id);

      if (req.tenant && req.tenant.tenantId) {
        query = query.eq('tenant_id', req.tenant.tenantId);
      }

      const { data, error } = await query.select();

      if (error || !data.length) throw error || new Error('Record not found');
      res.json(data[0]);
    } catch (err) {
      console.error(`❌ PUT ${tableName}/:id:`, err.message);
      res.status(400).json({ error: 'Failed to update record' });
    }
  });

  // DELETE
  router.delete(`/${tableName}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      let query = req.supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (req.tenant && req.tenant.tenantId) {
        query = query.eq('tenant_id', req.tenant.tenantId);
      }

      const { error } = await query;

      if (error) throw error;
      res.json({ message: 'Record deleted', id, tenant: req.tenant.name });
    } catch (err) {
      console.error(`❌ DELETE ${tableName}/:id:`, err.message);
      res.status(400).json({ error: 'Failed to delete record' });
    }
  });
};

const apiRouter = express.Router();
const entities = [
  'customers',
  'patients',
  'patient_records',
  'appointments',
  'products',
  'sales',
  'leads',
  'tasks',
  'documents',
  'activities',
  'expenses',
  'user_engagement',
  'pop'
];

entities.forEach(entity => {
  createCRUDRoutes(apiRouter, entity);
});

app.use('/api/entities', apiRouter);

// ============================================================================
// STATS ENDPOINT (Protected)
// ============================================================================

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.tenant.tenantId;
    const [customers, patients, sales, appointments] = await Promise.all([
      req.supabase.from('customers').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
      req.supabase.from('patients').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
      req.supabase.from('sales').select('total_amount').eq('tenant_id', tenantId),
      req.supabase.from('appointments').select('id', { count: 'exact' }).eq('tenant_id', tenantId)
    ]);

    const totalSales = sales.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

    res.json({
      tenant: req.tenant.name,
      tenantId,
      customers: customers.count || 0,
      patients: patients.count || 0,
      totalSales,
      appointments: appointments.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
    tenant: req.tenant.name,
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);

  const message = NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message,
    tenant: req.tenant ? req.tenant.name : 'unknown',
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Multi-Tenant API Server`);
  console.log(`════════════════════════════════════════════`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🛡️  Security: Helmet, CORS, Rate Limiting, JWT Auth`);
  console.log(`🏢 Tenants Configured:`);
  Object.values(TENANTS).forEach(tenant => {
    if (supabaseClients[tenant.id]) {
      console.log(`   ✅ ${tenant.name} (${tenant.domain})`);
    }
  });
  console.log(`📊 Endpoints: /health, /api/status, /api/tenant-info, /api/entities/*`);
  console.log(`🔐 Environment: ${NODE_ENV}`);
  console.log(`════════════════════════════════════════════\n`);
});

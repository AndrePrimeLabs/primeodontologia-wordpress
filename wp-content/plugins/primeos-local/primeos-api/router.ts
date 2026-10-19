// src/api/router.ts
import mongoose from 'mongoose';
import crypto from 'node:crypto';

const { Schema, model, models } = mongoose;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/primeos_odontologia";
let databaseConnection: Promise<typeof mongoose> | undefined;

async function ensureDatabaseConnection() {
  if (mongoose.connection.readyState === 1) return mongoose;
  databaseConnection ??= mongoose.connect(MONGO_URI);
  return databaseConnection;
}

// Reuse or compile your model schema structures
const AppointmentSchema = new Schema({
  patient_name: { type: String, required: true },
  service_type: { type: String, required: true },
  date: { type: String, required: true },
  status: { type: String, default: "active" }
}, { timestamps: true });

const Appointment: mongoose.Model<any> = models.Appointment || model('Appointment', AppointmentSchema);
const AgentResultSchema = new Schema({
  payload: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });
const AgentResult: mongoose.Model<any> = models.AgentResult || model('AgentResult', AgentResultSchema);

// Helper to read your primeos.json configuration safely
function getPrimeOSConfig() {
  return {
    apiKey: process.env.PRIMEOS_API_KEY || ''
  };
}

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ||
    'https://primeos.primeodontologia.com.br,https://omnios.primeodontologia.com.br,http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Strips MongoDB operators ($where, $regex, etc.) to prevent NoSQL injection.
 */
function sanitizeMongoQuery(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    // Prohibit keys starting with $ or containing dots
    if (key.startsWith('$') || key.includes('.')) continue;
    // Allow scalar primitive types only
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
}

function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get('origin');
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, api_key, x-primeos-key",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function createJsonResponse(data: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(request),
    },
  });
}

export async function handleAgentSubmit(request: Request): Promise<Response> {
  const config = getPrimeOSConfig();
  const apiKey = request.headers.get('x-primeos-key');
  if (!safeCompare(apiKey, config.apiKey)) {
    return createJsonResponse({ error: 'Unauthorized: Invalid or missing x-primeos-key' }, 401, request);
  }

  if (request.method !== 'POST') {
    return createJsonResponse({ error: 'Method not allowed' }, 405, request);
  }

  try {
    const payload = await request.json();
    await ensureDatabaseConnection();
    const result = await AgentResult.create({ payload });
    return createJsonResponse({ success: true, id: result.id }, 200, request);
  } catch (error: any) {
    return createJsonResponse({ error: error.message }, 400, request);
  }
}

export async function handlePrimeOSApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  
  // CORS Preflight Handling
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  // Enforce isolation to your OpenAPI spec endpoints
  if (!url.pathname.startsWith("/api/entities/")) {
    return null; 
  }

  // Authenticate using timing-safe comparison
  const config = getPrimeOSConfig();
  const apiKey = request.headers.get("api_key");
  if (!safeCompare(apiKey, config.apiKey)) {
    return createJsonResponse({ error: "Unauthorized: Invalid or missing api_key" }, 401, request);
  }

  await ensureDatabaseConnection();

  const method = request.method;
  const pathName = url.pathname;

  try {
    // Endpoint: /api/entities/Appointment
    if (pathName === "/api/entities/Appointment") {
      
      if (method === "GET") {
        const qParam = url.searchParams.get("q") || "{}";
        let parsedRaw = {};
        try {
          parsedRaw = JSON.parse(qParam);
        } catch {
          return createJsonResponse({ error: "Invalid JSON in q parameter" }, 400, request);
        }
        const queryFilter = sanitizeMongoQuery(parsedRaw);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 250);
        const skip = parseInt(url.searchParams.get("skip") || "0");
        const sortBy = url.searchParams.get("sort_by") || "-createdAt";

        // Querying data with custom pagination limits and sanitized filter sets
        const records = await Appointment.find(queryFilter)
          .sort(sortBy)
          .skip(skip)
          .limit(limit);

        return createJsonResponse(records, 200, request);
      }

      if (method === "POST") {
        const body = await request.json();
        
        // Strict attribute verification before saving
        if (!body.patient_name || !body.service_type || !body.date) {
          return createJsonResponse({ error: "Missing required fields" }, 400, request);
        }
        
        const newRecord = new Appointment(body);
        await newRecord.save();
        return createJsonResponse(newRecord, 201, request);
      }

      if (method === "DELETE") {
        const rawFilter = await request.json();
        const queryFilter = sanitizeMongoQuery(rawFilter);
        
        if (!queryFilter || Object.keys(queryFilter).length === 0) {
          return createJsonResponse(
            { error: "Refusing delete: a valid non-empty filter is required." },
            400,
            request
          );
        }
        
        const result = await Appointment.deleteMany(queryFilter);
        return createJsonResponse({ success: true, deleted: result.deletedCount }, 200, request);
      }
    }

    // Endpoint: /api/entities/Appointment/bulk
    if (pathName === "/api/entities/Appointment/bulk") {
      if (method === "POST") {
        const recordsArray = await request.json(); 
        if (!Array.isArray(recordsArray)) {
          return createJsonResponse({ error: "Body must be an array" }, 400, request);
        }
        const records = await Appointment.insertMany(recordsArray);
        return createJsonResponse(records, 201, request);
      }
      
      if (method === "PUT") {
        const updatesArray = await request.json(); 
        if (!Array.isArray(updatesArray)) {
          return createJsonResponse({ error: "Body must be an array" }, 400, request);
        }
        
        // Build optimized bulkWrite payload updates for Mongo
        const bulkOps = updatesArray.map((item: any) => {
          const { id, _id, ...updateFields } = item;
          const targetId = id || _id;
          return {
            updateOne: {
              filter: { _id: new mongoose.Types.ObjectId(targetId) },
              update: { $set: updateFields }
            }
          };
        });

        const result = await (Appointment as any).bulkWrite(bulkOps);
        return createJsonResponse({ success: true, updated: result.modifiedCount }, 200, request);
      }
    }

    // Endpoint: /api/entities/Appointment/update-many
    if (pathName === "/api/entities/Appointment/update-many" && method === "PATCH") {
      const { query, data } = await request.json();
      const cleanQuery = sanitizeMongoQuery(query);

      if (!cleanQuery || Object.keys(cleanQuery).length === 0) {
        return createJsonResponse(
          { error: "Refusing update: a valid non-empty query filter is required." },
          400,
          request
        );
      }
      
      // Processes runtime update modifiers ($set, $inc, etc.) safely
      const result = await Appointment.updateMany(cleanQuery, data);
      return createJsonResponse({ 
        success: true, 
        matchedCount: result.matchedCount, 
        modifiedCount: result.modifiedCount 
      }, 200, request);
    }

    return createJsonResponse({ error: "Endpoint not found" }, 404, request);
  } catch (error: any) {
    return createJsonResponse({ error: error.message }, 400, request);
  }
}

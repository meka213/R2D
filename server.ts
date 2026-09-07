import express from "express";
import "dotenv/config";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MongoClient, Db, ObjectId } from "mongodb";

export interface TimelineMilestone {
  id: string;
  entity_id: string; // Target entity ID
  date: string; // YYYY-MM-DD
  date_precision?: 'exact' | 'month' | 'year' | 'approximate';
  title: string;
  event_type: string;
  description: string;
  location?: string;
  regions: string[];
  coordinates?: { lat: number; lng: number };
  source_record_id?: string; // Original R2D record ID
  source_record_type?: string; // Original R2D record type for auth
  source?: string;
  source_date?: string;
  confidence?: string;
  origin: 'auto' | 'manual';
  is_major: boolean;
  visible: boolean;
  created_at: string;
  updated_at: string;
  stage?: 'start' | 'development' | 'escalation' | 'turning_point' | 'de_escalation' | 'end' | 'ongoing';
}

export interface RiskRecord {
  id: string;
  title: string;
  entity_type: string;
  regions: string[];
  tags: string[];
  affiliations: string[];
  rivalries: string[];
  summary: string;
  linked_events: string[];
  updated_at: string;
  dob?: string;
  start_date?: string;
  end_date?: string;
  is_ongoing?: boolean;
  date_precision?: 'exact' | 'month' | 'year' | 'approximate';
  location?: string;
  coordinates?: { lat: number; lng: number };
  source?: string;
  source_date?: string;
  confidence?: string;
  chronology?: TimelineMilestone[];
}

interface Client {
  id: string;
  name: string;
  access_key: string;
  allowed_regions: string[];
  allowed_types: string[];
  created_at: string;
  expires_at: string;
}

interface DemoRequest {
  id: string;
  name: string;
  email: string;
  organization: string;
  message: string;
  timestamp: string;
}

interface AccessLog {
  id: string;
  client_id: string;
  client_name: string;
  action: string;
  regions: string[];
  timestamp: string;
}

let db: Db;
let mongoClient: MongoClient | null = null;

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn("MONGODB_URI is missing. Server starting in LIMITED MODE (No Database).");
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL: MONGODB_URI is required in production.");
      process.exit(1);
    }
    return;
  }

  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "intelligence_db";
    db = mongoClient.db(dbName);
    console.log(`MongoDB connected: ${dbName}`);

    // Create indexes for timeline_nodes
    const timelineCollection = db.collection("timeline_nodes");
    await timelineCollection.createIndex({ entity_id: 1 });
    await timelineCollection.createIndex({ date: 1 });
    await timelineCollection.createIndex({ source_record_id: 1 });
    await timelineCollection.createIndex({ origin: 1 });
    console.log("Timeline indexes initialized.");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

// Helper to access the main intelligence profiles collection
async function getProfilesCollection() {
  return db.collection<any>("profiles");
}

async function getTimelineCollection() {
  return db.collection<TimelineMilestone>("timeline_nodes");
}

/**
 * ADAPTER: Maps raw MongoDB documents to RiskRecord interface
 * Handle _id mapping and field normalization
 */
function adaptRecord(raw: any): RiskRecord {
  const id = raw._id ? raw._id.toString() : (raw.id || "");
  return {
    id,
    title: raw.name || raw.title || "UNKNOWN",
    entity_type: raw.entity_type || "Unknown",
    regions: Array.isArray(raw.regions) ? raw.regions : (raw.region ? [raw.region] : []),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    affiliations: Array.isArray(raw.allies) ? raw.allies : [],
    rivalries: Array.isArray(raw.rivalries) ? raw.rivalries : [],
    summary: raw.summary || raw.text || "",
    linked_events: Array.isArray(raw.linked_neo4j_nodes) ? raw.linked_neo4j_nodes : [],
    updated_at: raw.updated_at ? (typeof raw.updated_at === 'string' ? raw.updated_at : raw.updated_at.toISOString()) : new Date().toISOString(),
    dob: raw.dob,
    start_date: raw.start_date,
    end_date: raw.end_date,
    is_ongoing: raw.is_ongoing === true,
    date_precision: raw.date_precision,
    location: raw.location,
    coordinates: raw.coordinates,
    source: raw.source,
    source_date: raw.source_date,
    confidence: raw.confidence,
    chronology: Array.isArray(raw.chronology) ? raw.chronology : undefined
  };
}

function getQueryId(id: string) {
  try {
    if (id.length === 24) {
      return { _id: new ObjectId(id) };
    }
    return { _id: id };
  } catch (e) {
    return { _id: id };
  }
}


/*
 * ============================================================
 * TIMELINE GENERATION ENGINE (DERIVED VIEW)
 * ============================================================
 */

function detectPrecision(dateStr: string): 'exact' | 'month' | 'year' | 'approximate' {
  if (!dateStr) return 'year';
  const parts = dateStr.split('-');
  if (parts.length === 3) return 'exact';
  if (parts.length === 2) return 'month';
  return 'year';
}

/**
 * Generates or refreshes automatic timeline nodes for a given entity.
 * This does NOT delete manual nodes.
 */
async function refreshEntityTimeline(recordId: string) {
  const profilesCollection = await getProfilesCollection();
  const timelineCollection = await getTimelineCollection();

  const rawRecord = await profilesCollection.findOne(getQueryId(recordId));

  if (!rawRecord) return;

  const record = adaptRecord(rawRecord);

  // Clear existing auto nodes for this entity
  await timelineCollection.deleteMany({
    entity_id: record.id,
    origin: 'auto'
  });

  const autoNodes: Omit<TimelineMilestone, "id">[] = [];

  // 1. Birth - Explicit DOB
  if (record.dob) {
    autoNodes.push({
      entity_id: record.id,
      date: record.dob,
      date_precision: detectPrecision(record.dob),
      title: `Birth: ${record.title}`,
      event_type: 'Birth',
      description: `Documented birth for ${record.title}.`,
      location: record.location,
      regions: record.regions,
      coordinates: record.coordinates,
      source_record_id: record.id,
      source_record_type: record.entity_type,
      source: record.source,
      source_date: record.source_date,
      confidence: record.confidence,
      origin: 'auto',
      is_major: true,
      visible: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // 2. Formation/Establishment - Explicit start_date
  if (record.start_date) {
    const isPerson = record.entity_type.toLowerCase().includes('person');
    autoNodes.push({
      entity_id: record.id,
      date: record.start_date,
      date_precision: detectPrecision(record.start_date),
      title: isPerson ? `Career Start: ${record.title}` : `Formation: ${record.title}`,
      event_type: isPerson ? 'Activation' : 'Establishment',
      description: isPerson ? `Initial documented activity for ${record.title}.` : `Documented formation of ${record.title}.`,
      location: record.location,
      regions: record.regions,
      coordinates: record.coordinates,
      source_record_id: record.id,
      source_record_type: record.entity_type,
      source: record.source,
      source_date: record.source_date,
      confidence: record.confidence,
      origin: 'auto',
      is_major: true,
      visible: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // 3. Death/Dissolution - Explicit end_date
  if (record.end_date) {
    const isPerson = record.entity_type.toLowerCase().includes('person');
    autoNodes.push({
      entity_id: record.id,
      date: record.end_date,
      date_precision: detectPrecision(record.end_date),
      title: isPerson ? `Death: ${record.title}` : `Dissolution: ${record.title}`,
      event_type: isPerson ? 'Death' : 'Dissolution',
      description: isPerson ? `Documented death for ${record.title}.` : `Documented dissolution of ${record.title}.`,
      location: record.location,
      regions: record.regions,
      coordinates: record.coordinates,
      source_record_id: record.id,
      source_record_type: record.entity_type,
      source: record.source,
      source_date: record.source_date,
      confidence: record.confidence,
      origin: 'auto',
      is_major: true,
      visible: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // Insert new auto nodes
  if (autoNodes.length > 0) {
    await timelineCollection.insertMany(autoNodes as any);
  }
}

/**
 * Filter timeline nodes based on client permissions
 */
async function getAuthorizedTimeline(clientId: string, entityId: string): Promise<TimelineMilestone[]> {
  const clientsCollection = db.collection<Client>("clients");
  const profilesCollection = await getProfilesCollection();
  const timelineCollection = await getTimelineCollection();

  const client = await clientsCollection.findOne({ id: clientId });
  if (!client) throw new Error("Client not found");

  if (new Date(client.expires_at) < new Date()) {
    throw new Error("Client access expired");
  }

  const rawRecord = await profilesCollection.findOne(getQueryId(entityId));
  if (!rawRecord) return [];

  const record = adaptRecord(rawRecord);
  
  // Verify region permission
  const hasRegionPermission = record.regions.some(r => client.allowed_regions.includes(r));
  // Verify entity type permission
  const hasTypePermission = client.allowed_types.includes(record.entity_type);

  if (!hasRegionPermission || !hasTypePermission) {
    return [];
  }

  const nodes = await timelineCollection.find({ 
    entity_id: record.id,
    visible: true 
  }).sort({ date: 1 }).toArray();

  const authorizedNodes: TimelineMilestone[] = [];

  for (const node of nodes) {
    let sourceAuthorized = true;

    // Strict cross-check for related records provenance
    if (node.source_record_id && node.source_record_id !== record.id) {
      let sourceRegions = node.regions;
      let sourceType = node.source_record_type;

      if (!sourceRegions || sourceRegions.length === 0) {
        // Resolve from source record
        const rawSource = await profilesCollection.findOne(getQueryId(node.source_record_id));
        if (rawSource) {
          const sourceRecord = adaptRecord(rawSource);
          sourceRegions = sourceRecord.regions;
          sourceType = sourceRecord.entity_type;
        } else {
          // If source not found and node has no regions, fail closed
          sourceAuthorized = false;
        }
      }

      if (sourceAuthorized && sourceRegions) {
        const hasSourceRegion = sourceRegions.some(r => client.allowed_regions.includes(r));
        const hasSourceType = !sourceType || client.allowed_types.includes(sourceType);
        
        if (!hasSourceRegion || !hasSourceType) {
          sourceAuthorized = false;
        }
      } else {
        sourceAuthorized = false;
      }
    }

    if (sourceAuthorized) {
      authorizedNodes.push(node);
    }
  }

  return authorizedNodes;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Database availability middleware
  app.use("/api", (req, res, next) => {
    if (!db) {
      return res.status(503).json({
        error: "Database connection not established. Please configure MONGODB_URI in the environment settings.",
      });
    }
    next();
  });

  /*
   * Admin credentials
   *
   * Recommended:
   * ADMIN_USER=...
   * ADMIN_PASS=...
   *
   * in .env
   */
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    console.warn("ADMIN_USER or ADMIN_PASS not set. Admin access will be disabled.");
  }

  let adminSessionToken: string | null = null;

  /*
   * ============================================================
   * ADMIN LOGIN
   * ============================================================
   */

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (
      username === ADMIN_USER &&
      password === ADMIN_PASS
    ) {
      adminSessionToken =
        `ADM-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;

      res.json({
        token: adminSessionToken
      });
    } else {
      res.status(401).json({
        error: "Invalid admin credentials"
      });
    }
  });

  /*
   * ============================================================
   * ADMIN AUTH MIDDLEWARE
   * ============================================================
   */

  app.use("/api/admin", (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next();
    }

    const token = req.headers["x-admin-token"];

    if (
      token &&
      typeof token === "string" &&
      token === adminSessionToken
    ) {
      next();
    } else {
      res.status(401).json({
        error: "Unauthorized admin access"
      });
    }
  });

  /*
   * ============================================================
   * CLIENT LOGIN
   * ============================================================
   */

  app.post("/api/client/login", async (req, res) => {
    try {
      const { access_key } = req.body;

      if (!access_key) {
        return res.status(400).json({
          error: "Access key required"
        });
      }

      const clientsCollection =
        db.collection<Client>("clients");

      const client = await clientsCollection.findOne({
        access_key: String(access_key).toUpperCase()
      });

      if (!client) {
        return res.status(401).json({
          error: "Invalid access key"
        });
      }

      if (
        new Date(client.expires_at) < new Date()
      ) {
        return res.status(403).json({
          error: "Intelligence access has expired"
        });
      }

      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: "Login",
        regions: client.allowed_regions || [],
        timestamp: new Date().toISOString()
      });

      res.json(client);
    } catch (error) {
      console.error("Client login error:", error);

      res.status(500).json({
        error: "Server error"
      });
    }
  });

  /*
   * ============================================================
   * CLIENT RECORDS
   * ============================================================
   */

  app.get("/api/client/records", async (req, res) => {
    try {
      const accessKey =
        req.headers["x-access-key"];

      if (
        !accessKey ||
        typeof accessKey !== "string"
      ) {
        return res.status(401).json({
          error: "Unauthorized"
        });
      }

      const clientsCollection =
        db.collection<Client>("clients");

      const client = await clientsCollection.findOne({
        access_key: accessKey.toUpperCase()
      });

      if (!client) {
        return res.status(401).json({
          error: "Unauthorized"
        });
      }

      if (
        new Date(client.expires_at) < new Date()
      ) {
        return res.status(403).json({
          error: "Access expired"
        });
      }

      const profilesCollection = await getProfilesCollection();

      // Load all profiles to apply normalization-based authorization
      const allRaw = await profilesCollection
        .find({})
        .sort({ updated_at: -1 })
        .toArray();

      const filtered = allRaw
        .map(raw => adaptRecord(raw))
        .filter(record => {
          // Check region permission
          const hasRegion = record.regions.some(r => client.allowed_regions.includes(r));
          // Check type permission
          const hasType = client.allowed_types.includes(record.entity_type);
          return hasRegion && hasType;
        });

      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: "Data Access",
        regions: client.allowed_regions,
        timestamp: new Date().toISOString()
      });

      res.json(filtered);
    } catch (error) {
      console.error(
        "Client records error:",
        error
      );

      res.status(500).json({
        error: "Failed to retrieve records"
      });
    }
  });

  /*
   * ============================================================
   * CLIENT AUTHORIZED ENTITY TIMELINE
   * ============================================================
   */

  app.get("/api/client/records/:id/timeline", async (req, res) => {
    try {
      const accessKey = req.headers["x-access-key"];
      const { id } = req.params;

      if (!accessKey || typeof accessKey !== "string") {
        return res.status(401).json({ error: "Missing access key" });
      }

      const clientsCollection = db.collection<Client>("clients");
      const client = await clientsCollection.findOne({
        access_key: accessKey.toUpperCase()
      });

      if (!client) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (new Date(client.expires_at) < new Date()) {
        return res.status(403).json({ error: "Access expired" });
      }

      const milestones = await getAuthorizedTimeline(client.id, id);

      // Audit log entry
      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: `Timeline Access: ${id}`,
        regions: [], // Will be populated by the record's actual regions if needed
        timestamp: new Date().toISOString()
      });

      res.json({ milestones });
    } catch (error) {
      console.error("Client timeline error:", error);
      res.status(500).json({ error: "Failed to build entity timeline" });
    }
  });

  /*
   * ============================================================
   * ADMIN ENTITY TIMELINE
   * ============================================================
   */

  app.get("/api/admin/records/:id/timeline", async (req, res) => {
    try {
      const { id } = req.params;
      const profilesCollection = await getProfilesCollection();
      const timelineCollection = await getTimelineCollection();

      const rawRecord = await profilesCollection.findOne(getQueryId(id));

      if (!rawRecord) {
        return res.status(404).json({ error: "Record not found" });
      }

      const record = adaptRecord(rawRecord);

      // Refresh auto nodes before returning
      await refreshEntityTimeline(record.id);

      const milestones = await timelineCollection.find({ 
        entity_id: record.id 
      }).sort({ date: 1 }).toArray();

      res.json({
        entity: record,
        milestones
      });
    } catch (error) {
      console.error("Admin timeline error:", error);
      res.status(500).json({ error: "Failed to retrieve timeline" });
    }
  });

  /*
   * MANUALLY ADD TIMELINE NODE
   */
  app.post("/api/admin/records/:id/timeline", async (req, res) => {
    try {
      const { id } = req.params;
      const nodeData = req.body;
      const timelineCollection = await getTimelineCollection();
      const profilesCollection = await getProfilesCollection();

      // Verify entity existence
      const entity = await profilesCollection.findOne(getQueryId(id));
      if (!entity) {
        return res.status(404).json({ error: "Target entity profile not found" });
      }

      // Validate required fields
      if (!nodeData.date || !nodeData.title || !nodeData.event_type || !nodeData.description) {
        return res.status(400).json({ error: "Missing required fields (date, title, event_type, description)" });
      }

      // Whitelist only supported fields
      const whitelisted: Partial<TimelineMilestone> = {};
      const fields = [
        'date', 'date_precision', 'title', 'event_type', 'description', 
        'location', 'regions', 'coordinates', 'source_record_id', 
        'source_record_type', 'source', 'source_date', 'confidence', 
        'stage', 'is_major', 'visible'
      ];

      for (const field of fields) {
        if (nodeData[field] !== undefined) {
          // Type validations
          if (field === 'regions' && !Array.isArray(nodeData[field])) continue;
          if ((field === 'is_major' || field === 'visible') && typeof nodeData[field] !== 'boolean') continue;
          if (field === 'coordinates' && (typeof nodeData[field] !== 'object' || nodeData[field] === null)) continue;
          
          (whitelisted as any)[field] = nodeData[field];
        }
      }

      const newNode: TimelineMilestone = {
        ...whitelisted,
        id: `TL-MAN-${Date.now()}`,
        entity_id: id,
        origin: 'manual',
        date: whitelisted.date!,
        title: whitelisted.title!,
        event_type: whitelisted.event_type!,
        description: whitelisted.description!,
        regions: whitelisted.regions || [],
        is_major: whitelisted.is_major || false,
        visible: whitelisted.visible !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as TimelineMilestone;

      await timelineCollection.insertOne(newNode);

      // Audit log
      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-ADM-${Date.now()}`,
        client_id: "ADMIN",
        client_name: "ADMINISTRATOR",
        action: `Manual Timeline Node Added: ${id}`,
        regions: whitelisted.regions || [],
        timestamp: new Date().toISOString()
      });

      res.status(201).json(newNode);
    } catch (error) {
      console.error("Add timeline node error:", error);
      res.status(500).json({ error: "Failed to add timeline node" });
    }
  });

  /*
   * EDIT TIMELINE NODE
   */
  app.put("/api/admin/timeline/:timelineId", async (req, res) => {
    try {
      const { timelineId } = req.params;
      const updateData = req.body;
      const timelineCollection = await getTimelineCollection();

      const existing = await timelineCollection.findOne({ id: timelineId });
      if (!existing) return res.status(404).json({ error: "Node not found" });

      // Prevent unauthorized modification of identity fields
      const { id, entity_id, origin, created_at, ...allowedUpdates } = updateData;

      const updated = {
        ...existing,
        ...allowedUpdates,
        id: existing.id, // Enforce
        entity_id: existing.entity_id, // Enforce
        origin: existing.origin, // Enforce
        updated_at: new Date().toISOString()
      };

      await timelineCollection.replaceOne({ id: timelineId }, updated);

      res.json(updated);
    } catch (error) {
      console.error("Update timeline node error:", error);
      res.status(500).json({ error: "Failed to update node" });
    }
  });

  /*
   * DELETE TIMELINE NODE
   */
  app.delete("/api/admin/timeline/:timelineId", async (req, res) => {
    try {
      const { timelineId } = req.params;
      const timelineCollection = await getTimelineCollection();

      const existing = await timelineCollection.findOne({ id: timelineId });
      if (existing?.origin === 'auto') {
        return res.status(403).json({ error: "Cannot delete automatic nodes. Hide them instead." });
      }

      await timelineCollection.deleteOne({ id: timelineId });
      res.json({ message: "Node deleted" });
    } catch (error) {
      console.error("Delete timeline node error:", error);
      res.status(500).json({ error: "Failed to delete node" });
    }
  });

  /*
   * PATCH VISIBILITY
   */
  app.patch("/api/admin/timeline/:timelineId/visibility", async (req, res) => {
    try {
      const { timelineId } = req.params;
      const { visible } = req.body;
      const timelineCollection = await getTimelineCollection();

      await timelineCollection.updateOne(
        { id: timelineId },
        { $set: { visible: !!visible, updated_at: new Date().toISOString() } }
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Visibility toggle error:", error);
      res.status(500).json({ error: "Failed to toggle visibility" });
    }
  });

  /*
   * ============================================================
   * PUBLIC API - (SECURED)
   * ============================================================
   */

  // Public /api/records removed for security. Access through /api/client/records instead.

  /*
   * ============================================================
   * DATABASE STATUS
   * ============================================================
   */

  app.get("/api/database/status", async (req, res) => {
    try {
      const latestRecord =
        await (await getProfilesCollection())
          .find({})
          .sort({ updated_at: -1 })
          .limit(1)
          .toArray();

      const totalRecords =
        await (await getProfilesCollection())
          .countDocuments();

      res.json({
        total_records: totalRecords,
        last_updated:
          latestRecord.length > 0
            ? latestRecord[0].updated_at
            : null
      });
    } catch (error) {
      console.error(
        "Database status error:",
        error
      );

      res.status(500).json({
        error: "Failed to retrieve database status"
      });
    }
  });

  /*
   * ============================================================
   * DEMO REQUEST
   * ============================================================
   */

  app.post("/api/demo-request", async (req, res) => {
    try {
      const {
        name,
        email,
        organization,
        message
      } = req.body;

      const newRequest: DemoRequest = {
        id: `REQ-${Date.now()}`,
        name,
        email,
        organization,
        message,
        timestamp: new Date().toISOString()
      };

      await db
        .collection<DemoRequest>("demo_requests")
        .insertOne(newRequest);

      res.status(201).json({
        message: "Demo request received"
      });
    } catch (error) {
      console.error(
        "Demo request error:",
        error
      );

      res.status(500).json({
        error: "Failed to submit demo request"
      });
    }
  });

  /*
   * ============================================================
   * ADMIN - RECORDS
   * ============================================================
   */

  app.get("/api/admin/records", async (req, res) => {
    try {
      const profilesCollection = await getProfilesCollection();
      const records =
        await profilesCollection
          .find({})
          .sort({ updated_at: -1 })
          .toArray();

      res.json(records);
    } catch (error) {
      console.error(
        "Admin records error:",
        error
      );

      res.status(500).json({
        error: "Failed to retrieve records"
      });
    }
  });

  /*
   * CREATE RECORD
   */

  app.post("/api/admin/ingest", async (req, res) => {
    try {
      const {
        title,
        entity_type,
        regions,
        tags,
        affiliations,
        rivalries,
        summary,
        linked_events,
        dob,
        start_date,
        end_date,
        location,
        source,
        confidence
      } = req.body;

      const now = new Date().toISOString();
      const profilesCollection = await getProfilesCollection();

      // Use production field names for insertion
      const newDoc = {
        name: title,
        entity_type,
        summary: summary || "",
        text: summary || "",
        allies: Array.isArray(affiliations) ? affiliations : [],
        rivalries: Array.isArray(rivalries) ? rivalries : [],
        linked_neo4j_nodes: Array.isArray(linked_events) ? linked_events : [],
        updated_at: now,
        dob,
        start_date,
        end_date,
        location,
        source,
        source_date: req.body.source_date,
        confidence,
        tags: Array.isArray(tags) ? tags : []
      };

      const result = await profilesCollection.insertOne(newDoc);
      const responseRecord = adaptRecord({ ...newDoc, _id: result.insertedId });

      // Auto-generate timeline for the new record
      try {
        await refreshEntityTimeline(responseRecord.id);
      } catch (e) {
        console.error("Initial timeline refresh failed:", e);
      }

      res.status(201).json(responseRecord);
    } catch (error) {
      console.error("Create record error:", error);
      res.status(500).json({ error: "Failed to create record" });
    }
  });

  /*
   * UPDATE RECORD
   */

  app.put("/api/admin/records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        entity_type,
        summary,
        affiliations,
        rivalries,
        linked_events,
        dob,
        start_date,
        end_date,
        location,
        source,
        confidence,
        tags
      } = req.body;

      const profilesCollection = await getProfilesCollection();
      const existing = await profilesCollection.findOne(getQueryId(id));

      if (!existing) {
        return res.status(404).json({ error: "Record not found" });
      }

      const updatedDoc = {
        ...existing,
        name: title !== undefined ? title : existing.name,
        entity_type: entity_type !== undefined ? entity_type : existing.entity_type,
        summary: summary !== undefined ? summary : existing.summary,
        text: summary !== undefined ? summary : existing.text,
        allies: Array.isArray(affiliations) ? affiliations : existing.allies,
        rivalries: Array.isArray(rivalries) ? rivalries : existing.rivalries,
        linked_neo4j_nodes: Array.isArray(linked_events) ? linked_events : existing.linked_neo4j_nodes,
        updated_at: new Date().toISOString(),
        dob: dob !== undefined ? dob : existing.dob,
        start_date: start_date !== undefined ? start_date : existing.start_date,
        end_date: end_date !== undefined ? end_date : existing.end_date,
        location: location !== undefined ? location : existing.location,
        source: source !== undefined ? source : existing.source,
        confidence: confidence !== undefined ? confidence : existing.confidence,
        tags: Array.isArray(tags) ? tags : existing.tags
      };

      await profilesCollection.replaceOne(getQueryId(id), updatedDoc);

      // Refresh timeline to reflect updates
      try {
        await refreshEntityTimeline(id);
      } catch (e) {
        console.error("Timeline refresh on update failed:", e);
      }

      res.json(adaptRecord({ ...updatedDoc, _id: existing._id }));
    } catch (error) {
      console.error("Update record error:", error);
      res.status(500).json({ error: "Failed to update record" });
    }
  });

  /*
   * DELETE RECORD
   */

  app.delete("/api/admin/records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const profilesCollection = await getProfilesCollection();

      const pRes = await profilesCollection.deleteOne(getQueryId(id));

      if (pRes.deletedCount === 0) {
        return res.status(404).json({ error: "Record not found" });
      }

      // Cleanup timeline nodes
      await (await getTimelineCollection()).deleteMany({ entity_id: id });

      res.json({ message: "Record deleted" });
    } catch (error) {
      console.error("Delete record error:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  /*
   * ============================================================
   * ADMIN - DEMO REQUESTS
   * ============================================================
   */

  app.get(
    "/api/admin/demo-requests",
    async (req, res) => {
      try {
        const requests =
          await db
            .collection<DemoRequest>("demo_requests")
            .find({})
            .sort({ timestamp: -1 })
            .toArray();

        res.json(requests);
      } catch (error) {
        console.error(
          "Demo requests error:",
          error
        );

        res.status(500).json({
          error: "Failed to retrieve requests"
        });
      }
    }
  );

  app.delete(
    "/api/admin/demo-requests/:id",
    async (req, res) => {
      try {
        const { id } = req.params;

        await db
          .collection<DemoRequest>("demo_requests")
          .deleteOne({ id });

        res.json({
          message: "Request deleted"
        });
      } catch (error) {
        console.error(
          "Delete request error:",
          error
        );

        res.status(500).json({
          error: "Failed to delete request"
        });
      }
    }
  );

  /*
   * ============================================================
   * ADMIN - CLIENTS
   * ============================================================
   */

  app.get("/api/admin/clients", async (req, res) => {
    try {
      const clients =
        await db
          .collection<Client>("clients")
          .find({})
          .sort({ created_at: -1 })
          .toArray();

      res.json(clients);
    } catch (error) {
      console.error(
        "Admin clients error:",
        error
      );

      res.status(500).json({
        error: "Failed to retrieve clients"
      });
    }
  });

  /*
   * CREATE CLIENT
   */

  app.post("/api/admin/clients", async (req, res) => {
    try {
      const {
        name,
        allowed_regions,
        allowed_types,
        expiry_months
      } = req.body;

      const expiryDate =
        new Date();

      expiryDate.setMonth(
        expiryDate.getMonth() +
          (parseInt(expiry_months) || 1)
      );

      const newClient: Client = {
        id: `CLI-${Math.floor(
          1000 + Math.random() * 9000
        )}`,

        name,

        access_key:
          Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase(),

        allowed_regions:
          Array.isArray(allowed_regions)
            ? allowed_regions
            : [],

        allowed_types:
          Array.isArray(allowed_types)
            ? allowed_types
            : [],

        created_at:
          new Date().toISOString(),

        expires_at:
          expiryDate.toISOString()
      };

      await db
        .collection<Client>("clients")
        .insertOne(newClient);

      res.status(201).json(newClient);
    } catch (error) {
      console.error(
        "Create client error:",
        error
      );

      res.status(500).json({
        error: "Failed to create client"
      });
    }
  });

  /*
   * UPDATE CLIENT
   */

  app.put("/api/admin/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const {
        name,
        allowed_regions,
        allowed_types,
        expires_at
      } = req.body;

      const clientsCollection =
        db.collection<Client>("clients");

      const existing =
        await clientsCollection.findOne({ id });

      if (!existing) {
        return res.status(404).json({
          error: "Client not found"
        });
      }

      const updatedClient: Client = {
        ...existing,

        name:
          name || existing.name,

        allowed_regions:
          Array.isArray(allowed_regions)
            ? allowed_regions
            : existing.allowed_regions,

        allowed_types:
          Array.isArray(allowed_types)
            ? allowed_types
            : existing.allowed_types,

        expires_at:
          expires_at || existing.expires_at
      };

      await clientsCollection.replaceOne(
        { id },
        updatedClient
      );

      res.json(updatedClient);
    } catch (error) {
      console.error(
        "Update client error:",
        error
      );

      res.status(500).json({
        error: "Failed to update client"
      });
    }
  });

  /*
   * DELETE CLIENT
   */

  app.delete("/api/admin/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await db
        .collection<Client>("clients")
        .deleteOne({ id });

      res.json({
        message: "Client deleted"
      });
    } catch (error) {
      console.error(
        "Delete client error:",
        error
      );

      res.status(500).json({
        error: "Failed to delete client"
      });
    }
  });

  /*
   * RESET CLIENT KEY
   */

  app.post(
    "/api/admin/clients/:id/reset-key",
    async (req, res) => {
      try {
        const { id } = req.params;
        const { custom_key } = req.body;

        const clientsCollection =
          db.collection<Client>("clients");

        const existing =
          await clientsCollection.findOne({ id });

        if (!existing) {
          return res.status(404).json({
            error: "Client not found"
          });
        }

        const newKey =
          custom_key ||
          Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();

        const updatedClient: Client = {
          ...existing,
          access_key:
            String(newKey).toUpperCase()
        };

        await clientsCollection.replaceOne(
          { id },
          updatedClient
        );

        res.json(updatedClient);
      } catch (error) {
        console.error(
          "Reset key error:",
          error
        );

        res.status(500).json({
          error: "Failed to reset client key"
        });
      }
    }
  );

  /*
   * ============================================================
   * ADMIN - ACCESS LOGS
   * ============================================================
   */

  app.get(
    "/api/admin/access-logs",
    async (req, res) => {
      try {
        const logs =
          await db
            .collection<AccessLog>("access_logs")
            .find({})
            .sort({ timestamp: -1 })
            .limit(500)
            .toArray();

        res.json(logs);
      } catch (error) {
        console.error(
          "Access logs error:",
          error
        );

        res.status(500).json({
          error: "Failed to retrieve access logs"
        });
      }
    }
  );

  /*
   * ============================================================
   * VITE / PRODUCTION
   * ============================================================
   */

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: "spa"
    });

    app.use(vite.middlewares);
  } else {
    const distPath =
      path.join(process.cwd(), "dist");

    app.use(
      express.static(distPath)
    );

    app.get("*", (req, res) => {
      res.sendFile(
        path.join(
          distPath,
          "index.html"
        )
      );
    });
  }

  /*
   * ============================================================
   * START
   * ============================================================
   */

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    }
  );
}

connectDatabase()
  .then(() => {
    return startServer();
  })
  .catch(error => {
    console.error(
      "FATAL: Failed to start Risk2Data:",
      error
    );

    process.exit(1);
  });
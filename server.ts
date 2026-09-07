import express from "express";
import "dotenv/config";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MongoClient, Db } from "mongodb";

export interface TimelineMilestone {
  id: string;
  date: string;
  date_precision?: 'exact' | 'month' | 'year' | 'approximate';
  title: string;
  event_type: string;
  location?: string;
  regions?: string[];
  formatted_location?: string;
  duration?: string;
  coordinates?: { lat: number; lng: number };
  description: string;
  related_entities?: string[];
  source?: string;
  source_date?: string;
  confidence?: 'Verified' | 'High' | 'Moderate' | 'Reported' | string;
  related_record_id?: string;
  record_id?: string;
  is_major?: boolean;
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
  confidence?: 'Verified' | 'High' | 'Moderate' | 'Reported';
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
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

// Helper to access the main intelligence profiles collection
async function getProfilesCollection() {
  return db.collection<RiskRecord>("profiles");
}


/*
 * ============================================================
 * TIMELINE & CHRONOLOGY BUILDER LOGIC
 * ============================================================
 */

function formatLocationWithRegions(location?: string, regions: string[] = []): string {
  const loc = (location || "").trim();
  const regionStr = (regions || []).join(" / ").toUpperCase();
  if (loc && regionStr) {
    const city = loc.split(",")[0].trim().toUpperCase();
    return `${city} — ${regionStr}`;
  }
  if (loc) return loc.toUpperCase();
  if (regionStr) return regionStr;
  return "NATIONAL THEATER";
}

function buildTimelineForEntity(record: RiskRecord, authorizedRelated: RiskRecord[]): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];
  const addedIds = new Set<string>();

  const isPersonType = [
    "Person",
    "Commander",
    "Militia Commander",
    "militia_commander",
    "person",
    "commander"
  ].includes(record.entity_type);

  const isEventType = [
    "Event",
    "Conflict",
    "Incident",
    "War",
    "event",
    "conflict"
  ].includes(record.entity_type);

  // 1. Entity's primary temporal inception/birth/formation
  if (isPersonType && record.dob) {
    const birthId = `birth-${record.id}`;
    milestones.push({
      id: birthId,
      date: record.dob,
      date_precision: record.dob.length === 4 ? "year" : record.dob.length === 7 ? "month" : "exact",
      title: `Birth: ${record.title}`,
      event_type: "Birth",
      location: record.location,
      regions: record.regions,
      description: `Documented date of birth for ${record.title}.`,
      related_entities: [record.title],
      record_id: record.id,
      source: record.source,
      source_date: record.dob,
      confidence: record.confidence,
      is_major: true,
      stage: "start"
    });
    addedIds.add(birthId);
  }

  if (record.start_date) {
    const startId = `start-${record.id}`;
    let eventType: TimelineMilestone["event_type"] = "Formation";
    let title = `Establishment: ${record.title}`;
    let desc = record.summary;

    if (isPersonType) {
      eventType = "Appointment";
      title = `Service Inception: ${record.title}`;
      desc = `Initial documented service or appointment for ${record.title}.`;
    } else if (isEventType) {
      eventType = "Operational activity";
      title = `Inception: ${record.title}`;
      desc = `Documented start of ${record.title}. ${record.summary}`;
    }

    milestones.push({
      id: startId,
      date: record.start_date,
      date_precision: record.start_date.length === 4 ? "year" : record.start_date.length === 7 ? "month" : "exact",
      title,
      event_type: eventType,
      location: record.location,
      regions: record.regions,
      description: desc,
      related_entities: [record.title],
      record_id: record.id,
      source: record.source,
      source_date: record.source_date || record.start_date,
      confidence: record.confidence,
      is_major: true,
      stage: "start"
    });
    addedIds.add(startId);
  }

  // 2. Incorporate explicit milestones from record.chronology if present
  if (record.chronology && Array.isArray(record.chronology)) {
    for (const item of record.chronology) {
      let verifiedRecordId: string | undefined = undefined;
      let isAuthorized = true;

      if (item.related_record_id) {
        const found = authorizedRelated.find(r => r.id === item.related_record_id);
        if (found) {
          verifiedRecordId = found.id;
        } else {
          // If a related record is specified but not in authorized list,
          // we check if it refers back to the parent record itself
          if (item.related_record_id === record.id) {
            verifiedRecordId = record.id;
          } else {
            // Strict enforcement: do not show information about unauthorized related records
            isAuthorized = false;
          }
        }
      } else {
        verifiedRecordId = record.id;
      }

      if (isAuthorized) {
        const mId = item.id || `chrono-${record.id}-${item.date}-${milestones.length}`;
        if (!addedIds.has(mId)) {
          milestones.push({
            id: mId,
            date: item.date,
            date_precision: item.date_precision || (item.date.length === 4 ? "year" : item.date.length === 7 ? "month" : "exact"),
            title: item.title,
            event_type: item.event_type || "Security",
            location: item.location || record.location,
            regions: item.regions || record.regions,
            coordinates: item.coordinates || record.coordinates,
            description: item.description,
            related_entities: item.related_entities || [record.title],
            source: item.source || record.source,
            source_date: item.source_date,
            confidence: item.confidence || record.confidence,
            related_record_id: verifiedRecordId,
            record_id: verifiedRecordId,
            is_major: !!item.is_major,
            stage: item.stage || "development"
          });
          addedIds.add(mId);
        }
      }
    }
  }

  // 3. Synthesize milestones from authorized related records
  for (const rel of authorizedRelated) {
    const isRelEvent = ["Event", "Conflict", "Incident", "War"].includes(rel.entity_type);
    const isRelAffiliation = record.affiliations && record.affiliations.includes(rel.title);
    const isRelRivalry = record.rivalries && record.rivalries.includes(rel.title);
    const isLinkedEvent = record.linked_events && record.linked_events.includes(rel.title);

    const relDate = rel.start_date || rel.source_date || (rel.updated_at ? rel.updated_at.split("T")[0] : null);

    if (relDate) {
      const relId = `rel-${rel.id}`;
      if (!addedIds.has(relId) && !milestones.some(m => m.record_id === rel.id || m.title.includes(rel.title))) {
        let eventType: TimelineMilestone["event_type"] = "Operational activity";
        let stage: TimelineMilestone["stage"] = "development";
        let title = rel.title;
        let isMajor = false;

        if (isRelEvent || isLinkedEvent) {
          eventType = "Operational activity";
          stage = rel.is_ongoing ? "ongoing" : (rel.end_date ? "end" : "development");
          title = `Engagement: ${rel.title}`;
          isMajor = true;
        } else if (isRelAffiliation) {
          eventType = "Affiliation";
          title = `Command Alignment: ${rel.title}`;
          stage = "development";
          isMajor = true;
        } else if (isRelRivalry) {
          eventType = "Rivalry";
          title = `Strategic Rivalry: ${rel.title}`;
          stage = "development";
          isMajor = false;
        }

        milestones.push({
          id: relId,
          date: relDate,
          date_precision: rel.date_precision || (relDate.length === 4 ? "year" : relDate.length === 7 ? "month" : "exact"),
          title,
          event_type: eventType,
          location: rel.location,
          regions: rel.regions,
          coordinates: rel.coordinates,
          description: rel.summary,
          related_entities: [rel.title, record.title],
          record_id: rel.id,
          related_record_id: rel.id,
          source: rel.source,
          source_date: rel.source_date,
          confidence: rel.confidence,
          is_major: isMajor,
          stage
        });
        addedIds.add(relId);
      }
    }
  }

  // 4. End / Resolution / Ongoing milestones
  if (isEventType && record.end_date) {
    const endId = `end-${record.id}`;
    if (!addedIds.has(endId)) {
      milestones.push({
        id: endId,
        date: record.end_date,
        date_precision: record.end_date.length === 4 ? "year" : record.end_date.length === 7 ? "month" : "exact",
        title: `Resolution: ${record.title}`,
        event_type: "Ceasefire / Truce",
        location: record.location,
        regions: record.regions,
        description: `Operational termination or documented resolution of ${record.title}.`,
        related_entities: [record.title],
        record_id: record.id,
        source: record.source,
        source_date: record.end_date,
        confidence: record.confidence,
        is_major: true,
        stage: "end"
      });
      addedIds.add(endId);
    }
  } else if (isEventType && record.is_ongoing !== false) {
    const ongoingId = `ongoing-${record.id}`;
    if (!addedIds.has(ongoingId)) {
      milestones.push({
        id: ongoingId,
        date: record.updated_at ? record.updated_at.split("T")[0] : "2026",
        date_precision: "year",
        title: `Active Status: ${record.title}`,
        event_type: "Security",
        location: record.location,
        regions: record.regions,
        description: `Ongoing tactical monitoring indicates persistent operational activity and presence.`,
        related_entities: [record.title],
        record_id: record.id,
        source: record.source,
        confidence: record.confidence,
        is_major: true,
        stage: "ongoing"
      });
      addedIds.add(ongoingId);
    }
  }

  // 5. Chronological sort (Earliest to Latest)
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  return milestones;
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
  const ADMIN_USER =
    process.env.ADMIN_USER || "admin1";

  const ADMIN_PASS =
    process.env.ADMIN_PASS || "change-this-admin-password";

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

      const filtered = await profilesCollection
        .find({
          regions: {
            $in: client.allowed_regions || []
          },
          entity_type: {
            $in: client.allowed_types || []
          }
        })
        .sort({
          updated_at: -1
        })
        .toArray();

      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: "Data Access",
        regions: Array.from(
          new Set(
            filtered.flatMap(
              record => record.regions || []
            )
          )
        ),
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
   * Strict Authorization Enforcement:
   * 1. Validates client access key & expiration
   * 2. Validates target entity matches allowed_regions & allowed_types
   * 3. Queries related records strictly filtered by allowed_regions & allowed_types
   * 4. Multi-region support preserved on all returned milestones
   * 5. Logs access to access_logs audit trail
   */

  app.get("/api/client/records/:id/timeline", async (req, res) => {
    try {
      const accessKey = req.headers["x-access-key"];
      const { id } = req.params;

      if (!accessKey || typeof accessKey !== "string") {
        return res.status(401).json({
          error: "Missing access key"
        });
      }

      const clientsCollection = db.collection<Client>("clients");
      const client = await clientsCollection.findOne({
        access_key: accessKey.toUpperCase()
      });

      if (!client) {
        return res.status(401).json({
          error: "Unauthorized"
        });
      }

      if (new Date(client.expires_at) < new Date()) {
        return res.status(403).json({
          error: "Access expired"
        });
      }

      const profilesCollection = await getProfilesCollection();
      const record = await profilesCollection.findOne({ id });

      if (!record) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      // Check client authorization for this target entity
      const hasRegionAccess = (record.regions || []).some((r: string) =>
        (client.allowed_regions || []).includes(r)
      );
      const hasTypeAccess = (client.allowed_types || []).includes(record.entity_type);

      if (!hasRegionAccess || !hasTypeAccess) {
        return res.status(403).json({
          error: "Unauthorized: Record outside client analytical clearance"
        });
      }

      // Fetch related records that match the client's authorization ONLY
      const authorizedRelated = await profilesCollection
        .find({
          id: { $ne: record.id },
          regions: { $in: client.allowed_regions || [] },
          entity_type: { $in: client.allowed_types || [] },
          $or: [
            { linked_events: record.title },
            { affiliations: record.title },
            { rivalries: record.title },
            { title: { $in: [...(record.linked_events || []), ...(record.affiliations || []), ...(record.rivalries || [])] } },
            { id: { $in: (record.chronology || []).map((c: TimelineMilestone) => c.related_record_id).filter(Boolean) } }
          ]
        })
        .toArray();

      const milestones = buildTimelineForEntity(record, authorizedRelated);

      // Audit log entry
      await db.collection<AccessLog>("access_logs").insertOne({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: `Timeline Access: ${record.id}`,
        regions: record.regions,
        timestamp: new Date().toISOString()
      });

      res.json({
        entity: {
          id: record.id,
          title: record.title,
          entity_type: record.entity_type,
          regions: record.regions,
          location: record.location,
          dob: record.dob,
          start_date: record.start_date,
          end_date: record.end_date,
          is_ongoing: record.is_ongoing
        },
        milestones
      });
    } catch (error) {
      console.error("Client timeline error:", error);
      res.status(500).json({
        error: "Failed to build entity timeline"
      });
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
      const record = await profilesCollection.findOne({ id });

      if (!record) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      // Admin has full operational visibility
      const allRelated = await profilesCollection
        .find({
          id: { $ne: record.id },
          $or: [
            { linked_events: record.title },
            { affiliations: record.title },
            { rivalries: record.title },
            { title: { $in: [...(record.linked_events || []), ...(record.affiliations || []), ...(record.rivalries || [])] } },
            { id: { $in: (record.chronology || []).map((c: TimelineMilestone) => c.related_record_id).filter(Boolean) } }
          ]
        })
        .toArray();

      const milestones = buildTimelineForEntity(record, allRelated);

      res.json({
        entity: {
          id: record.id,
          title: record.title,
          entity_type: record.entity_type,
          regions: record.regions,
          location: record.location,
          dob: record.dob,
          start_date: record.start_date,
          end_date: record.end_date,
          is_ongoing: record.is_ongoing
        },
        milestones
      });
    } catch (error) {
      console.error("Admin timeline error:", error);
      res.status(500).json({
        error: "Failed to build entity timeline"
      });
    }
  });

  /*
   * ============================================================
   * PUBLIC RECORDS API
   * ============================================================
   */

  app.get("/api/records", async (req, res) => {
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
        "Public records error:",
        error
      );

      res.status(500).json({
        error: "Failed to retrieve records"
      });
    }
  });

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
        .collection<DemoRequest>("demoRequests")
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
        confidence,
        chronology
      } = req.body;

      const now =
        new Date().toISOString();

      const newRecord: RiskRecord = {
        id: `R2D-${Math.floor(
          1000 + Math.random() * 9000
        )}`,
        title,
        entity_type,

        regions: Array.isArray(regions)
          ? regions
          : regions
          ? [regions]
          : [],

        tags:
          typeof tags === "string"
            ? tags
                .split(",")
                .map(t => t.trim())
                .filter(Boolean)
            : Array.isArray(tags)
            ? tags
            : [],

        affiliations:
          Array.isArray(affiliations)
            ? affiliations
            : [],

        rivalries:
          Array.isArray(rivalries)
            ? rivalries
            : [],

        summary: summary || "",

        linked_events:
          Array.isArray(linked_events)
            ? linked_events
            : [],

        dob,
        start_date,
        end_date,
        location,
        source,
        confidence,
        chronology: Array.isArray(chronology) ? chronology : undefined,

        updated_at: now
      };

      await db.collection<RiskRecord>("profiles").insertOne(newRecord);

      res.status(201).json(newRecord);
    } catch (error) {
      console.error(
        "Create record error:",
        error
      );

      res.status(500).json({
        error: "Failed to create record"
      });
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
        confidence,
        chronology
      } = req.body;

      const profilesCollection = await getProfilesCollection();

      const existing =
        await profilesCollection.findOne({ id });

      if (!existing) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      const updatedRecord: RiskRecord = {
        ...existing,

        title:
          title !== undefined
            ? title
            : existing.title,

        entity_type:
          entity_type !== undefined
            ? entity_type
            : existing.entity_type,

        regions:
          Array.isArray(regions)
            ? regions
            : regions
            ? [regions]
            : existing.regions,

        tags:
          typeof tags === "string"
            ? tags
                .split(",")
                .map(t => t.trim())
                .filter(Boolean)
            : Array.isArray(tags)
            ? tags
            : existing.tags,

        affiliations:
          Array.isArray(affiliations)
            ? affiliations
            : existing.affiliations,

        rivalries:
          Array.isArray(rivalries)
            ? rivalries
            : existing.rivalries,

        summary:
          summary !== undefined
            ? summary
            : existing.summary,

        linked_events:
          Array.isArray(linked_events)
            ? linked_events
            : existing.linked_events,

        dob: dob !== undefined ? dob : existing.dob,
        start_date: start_date !== undefined ? start_date : existing.start_date,
        end_date: end_date !== undefined ? end_date : existing.end_date,
        location: location !== undefined ? location : existing.location,
        source: source !== undefined ? source : existing.source,
        confidence: confidence !== undefined ? confidence : existing.confidence,
        chronology: chronology !== undefined ? chronology : existing.chronology,

        updated_at:
          new Date().toISOString()
      };

      await db.collection<RiskRecord>("profiles").replaceOne(
        { id },
        updatedRecord
      );

      res.json(updatedRecord);
    } catch (error) {
      console.error(
        "Update record error:",
        error
      );

      res.status(500).json({
        error: "Failed to update record"
      });
    }
  });

  /*
   * DELETE RECORD
   */

  app.delete("/api/admin/records/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const pRes = await db.collection<RiskRecord>("profiles").deleteOne({ id });

      if (pRes.deletedCount === 0) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      res.json({
        message: "Record deleted"
      });
    } catch (error) {
      console.error(
        "Delete record error:",
        error
      );

      res.status(500).json({
        error: "Failed to delete record"
      });
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
            .collection<DemoRequest>("demoRequests")
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
          .collection<DemoRequest>("demoRequests")
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
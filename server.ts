import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MongoClient, Db } from "mongodb";

interface RiskRecord {
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

let db: { collection: <T = any>(name: string) => any };
let mongoClient: MongoClient | null = null;

/**
 * Simple in-memory fallback for MongoDB when MONGODB_URI is missing.
 */
class InMemoryCollection {
  private data: any[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async countDocuments() {
    return this.data.length;
  }

  async insertMany(docs: any[]) {
    this.data.push(...docs);
    return { insertedCount: docs.length };
  }

  async insertOne(doc: any) {
    this.data.push(doc);
    return { insertedId: doc.id || doc._id };
  }

  async findOne(filter: any) {
    return this.data.find(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
  }

  find(filter: any = {}) {
    let results = this.data.filter(item => {
      for (const key in filter) {
        if (filter[key] && typeof filter[key] === 'object' && filter[key].$in) {
          const values = filter[key].$in;
          const itemValue = item[key];
          if (Array.isArray(itemValue)) {
            if (!itemValue.some(v => values.includes(v))) return false;
          } else {
            if (!values.includes(itemValue)) return false;
          }
          continue;
        }
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });

    const cursor = {
      results,
      sort: (sortObj: any) => {
        const key = Object.keys(sortObj)[0];
        const dir = sortObj[key];
        results.sort((a, b) => {
          if (a[key] < b[key]) return dir === 1 ? -1 : 1;
          if (a[key] > b[key]) return dir === 1 ? 1 : -1;
          return 0;
        });
        return cursor;
      },
      limit: (n: number) => {
        results = results.slice(0, n);
        return cursor;
      },
      toArray: async () => results
    };

    return cursor;
  }

  async replaceOne(filter: any, doc: any) {
    const index = this.data.findIndex(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
    if (index !== -1) {
      this.data[index] = doc;
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }

  async deleteOne(filter: any) {
    const index = this.data.findIndex(item => {
      for (const key in filter) {
        if (item[key] !== filter[key]) return false;
      }
      return true;
    });
    if (index !== -1) {
      this.data.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async createIndex() {
    // No-op for in-memory
    return this.name;
  }
}

class InMemoryDb {
  private collections: Record<string, InMemoryCollection> = {};

  collection<T = any>(name: string) {
    if (!this.collections[name]) {
      this.collections[name] = new InMemoryCollection(name);
    }
    return this.collections[name];
  }
}

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.warn("MONGODB_URI is missing. Falling back to IN-MEMORY database.");
    db = new InMemoryDb();
    await seedDatabase();
    return;
  }

  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "risk2data";
    db = mongoClient.db(dbName);
    console.log(`MongoDB connected: ${dbName}`);
    await seedDatabase();
  } catch (error) {
    console.error("Failed to connect to MongoDB, falling back to IN-MEMORY database:", error);
    db = new InMemoryDb();
    await seedDatabase();
  }
}

async function seedDatabase() {
  const recordsCollection = db.collection<RiskRecord>("records");

  const count = await recordsCollection.countDocuments();

  if (count <= 2) {
    const now = new Date().toISOString();

    const initialRecords: RiskRecord[] = [
      {
        id: "R2D-001",
        title: "Dar al-Ifta",
        entity_type: "Security Actor",
        regions: ["West"],
        tags: ["Religious", "Political", "Tripoli"],
        affiliations: ["Tajoura Battalion"],
        rivalries: ["Rada / Special Deterrence"],
        summary:
          "Influential religious and doctrinal authority in western Libya. Exercises substantial political influence through affiliated armed formations in Tajoura and western Tripoli.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-002",
        title: "Abdul Rauf Kara",
        entity_type: "Commander",
        regions: ["West"],
        tags: ["Rada", "Tripoli", "Security", "Mitiga"],
        affiliations: ["Special Deterrence Forces (Rada)"],
        rivalries: ["Dar al-Ifta", "444 Brigade"],
        summary:
          "Commander of the Special Deterrence Forces (Rada), overseeing security apparatus, detention facilities, and anti-crime operations across eastern Tripoli and Mitiga.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-003",
        title: "Mahmoud Hamza",
        entity_type: "Commander",
        regions: ["West"],
        tags: ["444 Brigade", "Tripoli", "Military", "Salah al-Din"],
        affiliations: ["444 Combat Brigade", "Ministry of Defense"],
        rivalries: ["Special Deterrence Forces (Rada)"],
        summary:
          "Commander of the 444 Combat Brigade. Established one of Tripoli's most disciplined and combat-capable armed formations under the Ministry of Defense.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-004",
        title: "444 Combat Brigade",
        entity_type: "Armed Group",
        regions: ["West"],
        tags: ["Tripoli", "Infantry", "Military", "Checkpoint Security"],
        affiliations: ["Mahmoud Hamza", "Ministry of Defense"],
        rivalries: ["Special Deterrence Forces (Rada)", "SSA"],
        summary:
          "High-readiness military combat brigade headquartered in southern Tripoli. Deployed across strategic corridors connecting Tripoli, Bani Walid, and Tarhuna to deter illicit trafficking.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-005",
        title: "Special Deterrence Forces (Rada)",
        entity_type: "Militia",
        regions: ["West"],
        tags: ["Tripoli", "Salafist", "Detention", "Mitiga"],
        affiliations: ["Abdul Rauf Kara", "Mitiga Airport Authority"],
        rivalries: ["Dar al-Ifta", "444 Brigade", "Tajoura Lions Battalion"],
        summary:
          "Powerful armed militia controlling Mitiga International Airport and surrounding Souq al-Jumaa district. Operates counter-crime units and secure detention centers.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-006",
        title: "Fathi Bashagha",
        entity_type: "Person",
        regions: ["West", "National"],
        tags: ["Misrata", "Political Figure", "Ex-Interior Minister"],
        affiliations: ["Misrata Formations", "Sirte Front"],
        rivalries: ["Abdul Hamid Dbeibah"],
        summary:
          "Prominent Libyan political and security figure from Misrata. Served as Minister of Interior in the GNA, maintaining deep ties across western military councils.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-007",
        title: "Stability Support Apparatus (SSA)",
        entity_type: "Militia",
        regions: ["West"],
        tags: ["Abu Salim", "Gheniwa", "Paramilitary", "Tripoli"],
        affiliations: ["Abdelghani al-Kikli", "Presidential Council"],
        rivalries: ["444 Brigade", "Nawasi Brigade"],
        summary:
          "Well-funded paramilitary militia established by Presidential Council decree, centered in the strategic Abu Salim district of southern Tripoli.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-008",
        title: "111 Brigade",
        entity_type: "Armed Group",
        regions: ["West"],
        tags: ["Tripoli", "Misrata", "Heavy Armor", "Airport Road"],
        affiliations: ["Abdelsalam Zoubi", "Ministry of Defense"],
        rivalries: ["Stability Support Apparatus (SSA)"],
        summary:
          "Armed group with roots in Misrata Halboos brigade, securing critical infrastructure along the Tripoli Airport Road and western approaches.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-009",
        title: "Khalifa Haftar",
        entity_type: "Commander",
        regions: ["East", "South"],
        tags: ["LNA", "Benghazi", "Field Marshal", "General Command"],
        affiliations: ["Libyan National Army (LNA)"],
        rivalries: ["Western Armed Groups", "Tripoli Security Coalition"],
        summary:
          "Commander of the Libyan National Army (LNA), exercising operational control over security structures, airbases, and military divisions across eastern and southern Libya.",
        linked_events: ["5+5 Joint Military Commission Ceasefire"],
        updated_at: now
      },
      {
        id: "R2D-010",
        title: "Tariq Ben Ziyad Brigade",
        entity_type: "Armed Group",
        regions: ["East", "South"],
        tags: ["LNA", "Ground Forces", "Specialized Units", "Benghazi"],
        affiliations: ["Khalifa Haftar", "LNA General Command"],
        rivalries: ["Chadian Rebel Formations"],
        summary:
          "Primary frontline armed brigade of the LNA, heavily equipped with armored vehicles and tasked with high-profile security operations and border patrol in the south.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-011",
        title: "Sadiq al-Ghariani",
        entity_type: "Person",
        regions: ["West"],
        tags: ["Grand Mufti", "Dar al-Ifta", "Cleric", "Religious Leadership"],
        affiliations: ["Dar al-Ifta", "Tajoura Battalion"],
        rivalries: ["Special Deterrence Forces (Rada)", "LNA"],
        summary:
          "Grand Mufti of Libya leading Dar al-Ifta, issuing binding religious fatwas and maintaining direct ideological influence over conservative revolutionary armed groups.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-012",
        title: "Oussama al-Juweili",
        entity_type: "Commander",
        regions: ["West"],
        tags: ["Zintan", "Western Military Zone", "Major General"],
        affiliations: ["Zintan Military Council"],
        rivalries: ["GNU Government"],
        summary:
          "Major General from Zintan and former commander of the Western Military Zone. Retains decisive influence among armed forces in the Nafusa Mountains and Zintan.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-013",
        title: "Tajoura Lions Battalion",
        entity_type: "Militia",
        regions: ["West"],
        tags: ["Tajoura", "Coastal Route", "Militia", "East Gate"],
        affiliations: ["Dar al-Ifta"],
        rivalries: ["Special Deterrence Forces (Rada)"],
        summary:
          "Armed militia controlling the eastern coastal gateway of Tripoli through Tajoura, maintaining ideological alignment with Dar al-Ifta.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-014",
        title: "Petroleum Facilities Guard (PFG)",
        entity_type: "Security Actor",
        regions: ["East", "West", "South"],
        tags: ["Oil Crescent", "Critical Infrastructure", "Energy Security"],
        affiliations: ["National Oil Corporation (NOC)"],
        rivalries: ["Local Tribal Blockaders"],
        summary:
          "Specialized security actor mandated with safeguarding crude export terminals, oil pipelines, and pumping stations throughout the Sirte basin and southern fields.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-015",
        title: "Presidential Council (PC)",
        entity_type: "Political",
        regions: ["National", "West"],
        tags: ["Executive", "Head of State", "Supreme Commander", "Tripoli"],
        affiliations: ["5+5 Joint Military Commission Ceasefire"],
        rivalries: [],
        summary:
          "Executive governing body established under UN-brokered political dialogue, functioning as collective head of state and nominal Supreme Commander of Libyan military forces.",
        linked_events: ["5+5 Joint Military Commission Ceasefire"],
        updated_at: now
      },
      {
        id: "R2D-016",
        title: "Mitiga International Airbase Complex",
        entity_type: "Location",
        regions: ["West"],
        tags: ["Airfield", "Detention Center", "East Tripoli", "Strategic Site"],
        affiliations: ["Special Deterrence Forces (Rada)"],
        rivalries: [],
        summary:
          "Strategic dual-use military airbase and commercial airport on the eastern perimeter of Tripoli, serving as Rada's command center and primary detention site.",
        linked_events: ["Tripoli Security Truce"],
        updated_at: now
      },
      {
        id: "R2D-017",
        title: "Tripoli Security Truce",
        entity_type: "Event",
        regions: ["West"],
        tags: ["Ceasefire", "De-escalation", "Urban Mediation", "Tripoli"],
        affiliations: ["444 Combat Brigade", "Special Deterrence Forces (Rada)"],
        rivalries: [],
        summary:
          "Mediated local security de-escalation in Tripoli following intense confrontations, establishing demarcation lines and joint deconfliction protocols.",
        linked_events: [],
        updated_at: now
      }
    ];

    if (count > 0) {
      // Clear old 2 records to replace with comprehensive dataset
      for (const rec of initialRecords) {
        await recordsCollection.replaceOne({ id: rec.id }, rec);
      }
    }
    await recordsCollection.insertMany(initialRecords);

    console.log("Comprehensive R2D records seeded.");
  }

  const clientsCollection = db.collection<Client>("clients");
  const clientCount = await clientsCollection.countDocuments();
  if (clientCount === 0) {
    const now = new Date().toISOString();
    const defaultClient: Client = {
      id: "CLI-1001",
      name: "Security Analysis & Risk Delegation",
      access_key: "DEMO2026",
      allowed_regions: ["West", "East", "South", "National"],
      allowed_types: [
        "Security Actor",
        "Commander",
        "Armed Group",
        "Militia",
        "Person",
        "Political",
        "Location",
        "Event"
      ],
      created_at: now,
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
    };
    await clientsCollection.insertOne(defaultClient);
    console.log("Default Demo Client (DEMO2026) seeded.");
  }

  await db.collection<Client>("clients").createIndex(
    { access_key: 1 },
    { unique: true }
  );

  await db.collection<RiskRecord>("records").createIndex(
    { id: 1 },
    { unique: true }
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

      await db.collection<AccessLog>("accessLogs").insertOne({
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

      const recordsCollection =
        db.collection<RiskRecord>("records");

      const filtered = await recordsCollection
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

      await db.collection<AccessLog>("accessLogs").insertOne({
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
   * PUBLIC RECORDS API
   * ============================================================
   */

  app.get("/api/records", async (req, res) => {
    try {
      const records =
        await db
          .collection<RiskRecord>("records")
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
        await db
          .collection<RiskRecord>("records")
          .find({})
          .sort({ updated_at: -1 })
          .limit(1)
          .toArray();

      const totalRecords =
        await db
          .collection<RiskRecord>("records")
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
      const records =
        await db
          .collection<RiskRecord>("records")
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
        linked_events
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

        updated_at: now
      };

      await db
        .collection<RiskRecord>("records")
        .insertOne(newRecord);

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
        linked_events
      } = req.body;

      const recordsCollection =
        db.collection<RiskRecord>("records");

      const existing =
        await recordsCollection.findOne({ id });

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

        updated_at:
          new Date().toISOString()
      };

      await recordsCollection.replaceOne(
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

      const result =
        await db
          .collection<RiskRecord>("records")
          .deleteOne({ id });

      if (result.deletedCount === 0) {
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
            .collection<AccessLog>("accessLogs")
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
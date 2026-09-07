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

  if (count === 0) {
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
          "Influential religious and political movement in western Libya. Exercises influence through religious institutions and affiliated armed formations.",
        linked_events: [],
        updated_at: now
      },
      {
        id: "R2D-002",
        title: "Abdul Rauf Kara",
        entity_type: "Commander",
        regions: ["West"],
        tags: ["Rada", "Tripoli", "Security"],
        affiliations: ["Special Deterrence Forces (Rada)"],
        rivalries: ["Dar al-Ifta"],
        summary:
          "Commander of the Special Deterrence Forces (Rada), a powerful security apparatus based in Tripoli.",
        linked_events: [],
        updated_at: now
      }
    ];

    await recordsCollection.insertMany(initialRecords);

    console.log("Initial R2D records created.");
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
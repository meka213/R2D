import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Record {
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

let records: Record[] = [
  {
    id: "R2D-001",
    title: "Dar al-Ifta",
    entity_type: "Security Actor",
    regions: ["West"],
    tags: ["Religious", "Political", "Tripoli"],
    affiliations: ["Tajoura Battalion"],
    rivalries: ["Rada / Special Deterrence"],
    summary: "Influential religious and political movement in western Libya. Exercises influence through religious institutions and affiliated armed formations.",
    linked_events: [],
    updated_at: new Date().toISOString()
  },
  {
    id: "R2D-002",
    title: "Abdul Rauf Kara",
    entity_type: "Commander",
    regions: ["West"],
    tags: ["Rada", "Tripoli", "Security"],
    affiliations: ["Special Deterrence Forces (Rada)"],
    rivalries: ["Dar al-Ifta"],
    summary: "Commander of the Special Deterrence Forces (Rada), a powerful security apparatus based in Tripoli.",
    linked_events: [],
    updated_at: new Date().toISOString()
  }
];

interface AccessLog {
  id: string;
  client_id: string;
  client_name: string;
  action: string;
  regions: string[];
  timestamp: string;
}

let demoRequests: DemoRequest[] = [];
let clients: Client[] = [];
let accessLogs: AccessLog[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ADMIN_USER = "admin1";
  const ADMIN_PASS = "admin@2026!";
  let adminSessionToken: string | null = null;

  // Admin Authentication
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      adminSessionToken = `ADM-${Math.random().toString(36).substring(2, 15)}`;
      res.json({ token: adminSessionToken });
    } else {
      res.status(401).json({ error: "Invalid admin credentials" });
    }
  });

  // Middleware to protect admin routes
  app.use("/api/admin", (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    
    const token = req.headers["x-admin-token"];
    if (token && token === adminSessionToken) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized admin access" });
    }
  });

  // Client Authentication & Portal API
  app.post("/api/client/login", (req, res) => {
    const { access_key } = req.body;
    const client = clients.find(c => c.access_key === access_key);
    if (client) {
      if (new Date(client.expires_at) < new Date()) {
        return res.status(403).json({ error: "Intelligence access has expired" });
      }

      // Log Login
      accessLogs.push({
        id: `LOG-${Date.now()}`,
        client_id: client.id,
        client_name: client.name,
        action: "Login",
        regions: client.allowed_regions,
        timestamp: new Date().toISOString()
      });

      res.json(client);
    } else {
      res.status(401).json({ error: "Invalid access key" });
    }
  });

  app.get("/api/client/records", (req, res) => {
    const accessKey = req.headers['x-access-key'];
    const client = clients.find(c => c.access_key === accessKey);
    
    if (!client) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (new Date(client.expires_at) < new Date()) {
      return res.status(403).json({ error: "Access expired" });
    }

    const filtered = records.filter(r => 
      r.regions.some(region => client.allowed_regions.includes(region)) && 
      client.allowed_types.includes(r.entity_type)
    );

    // Log Data Access
    accessLogs.push({
      id: `LOG-${Date.now()}`,
      client_id: client.id,
      client_name: client.name,
      action: "Data Access",
      regions: Array.from(new Set(filtered.flatMap(r => r.regions))),
      timestamp: new Date().toISOString()
    });
    
    res.json(filtered);
  });

  // Public API
  app.get("/api/records", (req, res) => {
    res.json(records);
  });

  app.post("/api/demo-request", (req, res) => {
    const { name, email, organization, message } = req.body;
    const newRequest: DemoRequest = {
      id: `REQ-${Date.now()}`,
      name,
      email,
      organization,
      message,
      timestamp: new Date().toISOString()
    };
    demoRequests.push(newRequest);
    res.status(201).json({ message: "Demo request received" });
  });

  // Admin API - Records
  app.get("/api/admin/records", (req, res) => {
    res.json(records);
  });

  app.get("/api/admin/demo-requests", (req, res) => {
    res.json(demoRequests);
  });

  app.delete("/api/admin/demo-requests/:id", (req, res) => {
    const { id } = req.params;
    demoRequests = demoRequests.filter(r => r.id !== id);
    res.json({ message: "Request deleted" });
  });

  app.post("/api/admin/ingest", (req, res) => {
    const { title, entity_type, regions, tags, affiliations, rivalries, summary, linked_events } = req.body;
    const newRecord: Record = {
      id: `R2D-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      entity_type,
      regions: Array.isArray(regions) ? regions : [regions],
      tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags,
      affiliations: Array.isArray(affiliations) ? affiliations : [],
      rivalries: Array.isArray(rivalries) ? rivalries : [],
      summary,
      linked_events: linked_events || [],
      updated_at: new Date().toISOString()
    };
    records.push(newRecord);
    res.status(201).json(newRecord);
  });

  app.put("/api/admin/records/:id", (req, res) => {
    const { id } = req.params;
    const { title, entity_type, regions, tags, affiliations, rivalries, summary, linked_events } = req.body;
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
      records[index] = {
        ...records[index],
        title,
        entity_type,
        regions: Array.isArray(regions) ? regions : [regions],
        tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags,
        affiliations: Array.isArray(affiliations) ? affiliations : [],
        rivalries: Array.isArray(rivalries) ? rivalries : [],
        summary,
        linked_events: linked_events || [],
        updated_at: new Date().toISOString()
      };
      res.json(records[index]);
    } else {
      res.status(404).json({ error: "Record not found" });
    }
  });

  app.delete("/api/admin/records/:id", (req, res) => {
    const { id } = req.params;
    records = records.filter(r => r.id !== id);
    res.json({ message: "Record deleted" });
  });

  // Admin API - Clients
  app.get("/api/admin/clients", (req, res) => {
    res.json(clients);
  });

  app.get("/api/admin/access-logs", (req, res) => {
    res.json(accessLogs);
  });

  app.post("/api/admin/clients", (req, res) => {
    const { name, allowed_regions, allowed_types, expiry_months } = req.body;
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (parseInt(expiry_months) || 1));

    const newClient: Client = {
      id: `CLI-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      access_key: Math.random().toString(36).substring(2, 10).toUpperCase(),
      allowed_regions,
      allowed_types,
      created_at: new Date().toISOString(),
      expires_at: expiryDate.toISOString()
    };
    clients.push(newClient);
    res.status(201).json(newClient);
  });

  app.delete("/api/admin/clients/:id", (req, res) => {
    const { id } = req.params;
    clients = clients.filter(c => c.id !== id);
    res.json({ message: "Client deleted" });
  });

  app.put("/api/admin/clients/:id", (req, res) => {
    const { id } = req.params;
    const { name, allowed_regions, allowed_types, expires_at } = req.body;
    const index = clients.findIndex(c => c.id === id);
    if (index !== -1) {
      clients[index] = {
        ...clients[index],
        name: name || clients[index].name,
        allowed_regions: allowed_regions || clients[index].allowed_regions,
        allowed_types: allowed_types || clients[index].allowed_types,
        expires_at: expires_at || clients[index].expires_at
      };
      res.json(clients[index]);
    } else {
      res.status(404).json({ error: "Client not found" });
    }
  });

  app.post("/api/admin/clients/:id/reset-key", (req, res) => {
    const { id } = req.params;
    const { custom_key } = req.body;
    const index = clients.findIndex(c => c.id === id);
    if (index !== -1) {
      clients[index].access_key = custom_key || Math.random().toString(36).substring(2, 10).toUpperCase();
      res.json(clients[index]);
    } else {
      res.status(404).json({ error: "Client not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

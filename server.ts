import express from "express";
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
    const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "intelligence_db";
    db = mongoClient.db(dbName);
    console.log(`MongoDB connected: ${dbName}`);
    await seedDatabase();
  } catch (error) {
    console.error("Failed to connect to MongoDB, falling back to IN-MEMORY database:", error);
    db = new InMemoryDb();
    await seedDatabase();
  }
}

// Helper to access the main intelligence profiles collection
async function getProfilesCollection() {
  return db.collection<RiskRecord>("profiles");
}

async function seedDatabase() {
  const profilesCollection = db.collection<RiskRecord>("profiles");
  const now = new Date().toISOString();

  const initialRecords: RiskRecord[] = [
    {
      id: "R2D-001",
      title: "Dar al-Ifta",
      entity_type: "Security Actor",
      regions: ["West"],
      tags: ["Religious", "Political", "Tripoli", "Jurisprudence"],
      affiliations: ["Tajoura Battalion", "Sadiq al-Ghariani"],
      rivalries: ["Special Deterrence Forces (Rada)", "LNA"],
      summary:
        "Influential religious and doctrinal authority in western Libya. Exercises substantial political influence through affiliated armed formations in Tajoura and western Tripoli.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2012-02-20",
      is_ongoing: true,
      date_precision: "exact",
      location: "Tripoli, Libya",
      coordinates: { lat: 32.8872, lng: 13.1913 },
      source: "High State Council & General National Congress Archives",
      source_date: "2023-08",
      confidence: "High",
      updated_at: now,
      chronology: [
        {
          id: "TM-001-1",
          date: "2012-02-20",
          date_precision: "exact",
          title: "Establishment of Dar al-Ifta by NTC Decree",
          event_type: "Formation",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Formally established by National Transitional Council Law No. 15 as Libya's official state religious jurisprudence authority.",
          related_entities: ["Sadiq al-Ghariani"],
          source: "NTC Official Gazette",
          source_date: "2012-02-20",
          confidence: "Verified",
          related_record_id: "R2D-011",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-001-2",
          date: "2014-06-12",
          date_precision: "exact",
          title: "Religious Proclamation on Western Libya Defense",
          event_type: "Political Decision",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Issued doctrinal fatwa urging revolutionary battalions in western Libya to unite command structures and maintain control of capital defense perimeters.",
          related_entities: ["Tajoura Lions Battalion"],
          source: "Dar al-Ifta Official Bulletin",
          source_date: "2014-06-12",
          confidence: "Verified",
          related_record_id: "R2D-013",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-001-3",
          date: "2019-04-05",
          date_precision: "exact",
          title: "Mobilization Decree in Response to Tripoli Offensive",
          event_type: "Mobilization",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Delivered public religious address declaring defensive jihad in support of anti-offensive operations along the southern Tripoli approaches.",
          related_entities: ["Khalifa Haftar"],
          source: "UNSMIL Special Monitoring Report",
          source_date: "2019-04-10",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-001-4",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Clergy Appeal & De-escalation Mediation",
          event_type: "Ceasefire / Truce",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Issued communiqué supporting community elder arbitration to resolve the urban clashes between the 444 Combat Brigade and Rada.",
          related_entities: ["Mahmoud Hamza", "Abdul Rauf Kara", "Tripoli Security Truce"],
          source: "Libya Observer & UNSMIL Ceasefire Desk",
          source_date: "2023-08-15",
          confidence: "High",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
    },
    {
      id: "R2D-002",
      title: "Abdul Rauf Kara",
      entity_type: "Commander",
      regions: ["West"],
      tags: ["Rada", "Tripoli", "Security", "Mitiga", "Militia Commander"],
      affiliations: ["Special Deterrence Forces (Rada)"],
      rivalries: ["Dar al-Ifta", "444 Combat Brigade"],
      summary:
        "Commander of the Special Deterrence Forces (Rada), overseeing security apparatus, detention facilities, and anti-crime operations across eastern Tripoli and Mitiga.",
      linked_events: ["Tripoli Security Truce"],
      dob: "1973",
      date_precision: "year",
      location: "Souq al-Jumaa, Tripoli",
      coordinates: { lat: 32.8953, lng: 13.2783 },
      source: "UNSMIL Panel of Experts / Libyan Ministry of Interior Records",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-002-1",
          date: "1973",
          date_precision: "year",
          title: "Birth in Souq al-Jumaa",
          event_type: "Birth",
          location: "Souq al-Jumaa, Tripoli, Libya",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Born and raised in the prominent Souq al-Jumaa municipal district on the eastern periphery of Tripoli.",
          related_entities: [],
          source: "Libyan Civil Registry & Research Dossier",
          source_date: "2019-01",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-002-2",
          date: "2011-08-21",
          date_precision: "exact",
          title: "17 February Revolution Armed Vanguard",
          event_type: "Military",
          location: "Souq al-Jumaa, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Commanded local revolutionary combatant cells securing eastern arterial corridors during the liberation of Tripoli.",
          related_entities: [],
          source: "UNSMIL Field Archive",
          source_date: "2011-09",
          confidence: "Verified",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-002-3",
          date: "2012-04-10",
          date_precision: "month",
          title: "Founding of Special Deterrence Forces (Rada)",
          event_type: "Formation",
          location: "Souq al-Jumaa, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Established Rada as a specialized counter-narcotics, anti-kidnapping, and counter-terrorism formation with headquarters in Souq al-Jumaa.",
          related_entities: ["Special Deterrence Forces (Rada)"],
          source: "Ministry of Interior Archives",
          source_date: "2012-05",
          confidence: "Verified",
          related_record_id: "R2D-005",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-002-4",
          date: "2014-07-28",
          date_precision: "exact",
          title: "Assumption of Control over Mitiga Airbase",
          event_type: "Infrastructure",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Secured Mitiga Airbase following the destruction of Tripoli International Airport, creating the primary government aviation and security hub.",
          related_entities: ["Mitiga International Airbase Complex", "Special Deterrence Forces (Rada)"],
          source: "Libyan Civil Aviation Authority Bulletins",
          source_date: "2014-08",
          confidence: "Verified",
          related_record_id: "R2D-016",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-002-5",
          date: "2018-09-01",
          date_precision: "exact",
          title: "Presidency Council Integration Decree No. 555",
          event_type: "Appointment",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Government of National Accord formally institutionalized Rada as the Deterrence Apparatus for Combating Organized Crime and Terrorism.",
          related_entities: ["Presidential Council (PC)", "Special Deterrence Forces (Rada)"],
          source: "Official Gazette of the Presidency Council",
          source_date: "2018-09-01",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-002-6",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Mitiga Standoff & Detention Incident",
          event_type: "Clash / Conflict",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Rada forces under Kara's operational chain of command detained 444 Brigade Commander Mahmoud Hamza at Mitiga VIP terminal, sparking southern Tripoli urban clashes.",
          related_entities: ["Mahmoud Hamza", "444 Combat Brigade", "Mitiga International Airbase Complex"],
          source: "UNSMIL Special Situation Report No. 44",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-002-7",
          date: "2023-08-16",
          date_precision: "exact",
          title: "Acceptance of Tripoli Security Truce",
          event_type: "Ceasefire / Truce",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Agreed to elder mediation conditions transferring Hamza to neutral SSA custody and restoring joint boundary protocols around Mitiga.",
          related_entities: ["Tripoli Security Truce", "Stability Support Apparatus (SSA)", "444 Combat Brigade"],
          source: "Government Joint Operations Room",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
    },
    {
      id: "R2D-003",
      title: "Mahmoud Hamza",
      entity_type: "Commander",
      regions: ["West"],
      tags: ["444 Brigade", "Tripoli", "Military", "Salah al-Din", "Militia Commander"],
      affiliations: ["444 Combat Brigade", "Ministry of Defense"],
      rivalries: ["Special Deterrence Forces (Rada)"],
      summary:
        "Commander of the 444 Combat Brigade. Established one of Tripoli's most disciplined and combat-capable armed formations under the Ministry of Defense.",
      linked_events: ["Tripoli Security Truce"],
      dob: "1986",
      date_precision: "year",
      location: "Salah al-Din, Tripoli",
      coordinates: { lat: 32.8258, lng: 13.2081 },
      source: "Libyan Ministry of Defense / UNSMIL Security Working Group",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-003-1",
          date: "1986",
          date_precision: "year",
          title: "Birth in Tripoli",
          event_type: "Birth",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Born in Tripoli. Later received specialized tactical military and communications instruction.",
          related_entities: [],
          source: "Libyan Military Personnel Archives",
          source_date: "2020-03",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-003-2",
          date: "2016-03",
          date_precision: "month",
          title: "Tactical Operations in Rada Apparatus",
          event_type: "Security",
          location: "Mitiga Airbase, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Served as field tactical commander within Rada, leading precision counter-kidnapping and high-risk interdiction raids.",
          related_entities: ["Abdul Rauf Kara", "Special Deterrence Forces (Rada)"],
          source: "UNSMIL Field Monitoring",
          source_date: "2018-02",
          confidence: "Verified",
          related_record_id: "R2D-002",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-003-3",
          date: "2020-02-14",
          date_precision: "exact",
          title: "Establishment of 444 Combat Brigade",
          event_type: "Formation",
          location: "Salah al-Din, Tripoli",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "Separated from previous command structures to found the 20-20 Battalion, subsequently chartered as the 444 Combat Brigade under Tripoli Military Zone.",
          related_entities: ["444 Combat Brigade"],
          source: "Ministry of Defense Decree 214/2020",
          source_date: "2020-02-14",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-003-4",
          date: "2021-06-18",
          date_precision: "exact",
          title: "Anti-Smuggling Sweeps in Tarhuna & Bani Walid Corridors",
          event_type: "Military",
          location: "Tarhuna & Bani Walid, Western Libya",
          coordinates: { lat: 32.4350, lng: 13.6332 },
          description: "Directed major armored sweep disrupting human trafficking routes, weapons depots, and fuel contraband rings south of Tripoli.",
          related_entities: ["444 Combat Brigade"],
          source: "Libya Herald & Ministry of Defense Communiqué",
          source_date: "2021-06-20",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-003-5",
          date: "2022-08-27",
          date_precision: "exact",
          title: "Urban Buffer Mediation in Central Tripoli",
          event_type: "Ceasefire / Truce",
          location: "Central Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Positioned armored convoys along major civilian thoroughfares to halt skirmishes between armed factions, earning reputation as a stabilization force.",
          related_entities: ["444 Combat Brigade", "Presidential Council (PC)"],
          source: "UNSMIL Security Statements",
          source_date: "2022-08-28",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-003-6",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Mitiga Airport Detention Crisis",
          event_type: "Detention / Release",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Detained by Rada units while en route to a military graduation ceremony in Misrata, prompting 444 Brigade forces to mobilize across southern districts.",
          related_entities: ["Abdul Rauf Kara", "Special Deterrence Forces (Rada)", "Mitiga International Airbase Complex", "Tripoli Security Truce"],
          source: "UNSMIL Press Bulletin",
          source_date: "2023-08-14",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-003-7",
          date: "2023-08-16",
          date_precision: "exact",
          title: "Transfer, Release & Truce Implementation",
          event_type: "Detention / Release",
          location: "Salah al-Din Headquarters, Tripoli",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "Transferred via neutral SSA custody back to 444 Brigade command barracks, formally solidifying the Tripoli Security Truce.",
          related_entities: ["Stability Support Apparatus (SSA)", "Tripoli Security Truce", "444 Combat Brigade"],
          source: "Ministry of Interior Verification Note",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
    },
    {
      id: "R2D-004",
      title: "444 Combat Brigade",
      entity_type: "Armed Group",
      regions: ["West"],
      tags: ["Tripoli", "Infantry", "Military", "Checkpoint Security", "Combat Brigade"],
      affiliations: ["Mahmoud Hamza", "Ministry of Defense"],
      rivalries: ["Special Deterrence Forces (Rada)", "Stability Support Apparatus (SSA)"],
      summary:
        "High-readiness military combat brigade headquartered in southern Tripoli. Deployed across strategic corridors connecting Tripoli, Bani Walid, and Tarhuna to deter illicit trafficking.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2020-02-14",
      is_ongoing: true,
      date_precision: "exact",
      location: "Salah al-Din, Tripoli, Libya",
      coordinates: { lat: 32.8258, lng: 13.2081 },
      source: "Ministry of Defense Technical Reports & UNSMIL Monitoring",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-004-1",
          date: "2020-02-14",
          date_precision: "exact",
          title: "Formal Constitution of the Brigade",
          event_type: "Formation",
          location: "Salah al-Din, Tripoli",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "Officially chartered under Tripoli Military Zone command with unified uniforms, standardized armor, and formal military drill standards.",
          related_entities: ["Mahmoud Hamza"],
          source: "Libyan General Staff Decree",
          source_date: "2020-02-14",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-004-2",
          date: "2021-04-10",
          date_precision: "month",
          title: "Southern Tripoli Checkpoint Grid Integration",
          event_type: "Security",
          location: "Ain Zara & Salah al-Din, Tripoli",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "Took over major highway entry points into southern Tripoli, significantly reducing carjackings and unauthorized armed militia movement.",
          related_entities: ["Mahmoud Hamza"],
          source: "Ministry of Interior Crime Assessment",
          source_date: "2021-05",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-004-3",
          date: "2021-11-25",
          date_precision: "exact",
          title: "Operation Desert Barrier in Tarhuna Hinterlands",
          event_type: "Military",
          location: "Tarhuna & Bani Walid, Libya",
          coordinates: { lat: 32.4350, lng: 13.6332 },
          description: "Seized 14 illegal oil depots and intercepted contraband fuel caravans headed for trans-Sahara trade routes.",
          related_entities: ["Mahmoud Hamza"],
          source: "Libyan Attorney General Office Statement",
          source_date: "2021-11-27",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-004-4",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Heavy Urban Standoff in Ain Zara and Salah al-Din",
          event_type: "Clash / Conflict",
          location: "Ain Zara, Southern Tripoli",
          coordinates: { lat: 32.8400, lng: 13.2400 },
          description: "Deployed armored units in response to Commander Hamza's detention at Mitiga, resulting in 48 hours of intense urban confrontation.",
          related_entities: ["Special Deterrence Forces (Rada)", "Mahmoud Hamza", "Tripoli Security Truce"],
          source: "UNSMIL Conflict Monitoring Group",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-004-5",
          date: "2023-08-16",
          date_precision: "exact",
          title: "Ceasefire Re-basing & Truce Implementation",
          event_type: "Ceasefire / Truce",
          location: "Salah al-Din, Tripoli",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "Completed full withdrawal from active fighting positions to barracks upon reception of commander, observing truce demarcation.",
          related_entities: ["Tripoli Security Truce", "Mahmoud Hamza"],
          source: "Libyan Presidential Council Security Directorate",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "end"
        }
      ]
    },
    {
      id: "R2D-005",
      title: "Special Deterrence Forces (Rada)",
      entity_type: "Militia",
      regions: ["West"],
      tags: ["Tripoli", "Salafist", "Detention", "Mitiga", "Militia"],
      affiliations: ["Abdul Rauf Kara", "Mitiga Airport Authority"],
      rivalries: ["Dar al-Ifta", "444 Combat Brigade", "Tajoura Lions Battalion"],
      summary:
        "Powerful armed militia controlling Mitiga International Airport and surrounding Souq al-Jumaa district. Operates counter-crime units and secure detention centers.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2012-04-10",
      is_ongoing: true,
      date_precision: "month",
      location: "Mitiga Airbase & Souq al-Jumaa, Tripoli",
      coordinates: { lat: 32.8953, lng: 13.2783 },
      source: "Ministry of Interior & UNSMIL Sanctions Committee Reports",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-005-1",
          date: "2012-04-10",
          date_precision: "month",
          title: "Establishment in Eastern Tripoli",
          event_type: "Formation",
          location: "Souq al-Jumaa, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Emerged out of revolutionary neighbourhood committees to spearhead anti-crime and sharia policing in eastern Tripoli.",
          related_entities: ["Abdul Rauf Kara"],
          source: "Ministry of Interior Records",
          source_date: "2012-05",
          confidence: "Verified",
          related_record_id: "R2D-002",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-005-2",
          date: "2014-07-28",
          date_precision: "exact",
          title: "Mitiga Strategic Hub Consolidation",
          event_type: "Infrastructure",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Took permanent custody of Mitiga Airbase, creating central detention facilities, weapons armories, and air traffic perimeter controls.",
          related_entities: ["Mitiga International Airbase Complex", "Abdul Rauf Kara"],
          source: "UNSMIL Infrastructure Brief",
          source_date: "2014-08",
          confidence: "Verified",
          related_record_id: "R2D-016",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-005-3",
          date: "2018-09-01",
          date_precision: "exact",
          title: "GNA Presidential Decree Integration",
          event_type: "Appointment",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Formal restructuring under Decree 555 granting statutory authority over national security detention and electronic surveillance.",
          related_entities: ["Presidential Council (PC)", "Abdul Rauf Kara"],
          source: "Official Gazette of Libya",
          source_date: "2018-09-01",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-005-4",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Escalation at Mitiga VIP Terminal",
          event_type: "Clash / Conflict",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Detention of 444 Brigade leader sparked intense fighting against 444 columns along the Ain Zara border line.",
          related_entities: ["Mahmoud Hamza", "444 Combat Brigade", "Mitiga International Airbase Complex"],
          source: "Emergency Medical Center Report",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-005-5",
          date: "2023-08-16",
          date_precision: "exact",
          title: "Truce Resolution & Demarcation Accord",
          event_type: "Ceasefire / Truce",
          location: "Souq al-Jumaa & Mitiga, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Implemented mediated truce conditions, handing over Hamza to SSA and normalizing access to Mitiga Airport facilities.",
          related_entities: ["Tripoli Security Truce", "Stability Support Apparatus (SSA)", "Mahmoud Hamza"],
          source: "UNSMIL Press Statement",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "end"
        }
      ]
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
      dob: "1962-08-20",
      date_precision: "exact",
      location: "Misrata, Libya",
      coordinates: { lat: 32.3754, lng: 15.0925 },
      source: "Government Gazette & High National Election Commission",
      source_date: "2023-04",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-006-1",
          date: "1962-08-20",
          date_precision: "exact",
          title: "Birth in Misrata",
          event_type: "Birth",
          location: "Misrata, Libya",
          coordinates: { lat: 32.3754, lng: 15.0925 },
          description: "Born in Misrata. Graduated from Misrata Air College as an aviation officer.",
          related_entities: [],
          source: "Official Biography & Electoral Dossier",
          source_date: "2021-11",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-006-2",
          date: "2011-03",
          date_precision: "month",
          title: "Misrata Military Council Logistics Head",
          event_type: "Military",
          location: "Misrata, Libya",
          coordinates: { lat: 32.3754, lng: 15.0925 },
          description: "Coordinated maritime and overland supply chains defending Misrata during the siege of the city.",
          related_entities: [],
          source: "Revolutionary Archive",
          source_date: "2011-08",
          confidence: "Verified",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-006-3",
          date: "2018-10-07",
          date_precision: "exact",
          title: "Appointed GNA Minister of Interior",
          event_type: "Appointment",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Named Minister of Interior by Presidential Council Prime Minister Fayez al-Sarraj, initiating major institutional security reforms.",
          related_entities: ["Presidential Council (PC)"],
          source: "Libyan Official Gazette",
          source_date: "2018-10-07",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-006-4",
          date: "2020-05-15",
          date_precision: "month",
          title: "Implementation of Security Sector Reform Strategy",
          event_type: "Political Decision",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Launched program to register and integrate armed militias into formal police and interior security branches.",
          related_entities: [],
          source: "Ministry of Interior Strategy Whitepaper",
          source_date: "2020-05",
          confidence: "Verified",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-006-5",
          date: "2022-02-10",
          date_precision: "exact",
          title: "Designation as Prime Minister by House of Representatives",
          event_type: "Appointment",
          location: "Tobruk, Libya",
          coordinates: { lat: 32.0770, lng: 23.9764 },
          description: "Voted Prime Minister of the Government of National Stability (GNS) by the House of Representatives in Tobruk.",
          related_entities: [],
          source: "House of Representatives Resolution Record",
          source_date: "2022-02-10",
          confidence: "Verified",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-006-6",
          date: "2022-05-17",
          date_precision: "exact",
          title: "Tripoli Entry Attempt & Peaceful Withdrawal",
          event_type: "Clash / Conflict",
          location: "Central Tripoli & Sirte",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Entered Tripoli to assume office, but withdrew to Sirte within hours after armed skirmishes broke out to avert full-scale civil conflict.",
          related_entities: ["Special Deterrence Forces (Rada)", "444 Combat Brigade"],
          source: "UNSMIL Briefing to Security Council",
          source_date: "2022-05-20",
          confidence: "Verified",
          is_major: true,
          stage: "development"
        }
      ]
    },
    {
      id: "R2D-007",
      title: "Stability Support Apparatus (SSA)",
      entity_type: "Militia",
      regions: ["West"],
      tags: ["Abu Salim", "Gheniwa", "Paramilitary", "Tripoli", "Militia"],
      affiliations: ["Abdelghani al-Kikli", "Presidential Council (PC)"],
      rivalries: ["444 Combat Brigade", "Nawasi Brigade"],
      summary:
        "Well-funded paramilitary militia established by Presidential Council decree, centered in the strategic Abu Salim district of southern Tripoli.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2021-01-18",
      is_ongoing: true,
      date_precision: "exact",
      location: "Abu Salim, Tripoli, Libya",
      coordinates: { lat: 32.8461, lng: 13.1764 },
      source: "Official Gazette of the Presidency Council",
      source_date: "2023-08",
      confidence: "High",
      updated_at: now,
      chronology: [
        {
          id: "TM-007-1",
          date: "2021-01-18",
          date_precision: "exact",
          title: "Created by Presidential Council Decree 38",
          event_type: "Formation",
          location: "Abu Salim, Tripoli",
          coordinates: { lat: 32.8461, lng: 13.1764 },
          description: "Established as an autonomous security agency reporting directly to the head of the Presidential Council, headed by Abdelghani al-Kikli.",
          related_entities: ["Presidential Council (PC)"],
          source: "Official Gazette of Libya",
          source_date: "2021-01-18",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-007-2",
          date: "2022-06-10",
          date_precision: "month",
          title: "Territorial Extension to Western Border Zones",
          event_type: "Security",
          location: "Ras Ajdir & Western Border Corridor",
          coordinates: { lat: 33.1465, lng: 11.5647 },
          description: "Deployed specialized enforcement units towards border crossings along the Tunisian frontier to regulate commercial and security traffic.",
          related_entities: [],
          source: "Border Security Assessment",
          source_date: "2022-07",
          confidence: "High",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-007-3",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Intermediary Guarantor in Tripoli Clashes",
          event_type: "Ceasefire / Truce",
          location: "Abu Salim, Tripoli",
          coordinates: { lat: 32.8461, lng: 13.1764 },
          description: "Designated as the neutral guarantor receiving custody of Mahmoud Hamza from Rada, unlocking the agreement on the Tripoli Security Truce.",
          related_entities: ["Mahmoud Hamza", "Abdul Rauf Kara", "Tripoli Security Truce"],
          source: "UNSMIL Special Monitoring Release",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "turning_point"
        }
      ]
    },
    {
      id: "R2D-008",
      title: "111 Brigade",
      entity_type: "Armed Group",
      regions: ["West"],
      tags: ["Tripoli", "Misrata", "Heavy Armor", "Airport Road", "Armed Group"],
      affiliations: ["Abdelsalam Zoubi", "Ministry of Defense"],
      rivalries: ["Stability Support Apparatus (SSA)"],
      summary:
        "Armed group with roots in Misrata Halboos brigade, securing critical infrastructure along the Tripoli Airport Road and western approaches.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2019-05-01",
      is_ongoing: true,
      date_precision: "month",
      location: "Airport Road, Tripoli, Libya",
      coordinates: { lat: 32.8100, lng: 13.1500 },
      source: "Libyan Joint Operations Room & Ministry of Defense",
      source_date: "2023-08",
      confidence: "High",
      updated_at: now,
      chronology: [
        {
          id: "TM-008-1",
          date: "2019-05-01",
          date_precision: "month",
          title: "Reconstitution as 111 Brigade",
          event_type: "Formation",
          location: "Airport Road, Tripoli",
          coordinates: { lat: 32.8100, lng: 13.1500 },
          description: "Formed under Commander Abdelsalam Zoubi out of Misrata-affiliated Halboos mechanized battalions.",
          related_entities: ["Ministry of Defense"],
          source: "Joint Operations Room",
          source_date: "2019-05",
          confidence: "High",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-008-2",
          date: "2021-03-20",
          date_precision: "month",
          title: "Airport Reconstruction Zone Security Mandate",
          event_type: "Infrastructure",
          location: "Tripoli International Airport Perimeter",
          coordinates: { lat: 32.6694, lng: 13.1590 },
          description: "Assigned official responsibility for shielding civil reconstruction contractors rehabilitating passenger terminals.",
          related_entities: [],
          source: "Ministry of Transport Communiqué",
          source_date: "2021-04",
          confidence: "Verified",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-008-3",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Mechanized Buffer Deployment During Urban Fighting",
          event_type: "Ceasefire / Truce",
          location: "Airport Road Corridor, Tripoli",
          coordinates: { lat: 32.8100, lng: 13.1500 },
          description: "Dispatched armored vehicles to prevent spillover of fighting between 444 Brigade and Rada into western municipal quarters.",
          related_entities: ["Tripoli Security Truce", "444 Combat Brigade"],
          source: "Local Security Monitors",
          source_date: "2023-08-15",
          confidence: "High",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
    },
    {
      id: "R2D-009",
      title: "Khalifa Haftar",
      entity_type: "Commander",
      regions: ["East", "South"],
      tags: ["LNA", "Benghazi", "Field Marshal", "General Command", "Militia Commander"],
      affiliations: ["Libyan National Army (LNA)", "Tariq Ben Ziyad Brigade"],
      rivalries: ["Western Armed Groups", "Tripoli Security Coalition", "Dar al-Ifta"],
      summary:
        "Commander of the Libyan National Army (LNA), exercising operational control over security structures, airbases, and military divisions across eastern and southern Libya.",
      linked_events: ["5+5 Joint Military Commission Ceasefire"],
      dob: "1943-11-07",
      date_precision: "exact",
      location: "Al-Rajma, Benghazi, Libya",
      coordinates: { lat: 32.0624, lng: 20.2520 },
      source: "General Command of the LNA / International Crisis Group / UNSMIL",
      source_date: "2023-10",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-009-1",
          date: "1943-11-07",
          date_precision: "exact",
          title: "Birth in Ajdabiya",
          event_type: "Birth",
          location: "Ajdabiya, Eastern Libya",
          coordinates: { lat: 30.7554, lng: 20.2263 },
          description: "Born in Ajdabiya. Attended the Benghazi Royal Military Academy and received advanced staff college training in the Soviet Union and Egypt.",
          related_entities: [],
          source: "Official Military Biography",
          source_date: "2015-03",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-009-2",
          date: "2011-03-14",
          date_precision: "exact",
          title: "Return to Benghazi During Revolution",
          event_type: "Military",
          location: "Benghazi, Libya",
          coordinates: { lat: 32.1194, lng: 20.0868 },
          description: "Returned from exile to join the 17 February military committee commanding eastern insurgent units.",
          related_entities: [],
          source: "NTC War Records",
          source_date: "2011-04",
          confidence: "Verified",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-009-3",
          date: "2014-05-16",
          date_precision: "exact",
          title: "Launch of Operation Dignity in Benghazi",
          event_type: "Military",
          location: "Benghazi, Libya",
          coordinates: { lat: 32.1194, lng: 20.0868 },
          description: "Launched Operation Dignity against Islamist militia coalitions in Benghazi, consolidating command of eastern military units.",
          related_entities: ["Tariq Ben Ziyad Brigade"],
          source: "LNA General Command Declaration",
          source_date: "2014-05-16",
          confidence: "Verified",
          related_record_id: "R2D-010",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-009-4",
          date: "2016-09-11",
          date_precision: "exact",
          title: "Seizure of Oil Crescent Terminals",
          event_type: "Military",
          location: "Ras Lanuf & Es Sider, Sirte Basin",
          coordinates: { lat: 30.5000, lng: 18.5700 },
          description: "LNA units took control of the major Oil Crescent crude export terminals from PFG factions, reopening oil shipments under NOC management.",
          related_entities: ["Petroleum Facilities Guard (PFG)"],
          source: "National Oil Corporation Bulletin",
          source_date: "2016-09-12",
          confidence: "Verified",
          related_record_id: "R2D-014",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-009-5",
          date: "2019-04-04",
          date_precision: "exact",
          title: "Launch of Western Libya Military Offensive",
          event_type: "Clash / Conflict",
          location: "Tripoli Approaches & Southern Suburbs",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Ordered LNA brigades to advance towards southern Tripoli, inaugurating 14 months of sustained armed conflict in the capital region.",
          related_entities: ["444 Combat Brigade", "Special Deterrence Forces (Rada)"],
          source: "UNSMIL Security Council Report",
          source_date: "2019-04-06",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-009-6",
          date: "2020-06-05",
          date_precision: "exact",
          title: "End of Tripoli Campaign & Sirte-Jufra Consolidation",
          event_type: "Military",
          location: "Sirte-Jufra Line, Central Libya",
          coordinates: { lat: 31.2089, lng: 16.5887 },
          description: "Completed tactical redeployment eastward, anchoring fortified defense line across the Sirte-Jufra central axis.",
          related_entities: ["Tariq Ben Ziyad Brigade"],
          source: "International Crisis Group Analysis",
          source_date: "2020-06-10",
          confidence: "Verified",
          related_record_id: "R2D-010",
          is_major: true,
          stage: "turning_point"
        },
        {
          id: "TM-009-7",
          date: "2020-10-23",
          date_precision: "exact",
          title: "Signing of 5+5 Geneva Permanent Ceasefire Agreement",
          event_type: "Ceasefire / Truce",
          location: "Palais des Nations, Geneva, Switzerland",
          coordinates: { lat: 46.2237, lng: 6.1399 },
          description: "Delegates representing Haftar's General Command co-signed the permanent nationwide ceasefire sponsored by the United Nations.",
          related_entities: ["Presidential Council (PC)"],
          source: "United Nations Official Document S/2020/1043",
          source_date: "2020-10-23",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "de_escalation"
        },
        {
          id: "TM-009-8",
          date: "2023-08-25",
          date_precision: "month",
          title: "Southern Border Enforcement Operations",
          event_type: "Security",
          location: "Fezzan & Murzuq Basin, Southern Libya",
          coordinates: { lat: 25.9155, lng: 13.9184 },
          description: "Ordered Tariq Ben Ziyad and southern divisions to launch border interdiction sweeps along Chad and Niger border tracks.",
          related_entities: ["Tariq Ben Ziyad Brigade"],
          source: "LNA Media Department Communiqué",
          source_date: "2023-08-26",
          confidence: "High",
          related_record_id: "R2D-010",
          is_major: false,
          stage: "ongoing"
        }
      ]
    },
    {
      id: "R2D-010",
      title: "Tariq Ben Ziyad Brigade",
      entity_type: "Armed Group",
      regions: ["East", "South"],
      tags: ["LNA", "Ground Forces", "Specialized Units", "Benghazi", "Armed Group"],
      affiliations: ["Khalifa Haftar", "LNA General Command"],
      rivalries: ["Chadian Rebel Formations", "Anti-LNA Coalitions"],
      summary:
        "Primary frontline armed brigade of the LNA, heavily equipped with armored vehicles and tasked with high-profile security operations and border patrol in the south.",
      linked_events: ["5+5 Joint Military Commission Ceasefire"],
      start_date: "2016-08-10",
      is_ongoing: true,
      date_precision: "exact",
      location: "Benghazi & Sebha, Libya",
      coordinates: { lat: 32.1194, lng: 20.0868 },
      source: "LNA General Command & Regional Conflict Monitors",
      source_date: "2023-09",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-010-1",
          date: "2016-08-10",
          date_precision: "exact",
          title: "Brigade Activation in Benghazi",
          event_type: "Formation",
          location: "Benghazi, Eastern Libya",
          coordinates: { lat: 32.1194, lng: 20.0868 },
          description: "Activated as an elite motorized assault unit under direct supervision of the LNA General Command.",
          related_entities: ["Khalifa Haftar"],
          source: "LNA Orders of the Day",
          source_date: "2016-08-10",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-010-2",
          date: "2019-01-20",
          date_precision: "month",
          title: "Operation Southern Anger & Oilfield Securing",
          event_type: "Military",
          location: "Sharara Oilfield & Sebha, Fezzan",
          coordinates: { lat: 26.8278, lng: 12.3167 },
          description: "Led the vanguard in taking control of Sebha airbase and securing Sharara and El Feel oil fields in southwestern Libya.",
          related_entities: ["Petroleum Facilities Guard (PFG)", "Khalifa Haftar"],
          source: "UNSMIL Humanitarian and Conflict Update",
          source_date: "2019-02",
          confidence: "Verified",
          related_record_id: "R2D-014",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-010-3",
          date: "2020-10-23",
          date_precision: "exact",
          title: "Sirte Demarcation Line Garrison",
          event_type: "Ceasefire / Truce",
          location: "Sirte, Central Libya",
          coordinates: { lat: 31.2089, lng: 16.5887 },
          description: "Stationed as the main armed formation holding eastern approaches in compliance with the 5+5 ceasefire agreement.",
          related_entities: ["Khalifa Haftar", "Presidential Council (PC)"],
          source: "5+5 Joint Military Commission Logbook",
          source_date: "2020-11",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-010-4",
          date: "2023-08-25",
          date_precision: "exact",
          title: "Air and Ground Sweeps on Southern Border",
          event_type: "Security",
          location: "Tibesti Border Region, Southern Libya",
          coordinates: { lat: 21.0000, lng: 17.5000 },
          description: "Conducted joint mechanized and air strikes expelling armed mercenary elements along the Chadian frontier.",
          related_entities: ["Khalifa Haftar"],
          source: "LNA Defense Statement",
          source_date: "2023-08-27",
          confidence: "High",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "ongoing"
        }
      ]
    },
    {
      id: "R2D-011",
      title: "Sadiq al-Ghariani",
      entity_type: "Person",
      regions: ["West"],
      tags: ["Grand Mufti", "Dar al-Ifta", "Cleric", "Religious Leadership"],
      affiliations: ["Dar al-Ifta", "Tajoura Lions Battalion"],
      rivalries: ["Special Deterrence Forces (Rada)", "LNA"],
      summary:
        "Grand Mufti of Libya leading Dar al-Ifta, issuing binding religious fatwas and maintaining direct ideological influence over conservative revolutionary armed groups.",
      linked_events: ["Tripoli Security Truce"],
      dob: "1942-12-08",
      date_precision: "exact",
      location: "Tajoura, Tripoli, Libya",
      coordinates: { lat: 32.8800, lng: 13.3400 },
      source: "Dar al-Ifta Official Records & GNC Archives",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-011-1",
          date: "1942-12-08",
          date_precision: "exact",
          title: "Birth in Tajoura",
          event_type: "Birth",
          location: "Tajoura, Tripoli, Libya",
          coordinates: { lat: 32.8800, lng: 13.3400 },
          description: "Born in Tajoura. Earned doctorate in Islamic Sharia law from Al-Azhar University in Cairo.",
          related_entities: [],
          source: "Official Faculty and Academic Records",
          source_date: "2012-02",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-011-2",
          date: "2012-02-20",
          date_precision: "exact",
          title: "Appointed Grand Mufti of Libya",
          event_type: "Appointment",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Named Grand Mufti of the Libyan Republic by National Transitional Council decree.",
          related_entities: ["Dar al-Ifta"],
          source: "NTC Gazette No. 15",
          source_date: "2012-02-20",
          confidence: "Verified",
          related_record_id: "R2D-001",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-011-3",
          date: "2014-07-15",
          date_precision: "exact",
          title: "Western Coalitions Endorsement",
          event_type: "Political Decision",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Issued religious guidance aligning revolutionary units in Tajoura and Misrata to safeguard post-revolutionary constitutional institutions.",
          related_entities: ["Tajoura Lions Battalion", "Dar al-Ifta"],
          source: "Tanasuh TV Transcript",
          source_date: "2014-07-16",
          confidence: "Verified",
          related_record_id: "R2D-013",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-011-4",
          date: "2019-04-06",
          date_precision: "exact",
          title: "Fatwa Calling for General Defense of Tripoli",
          event_type: "Mobilization",
          location: "Tajoura, Tripoli",
          coordinates: { lat: 32.8800, lng: 13.3400 },
          description: "Condemned the LNA western offensive and instructed affiliated armed factions to commit all available logistical resources to capital defense.",
          related_entities: ["Khalifa Haftar", "Dar al-Ifta"],
          source: "Dar al-Ifta Communiqué",
          source_date: "2019-04-06",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-011-5",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Admonition & Call for Peaceful Resolution in Tripoli",
          event_type: "Ceasefire / Truce",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Urged immediate halt to intra-Tripoli bloodshed and supported municipal mediation to liberate Hamza and pacify Ain Zara.",
          related_entities: ["Tripoli Security Truce", "Mahmoud Hamza", "Abdul Rauf Kara"],
          source: "Dar al-Ifta Statement Archive",
          source_date: "2023-08-15",
          confidence: "High",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
    },
    {
      id: "R2D-012",
      title: "Oussama al-Juweili",
      entity_type: "Commander",
      regions: ["West"],
      tags: ["Zintan", "Western Military Zone", "Major General", "Militia Commander"],
      affiliations: ["Zintan Military Council"],
      rivalries: ["GNU Government"],
      summary:
        "Major General from Zintan and former commander of the Western Military Zone. Retains decisive influence among armed forces in the Nafusa Mountains and Zintan.",
      linked_events: [],
      dob: "1961-04-15",
      date_precision: "exact",
      location: "Zintan, Nafusa Mountains, Libya",
      coordinates: { lat: 31.9317, lng: 12.2533 },
      source: "Western Military Command & UNSMIL Reports",
      source_date: "2023-06",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-012-1",
          date: "1961-04-15",
          date_precision: "exact",
          title: "Birth in Zintan",
          event_type: "Birth",
          location: "Zintan, Nafusa Mountains, Libya",
          coordinates: { lat: 31.9317, lng: 12.2533 },
          description: "Born in Zintan. Graduated from Tripoli Military College in 1982.",
          related_entities: [],
          source: "Libyan Military College Register",
          source_date: "2011-12",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-012-2",
          date: "2011-11-22",
          date_precision: "exact",
          title: "Appointed Minister of Defense",
          event_type: "Appointment",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Appointed Minister of Defense in the transitional cabinet of Prime Minister Abdurrahim El-Keib.",
          related_entities: [],
          source: "NTC Decree Record",
          source_date: "2011-11-22",
          confidence: "Verified",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-012-3",
          date: "2017-06-04",
          date_precision: "exact",
          title: "Appointed Commander of the Western Military Zone",
          event_type: "Appointment",
          location: "Zintan / Tripoli",
          coordinates: { lat: 31.9317, lng: 12.2533 },
          description: "Designated Commander of the Western Military Zone by Presidential Council decree, consolidating western border security.",
          related_entities: ["Presidential Council (PC)"],
          source: "Official Gazette of Libya",
          source_date: "2017-06-04",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-012-4",
          date: "2020-05-18",
          date_precision: "exact",
          title: "Recapture of Al-Watiya Strategic Airbase",
          event_type: "Military",
          location: "Al-Watiya Airbase, Western Libya",
          coordinates: { lat: 31.9961, lng: 11.5978 },
          description: "Operational commander overseeing the joint western forces operation regaining control of Al-Watiya Airbase.",
          related_entities: [],
          source: "UNSMIL Military Analysis",
          source_date: "2020-05-20",
          confidence: "Verified",
          is_major: true,
          stage: "turning_point"
        },
        {
          id: "TM-012-5",
          date: "2022-05-17",
          date_precision: "exact",
          title: "Southwest Tripoli Tactical Mobilization",
          event_type: "Military",
          location: "Suani & Janzour, Southwest Tripoli",
          coordinates: { lat: 32.7483, lng: 13.0658 },
          description: "Positioned armored convoys along southwestern access points during political negotiations, later agreeing to stand down.",
          related_entities: ["Fathi Bashagha"],
          source: "Local Security Reports",
          source_date: "2022-05-18",
          confidence: "Verified",
          related_record_id: "R2D-006",
          is_major: false,
          stage: "development"
        }
      ]
    },
    {
      id: "R2D-013",
      title: "Tajoura Lions Battalion",
      entity_type: "Militia",
      regions: ["West"],
      tags: ["Tajoura", "Coastal Route", "Militia", "East Gate"],
      affiliations: ["Dar al-Ifta", "Sadiq al-Ghariani"],
      rivalries: ["Special Deterrence Forces (Rada)"],
      summary:
        "Armed militia controlling the eastern coastal gateway of Tripoli through Tajoura, maintaining ideological alignment with Dar al-Ifta.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "2012-01-15",
      is_ongoing: true,
      date_precision: "month",
      location: "Tajoura, Eastern Tripoli, Libya",
      coordinates: { lat: 32.8800, lng: 13.3400 },
      source: "Local Municipal Council & Tripoli Security Reports",
      source_date: "2023-08",
      confidence: "High",
      updated_at: now,
      chronology: [
        {
          id: "TM-013-1",
          date: "2012-01-15",
          date_precision: "month",
          title: "Battalion Formalization in Tajoura",
          event_type: "Formation",
          location: "Tajoura, Eastern Tripoli",
          coordinates: { lat: 32.8800, lng: 13.3400 },
          description: "Consolidated local revolutionary combatants to safeguard coastal arterial highways into Tripoli.",
          related_entities: ["Dar al-Ifta"],
          source: "Municipal Records",
          source_date: "2012-02",
          confidence: "High",
          related_record_id: "R2D-001",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-013-2",
          date: "2022-08-27",
          date_precision: "exact",
          title: "Defense of Eastern Coastal Access",
          event_type: "Security",
          location: "Tajoura Coastal Road, Tripoli",
          coordinates: { lat: 32.8800, lng: 13.3400 },
          description: "Erected checkpoints blocking incoming armed formations from advancing past Tajoura towards central ministries.",
          related_entities: ["Dar al-Ifta"],
          source: "Tripoli Operations Room",
          source_date: "2022-08-28",
          confidence: "High",
          related_record_id: "R2D-001",
          is_major: false,
          stage: "development"
        },
        {
          id: "TM-013-3",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Border Security Demarcation with Mitiga Perimeter",
          event_type: "Ceasefire / Truce",
          location: "Tajoura-Souq al-Jumaa Border",
          coordinates: { lat: 32.8872, lng: 13.3100 },
          description: "Maintained defensive containment ensuring that clashes between Rada and 444 Brigade did not widen into the Tajoura municipal zone.",
          related_entities: ["Tripoli Security Truce", "Special Deterrence Forces (Rada)"],
          source: "Local Elders Mediation Council",
          source_date: "2023-08-16",
          confidence: "High",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "de_escalation"
        }
      ]
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
      linked_events: ["5+5 Joint Military Commission Ceasefire"],
      start_date: "2012-10-24",
      is_ongoing: true,
      date_precision: "exact",
      location: "Oil Crescent, Ras Lanuf, Es Sider, Sharara",
      coordinates: { lat: 30.5000, lng: 18.5700 },
      source: "National Oil Corporation (NOC) Official Bulletins & Ministry of Defense",
      source_date: "2023-09",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-014-1",
          date: "2012-10-24",
          date_precision: "exact",
          title: "Legislative Foundation of the PFG",
          event_type: "Formation",
          location: "Tripoli & Ras Lanuf, Libya",
          coordinates: { lat: 30.5000, lng: 18.5700 },
          description: "Created by Ministry of Defense decree as a dedicated paramilitary protection apparatus for energy infrastructure.",
          related_entities: ["National Oil Corporation (NOC)"],
          source: "General National Congress Decree 42",
          source_date: "2012-10-24",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-014-2",
          date: "2016-09-11",
          date_precision: "exact",
          title: "Oil Crescent Ports Security Re-alignment",
          event_type: "Military",
          location: "Es Sider, Ras Lanuf, Zueitina",
          coordinates: { lat: 30.6333, lng: 18.3500 },
          description: "Command reorganization across eastern oil export terminals following deployment of LNA divisions.",
          related_entities: ["Khalifa Haftar"],
          source: "NOC Chairman Communiqué",
          source_date: "2016-09-12",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-014-3",
          date: "2020-09-18",
          date_precision: "exact",
          title: "Lifting of Oil Blockades & Re-opening Protocols",
          event_type: "Political Decision",
          location: "Brega Terminal & Sharara Field",
          coordinates: { lat: 30.4100, lng: 19.5700 },
          description: "Reached comprehensive agreement enabling resumption of crude exports and depoliticization of oil terminal security.",
          related_entities: ["Presidential Council (PC)", "Khalifa Haftar"],
          source: "UNSMIL Economic Working Group",
          source_date: "2020-09-19",
          confidence: "Verified",
          related_record_id: "R2D-015",
          is_major: true,
          stage: "turning_point"
        }
      ]
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
      linked_events: ["5+5 Joint Military Commission Ceasefire", "Tripoli Security Truce"],
      start_date: "2021-02-05",
      is_ongoing: true,
      date_precision: "exact",
      location: "Tripoli, Libya",
      coordinates: { lat: 32.8872, lng: 13.1913 },
      source: "United Nations Support Mission in Libya (UNSMIL) LPDF Geneva Records",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-015-1",
          date: "2021-02-05",
          date_precision: "exact",
          title: "Election of Presidential Council in Geneva",
          event_type: "Formation",
          location: "Geneva, Switzerland",
          coordinates: { lat: 46.2237, lng: 6.1399 },
          description: "Elected by the 75-member Libyan Political Dialogue Forum (LPDF) mediated by UNSMIL in Geneva, headed by Mohamed al-Menfi.",
          related_entities: [],
          source: "UNSMIL Geneva Declaration",
          source_date: "2021-02-05",
          confidence: "Verified",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-015-2",
          date: "2021-03-15",
          date_precision: "exact",
          title: "Constitutional Swearing-In in Tobruk",
          event_type: "Appointment",
          location: "Tobruk, Libya",
          coordinates: { lat: 32.0770, lng: 23.9764 },
          description: "Formally sworn into office before the House of Representatives, assuming authority as Supreme Commander of the Libyan Army.",
          related_entities: [],
          source: "House of Representatives Record",
          source_date: "2021-03-15",
          confidence: "Verified",
          is_major: true,
          stage: "development"
        },
        {
          id: "TM-015-3",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Supreme Commander Intervention in Tripoli Clashes",
          event_type: "Ceasefire / Truce",
          location: "Tripoli, Libya",
          coordinates: { lat: 32.8872, lng: 13.1913 },
          description: "Convened emergency military council to compel cease of armed hostilities, sponsoring the Tripoli Security Truce between 444 and Rada.",
          related_entities: ["Tripoli Security Truce", "Mahmoud Hamza", "Abdul Rauf Kara", "Stability Support Apparatus (SSA)"],
          source: "Presidential Council Communiqué",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "turning_point"
        }
      ]
    },
    {
      id: "R2D-016",
      title: "Mitiga International Airbase Complex",
      entity_type: "Location",
      regions: ["West"],
      tags: ["Airfield", "Detention Center", "East Tripoli", "Strategic Site"],
      affiliations: ["Special Deterrence Forces (Rada)", "Abdul Rauf Kara"],
      rivalries: [],
      summary:
        "Strategic dual-use military airbase and commercial airport on the eastern perimeter of Tripoli, serving as Rada's command center and primary detention site.",
      linked_events: ["Tripoli Security Truce"],
      start_date: "1995-03-15",
      is_ongoing: true,
      date_precision: "month",
      location: "Mitiga, Eastern Tripoli, Libya",
      coordinates: { lat: 32.8953, lng: 13.2783 },
      source: "Libyan Civil Aviation Authority & UNSMIL Verification",
      source_date: "2023-08",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-016-1",
          date: "2014-07-28",
          date_precision: "exact",
          title: "Repurposing as Western Libya's Primary Commercial Airport",
          event_type: "Infrastructure",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Opened for international civil air routes following the destruction of Tripoli International Airport, guarded by Rada apparatus.",
          related_entities: ["Abdul Rauf Kara", "Special Deterrence Forces (Rada)"],
          source: "Civil Aviation Authority Notice",
          source_date: "2014-07-28",
          confidence: "Verified",
          related_record_id: "R2D-005",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-016-2",
          date: "2019-04-08",
          date_precision: "exact",
          title: "Military Airbase Aerial Targeting & Airspace Closure",
          event_type: "Clash / Conflict",
          location: "Mitiga Runway & Apron",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Targeted in air and artillery strikes during the 2019 Tripoli conflict, leading to recurrent flight suspensions and passenger diversions to Misrata.",
          related_entities: ["Khalifa Haftar", "Special Deterrence Forces (Rada)"],
          source: "UNSMIL Infrastructure Damage Log",
          source_date: "2019-04-09",
          confidence: "Verified",
          related_record_id: "R2D-009",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-016-3",
          date: "2023-08-14",
          date_precision: "exact",
          title: "VIP Terminal Detention Incident & Airfield Closure",
          event_type: "Clash / Conflict",
          location: "Mitiga Passenger VIP Terminal",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Detention of Mahmoud Hamza while boarding a flight sparked immediate airspace closure and evacuation of civilian airframes.",
          related_entities: ["Mahmoud Hamza", "Abdul Rauf Kara", "Tripoli Security Truce"],
          source: "Tripoli Airport Authority Statement",
          source_date: "2023-08-14",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-016-4",
          date: "2023-08-16",
          date_precision: "exact",
          title: "Reopening of Airspace Following Truce",
          event_type: "Infrastructure",
          location: "Mitiga International Airbase Complex",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Commercial operations resumed after armed forces withdrew and civil aviation inspectors certified runway security.",
          related_entities: ["Tripoli Security Truce"],
          source: "Civil Aviation Authority NOTAM",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-017",
          is_major: true,
          stage: "end"
        }
      ]
    },
    {
      id: "R2D-017",
      title: "Tripoli Security Truce",
      entity_type: "Event",
      regions: ["West"],
      tags: ["Ceasefire", "De-escalation", "Urban Mediation", "Tripoli", "Conflict"],
      affiliations: ["444 Combat Brigade", "Special Deterrence Forces (Rada)", "Stability Support Apparatus (SSA)", "Presidential Council (PC)"],
      rivalries: [],
      summary:
        "Mediated local security de-escalation in Tripoli following intense confrontations, establishing demarcation lines and joint deconfliction protocols.",
      linked_events: [],
      start_date: "2023-08-14",
      end_date: "2023-08-16",
      is_ongoing: false,
      date_precision: "exact",
      location: "Ain Zara, Salah al-Din, and Mitiga, Tripoli, Libya",
      coordinates: { lat: 32.8400, lng: 13.2400 },
      source: "UNSMIL Press Releases, Ministry of Interior, Emergency Medical Center (EMC)",
      source_date: "2023-08-17",
      confidence: "Verified",
      updated_at: now,
      chronology: [
        {
          id: "TM-017-1",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Start: Arrest of Mahmoud Hamza at Mitiga Airport",
          event_type: "Clash / Conflict",
          location: "Mitiga VIP Terminal, Tripoli",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Rada forces intercept and detain 444 Brigade Commander Mahmoud Hamza, provoking immediate armed alert and heavy vehicle mobilization.",
          related_entities: ["Mahmoud Hamza", "Abdul Rauf Kara", "444 Combat Brigade", "Special Deterrence Forces (Rada)", "Mitiga International Airbase Complex"],
          source: "UNSMIL Situation Flash",
          source_date: "2023-08-14",
          confidence: "Verified",
          related_record_id: "R2D-003",
          is_major: true,
          stage: "start"
        },
        {
          id: "TM-017-2",
          date: "2023-08-14",
          date_precision: "exact",
          title: "Escalation: Heavy Artillery & Street Clashes in Ain Zara",
          event_type: "Clash / Conflict",
          location: "Ain Zara & Al-Furnaj, Tripoli",
          coordinates: { lat: 32.8400, lng: 13.2400 },
          description: "Combat spreads across residential Ain Zara, Al-Sidra, and Al-Furnaj. Civilians trapped; medical emergency units request safe passage.",
          related_entities: ["444 Combat Brigade", "Special Deterrence Forces (Rada)"],
          source: "Tripoli Emergency Medical Center (EMC)",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "escalation"
        },
        {
          id: "TM-017-3",
          date: "2023-08-15",
          date_precision: "exact",
          title: "Turning Point: Elder Council & Presidential Mediation Accord",
          event_type: "Ceasefire / Truce",
          location: "Souq al-Jumaa & Abu Salim, Tripoli",
          coordinates: { lat: 32.8461, lng: 13.1764 },
          description: "Souq al-Jumaa elder council brokers handover of Hamza into neutral SSA custody, paving way for ceasefire agreement.",
          related_entities: ["Presidential Council (PC)", "Stability Support Apparatus (SSA)", "Dar al-Ifta"],
          source: "Ministry of Interior Official Communiqué",
          source_date: "2023-08-15",
          confidence: "Verified",
          related_record_id: "R2D-007",
          is_major: true,
          stage: "turning_point"
        },
        {
          id: "TM-017-4",
          date: "2023-08-16",
          date_precision: "exact",
          title: "De-escalation: Armor Pullback & Joint Patrol Deployment",
          event_type: "Ceasefire / Truce",
          location: "Salah al-Din & Ain Zara Corridors",
          coordinates: { lat: 32.8258, lng: 13.2081 },
          description: "444 Brigade and Rada units withdraw armored columns from contact zones; police directorate assumes buffer patrols.",
          related_entities: ["444 Combat Brigade", "Special Deterrence Forces (Rada)"],
          source: "Tripoli Security Directorate",
          source_date: "2023-08-16",
          confidence: "Verified",
          related_record_id: "R2D-004",
          is_major: true,
          stage: "de_escalation"
        },
        {
          id: "TM-017-5",
          date: "2023-08-16",
          date_precision: "exact",
          title: "End: Truce Formalized & Airspace Reopened",
          event_type: "Ceasefire / Truce",
          location: "Tripoli & Mitiga Airport",
          coordinates: { lat: 32.8953, lng: 13.2783 },
          description: "Full restoration of civilian traffic, return of Commander Hamza to headquarters, and resumption of scheduled flights at Mitiga.",
          related_entities: ["Mahmoud Hamza", "Mitiga International Airbase Complex"],
          source: "UNSMIL Formal Statement & Civil Aviation Authority",
          source_date: "2023-08-17",
          confidence: "Verified",
          related_record_id: "R2D-016",
          is_major: true,
          stage: "end"
        }
      ]
    }
  ];

  for (const rec of initialRecords) {
    const existing = await profilesCollection.findOne({ id: rec.id });
    if (existing) {
      await profilesCollection.replaceOne({ id: rec.id }, { ...existing, ...rec });
    } else {
      await profilesCollection.insertOne(rec);
    }
  }

  console.log("Comprehensive R2D intelligence profiles and chronological timelines seeded.");

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

  await db.collection<RiskRecord>("profiles").createIndex(
    { id: 1 },
    { unique: true }
  );
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
   * CLIENT AUTHORIZED ENTITY TIMELINE
   * ============================================================
   * Strict Authorization Enforcement:
   * 1. Validates client access key & expiration
   * 2. Validates target entity matches allowed_regions & allowed_types
   * 3. Queries related records strictly filtered by allowed_regions & allowed_types
   * 4. Multi-region support preserved on all returned milestones
   * 5. Logs access to accessLogs audit trail
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
      await db.collection<AccessLog>("accessLogs").insertOne({
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
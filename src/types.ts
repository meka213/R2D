export interface TimelineMilestone {
  id: string;
  entity_id: string;
  date: string;
  date_precision?: 'exact' | 'month' | 'year' | 'approximate';
  title: string;
  event_type: string;
  description: string;
  location?: string;
  regions: string[];
  coordinates?: { lat: number; lng: number };
  source_record_id?: string;
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

export interface ClientProfile {
  id: string;
  name: string;
  access_key: string;
  allowed_regions: string[];
  allowed_types: string[];
  expires_at: string;
}

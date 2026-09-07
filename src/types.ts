export interface TimelineMilestone {
  id: string;
  date: string; // YYYY, YYYY-MM, or YYYY-MM-DD
  date_precision?: 'exact' | 'month' | 'year' | 'approximate';
  title: string;
  event_type:
    | 'Birth'
    | 'Formation'
    | 'Military'
    | 'Political Decision'
    | 'Clash / Conflict'
    | 'Appointment'
    | 'Ceasefire / Truce'
    | 'Detention / Release'
    | 'Security'
    | 'Infrastructure'
    | 'Mobilization'
    | 'Death / Dissolution'
    | 'Affiliation'
    | 'Rivalry'
    | string;
  location?: string;
  regions?: string[];
  formatted_location?: string;
  duration?: string;
  coordinates?: { lat: number; lng: number };
  description: string;
  related_entities?: string[];
  source?: string;
  source_date?: string;
  confidence?: 'Verified' | 'High' | 'Medium' | 'Low' | 'Moderate' | 'Reported' | string;
  related_record_id?: string;
  record_id?: string;
  is_major?: boolean;
  stage?: 'start' | 'escalation' | 'turning_point' | 'de_escalation' | 'end' | 'development' | 'ongoing';
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
  confidence?: 'Verified' | 'High' | 'Medium' | 'Low';
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

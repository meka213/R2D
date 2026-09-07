import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Search,
  LogOut,
  MapPin,
  ChevronRight,
  Activity,
  Database,
  Lock,
  ArrowLeft,
  Users,
  AlertTriangle,
  CalendarDays,
  Tag,
  Network,
  User,
  ShieldAlert,
  Award,
  Building2,
  ChevronDown,
  X,
  Layers,
  Filter,
  Check
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  access_key: string;
  allowed_regions: string[];
  allowed_types: string[];
  expires_at: string;
}

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

export type DatabaseSection =
  | 'all'
  | 'person'
  | 'armed-group'
  | 'militia'
  | 'commander'
  | 'security-actor'
  | 'political'
  | 'location'
  | 'event';

export interface SectionConfig {
  id: DatabaseSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  entityTypes: string[];
  placeholder: string;
  description: string;
}

export const SECTION_CONFIGS: SectionConfig[] = [
  {
    id: 'all',
    label: 'All Sections',
    shortLabel: 'All',
    icon: Layers,
    accentColor: 'text-[#5b8def]',
    badgeBg: 'bg-[#1b2537]',
    badgeBorder: 'border-[#334668]',
    badgeText: 'text-[#9dbaff]',
    entityTypes: [],
    placeholder: 'Search all intelligence records, actors, locations, events...',
    description: 'Complete cross-database intelligence catalog'
  },
  {
    id: 'person',
    label: 'Person',
    shortLabel: 'Person',
    icon: User,
    accentColor: 'text-[#38bdf8]',
    badgeBg: 'bg-[#0f283d]',
    badgeBorder: 'border-[#1b4b72]',
    badgeText: 'text-[#7dd3fc]',
    entityTypes: ['Person', 'Individual', 'Key Individual', 'Political Figure', 'Cleric'],
    placeholder: 'Search persons, key figures, ministers, scholars...',
    description: 'Influential individuals, political figures, and scholars'
  },
  {
    id: 'armed-group',
    label: 'Armed Group',
    shortLabel: 'Armed Group',
    icon: Users,
    accentColor: 'text-[#fbbf24]',
    badgeBg: 'bg-[#31250d]',
    badgeBorder: 'border-[#614a1a]',
    badgeText: 'text-[#fde68a]',
    entityTypes: ['Armed Group', 'Brigade', 'Combat Brigade', 'Armed Formation', 'Armed Movement'],
    placeholder: 'Search armed groups, brigades, battalions, forces...',
    description: 'Organized military brigades and armed formations'
  },
  {
    id: 'militia',
    label: 'Militia',
    shortLabel: 'Militia',
    icon: ShieldAlert,
    accentColor: 'text-[#f87171]',
    badgeBg: 'bg-[#371619]',
    badgeBorder: 'border-[#6e2930]',
    badgeText: 'text-[#fca5a5]',
    entityTypes: ['Militia', 'Local Formation', 'Paramilitary', 'Apparatus'],
    placeholder: 'Search militias, armed factions, security units...',
    description: 'Paramilitary militias and local territorial factions'
  },
  {
    id: 'commander',
    label: 'Commander',
    shortLabel: 'Commander',
    icon: Award,
    accentColor: 'text-[#a78bfa]',
    badgeBg: 'bg-[#291e3e]',
    badgeBorder: 'border-[#533c7d]',
    badgeText: 'text-[#c4b5fd]',
    entityTypes: ['Commander', 'Military Commander', 'General', 'Officer', 'Field Marshal'],
    placeholder: 'Search commanders, military leadership, generals...',
    description: 'Unit commanders and senior security decision-makers'
  },
  {
    id: 'security-actor',
    label: 'Security Actor',
    shortLabel: 'Security',
    icon: Shield,
    accentColor: 'text-[#34d399]',
    badgeBg: 'bg-[#102e22]',
    badgeBorder: 'border-[#1d5c43]',
    badgeText: 'text-[#6ee7b7]',
    entityTypes: ['Security Actor', 'Security Apparatus', 'Agency', 'Guard', 'Doctrinal Authority'],
    placeholder: 'Search security apparatuses, institutional actors...',
    description: 'Official security apparatuses, guards, and institutional actors'
  },
  {
    id: 'political',
    label: 'Political',
    shortLabel: 'Political',
    icon: Building2,
    accentColor: 'text-[#e879f9]',
    badgeBg: 'bg-[#33183b]',
    badgeBorder: 'border-[#662e76]',
    badgeText: 'text-[#f0abfc]',
    entityTypes: ['Political', 'Institution', 'Government', 'Council', 'Executive'],
    placeholder: 'Search political bodies, executive councils, ministries...',
    description: 'Sovereign political bodies and governance councils'
  },
  {
    id: 'location',
    label: 'Location',
    shortLabel: 'Location',
    icon: MapPin,
    accentColor: 'text-[#f97316]',
    badgeBg: 'bg-[#341d10]',
    badgeBorder: 'border-[#68371d]',
    badgeText: 'text-[#fdba74]',
    entityTypes: ['Location', 'Facility', 'Strategic Site', 'Airbase', 'Terminal', 'Port'],
    placeholder: 'Search strategic facilities, airbases, ports, terminals...',
    description: 'Strategic facilities, dual-use bases, and critical infrastructure'
  },
  {
    id: 'event',
    label: 'Event',
    shortLabel: 'Event',
    icon: CalendarDays,
    accentColor: 'text-[#22d3ee]',
    badgeBg: 'bg-[#0f2d34]',
    badgeBorder: 'border-[#1b5563]',
    badgeText: 'text-[#67e8f9]',
    entityTypes: ['Event', 'Operation', 'Incident', 'Clash', 'Ceasefire', 'Truce', 'Talks'],
    placeholder: 'Search security events, operations, ceasefires, talks...',
    description: 'Operational incidents, ceasefires, and security summits'
  }
];

export const getSectionForEntityType = (entityType: string = ''): SectionConfig => {
  const norm = entityType.toLowerCase();
  for (const config of SECTION_CONFIGS) {
    if (config.id === 'all') continue;
    if (config.entityTypes.some(t => norm.includes(t.toLowerCase()))) {
      return config;
    }
  }
  return SECTION_CONFIGS[0];
};

export const recordMatchesSection = (record: Record, section: DatabaseSection): boolean => {
  if (section === 'all') return true;
  const config = SECTION_CONFIGS.find(s => s.id === section);
  if (!config) return true;

  const type = (record.entity_type || '').toLowerCase();
  const title = (record.title || '').toLowerCase();
  const tags = (record.tags || []).map(t => t.toLowerCase());

  // 1. Check entity_type
  if (config.entityTypes.some(t => type.includes(t.toLowerCase()))) {
    return true;
  }

  // 2. Check tags
  if (tags.some(tag => config.entityTypes.some(t => tag.includes(t.toLowerCase())))) {
    return true;
  }

  // 3. Fallback keywords
  if (section === 'commander' && (tags.includes('commander') || title.includes('commander') || type.includes('commander'))) {
    return true;
  }
  if (section === 'armed-group' && (tags.includes('armed group') || type.includes('group') || type.includes('brigade') || title.includes('brigade'))) {
    return true;
  }
  if (section === 'militia' && (tags.includes('militia') || type.includes('militia'))) {
    return true;
  }
  if (section === 'person' && (tags.includes('person') || type.includes('person') || tags.includes('individual'))) {
    return true;
  }
  if (section === 'political' && (tags.includes('political') || type.includes('political'))) {
    return true;
  }
  if (section === 'location' && (type.includes('location') || type.includes('site') || type.includes('facility') || type.includes('airbase'))) {
    return true;
  }
  if (section === 'event' && (type.includes('event') || type.includes('truce') || type.includes('ceasefire'))) {
    return true;
  }

  return false;
};

interface ClientPortalProps {
  onLogout: () => void;
}

type NetworkNode = {
  id: string;
  label: string;
  type: 'core' | 'affiliation' | 'rivalry' | 'event';
};

type NetworkLink = {
  source: string;
  target: string;
  type: 'affiliation' | 'rivalry' | 'event';
};

function formatAssessment(summary: string) {
  if (!summary) {
    return {
      paragraphs: [
        'No assessment narrative is currently available for this record.'
      ]
    };
  }

  const cleaned = summary
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  return {
    paragraphs:
      paragraphs.length > 0 ? paragraphs : [cleaned]
  };
}

function buildNetwork(record: Record): {
  nodes: NetworkNode[];
  links: NetworkLink[];
} {
  const nodes: NetworkNode[] = [
    {
      id: 'core',
      label: record.title,
      type: 'core'
    }
  ];

  const links: NetworkLink[] = [];

  const addNodes = (
    values: string[] | undefined,
    type: NetworkNode['type'],
    linkType: NetworkLink['type']
  ) => {
    (values || []).forEach((value, index) => {
      const label = String(value || '').trim();

      if (!label) return;

      const id = `${type}-${index}-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`;

      if (!nodes.some(n => n.id === id)) {
        nodes.push({
          id,
          label,
          type
        });
      }

      links.push({
        source: 'core',
        target: id,
        type: linkType
      });
    });
  };

  addNodes(
    record.affiliations,
    'affiliation',
    'affiliation'
  );

  addNodes(
    record.rivalries,
    'rivalry',
    'rivalry'
  );

  addNodes(
    record.linked_events,
    'event',
    'event'
  );

  return {
    nodes,
    links
  };
}

export default function ClientPortal({
  onLogout
}: ClientPortalProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] =
    useState<DatabaseSection>('all');
  const [showSectionDropdown, setShowSectionDropdown] =
    useState(false);
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState('overview');
  const [accessKeyInput, setAccessKeyInput] =
    useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Actual database last-updated timestamp
  const [databaseLastUpdated, setDatabaseLastUpdated] =
    useState<string | null>(null);

  // Controls whether the live search dropdown is visible.
  const [showSearchResults, setShowSearchResults] =
    useState(false);

  // Used to detect clicks outside the search area.
  const searchContainerRef =
    useRef<HTMLDivElement | null>(null);
  const sectionDropdownRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * Close search suggestions when clicking anywhere outside
   * the search container or dropdown.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          event.target as Node
        )
      ) {
        setShowSearchResults(false);
      }
      if (
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setShowSectionDropdown(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  /*
   * Count available records per database section.
   */
  const sectionCounts = useMemo(() => {
    const counts: { [key in DatabaseSection]: number } = {
      all: records.length,
      person: 0,
      'armed-group': 0,
      militia: 0,
      commander: 0,
      'security-actor': 0,
      political: 0,
      location: 0,
      event: 0
    };

    records.forEach(rec => {
      SECTION_CONFIGS.forEach(sec => {
        if (sec.id !== 'all' && recordMatchesSection(rec, sec.id)) {
          counts[sec.id] = (counts[sec.id] || 0) + 1;
        }
      });
    });

    return counts;
  }, [records]);

  const activeSectionConfig = useMemo(() => {
    return (
      SECTION_CONFIGS.find(s => s.id === selectedSection) ||
      SECTION_CONFIGS[0]
    );
  }, [selectedSection]);

  const ActiveSectionIcon = activeSectionConfig.icon;

  const selectSection = (sec: DatabaseSection) => {
    setSelectedSection(sec);
    setShowSectionDropdown(false);
    setShowSearchResults(true);

    // If an open record does not match the chosen section, reset it
    if (selectedId && sec !== 'all') {
      const rec = records.find(r => r.id === selectedId);
      if (rec && !recordMatchesSection(rec, sec)) {
        setSelectedId(null);
      }
    }
  };

  /*
   * Check for saved session access key on mount.
   */
  useEffect(() => {
    const savedKey = sessionStorage.getItem('r2d_client_key');
    if (savedKey) {
      setAccessKeyInput(savedKey);
      performLogin(savedKey);
    }
  }, []);

  /*
   * Fetch the real database last-updated timestamp.
   */
  useEffect(() => {
    const fetchDatabaseStatus = async () => {
      try {
        const res = await fetch('/api/database/status');

        if (res.ok) {
          const data = await res.json();

          setDatabaseLastUpdated(
            data.last_updated || null
          );
        }
      } catch (err) {
        console.error(
          'Failed to fetch database status'
        );
      }
    };

    fetchDatabaseStatus();

    const interval = setInterval(
      fetchDatabaseStatus,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  const performLogin = async (key: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/client/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_key: key.toUpperCase().trim()
        })
      });

      if (res.ok) {
        const clientData = await res.json();

        setClient(clientData);
        sessionStorage.setItem('r2d_client_key', clientData.access_key);
        setSelectedId(null);
        setSearch('');
        setShowSearchResults(false);
        setActiveTab('overview');

        await fetchRecords(clientData.access_key);
      } else {
        const errData = await res.json();

        setError(
          errData.error ||
            'Invalid Intelligence Access Key'
        );
      }
    } catch (err) {
      setError('Connection failure');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(accessKeyInput);
  };

  const handleClientLogout = () => {
    sessionStorage.removeItem('r2d_client_key');
    setClient(null);
    onLogout();
  };

  const fetchRecords = async (key: string) => {
    try {
      const res = await fetch(
        '/api/client/records',
        {
          headers: {
            'x-access-key': key
          }
        }
      );

      if (res.ok) {
        const data = await res.json();

        setRecords(data);

        /*
         * If the currently selected record still exists,
         * keep it selected.
         *
         * This allows automatic refresh without throwing
         * the client back to the empty screen.
         */
        setSelectedId(currentSelectedId => {
          if (
            currentSelectedId &&
            data.some(
              (record: Record) =>
                record.id === currentSelectedId
            )
          ) {
            return currentSelectedId;
          }

          return null;
        });
      }
    } catch (err) {
      console.error(
        'Failed to fetch records'
      );
    }
  };

  /*
   * Automatically refresh the client's authorized
   * records every 30 seconds.
   *
   * This means an administrator can update a record and
   * the client portal will receive the change without
   * requiring the client to log out or manually refresh.
   */
  useEffect(() => {
    if (!client?.access_key) {
      return;
    }

    const interval = setInterval(() => {
      fetchRecords(client.access_key);
    }, 30000);

    return () => clearInterval(interval);
  }, [client?.access_key]);

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0b0e13] flex items-center justify-center p-6 font-sans">
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="w-full max-w-md bg-[#121720] border border-[#293241] rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#1a2a49] border border-[#5b8def] rounded-xl flex items-center justify-center mx-auto mb-4 text-[#5b8def]">
              <Lock size={28} />
            </div>

            <h1 className="text-2xl font-bold text-[#e7ebf2] mb-2">
              Secure Client Access
            </h1>

            <p className="text-[#8f9bad] text-sm">
              Enter your agency access key to view your
              specific intelligence feed.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#8f9bad] uppercase tracking-widest ml-1">
                Access Key
              </label>

              <input
                type="text"
                required
                autoFocus
                value={accessKeyInput}
                onChange={e =>
                  setAccessKeyInput(
                    e.target.value
                  )
                }
                placeholder="e.g. A1B2C3D4"
                className="w-full bg-[#0b0e13] border border-[#293241] rounded-xl p-4 text-center text-xl font-mono text-[#5b8def] outline-none focus:border-[#456bb8] transition-colors tracking-widest placeholder:text-[#1e2735]"
              />
            </div>

            {error && (
              <motion.p
                initial={{
                  opacity: 0
                }}
                animate={{
                  opacity: 1
                }}
                className="text-[#d96a73] text-xs text-center font-medium"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#5b8def] text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'AUTHENTICATING...'
              ) : (
                <>
                  INITIALIZE PORTAL ACCESS
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-[#202733] text-center">
            <button
              type="button"
              onClick={() => {
                setAccessKeyInput('DEMO2026');
                performLogin('DEMO2026');
              }}
              className="text-[11px] text-[#5b8def] hover:text-[#8cb3ff] transition-colors font-semibold inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#162133] border border-[#2b3c5c]"
            >
              <Shield size={12} />
              Fill Demo Agency Access (DEMO2026)
            </button>
          </div>

          <button
            onClick={onLogout}
            className="w-full mt-6 flex items-center justify-center gap-2 text-[#8f9bad] hover:text-[#e7ebf2] transition-colors text-xs font-bold"
          >
            <ArrowLeft size={14} />
            BACK TO PUBLIC SITE
          </button>
        </motion.div>
      </div>
    );
  }

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    // If neither search nor section filter is active, return empty for default view
    if (!normalizedSearch && selectedSection === 'all') {
      return [];
    }

    return records.filter(record => {
      // 1. Filter by section if not 'all'
      if (
        selectedSection !== 'all' &&
        !recordMatchesSection(record, selectedSection)
      ) {
        return false;
      }

      // 2. If no text query, all records matching the section qualify
      if (!normalizedSearch) {
        return true;
      }

      // 3. Search text query match across all relevant fields
      const searchableFields = [
        record.title,
        record.entity_type,
        ...record.regions,
        ...record.tags,
        ...record.affiliations,
        ...record.rivalries,
        ...record.linked_events,
        record.summary
      ];

      return searchableFields.some(field =>
        String(field || '')
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [records, normalizedSearch, selectedSection]);

  const selectedRecord = records.find(
    r => r.id === selectedId
  );

  const assessment = selectedRecord
    ? formatAssessment(
        selectedRecord.summary
      )
    : null;

  const network = selectedRecord
    ? buildNetwork(selectedRecord)
    : {
        nodes: [],
        links: []
      };

  const handleSearch = (value: string) => {
    setSearch(value);

    if (value.trim()) {
      setShowSearchResults(true);
      setSelectedId(null);
      setActiveTab('overview');
    } else if (selectedSection !== 'all') {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  const handleSearchFocus = () => {
    if (search.trim() || selectedSection !== 'all') {
      setShowSearchResults(true);
    }
  };

  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (filteredRecords.length === 1) {
        openRecord(
          filteredRecords[0].id
        );
      } else {
        setShowSearchResults(false);
      }
    }

    if (e.key === 'Escape') {
      setShowSearchResults(false);
    }
  };

  const openRecord = (id: string) => {
    setSelectedId(id);
    setSearch('');
    setShowSearchResults(false);
    setActiveTab('overview');
  };

  const getNodePosition = (
    index: number,
    total: number
  ) => {
    if (total <= 1) {
      return {
        x: 50,
        y: 50
      };
    }

    const angle =
      ((index - 1) /
        Math.max(total - 1, 1)) *
        Math.PI *
        2 -
      Math.PI / 2;

    const radiusX = 36;
    const radiusY = 35;

    return {
      x:
        50 +
        Math.cos(angle) * radiusX,
      y:
        50 +
        Math.sin(angle) * radiusY
    };
  };

  return (
    <div className="min-h-screen bg-[#0b0e13] text-[#e7ebf2] font-sans">
      <div className="max-w-[1600px] mx-auto p-[22px_26px_40px]">

        {/* Header */}
        <div className="flex items-end justify-between mb-[18px]">
          <div className="brand">
            <div className="flex items-center gap-3">
              <Shield
                size={22}
                className="text-[#5b8def]"
              />

              <h1 className="m-0 text-[21px] tracking-[-0.3px] font-bold">
                LIBYA SECURITY INTELLIGENCE
              </h1>
            </div>

            <p className="m-[5px_0_0_35px] text-[#8f9bad] text-[12px] uppercase tracking-wider font-semibold">
              {client.name} • {client.id}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#aeb8c8] text-[12px]">
              <span className="w-[7px] h-[7px] bg-[#57b981] rounded-full animate-pulse"></span>
              Secure Active Session
            </div>

            <button
              onClick={handleClientLogout}
              className="bg-transparent text-[#8f9bad] hover:text-[#d96a73] transition-colors p-0 font-bold text-xs flex items-center gap-2"
            >
              <LogOut size={16} />
              LOGOUT
            </button>
          </div>
        </div>

        {/* Search & Database Section Filter Area */}
        <div
          ref={searchContainerRef}
          className="relative mb-[18px]"
        >
          {/* Quick Filter Section Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-1.5 scrollbar-none">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#657084] mr-1 shrink-0 select-none">
              <Filter size={12} className="text-[#5b8def]" />
              <span>Section:</span>
            </div>

            {SECTION_CONFIGS.map(sec => {
              const Icon = sec.icon;
              const isSelected = selectedSection === sec.id;
              const count = sectionCounts[sec.id] || 0;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => selectSection(sec.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-semibold transition-all whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'bg-[#1b2b4a] text-[#b5cbff] border-[#5b8def] shadow-sm'
                      : 'bg-[#141922] text-[#8f9bad] hover:text-[#e7ebf2] hover:bg-[#18202d] border-[#293241]'
                  }`}
                  title={`${sec.label}: ${sec.description}`}
                >
                  <Icon
                    size={12}
                    className={isSelected ? 'text-[#5b8def]' : sec.accentColor}
                  />
                  <span>{sec.label}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-[#253966] text-[#c7dbff]'
                        : 'bg-[#1a222f] text-[#6f7e94]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {selectedSection !== 'all' && (
              <button
                type="button"
                onClick={() => selectSection('all')}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#8f9bad] hover:text-[#d96a73] transition-colors ml-1 shrink-0 font-medium"
                title="Reset to all sections"
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Main Search Input with Integrated Section Selector */}
          <div className="flex items-stretch bg-[#151a22] border border-[#293241] rounded-[8px] focus-within:border-[#456bb8] transition-all shadow-md overflow-hidden">
            {/* Integrated Section Dropdown */}
            <div className="relative" ref={sectionDropdownRef}>
              <button
                type="button"
                onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                className="h-full px-3.5 py-3 flex items-center gap-2 bg-[#18202c] hover:bg-[#1f2837] text-[#dfe6f1] border-r border-[#293241] transition-colors text-[12px] font-bold tracking-wide whitespace-nowrap select-none"
                title="Select database section to filter"
              >
                <ActiveSectionIcon
                  size={15}
                  className={activeSectionConfig.accentColor}
                />
                <span className="hidden sm:inline">
                  {activeSectionConfig.label}
                </span>
                <span className="sm:hidden">
                  {activeSectionConfig.shortLabel}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-[#718096] transition-transform ${
                    showSectionDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showSectionDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#121720] border border-[#293241] rounded-[8px] shadow-2xl z-50 py-1.5 overflow-hidden backdrop-blur-md">
                  <div className="px-3.5 py-1.5 text-[9px] uppercase tracking-wider font-bold text-[#657084] border-b border-[#202733] flex justify-between items-center">
                    <span>Database Sections</span>
                    <span className="text-[#5b8def] font-mono">
                      {records.length} Total
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                    {SECTION_CONFIGS.map(sec => {
                      const Icon = sec.icon;
                      const isSel = selectedSection === sec.id;
                      const count = sectionCounts[sec.id] || 0;

                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => selectSection(sec.id)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#182130] transition-colors text-[12px] border-b border-[#1b2330] last:border-b-0 ${
                            isSel
                              ? 'bg-[#1a2a49] text-[#9dbaff] font-bold'
                              : 'text-[#cbd4e2]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={15}
                              className={
                                isSel ? 'text-[#5b8def]' : sec.accentColor
                              }
                            />
                            <div>
                              <div className="leading-tight">{sec.label}</div>
                              <div className="text-[9px] text-[#657084] font-normal leading-tight mt-0.5">
                                {sec.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                isSel
                                  ? 'bg-[#253966] text-[#c3d7ff]'
                                  : 'bg-[#171f2c] text-[#8f9bad]'
                              }`}
                            >
                              {count}
                            </span>
                            {isSel && (
                              <Check size={12} className="text-[#5b8def]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Input with Search Icon & Quick Status */}
            <div className="flex-1 relative flex items-center">
              <Search
                size={16}
                className="absolute left-3.5 text-[#718096] pointer-events-none"
              />

              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                onFocus={handleSearchFocus}
                onKeyDown={handleSearchKeyDown}
                placeholder={activeSectionConfig.placeholder}
                className="w-full bg-transparent text-[#e7ebf2] py-3.5 pl-10 pr-28 text-[13px] outline-none placeholder:text-[#525f77]"
              />

              {/* Status and Clear Controls */}
              <div className="absolute right-3 flex items-center gap-2">
                {selectedSection !== 'all' && (
                  <span className="hidden md:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1c283f] text-[#86abf9] border border-[#2e4777] font-semibold">
                    <ActiveSectionIcon size={10} />
                    <span>{activeSectionConfig.shortLabel}</span>
                    <button
                      type="button"
                      onClick={() => selectSection('all')}
                      className="hover:text-white ml-0.5"
                      title="Clear section filter"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}

                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      if (selectedSection === 'all') {
                        setShowSearchResults(false);
                      }
                    }}
                    className="text-[#718096] hover:text-[#e7ebf2] p-1 rounded hover:bg-[#1f2837] transition-colors"
                    title="Clear search query"
                  >
                    <X size={14} />
                  </button>
                )}

                {(search || selectedSection !== 'all') && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1b2330] border border-[#2a374a] text-[#8fa3c7]">
                    {filteredRecords.length}{' '}
                    {filteredRecords.length === 1 ? 'match' : 'matches'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live search results dropdown */}
          {(normalizedSearch || (selectedSection !== 'all' && showSearchResults)) &&
            showSearchResults && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-[#121720] border border-[#293241] rounded-[8px] shadow-2xl overflow-hidden backdrop-blur-md">
                <div className="px-4 py-3 border-b border-[#293241] flex justify-between items-center bg-[#151c27]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#8f9bad]">
                      Intelligence Search
                    </span>
                    {selectedSection !== 'all' && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1e2c45] text-[#9dbaff] border border-[#374f7c] font-bold flex items-center gap-1">
                        <ActiveSectionIcon size={10} />
                        {activeSectionConfig.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#5b8def] font-bold font-mono">
                      {filteredRecords.length}{' '}
                      {filteredRecords.length === 1 ? 'MATCH' : 'MATCHES'}
                    </span>

                    {(normalizedSearch || selectedSection !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setSelectedSection('all');
                          setShowSearchResults(false);
                        }}
                        className="text-[10px] text-[#718096] hover:text-[#d96a73] font-semibold transition-colors"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                {filteredRecords.length > 0 ? (
                  <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                    {filteredRecords.slice(0, 15).map(record => {
                      const secConfig = getSectionForEntityType(
                        record.entity_type
                      );
                      const SecIcon = secConfig.icon;

                      return (
                        <button
                          key={record.id}
                          onClick={() => openRecord(record.id)}
                          className="w-full text-left px-4 py-3 border-b border-[#202733] hover:bg-[#171d27] transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-bold text-[13px] text-[#e7ebf2] group-hover:text-[#5b8def] transition-colors truncate">
                                {record.title}
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${secConfig.badgeBg} ${secConfig.badgeBorder} ${secConfig.badgeText}`}
                                >
                                  <SecIcon size={10} />
                                  {record.entity_type}
                                </span>

                                {record.regions.slice(0, 2).map(region => (
                                  <span
                                    key={region}
                                    className="text-[9px] text-[#8f9bad]"
                                  >
                                    • {region}
                                  </span>
                                ))}
                              </div>

                              <div className="flex flex-wrap gap-1 mt-2">
                                {record.tags.slice(0, 4).map(tag => (
                                  <span
                                    key={tag}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#111823] border border-[#293241] text-[#8f9bad]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <ChevronRight
                              size={16}
                              className="text-[#5b8def] shrink-0 mt-1 opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Search
                      size={28}
                      className="mx-auto mb-3 text-[#465267]"
                    />
                    <p className="text-[12px] font-bold text-[#b8c2d2]">
                      No matching intelligence records
                    </p>
                    <p className="text-[10px] text-[#657084] mt-1">
                      {selectedSection !== 'all'
                        ? `No records found in section "${activeSectionConfig.label}" matching "${search}".`
                        : 'Try searching by name, organization, commander, location, tag or event.'}
                    </p>
                    {selectedSection !== 'all' && (
                      <button
                        type="button"
                        onClick={() => selectSection('all')}
                        className="mt-3 text-[11px] text-[#5b8def] hover:underline font-semibold"
                      >
                        Search all database sections instead
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-[16px]">

          {/* Main panel */}
          <main className="bg-[#121720] border border-[#293241] rounded-[8px] overflow-hidden">
            <AnimatePresence mode="wait">

              {selectedRecord ? (

                <motion.div
                  key={selectedRecord.id}
                  initial={{
                    opacity: 0
                  }}
                  animate={{
                    opacity: 1
                  }}
                  exit={{
                    opacity: 0
                  }}
                >

                  {/* Hero */}
                  <section className="p-[20px_21px_17px]">

                    <div className="flex justify-between gap-[20px]">

                      <div>

                        <button
                          onClick={() =>
                            setSelectedId(null)
                          }
                          className="flex items-center gap-1 text-[10px] text-[#718096] hover:text-[#5b8def] mb-3 uppercase tracking-widest font-bold"
                        >
                          <ArrowLeft
                            size={12}
                          />
                          Back to
                          results
                        </button>

                        <h2 className="m-0 text-[22px] font-bold tracking-tight">
                          {
                            selectedRecord.title
                          }
                        </h2>

                        <div className="mt-[5px] text-[#8f9bad] font-medium">
                          {
                            selectedRecord.entity_type
                          }{' '}
                          •{' '}
                          {selectedRecord
                            .regions
                            .join(
                              ', '
                            ) ||
                            'Region not specified'}
                        </div>

                      </div>

                      <div className="text-[11px] text-[#d9ffe8] bg-[#143f2a] border border-[#286f49] p-[5px_9px] rounded-[14px] h-fit font-bold uppercase tracking-wider">
                        Active Record
                      </div>

                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-[9px] mt-[18px]">

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">
                          {selectedRecord
                            .linked_events
                            ?.length ||
                            0}
                        </div>

                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">
                          Events
                        </div>
                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">
                          {
                            selectedRecord
                              .tags
                              .length
                          }
                        </div>

                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">
                          Tags
                        </div>
                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">
                          {
                            selectedRecord
                              .regions
                              .length
                          }
                        </div>

                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">
                          Regions
                        </div>
                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">
                          {
                            records.length
                          }
                        </div>

                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">
                          Feed Items
                        </div>
                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold text-[#57b981]">
                          Active
                        </div>

                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">
                          Record
                        </div>
                      </div>

                    </div>

                  </section>

                  {/* Tabs */}
                  <nav className="flex border-b border-[#293241] p-[0_20px]">

                    {[
                      [
                        'overview',
                        'Overview'
                      ],
                      [
                        'network',
                        'Network'
                      ],
                      [
                        'sources',
                        'Data'
                      ]
                    ].map(
                      ([
                        tab,
                        label
                      ]) => (
                        <div
                          key={tab}
                          onClick={() =>
                            setActiveTab(
                              tab
                            )
                          }
                          className={`p-[13px_15px] text-[12px] cursor-pointer border-b-2 transition-all font-bold uppercase tracking-widest ${
                            activeTab ===
                            tab
                              ? 'text-white border-[#5b8def]'
                              : 'text-[#8f9bad] border-transparent'
                          }`}
                        >
                          {label}
                        </div>
                      )
                    )}

                  </nav>

                  {/* Content */}
                  <section className="p-[20px]">

                    {/* OVERVIEW */}
                    {activeTab ===
                      'overview' &&
                      assessment && (
                        <div className="grid grid-cols-1 md:grid-cols-[1.25fr_0.75fr] gap-[15px]">

                          <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">

                            <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Intelligence
                              assessment
                            </h3>

                            <div className="border-l-[3px] border-[#5b8def] p-[12px_14px] bg-[#111823] text-[#d8deea] leading-[1.7] rounded-[0_5px_5px_0]">

                              {assessment.paragraphs.map(
                                (
                                  paragraph,
                                  index
                                ) => (
                                  <p
                                    key={
                                      index
                                    }
                                    className={
                                      index >
                                      0
                                        ? 'mt-4'
                                        : ''
                                    }
                                  >
                                    {
                                      paragraph
                                    }
                                  </p>
                                )
                              )}

                            </div>

                            <h3 className="m-[20px_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Affiliations
                            </h3>

                            <div className="flex flex-wrap gap-2">

                              {selectedRecord
                                .affiliations
                                .length >
                              0 ? (

                                selectedRecord.affiliations.map(
                                  aff => (
                                    <span
                                      key={
                                        aff
                                      }
                                      className="flex items-center gap-1.5 p-[5px_8px] bg-[#111823] border border-[#293241] rounded-[4px] text-[11px] text-[#cbd4e2]"
                                    >
                                      <Users
                                        size={
                                          11
                                        }
                                        className="text-[#5b8def]"
                                      />
                                      {
                                        aff
                                      }
                                    </span>
                                  )
                                )

                              ) : (

                                <span className="text-[11px] text-[#657084]">
                                  No
                                  affiliations
                                  recorded.
                                </span>

                              )}

                            </div>

                          </div>

                          <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">

                            <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Key metadata
                            </h3>

                            <div className="grid grid-cols-2 gap-[8px]">

                              <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                                <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                                  Regions
                                </small>

                                <b className="block mt-[3px] text-[11px]">
                                  {selectedRecord
                                    .regions
                                    .join(
                                      ', '
                                    ) ||
                                    'Not recorded'}
                                </b>
                              </div>

                              <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                                <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                                  Entity Type
                                </small>

                                <b className="block mt-[3px] text-[11px]">
                                  {
                                    selectedRecord.entity_type
                                  }
                                </b>
                              </div>

                              <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                                <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                                  Affiliations
                                </small>

                                <b className="block mt-[3px] text-[11px]">
                                  {
                                    selectedRecord
                                      .affiliations
                                      .length
                                  }
                                </b>
                              </div>

                              <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                                <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                                  Last
                                  Updated
                                </small>

                                <b className="block mt-[3px] text-[11px]">
                                  {selectedRecord
                                    .updated_at
                                    ? new Date(
                                        selectedRecord.updated_at
                                      ).toLocaleDateString()
                                    : 'Not recorded'}
                                </b>
                              </div>

                            </div>

                            <h3 className="m-[18px_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Tags
                            </h3>

                            <div className="flex flex-wrap gap-[7px]">

                              {selectedRecord
                                .tags
                                .length >
                              0 ? (

                                selectedRecord.tags.map(
                                  tag => (
                                    <span
                                      key={
                                        tag
                                      }
                                      className="flex items-center gap-1 p-[5px_8px] rounded-[12px] border border-[#293241] text-[11px] text-[#bfc8d8] font-semibold"
                                    >
                                      <Tag
                                        size={
                                          10
                                        }
                                      />
                                      {
                                        tag
                                      }
                                    </span>
                                  )
                                )

                              ) : (

                                <span className="text-[11px] text-[#657084]">
                                  No tags
                                  recorded.
                                </span>

                              )}

                            </div>

                            <h3 className="m-[18px_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Rivalries
                            </h3>

                            <div className="space-y-1.5">

                              {selectedRecord
                                .rivalries
                                .length >
                              0 ? (

                                selectedRecord.rivalries.map(
                                  riv => (
                                    <div
                                      key={
                                        riv
                                      }
                                      className="flex items-center gap-2 p-[7px_9px] bg-[#24171a] border border-[#714047] rounded-[5px] text-[11px] text-[#ef9aa1]"
                                    >
                                      <AlertTriangle
                                        size={
                                          11
                                        }
                                      />
                                      {
                                        riv
                                      }
                                    </div>
                                  )
                                )

                              ) : (

                                <span className="text-[11px] text-[#657084]">
                                  No rivalries
                                  recorded.
                                </span>

                              )}

                            </div>

                          </div>

                        </div>
                      )}

                    {/* NETWORK */}
                    {activeTab ===
                      'network' && (
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">

                        <div className="flex justify-between items-start mb-3">

                          <div>

                            <h3 className="m-0 text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                              Relationship
                              network
                            </h3>

                            <p className="text-[10px] text-[#657084] mt-1">
                              Generated from
                              recorded
                              affiliations,
                              rivalries and
                              linked events.
                            </p>

                          </div>

                          <Network
                            size={16}
                            className="text-[#5b8def]"
                          />

                        </div>

                        {network.nodes
                          .length >
                        1 ? (

                          <div className="h-[460px] relative overflow-hidden bg-[radial-gradient(circle_at_center,#18202d_0,#111720_48%,#10151d_100%)] border border-[#293241] rounded-[7px]">

                            <svg
                              className="absolute inset-0 w-full h-full"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >

                              {network.links.map(
                                (
                                  link,
                                  index
                                ) => {

                                  const sourceIndex =
                                    network.nodes.findIndex(
                                      n =>
                                        n.id ===
                                        link.source
                                    );

                                  const targetIndex =
                                    network.nodes.findIndex(
                                      n =>
                                        n.id ===
                                        link.target
                                    );

                                  const source =
                                    sourceIndex ===
                                    0
                                      ? {
                                          x: 50,
                                          y: 50
                                        }
                                      : getNodePosition(
                                          sourceIndex,
                                          network
                                            .nodes
                                            .length
                                        );

                                  const target =
                                    targetIndex ===
                                    0
                                      ? {
                                          x: 50,
                                          y: 50
                                        }
                                      : getNodePosition(
                                          targetIndex,
                                          network
                                            .nodes
                                            .length
                                        );

                                  return (
                                    <line
                                      key={`${link.source}-${link.target}-${index}`}
                                      x1={
                                        source.x
                                      }
                                      y1={
                                        source.y
                                      }
                                      x2={
                                        target.x
                                      }
                                      y2={
                                        target.y
                                      }
                                      stroke={
                                        link.type ===
                                        'rivalry'
                                          ? '#714047'
                                          : link.type ===
                                            'event'
                                          ? '#53647f'
                                          : '#3d659d'
                                      }
                                      strokeWidth="0.35"
                                      opacity="0.9"
                                    />
                                  );
                                }
                              )}

                            </svg>

                            {network.nodes.map(
                              (
                                node,
                                index
                              ) => {

                                const position =
                                  index ===
                                  0
                                    ? {
                                        x: 50,
                                        y: 50
                                      }
                                    : getNodePosition(
                                        index,
                                        network
                                          .nodes
                                          .length
                                      );

                                const isCore =
                                  node.type ===
                                  'core';

                                return (
                                  <div
                                    key={
                                      node.id
                                    }
                                    className="absolute"
                                    style={{
                                      left: `${position.x}%`,
                                      top: `${position.y}%`,
                                      transform:
                                        'translate(-50%, -50%)',
                                      maxWidth:
                                        isCore
                                          ? '190px'
                                          : '145px'
                                    }}
                                  >

                                    <div
                                      className={`px-3 py-2 rounded-[7px] border shadow-xl text-center ${
                                        isCore
                                          ? 'border-[#5b8def] bg-[#1a2a49] text-white'
                                          : node.type ===
                                            'rivalry'
                                          ? 'border-[#714047] bg-[#24171a] text-[#ef9aa1]'
                                          : node.type ===
                                            'event'
                                          ? 'border-[#465267] bg-[#182130] text-[#cbd4e2]'
                                          : 'border-[#3a4a64] bg-[#182130] text-[#e7ebf2]'
                                      }`}
                                    >

                                      <div className="text-[9px] uppercase tracking-widest opacity-60 font-bold mb-1">
                                        {node.type ===
                                        'core'
                                          ? selectedRecord.entity_type
                                          : node.type}
                                      </div>

                                      <div className="text-[10px] font-bold leading-tight break-words">
                                        {
                                          node.label
                                        }
                                      </div>

                                    </div>

                                  </div>
                                );
                              }
                            )}

                            <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 text-[9px] uppercase tracking-wider font-bold text-[#718096]">

                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#3d659d]" />
                                Affiliation
                              </span>

                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#714047]" />
                                Rivalry
                              </span>

                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#53647f]" />
                                Event
                              </span>

                            </div>

                          </div>

                        ) : (

                          <div className="h-[300px] flex flex-col items-center justify-center text-center border border-[#293241] rounded-[7px] bg-[#111720]">

                            <Network
                              size={40}
                              className="text-[#465267] mb-3"
                            />

                            <p className="text-[12px] font-bold text-[#8f9bad]">
                              No recorded
                              relationships
                            </p>

                            <p className="text-[10px] text-[#657084] mt-1 max-w-sm">
                              This record does not
                              currently contain
                              affiliations,
                              rivalries or linked
                              events.
                            </p>

                          </div>

                        )}

                      </div>
                    )}

                    {/* DATA */}
                    {activeTab ===
                      'sources' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-[15px]">

                        <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">

                          <h3 className="m-[0_0_14px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                            Record information
                          </h3>

                          <div className="space-y-3 text-[11px]">

                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Record ID
                              </span>

                              <span className="text-[#cbd4e2] font-mono">
                                {
                                  selectedRecord.id
                                }
                              </span>
                            </div>

                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Entity Type
                              </span>

                              <span className="text-[#cbd4e2]">
                                {
                                  selectedRecord.entity_type
                                }
                              </span>
                            </div>

                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Regions
                              </span>

                              <span className="text-[#cbd4e2]">
                                {selectedRecord
                                  .regions
                                  .join(
                                    ', '
                                  ) ||
                                  'Not recorded'}
                              </span>
                            </div>

                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Last Updated
                              </span>

                              <span className="text-[#cbd4e2]">
                                {selectedRecord
                                  .updated_at
                                  ? new Date(
                                      selectedRecord.updated_at
                                    ).toLocaleString()
                                  : 'Not recorded'}
                              </span>
                            </div>

                          </div>

                        </div>

                        <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">

                          <h3 className="m-[0_0_14px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">
                            Linked events
                          </h3>

                          {selectedRecord
                            .linked_events
                            .length >
                          0 ? (

                            <div className="space-y-2">

                              {selectedRecord.linked_events.map(
                                event => (
                                  <div
                                    key={
                                      event
                                    }
                                    className="flex items-start gap-2 p-2 bg-[#111823] border border-[#293241] rounded-[5px]"
                                  >

                                    <CalendarDays
                                      size={
                                        13
                                      }
                                      className="text-[#5b8def] mt-0.5 shrink-0"
                                    />

                                    <span className="text-[11px] text-[#cbd4e2]">
                                      {
                                        event
                                      }
                                    </span>

                                  </div>
                                )
                              )}

                            </div>

                          ) : (

                            <div className="text-[11px] text-[#657084]">
                              No linked events
                              recorded.
                            </div>

                          )}

                        </div>

                      </div>
                    )}

                  </section>

                </motion.div>

              ) : (

                /* EMPTY STATE */
                <motion.div
                  initial={{
                    opacity: 0
                  }}
                  animate={{
                    opacity: 1
                  }}
                  className="min-h-[620px] flex items-center justify-center p-10"
                >

                  <div className="text-center max-w-lg">

                    <div className="w-20 h-20 rounded-2xl bg-[#151d2b] border border-[#293241] flex items-center justify-center mx-auto mb-6">

                      <Database
                        size={34}
                        className="text-[#5b8def]"
                      />

                    </div>

                    <h2 className="text-[20px] font-bold text-[#e7ebf2]">
                      Intelligence Database
                    </h2>

                    <p className="text-[12px] text-[#8f9bad] mt-2 leading-[1.7]">
                      Search the authorized
                      intelligence feed using a
                      name, entity type, location,
                      affiliation, rivalry, tag or
                      linked event.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-7">

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-3">

                        <Users
                          size={16}
                          className="mx-auto text-[#5b8def] mb-2"
                        />

                        <div className="text-[9px] uppercase tracking-wider font-bold text-[#8f9bad]">
                          Entities
                        </div>

                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-3">

                        <MapPin
                          size={16}
                          className="mx-auto text-[#5b8def] mb-2"
                        />

                        <div className="text-[9px] uppercase tracking-wider font-bold text-[#8f9bad]">
                          Regions
                        </div>

                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-3">

                        <Network
                          size={16}
                          className="mx-auto text-[#5b8def] mb-2"
                        />

                        <div className="text-[9px] uppercase tracking-wider font-bold text-[#8f9bad]">
                          Networks
                        </div>

                      </div>

                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-3">

                        <Activity
                          size={16}
                          className="mx-auto text-[#5b8def] mb-2"
                        />

                        <div className="text-[9px] uppercase tracking-wider font-bold text-[#8f9bad]">
                          Events
                        </div>

                      </div>

                    </div>

                    <div className="mt-6 text-[10px] text-[#465267] uppercase tracking-widest font-bold">
                      {records.length}{' '}
                      authorized records
                      available
                    </div>

                  </div>

                </motion.div>
              )}

            </AnimatePresence>
          </main>

          {/* Sidebar */}
          <aside className="bg-[#121720] border border-[#293241] rounded-[8px] p-[15px] flex flex-col gap-[12px] overflow-hidden">

            <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[12px] mb-2">

              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5b8def] mb-3">
                Your Intelligence Access
              </h3>

              <div className="space-y-3">

                <div>

                  <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                    Authorized Regions
                  </small>

                  <div className="flex flex-wrap gap-1 mt-1">

                    {client.allowed_regions.map(
                      region => (
                        <span
                          key={region}
                          className="text-[10px] font-bold text-[#e7ebf2]"
                        >
                          {region}
                        </span>
                      )
                    )}

                  </div>

                </div>

                <div>

                  <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">
                    Account Expires
                  </small>

                  <b className="text-[11px] text-[#d96a73]">
                    {new Date(
                      client.expires_at
                    ).toLocaleDateString()}
                  </b>

                </div>

              </div>

            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-[13px] font-bold uppercase tracking-wider text-[#b8c2d2]">
                  Search results
                </h3>
                {selectedSection !== 'all' && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1e2c45] text-[#9dbaff] border border-[#374f7c] font-bold flex items-center gap-1">
                    <ActiveSectionIcon size={10} />
                    {activeSectionConfig.shortLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(normalizedSearch || selectedSection !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedSection('all');
                    }}
                    className="text-[9px] text-[#718096] hover:text-[#d96a73] font-semibold transition-colors"
                  >
                    Reset
                  </button>
                )}
                <span className="text-[10px] bg-[#24334d] text-[#a9c2ff] p-[4px_7px] rounded-[10px] font-bold font-mono">
                  {normalizedSearch || selectedSection !== 'all'
                    ? filteredRecords.length
                    : 0}
                </span>
              </div>
            </div>

            {!normalizedSearch && selectedSection === 'all' ? (
              <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center text-center p-3">
                <Layers size={28} className="text-[#3c4657] mb-2" />
                <p className="text-[12px] font-bold text-[#b8c2d2] mb-1">
                  Browse by Section
                </p>
                <p className="text-[11px] text-[#657084] leading-relaxed mb-4">
                  Select an intelligence section to inspect matching entities:
                </p>

                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {SECTION_CONFIGS.filter(s => s.id !== 'all').map(sec => {
                    const SecIcon = sec.icon;
                    const count = sectionCounts[sec.id] || 0;

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => selectSection(sec.id)}
                        className="flex items-center justify-between p-2 rounded bg-[#171d27] border border-[#242c3b] hover:border-[#456bb8] text-left transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <SecIcon size={12} className={sec.accentColor} />
                          <span className="text-[10px] font-bold text-[#cbd4e2] group-hover:text-white truncate">
                            {sec.shortLabel}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[#718096] px-1 py-0.2 rounded bg-[#111722] shrink-0">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center text-center p-4">
                <Search
                  size={28}
                  className="mx-auto mb-3 text-[#3c4657]"
                />
                <p className="text-[11px] font-bold text-[#8f9bad]">
                  No matching records.
                </p>
                <p className="text-[10px] text-[#657084] mt-1">
                  {selectedSection !== 'all'
                    ? `No records found in "${activeSectionConfig.label}".`
                    : 'Try another keyword or filter.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedSection('all');
                  }}
                  className="mt-3 text-[10px] px-2.5 py-1 rounded bg-[#1c283f] text-[#86abf9] border border-[#2e4777] font-semibold"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto pr-1 space-y-[9px] custom-scrollbar max-h-[650px]">
                {filteredRecords.map(record => {
                  const secConfig = getSectionForEntityType(
                    record.entity_type
                  );
                  const SecIcon = secConfig.icon;

                  return (
                    <button
                      key={record.id}
                      onClick={() => openRecord(record.id)}
                      className={`w-full text-left p-[12px] bg-[#171d27] border rounded-[7px] transition-all group ${
                        selectedId === record.id
                          ? 'border-[#5b8def]'
                          : 'border-[#293241] hover:border-[#456bb8]'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="font-bold text-[#dfe6f1] group-hover:text-[#5b8def] transition-colors text-[12px]">
                          {record.title}
                        </div>

                        <ChevronRight
                          size={14}
                          className="text-[#465267] group-hover:text-[#5b8def] shrink-0"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 mt-[6px]">
                        <span
                          className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${secConfig.badgeBg} ${secConfig.badgeBorder} ${secConfig.badgeText}`}
                        >
                          <SecIcon size={9} />
                          {record.entity_type}
                        </span>

                        {record.regions.slice(0, 2).map(region => (
                          <span
                            key={region}
                            className="text-[9px] text-[#8f9bad]"
                          >
                            • {region}
                          </span>
                        ))}
                      </div>

                      <p className="text-[10px] text-[#8f9bad] leading-[1.45] m-[7px_0_0] line-clamp-2">
                        {record.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

          </aside>

        </div>

        {/* Footer */}
        <div className="mt-[15px] text-[#657084] text-[10px] flex justify-between font-semibold">

          <span>
            {client.name} • SECURE ACCESS PORTAL
          </span>

          <span>
            © 2026 RISK2DATA • DATABASE LAST
            UPDATED:{' '}
            {databaseLastUpdated
              ? new Date(
                  databaseLastUpdated
                ).toLocaleString()
              : 'UNAVAILABLE'}
          </span>

        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #293241;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #5b8def;
        }
      `}</style>

    </div>
  );
}
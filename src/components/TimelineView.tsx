import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Shield,
  Award,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Flag,
  Flame,
  User,
  Users,
  Building2,
  Compass,
  ArrowUpDown,
  Tag,
  Share2,
  Network,
  Printer,
  X,
  Radio,
  Layers
} from 'lucide-react';
import { RiskRecord, TimelineMilestone } from '../types';

interface TimelineViewProps {
  record: RiskRecord;
  allRecords?: RiskRecord[];
  onSelectRecord?: (recordId: string) => void;
  onSwitchTab?: (tab: string) => void;
  clientAccessKey?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  record,
  allRecords = [],
  onSelectRecord,
  onSwitchTab,
  clientAccessKey
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [majorOnly, setMajorOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportCopied, setReportCopied] = useState<boolean>(false);

  // Server-fetched timeline state
  const [serverMilestones, setServerMilestones] = useState<TimelineMilestone[] | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(false);

  const isPerson = useMemo(() => {
    return [
      'Person',
      'Commander',
      'Militia Commander',
      'militia_commander',
      'person',
      'commander'
    ].includes(record.entity_type);
  }, [record.entity_type]);

  const isGroup = useMemo(() => {
    return [
      'Armed Group',
      'Militia',
      'Military Organization',
      'Brigade',
      'Security Actor',
      'militia',
      'armed_group'
    ].includes(record.entity_type);
  }, [record.entity_type]);

  const isEvent = useMemo(() => {
    return [
      'Event',
      'Conflict',
      'Incident',
      'War',
      'event',
      'conflict'
    ].includes(record.entity_type);
  }, [record.entity_type]);

  // Fetch verified timeline from server if access key is present
  useEffect(() => {
    let isMounted = true;
    const accessKey = clientAccessKey || sessionStorage.getItem('r2d_client_key') || '';

    const fetchServerTimeline = async () => {
      if (!record?.id) return;
      setIsLoadingServer(true);

      try {
        let res: Response;
        if (accessKey) {
          res = await fetch(`/api/client/records/${encodeURIComponent(record.id)}/timeline`, {
            headers: {
              'x-access-key': accessKey
            }
          });
        } else {
          res = await fetch(`/api/records/${encodeURIComponent(record.id)}/timeline`);
        }

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data && Array.isArray(data.milestones)) {
            setServerMilestones(data.milestones);
          }
        }
      } catch (err) {
        // Fallback gracefully to client-side data
        console.warn('Could not retrieve server timeline, falling back to local dataset', err);
      } finally {
        if (isMounted) {
          setIsLoadingServer(false);
        }
      }
    };

    fetchServerTimeline();

    return () => {
      isMounted = false;
    };
  }, [record.id, clientAccessKey]);

  // Assemble milestones: use server-validated milestones if available
  const rawMilestones: TimelineMilestone[] = useMemo(() => {
    if (serverMilestones && serverMilestones.length > 0) {
      return serverMilestones;
    }

    if (record.chronology && record.chronology.length > 0) {
      return record.chronology;
    }

    return [];
  }, [serverMilestones, record]);

  // Sort milestones
  const sortedMilestones = useMemo(() => {
    return [...rawMilestones].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [rawMilestones, sortOrder]);

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    return sortedMilestones.filter(m => {
      // Major Only Filter
      if (majorOnly && !m.is_major) return false;

      // Event Type Filter
      if (selectedType !== 'all' && m.event_type !== selectedType) return false;

      // Region Filter
      if (selectedRegion !== 'all') {
        const itemRegions = m.regions && m.regions.length > 0 ? m.regions : record.regions || [];
        if (!itemRegions.includes(selectedRegion)) {
          return false;
        }
      }

      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inTitle = m.title.toLowerCase().includes(query);
        const inDesc = m.description.toLowerCase().includes(query);
        const inLoc = m.location ? m.location.toLowerCase().includes(query) : false;
        const inSrc = m.source ? m.source.toLowerCase().includes(query) : false;
        if (!inTitle && !inDesc && !inLoc && !inSrc) return false;
      }

      return true;
    });
  }, [sortedMilestones, majorOnly, selectedType, selectedRegion, searchQuery, record.regions]);

  // Group milestones by Year
  const groupedByYear = useMemo(() => {
    const groups: { [year: string]: TimelineMilestone[] } = {};
    filteredMilestones.forEach(m => {
      const year = m.date.slice(0, 4);
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(m);
    });
    return groups;
  }, [filteredMilestones]);

  const allYears = useMemo(() => {
    const years = Array.from(new Set(rawMilestones.map(m => m.date.slice(0, 4)))).sort();
    return sortOrder === 'asc' ? years : years.reverse();
  }, [rawMilestones, sortOrder]);

  // Distinct available regions across milestones
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    (record.regions || []).forEach(r => set.add(r));
    rawMilestones.forEach(m => {
      if (m.regions) {
        m.regions.forEach(r => set.add(r));
      }
    });
    return Array.from(set);
  }, [rawMilestones, record.regions]);

  // Distinct event types available
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    rawMilestones.forEach(m => types.add(m.event_type));
    return Array.from(types);
  }, [rawMilestones]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedMilestones);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedMilestones(next);
  };

  const expandAll = () => {
    setExpandedMilestones(new Set(filteredMilestones.map(m => m.id)));
  };

  const collapseAll = () => {
    setExpandedMilestones(new Set());
  };

  // Export Chronology to Clipboard
  const handleExportChronology = () => {
    const header =
      `R2D TACTICAL CHRONOLOGY DOSSIER\n` +
      `ENTITY: ${record.title} [${record.id}] — TYPE: ${record.entity_type}\n` +
      `REGION(S): ${(record.regions || []).join(', ')}\n` +
      `CLASSIFICATION: RESTRICTED / CLIENT CLEARANCE\n` +
      `GENERATED AT: ${new Date().toISOString()}\n` +
      `============================================================\n\n`;

    const body = sortedMilestones
      .map(m => {
        const itemRegions = (m.regions || record.regions || []).join(' / ').toUpperCase();
        let text = `[${m.date}] ${m.event_type.toUpperCase()}: ${m.title}\n`;
        if (m.location) text += `Location: ${m.location} (${itemRegions})\n`;
        if (m.stage) text += `Stage: ${m.stage.toUpperCase()}\n`;
        text += `Summary: ${m.description}\n`;
        if (m.source) text += `Source: ${m.source} (${m.source_date || 'N/A'}) [Confidence: ${m.confidence || 'Verified'}]\n`;
        if (m.related_entities && m.related_entities.length > 0) {
          text += `Related Entities: ${m.related_entities.join(', ')}\n`;
        }
        if (m.related_record_id || m.record_id) {
          text += `Record ID: ${m.related_record_id || m.record_id}\n`;
        }
        return text;
      })
      .join('\n------------------------------------------------------------\n\n');

    navigator.clipboard.writeText(header + body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyReportText = () => {
    const reportText =
      `============================================================\n` +
      `RISK2DATA (R2D) OPERATIONAL DOSSIER & CHRONOLOGY REPORT\n` +
      `============================================================\n\n` +
      `ENTITY: ${record.title}\n` +
      `DATABASE ID: ${record.id}\n` +
      `ENTITY TYPE: ${record.entity_type}\n` +
      `REGIONAL THEATER: ${(record.regions || []).join(', ')}\n` +
      `OPERATIONAL BASE: ${record.location || 'Libya'}\n` +
      `START / INCEPTION: ${record.dob || record.start_date || 'Documented'}\n` +
      `CURRENT STATUS: ${record.is_ongoing !== false ? 'ACTIVE / ONGOING' : 'RESOLVED'}\n` +
      `CONFIDENCE LEVEL: ${record.confidence || 'Verified'}\n\n` +
      `EXECUTIVE ASSESSMENT:\n` +
      `${record.summary}\n\n` +
      `AFFILIATIONS: ${(record.affiliations || []).join(', ') || 'None recorded'}\n` +
      `RIVALRIES: ${(record.rivalries || []).join(', ') || 'None recorded'}\n` +
      `LINKED EVENTS: ${(record.linked_events || []).join(', ') || 'None recorded'}\n\n` +
      `VERIFIED CHRONOLOGICAL TIMELINE (${sortedMilestones.length} Milestones):\n` +
      `------------------------------------------------------------\n` +
      sortedMilestones
        .map(m => `• [${m.date}] (${m.event_type}) ${m.title} — ${m.location || ''}\n  ${m.description}`)
        .join('\n\n') +
      `\n\n============================================================\n` +
      `END OF REPORT — CONFIDENTIAL & PROPRIETARY INTELLIGENCE\n`;

    navigator.clipboard.writeText(reportText);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2500);
  };

  // Color & Badge configuration per event type
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Birth':
        return { bg: 'bg-[#0e2a3b]', text: 'text-[#38bdf8]', border: 'border-[#1b4b72]', dot: 'bg-[#38bdf8]' };
      case 'Formation':
        return { bg: 'bg-[#152a42]', text: 'text-[#60a5fa]', border: 'border-[#2563eb]', dot: 'bg-[#3b82f6]' };
      case 'Military':
      case 'Security':
        return { bg: 'bg-[#261f38]', text: 'text-[#c084fc]', border: 'border-[#6b21a8]', dot: 'bg-[#a855f7]' };
      case 'Clash / Conflict':
        return { bg: 'bg-[#36171f]', text: 'text-[#fb7185]', border: 'border-[#9f1239]', dot: 'bg-[#e11d48]' };
      case 'Political Decision':
      case 'Appointment':
        return { bg: 'bg-[#332512]', text: 'text-[#fbbf24]', border: 'border-[#b45309]', dot: 'bg-[#f59e0b]' };
      case 'Ceasefire / Truce':
        return { bg: 'bg-[#0f2e22]', text: 'text-[#34d399]', border: 'border-[#065f46]', dot: 'bg-[#10b981]' };
      case 'Detention / Release':
        return { bg: 'bg-[#2b1f1d]', text: 'text-[#f97316]', border: 'border-[#9a3412]', dot: 'bg-[#ea580c]' };
      case 'Infrastructure':
        return { bg: 'bg-[#1b2a38]', text: 'text-[#2dd4bf]', border: 'border-[#0f766e]', dot: 'bg-[#14b8a6]' };
      case 'Affiliation':
        return { bg: 'bg-[#102a3a]', text: 'text-[#38bdf8]', border: 'border-[#0369a1]', dot: 'bg-[#0284c7]' };
      case 'Rivalry':
        return { bg: 'bg-[#331818]', text: 'text-[#f87171]', border: 'border-[#b91c1c]', dot: 'bg-[#dc2626]' };
      default:
        return { bg: 'bg-[#1c2433]', text: 'text-[#94a3b8]', border: 'border-[#334155]', dot: 'bg-[#64748b]' };
    }
  };

  const getStageBadge = (stage?: string) => {
    if (!stage) return null;
    switch (stage) {
      case 'start':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#0f2e22] text-[#34d399] border border-[#065f46]">
            Phase: Inception
          </span>
        );
      case 'escalation':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#36171f] text-[#fb7185] border border-[#9f1239]">
            Phase: Escalation
          </span>
        );
      case 'turning_point':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#332512] text-[#fbbf24] border border-[#b45309]">
            Phase: Turning Point
          </span>
        );
      case 'de_escalation':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1b2a38] text-[#2dd4bf] border border-[#0f766e]">
            Phase: De-escalation
          </span>
        );
      case 'end':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#261f38] text-[#c084fc] border border-[#6b21a8]">
            Phase: Conclusion
          </span>
        );
      case 'ongoing':
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1c2e42] text-[#60a5fa] border border-[#2563eb]">
            Phase: Active
          </span>
        );
      default:
        return null;
    }
  };

  // Format multi-region location accurately: e.g. "TRIPOLI — WEST / EAST"
  const renderLocationAndRegion = (location?: string, milestoneRegions?: string[]) => {
    const loc = (location || '').trim();
    const regList = milestoneRegions && milestoneRegions.length > 0 ? milestoneRegions : record.regions || [];
    const regString = regList.join(' / ').toUpperCase();

    if (!loc && !regString) return null;

    const city = loc ? loc.split(',')[0].trim().toUpperCase() : '';

    return (
      <div className="flex items-center gap-1.5 text-[11px] text-[#cbd4e2]">
        <MapPin size={11} className="text-[#e11d48] shrink-0" />
        <span className="font-semibold">{city ? `${city} — ` : ''}</span>
        <span className="px-1.5 py-0.2 rounded bg-[#111823] border border-[#293241] text-[10px] text-[#5b8def] font-mono font-bold">
          {regString || 'NATIONAL'}
        </span>
      </div>
    );
  };

  // Earliest and latest temporal range
  const dateRange = useMemo(() => {
    if (rawMilestones.length === 0) return 'No temporal data';
    const dates = rawMilestones.map(m => m.date).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const isOngoing = record.is_ongoing !== false;
    return `${earliest.slice(0, 4)} — ${isOngoing ? 'Present / Active' : latest.slice(0, 4)}`;
  }, [rawMilestones, record.is_ongoing]);

  // Birth anchor record for person types
  const birthMilestone = useMemo(() => {
    if (!isPerson) return null;
    return rawMilestones.find(m => m.event_type === 'Birth' || m.stage === 'start' && m.title.toLowerCase().includes('birth'));
  }, [isPerson, rawMilestones]);

  return (
    <div className="space-y-5">
      {/* Top Banner & Analytical Control Bar */}
      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Clock size={16} className="text-[#5b8def]" />
              <h3 className="m-0 text-[13px] uppercase tracking-[0.9px] text-[#ffffff] font-bold">
                Chronological Timeline & Tactical History
              </h3>
              <span className="px-2 py-0.5 rounded bg-[#111823] border border-[#293241] text-[10px] text-[#5b8def] font-mono font-bold">
                {rawMilestones.length} Recorded Milestones
              </span>
              {isLoadingServer && (
                <span className="px-2 py-0.5 rounded bg-[#111823] border border-[#3b82f6] text-[10px] text-[#60a5fa] animate-pulse font-mono">
                  Syncing Server Ledger...
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8f9bad] m-0">
              Verified operational trajectory of <strong className="text-[#d8deea]">{record.title}</strong> ({record.entity_type}) across documented milestones, alliances, and engagements.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Temporal Span Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111823] border border-[#293241] rounded-[5px] text-[11px] text-[#cbd4e2]">
              <Calendar size={12} className="text-[#5b8def]" />
              <span className="font-mono font-bold text-[#5b8def]">{dateRange}</span>
            </div>

            {/* Pivot to Network Graph */}
            {onSwitchTab && (
              <button
                id="btn-timeline-to-network"
                onClick={() => onSwitchTab('network')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121c29] hover:bg-[#1a283c] border border-[#253952] text-[#93c5fd] rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer"
                title="Transition directly to relationship network graph"
              >
                <Network size={12} className="text-[#5b8def]" />
                <span>Explore Network</span>
              </button>
            )}

            {/* Generate Report Action */}
            <button
              id="btn-timeline-generate-report"
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2536] hover:bg-[#223147] border border-[#334668] text-white rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer"
              title="Generate full printable chronological dossier report"
            >
              <FileText size={12} className="text-[#38bdf8]" />
              <span>Generate Dossier</span>
            </button>

            {/* Export Chronology Button */}
            <button
              id="btn-export-chronology"
              onClick={handleExportChronology}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2536] hover:bg-[#223147] border border-[#334668] text-white rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer"
              title="Copy verified chronological dossier to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-[#34d399]" />
                  <span className="text-[#34d399]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="text-[#5b8def]" />
                  <span>Copy Feed</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-4 pt-4 border-t border-[#232b38] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#657084]" />
              <input
                id="input-timeline-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search milestones, locations, entities, sources..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#111720] border border-[#293241] rounded-[5px] text-[11px] text-[#d8deea] placeholder-[#657084] focus:outline-none focus:border-[#5b8def]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8f9bad] hover:text-white"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort Order */}
            <button
              id="btn-timeline-sort"
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#111720] border border-[#293241] rounded-[5px] text-[11px] text-[#8f9bad] hover:text-white transition-colors cursor-pointer"
              title={`Sorting: ${sortOrder === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}`}
            >
              <ArrowUpDown size={12} />
              <span className="font-bold">{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Region Filter Selector */}
            <div className="flex items-center gap-1 px-2 py-1 bg-[#111720] border border-[#293241] rounded-[5px]">
              <MapPin size={11} className="text-[#657084]" />
              <select
                id="select-timeline-region"
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="bg-transparent text-[11px] text-[#cbd4e2] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#171d27]">All Regions</option>
                {['West', 'East', 'South', 'National'].map(reg => (
                  <option key={reg} value={reg} className="bg-[#171d27]">
                    {reg} Region
                  </option>
                ))}
              </select>
            </div>

            {/* Major Only Toggle */}
            <button
              id="btn-timeline-major-toggle"
              onClick={() => setMajorOnly(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] text-[11px] font-bold border transition-colors cursor-pointer ${
                majorOnly
                  ? 'bg-[#3b2b1a] border-[#b45309] text-[#fbbf24]'
                  : 'bg-[#111720] border-[#293241] text-[#8f9bad] hover:text-[#d8deea]'
              }`}
            >
              <Flag size={11} className={majorOnly ? 'text-[#fbbf24]' : 'text-[#657084]'} />
              Major Only
            </button>

            {/* Expand / Collapse All */}
            <button
              id="btn-timeline-expand-all"
              onClick={expandedMilestones.size > 0 ? collapseAll : expandAll}
              className="px-2.5 py-1.5 bg-[#111720] border border-[#293241] rounded-[5px] text-[11px] text-[#8f9bad] hover:text-white transition-colors font-bold cursor-pointer"
            >
              {expandedMilestones.size > 0 ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        {/* Event Type Filter Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            id="filter-type-all"
            onClick={() => setSelectedType('all')}
            className={`px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
              selectedType === 'all'
                ? 'bg-[#5b8def] text-white'
                : 'bg-[#111823] text-[#8f9bad] hover:bg-[#182333] border border-[#293241]'
            }`}
          >
            All Types ({rawMilestones.length})
          </button>
          {availableTypes.map(t => {
            const count = rawMilestones.filter(m => m.event_type === t).length;
            const badge = getTypeBadge(t);
            const isSelected = selectedType === t;
            return (
              <button
                key={t}
                id={`filter-type-${t.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => setSelectedType(isSelected ? 'all' : t)}
                className={`flex items-center gap-1 px-2 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors border ${
                  isSelected
                    ? `${badge.bg} ${badge.text} ${badge.border} ring-1 ring-white/20`
                    : 'bg-[#111823] text-[#8f9bad] border-[#293241] hover:text-[#d8deea]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                {t} ({count})
              </button>
            );
          })}
        </div>

        {/* Year Quick-Jump Rail */}
        {allYears.length > 1 && (
          <div className="mt-2.5 pt-2.5 border-t border-[#1c2431] flex items-center gap-1 flex-wrap">
            <span className="text-[9px] uppercase font-bold text-[#657084] mr-1 flex items-center gap-1">
              <Clock size={10} /> Year Rail:
            </span>
            {allYears.map(yr => (
              <a
                key={yr}
                href={`#year-group-${yr}`}
                className="px-2 py-0.5 bg-[#11161f] hover:bg-[#1f2b3e] border border-[#222c3b] hover:border-[#3d5477] text-[#93a1b8] hover:text-[#5b8def] text-[10px] font-mono rounded font-bold transition-colors"
              >
                {yr}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Person Entity Inception Anchor Card (Birth) */}
      {isPerson && record.dob && (
        <div className="bg-[#111a26] border border-[#1b3552] rounded-[7px] p-3.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#162d47] border border-[#2563eb] flex items-center justify-center text-[#38bdf8] font-bold">
              <User size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#0e2a3b] text-[#38bdf8] rounded border border-[#1b4b72]">
                  BIRTH: {record.dob}
                </span>
                <span className="text-[11px] font-bold text-white">Biographical Baseline & Civil Origin</span>
              </div>
              <p className="text-[10px] text-[#8f9bad] m-0 mt-0.5">
                Initial documented anchor for {record.title} recorded in {record.location || 'Libya'}.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#5b8def] bg-[#172233] px-2 py-1 rounded border border-[#23354d]">
            ORIGIN ANCHOR
          </span>
        </div>
      )}

      {/* Group Entity Inception Anchor Card (Formation) */}
      {isGroup && record.start_date && (
        <div className="bg-[#121c2a] border border-[#1e3b5e] rounded-[7px] p-3.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1b2f48] border border-[#3b82f6] flex items-center justify-center text-[#60a5fa] font-bold">
              <Building2 size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#152a42] text-[#60a5fa] rounded border border-[#2563eb]">
                  FORMATION: {record.start_date}
                </span>
                <span className="text-[11px] font-bold text-white">Establishment & Armed Activation</span>
              </div>
              <p className="text-[10px] text-[#8f9bad] m-0 mt-0.5">
                Initial organizational mobilization and territory assertion in {record.location || 'Libyan Theater'}.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#60a5fa] bg-[#172233] px-2 py-1 rounded border border-[#23354d]">
            FORMATION ANCHOR
          </span>
        </div>
      )}

      {/* Main Vertical Timeline */}
      {filteredMilestones.length === 0 ? (
        <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-8 text-center">
          <Clock size={36} className="text-[#465267] mx-auto mb-3" />
          <p className="text-[13px] font-bold text-[#cbd4e2] m-0">No timeline records available.</p>
          <p className="text-[11px] text-[#657084] mt-1">
            {rawMilestones.length === 0
              ? 'No verified chronological events or historical records documented for this entity under current analytical clearance.'
              : 'No milestones match your currently selected filters. Adjust event type, region, or search query.'}
          </p>
          {rawMilestones.length > 0 && (
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedRegion('all');
                setMajorOnly(false);
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 bg-[#1c2433] hover:bg-[#253247] border border-[#293241] text-[#5b8def] text-[11px] font-bold rounded cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative pl-6 md:pl-10 space-y-8 before:content-[''] before:absolute before:left-3 md:before:left-5 before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-[#5b8def] before:via-[#293241] before:to-[#1e2736]">
          {(Object.entries(groupedByYear) as [string, TimelineMilestone[]][]).map(([year, milestones]) => (
            <div key={year} id={`year-group-${year}`} className="relative">
              {/* Year Header Marker */}
              <div className="flex items-center gap-3 mb-4 -ml-6 md:-ml-10">
                <div className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-[#111823] border-2 border-[#5b8def] flex items-center justify-center text-white shadow-lg shrink-0 z-10">
                  <Calendar size={14} className="text-[#5b8def]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold font-mono tracking-wider text-white bg-[#171d27] px-3 py-0.5 rounded border border-[#293241]">
                    {year}
                  </span>
                  <span className="text-[10px] text-[#657084] uppercase tracking-wider font-bold">
                    {milestones.length} {milestones.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
              </div>

              {/* Milestones in this year */}
              <div className="space-y-4">
                {milestones.map(milestone => {
                  const badge = getTypeBadge(milestone.event_type);
                  const isExpanded = expandedMilestones.has(milestone.id);
                  const recordLink = milestone.source_record_id || milestone.entity_id;

                  return (
                    <div
                      key={milestone.id}
                      id={`milestone-${milestone.id}`}
                      className="relative bg-[#171d27] hover:bg-[#1a2230] border border-[#293241] hover:border-[#3e4f6a] rounded-[7px] p-[16px] transition-all shadow-md"
                    >
                      {/* Left Dot Node on the vertical rail */}
                      <div
                        className={`absolute -left-[27px] md:-left-[43px] top-6 w-3 h-3 rounded-full border-2 border-[#111823] ${badge.dot} shadow-sm`}
                      />

                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            {/* Date Badge */}
                            <span className="font-mono text-[11px] font-bold text-[#5b8def] bg-[#111823] px-2 py-0.5 rounded border border-[#293241] flex items-center gap-1">
                              <Calendar size={11} />
                              {milestone.date}
                              {milestone.date_precision && milestone.date_precision !== 'exact' && (
                                <span className="text-[9px] text-[#8f9bad] uppercase">({milestone.date_precision})</span>
                              )}
                            </span>

                            {/* Event Type Badge */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {milestone.event_type}
                            </span>

                            {/* Stage Badge */}
                            {getStageBadge(milestone.stage)}

                            {/* Major Milestone Badge */}
                            {milestone.is_major && (
                              <span className="px-1.5 py-0.5 rounded bg-[#332512] text-[#fbbf24] border border-[#b45309] text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Flag size={9} /> Major
                              </span>
                            )}
                          </div>

                          {/* Milestone Title */}
                          <h4 className="text-[13px] font-bold text-white m-0 leading-snug">
                            {milestone.title}
                          </h4>
                        </div>

                        {/* Expand / Collapse Button */}
                        <button
                          onClick={() => toggleExpand(milestone.id)}
                          className="self-start text-[#8f9bad] hover:text-white p-1 hover:bg-[#111823] rounded transition-colors cursor-pointer shrink-0"
                          title={isExpanded ? 'Collapse details' : 'Expand full intelligence details'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {/* Location and Multi-Region Row */}
                      <div className="mt-2">
                        {renderLocationAndRegion(milestone.location, milestone.regions)}
                      </div>

                      {/* Description Summary */}
                      <p className="mt-2.5 text-[12px] text-[#d8deea] leading-[1.6] m-0">
                        {milestone.description}
                      </p>

                      {/* Related Entities and Action Row */}
                      <div className="mt-3 pt-2.5 border-t border-[#222a36] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Associated Metadata */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            milestone.origin === 'auto' 
                              ? 'bg-[#0f172a] text-[#5b8def] border-[#1e293b]' 
                              : 'bg-[#064e3b] text-[#34d399] border-[#065f46]'
                          }`}>
                            {milestone.origin} Node
                          </span>

                          {milestone.confidence && (
                            <span className="px-1.5 py-0.5 rounded bg-[#111823] border border-[#293241] text-[9px] text-[#8f9bad] uppercase font-bold">
                              Confidence: {milestone.confidence}
                            </span>
                          )}
                        </div>

                        {/* Explicit Record Link Button */}
                        {recordLink && onSelectRecord && (
                          <button
                            onClick={() => onSelectRecord(recordLink)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#121c29] hover:bg-[#1a283c] border border-[#253952] text-[#5b8def] hover:text-[#93c5fd] rounded text-[10px] font-bold transition-colors cursor-pointer self-start sm:self-auto"
                            title={`Open database record ${recordLink}`}
                          >
                            <FileText size={10} />
                            <span>VIEW SOURCE [{recordLink}] →</span>
                          </button>
                        )}
                      </div>

                      {/* Expanded Intelligence Verification Section */}
                      {isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-[#232b38] bg-[#111720] rounded p-3 text-[11px] space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8f9bad]">
                            <span className="flex items-center gap-1 text-[#5b8def]">
                              <Shield size={11} /> Source Verification & Provenance
                            </span>
                            <span className="flex items-center gap-1">
                              Confidence:{' '}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  milestone.confidence === 'Verified'
                                    ? 'bg-[#0f2e22] text-[#34d399] border border-[#065f46]'
                                    : 'bg-[#152a42] text-[#60a5fa] border border-[#2563eb]'
                                }`}
                              >
                                {milestone.confidence || 'Verified'}
                              </span>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[#cbd4e2]">
                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Primary Source Reference
                              </span>
                              <span className="font-mono text-[10px] text-[#d8deea]">
                                {milestone.source || 'R2D Tactical Intelligence Archive'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase font-bold text-[#657084]">
                                Logging / Publication Date
                              </span>
                              <span className="font-mono text-[10px] text-[#d8deea]">
                                {milestone.source_date || milestone.date}
                              </span>
                            </div>
                          </div>

                          {recordLink && (
                            <div className="pt-2 border-t border-[#1c2431] flex items-center justify-between">
                              <span className="text-[10px] text-[#8f9bad]">Linked Database Record ID:</span>
                              <button
                                onClick={() => onSelectRecord && onSelectRecord(recordLink)}
                                className="text-[#5b8def] hover:underline font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                {recordLink}
                                <ExternalLink size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Printable / Exportable Dossier Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121721] border border-[#293241] rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#293241] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#5b8def]" />
                <div>
                  <h3 className="m-0 text-[14px] font-bold uppercase tracking-wider text-white">
                    Operational Intelligence Dossier Report
                  </h3>
                  <span className="text-[10px] font-mono text-[#8f9bad]">
                    REF: {record.id} — CLASSIFIED CLIENT OUTPUT
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-[#8f9bad] hover:text-white p-1 rounded hover:bg-[#1a2230] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-[12px] text-[#cbd4e2] font-mono">
              {/* Report Header Block */}
              <div className="border border-[#293241] bg-[#171d27] p-4 rounded">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="block text-[#657084] text-[9px] uppercase font-bold">Target Entity</span>
                    <strong className="text-white text-[13px]">{record.title}</strong>
                  </div>
                  <div>
                    <span className="block text-[#657084] text-[9px] uppercase font-bold">Entity Classification</span>
                    <span className="text-[#5b8def]">{record.entity_type}</span>
                  </div>
                  <div>
                    <span className="block text-[#657084] text-[9px] uppercase font-bold">Theaters / Regions</span>
                    <span>{(record.regions || []).join(', ')}</span>
                  </div>
                  <div>
                    <span className="block text-[#657084] text-[9px] uppercase font-bold">Temporal Span</span>
                    <span className="text-[#34d399]">{dateRange}</span>
                  </div>
                </div>
              </div>

              {/* Summary Assessment */}
              <div>
                <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#5b8def] mb-1.5">
                  Executive Threat Assessment
                </h4>
                <div className="bg-[#171d27] border-l-2 border-[#5b8def] p-3 rounded-r text-[#d8deea] leading-relaxed text-[11px]">
                  {record.summary}
                </div>
              </div>

              {/* Chronological Table */}
              <div>
                <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#5b8def] mb-2 flex items-center justify-between">
                  <span>Verified Chronological Milestones ({sortedMilestones.length})</span>
                  <span className="text-[10px] text-[#657084] font-normal">Earliest to Present</span>
                </h4>
                <div className="border border-[#293241] rounded overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#171d27] border-b border-[#293241] text-[#8f9bad]">
                        <th className="p-2">Date</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Milestone</th>
                        <th className="p-2">Location</th>
                        <th className="p-2">Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232b38]">
                      {sortedMilestones.map(m => (
                        <tr key={m.id} className="hover:bg-[#151c27]">
                          <td className="p-2 text-[#5b8def] whitespace-nowrap">{m.date}</td>
                          <td className="p-2 text-[#cbd4e2] whitespace-nowrap">{m.event_type}</td>
                          <td className="p-2 text-white">
                            <span className="font-bold">{m.title}</span>
                            <span className="block text-[10px] text-[#8f9bad] mt-0.5 line-clamp-1">{m.description}</span>
                          </td>
                          <td className="p-2 text-[#8f9bad] whitespace-nowrap">{m.location || 'Libya'}</td>
                          <td className="p-2 text-[#5b8def] whitespace-nowrap font-mono">{m.related_record_id || m.record_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#293241] flex items-center justify-between bg-[#151c27]">
              <span className="text-[10px] text-[#657084]">
                CONFIDENTIAL — RISK2DATA INTELLIGENCE NETWORK
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReportText}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1b2536] hover:bg-[#223147] border border-[#334668] text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  {reportCopied ? <Check size={12} className="text-[#34d399]" /> : <Copy size={12} />}
                  <span>{reportCopied ? 'Report Copied' : 'Copy Text'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#5b8def] hover:bg-[#4375d8] text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  <Printer size={12} />
                  <span>Print Dossier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineView;

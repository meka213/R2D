import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Search, 
  LogOut, 
  MapPin, 
  ChevronRight, 
  Activity, 
  Filter,
  Layers,
  Database,
  Lock,
  ArrowLeft
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

interface ClientPortalProps {
  onLogout: () => void;
}

export default function ClientPortal({ onLogout }: ClientPortalProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: accessKeyInput.toUpperCase() })
      });
      if (res.ok) {
        const clientData = await res.json();
        setClient(clientData);
        fetchRecords(clientData.access_key);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Invalid Intelligence Access Key');
      }
    } catch (err) {
      setError('Connection failure');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (key: string) => {
    try {
      const res = await fetch('/api/client/records', {
        headers: { 'x-access-key': key }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        if (data.length > 0) setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch records');
    }
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0b0e13] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#121720] border border-[#293241] rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#1a2a49] border border-[#5b8def] rounded-xl flex items-center justify-center mx-auto mb-4 text-[#5b8def]">
              <Lock size={28} />
            </div>
            <h1 className="text-2xl font-bold text-[#e7ebf2] mb-2">Secure Client Access</h1>
            <p className="text-[#8f9bad] text-sm">Enter your agency access key to view your specific intelligence feed.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#8f9bad] uppercase tracking-widest ml-1">Access Key</label>
              <input 
                type="text"
                required
                autoFocus
                value={accessKeyInput}
                onChange={e => setAccessKeyInput(e.target.value)}
                placeholder="e.g. A1B2C3D4"
                className="w-full bg-[#0b0e13] border border-[#293241] rounded-xl p-4 text-center text-xl font-mono text-[#5b8def] outline-none focus:border-[#456bb8] transition-colors tracking-widest placeholder:text-[#1e2735]"
              />
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
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
              {loading ? 'AUTHENTICATING...' : (
                <>
                  INITIALIZE PORTAL ACCESS
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

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

  const filteredRecords = records.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    r.region.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRecord = records.find(r => r.id === selectedId);

  return (
    <div className="min-h-screen bg-[#0b0e13] text-[#e7ebf2] font-sans">
      <div className="max-w-[1600px] mx-auto p-[22px_26px_40px]">
        {/* Header */}
        <div className="flex items-end justify-between mb-[18px]">
          <div className="brand">
            <h1 className="m-0 text-[21px] tracking-[-0.3px] font-bold">LIBYA SECURITY INTELLIGENCE</h1>
            <p className="m-[5px_0_0] text-[#8f9bad] text-[12px] uppercase tracking-wider font-semibold">
              {client.name} • {client.id}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#aeb8c8] text-[12px]">
              <span className="w-[7px] h-[7px] bg-[#57b981] rounded-full animate-pulse"></span>
              Secure Active Session
            </div>
            <button 
              onClick={onLogout}
              className="bg-transparent text-[#8f9bad] hover:text-[#d96a73] transition-colors p-0 font-bold text-xs flex items-center gap-2"
            >
              <LogOut size={16} /> LOGOUT
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-[10px] mb-[18px]">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8f9bad]" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actors, commanders, locations, events or relationships..."
              className="w-full bg-[#151a22] border border-[#293241] rounded-[7px] text-[#e7ebf2] p-[13px_15px_13px_45px] text-[14px] outline-none focus:border-[#456bb8] transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-[16px]">
          <main className="bg-[#121720] border border-[#293241] rounded-[8px] overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedRecord ? (
                <motion.div
                  key={selectedRecord.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Hero */}
                  <section className="p-[20px_21px_17px]">
                    <div className="flex justify-between gap-[20px]">
                      <div>
                        <h2 className="m-0 text-[22px] font-bold tracking-tight">{selectedRecord.title}</h2>
                        <div className="mt-[5px] text-[#8f9bad] font-medium">
                          {selectedRecord.entity_type} • {selectedRecord.regions.join(', ')}
                        </div>
                      </div>
                      <div className="text-[11px] color-[#d9ffe8] bg-[#143f2a] border border-[#286f49] p-[5px_9px] rounded-[14px] h-fit font-bold uppercase tracking-wider">
                        Active Record
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-[9px] mt-[18px]">
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">{selectedRecord.linked_events?.length || 0}</div>
                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">Events</div>
                      </div>
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">{selectedRecord.tags.length}</div>
                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">Tags</div>
                      </div>
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">{client.allowed_regions.length}</div>
                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">Regions</div>
                      </div>
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold">{records.length}</div>
                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">Feed Items</div>
                      </div>
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[11px]">
                        <div className="text-[18px] font-bold text-[#57b981]">Verified</div>
                        <div className="text-[10px] text-[#8f9bad] mt-[3px] uppercase tracking-[0.6px] font-bold">Intelligence</div>
                      </div>
                    </div>
                  </section>

                  {/* Tabs */}
                  <nav className="flex border-b border-[#293241] p-[0_20px]">
                    {['overview', 'network', 'sources'].map(tab => (
                      <div 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`p-[13px_15px] text-[12px] cursor-pointer border-b-2 transition-all font-bold uppercase tracking-widest ${
                          activeTab === tab ? 'text-white border-[#5b8def]' : 'text-[#8f9bad] border-transparent'
                        }`}
                      >
                        {tab}
                      </div>
                    ))}
                  </nav>

                  {/* Content */}
                  <section className="p-[20px]">
                    {activeTab === 'overview' && (
                      <div className="grid grid-cols-1 md:grid-cols-[1.25fr_0.75fr] gap-[15px]">
                        <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">
                          <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Intelligence assessment</h3>
                          <div className="border-l-[3px] border-[#5b8def] p-[12px_14px] bg-[#111823] text-[#d8deea] leading-[1.6] rounded-[0_5px_5px_0] mb-6">
                            {selectedRecord.summary}
                          </div>
                          <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Core assessment</h3>
                          <div className="leading-[1.65] color-[#cbd2de] text-[13px] flex flex-wrap gap-2">
                            {selectedRecord.affiliations.map(aff => (
                              <span key={aff} className="p-[4px_8px] bg-[#111823] border border-[#293241] rounded-[4px] text-[12px]">{aff}</span>
                            ))}
                            {selectedRecord.affiliations.length === 0 && <span>No significant networks identified.</span>}
                          </div>
                        </div>

                        <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">
                          <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Key metadata</h3>
                          <div className="grid grid-cols-2 gap-[8px]">
                            <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                              <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Regions</small>
                              <b className="block mt-[3px] text-[11px]">{selectedRecord.regions.join(', ')}</b>
                            </div>
                            <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                              <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Status</small>
                              <b className="block mt-[3px] text-[11px]">Active</b>
                            </div>
                            <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                              <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Confidence</small>
                              <b className="block mt-[3px] text-[11px] text-[#57b981]">High</b>
                            </div>
                            <div className="p-[9px] bg-[#11161e] border border-[#293241] rounded-[6px]">
                              <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Last Reviewed</small>
                              <b className="block mt-[3px] text-[11px]">{new Date(selectedRecord.updated_at).toLocaleDateString()}</b>
                            </div>
                          </div>
                          <h3 className="m-[18px_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Relationships</h3>
                          <div className="flex flex-wrap gap-[7px]">
                            {selectedRecord.tags.map(tag => (
                              <span key={tag} className="p-[5px_8px] rounded-[12px] border border-[#293241] text-[11px] text-[#bfc8d8] font-semibold">
                                {tag}
                              </span>
                            ))}
                            {selectedRecord.rivalries.map(riv => (
                              <span key={riv} className="p-[5px_8px] rounded-[12px] border border-[#714047] text-[#ef9aa1] text-[11px] font-semibold">
                                {riv}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'network' && (
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">
                         <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Interactive relationship network</h3>
                         <div className="h-[420px] relative overflow-hidden bg-[radial-gradient(circle_at_center,#18202d_0,#111720_48%,#10151d_100%)] border border-[#293241] rounded-[7px]">
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 420" preserveAspectRatio="none">
                                <line x1="400" y1="205" x2="120" y2="85" stroke="#53647f" strokeWidth="1.2" opacity="0.8" />
                                <line x1="400" y1="205" x2="680" y2="85" stroke="#53647f" strokeWidth="1.2" opacity="0.8" />
                                <line x1="400" y1="205" x2="110" y2="330" stroke="#53647f" strokeWidth="1.2" opacity="0.8" />
                                <line x1="400" y1="205" x2="690" y2="330" stroke="#53647f" strokeWidth="1.2" opacity="0.8" />
                                <line x1="400" y1="205" x2="400" y2="50" stroke="#53647f" strokeWidth="1.2" opacity="0.8" />
                            </svg>
                            <div className="absolute left-[43%] top-[44%] p-[9px_12px] border border-[#5b8def] bg-[#1a2a49] rounded-[7px] text-[11px] font-bold shadow-2xl z-10">{selectedRecord.title}</div>
                            <div className="absolute left-[10%] top-[18%] p-[9px_12px] border border-[#3a4a64] bg-[#182130] rounded-[7px] text-[11px] text-[#e7ebf2]">{selectedRecord.entity_type}</div>
                            <div className="absolute right-[10%] top-[17%] p-[9px_12px] border border-[#3a4a64] bg-[#182130] rounded-[7px] text-[11px] text-[#e7ebf2]">{selectedRecord.regions[0]}</div>
                            <div className="absolute left-[8%] bottom-[18%] p-[9px_12px] border border-[#3a4a64] bg-[#182130] rounded-[7px] text-[11px] text-[#e7ebf2]">{selectedRecord.rivalries[0] || 'Strategic Rivalries'}</div>
                            <div className="absolute right-[8%] bottom-[18%] p-[9px_12px] border border-[#3a4a64] bg-[#182130] rounded-[7px] text-[11px] text-[#e7ebf2]">Related Events</div>
                         </div>
                      </div>
                    )}

                    {activeTab === 'sources' && (
                      <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[16px]">
                        <h3 className="m-[0_0_11px] text-[12px] uppercase tracking-[0.8px] text-[#b8c2d2] font-bold">Sources & provenance</h3>
                        <div className="leading-[1.65] color-[#cbd2de] text-[13px]">
                          This intelligence assessment is derived from structured tactical data and open-source monitoring within the {selectedRecord.regions.join(', ')} regions. Confidence level is high based on cross-referencing of command networks and reported events.
                        </div>
                      </div>
                    )}
                  </section>
                </motion.div>
              ) : (
                <div className="p-20 text-center opacity-30">
                  <Database size={64} className="mx-auto mb-4" />
                  <p>Initializing intelligence stream...</p>
                </div>
              )}
            </AnimatePresence>
          </main>

          <aside className="bg-[#121720] border border-[#293241] rounded-[8px] p-[15px] flex flex-col gap-[12px] overflow-hidden">
            <div className="bg-[#171d27] border border-[#293241] rounded-[7px] p-[12px] mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5b8def] mb-3">Your Intelligence Access</h3>
              <div className="space-y-3">
                <div>
                  <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Authorized Regions</small>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.allowed_regions.map(r => (
                      <span key={r} className="text-[10px] font-bold text-[#e7ebf2]">{r}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <small className="block text-[#8f9bad] text-[9px] uppercase font-bold">Account Expires</small>
                  <b className="text-[11px] text-[#d96a73]">{new Date(client.expires_at).toLocaleDateString()}</b>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="m-0 text-[13px] font-bold uppercase tracking-wider text-[#b8c2d2]">Related entities</h3>
              <span className="text-[10px] bg-[#24334d] color-[#a9c2ff] p-[4px_7px] rounded-[10px] font-bold">{filteredRecords.length}</span>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-[9px] custom-scrollbar">
              {filteredRecords.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left p-[12px] bg-[#171d27] border rounded-[7px] transition-all group ${
                    selectedId === r.id ? 'border-[#5b8def]' : 'border-[#293241] hover:border-[#456bb8]'
                  }`}
                >
                  <div className="font-bold text-[#dfe6f1] group-hover:text-[#5b8def] transition-colors">{r.title}</div>
                  <div className="text-[9px] text-[#9db5e9] mt-[5px] uppercase tracking-[0.7px] font-bold">{r.entity_type}</div>
                  <p className="text-[10.5px] text-[#8f9bad] leading-[1.45] m-[7px_0_0] line-clamp-2">{r.summary}</p>
                </button>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-[15px] text-[#657084] text-[10px] flex justify-between font-semibold">
          <span>{client.name} • SECURE ACCESS PORTAL</span>
          <span>© 2026 RISK2DATA • DATA REFRESH: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #293241; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5b8def; }
      `}</style>
    </div>
  );
}

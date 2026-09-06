/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ChevronRight, Check, Zap, Database, Globe, Network, Cpu, Lock, Search, X } from 'lucide-react';

interface LandingPageProps {
  onEnterPortal: () => void;
}

export default function LandingPage({ onEnterPortal }: LandingPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', organization: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', organization: '', message: '' });
        setTimeout(() => {
          setIsModalOpen(false);
          setSubmitStatus('idle');
        }, 3000);
      } else {
        setSubmitStatus('error');
      }
    } catch (err) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b10] text-[#edf3fb] font-sans selection:bg-[#5d8ff2]/30">
      {/* Navigation */}
      <nav className="h-[70px] border-b border-white/5 sticky top-0 z-50 bg-[#080b10]/85 backdrop-blur-md">
        <div className="max-w-[1160px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 font-extrabold text-lg">
            <div className="w-[29px] h-[29px] border border-[#4869a4] rounded-lg bg-[#101a2b] grid place-items-center text-[#9dbaff] text-[8px]">
              R2D
            </div>
            Risk2Data
          </div>
          <div className="hidden md:flex gap-[25px] text-[#aab5c5] text-[12px] font-medium">
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#model" className="hover:text-white transition-colors">Data Model</a>
            <a href="#api" className="hover:text-white transition-colors">API</a>
            <a href="#coverage" className="hover:text-white transition-colors">Coverage</a>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onEnterPortal}
              className="px-3.5 py-2 text-[#7d8b9e] text-[11px] font-bold hover:text-white transition-all cursor-pointer"
            >
              Client Login
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 border border-[#38558a] rounded-lg bg-[#101a2b] text-[#cfe0ff] text-[11px] font-bold hover:border-[#5d8ff2] transition-all cursor-pointer"
            >
              Request a Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-white/5 py-[105px]">
        {/* Background Grid & Glow */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#5d8ff20b 1px, transparent 1px), linear-gradient(90deg, #5d8ff20b 1px, transparent 1px)', backgroundSize: '56px 56px' }}></div>
          <div className="absolute w-[500px] h-[500px] -right-[180px] -top-[100px] bg-radial-gradient from-[#4774c52b] to-transparent opacity-60"></div>
        </div>

        <div className="max-w-[1160px] mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-[60px] items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-[17px]">
              Structured security data · Libya
            </div>
            <h1 className="text-[clamp(43px,6vw,68px)] leading-[1.02] tracking-[-2.8px] font-bold mb-[22px]">
              Turn Libya risk information into an <span className="text-[#91aeed]">intelligence network.</span>
            </h1>
            <p className="text-[17px] text-[#aeb9c8] max-w-[650px] leading-[1.75] font-medium">
              Risk2Data connects security actors, commanders, organisations, locations, events, affiliations and political objectives into structured, queryable data — built for risk teams, analysts and security platforms.
            </p>
            <div className="flex flex-wrap gap-[11px] mt-[28px]">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-[17px] py-[11px] rounded-lg bg-[#5d8ff2] border border-[#5d8ff2] text-white text-[12px] font-bold hover:opacity-90 transition-all cursor-pointer"
              >
                Request a Demo →
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-[17px] py-[11px] rounded-lg bg-[#111821] border border-[#283442] text-white text-[12px] font-bold hover:bg-[#151d27] transition-all cursor-pointer"
              >
                Discuss API Access
              </button>
            </div>
            <div className="text-[#6f7b8c] text-[10px] mt-[14px]">
              Designed for integration into existing analytical workflows and platforms.
            </div>
          </motion.div>

          {/* Console Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#0f151d] border border-[#2b3746] rounded-xl shadow-[0_28px_70px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="h-[40px] border-b border-[#283442] flex items-center gap-[6px] px-[13px]">
              <div className="w-[7px] h-[7px] rounded-full bg-[#3c4654]"></div>
              <div className="w-[7px] h-[7px] rounded-full bg-[#3c4654]"></div>
              <div className="w-[7px] h-[7px] rounded-full bg-[#3c4654]"></div>
              <div className="ml-[7px] text-[#788597] text-[9px] font-medium">risk2data / intelligence-search</div>
            </div>
            <div className="p-[17px]">
              <div className="bg-[#0c1219] border border-[#344155] rounded-md p-[9px_11px] text-[#8795a8] text-[10px] mb-[15px] flex items-center gap-2">
                <Search size={12} />
                Search actors, commanders, locations, events or relationships...
              </div>
              <div className="flex justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold m-0">Entity Intelligence Record</h3>
                  <div className="text-[9px] text-[#778496]">Actor · Western Libya</div>
                </div>
                <div className="text-[8px] text-[#a9f0c8] border border-[#2b704a] bg-[#10291d] rounded-full px-[7px] py-[4px] h-fit font-bold">
                  ACTIVE
                </div>
              </div>
              <div className="grid grid-cols-4 gap-[6px] mb-[14px]">
                {[
                  { n: '7', l: 'Related' },
                  { n: '4', l: 'Events' },
                  { n: '6', l: 'Affiliations' },
                  { n: 'High', l: 'Confidence' }
                ].map(m => (
                  <div key={m.l} className="bg-[#151d27] border border-[#283442] rounded-md p-[8px] text-center">
                    <b className="text-sm block">{m.n}</b>
                    <small className="block text-[#738095] text-[7px] uppercase tracking-wider">{m.l}</small>
                  </div>
                ))}
              </div>
              <div className="h-[190px] border border-[#283442] rounded-md relative bg-[radial-gradient(circle,#182332,#0f151d_70%)] overflow-hidden">
                <svg className="absolute inset-0 w-full h-full opacity-40">
                  <line x1="50%" y1="50%" x2="10%" y2="20%" stroke="#52647f" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="90%" y2="20%" stroke="#52647f" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="10%" y2="80%" stroke="#52647f" strokeWidth="1" />
                  <line x1="50%" y1="50%" x2="90%" y2="80%" stroke="#52647f" strokeWidth="1" />
                </svg>
                <div className="absolute left-[40%] top-[42%] bg-[#1b3157] border border-[#5d8ff2] rounded-md px-2 py-1 text-[8px] font-extrabold text-[#c9d5e7] whitespace-nowrap">PRIMARY ACTOR</div>
                <div className="absolute left-[8%] top-[15%] bg-[#182331] border border-[#3b526f] rounded-md px-2 py-1 text-[8px] text-[#c9d5e7]">Commander</div>
                <div className="absolute right-[7%] top-[16%] bg-[#182331] border border-[#3b526f] rounded-md px-2 py-1 text-[8px] text-[#c9d5e7]">Affiliated group</div>
                <div className="absolute left-[6%] bottom-[15%] bg-[#182331] border border-[#3b526f] rounded-md px-2 py-1 text-[8px] text-[#c9d5e7]">Rival / relationship</div>
                <div className="absolute right-[6%] bottom-[15%] bg-[#182331] border border-[#3b526f] rounded-md px-2 py-1 text-[8px] text-[#c9d5e7]">Historical event</div>
              </div>
              <div className="flex justify-between text-[#647184] text-[8px] mt-[9px] font-medium">
                <span>Network relationships</span>
                <span>Sources · Assessment · Review</span>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Capabilities */}
      <section className="py-[92px] border-b border-white/5" id="capabilities">
        <div className="max-w-[1160px] mx-auto px-6">
          <div className="max-w-[700px] mb-[38px]">
            <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-2">What Risk2Data provides</div>
            <h2 className="text-[35px] leading-[1.15] tracking-[-1.3px] font-bold mb-[12px]">From fragmented information to a connected picture.</h2>
            <p className="text-[#96a3b4] text-[14px] leading-relaxed">The platform is built around relationships, not isolated records. Users can move from an actor to the people, organisations, places and events connected to it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[13px]">
            {[
              { id: '01', t: 'Entity Intelligence', d: 'Structured records for security actors, commanders, organisations, locations, events and other relevant entities.' },
              { id: '02', t: 'Network Mapping', d: 'Explore affiliations, command relationships, operational links, geographic connections and rivalries through a relationship model.' },
              { id: '03', t: 'Political & Strategic Context', d: 'Connect actors and organisations to political objectives, roles, strategic postures and relevant context.' },
              { id: '04', t: 'Event Context', d: 'Link people and organisations to historical and security events so an event can be examined in its wider network.' },
              { id: '05', t: 'Assessment & Confidence', d: 'Support records with confidence and assessment fields so users can distinguish structured information from analytical judgement.' },
              { id: '06', t: 'API Integration', d: 'Expose structured Libya data through an API so it can be incorporated into existing analytical products and workflows.' }
            ].map(f => (
              <div key={f.id} className="bg-[#111821] border border-[#283442] rounded-lg p-[22px] min-h-[190px]">
                <div className="w-[32px] h-[32px] border border-[#334b72] bg-[#101a29] rounded-lg grid place-items-center text-[#9ab5f3] text-[10px] font-bold mb-[17px]">
                  {f.id}
                </div>
                <h3 className="text-[14px] font-bold mb-[7px]">{f.t}</h3>
                <p className="text-[12px] text-[#8f9bac] leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Model */}
      <section className="py-[92px] border-b border-white/5" id="model">
        <div className="max-w-[1160px] mx-auto px-6">
          <div className="max-w-[700px] mb-[38px]">
            <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-2">The data model</div>
            <h2 className="text-[35px] leading-[1.15] tracking-[-1.3px] font-bold mb-[12px]">One entity. Multiple dimensions.</h2>
            <p className="text-[#96a3b4] text-[14px] leading-relaxed">Risk2Data is designed to preserve the connections between the things analysts need to understand.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-[#111821] border border-[#283442] rounded-lg overflow-hidden">
            {[
              { t: 'Actors', s: 'Security & armed formations' },
              { t: 'People', s: 'Commanders & key individuals' },
              { t: 'Locations', s: 'Cities & strategic places' },
              { t: 'Events', s: 'Historical & security events' },
              { t: 'Relationships', s: 'Affiliation & command links' },
              { t: 'Objectives', s: 'Political & strategic context' }
            ].map((m, i) => (
              <div key={m.t} className={`p-[18px_14px] ${i === 5 ? '' : 'border-r border-[#283442]'}`}>
                <b className="block text-[13px] font-bold">{m.t}</b>
                <span className="text-[#778497] text-[9px] font-medium uppercase tracking-wider">{m.s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Integration */}
      <section className="py-[92px] border-b border-white/5" id="api">
        <div className="max-w-[1160px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-[55px] items-center">
          <div>
            <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-2">Built for integration</div>
            <h2 className="text-[35px] leading-[1.15] tracking-[-1.3px] font-bold mb-[12px]">Your platform. Our Libya data layer.</h2>
            <p className="text-[#96a3b4] text-[14px] leading-relaxed mb-6">Risk2Data can be consumed as a hosted API service or deployed within a client's infrastructure, depending on technical and operational requirements.</p>
            <div className="grid gap-[10px]">
              {[
                'Query structured entities and their relationships.',
                'Integrate Libya-specific data into existing analytical workflows.',
                'Use an agreed update and support model.',
                'Choose hosted API access or dedicated deployment.'
              ].map(p => (
                <div key={p} className="flex gap-3 text-[#abb7c7] text-[12px] font-medium items-center">
                  <div className="w-[18px] h-[18px] border border-[#38558a] rounded-full grid place-items-center text-[#9bb8ff] text-[9px]">
                    <Check size={10} />
                  </div>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0d131a] border border-[#283442] rounded-lg overflow-hidden">
            <div className="p-[11px_14px] border-b border-[#283442] text-[9px] text-[#7e8b9d] font-bold uppercase tracking-widest">
              Example response · entity relationship query
            </div>
            <pre className="p-[18px] overflow-auto text-[#a9c4f6] font-mono text-[10px] leading-[1.85]">
{`{
  "entity": "example_actor",
  "type": "security_actor",
  "relationships": [
    { "type": "HAS_COMMANDER", "target": "example_person" },
    { "type": "BASED_IN", "target": "example_location" },
    { "type": "AFFILIATED_WITH", "target": "example_group" }
  ],
  "confidence": "high"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-[92px] border-b border-white/5" id="coverage">
        <div className="max-w-[1160px] mx-auto px-6">
          <div className="max-w-[700px] mb-[38px]">
            <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-2">Coverage</div>
            <h2 className="text-[35px] leading-[1.15] tracking-[-1.3px] font-bold mb-[12px]">Libya-focused. Built to expand.</h2>
            <p className="text-[#96a3b4] text-[14px] leading-relaxed">The current platform has Western Libya coverage, with a model designed to support broader national coverage.</p>
          </div>
          <div className="p-[23px] border border-[#283442] rounded-lg bg-gradient-to-br from-[#111a25] to-[#0d131a] flex flex-col sm:flex-row justify-between gap-5 items-start sm:items-center">
            <div>
              <h3 className="text-base font-bold mb-1">Western Libya</h3>
              <p className="text-[#8996a7] text-[11.5px] font-medium">Current dataset coverage across actors, people, locations, events and relationships.</p>
            </div>
            <div className="border border-[#344a6d] rounded-full px-3 py-1.5 text-[#aec4ee] text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
              Full Libya expansion available by scope
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-[100px] bg-[radial-gradient(circle_at_center,#4569a81b,transparent_60%)]" id="contact">
        <div className="max-w-[1160px] mx-auto px-6">
          <div className="text-[#9bb8ff] text-[10px] font-extrabold tracking-[1.7px] uppercase mb-2">See the platform</div>
          <h2 className="text-[40px] tracking-[-1.5px] font-bold mb-[10px]">Explore the Libya data layer.</h2>
          <p className="max-w-[610px] mx-auto text-[#929eaf] text-[13px] leading-relaxed font-medium">
            Request a demonstration to see how Risk2Data connects actors, people, locations, events and relationships — and discuss API or dedicated deployment options.
          </p>
          <div className="flex flex-wrap justify-center gap-[11px] mt-[28px]">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-[17px] py-[11px] rounded-lg bg-[#5d8ff2] border border-[#5d8ff2] text-white text-[12px] font-bold hover:opacity-90 transition-all cursor-pointer"
            >
              Request a Demo →
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-[17px] py-[11px] rounded-lg bg-[#111821] border border-[#283442] text-white text-[12px] font-bold hover:bg-[#151d27] transition-all cursor-pointer"
            >
              Discuss API Access
            </button>
          </div>
        </div>
      </section>

      {/* Demo Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#111821] border border-[#283442] rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#283442] flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Request a Demo</h3>
                  <p className="text-[#7d8b9e] text-xs">Complete the form for platform access.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#7d8b9e] hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {submitStatus === 'success' ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-[#3eb97e]/20 border border-[#3eb97e] text-[#3eb97e] rounded-full flex items-center justify-center mx-auto">
                      <Check size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-[#3eb97e]">Request Sent</h4>
                    <p className="text-[#7d8b9e] text-sm">Thank you. Our intelligence team will contact you shortly.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#7d8b9e] uppercase tracking-wider">Full Name</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-[#0b0e13] border border-[#283442] rounded-lg p-2.5 text-sm outline-none focus:border-[#5d8ff2] transition-colors"
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#7d8b9e] uppercase tracking-wider">Email Address</label>
                        <input 
                          type="email" 
                          required
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-[#0b0e13] border border-[#283442] rounded-lg p-2.5 text-sm outline-none focus:border-[#5d8ff2] transition-colors"
                          placeholder="e.g. name@agency.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#7d8b9e] uppercase tracking-wider">Organization / Agency</label>
                      <input 
                        type="text" 
                        required
                        value={formData.organization}
                        onChange={e => setFormData({...formData, organization: e.target.value})}
                        className="w-full bg-[#0b0e13] border border-[#283442] rounded-lg p-2.5 text-sm outline-none focus:border-[#5d8ff2] transition-colors"
                        placeholder="e.g. Strategic Risk Group"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#7d8b9e] uppercase tracking-wider">Requirement Details</label>
                      <textarea 
                        rows={4}
                        value={formData.message}
                        onChange={e => setFormData({...formData, message: e.target.value})}
                        className="w-full bg-[#0b0e13] border border-[#283442] rounded-lg p-2.5 text-sm outline-none focus:border-[#5d8ff2] transition-colors resize-none"
                        placeholder="Briefly describe your intelligence requirements..."
                      />
                    </div>

                    {submitStatus === 'error' && (
                      <p className="text-[#e05252] text-xs text-center font-medium">Network failure. Please try again or contact support.</p>
                    )}

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-[#5d8ff2] text-white font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'SUBMITTING REQUEST...' : 'SUBMIT REQUEST →'}
                    </button>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-6 border-t border-white/5 text-[#667286] text-[9px] font-medium">
        <div className="max-w-[1160px] mx-auto px-6 flex flex-col sm:flex-row justify-between gap-2">
          <span>© 2026 Risk2Data. Structured security data for Libya.</span>
          <span className="flex gap-4">
            <span>API</span>
            <span>Database</span>
            <span>Network Analysis</span>
            <span>Risk Data</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

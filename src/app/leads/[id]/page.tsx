'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Star,
  ExternalLink,
  Phone,
  MessageSquare,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Building2,
  UserCheck,
  ShieldAlert,
  Flame,
  Zap,
  Tag,
  Briefcase,
  Layers,
  HelpCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Lead, WebsiteAudit, CompanyRecord, OutreachClass } from '@/types/database';
import { StoredAnalysis, LeadAnalysis } from '@/types/analysis';
import { SocialEnrichmentResult } from '@/types/social';
import PitchGenerator from '@/components/PitchGenerator';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [audit, setAudit] = useState<WebsiteAudit | null>(null);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [candidates, setCandidates] = useState<CompanyRecord[]>([]);
  const [social, setSocial] = useState<SocialEnrichmentResult | null>(null);
  const [selectedName, setSelectedName] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lead?.name && !selectedName) {
      setSelectedName(lead.selected_name || lead.name);
    }
  }, [lead, selectedName]);

  useEffect(() => {
    async function loadLeadDossier() {
      setIsLoading(true);
      setError(null);
      try {
        // 0. Fetch lead
        const leadRes = await fetch(`/api/leads?leadId=${leadId}`);
        if (leadRes.ok) {
          const lData = await leadRes.json();
          if (lData.lead) {
            setLead(lData.lead);
            setManualNotes(lData.lead.manual_notes || '');
          }
        }

        // 1. Fetch analysis
        const analysisRes = await fetch(`/api/analyses?leadId=${leadId}`);
        if (analysisRes.ok) {
          const aData = await analysisRes.json();
          if (aData.analysis) setAnalysis(aData.analysis);
        }

        // 2. Fetch audit
        const auditRes = await fetch(`/api/audits?leadId=${leadId}`);
        if (auditRes.ok) {
          const auData = await auditRes.json();
          if (auData.audit) setAudit(auData.audit);
        }

        // 2.5 Fetch companies house candidates
        if (leadRes.ok) {
          const lData = await leadRes.clone().json().catch(() => null);
          const currentLead = lData?.lead || lead;
          if (currentLead) {
            const chRes = await fetch('/api/companies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead: currentLead, withCandidates: true }),
            });
            if (chRes.ok) {
              const chData = await chRes.json();
              if (chData.company) setCompany(chData.company);
              if (chData.candidates) setCandidates(chData.candidates);
            }
          }
        }

        // 3. Fetch social enrichment
        const socialRes = await fetch(`/api/social?leadId=${leadId}`);
        if (socialRes.ok) {
          const sData = await socialRes.json();
          if (sData.enrichment) setSocial(sData.enrichment);
        }
      } catch (err: any) {
        console.error('Error loading dossier:', err);
        setError('Failed to load lead dossier');
      } finally {
        setIsLoading(false);
      }
    }
    if (leadId) loadLeadDossier();
  }, [leadId]);

  const handleRunAnalysis = async () => {
    if (!leadId) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyses/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: lead || { id: leadId, name: 'Target Business', rating: 4.5, review_count: 20 },
          audit,
          company,
        }),
      });

      const data = await res.json();
      if (res.ok && data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (err: any) {
      console.error('Failed to run analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const aData: LeadAnalysis | null = analysis?.data || null;

  const rawWebsiteName =
    lead?.website_name ||
    (audit?.page_title
      ? audit.page_title.split(/[-|•–:]/)[0].trim()
      : audit?.h1_text?.trim() || null);
  const hasAltName = Boolean(
    rawWebsiteName &&
      lead?.name &&
      rawWebsiteName.toLowerCase() !== lead.name.toLowerCase() &&
      rawWebsiteName.length > 2 &&
      rawWebsiteName.length < 70
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leads Discovery
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing with Anthropic...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {analysis ? 'Re-Analyse Lead' : 'Run AI Analysis'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Companies House Confirmation Card (Stage 5A-2 Item 3) */}
      {candidates.length > 0 && company && company.match_confidence !== 'high' && (
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-0.5">
              Companies House Candidates ({company.match_confidence.toUpperCase()} Confidence)
            </span>
            <p className="text-xs text-slate-600">
              Multiple possible matches found on Companies House. Confirm the exact legal entity:
            </p>
          </div>
          <div className="space-y-2">
            {candidates.map((cand) => (
              <div
                key={cand.company_number}
                className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  company.company_number === cand.company_number
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{cand.legal_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">#{cand.company_number}</span>
                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/company/${cand.company_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline text-[10px] inline-flex items-center gap-0.5"
                    >
                      Gov.uk <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {cand.registered_address || 'Address unlisted'} • Active Director:{' '}
                    <span className="font-semibold text-slate-700">{cand.officers?.[0] || 'Unknown'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setCompany(cand);
                    await fetch('/api/companies/confirm', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leadId, companyRecord: cand }),
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                    company.company_number === cand.company_number
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {company.company_number === cand.company_number ? 'Confirmed ✓' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasAltName && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-0.5">
                Business Name Selection (Stage 5A-1)
              </span>
              <p className="text-xs text-slate-600">
                The name listed on OpenStreetMap differs from the verified name found on their website. Pick the name to use in pitches:
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedName(lead?.name || '')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  selectedName === lead?.name
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                OSM: <span className="font-semibold">{lead?.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedName(rawWebsiteName!)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  selectedName === rawWebsiteName
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Website: <span className="font-semibold">{rawWebsiteName}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border animate-pulse">
          Loading lead intelligence dossier...
        </div>
      ) : !aData ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">No AI Analysis Generated Yet</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Click "Run AI Analysis" to synthesize Google Places metrics, website diagnostics, and Companies House records into a qualified pitch dossier.
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyze Lead Now
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero Score Banner */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Anthropic {analysis?.model_used || 'Claude 3.5'}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      aData.outreach_class === 'corporate'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : aData.outreach_class === 'blocked'
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {aData.outreach_class === 'corporate'
                      ? 'Corporate B2B'
                      : aData.outreach_class === 'blocked'
                      ? 'Blocked'
                      : 'Sole Trader (PECR Restricted)'}
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight">{aData.business_type_guess}</h1>
                <p className="text-xs text-indigo-200 max-w-xl leading-relaxed">
                  {aData.business_summary}
                </p>
              </div>

              {/* Score Circular Badge */}
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
                <div className="text-center">
                  <div className="text-4xl font-extrabold text-amber-400">
                    {aData.lead_score}
                    <span className="text-lg text-indigo-200">/10</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    Fit Score
                  </span>
                </div>
                <div className="border-l border-white/20 pl-4 max-w-xs text-xs text-indigo-100">
                  <p className="line-clamp-3 text-[11px] leading-relaxed">{aData.score_reasoning}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Recommended Service & Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Recommended Pitch Strategy
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Primary: {aData.recommended_primary_service}
                </span>
              </div>

              <div className="space-y-3">
                {aData.opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition ${
                      opp.service === aData.recommended_primary_service
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 uppercase">
                          {opp.service.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded bg-white text-slate-600 border font-mono">
                          Confidence: {opp.confidence}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-indigo-700">
                        {opp.estimated_value_gbp_range}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{opp.why}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Outreach Channel & Decision Maker */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Targeting & Contact
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Best Channel
                  </span>
                  <div className="font-bold text-indigo-600 flex items-center gap-1.5">
                    {aData.best_contact_channel === 'whatsapp' ? (
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Phone className="w-4 h-4 text-indigo-500" />
                    )}
                    <span className="uppercase">{aData.best_contact_channel.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{aData.channel_reasoning}</p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Likely Decision Maker
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>{aData.decision_maker_guess}</span>
                  </div>
                </div>

                {aData.risks_or_red_flags.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-rose-500 uppercase font-semibold block mb-1">
                      Risks & Red Flags
                    </span>
                    <ul className="text-[11px] text-rose-700 list-disc list-inside space-y-0.5">
                      {aData.risks_or_red_flags.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Signals (Stage 7) */}
          {social && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Social Media Enrichment (Apify / Public Signals)
                </h3>
                <div className="flex items-center gap-1.5">
                  {social.is_running_through_dms && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                      📩 Bio says "DM to Book"
                    </span>
                  )}
                  {social.is_inactive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      💤 Inactive (60+ days)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {social.profiles.map((p, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="capitalize">{p.platform} (@{p.handle})</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {p.follower_count ? `${p.follower_count.toLocaleString()} followers` : 'Public profile'}
                      </span>
                    </div>
                    {p.bio && <p className="text-[11px] text-slate-600 italic">"{p.bio}"</p>}
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span>Posts last 60 days: {p.posts_last_60_days}</span>
                      <span>Booking in bio: {p.has_booking_or_link_in_bio ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses with Cited Evidence */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500" />
              Evidence-Based Weaknesses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aData.weaknesses.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{w.issue}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.2 rounded uppercase ${
                        w.severity === 'high'
                          ? 'bg-rose-100 text-rose-700'
                          : w.severity === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {w.severity} severity
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 mt-1">
                    Evidence: "{w.evidence}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Personalisation Hooks */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Verified Personalisation Hooks for Outreach Copy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {aData.personalisation_hooks.map((hook, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-indigo-900 font-medium flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span>{typeof hook === 'string' ? hook : hook.hook}</span>
                    {typeof hook !== 'string' && hook.snippet && (
                      <span className="block text-[10px] text-indigo-600 italic mt-0.5">
                        Source snippet: "{hook.snippet}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Gaps */}
          {aData.data_gaps.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
              <span className="font-bold text-slate-600 uppercase text-[10px] block mb-1">
                Data Gaps & Missing Sources
              </span>
              <ul className="list-disc list-inside text-slate-500 space-y-0.5 text-[11px]">
                {aData.data_gaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual Notes (Stage 7: Evidence Source) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Manual Notes (Evidence Source)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Add facts you observed manually (e.g. Facebook reviews, years trading, owner first name, areas covered). Saved to SQLite and treated as verified evidence.
                </p>
              </div>
              <button
                type="button"
                disabled={savingNotes}
                onClick={async () => {
                  setSavingNotes(true);
                  setNotesSaved(false);
                  try {
                    const res = await fetch('/api/leads', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leadId, manual_notes: manualNotes }),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      if (d.lead) setLead(d.lead);
                      setNotesSaved(true);
                      setTimeout(() => setNotesSaved(false), 2500);
                    }
                  } finally {
                    setSavingNotes(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {savingNotes ? 'Saving...' : notesSaved ? 'Saved ✓' : 'Save Notes'}
              </button>
            </div>
            <textarea
              rows={3}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="e.g. Owner: Robert. Facebook page says over 30 years trading, 13 reviews at 100% recommend, covers Devizes."
              className="w-full text-xs p-3 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Pitch Generator Section */}
          {lead && (
            <PitchGenerator
              lead={{
                ...lead,
                name: selectedName || lead.name,
                selected_name: selectedName || lead.name,
                website_name: rawWebsiteName,
                manual_notes: manualNotes,
              }}
              analysis={aData}
            />
          )}
        </div>
      )}
    </div>
  );
}

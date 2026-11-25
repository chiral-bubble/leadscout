'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Mail,
  Send,
  PhoneCall,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Edit3,
  Save,
  Clock,
  History,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Lead } from '@/types/database';
import { LeadAnalysis } from '@/types/analysis';
import {
  PitchChannel,
  PitchTone,
  PitchVariant,
  StoredPitch,
  OutreachLogEntry,
  OutreachStatus,
} from '@/types/pitch';

interface PitchGeneratorProps {
  lead: Lead;
  analysis: LeadAnalysis;
}

export default function PitchGenerator({ lead, analysis }: PitchGeneratorProps) {
  const [tone, setTone] = useState<PitchTone>('friendly');
  const [channel, setChannel] = useState<PitchChannel>('facebook_dm');
  const [angle, setAngle] = useState<string>('site');
  const [optedIn, setOptedIn] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<StoredPitch | null>(null);
  const [editedVariants, setEditedVariants] = useState<PitchVariant[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedSubjectIndex, setCopiedSubjectIndex] = useState<number | null>(null);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLogEntry[]>([]);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // Fetch initial stored pitches and outreach logs
  useEffect(() => {
    async function loadData() {
      try {
        const [pitchRes, logRes] = await Promise.all([
          fetch(`/api/pitches?leadId=${lead.id}`),
          fetch(`/api/pitches/outreach-log?leadId=${lead.id}`),
        ]);

        if (pitchRes.ok) {
          const pData = await pitchRes.json();
          if (pData.pitches && pData.pitches.length > 0) {
            setCurrentPitch(pData.pitches[0]);
            setEditedVariants(pData.pitches[0].variants);
          }
        }

        if (logRes.ok) {
          const lData = await logRes.json();
          if (lData.logs) {
            setOutreachLogs(lData.logs);
          }
        }
      } catch (err) {
        console.error('Error loading pitches/logs:', err);
      }
    }

    if (lead?.id) {
      loadData();
    }
  }, [lead?.id]);

  const handleGeneratePitches = async (overrideAngle?: string) => {
    setIsGenerating(true);
    setEditingIndex(null);
    const activeAngle = overrideAngle || angle;
    if (overrideAngle) setAngle(overrideAngle);
    try {
      const res = await fetch('/api/pitches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          options: { tone, channel, angle: activeAngle, opted_in: optedIn },
          lead,
          analysis,
        }),
      });

      const data = await res.json();
      if (res.ok && data.pitch) {
        setCurrentPitch(data.pitch);
        setEditedVariants(data.pitch.variants);
      } else {
        alert(data.error || 'Failed to generate pitch');
      }
    } catch (err: any) {
      console.error('Pitch generation error:', err);
      alert('Network error while generating pitch');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, index: number, isSubject = false) => {
    navigator.clipboard.writeText(text);
    if (isSubject) {
      setCopiedSubjectIndex(index);
      setTimeout(() => setCopiedSubjectIndex(null), 2000);
    } else {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleTextChange = (newText: string, index: number) => {
    setEditedVariants((prev) =>
      prev.map((v, i) =>
        i === index
          ? {
              ...v,
              message: newText,
              word_count: newText.trim().split(/\s+/).filter(Boolean).length,
            }
          : v
      )
    );
  };

  const handleLogStatus = async (
    status: OutreachStatus,
    variantMessage?: string,
    notes?: string
  ) => {
    setStatusUpdating(status);
    try {
      const res = await fetch('/api/pitches/outreach-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          pitchId: currentPitch?.id || null,
          channel,
          status,
          notes: notes || `Contacted via ${channel.toUpperCase()}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.log) {
        setOutreachLogs((prev) => [data.log, ...prev]);
      }
    } catch (err) {
      console.error('Failed to log outreach status:', err);
    } finally {
      setStatusUpdating(null);
    }
  };

  // WhatsApp click handler
  const handleOpenWhatsApp = (message: string) => {
    if (lead.outreach_class === 'blocked') {
      alert('This business is on the suppression list. Outreach is blocked.');
      return;
    }

    const cleanNumber = (lead.phone_e164 || '').replace(/[^0-9]/g, '');
    if (!cleanNumber) {
      alert('No valid phone number available for WhatsApp.');
      return;
    }

    // Automatically log click to outreach_log
    handleLogStatus('draft_opened', message, 'Clicked Open in WhatsApp');

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const isBlocked = lead.outreach_class === 'blocked';
  const isCorporate = (analysis.outreach_class || lead.outreach_class) === 'corporate';
  const isIndividual = !isCorporate && !isBlocked;
  const isMobile = lead.phone_type === 'mobile';
  const isLandline = lead.phone_type === 'landline';

  // Requirement 3: Refuse channel=whatsapp unless lead has published UK mobile AND is corporate (or opted in)
  const isWhatsAppMobileRefused = channel === 'whatsapp' && !isMobile;
  const isWhatsAppPecrRefused = channel === 'whatsapp' && isMobile && isIndividual && !optedIn;
  const isChannelRefused = isWhatsAppMobileRefused || isWhatsAppPecrRefused;

  const channelRefusalReason = isWhatsAppMobileRefused
    ? `Refused channel WhatsApp: Lead has no published UK mobile (phone is ${isLandline ? 'a landline: ' + (lead.phone_e164 || lead.phone_raw || '') : 'unlisted'}). For landline or missing mobile numbers, please use Call Script or Contact Form.`
    : isWhatsAppPecrRefused
    ? 'Refused channel WhatsApp: Lead is classified as a sole trader/individual under UK PECR regulations. Direct WhatsApp outreach requires prior consent or an enquiry. Please tick "Opted in" if they have contacted you, or switch to Call Script or Contact Form.'
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI Pitch Generator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Craft tailored first-contact messages using verified evidence and UK compliance rules.
          </p>
        </div>

        {/* Generate / Regenerate button */}
        <button
          onClick={() => handleGeneratePitches()}
          disabled={isGenerating || isBlocked || isChannelRefused}
          title={channelRefusalReason || undefined}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          {currentPitch ? 'Regenerate 3 Variants' : 'Generate 3 Variants'}
        </button>
      </div>

      {/* Control Bar: Channel, Tone, Angle */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Channel Selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">Channel</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { id: 'facebook_dm', label: 'FB DM', icon: MessageSquare },
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'contact_form', label: 'Form', icon: Send },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => setChannel(ch.id as PitchChannel)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
                    channel === ch.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tone Selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">Tone</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['friendly', 'professional', 'casual'] as PitchTone[]).map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-2.5 py-1.5 rounded-lg border font-medium capitalize text-center transition ${
                  tone === t
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Angle Selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">Pitch Angle</label>
          <select
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="site">Simple Site</option>
            <option value="quote form">Quote Form</option>
            <option value="booking">Online Booking</option>
            <option value="automation">Automation / Auto-Replies</option>
          </select>
        </div>
      </div>

      {/* Lead Source, Outreach Class & Channel Gating Summary (Stage 7B) */}
      <div className="px-5 pt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="font-semibold text-slate-600">Source:</span>
          <span className="font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            {lead.source || (lead.place_id?.startsWith('osm:') ? 'osm' : lead.google_maps_url ? 'google_maps' : 'website')}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-600">Outreach Class:</span>
          <span className="font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
            {analysis.outreach_class || lead.outreach_class || 'individual_or_unknown'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-600">Channel Gating:</span>
          <span className={`font-medium ${isChannelRefused ? 'text-rose-700' : 'text-emerald-700'}`}>
            {isChannelRefused ? 'Blocked for selected channel' : `Allowed (${channel})`}
          </span>
        </div>
        {isBlocked && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold">Outreach Blocked:</span> This business or contact details
              are on the suppression list. The app prohibits sending outreach.
            </div>
          </div>
        )}

        {/* WhatsApp Mobile Refusal Rule (Stage 5A-1 Requirement 3) */}
        {isWhatsAppMobileRefused && !isBlocked && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">WhatsApp Channel Refused:</span> This business has no published UK mobile number ({isLandline ? `landline: ${lead.phone_e164 || lead.phone_raw}` : 'no phone'}). Direct WhatsApp pitches can only be generated for UK mobile numbers.
                <p className="mt-1 text-[11px] text-rose-700">Please switch channel to Call Script or Contact Form below.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setChannel('call_script')}
                className="px-2.5 py-1 bg-white border border-rose-300 rounded font-semibold text-rose-800 hover:bg-rose-100 text-[11px]"
              >
                Use Call Script
              </button>
              <button
                type="button"
                onClick={() => setChannel('contact_form')}
                className="px-2.5 py-1 bg-white border border-rose-300 rounded font-semibold text-rose-800 hover:bg-rose-100 text-[11px]"
              >
                Use Form
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp Sole Trader / PECR Rule (Stage 5A-1 Requirement 3) */}
        {isWhatsAppPecrRefused && !isBlocked && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">WhatsApp PECR Restriction:</span> This business is classified as an individual/sole trader. Unsolicited direct WhatsApp messages are restricted under UK PECR rules without prior consent.
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Prefer a phone call or website contact form, or confirm below if they have enquired or consented.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/60">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-950">
                <input
                  type="checkbox"
                  checked={optedIn}
                  onChange={(e) => setOptedIn(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span>I confirm this lead has enquired or explicitly opted in</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setChannel('call_script')}
                  className="px-2 py-0.5 bg-white border border-amber-300 rounded font-medium text-amber-900 hover:bg-amber-100 text-[10px]"
                >
                  Switch to Call Script
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('contact_form')}
                  className="px-2 py-0.5 bg-white border border-amber-300 rounded font-medium text-amber-900 hover:bg-amber-100 text-[10px]"
                >
                  Switch to Form
                </button>
              </div>
            </div>
          </div>
        )}

        {isIndividual && !isBlocked && channel !== 'whatsapp' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">PECR Warning:</span> Possible sole trader or partnership.
              UK PECR consent rules are stricter for individuals. Channel {channel.replace(/_/g, ' ').toUpperCase()} is appropriate for cold outreach.
            </div>
          </div>
        )}
      </div>

      {/* Pitch Variants Cards */}
      <div className="p-5">
        {editedVariants.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No pitches generated yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Select your preferred channel, tone, and service angle above, then click Generate to create 3 personalized variants.
            </p>
            {isChannelRefused ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 max-w-md mx-auto mb-3">
                {channelRefusalReason}
              </div>
            ) : null}
            <button
              onClick={() => handleGeneratePitches()}
              disabled={isGenerating || isBlocked || isChannelRefused}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate 3 Variants Now
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Regenerate with a different angle bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="font-semibold text-slate-700">Regenerate with a different angle:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'site', label: 'Simple Site' },
                  { id: 'quote form', label: 'Quote Form' },
                  { id: 'booking', label: 'Online Booking' },
                  { id: 'automation', label: 'Automation' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isGenerating || isBlocked || isChannelRefused}
                    onClick={() => handleGeneratePitches(opt.id)}
                    className={`px-2.5 py-1 rounded-md border font-medium transition disabled:opacity-50 ${
                      angle === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {editedVariants.map((variant, index) => {
              const wordCount = variant.word_count || variant.message.trim().split(/\s+/).length;
              const isEditing = editingIndex === index;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
                >
                  {/* Variant Card Top */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{variant.label}</span>
                      <span className="text-[10px] font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                        {wordCount} words
                      </span>
                      {variant.warning && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                          {variant.warning}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingIndex(isEditing ? null : index)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>{isEditing ? 'Done' : 'Edit'}</span>
                      </button>

                      <button
                        onClick={() => handleCopy(variant.message, index)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* WhatsApp Click-to-Chat Button */}
                      <button
                        onClick={() => handleOpenWhatsApp(variant.message)}
                        disabled={isBlocked}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-md shadow-2xs transition ${
                          isBlocked
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={
                          isBlocked
                            ? 'Outreach blocked by suppression list'
                            : 'Open click-to-chat link in WhatsApp and record log'
                        }
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Open in WhatsApp</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                      </button>
                    </div>
                  </div>

                  {/* Subject Line (if Email / Form) */}
                  {variant.subject && (
                    <div className="px-4 py-2.5 bg-indigo-50/40 border-b border-indigo-100/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-slate-500 shrink-0">Subject:</span>
                        <span className="font-mono text-slate-800 truncate">{variant.subject}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(variant.subject!, index, true)}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0"
                      >
                        {copiedSubjectIndex === index ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedSubjectIndex === index ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  {/* Message Body (View or Edit) */}
                  <div className="p-4">
                    {isEditing ? (
                      <textarea
                        rows={7}
                        value={variant.message}
                        onChange={(e) => handleTextChange(e.target.value, index)}
                        className="w-full text-xs font-sans text-slate-800 bg-white border border-indigo-400 focus:border-indigo-500 rounded-lg p-3 leading-relaxed focus:outline-none transition resize-y"
                      />
                    ) : (
                      <div className="text-xs font-sans text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                        {variant.message}
                      </div>
                    )}

                    {/* Personalisation used footer */}
                    {variant.personalisation_used && variant.personalisation_used.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-600">Personalisation hook:</span>
                        <span className="italic truncate">"{variant.personalisation_used[0]}"</span>
                      </div>
                    )}

                    {/* Evidence Claims (Stage 5A-2: Evidence Grounding) */}
                    {variant.claims && variant.claims.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verified Evidence Claims ({variant.claims.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {variant.claims.map((claim, cIdx) => (
                            <div
                              key={cIdx}
                              className="bg-slate-50 border border-slate-200/80 rounded p-2 text-[11px] space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="text-slate-800 font-medium">"{claim.text}"</span>
                                <div className="flex items-center gap-1">
                                  {claim.source_type && (
                                    <span className="font-mono text-[9px] uppercase font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                      {claim.source_type}
                                    </span>
                                  )}
                                  <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                                    {claim.source_field || (claim as any).evidence_field}
                                  </span>
                                </div>
                              </div>
                              {claim.source_snippet && (
                                <p className="text-[10px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-100">
                                  Snippet: "{claim.source_snippet}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Status Logger & Outreach Log Timeline */}
      <div className="p-5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            Outreach History & Status Log
          </h3>

          {/* Quick status dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Record status:</span>
            <select
              disabled={isBlocked || statusUpdating !== null}
              onChange={(e) => {
                if (e.target.value) {
                  handleLogStatus(e.target.value as OutreachStatus);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="" disabled>
                Update outreach status...
              </option>
              <option value="sent">Mark as Sent</option>
              <option value="replied">Received Reply</option>
              <option value="converted">Converted Client 🎉</option>
              <option value="declined">Declined</option>
              <option value="bounced">Bounced / Invalid</option>
            </select>
          </div>
        </div>

        {outreachLogs.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No outreach attempts recorded yet for this lead.</p>
        ) : (
          <div className="space-y-2">
            {outreachLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.status === 'converted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.status === 'replied'
                        ? 'bg-indigo-100 text-indigo-800'
                        : log.status === 'sent'
                        ? 'bg-blue-100 text-blue-800'
                        : log.status === 'declined'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {log.status.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-slate-700 uppercase text-[10px]">
                    via {log.channel}
                  </span>
                  {log.notes && <span className="text-slate-500 text-[11px]">— {log.notes}</span>}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(log.contacted_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/London',
                  })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

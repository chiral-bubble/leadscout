'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  Star,
  Phone,
  MessageSquare,
  Globe,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  X,
  FileText,
  Save,
  Send,
  ExternalLink,
  History,
  Tag,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Lead } from '@/types/database';
import {
  PipelineStatus,
  PIPELINE_COLUMNS,
  FollowUpReminder,
  LeadNote,
} from '@/types/pipeline';
import { OutreachLogEntry } from '@/types/pitch';

interface KanbanBoardProps {
  initialLeads?: Lead[];
}

export default function KanbanBoard({ initialLeads = [] }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Drawer state
  const [notes, setNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLogEntry[]>([]);
  const [generatedFollowUp, setGeneratedFollowUp] = useState<{
    stage: string;
    message: string;
  } | null>(null);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  // Fetch all pipeline leads on mount
  useEffect(() => {
    async function loadPipeline() {
      try {
        const res = await fetch('/api/pipeline');
        if (res.ok) {
          const data = await res.json();
          if (data.leads) setLeads(data.leads);
        }
      } catch (err) {
        console.error('Failed to load pipeline:', err);
      }
    }
    loadPipeline();
  }, []);

  // When a lead is opened in the drawer
  useEffect(() => {
    if (!selectedLead) return;

    async function loadLeadDetails() {
      try {
        setNotes(selectedLead?.notes || '');
        setGeneratedFollowUp(null);

        const [remindersRes, logsRes] = await Promise.all([
          fetch(`/api/pipeline/follow-ups?leadId=${selectedLead?.id}`),
          fetch(`/api/pitches/outreach-log?leadId=${selectedLead?.id}`),
        ]);

        if (remindersRes.ok) {
          const rData = await remindersRes.json();
          if (rData.reminders) setReminders(rData.reminders);
        }

        if (logsRes.ok) {
          const lData = await logsRes.json();
          if (lData.logs) setOutreachLogs(lData.logs);
        }
      } catch (err) {
        console.error('Error loading lead drawer details:', err);
      }
    }

    loadLeadDetails();
  }, [selectedLead?.id]);

  // Drag & drop handlers
  const handleDragStart = (leadId: string) => {
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: PipelineStatus) => {
    if (!draggedLeadId) return;

    const leadToMove = leads.find((l) => l.id === draggedLeadId);
    if (!leadToMove || leadToMove.pipeline_status === newStatus) {
      setDraggedLeadId(null);
      return;
    }

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggedLeadId ? { ...l, pipeline_status: newStatus } : l))
    );

    if (selectedLead?.id === draggedLeadId) {
      setSelectedLead((prev) => (prev ? { ...prev, pipeline_status: newStatus } : null));
    }

    try {
      await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: draggedLeadId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update status on server:', err);
    } finally {
      setDraggedLeadId(null);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: PipelineStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, pipeline_status: newStatus } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, pipeline_status: newStatus } : null));
    }

    try {
      await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status: newStatus }),
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    setIsSavingNotes(true);
    try {
      await fetch('/api/pipeline/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, text: notes }),
      });
      setSelectedLead((prev) => (prev ? { ...prev, notes } : null));
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, notes } : l))
      );
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleGenerateFollowUpMessage = async (stage: 'day_3' | 'day_7') => {
    if (!selectedLead) return;
    setIsGeneratingFollowUp(true);
    try {
      const res = await fetch('/api/pipeline/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, stage }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        setGeneratedFollowUp({ stage, message: data.message });
        if (data.isCold) {
          const updatedTags = [...(selectedLead.tags || []), 'Cold'];
          setSelectedLead((prev) => (prev ? { ...prev, tags: updatedTags } : null));
          setLeads((prev) =>
            prev.map((l) => (l.id === selectedLead.id ? { ...l, tags: updatedTags } : l))
          );
        }
      }
    } catch (err) {
      console.error('Error generating follow up:', err);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const handlePermanentDoNotContact = async () => {
    if (!selectedLead) return;
    if (
      !confirm(
        `Are you sure you want to add "${selectedLead.name}" to the suppression list? This permanently blocks future outreach.`
      )
    ) {
      return;
    }

    await handleStatusChange(selectedLead.id, 'do_not_contact');
    setIsDrawerOpen(false);
  };

  return (
    <div className="relative">
      {/* Kanban Columns Container (Horizontal Scroll) */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x">
        {PIPELINE_COLUMNS.map((column) => {
          const columnLeads = leads.filter(
            (l) => (l.pipeline_status || 'new') === column.id
          );

          return (
            <div
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
              className="flex-shrink-0 w-72 bg-slate-50/80 rounded-xl border border-slate-200/80 p-3 flex flex-col max-h-[750px] shadow-xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 tracking-tight">
                    {column.label}
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                {columnLeads.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    Drag leads here
                  </div>
                ) : (
                  columnLeads.map((lead) => {
                    const isCold = (lead.tags || []).includes('Cold');
                    const isBlocked =
                      lead.is_suppressed || lead.outreach_class === 'blocked';

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsDrawerOpen(true);
                        }}
                        className={`p-3 bg-white rounded-lg border border-slate-200 shadow-2xs hover:shadow-sm hover:border-indigo-300 transition cursor-grab active:cursor-grabbing text-xs space-y-2 relative ${
                          isBlocked ? 'border-rose-200 bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Top: Name & Fit Score */}
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-semibold text-slate-900 line-clamp-1">
                            {lead.name}
                          </span>
                          {lead.lead_score ? (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                lead.lead_score >= 8
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : lead.lead_score >= 5
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {lead.lead_score}/10
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </div>

                        {/* Middle: Recommended Service & Tags */}
                        <div className="flex flex-wrap items-center gap-1">
                          {lead.categories && lead.categories[0] && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {lead.categories[0]}
                            </span>
                          )}

                          {isCold && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                              ❄️ Cold
                            </span>
                          )}

                          {isBlocked && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                              Blocked
                            </span>
                          )}
                        </div>

                        {/* Bottom: Postcode & Last Activity */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>{lead.postcode || 'UK'}</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {lead.last_activity_at
                              ? new Date(lead.last_activity_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : 'Recent'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-Over Detail Drawer */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{selectedLead.name}</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedLead.postcode || 'UK'} · {selectedLead.categories?.join(', ') || 'Business'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/leads/${selectedLead.id}`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  Full Dossier <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Quick Pipeline Status Dropdown */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-semibold text-slate-700">Pipeline Status:</span>
                <select
                  value={selectedLead.pipeline_status || 'new'}
                  onChange={(e) =>
                    handleStatusChange(selectedLead.id, e.target.value as PipelineStatus)
                  }
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {PIPELINE_COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow-up Reminders & Trigger */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Scheduled Follow-ups (Max 2 Cap)
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Sent: {selectedLead.follow_up_count || 0}/2
                  </span>
                </div>

                {/* Day 3 and Day 7 buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleGenerateFollowUpMessage('day_3')}
                    disabled={isGeneratingFollowUp || (selectedLead.follow_up_count || 0) >= 2}
                    className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/30 transition disabled:opacity-40"
                  >
                    <div className="font-bold text-slate-800">Day 3 Follow-up</div>
                    <div className="text-[10px] text-slate-500">Polite nudge + Useful Tip</div>
                  </button>

                  <button
                    onClick={() => handleGenerateFollowUpMessage('day_7')}
                    disabled={isGeneratingFollowUp || (selectedLead.follow_up_count || 0) >= 2}
                    className="p-2.5 text-left border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/30 transition disabled:opacity-40"
                  >
                    <div className="font-bold text-slate-800">Day 7 Follow-up</div>
                    <div className="text-[10px] text-slate-500">Closing the loop + Opt-out</div>
                  </button>
                </div>

                {/* Generated message preview */}
                {generatedFollowUp && (
                  <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                      <span>{generatedFollowUp.stage === 'day_3' ? 'Day 3 Nudge' : 'Day 7 Final'}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedFollowUp.message);
                          alert('Copied follow-up message to clipboard!');
                        }}
                        className="text-[10px] text-indigo-600 hover:underline"
                      >
                        Copy Text
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-sans bg-white p-2.5 rounded border border-indigo-100/60">
                      "{generatedFollowUp.message}"
                    </p>

                    {selectedLead.phone_e164 && (
                      <a
                        href={`https://wa.me/${selectedLead.phone_e164.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          generatedFollowUp.message
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Send via WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Editable Notes Area */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Lead Notes & Activity
                  </h4>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-semibold rounded hover:bg-slate-800 transition"
                  >
                    <Save className="w-3 h-3" />
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about calls, client preferences, booking objections, or quotes..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* Contact Timeline (from outreach_log) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Contact Timeline
                </h4>
                {outreachLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No outreach logged yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {outreachLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700 capitalize">
                            {log.channel}
                          </span>
                          <span className="text-slate-400">({log.status.replace(/_/g, ' ')})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.contacted_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Permanent Do Not Contact Action */}
              <div className="pt-2">
                <button
                  onClick={handlePermanentDoNotContact}
                  className="w-full py-2 px-3 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Mark "Do Not Contact" & Add to Suppression List
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Permanently blocks future pitches and emails across the app.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

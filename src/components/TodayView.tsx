'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Send,
  MessageSquare,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import { Lead } from '@/types/database';
import { FollowUpReminder } from '@/types/pipeline';

export default function TodayView() {
  const [dailyCap, setDailyCap] = useState(15);
  const [leadsToMessage, setLeadsToMessage] = useState<Lead[]>([]);
  const [followUpsDue, setFollowUpsDue] = useState<{ lead: Lead; reminder: FollowUpReminder }[]>([]);
  const [repliesToAnswer, setRepliesToAnswer] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTodayData = async (cap: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pipeline/today?dailyCap=${cap}`);
      if (res.ok) {
        const data = await res.json();
        setLeadsToMessage(data.leadsToMessage || []);
        setFollowUpsDue(data.followUpsDue || []);
        setRepliesToAnswer(data.repliesToAnswer || []);
      }
    } catch (err) {
      console.error('Error fetching today focus:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData(dailyCap);
  }, [dailyCap]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Daily Cap Setting */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Today's Outreach & Follow-up Focus
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Concentrate on your daily message quota, overdue reminders, and live replies.
          </p>
        </div>

        {/* Daily Cap Control */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 self-start md:self-auto text-xs">
          <Sliders className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-700">Daily New Outreach Cap:</span>
          <select
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded px-2 py-0.5 font-bold text-indigo-600 focus:outline-none"
          >
            <option value={10}>10 leads</option>
            <option value={15}>15 leads (Recommended)</option>
            <option value={20}>20 leads</option>
            <option value={30}>30 leads</option>
          </select>
        </div>
      </div>

      {/* Grid of 3 Action Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Leads to Message Today */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-indigo-600" />
              1. New Outreach Queue
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {leadsToMessage.length} ready
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {leadsToMessage.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center italic">
                No new leads pending outreach. Run a search in Discovery to replenish your queue!
              </p>
            ) : (
              leadsToMessage.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-lg hover:border-indigo-300 transition text-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block line-clamp-1">{lead.name}</span>
                      <span className="text-[10px] text-slate-500">{lead.postcode || 'UK'} · {lead.categories?.[0]}</span>
                    </div>
                    {lead.lead_score && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {lead.lead_score}/10
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                    <span className="text-slate-500 font-mono text-[10px]">
                      {lead.phone_e164 || 'No phone'}
                    </span>
                    <a
                      href={`/leads/${lead.id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
                    >
                      Draft Pitch <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Follow-ups Due Today */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              2. Follow-ups Due
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {followUpsDue.length} due
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {followUpsDue.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center italic">
                All follow-ups up to date. As leads are marked Contacted, Day 3 & Day 7 reminders will appear here.
              </p>
            ) : (
              followUpsDue.map(({ lead, reminder }) => (
                <div
                  key={reminder.id}
                  className="p-3 bg-amber-50/40 border border-amber-200 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{lead.name}</span>
                      <span className="block text-[10px] text-amber-700 font-medium uppercase mt-0.5">
                        {reminder.stage === 'day_3' ? 'Day 3 Nudge (Tip)' : 'Day 7 Closing Loop'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-amber-100">
                    <a
                      href={`/leads/${lead.id}`}
                      className="text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      Open Lead Dossier →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Replies to Answer */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              3. Replies & Calls Booked
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {repliesToAnswer.length} active
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {repliesToAnswer.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center italic">
                No active conversations or replies currently waiting.
              </p>
            ) : (
              repliesToAnswer.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900">{lead.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      {lead.pipeline_status || 'Replied'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Likely Contact: {lead.likely_decision_maker || 'Owner/Manager'}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-[11px]">
                    <span className="font-mono text-[10px] text-slate-500">{lead.phone_e164}</span>
                    <a
                      href={`/leads/${lead.id}`}
                      className="text-emerald-700 hover:text-emerald-900 font-bold"
                    >
                      View Notes & Timeline →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

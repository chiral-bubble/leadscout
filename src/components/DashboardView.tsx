'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Send,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  PoundSterling,
  Sparkles,
} from 'lucide-react';
import { DashboardMetrics } from '@/types/pipeline';

export default function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/pipeline');
        if (res.ok) {
          const data = await res.json();
          if (data.metrics) setMetrics(data.metrics);
        }
      } catch (err) {
        console.error('Error loading dashboard metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (isLoading || !metrics) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        Loading analytics dashboard...
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Leads Found',
      value: metrics.leads_found,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: 'UK local businesses in database',
    },
    {
      title: 'Contacted Leads',
      value: metrics.contacted,
      icon: Send,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      desc: 'First outreach sent manually',
    },
    {
      title: 'Reply Rate',
      value: `${metrics.reply_rate_pct}%`,
      icon: MessageSquare,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      desc: `${metrics.replies} positive responses received`,
    },
    {
      title: 'Discovery Calls Booked',
      value: metrics.calls_booked,
      icon: PhoneCall,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      desc: '10-minute audit review calls',
    },
    {
      title: 'Clients Won',
      value: metrics.won,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: 'Closed deals & converted projects',
    },
    {
      title: 'Won Revenue',
      value: `£${metrics.revenue_won_gbp.toLocaleString('en-GB')}`,
      icon: PoundSterling,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: `Pipeline potential: £${metrics.pipeline_potential_gbp.toLocaleString('en-GB')}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {card.value}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{card.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful conversion insight box */}
      <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-slate-700">
            <strong>UK Outreach Tip:</strong> Aim for 15 personalized first-contact messages per day. With an average response rate of 12-18% on WhatsApp and audited contact forms, that reliably generates 1-2 discovery calls every week.
          </span>
        </div>
      </div>
    </div>
  );
}

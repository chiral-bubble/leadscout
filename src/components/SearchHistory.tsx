'use client';

import React from 'react';
import { History, MapPin, Users, Coins, ArrowRight } from 'lucide-react';
import { SearchRecord } from '@/types/database';
import { formatGBP } from '@/lib/uk/pricing';

interface SearchHistoryProps {
  searches: SearchRecord[];
  activeSearchId?: string | null;
  onSelectSearch: (search: SearchRecord) => void;
  isLoadingHistory: boolean;
}

export function SearchHistory({
  searches,
  activeSearchId,
  onSelectSearch,
  isLoadingHistory,
}: SearchHistoryProps) {
  if (isLoadingHistory) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse space-y-3">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-12 bg-slate-100 rounded-lg"></div>
        <div className="h-12 bg-slate-100 rounded-lg"></div>
      </div>
    );
  }

  if (searches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center">
        <History className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <h4 className="text-xs font-semibold text-slate-700">No Saved Searches</h4>
        <p className="text-[11px] text-slate-400 mt-1">
          Searches you run will be saved here automatically for quick re-inspection.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Search History
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {searches.length} saved
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {searches.map((s) => {
          const isActive = s.id === activeSearchId;
          const formattedDate = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(s.created_at));

          return (
            <button
              key={s.id}
              onClick={() => onSelectSearch(s)}
              className={`w-full text-left p-3.5 transition group flex items-center justify-between ${
                isActive
                  ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-slate-900 capitalize">
                    {s.niche}
                  </span>
                  <span className="text-[11px] text-slate-400">•</span>
                  <span className="text-xs text-slate-600 flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {s.location}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    {s.results_count} leads
                  </span>
                  <span className="flex items-center gap-1 text-slate-600 font-mono">
                    <Coins className="w-3 h-3 text-amber-500" />
                    {formatGBP(s.estimated_api_cost_gbp || 0)}
                  </span>
                  <span>{s.radius_miles} mi radius</span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  {formattedDate} (London)
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
            </button>
          );
        })}
      </div>
    </div>
  );
}


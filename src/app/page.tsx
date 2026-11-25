'use client';

import React, { useState, useEffect } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { SearchHistory } from '@/components/SearchHistory';
import { TableSkeletonLoader } from '@/components/SkeletonLoader';
import KanbanBoard from '@/components/KanbanBoard';
import TodayView from '@/components/TodayView';
import DashboardView from '@/components/DashboardView';
import ExportCsvButton from '@/components/ExportCsvButton';
import { Lead, SearchRecord } from '@/types/database';
import {
  Globe,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Search,
  Layers,
  Calendar,
  TrendingUp,
  Download,
} from 'lucide-react';

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'discovery' | 'pipeline' | 'today' | 'dashboard'>('discovery');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeSearch, setActiveSearch] = useState<SearchRecord | null>(null);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  // Fetch search history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/searches');
        if (res.ok) {
          const data = await res.json();
          setSearches(data.searches || []);
        }
      } catch (err) {
        console.error('Error fetching search history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, []);

  // Run new search
  const handleSearch = async (params: {
    niche: string;
    location: string;
    radiusMiles: number;
    maxResults: 20 | 50 | 100 | 250;
    onlyNoWebsite?: boolean;
    provider?: 'osm' | 'companies_house';
  }) => {
    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const res = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete search');
      }

      setLeads(data.leads || []);
      setActiveSearch(data.search);
      setIsMockData(data.isMockData || false);
      if (data.warning) {
        setWarning(data.warning);
      }

      // Update history list with new search
      setSearches((prev) => [data.search, ...prev.filter((s) => s.id !== data.search.id)]);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'An unexpected error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select an existing search from history
  const handleSelectSearch = async (search: SearchRecord) => {
    setActiveSearch(search);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads?searchId=${search.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err: any) {
      console.error('Failed to load past search leads:', err);
      setError('Unable to load leads for this saved search.');
    } finally {
      setIsLoading(false);
    }
  };

  // Opportunity stats calculated from current leads
  const noWebsiteCount = leads.filter((l) => l.website_type === 'none').length;
  const socialOnlyCount = leads.filter((l) => l.website_type === 'social_only').length;
  const builderCount = leads.filter((l) => l.website_type === 'builder').length;
  const mobileCount = leads.filter((l) => l.phone_type === 'mobile').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            LeadScout UK
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-powered lead intelligence, pipeline management & click-to-chat outreach for UK web developers.
          </p>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('discovery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === 'discovery'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Discovery</span>
            </button>

            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === 'pipeline'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>

            <button
              onClick={() => setActiveTab('today')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Today</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          </div>

          <ExportCsvButton />
        </div>
      </div>

      {/* TAB 1: DISCOVERY & TABLE */}
      {activeTab === 'discovery' && (
        <div className="space-y-6">
          {/* Main Search Input Form */}
          <SearchForm onSearch={handleSearch} isLoading={isLoading} />

          {/* Error state alert */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Search Failed</div>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Warning alert */}
          {warning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Notice</div>
                <p className="mt-0.5">{warning}</p>
              </div>
            </div>
          )}

          {/* Pipeline Snapshot Metrics */}
          {leads.length > 0 && !isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">No Website</span>
                  <Flame className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600">{noWebsiteCount}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Primary targets for new web builds</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Social Only</span>
                  <Globe className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-600">{socialOnlyCount}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Using FB / Instagram as site</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Site Builders</span>
                  <Globe className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-purple-600">{builderCount}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Wix / Squarespace redesigns</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">WhatsApp Ready</span>
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-600">{mobileCount}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">07... UK mobile numbers</p>
              </div>
            </div>
          )}

          {/* Main Grid: Results Table + Search History */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            <div className="lg:col-span-3">
              {isLoading ? (
                <TableSkeletonLoader />
              ) : leads.length > 0 ? (
                <ResultsTable
                  leads={leads}
                  searchTitle={
                    activeSearch
                      ? `${activeSearch.niche.toUpperCase()} IN ${activeSearch.location.toUpperCase()}`
                      : 'Discovered Leads'
                  }
                  isMockData={isMockData}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <ShieldCheck className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Ready to Discover UK Leads
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                    Choose a niche above (like dentists, barbers or accountants) and enter a UK town, city or postcode to start scanning.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar: Search History */}
            <div className="lg:col-span-1">
              <SearchHistory
                searches={searches}
                activeSearchId={activeSearch?.id}
                onSelectSearch={handleSelectSearch}
                isLoadingHistory={isLoadingHistory}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KANBAN PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Drag and drop leads between columns to update stage. Click any card to view notes, reminders, or trigger follow-ups.
            </p>
          </div>
          <KanbanBoard initialLeads={leads} />
        </div>
      )}

      {/* TAB 3: TODAY'S FOCUS */}
      {activeTab === 'today' && <TodayView />}

      {/* TAB 4: DASHBOARD & REVENUE */}
      {activeTab === 'dashboard' && <DashboardView />}
    </div>
  );
}

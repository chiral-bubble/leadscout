'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  ExternalLink,
  Phone,
  MessageSquare,
  Globe,
  AlertCircle,
  ArrowUpDown,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  Loader2,
  Eye,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Building2,
  UserCheck,
  Lock,
  UserX,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  Lead,
  WebsiteType,
  PhoneType,
  WebsiteAudit,
  AuditStatus,
  CompanyRecord,
  OutreachClass,
} from '@/types/database';
import { StoredAnalysis } from '@/types/analysis';
import { AuditDrawer } from './AuditDrawer';
import { SuppressionModal } from './SuppressionModal';

interface ResultsTableProps {
  leads: Lead[];
  searchTitle?: string;
  isMockData?: boolean;
}

type SortField = 'name' | 'rating' | 'review_count' | 'lead_score';
type SortDirection = 'asc' | 'desc';

export function ResultsTable({ leads, searchTitle, isMockData }: ResultsTableProps) {
  const router = useRouter();

  const [sortField, setSortField] = useState<SortField>('lead_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [websiteFilter, setWebsiteFilter] = useState<'all' | WebsiteType>('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | PhoneType>('all');
  const [outreachFilter, setOutreachFilter] = useState<'all' | OutreachClass>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected lead for quick Google Maps / address info modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Audit state
  const [audits, setAudits] = useState<Record<string, WebsiteAudit>>({});
  const [auditStatuses, setAuditStatuses] = useState<Record<string, AuditStatus>>({});
  const [isAuditingBatch, setIsAuditingBatch] = useState(false);
  const [selectedAuditLead, setSelectedAuditLead] = useState<Lead | null>(null);
  const [selectedAuditData, setSelectedAuditData] = useState<WebsiteAudit | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  // Companies House & Outreach Eligibility state
  const [companies, setCompanies] = useState<Record<string, CompanyRecord>>({});
  const [outreachClasses, setOutreachClasses] = useState<Record<string, OutreachClass>>({});
  const [decisionMakers, setDecisionMakers] = useState<Record<string, string | null>>({});
  const [suppressedLeads, setSuppressedLeads] = useState<Record<string, boolean>>({});
  const [isSuppressionModalOpen, setIsSuppressionModalOpen] = useState(false);

  // AI Analysis state
  const [analyses, setAnalyses] = useState<Record<string, StoredAnalysis>>({});
  const [isAnalyzingLead, setIsAnalyzingLead] = useState<Record<string, boolean>>({});
  const [isAnalyzingTopBatch, setIsAnalyzingTopBatch] = useState(false);

  // Fetch Companies House, Suppression, Audits & Analyses
  const fetchAllIntelligence = async () => {
    if (leads.length === 0) return;
    const ids = leads.map((l) => l.id).join(',');

    try {
      // 1. Companies & Outreach
      const compRes = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      if (compRes.ok) {
        const data = await compRes.json();
        const results = data.results || {};
        const compMap: Record<string, CompanyRecord> = {};
        const outreachMap: Record<string, OutreachClass> = {};
        const dmMap: Record<string, string | null> = {};
        const supMap: Record<string, boolean> = {};

        Object.entries(results).forEach(([id, item]: [string, any]) => {
          if (item.company) compMap[id] = item.company;
          outreachMap[id] = item.outreachClass as OutreachClass;
          dmMap[id] = item.decisionMaker;
          supMap[id] = item.isSuppressed;
        });

        setCompanies(compMap);
        setOutreachClasses(outreachMap);
        setDecisionMakers(dmMap);
        setSuppressedLeads(supMap);
      }

      // 2. Existing Audits
      const auditRes = await fetch(`/api/audits?leadIds=${encodeURIComponent(ids)}`);
      if (auditRes.ok) {
        const aData = await auditRes.json();
        if (aData.audits) setAudits((prev) => ({ ...prev, ...aData.audits }));
        if (aData.statuses) setAuditStatuses((prev) => ({ ...prev, ...aData.statuses }));
      }

      // 3. Existing Analyses
      const analysisRes = await fetch(`/api/analyses?leadIds=${encodeURIComponent(ids)}`);
      if (analysisRes.ok) {
        const anData = await analysisRes.json();
        if (anData.analyses) setAnalyses((prev) => ({ ...prev, ...anData.analyses }));
      }
    } catch (err) {
      console.error('Failed to load intelligence data:', err);
    }
  };

  useEffect(() => {
    fetchAllIntelligence();
  }, [leads]);

  // Run AI Analysis for a single lead
  const handleRunAnalysis = async (lead: Lead) => {
    setIsAnalyzingLead((prev) => ({ ...prev, [lead.id]: true }));
    try {
      const res = await fetch('/api/analyses/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          audit: audits[lead.id] || null,
          company: companies[lead.id] || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.analysis) {
        setAnalyses((prev) => ({ ...prev, [lead.id]: data.analysis }));
      }
    } catch (err) {
      console.error('Failed to analyze lead:', err);
    } finally {
      setIsAnalyzingLead((prev) => ({ ...prev, [lead.id]: false }));
    }
  };

  // Run AI Analysis on top leads in bulk
  const handleAnalyzeTopLeads = async () => {
    setIsAnalyzingTopBatch(true);
    try {
      const res = await fetch('/api/analyses/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads, limit: 5 }),
      });
      const data = await res.json();
      if (res.ok && data.analyses) {
        setAnalyses((prev) => ({ ...prev, ...data.analyses }));
      }
    } catch (err) {
      console.error('Failed batch analysis:', err);
    } finally {
      setIsAnalyzingTopBatch(false);
    }
  };

  // "Do Not Contact" trigger per lead
  const handleSuppressLead = async (lead: Lead) => {
    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          reason: 'user_do_not_contact',
          notes: 'Marked Do-Not-Contact from leads table',
        }),
      });

      if (res.ok) {
        setSuppressedLeads((prev) => ({ ...prev, [lead.id]: true }));
        setOutreachClasses((prev) => ({ ...prev, [lead.id]: 'blocked' }));
      }
    } catch (err) {
      console.error('Failed to suppress lead:', err);
    }
  };

  // Run single audit
  const handleRunSingleAudit = async (lead: Lead) => {
    setAuditStatuses((prev) => ({ ...prev, [lead.id]: 'auditing' }));
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (res.ok && data.audit) {
        setAudits((prev) => ({ ...prev, [lead.id]: data.audit }));
        setAuditStatuses((prev) => ({
          ...prev,
          [lead.id]: data.audit.audit_error ? 'failed' : 'audited',
        }));
      } else {
        setAuditStatuses((prev) => ({ ...prev, [lead.id]: 'failed' }));
      }
    } catch {
      setAuditStatuses((prev) => ({ ...prev, [lead.id]: 'failed' }));
    }
  };

  // Run batch audit for all eligible leads
  const handleRunBatchAudit = async () => {
    const eligibleLeads = leads.filter(
      (l) => (l.website_type === 'own_site' || l.website_type === 'builder') && l.website
    );

    if (eligibleLeads.length === 0) return;

    setIsAuditingBatch(true);
    setAuditStatuses((prev) => {
      const next = { ...prev };
      eligibleLeads.forEach((l) => {
        if (next[l.id] !== 'audited') next[l.id] = 'auditing';
      });
      return next;
    });

    try {
      for (const lead of eligibleLeads) {
        if (auditStatuses[lead.id] === 'audited') continue;
        await handleRunSingleAudit(lead);
      }
    } finally {
      setIsAuditingBatch(false);
    }
  };

  // Open audit drawer
  const handleOpenAuditDrawer = (lead: Lead) => {
    setSelectedAuditLead(lead);
    setSelectedAuditData(audits[lead.id] || null);
    setIsAuditDrawerOpen(true);
  };

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered & Sorted Leads
  const processedLeads = useMemo(() => {
    const hasContactRoute = (l: Lead) => {
      if (l.has_contact_route === false) return false;
      const audit = audits[l.id];
      const hasPhone = Boolean(l.phone_e164 || l.phone_raw);
      const hasEmail = Boolean(audit?.contact_candidates?.emails?.length);
      const hasAuditPhone = Boolean(audit?.contact_candidates?.phones?.length);
      return hasPhone || hasEmail || hasAuditPhone;
    };

    return leads
      .filter((lead) => {
        if (websiteFilter !== 'all' && lead.website_type !== websiteFilter) return false;
        if (phoneFilter !== 'all' && lead.phone_type !== phoneFilter) return false;
        const oClass = outreachClasses[lead.id] || (suppressedLeads[lead.id] ? 'blocked' : 'individual_or_unknown');
        if (outreachFilter !== 'all' && oClass !== outreachFilter) return false;

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchName = lead.name.toLowerCase().includes(term);
          const matchAddress = (lead.address || '').toLowerCase().includes(term);
          const matchPostcode = (lead.postcode || '').toLowerCase().includes(term);
          const matchCompany = (companies[lead.id]?.legal_name || '').toLowerCase().includes(term);
          const matchDirector = (decisionMakers[lead.id] || '').toLowerCase().includes(term);
          if (!matchName && !matchAddress && !matchPostcode && !matchCompany && !matchDirector) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Stage 5A-1 Requirement 10: Sort leads with no contact route below actionable leads
        const routeA = hasContactRoute(a) ? 1 : 0;
        const routeB = hasContactRoute(b) ? 1 : 0;
        if (routeA !== routeB) {
          return routeB - routeA; // Actionable (1) before no-route (0)
        }

        if (sortField === 'lead_score') {
          const scoreA = analyses[a.id]?.lead_score || a.lead_score || 0;
          const scoreB = analyses[b.id]?.lead_score || b.lead_score || 0;
          return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        }

        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === null || valA === undefined) valA = 0;
        if (valB === null || valB === undefined) valB = 0;

        if (typeof valA === 'string') {
          return sortDirection === 'asc'
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }

        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [
    leads,
    websiteFilter,
    phoneFilter,
    outreachFilter,
    searchTerm,
    sortField,
    sortDirection,
    companies,
    decisionMakers,
    outreachClasses,
    suppressedLeads,
    analyses,
    audits,
  ]);

  // Export to CSV
  const handleExportCSV = () => {
    if (processedLeads.length === 0) return;
    const headers = [
      'Name',
      'Lead Score (1-10)',
      'Primary Opportunity',
      'Outreach Class',
      'Company Number',
      'Legal Name',
      'Likely Decision Maker',
      'Phone (E.164)',
      'Phone Type',
      'WhatsApp Likely',
      'Website',
      'Website Type',
      'Rating',
      'Review Count',
      'Audit Status',
      'Detected Platform',
      'Address',
      'Postcode',
      'Google Maps URL',
    ];

    const rows = processedLeads.map((l) => {
      const audit = audits[l.id];
      const comp = companies[l.id];
      const analysis = analyses[l.id];
      const oClass = outreachClasses[l.id] || 'individual_or_unknown';
      return [
        `"${l.name.replace(/"/g, '""')}"`,
        analysis?.lead_score || '',
        `"${analysis?.data?.recommended_primary_service || ''}"`,
        oClass,
        comp?.company_number || '',
        `"${comp?.legal_name || ''}"`,
        `"${decisionMakers[l.id] || ''}"`,
        `"${l.phone_e164 || l.phone_raw || ''}"`,
        l.phone_type,
        l.whatsapp_likely ? 'YES' : 'NO',
        `"${l.website || ''}"`,
        l.website_type,
        l.rating || '',
        l.review_count,
        auditStatuses[l.id] || 'pending',
        audit?.detected_platform || 'N/A',
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${l.postcode || ''}"`,
        `"${l.google_maps_url || ''}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leadscout-uk-stage4-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWebsiteBadge = (type: WebsiteType) => {
    switch (type) {
      case 'none':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            No Website
          </span>
        );
      case 'social_only':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Social Only
          </span>
        );
      case 'builder':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Site Builder
          </span>
        );
      case 'own_site':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Own Website
          </span>
        );
    }
  };

  const getPhoneBadge = (type: PhoneType, whatsappLikely: boolean) => {
    if (type === 'mobile') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          <MessageSquare className="w-3 h-3 text-green-600" />
          Mobile (WhatsApp)
        </span>
      );
    }
    if (type === 'landline') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Phone className="w-3 h-3 text-slate-500" />
          Landline
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-500 bg-slate-50">
        Unknown
      </span>
    );
  };

  const auditableCount = leads.filter(
    (l) => (l.website_type === 'own_site' || l.website_type === 'builder') && l.website
  ).length;

  const totalBlockedCount = Object.values(suppressedLeads).filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {searchTitle || 'Discovered Leads'}
              </h3>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                {processedLeads.length} of {leads.length} shown
              </span>
              {isMockData && (
                <span className="text-xs bg-rose-600 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked by AI Opportunity Score. Includes Playwright diagnostics, Companies House checks, and PECR status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk AI Analysis Button */}
            <button
              onClick={handleAnalyzeTopLeads}
              disabled={isAnalyzingTopBatch || leads.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {isAnalyzingTopBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Top 5...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Analyse Top Leads
                </>
              )}
            </button>

            {/* Audit All Button */}
            <button
              onClick={handleRunBatchAudit}
              disabled={isAuditingBatch || auditableCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm disabled:opacity-50"
            >
              {isAuditingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Auditing Batch...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Audit Sites ({auditableCount})
                </>
              )}
            </button>

            {/* Suppression List Manager Button */}
            <button
              onClick={() => setIsSuppressionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-red-600" />
              Suppression List {totalBlockedCount > 0 && `(${totalBlockedCount})`}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={processedLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Quick search input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, director or postcode..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Outreach Class Filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Outreach:</span>
            <select
              value={outreachFilter}
              onChange={(e) => setOutreachFilter(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">All Eligibility</option>
              <option value="corporate">Corporate (Ltd/LLP - Safe)</option>
              <option value="individual_or_unknown">Sole Trader (PECR Warning)</option>
              <option value="blocked">Blocked (Do Not Contact)</option>
            </select>
          </div>

          {/* Website Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Website:</span>
            <select
              value={websiteFilter}
              onChange={(e) => setWebsiteFilter(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Websites</option>
              <option value="none">No Website (Hot!)</option>
              <option value="social_only">Social Only</option>
              <option value="builder">Site Builder</option>
              <option value="own_site">Own Website</option>
            </select>
          </div>

          {/* Phone Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Phone:</span>
            <select
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Phones</option>
              <option value="mobile">Mobile (WhatsApp)</option>
              <option value="landline">Landline</option>
            </select>
          </div>

          {(websiteFilter !== 'all' || phoneFilter !== 'all' || outreachFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setWebsiteFilter('all');
                setPhoneFilter('all');
                setOutreachFilter('all');
                setSearchTerm('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium underline ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th
                onClick={() => handleSort('lead_score')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition select-none w-24 text-center bg-indigo-50/50"
              >
                <div className="flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Fit Score</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Business Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 w-44">Company & Director</th>
              <th
                onClick={() => handleSort('rating')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition select-none w-20"
              >
                <div className="flex items-center gap-1.5">
                  <span>Rating</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 w-28">Website Type</th>
              <th className="py-3 px-3 w-32">Phone Channel</th>
              <th className="py-3 px-3 w-28">Playwright</th>
              <th className="py-3 px-3 w-36">Outreach Class</th>
              <th className="py-3 px-3 w-32 text-center">AI Analysis</th>
              <th className="py-3 px-3 w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {processedLeads.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">No leads match the selected filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting your filters or running a new search.</p>
                </td>
              </tr>
            ) : (
              processedLeads.map((lead) => {
                const audit = audits[lead.id];
                const status = auditStatuses[lead.id] || (audit ? 'audited' : 'pending');
                const isAuditable =
                  (lead.website_type === 'own_site' || lead.website_type === 'builder') &&
                  Boolean(lead.website);

                const company = companies[lead.id];
                const isSuppressed = Boolean(suppressedLeads[lead.id] || lead.is_suppressed);
                const outreachClass = isSuppressed
                  ? 'blocked'
                  : outreachClasses[lead.id] || 'individual_or_unknown';
                const director = decisionMakers[lead.id];
                const analysis = analyses[lead.id];
                const isAnalyzing = isAnalyzingLead[lead.id] || false;

                const score = analysis?.lead_score || lead.lead_score;

                return (
                  <tr
                    key={lead.place_id}
                    className={`hover:bg-slate-50 transition group ${
                      isSuppressed ? 'bg-red-50/40 opacity-75' : ''
                    }`}
                  >
                    {/* Lead Fit Score Column */}
                    <td className="py-3 px-3 text-center bg-slate-50/40">
                      {score ? (
                        <button
                          onClick={() => router.push(`/leads/${lead.id}`)}
                          className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-full text-xs shadow-xs transition ${
                            score >= 8
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                              : score >= 5
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200 hover:bg-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to view AI dossier"
                        >
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>{score}/10</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-mono">—</span>
                      )}
                    </td>

                    {/* Business Name & Website */}
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {lead.selected_name || lead.name}
                          {isSuppressed && (
                            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              BLOCKED
                            </span>
                          )}
                        </div>
                        {/* Stage 5A-1 Requirement 6: Show website name when audit exists and differs from OSM name */}
                        {(() => {
                          const webTitleName =
                            lead.website_name ||
                            (audit?.page_title
                              ? audit.page_title.split(/[-|•–:]/)[0].trim()
                              : audit?.h1_text?.trim() || null);
                          if (
                            webTitleName &&
                            webTitleName.toLowerCase() !== lead.name.toLowerCase() &&
                            webTitleName.length > 2 &&
                            webTitleName.length < 60
                          ) {
                            return (
                              <div className="text-[10px] text-indigo-600 font-medium truncate max-w-xs" title={`Name on website: ${webTitleName}`}>
                                Site name: {webTitleName}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 mt-0.5 truncate max-w-xs"
                          >
                            <Globe className="w-3 h-3" />
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No web address</span>
                        )}
                      </div>
                    </td>

                    {/* Companies House & Director */}
                    <td className="py-3.5 px-3">
                      {company ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Building2 className="w-3 h-3" />
                              #{company.company_number}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">
                              {company.company_type.toUpperCase()}
                            </span>
                          </div>

                          {director ? (
                            <div className="text-[11px] font-medium text-slate-800 flex items-center gap-1" title="Likely decision maker (director on record)">
                              <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{director}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No director named</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Unmatched / Sole Trader
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Rating (Handles OSM null ratings and null review counts without breaking) */}
                    <td className="py-3.5 px-3">
                      {lead.rating !== null && lead.rating !== undefined ? (
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{lead.rating.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400">
                            ({lead.review_count !== null && lead.review_count !== undefined ? lead.review_count : 'Unknown'})
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[11px] italic block" title="Ratings are not available in OpenStreetMap data">
                            No rating
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Reviews: {lead.review_count !== null && lead.review_count !== undefined ? lead.review_count : 'Unknown'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Website Type */}
                    <td className="py-3.5 px-3">{getWebsiteBadge(lead.website_type)}</td>

                    {/* Phone Type & Contact Route */}
                    <td className="py-3.5 px-3">
                      <div>
                        {(() => {
                          const hasPhone = Boolean(lead.phone_e164 || lead.phone_raw);
                          const hasEmail = Boolean(audit?.contact_candidates?.emails?.length);
                          const hasRoute = lead.has_contact_route !== false && (hasPhone || hasEmail);

                          if (!hasRoute) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                No contact route
                              </span>
                            );
                          }

                          return (
                            <>
                              {getPhoneBadge(lead.phone_type, lead.whatsapp_likely)}
                              {lead.phone_e164 && (
                                <div className="text-[11px] font-mono text-slate-500 mt-1">
                                  {lead.phone_e164}
                                </div>
                              )}
                              {!hasPhone && hasEmail && (
                                <div className="text-[10px] font-mono text-indigo-600 mt-0.5 truncate max-w-[130px]">
                                  ✉ {audit!.contact_candidates.emails[0]}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Playwright Audit Column */}
                    <td className="py-3.5 px-3 text-center">
                      {!isAuditable ? (
                        <span className="text-[11px] text-slate-400 italic">No site</span>
                      ) : status === 'auditing' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                          Auditing...
                        </span>
                      ) : status === 'audited' && audit ? (
                        <button
                          onClick={() => handleOpenAuditDrawer(lead)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Audited</span>
                          {audit.is_outdated_copyright && (
                            <span title="Outdated Copyright!">
                              <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </button>
                      ) : status === 'failed' ? (
                        <button
                          onClick={() => handleOpenAuditDrawer(lead)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Failed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRunSingleAudit(lead)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition"
                        >
                          <Play className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                          Audit
                        </button>
                      )}
                    </td>

                    {/* Outreach Class & PECR Warning */}
                    <td className="py-3.5 px-3">
                      {outreachClass === 'blocked' ? (
                        <div className="flex items-center gap-1 text-red-700 bg-red-100/80 px-2 py-0.5 rounded text-[10px] font-bold">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>Blocked</span>
                        </div>
                      ) : outreachClass === 'corporate' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <ShieldCheck className="w-3 h-3" />
                          Corporate B2B
                        </span>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded p-1 text-[9px] text-amber-900 leading-tight">
                          <span className="font-bold flex items-center gap-0.5 text-amber-800">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            PECR Warning
                          </span>
                          Sole trader consent rules apply.
                        </div>
                      )}
                    </td>

                    {/* AI Analysis Column */}
                    <td className="py-3.5 px-3 text-center">
                      {isAnalyzing ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                          Analyzing...
                        </span>
                      ) : analysis ? (
                        <button
                          onClick={() => router.push(`/leads/${lead.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          View Dossier
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRunAnalysis(lead)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          Analyse
                        </button>
                      )}
                    </td>

                    {/* Quick Maps & Do Not Contact Actions */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!isSuppressed ? (
                          <button
                            onClick={() => handleSuppressLead(lead)}
                            title="Block: Do Not Contact"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-red-500 font-bold">
                            ✕
                          </span>
                        )}

                        {lead.google_maps_url && (
                          <a
                            href={lead.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on Google Maps"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedLead(lead)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Suppression List Management Modal */}
      <SuppressionModal
        isOpen={isSuppressionModalOpen}
        onClose={() => setIsSuppressionModalOpen(false)}
        onSuppressionUpdated={fetchAllIntelligence}
      />

      {/* Audit Detail Drawer */}
      <AuditDrawer
        audit={selectedAuditData}
        lead={selectedAuditLead}
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
      />

      {/* Quick Inspect Lead Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedLead.name}</h3>
                <p className="text-xs text-slate-500">{selectedLead.address}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-4 bg-slate-50 p-4 rounded-lg">
              <div>
                <span className="text-slate-400 block mb-1">Phone Number:</span>
                <span className="font-mono font-medium text-slate-800">
                  {selectedLead.phone_e164 || selectedLead.phone_raw || 'Not available'}
                </span>
                <div className="mt-1">
                  {getPhoneBadge(selectedLead.phone_type, selectedLead.whatsapp_likely)}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Company Status:</span>
                <span className="font-bold text-slate-800">
                  {companies[selectedLead.id]?.legal_name || 'Sole Trader / Unregistered'}
                </span>
                {decisionMakers[selectedLead.id] && (
                  <span className="text-emerald-700 block font-medium mt-0.5">
                    Director: {decisionMakers[selectedLead.id]}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Website Classification:</span>
                <div>{getWebsiteBadge(selectedLead.website_type)}</div>
                {selectedLead.website && (
                  <a
                    href={selectedLead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline truncate block mt-1"
                  >
                    {selectedLead.website}
                  </a>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Outreach Policy:</span>
                <span
                  className={`font-bold ${
                    outreachClasses[selectedLead.id] === 'corporate'
                      ? 'text-emerald-700'
                      : outreachClasses[selectedLead.id] === 'blocked'
                      ? 'text-red-700'
                      : 'text-amber-700'
                  }`}
                >
                  {outreachClasses[selectedLead.id] === 'corporate'
                    ? 'Corporate B2B'
                    : outreachClasses[selectedLead.id] === 'blocked'
                    ? 'Blocked (Do Not Contact)'
                    : 'Individual / Sole Trader (PECR Restricted)'}
                </span>
              </div>
            </div>

            {/* Note regarding compliant contact details */}
            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Compliance Rule:</span>
                <p className="mt-0.5">
                  Only contact details published on the business's own website or Google profile are stored. Personal emails or private mobile numbers are never scraped or guessed.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              {!suppressedLeads[selectedLead.id] && (
                <button
                  onClick={() => {
                    handleSuppressLead(selectedLead);
                    setSelectedLead(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                >
                  Add to Do-Not-Contact List
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {selectedLead.google_maps_url && (
                  <a
                    href={selectedLead.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Google Maps
                  </a>
                )}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

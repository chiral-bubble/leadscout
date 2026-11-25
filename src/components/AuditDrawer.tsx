'use client';

import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Monitor,
  AlertTriangle,
  Clock,
  Calendar,
  Mail,
  Phone,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  Flame,
  Globe,
  Share2,
  Zap,
} from 'lucide-react';
import { WebsiteAudit, Lead } from '@/types/database';

interface AuditDrawerProps {
  audit: WebsiteAudit | null;
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDrawer({ audit, lead, isOpen, onClose }: AuditDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'screenshots' | 'contacts' | 'excerpt'>('overview');

  if (!isOpen || !lead) return null;

  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                Website Audit Dossier
              </span>
              {audit?.detected_platform && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                  {audit.detected_platform}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{lead.name}</h2>
            {audit?.final_url || lead.website ? (
              <a
                href={audit?.final_url || lead.website || '#'}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <Globe className="w-3.5 h-3.5" />
                {audit?.final_url || lead.website}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Overview & Opportunities
          </button>
          <button
            onClick={() => setActiveTab('screenshots')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'screenshots'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Screenshots
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'contacts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Extracted Contacts & Socials
          </button>
          <button
            onClick={() => setActiveTab('excerpt')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'excerpt'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Cleaned Text (3,000 Chars)
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!audit ? (
            <div className="p-8 text-center text-slate-400">
              <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">No audit record found for this lead</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Run Audit" in the leads table to crawl this site with Playwright.
              </p>
            </div>
          ) : audit.audit_error ? (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Audit Encountered Error
              </div>
              <p>{audit.audit_error}</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & OPPORTUNITY FLAGS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* High Intent Pitch Opportunities */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-500" />
                      Freelancer Opportunity Signals
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Outdated copyright flag */}
                      <div
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          audit.is_outdated_copyright
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <Clock className={`w-4 h-4 mt-0.5 ${audit.is_outdated_copyright ? 'text-amber-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="text-xs font-bold">
                            {audit.copyright_year
                              ? `Copyright © ${audit.copyright_year}`
                              : 'No copyright year found'}
                          </div>
                          <p className="text-[11px] mt-0.5 opacity-80">
                            {audit.is_outdated_copyright
                              ? `Outdated copyright (${currentYear - (audit.copyright_year || currentYear)} years old) - Strong indicator of an abandoned or neglected website.`
                              : 'Recent copyright year indicates active maintenance.'}
                          </p>
                        </div>
                      </div>

                      {/* Online booking flag */}
                      <div
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          !audit.has_online_booking
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 mt-0.5 ${!audit.has_online_booking ? 'text-indigo-600' : 'text-emerald-500'}`} />
                        <div>
                          <div className="text-xs font-bold">
                            {audit.has_online_booking
                              ? `Booking: ${audit.booking_providers.join(', ')}`
                              : 'No Online Booking System'}
                          </div>
                          <p className="text-[11px] mt-0.5 opacity-80">
                            {!audit.has_online_booking
                              ? 'Prime candidate to upsell an automated booking integration (Calendly, Fresha, or custom booking flow).'
                              : 'Already has online scheduling installed.'}
                          </p>
                        </div>
                      </div>

                      {/* Mobile friendliness flag */}
                      <div
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          !audit.mobile_friendly
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <Smartphone className={`w-4 h-4 mt-0.5 ${!audit.mobile_friendly ? 'text-rose-600' : 'text-emerald-600'}`} />
                        <div>
                          <div className="text-xs font-bold">
                            {audit.mobile_friendly ? 'Mobile Friendly' : 'Mobile Experience Bottlenecks'}
                          </div>
                          <p className="text-[11px] mt-0.5 opacity-80">
                            {audit.mobile_friendly
                              ? 'Renders cleanly on 390x844 with viewport meta tag.'
                              : audit.mobile_issues.join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* Broken links flag */}
                      <div
                        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                          audit.broken_links_count > 0
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <AlertTriangle className={`w-4 h-4 mt-0.5 ${audit.broken_links_count > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="text-xs font-bold">
                            {audit.broken_links_count > 0
                              ? `${audit.broken_links_count} Broken Internal Links`
                              : 'No Broken Internal Links'}
                          </div>
                          <p className="text-[11px] mt-0.5 opacity-80">
                            {audit.broken_links_count > 0
                              ? 'Fixing broken links is an easy entry-point audit pitch.'
                              : 'Internal links returned healthy HTTP status.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core Diagnostic Metrics */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                      Performance & Security
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-400 block mb-1">HTTP Status</span>
                        <span className={`text-base font-bold ${audit.http_status === 200 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {audit.http_status || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-400 block mb-1">SSL Certificate</span>
                        <div className="flex items-center justify-center gap-1">
                          {audit.ssl_valid ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                          )}
                          <span className={`text-xs font-bold ${audit.ssl_valid ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {audit.ssl_valid ? 'Valid HTTPS' : 'Insecure'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-400 block mb-1">Local DOM Load</span>
                        <span className="text-base font-bold text-slate-800">
                          {audit.load_time_ms ? `${(audit.load_time_ms / 1000).toFixed(2)}s` : '—'}
                        </span>
                        <span className="text-[9px] text-amber-600 block mt-0.5 leading-tight">
                          Audit machine (unreliable)
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-400 block mb-1">LCP (Speed)</span>
                        <span className="text-base font-bold text-slate-800">
                          {audit.largest_contentful_paint_ms ? `${(audit.largest_contentful_paint_ms / 1000).toFixed(2)}s` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                      Features & Compliance
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        {audit.has_contact_form ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_contact_form ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          Contact Form
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {audit.has_whatsapp_link ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_whatsapp_link ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          WhatsApp Direct Link
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {audit.has_live_chat ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_live_chat ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          Live Chat Widget
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {audit.has_ecommerce ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_ecommerce ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          E-Commerce / Cart
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {audit.has_cookie_banner ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_cookie_banner ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          Cookie Banner (GDPR)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {audit.has_privacy_policy ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={audit.has_privacy_policy ? 'font-medium text-slate-800' : 'text-slate-400'}>
                          Privacy Policy
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SEO Headers */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                    <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
                      SEO & Meta Tags
                    </h3>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Page Title</span>
                      <p className="font-medium text-slate-800">{audit.page_title || 'None'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Meta Description</span>
                      <p className="text-slate-600">{audit.meta_description || 'Missing meta description'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">H1 Heading</span>
                      <p className="text-slate-700">{audit.h1_text || 'Missing H1 heading'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCREENSHOTS */}
              {activeTab === 'screenshots' && (
                <div className="space-y-6">
                  {/* Desktop Screenshot */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                      <Monitor className="w-4 h-4 text-indigo-600" />
                      Desktop Viewport (1280x800)
                    </h4>
                    {audit.screenshot_desktop ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-100">
                        <img
                          src={audit.screenshot_desktop}
                          alt="Desktop Screenshot"
                          className="w-full object-cover max-h-[400px]"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs">
                        No desktop screenshot captured
                      </div>
                    )}
                  </div>

                  {/* Mobile Screenshot */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      Mobile Viewport (390x844 - iPhone)
                    </h4>
                    {audit.screenshot_mobile ? (
                      <div className="max-w-xs mx-auto border-4 border-slate-800 rounded-3xl overflow-hidden shadow-lg bg-black">
                        <img
                          src={audit.screenshot_mobile}
                          alt="Mobile Screenshot"
                          className="w-full object-cover max-h-[500px]"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs">
                        No mobile screenshot captured
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CONTACTS & SOCIALS */}
              {activeTab === 'contacts' && (
                <div className="space-y-5">
                  {/* Extracted Emails */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
                      <Mail className="w-4 h-4 text-indigo-600" />
                      Extracted Candidate Emails
                    </h4>
                    {audit.contact_candidates.emails.length > 0 ? (
                      <div className="space-y-1.5">
                        {audit.contact_candidates.emails.map((email, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border text-xs font-mono">
                            <span className="text-slate-800">{email}</span>
                            <a
                              href={`mailto:${email}`}
                              className="text-indigo-600 hover:underline text-[11px]"
                            >
                              mailto:
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No email addresses found on the homepage</p>
                    )}
                  </div>

                  {/* Extracted Phone Numbers */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      Extracted Candidate Phone Numbers
                    </h4>
                    {audit.contact_candidates.phones.length > 0 ? (
                      <div className="space-y-1.5">
                        {audit.contact_candidates.phones.map((phone, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border text-xs font-mono">
                            <span className="text-slate-800">{phone}</span>
                            <a
                              href={`tel:${phone}`}
                              className="text-emerald-600 hover:underline text-[11px]"
                            >
                              tel:
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No direct phone links detected on the homepage</p>
                    )}
                  </div>

                  {/* Social Profiles */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
                      <Share2 className="w-4 h-4 text-purple-600" />
                      Detected Social Profiles
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(audit.social_links).map(([platform, link]) => (
                        <a
                          key={platform}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between bg-white p-2.5 rounded-lg border hover:border-indigo-400 transition"
                        >
                          <span className="capitalize font-semibold text-slate-800">{platform}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VISIBLE TEXT EXCERPT */}
              {activeTab === 'excerpt' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Cleaned Homepage Text Excerpt ({audit.text_excerpt.length} characters)
                    </h4>
                    <span className="text-[11px] text-slate-400">Fed to Stage 3 AI Analysis</span>
                  </div>
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed border border-slate-800">
                    {audit.text_excerpt || 'No readable text content extracted.'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

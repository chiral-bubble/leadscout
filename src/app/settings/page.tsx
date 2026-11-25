'use client';

import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertTriangle, ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [services, setServices] = useState('');
  const [credibilityStatement, setCredibilityStatement] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [ukContactAddress, setUkContactAddress] = useState('');
  const [optOutWording, setOptOutWording] = useState("If not for you, just say and I won't message again.");
  
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setName(data.settings.name || '');
            setTradingName(data.settings.trading_name || '');
            setWebsite(data.settings.website || '');
            setContactEmail(data.settings.contact_email || '');
            setServices(Array.isArray(data.settings.services) ? data.settings.services.join(', ') : '');
            setCredibilityStatement(data.settings.credibility_statement || '');
            setWhatsappNumber(data.settings.whatsapp_number || '');
            setUkContactAddress(data.settings.uk_contact_address || '');
            if (data.settings.opt_out_wording) setOptOutWording(data.settings.opt_out_wording);
          }
        }
      } catch (err: any) {
        console.error('Failed to load settings:', err);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    const servicesArray = services
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          trading_name: tradingName,
          website,
          contact_email: contactEmail,
          services: servicesArray,
          credibility_statement: credibilityStatement,
          whatsapp_number: whatsappNumber,
          uk_contact_address: ukContactAddress,
          opt_out_wording: optOutWording,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leads
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Sender Profile & Compliance Settings
        </h1>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="space-y-1 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Sender Profile (Used in Pitches)</h2>
          <p className="text-xs text-slate-500">
            Pitches will sign off with &quot;Best,&quot; followed by your first name only, and will never state your location.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tommy"
              className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trading Name *</label>
            <input
              type="text"
              required
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              placeholder="Your trading name"
              className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Website URL *</label>
            <input
              type="url"
              required
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.co.uk"
              className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email *</label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.co.uk"
              className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Business Number</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+447123456789"
              className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Services Offered (comma separated)</label>
          <input
            type="text"
            value={services}
            onChange={(e) => setServices(e.target.value)}
            placeholder="Simple websites, Quote forms, Online booking"
            className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">One-Line Credibility Statement</label>
          <input
            type="text"
            value={credibilityStatement}
            onChange={(e) => setCredibilityStatement(e.target.value)}
            placeholder="Optional one-line note on what you build"
            className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">UK Contact Address (for compliance)</label>
          <input
            type="text"
            value={ukContactAddress}
            onChange={(e) => setUkContactAddress(e.target.value)}
            placeholder="e.g. 71-75 Shelton Street, Covent Garden, London WC2H 9JQ"
            className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Opt-Out Wording</label>
          <input
            type="text"
            value={optOutWording}
            onChange={(e) => setOptOutWording(e.target.value)}
            className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {status === 'error' && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === 'saved' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Sender settings saved successfully!</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={status === 'saving'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {status === 'saving' ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

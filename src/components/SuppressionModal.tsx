'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Lock,
} from 'lucide-react';
import { SuppressionRecord } from '@/types/database';

interface SuppressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuppressionUpdated?: () => void;
}

export function SuppressionModal({ isOpen, onClose, onSuppressionUpdated }: SuppressionModalProps) {
  const [list, setList] = useState<SuppressionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkInput, setBulkInput] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/suppression');
      if (res.ok) {
        const data = await res.json();
        setList(data.suppressionList || []);
      }
    } catch (err) {
      console.error('Error fetching suppression list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen]);

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput: bulkInput.trim(),
          reason: 'manual_bulk_import',
          notes: 'Imported via Suppression Manager',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportStatus(`Successfully added ${data.addedCount} items to suppression list.`);
        setBulkInput('');
        fetchList();
        if (onSuppressionUpdated) onSuppressionUpdated();
      }
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/suppression?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setList((prev) => prev.filter((item) => item.id !== id));
        if (onSuppressionUpdated) onSuppressionUpdated();
      }
    } catch (err) {
      console.error('Failed to remove suppression entry:', err);
    }
  };

  if (!isOpen) return null;

  const filteredList = list.filter((item) => {
    if (!filterTerm.trim()) return true;
    const term = filterTerm.toLowerCase();
    return (
      (item.business_name || '').toLowerCase().includes(term) ||
      (item.email || '').toLowerCase().includes(term) ||
      (item.phone_e164 || '').toLowerCase().includes(term) ||
      (item.domain || '').toLowerCase().includes(term) ||
      (item.reason || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Suppression & Do-Not-Contact List
              </h3>
              <p className="text-xs text-slate-500">
                Any lead matching these numbers, emails, domains, or names is strictly blocked from outreach in the UI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Bulk Import Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-indigo-600" />
              Import Blocklist (Numbers or Emails)
            </h4>
            <p className="text-xs text-slate-500 mb-2">
              Paste UK phone numbers (e.g. 07911 123456), emails, or domains separated by newlines or commas:
            </p>
            <form onSubmit={handleBulkImport} className="space-y-2">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="07911123456, info@competitor.co.uk, badfit-lead.co.uk..."
                rows={3}
                className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-between">
                {importStatus ? (
                  <span className="text-xs text-emerald-600 font-medium">{importStatus}</span>
                ) : (
                  <span className="text-[11px] text-slate-400">Standardises to E.164 and root domain automatically</span>
                )}
                <button
                  type="submit"
                  disabled={!bulkInput.trim()}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition disabled:opacity-50"
                >
                  Add to Suppression
                </button>
              </div>
            </form>
          </div>

          {/* Current Suppression Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Currently Blocked ({filteredList.length} of {list.length})
              </h4>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  placeholder="Filter list..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading suppression list...</div>
            ) : filteredList.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl text-xs text-slate-400">
                No suppression entries match your filter.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
                {filteredList.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {item.business_name || item.domain || item.email || item.phone_e164}
                        <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.2 rounded font-medium">
                          {item.reason}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono space-x-2 mt-0.5">
                        {item.phone_e164 && <span>Phone: {item.phone_e164}</span>}
                        {item.email && <span>Email: {item.email}</span>}
                        {item.domain && <span>Domain: {item.domain}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      title="Unblock entry"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

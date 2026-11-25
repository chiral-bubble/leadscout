'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportCsvButtonProps {
  filterStatus?: string;
  className?: string;
}

export default function ExportCsvButton({ filterStatus = 'all', className = '' }: ExportCsvButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = `/api/export/csv?status=${encodeURIComponent(filterStatus)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download CSV');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `leadscout-uk-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition disabled:opacity-50 ${className}`}
      title="Export all leads to CSV"
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
      ) : (
        <Download className="w-3.5 h-3.5 text-slate-500" />
      )}
      <span>Export CSV</span>
    </button>
  );
}

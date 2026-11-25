import React from 'react';

export function TableSkeletonLoader() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="h-5 w-48 bg-slate-200 rounded"></div>
        <div className="h-8 w-32 bg-slate-200 rounded"></div>
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
              <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
            </div>
            <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
            <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
            <div className="h-6 w-16 bg-slate-200 rounded-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg">
          <div className="h-4 w-3/4 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
        </div>
      ))}
    </div>
  );
}


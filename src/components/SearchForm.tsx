'use client';

import React, { useState } from 'react';
import { Search, MapPin, Gauge, Coins, Loader2, Sparkles } from 'lucide-react';
import { estimateSearchCostGBP, formatGBP } from '@/lib/uk/pricing';

interface SearchFormProps {
  onSearch: (params: {
    niche: string;
    location: string;
    radiusMiles: number;
    maxResults: 20 | 50 | 100;
    onlyNoWebsite?: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

const NICHE_SUGGESTIONS = [
  'dentists',
  'barbers',
  'plumbers',
  'restaurants',
  'estate agents',
  'gyms',
  'accountants',
  'wedding photographers',
];

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [niche, setNiche] = useState('barbers');
  const [location, setLocation] = useState('Reading');
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [maxResults, setMaxResults] = useState<20 | 50 | 100>(20);
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false);

  const estimatedCost = estimateSearchCostGBP(maxResults);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim() || isLoading) return;
    onSearch({
      niche: niche.trim(),
      location: location.trim(),
      radiusMiles,
      maxResults,
      onlyNoWebsite,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            Discover UK Leads
          </h2>
          <p className="text-sm text-slate-500">
            Search Google Places across the UK to uncover businesses needing websites, booking systems, or redesigns.
          </p>
        </div>

        {/* Live Estimated Google API Cost */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs">
          <Coins className="w-4 h-4 text-amber-600" />
          <span className="text-slate-600">Est. Google API cost:</span>
          <span className="font-semibold text-slate-900">{formatGBP(estimatedCost)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Business Niche */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Business Niche
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. dentists, plumbers"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition"
              />
            </div>
          </div>

          {/* UK Location */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              UK Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, town or postcode (e.g. Leeds, BS1)"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition"
              />
            </div>
          </div>

          {/* Radius (1-20 miles) */}
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Radius
              </label>
              <span className="text-xs font-bold text-indigo-600">{radiusMiles} miles</span>
            </div>
            <div className="pt-2 px-1">
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1 mi</span>
                <span>10 mi</span>
                <span>20 mi</span>
              </div>
            </div>
          </div>

          {/* Max Results */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Max Results
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([20, 50, 100] as const).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxResults(num)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                    maxResults === num
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Niche Suggestions */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Popular UK SME niches:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NICHE_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setNiche(suggestion)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  niche.toLowerCase() === suggestion
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Filter: Only businesses with no website tag */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="onlyNoWebsite"
            checked={onlyNoWebsite}
            onChange={(e) => setOnlyNoWebsite(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="onlyNoWebsite" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Only businesses with no website tag (Prime targets for new websites)
          </label>
        </div>

        {/* Submit Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Query: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">{`"${niche} in ${location}, UK"`}</code>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching Google Places...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Find UK Leads
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


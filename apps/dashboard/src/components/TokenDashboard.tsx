'use client';

import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, TrendingUp, AlertTriangle } from 'lucide-react';

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  activityScore: number;
  volume24hUsd: number;
  swapsCount: number;
  opportunitiesCount: number;
  medianNetUsd: number;
  riskLevel: string;
  watched: boolean;
}

interface TokenDashboardProps {
  tokens: TokenInfo[];
}

export const TokenDashboard: React.FC<TokenDashboardProps> = ({ tokens: initialTokens }) => {
  const [tokens, setTokens] = useState<TokenInfo[]>(initialTokens);

  const toggleWatch = (symbol: string) => {
    setTokens(tokens.map(t => t.symbol === symbol ? { ...t, watched: !t.watched } : t));
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-200/60 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider font-bold text-white">
          Base Active Tokens & Activity Scores (Hybrid Discovery)
        </h2>
        <span className="text-[11px] text-gray-400 font-mono">
          Watchlist & Opportunity Density
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-surface-200 text-gray-400 bg-surface-50/40">
              <th className="py-2 px-3">TOKEN</th>
              <th className="py-2 px-3">ACTIVITY SCORE</th>
              <th className="py-2 px-3">24H VOLUME</th>
              <th className="py-2 px-3">SWAPS</th>
              <th className="py-2 px-3">OPP DENSITY</th>
              <th className="py-2 px-3">MEDIAN NET</th>
              <th className="py-2 px-3">RISK</th>
              <th className="py-2 px-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {tokens.map((token) => (
              <tr key={token.symbol} className="hover:bg-surface-100/50 transition-colors">
                <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                  {token.symbol}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-terminal-cyan">{token.activityScore}</span>
                    <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                      <div
                        className="h-full bg-terminal-cyan"
                        style={{ width: `${token.activityScore}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 text-gray-300 whitespace-nowrap">
                  ${token.volume24hUsd.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                  {token.swapsCount}
                </td>
                <td className="py-2 px-3 text-terminal-green font-semibold whitespace-nowrap">
                  {token.opportunitiesCount} opps/h
                </td>
                <td className="py-2 px-3 text-white whitespace-nowrap">
                  +${token.medianNetUsd.toFixed(3)}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    token.riskLevel === 'LOW' ? 'bg-terminal-green/10 text-terminal-green' : 'bg-terminal-amber/10 text-terminal-amber'
                  }`}>
                    {token.riskLevel}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => toggleWatch(token.symbol)}
                    className="p-1 rounded hover:bg-surface-200 text-gray-400 hover:text-terminal-amber transition-colors"
                  >
                    {token.watched ? (
                      <BookmarkCheck className="w-4 h-4 text-terminal-amber" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { TrendingUp, PieChart, DollarSign, ArrowUpRight } from 'lucide-react';

interface PnlAnalyticsProps {
  account: {
    startingCapitalUsd: number;
    balanceUsd: number;
    availableCapitalUsd: number;
    reservedCapitalUsd: number;
    deployedCapitalUsd: number;
    realizedGrossPnlUsd: number;
    realizedNetPnlUsd: number;
    totalFeesPaidUsd: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    maxDrawdownUsd: number;
  };
  rejections: Record<string, number>;
}

export const PnlAnalytics: React.FC<PnlAnalyticsProps> = ({ account, rejections }) => {
  const returnPercent = ((account.realizedNetPnlUsd) / account.startingCapitalUsd) * 100;
  const winRate = account.totalTrades > 0 ? (account.winningTrades / account.totalTrades) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Account Summary */}
      <div className="terminal-card p-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-white mb-3 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-terminal-green" />
          Paper Account & Capital Allocation
        </h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">Starting Balance:</span>
            <span className="text-white font-bold">${account.startingCapitalUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">Current Balance:</span>
            <span className="text-terminal-green font-bold">${account.balanceUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">Available Capital:</span>
            <span className="text-white">${account.availableCapitalUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">Realized Gross P&L:</span>
            <span className="text-white">+${account.realizedGrossPnlUsd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">L2/L1 Fees Paid:</span>
            <span className="text-terminal-red">-${account.totalFeesPaidUsd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-200">
            <span className="text-gray-400">Realized Net P&L:</span>
            <span className="text-terminal-green font-bold">+${account.realizedNetPnlUsd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Return on Capital:</span>
            <span className="text-terminal-green font-bold">+{returnPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* 2. Micro-MEV Profit Buckets */}
      <div className="terminal-card p-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-white mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-terminal-cyan" />
          Opportunity Profit Buckets ($0.01 - $1.00+)
        </h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">&gt; $0.20 net:</span>
            <span className="text-terminal-green font-bold">14 opps</span>
          </div>
          <div className="w-full bg-surface-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-terminal-green h-full" style={{ width: '45%' }}></div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-400">$0.09 - $0.20 net:</span>
            <span className="text-terminal-cyan font-bold">28 opps</span>
          </div>
          <div className="w-full bg-surface-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-terminal-cyan h-full" style={{ width: '75%' }}></div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-400">$0.01 - $0.09 net:</span>
            <span className="text-terminal-amber font-bold">52 opps</span>
          </div>
          <div className="w-full bg-surface-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-terminal-amber h-full" style={{ width: '90%' }}></div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-400">&lt; $0.01 / Negative:</span>
            <span className="text-gray-400">184 candidates</span>
          </div>
        </div>
      </div>

      {/* 3. Rejection Reason Breakdown */}
      <div className="terminal-card p-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-white mb-3 flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-terminal-red" />
          Rejection Reasons (Filter Audit)
        </h3>
        <div className="space-y-2 text-xs font-mono">
          {Object.entries(rejections).length === 0 ? (
            <div className="text-gray-500 py-4 text-center">No rejections recorded</div>
          ) : (
            Object.entries(rejections).map(([reason, count]) => (
              <div key={reason} className="flex justify-between py-1 border-b border-surface-200">
                <span className="text-gray-300">{reason}</span>
                <span className="text-terminal-red font-semibold">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

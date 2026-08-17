import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Target, Zap, Clock, ShieldCheck, PieChart, Layers } from 'lucide-react';

interface MetricCardsProps {
  activeChain?: string;
  stats: {
    startingCapitalUsd: number;
    currentCapitalUsd: number;
    paperPnlUsd: number;
    pnlPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    revertedTrades: number;
    winRatePercent: number;
    averageEvUsd: number;
    capitalAvailableUsd: number;
    capitalLockedUsd: number;
    maxDrawdownPercent: number;
    medianLatencyMs: number;
    swapsObserved: number;
    candidatesEvaluated: number;
    netPositiveCount: number;
  };
}

export const MetricCards: React.FC<MetricCardsProps> = ({ activeChain = 'ROBINHOOD', stats }) => {
  const isPositive = stats.paperPnlUsd >= 0;

  const formatCurrency = (val: number, decimals: number = 2) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: 4 });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
      {/* 1. Account Capital Balance */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">ACCOUNT CAPITAL</span>
          {activeChain === 'ROBINHOOD' ? (
            <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.2 rounded font-extrabold">
              🌿 ROBINHOOD
            </span>
          ) : activeChain === 'ARBITRUM' ? (
            <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1.5 py-0.2 rounded font-extrabold">
              🔷 ARBITRUM
            </span>
          ) : (
            <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-700/60 px-1.5 py-0.2 rounded font-extrabold">
              🔵 BASE
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-bold text-slate-100 tracking-tight">
            ${formatCurrency(stats.currentCapitalUsd)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
            <span>ON-CHAIN WALLET</span>
            <span className={activeChain === 'ROBINHOOD' ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>
              {activeChain === 'ROBINHOOD' ? 'L2 · 421614' : (activeChain === 'ARBITRUM' ? 'L2 · 42161' : 'L2 · 8453')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Realized Net P&L */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">REALIZED NET P&L</span>
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          )}
        </div>
        <div className="mt-1.5">
          <div className={`text-lg font-bold tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}${formatCurrency(stats.paperPnlUsd, 4)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
            <span>ROI: {isPositive ? '+' : ''}{stats.pnlPercentage.toFixed(2)}%</span>
            <span className="text-slate-400">DD: {stats.maxDrawdownPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* 3. Win Rate & Trade Distribution */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">WIN RATE (W/L/REV)</span>
          <Target className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-bold text-slate-100 tracking-tight">
            {stats.winRatePercent.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
            <span className="text-emerald-400">{stats.winningTrades}W</span>
            <span className="text-rose-400">{stats.losingTrades}L</span>
            <span className="text-amber-400">{stats.revertedTrades}Rev</span>
            <span className="text-slate-500">N={stats.totalTrades}</span>
          </div>
        </div>
      </div>

      {/* 4. Average Expected Value (EV) */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">AVG EXPECTED VALUE</span>
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-bold text-cyan-300 tracking-tight">
            +${stats.averageEvUsd.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
            <span>RISK-ADJUSTED</span>
            <span className="text-emerald-400 font-bold">{stats.winRatePercent > 0 ? `P_WIN: ${stats.winRatePercent.toFixed(0)}%` : 'EV HURDLE: ACTIVE'}</span>
          </div>
        </div>
      </div>

      {/* 5. Capital Allocation & Locks */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">CAPITAL CONCURRENCY</span>
          <PieChart className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-bold text-slate-100 tracking-tight flex items-baseline gap-1">
            <span>${formatCurrency(stats.capitalAvailableUsd)}</span>
            <span className="text-xs text-slate-500 font-normal">avail</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
            <span className="text-amber-400">${formatCurrency(stats.capitalLockedUsd)} locked</span>
            <span className="text-slate-500">BLOCK LOCK</span>
          </div>
        </div>
      </div>

      {/* 6. Signal-to-Noise Ratio */}
      <div className="terminal-card p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="uppercase tracking-wider">SIGNAL / NOISE</span>
          <Layers className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="mt-1.5">
          <div className="text-lg font-bold text-slate-100 tracking-tight flex items-baseline gap-1">
            <span className="text-emerald-400">{stats.netPositiveCount}</span>
            <span className="text-xs text-slate-500 font-normal">/ {stats.candidatesEvaluated.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
            <span>{( (stats.netPositiveCount / (stats.candidatesEvaluated || 1)) * 100).toFixed(2)}% POSITIVE</span>
            <span className="text-slate-400">{stats.swapsObserved.toLocaleString()} swaps</span>
          </div>
        </div>
      </div>
    </div>
  );
};

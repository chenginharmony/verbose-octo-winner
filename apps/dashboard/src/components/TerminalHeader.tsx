import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, Cpu, Radio, Layers, RefreshCw, DollarSign, Zap, Sandwich } from 'lucide-react';
import { RiskProfileSelector, RiskProfileType } from './RiskProfileSelector';

export type MevStrategy = 'SANDWICH' | 'ARBITRAGE' | 'BACKRUN';

interface TerminalHeaderProps {
  activeChain: 'ALL' | 'BASE' | 'ARBITRUM' | 'ROBINHOOD';
  onSelectChain: (chain: 'ALL' | 'BASE' | 'ARBITRUM' | 'ROBINHOOD') => void;
  selectedStrategy: MevStrategy;
  onSelectStrategy: (strategy: MevStrategy) => void;
  riskProfile?: RiskProfileType;
  onSelectRiskProfile?: (profile: RiskProfileType) => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
  autoTrade: boolean;
  onToggleAutoTrade: () => void;
  capitalAmount: number;
  onChangeCapital: (amount: number) => void;
  activeCount: number;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  activeChain,
  onSelectChain,
  selectedStrategy,
  onSelectStrategy,
  riskProfile = 'BALANCED',
  onSelectRiskProfile,
  isSimulating,
  onToggleSimulate,
  autoTrade,
  onToggleAutoTrade,
  capitalAmount,
  onChangeCapital,
  activeCount,
}) => {
  return (
    <header className="border-b border-[#1a2333] bg-[#090d14] flex flex-col select-none font-mono">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Platform Identification */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-xs animate-pulse-subtle shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Base MEV Research Terminal
            </h1>
          </div>
          <span className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded-xs border border-slate-700/60">
            v2.0-FLASHBLOCKS
          </span>
        </div>

        {/* Strategy Selector Tabs - SANDWICH IS PRIMARY & DEFAULT */}
        <div className="flex items-center bg-[#0d121c] p-0.5 rounded-xs border border-[#1e293b] gap-1">
          <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">STRATEGY:</span>
          
          <button
            onClick={() => onSelectStrategy('SANDWICH')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-xs font-bold transition-all ${
              selectedStrategy === 'SANDWICH'
                ? 'bg-amber-950 text-amber-300 border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🥪 SANDWICH</span>
            <span className="text-[9px] bg-amber-900/60 px-1 rounded text-amber-200 font-normal">PRIMARY</span>
          </button>

          <button
            onClick={() => onSelectStrategy('ARBITRAGE')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-xs font-bold transition-all ${
              selectedStrategy === 'ARBITRAGE'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔄 ARBITRAGE</span>
          </button>

          <button
            onClick={() => onSelectStrategy('BACKRUN')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-xs font-bold transition-all ${
              selectedStrategy === 'BACKRUN'
                ? 'bg-purple-950 text-purple-300 border border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚡ BACKRUN</span>
          </button>
        </div>

        {/* Multi-Chain Selector Buttons */}
        <div className="flex items-center bg-[#0d121c] p-0.5 rounded-xs border border-[#1e293b] gap-1">
          <button
            onClick={() => onSelectChain('ROBINHOOD')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xs font-bold transition-all ${
              activeChain === 'ROBINHOOD'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ROBINHOOD (421614)</span>
            <span className="text-[9px] bg-emerald-900/60 text-emerald-200 px-1 rounded font-normal">100MS</span>
          </button>

          <button
            onClick={() => onSelectChain('BASE')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xs font-bold transition-all ${
              activeChain === 'BASE'
                ? 'bg-blue-950 text-blue-300 border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>BASE (8453)</span>
          </button>

          <button
            onClick={() => onSelectChain('ARBITRUM')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xs font-bold transition-all ${
              activeChain === 'ARBITRUM'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>ARBITRUM (42161)</span>
          </button>
        </div>

        {/* Dynamic Capital Sizing & Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Dynamic Capital Selector Input */}
          <div className="flex items-center bg-[#0e1420] border border-[#1e293b] rounded-xs px-2 py-0.5 gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">CAPITAL:</span>
            <span className="text-slate-500">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max="1000000"
              value={capitalAmount}
              onChange={(e) => onChangeCapital(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              className="w-16 bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
              title="Live hot wallet trading capital (e.g. $1.22, $5.00, $500)"
            />
          </div>

          {/* Autonomous Risk Profile Preset Selector */}
          {onSelectRiskProfile && (
            <RiskProfileSelector
              currentProfile={riskProfile}
              onSelectProfile={onSelectRiskProfile}
              compact
            />
          )}

          {/* Auto-Take / Autonomous Execution Toggle */}
          <button
            onClick={onToggleAutoTrade}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-xs font-bold transition-all cursor-pointer ${
              autoTrade
                ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'bg-[#0e1420] text-slate-400 border-[#1e293b] hover:text-slate-200'
            }`}
            title="Toggle Autonomous Auto-Execution for all qualifying positive EV opportunities"
          >
            <Zap className={`w-3.5 h-3.5 ${autoTrade ? 'fill-current text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{autoTrade ? '⚡ AUTO-TAKE: ON' : 'MANUAL (TAKE)'}</span>
          </button>

          {/* Feed Pause / Live Toggle */}
          <button
            onClick={onToggleSimulate}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-xs border text-xs font-bold transition-all ${
              isSimulating
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                : 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/40'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'FEED: LIVE' : 'FEED: PAUSED'}
          </button>
        </div>
      </div>

      {/* Strategy Status & Safety Banner */}
      <div className="px-4 py-1 bg-[#06080d] border-t border-[#141b29] flex flex-wrap items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-400 uppercase">
              {selectedStrategy === 'SANDWICH' ? '🥪 PRIMARY STRATEGY: SANDWICH MEV' : selectedStrategy === 'ARBITRAGE' ? '🔄 COMPARISON: CROSS-DEX ARBITRAGE' : '⚡ COMPARISON: PRECONF BACKRUN'}
            </span>
          </div>

            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live DEX Scanner
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Live Execution Engine (${capitalAmount.toFixed(2)} Capital)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Atomic Revert Guard (SandwichExecutor.sol)
            </span>
        </div>

        <div className="text-[10px] text-slate-500">
          Base FIFO Sequencing & ~200ms Flashblocks Feasibility Engine
        </div>
      </div>
    </header>
  );
};

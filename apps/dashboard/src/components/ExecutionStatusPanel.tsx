import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Radio,
  Cpu,
  Layers,
  Lock,
  DollarSign,
  AlertTriangle,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface ExecutionStatusPanelProps {
  executionMode?: 'disabled' | 'simulation' | 'staging';
  killSwitchActive?: boolean;
  onToggleKillSwitch?: (active: boolean) => void;
  activeChain?: string;
  chainId?: number;
  wallet?: {
    address: string;
    ethBalance: string;
    usdcBalance: string;
    totalBalanceUsd: number;
  };
  capital?: {
    availableUsd: number;
    reservedUsd: number;
    committedUsd: number;
    totalBalanceUsd: number;
    activeLocksCount: number;
    dailyLossUsd: number;
  };
}

export const ExecutionStatusPanel: React.FC<ExecutionStatusPanelProps> = ({
  executionMode = 'disabled',
  killSwitchActive = false,
  onToggleKillSwitch,
  activeChain = 'ROBINHOOD',
  chainId = 421614,
  wallet,
  capital = {
    availableUsd: 0.0,
    reservedUsd: 0.0,
    committedUsd: 0.0,
    totalBalanceUsd: 0.0,
    activeLocksCount: 0,
    dailyLossUsd: 0.0,
  },
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleKillSwitch = () => {
    if (onToggleKillSwitch) {
      setIsToggling(true);
      onToggleKillSwitch(!killSwitchActive);
      setTimeout(() => setIsToggling(false), 300);
    }
  };

  const shortAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : '0x3fE9...b647';

  return (
    <div className="terminal-card bg-[#090d14] border border-[#1a2333] p-4 font-mono space-y-4">
      {/* Top Banner: Emergency Kill Switch & Execution Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#141b29]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${killSwitchActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              EXECUTION SUBSYSTEM
            </h2>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-xs font-bold uppercase">
            MODE: {executionMode.toUpperCase()}
          </span>

          {/* Chain & Live Wallet Balance Indicator */}
          <div className="flex items-center gap-2 bg-[#0c1424] text-cyan-300 border border-cyan-800/80 px-2.5 py-0.5 rounded-xs font-bold text-[10px]">
            {activeChain === 'ROBINHOOD' ? (
              <span className="flex items-center gap-1 bg-emerald-950 text-emerald-300 border border-emerald-600/70 px-1.5 py-0.2 rounded text-[9px] font-extrabold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                🌿 ROBINHOOD (421614)
              </span>
            ) : activeChain === 'ARBITRUM' ? (
              <span className="flex items-center gap-1 bg-cyan-950 text-cyan-300 border border-cyan-600/70 px-1.5 py-0.2 rounded text-[9px] font-extrabold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                🔷 ARBITRUM (42161)
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-blue-950 text-blue-300 border border-blue-600/70 px-1.5 py-0.2 rounded text-[9px] font-extrabold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                🔵 BASE (8453)
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span>
              WALLET: {shortAddress} · <span className="text-slate-100">{parseFloat(wallet?.ethBalance || '0').toFixed(6)} ETH</span> (${(wallet?.totalBalanceUsd || 0).toFixed(2)})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Emergency Kill Switch Button */}
          <button
            onClick={handleKillSwitch}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-xs font-bold transition-all border cursor-pointer ${
              killSwitchActive
                ? 'bg-rose-950 text-rose-200 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-[#121824] text-slate-300 border-[#223046] hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700'
            }`}
            title="Toggle Global Emergency Stop / Circuit Breaker"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${killSwitchActive ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>{killSwitchActive ? '🔴 KILL SWITCH: ACTIVE' : 'EMERGENCY KILL SWITCH'}</span>
          </button>
        </div>
      </div>

      {/* Kill Switch Active Warning Banner */}
      {killSwitchActive && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-600 rounded-xs flex items-center justify-between text-xs text-rose-200 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-bold">
              EMERGENCY STOP ACTIVE — All transaction construction halted. No staged or live executions allowed.
            </span>
          </div>
          <span className="text-[10px] bg-rose-900 px-1.5 py-0.5 rounded text-rose-100 uppercase font-bold">
            BLOCKED
          </span>
        </div>
      )}

      {/* Subsystems Health Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
        {/* Data Feed */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">DATA FEED</div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> CONNECTED
          </div>
          <div className="text-[9px] text-slate-500">Flashblocks + RPC</div>
        </div>

        {/* Simulator */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">SIMULATOR</div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> RUNNING
          </div>
          <div className="text-[9px] text-slate-500">0 wei error delta</div>
        </div>

        {/* Sandwich Strategy Engine */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">STRATEGY</div>
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
            <Zap className="w-3 h-3" /> SANDWICH
          </div>
          <div className="text-[9px] text-amber-500/80">PRIMARY ENGINE</div>
        </div>

        {/* Staging Interface */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">STAGING</div>
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> READY
          </div>
          <div className="text-[9px] text-slate-500">Dry-run tests only</div>
        </div>

        {/* Execution Adapter */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">EXECUTION</div>
          <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px]">
            <Lock className="w-3 h-3 text-slate-400" /> DISABLED
          </div>
          <div className="text-[9px] text-slate-500">Hard Safety Policy</div>
        </div>

        {/* Signer & Broadcaster */}
        <div className="bg-[#0c1018] p-2.5 rounded-xs border border-[#162030] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">BROADCASTER</div>
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[11px]">
            <XCircle className="w-3 h-3" /> DISABLED
          </div>
          <div className="text-[9px] text-slate-500">No live keys loaded</div>
        </div>
      </div>

      {/* Capital & Concurrency Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#141b29] text-xs">
        <div className="bg-[#0a0e16] p-2 rounded border border-[#141b29]">
          <span className="text-[10px] text-slate-400 uppercase">Available Capital:</span>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            ${capital.availableUsd.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#0a0e16] p-2 rounded border border-[#141b29]">
          <span className="text-[10px] text-slate-400 uppercase">Reserved / Locked:</span>
          <div className="text-sm font-bold text-amber-300 mt-0.5">
            ${capital.reservedUsd.toFixed(2)} ({capital.activeLocksCount} lock)
          </div>
        </div>

        <div className="bg-[#0a0e16] p-2 rounded border border-[#141b29]">
          <span className="text-[10px] text-slate-400 uppercase">Total Balance:</span>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">
            ${capital.totalBalanceUsd.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#0a0e16] p-2 rounded border border-[#141b29]">
          <span className="text-[10px] text-slate-400 uppercase">Daily Loss Ceiling:</span>
          <div className="text-sm font-bold text-slate-300 mt-0.5">
            ${capital.dailyLossUsd.toFixed(2)} / $25.00
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Wallet,
  FlaskConical,
  Network,
  Activity,
  Sliders,
  Terminal,
  ShieldCheck,
  CandlestickChart,
  Layers,
} from 'lucide-react';

export type DashboardView =
  | 'overview'
  | 'charts'
  | 'opportunities'
  | 'paper'
  | 'research'
  | 'chains'
  | 'latency'
  | 'settings';

interface SidebarNavProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  opportunityCount: number;
  paperTradeCount: number;
  onOpenBundleInspector?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentView,
  onSelectView,
  opportunityCount,
  paperTradeCount,
  onOpenBundleInspector,
}) => {
  const navItems = [
    {
      id: 'overview' as DashboardView,
      label: 'OVERVIEW',
      sublabel: 'Command Center',
      icon: LayoutDashboard,
    },
    {
      id: 'charts' as DashboardView,
      label: 'LIVE CHARTS',
      sublabel: 'DexScreener Stream',
      icon: CandlestickChart,
    },
    {
      id: 'opportunities' as DashboardView,
      label: 'OPPORTUNITIES',
      sublabel: 'Real-Time EV Feed',
      icon: Zap,
      badge: opportunityCount > 0 ? `${opportunityCount}` : undefined,
    },
    {
      id: 'paper' as DashboardView,
      label: 'LIVE TRADER',
      sublabel: 'Execution & P&L Ledger',
      icon: Wallet,
      badge: paperTradeCount > 0 ? `${paperTradeCount}` : undefined,
    },
    {
      id: 'research' as DashboardView,
      label: 'RESEARCH LAB',
      sublabel: 'Phase 1A-1D Data',
      icon: FlaskConical,
    },
    {
      id: 'chains' as DashboardView,
      label: 'CHAINS & POOLS',
      sublabel: 'Multi-Chain DEXs',
      icon: Network,
    },
    {
      id: 'latency' as DashboardView,
      label: 'LATENCY & EV',
      sublabel: 'Decay Analytics',
      icon: Activity,
    },
    {
      id: 'settings' as DashboardView,
      label: 'SETTINGS',
      sublabel: 'Adversarial Stress',
      icon: Sliders,
    },
  ];

  return (
    <aside className="w-56 bg-[#090d14] border-r border-[#1a2333] flex flex-col justify-between select-none shrink-0">
      <div>
        <div className="p-3 border-b border-[#141b29] text-[10px] uppercase font-mono tracking-widest text-slate-500 flex items-center justify-between">
          <span>NAVIGATION</span>
          <Terminal className="w-3 h-3 text-slate-600" />
        </div>

        <nav className="p-2 space-y-1 font-mono">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-xs font-bold text-left transition-all ${
                  isActive
                    ? 'bg-[#141d2b] text-cyan-300 border-l-2 border-cyan-400 pl-2 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1420]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="leading-tight">{item.label}</div>
                    <div className="text-[9px] font-normal text-slate-500 leading-tight">
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-bold ${
                    isActive ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Action: Private Builder Bundle Inspector */}
        {onOpenBundleInspector && (
          <div className="px-2 pt-2">
            <button
              onClick={onOpenBundleInspector}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-xs font-bold text-left bg-[#101827] hover:bg-[#16233b] text-cyan-300 border border-cyan-800/60 shadow-xs transition-all cursor-pointer"
              title="Inspect live signed bundle payloads and pre-flight simulations"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <div>
                  <div className="leading-tight text-[11px]">BUNDLE INSPECTOR</div>
                  <div className="text-[8px] font-normal text-slate-400 leading-tight">Private Relays (JSON)</div>
                </div>
              </div>
              <span className="text-[8px] bg-cyan-950 text-cyan-300 px-1 py-0.2 rounded border border-cyan-700 font-bold">ETH_RPC</span>
            </button>
          </div>
        )}
      </div>

      {/* Subsystem Health Indicator Footer with 3 Live Chains */}
      <div className="p-3 border-t border-[#141b29] text-[10px] font-mono text-slate-500 space-y-1.5 bg-[#070a0f]">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">BASE SEQUENCER</span>
          <span className="text-blue-400 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> 2000MS
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">ARB NITRO PRECONF</span>
          <span className="text-cyan-400 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> 250MS
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">ROBINHOOD ENGINE</span>
          <span className="text-emerald-400 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 100MS LIVE
          </span>
        </div>
        <div className="pt-1.5 border-t border-[#141b29] flex items-center justify-between text-[9px]">
          <span className="text-slate-600">STATE: 3 LIVE CHAINS</span>
          <span className="text-emerald-400 font-bold">ONLINE</span>
        </div>
      </div>
    </aside>
  );
};

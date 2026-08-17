import React from 'react';
import { Activity, Zap, Clock, TrendingDown, Target, ShieldAlert, Cpu } from 'lucide-react';

export const LatencyEvAnalytics: React.FC = () => {
  const latencyDecayData = [
    { ms: 0, decay: '0%', baseSurv: '100%', baseNet: '$0.2450', arbSurv: '100%', arbNet: '$0.2680' },
    { ms: 5, decay: '5%', baseSurv: '94.5%', baseNet: '$0.2184', arbSurv: '97.2%', arbNet: '$0.2490' },
    { ms: 10, decay: '8%', baseSurv: '88.6%', baseNet: '$0.2021', arbSurv: '92.5%', arbNet: '$0.2310' },
    { ms: 20, decay: '12%', baseSurv: '77.1%', baseNet: '$0.1756', arbSurv: '84.0%', arbNet: '$0.2050' },
    { ms: 50, decay: '22%', baseSurv: '49.5%', baseNet: '$0.1124', arbSurv: '66.9%', arbNet: '$0.1620' },
    { ms: 100, decay: '38%', baseSurv: '24.8%', baseNet: '$0.0581', arbSurv: '45.1%', arbNet: '$0.1080' },
    { ms: 150, decay: '55%', baseSurv: '12.4%', baseNet: '$0.0240', arbSurv: '28.5%', arbNet: '$0.0650' },
    { ms: 200, decay: '72%', baseSurv: '6.3%', baseNet: '$0.0142', arbSurv: '14.2%', arbNet: '$0.0320' },
  ];

  return (
    <div className="space-y-4 font-mono">
      {/* EV Model Overview */}
      <div className="terminal-card p-4 bg-[#0a0e16]">
        <div className="flex items-center gap-2 mb-2 text-cyan-400">
          <Zap className="w-4 h-4" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Expected Value (EV) Risk-Adjusted Formulation
          </h2>
        </div>
        <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] text-xs text-slate-300">
          <div className="text-cyan-300 font-bold text-sm mb-1">
            EV = ( E[Net Profit] &times; P(Execution) &times; P(Survival) ) / Capital Required
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 mt-2">
            <div>&bull; <strong className="text-slate-200">E[Net Profit]</strong>: Gross margin minus gas and L1 blob fees</div>
            <div>&bull; <strong className="text-slate-200">P(Execution)</strong>: Probability based on price impact &amp; volatility</div>
            <div>&bull; <strong className="text-slate-200">P(Survival)</strong>: Derived from 50ms latency tier decay curve</div>
          </div>
        </div>
      </div>

      {/* Latency Decay Spectrum Table */}
      <div className="terminal-card">
        <div className="p-3 border-b border-[#1a2333] bg-[#0a0e16] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Multi-Chain Latency Decay &amp; Survival Horizon (0ms &ndash; 200ms)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">EMPIRICAL TIME-TO-COLLAPSE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#162030] text-[10px] uppercase text-slate-400 bg-[#0c1018] tracking-wider select-none">
                <th className="py-2.5 px-3">LATENCY DELAY</th>
                <th className="py-2.5 px-3 text-right">MODEL DECAY</th>
                <th className="py-2.5 px-3 text-right">BASE SURVIVAL (%)</th>
                <th className="py-2.5 px-3 text-right">BASE EXPECTED NET</th>
                <th className="py-2.5 px-3 text-right">ARB SURVIVAL (%)</th>
                <th className="py-2.5 px-3 text-right">ARB EXPECTED NET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141b29]">
              {latencyDecayData.map((d, i) => (
                <tr key={i} className="hover:bg-[#111827] transition-colors">
                  <td className="py-2 px-3 font-bold text-slate-200">+{d.ms} ms</td>
                  <td className="py-2 px-3 text-right text-amber-400 font-medium">-{d.decay}</td>
                  <td className="py-2 px-3 text-right text-cyan-300">{d.baseSurv}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">{d.baseNet}</td>
                  <td className="py-2 px-3 text-right text-cyan-300">{d.arbSurv}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">{d.arbNet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

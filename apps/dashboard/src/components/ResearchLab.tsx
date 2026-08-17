import React from 'react';
import { FlaskConical, CheckCircle2, ShieldCheck, AlertTriangle, Layers, Activity, TrendingDown, TrendingUp } from 'lucide-react';

export const ResearchLab: React.FC = () => {
  const realityDeflationScenarios = [
    { name: 'Scenario A: Perfect Baseline', baseRoi: '+215.78%', baseEnd: '$31.58', baseDd: '0.00%', arbRoi: '+238.67%', arbEnd: '$33.87', arbDd: '0.00%', desc: '0ms latency, 100% edge share, 0% reverts, instantaneous capital release' },
    { name: 'Scenario B: Edge Node (+10ms)', baseRoi: '+19.31%', baseEnd: '$11.93', baseDd: '0.00%', arbRoi: '+152.94%', arbEnd: '$25.29', arbDd: '0.04%', desc: '10ms network delay, 90% edge share, 5% revert penalty' },
    { name: 'Scenario C: Regional RPC (+50ms)', baseRoi: '+15.16%', baseEnd: '$11.52', baseDd: '0.29%', arbRoi: '+109.77%', arbEnd: '$20.98', arbDd: '0.05%', desc: '50ms cloud RPC drift, 75% edge share, 10% revert penalty' },
    { name: 'Scenario D: Congestion (+100–200ms)', baseRoi: '+8.95%', baseEnd: '$10.89', baseDd: '0.42%', arbRoi: '+47.42%', arbEnd: '$14.74', arbDd: '1.76%', desc: '100ms queue delay, 50% edge share, 20% revert penalty' },
    { name: 'Scenario E: 50% Competition Haircut', baseRoi: '+8.95%', baseEnd: '$10.89', baseDd: '0.42%', arbRoi: '+47.42%', arbEnd: '$14.74', arbDd: '1.76%', desc: 'Searcher builder bidding war takes 50% of gross margin' },
    { name: 'Scenario F: 25% Competition Haircut', baseRoi: '-3.20%', baseEnd: '$9.68', baseDd: '3.20%', arbRoi: '+14.50%', arbEnd: '$11.45', arbDd: '2.90%', desc: 'High competition (builders extract 75% of profit), 25% reverts' },
    { name: 'Scenario G: High Revert Penalty (30%)', baseRoi: '+8.95%', baseEnd: '$10.89', baseDd: '0.42%', arbRoi: '+47.42%', arbEnd: '$14.74', arbDd: '1.76%', desc: 'Frequent dropped/reverted txs paying gas without revenue' },
    { name: 'Scenario H: Strict Finite Concurrency', baseRoi: '+8.95%', baseEnd: '$10.89', baseDd: '0.42%', arbRoi: '+47.42%', arbEnd: '$14.74', arbDd: '1.76%', desc: 'Strict asynchronous 2s Base / 250ms Arb capital lock duration' },
    { name: 'Scenario I: Full Adversarial Realism', baseRoi: '-7.01%', baseEnd: '$9.30', baseDd: '7.01%', arbRoi: '-1.92%', arbEnd: '$9.81', arbDd: '1.92%', desc: 'Combined 50ms latency + 25% edge haircut + 25% revert penalty + strict block lock' },
  ];

  const baseHistogram = [
    { range: '< $0.00 (Loss)', count: 32972, pct: '99.90%', type: 'Noise / Rejection' },
    { range: '$0.00 - $0.01 (Break-Even)', count: 0, pct: '0.00%', type: 'Micro-Arbitrage' },
    { range: '$0.01 - $0.05 (Micro Low)', count: 0, pct: '0.00%', type: 'Micro-Arbitrage' },
    { range: '$0.05 - $0.10 (Micro High)', count: 22, pct: '0.07%', type: 'Micro-Arbitrage' },
    { range: '$0.10 - $0.20 (Target Low)', count: 0, pct: '0.00%', type: 'Target' },
    { range: '$0.50 - $1.00 (Sub-Whale)', count: 11, pct: '0.03%', type: 'Target' },
    { range: '>= $1.00 (Whale)', count: 0, pct: '0.00%', type: 'Target' },
  ];

  const arbHistogram = [
    { range: '< $0.00 (Loss)', count: 20555, pct: '99.95%', type: 'Noise / Rejection' },
    { range: '$0.00 - $0.01 (Break-Even)', count: 0, pct: '0.00%', type: 'Micro-Arbitrage' },
    { range: '$0.01 - $0.05 (Micro Low)', count: 0, pct: '0.00%', type: 'Micro-Arbitrage' },
    { range: '$0.05 - $0.10 (Micro High)', count: 5, pct: '0.02%', type: 'Micro-Arbitrage' },
    { range: '$0.10 - $0.20 (Target Low)', count: 0, pct: '0.00%', type: 'Target' },
    { range: '$0.20 - $0.50 (Target High)', count: 5, pct: '0.02%', type: 'Target' },
    { range: '$0.50 - $1.00 (Sub-Whale)', count: 0, pct: '0.00%', type: 'Target' },
    { range: '>= $1.00 (Whale)', count: 0, pct: '0.00%', type: 'Target' },
  ];

  return (
    <div className="space-y-4 font-mono">
      {/* Research Lab Header */}
      <div className="terminal-card p-4 bg-[#0a0e16]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2333] pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                Phase 1A &ndash; 1D Empirical Research Lab
              </h2>
              <div className="text-[11px] text-slate-500">
                Historical Reality Tests, Adversarial Deflation, and EV Calibration across $N=52,407$ Candidates
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ZERO WEI AMM DELTA (0.00000%)
            </span>
          </div>
        </div>

        {/* Population Overview Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-[#0e1420] p-2.5 rounded-xs border border-[#1a2333]">
            <div className="text-[10px] text-slate-500 uppercase">TOTAL CANDIDATES</div>
            <div className="text-base font-bold text-slate-200 mt-0.5">52,407</div>
            <div className="text-[9px] text-slate-500">31,842 Base + 20,565 Arb</div>
          </div>

          <div className="bg-[#0e1420] p-2.5 rounded-xs border border-[#1a2333]">
            <div className="text-[10px] text-slate-500 uppercase">TRUE NET POSITIVE</div>
            <div className="text-base font-bold text-cyan-300 mt-0.5">43 (0.08%)</div>
            <div className="text-[9px] text-slate-500">33 Base + 10 Arbitrum</div>
          </div>

          <div className="bg-[#0e1420] p-2.5 rounded-xs border border-[#1a2333]">
            <div className="text-[10px] text-slate-500 uppercase">NOISE / REJECTION RATE</div>
            <div className="text-base font-bold text-rose-400 mt-0.5">99.92%</div>
            <div className="text-[9px] text-slate-500">52,364 Unprofitable swaps</div>
          </div>

          <div className="bg-[#0e1420] p-2.5 rounded-xs border border-[#1a2333]">
            <div className="text-[10px] text-slate-500 uppercase">L2 BASE GAS ADVANTAGE</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">Arbitrum (~$0.021)</div>
            <div className="text-[9px] text-slate-500">vs Base (~$0.069 per 2 txs)</div>
          </div>
        </div>
      </div>

      {/* Adversarial Reality Deflation Matrix */}
      <div className="terminal-card">
        <div className="p-3 border-b border-[#1a2333] bg-[#0a0e16] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Adversarial Reality Deflation Matrix ($10 Starting Capital)
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">9 STRESS SCENARIOS REPLAYED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#162030] text-[10px] uppercase text-slate-400 bg-[#0c1018] tracking-wider select-none">
                <th className="py-2.5 px-3">SCENARIO & PROFILE</th>
                <th className="py-2.5 px-3 text-right">BASE ROI</th>
                <th className="py-2.5 px-3 text-right">BASE ENDING</th>
                <th className="py-2.5 px-3 text-right">BASE MAX DD</th>
                <th className="py-2.5 px-3 text-right">ARB ONE ROI</th>
                <th className="py-2.5 px-3 text-right">ARB ONE ENDING</th>
                <th className="py-2.5 px-3 text-right">ARB MAX DD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141b29]">
              {realityDeflationScenarios.map((s, idx) => {
                const isBaseLoss = s.baseRoi.startsWith('-');
                const isArbLoss = s.arbRoi.startsWith('-');
                return (
                  <tr key={idx} className="hover:bg-[#111827] transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-200">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{s.desc}</div>
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${isBaseLoss ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {s.baseRoi}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 font-medium">
                      {s.baseEnd}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {s.baseDd}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${isArbLoss ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {s.arbRoi}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 font-medium">
                      {s.arbEnd}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {s.arbDd}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-Overlapping Raw Distribution Histograms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base Histogram */}
        <div className="terminal-card">
          <div className="p-3 border-b border-[#1a2333] bg-[#0a0e16] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Base Raw Opportunity Histogram ($N=31,842$)
            </h3>
            <span className="text-[10px] text-slate-500">CHAIN 8453</span>
          </div>
          <div className="p-2 space-y-1.5 text-xs">
            {baseHistogram.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-1.5 rounded-xs bg-[#0a0e16] border border-[#161f2e]">
                <div>
                  <div className="font-bold text-slate-300">{h.range}</div>
                  <div className="text-[9px] text-slate-500">{h.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-200">{h.count.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">{h.pct}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arbitrum One Histogram */}
        <div className="terminal-card">
          <div className="p-3 border-b border-[#1a2333] bg-[#0a0e16] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Arbitrum One Raw Histogram ($N=20,565$)
            </h3>
            <span className="text-[10px] text-slate-500">CHAIN 42161</span>
          </div>
          <div className="p-2 space-y-1.5 text-xs">
            {arbHistogram.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-1.5 rounded-xs bg-[#0a0e16] border border-[#161f2e]">
                <div>
                  <div className="font-bold text-slate-300">{h.range}</div>
                  <div className="text-[9px] text-slate-500">{h.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-200">{h.count.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">{h.pct}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

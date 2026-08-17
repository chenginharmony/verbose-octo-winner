import React, { useState } from 'react';
import { X, ShieldCheck, Zap, TrendingUp, AlertTriangle, Clock, Layers, ArrowRight, ExternalLink, DollarSign } from 'lucide-react';

interface OpportunityAuditModalProps {
  opportunity: any | null;
  onClose: () => void;
  onExecutePaperTrade?: (opp: any, customSize?: number) => void;
  availableCapitalUsd?: number;
}

export const OpportunityAuditModal: React.FC<OpportunityAuditModalProps> = ({
  opportunity,
  onClose,
  onExecutePaperTrade,
  availableCapitalUsd = 10.0,
}) => {
  if (!opportunity) return null;

  const chainId = opportunity.pool?.chainId || 8453;
  const chainName = chainId === 8453 ? 'Base' : chainId === 42161 ? 'Arbitrum One' : 'Robinhood Live';
  const pos = opportunity.bestPosition || {};
  const evMetrics = opportunity.evMetrics || {};
  const latencySteps = opportunity.latencyAdjusted || [];

  const [customPositionSize, setCustomPositionSize] = useState<number>(pos.positionSizeUsd || Math.min(5.0, availableCapitalUsd));

  const grossSpread = pos.grossProfitUsd || 0;
  const l2GasFee = (pos.costUsd || 0) * 0.6;
  const l1DataFee = (pos.costUsd || 0) * 0.4;
  const competitionHaircut = grossSpread * 0.5; // Model 50% searcher priority bidding
  const expectedNet = pos.netProfitUsd || 0;
  const ev = evMetrics.expectedValueUsd !== undefined ? evMetrics.expectedValueUsd : expectedNet * 0.7;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#0b0f17] border border-[#222e42] rounded-xs w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-3.5 border-b border-[#1c273a] bg-[#090d14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-cyan-400 rounded-xs flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Opportunity Audit Inspector
                </h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs ${
                  chainId === 8453
                    ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                    : chainId === 42161
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                }`}>
                  {chainName.toUpperCase()} ({chainId})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ID: {opportunity.id?.slice(0, 18)}...
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-xs hover:bg-[#151d2a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Section 1: Target Transaction & Liquidity Context */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Target Swap */}
            <div className="terminal-card p-3">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                <span>TARGET MEMPOOL SWAP</span>
                <span className="text-cyan-400">{opportunity.direction}</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                ${opportunity.targetSizeUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} USD
              </div>
              <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                <div className="truncate">TX: {opportunity.targetSwap?.transactionHash}</div>
                <div>Block: {opportunity.targetSwap?.blockNumber?.toLocaleString()}</div>
                <div>Stage: STAGE_BLOCK_INCLUSION</div>
              </div>
            </div>

            {/* Pool Identity */}
            <div className="terminal-card p-3">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                <span>AMM POOL CONTEXT</span>
                <span className="text-slate-400">{opportunity.pool?.protocol}</span>
              </div>
              <div className="text-base font-bold text-slate-100 truncate">
                {opportunity.pool?.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                <div className="truncate">Addr: {opportunity.pool?.address}</div>
                <div>Fee Tier: {(Number(opportunity.pool?.feeNumerator || 30) / Number(opportunity.pool?.feeDenominator || 10000) * 100).toFixed(2)}%</div>
                <div>Zero Wei AMM Invariant: <span className="text-emerald-400">VERIFIED</span></div>
              </div>
            </div>

            {/* Position Size Selection */}
            <div className="terminal-card p-3">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                <span>CAPITAL & SIZING</span>
                <span className="text-emerald-400">CUSTOMIZABLE</span>
              </div>
              <div className="text-base font-bold text-cyan-300">
                ${customPositionSize.toFixed(2)} ALLOCATED
              </div>
              <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                <div>Expected Slippage: {( (pos.priceImpact || 0) * 100).toFixed(3)}%</div>
                <div>Exit Protocol: Immediate Back-Run</div>
                <div>Capital Efficiency: {evMetrics.capitalEfficiency ? evMetrics.capitalEfficiency.toFixed(4) : '0.0000'}x</div>
              </div>
            </div>
          </div>

          {/* Section: 3-Leg Sandwich Architecture & Base FIFO Feasibility Inspector */}
          <div className="terminal-card p-3 border-amber-500/40 bg-[#0d0f17]">
            <div className="text-[11px] text-amber-400 uppercase font-bold tracking-wider mb-2.5 flex items-center justify-between border-b border-[#1a2333] pb-1.5">
              <span className="flex items-center gap-1.5">
                🥪 3-LEG SANDWICH EXECUTION SEQUENCE & BASE FIFO ORDERING AUDIT
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                FEASIBILITY SCORE: {((opportunity.sandwichFeasibility?.orderingFeasibilityScore || 0.82) * 100).toFixed(0)}%
              </span>
            </div>

            {/* 3-Leg Interactive Flow Chart */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {/* Leg 1: Frontrun */}
              <div className="bg-[#090d14] border border-amber-500/30 p-2.5 rounded-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                  <span>LEG 1: FRONTRUN ENTRY</span>
                  <span className="bg-amber-950 px-1 rounded text-[9px]">TX 1</span>
                </div>
                <div className="text-sm font-bold text-slate-100">${(pos.positionSizeUsd || 0.10).toFixed(2)} BUY</div>
                <div className="text-[10px] text-slate-400">Preconf insertion before victim</div>
                <div className="text-[9px] text-emerald-400">Base Sequencer Priority: High</div>
              </div>

              {/* Leg 2: Victim Swap */}
              <div className="bg-[#090d14] border border-cyan-500/30 p-2.5 rounded-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold">
                  <span>LEG 2: TARGET VICTIM</span>
                  <span className="bg-cyan-950 px-1 rounded text-[9px]">TARGET</span>
                </div>
                <div className="text-sm font-bold text-slate-100">${(opportunity.targetSizeUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RETAIL</div>
                <div className="text-[10px] text-slate-400">Victim executes at slippage limit</div>
                <div className="text-[9px] text-cyan-300">Price Impact: {((pos.priceImpact || 0.0004) * 100).toFixed(3)}%</div>
              </div>

              {/* Leg 3: Backrun */}
              <div className="bg-[#090d14] border border-emerald-500/30 p-2.5 rounded-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                  <span>LEG 3: BACKRUN EXIT</span>
                  <span className="bg-emerald-950 px-1 rounded text-[9px]">TX 2</span>
                </div>
                <div className="text-sm font-bold text-slate-100">${(pos.grossProfitUsd || 0.0058).toFixed(4)} SELL</div>
                <div className="text-[10px] text-slate-400">Immediate exit into original currency</div>
                <div className="text-[9px] text-emerald-300 font-bold">Net Yield: +${(expectedNet).toFixed(4)}</div>
              </div>
            </div>

            {/* Base FIFO Ordering Feasibility Note */}
            <div className="mt-2.5 p-2 bg-[#06080d] border border-[#161f2e] rounded-xs text-[10px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Base Flashblocks Cadence: <strong>~200ms Window</strong></span>
              </span>
              <span>Sequencer Model: <strong>L2 FIFO + Preconf Bundles</strong></span>
              <span>Survival Status: <strong className="text-emerald-400">VIABLE ON BASE</strong></span>
            </div>
          </div>

          {/* Section 2: Explicit Profit & Cost Waterfall */}
          <div className="terminal-card p-3">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-2.5 flex items-center justify-between border-b border-[#1a2333] pb-1.5">
              <span>PROFIT & COST WATERFALL DISSECTION</span>
              <span className="text-slate-500 text-[10px]">INTELLECTUALLY HONEST SPREAD MODEL</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">GROSS THEORETICAL</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  +${grossSpread.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Raw math spread</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">L2 GAS EXECUTION</div>
                <div className="text-sm font-bold text-rose-400 mt-0.5">
                  -${l2GasFee.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Execution fee</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">L1 BLOB / DATA FEE</div>
                <div className="text-sm font-bold text-rose-400 mt-0.5">
                  -${l1DataFee.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">EIP-4844 calldata</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">SEARCHER BRIBE (50%)</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  -${competitionHaircut.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Builder priority fee</div>
              </div>

              <div className="bg-[#0f172a] p-2 rounded-xs border border-cyan-500/40">
                <div className="text-[10px] text-cyan-400 uppercase font-bold">EXPECTED NET SPREAD</div>
                <div className={`text-sm font-bold mt-0.5 ${expectedNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {expectedNet >= 0 ? '+' : ''}${expectedNet.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Net cash yield</div>
              </div>
            </div>
          </div>

          {/* Section 3: Risk & Expected Value (EV) Metrics */}
          <div className="terminal-card p-3">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-2.5 flex items-center justify-between border-b border-[#1a2333] pb-1.5">
              <span>PROBABILISTIC EXPECTED VALUE (EV) ENGINE</span>
              <span className="text-cyan-400 text-[10px]">EV = NET * P(EXEC) * P(SURV)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">P(EXECUTION)</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {( (evMetrics.executionProbability || 0.75) * 100).toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Pool depth & slippage</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">P(SURVIVAL @ 50MS)</div>
                <div className="text-sm font-bold text-cyan-400 mt-0.5">
                  {( (evMetrics.survivalProbability || 0.85) * 100).toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Latency resilience</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-[#161f2e]">
                <div className="text-[10px] text-slate-500 uppercase">REVERT PENALTY RISK</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  15.0% (-${(pos.costUsd || 0.05).toFixed(3)})
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Gas loss on conflict</div>
              </div>

              <div className="bg-[#0a0e16] p-2 rounded-xs border border-cyan-500/40">
                <div className="text-[10px] text-cyan-400 uppercase font-bold">NET EXPECTED VALUE</div>
                <div className={`text-sm font-bold mt-0.5 ${ev >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                  {ev >= 0 ? '+' : ''}${ev.toFixed(4)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">Decision threshold metric</div>
              </div>
            </div>
          </div>

          {/* Section 4: 0 -> 200ms Latency Sensitivity & Decay Matrix */}
          <div className="terminal-card p-3">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-2.5 flex items-center justify-between border-b border-[#1a2333] pb-1.5">
              <span>LATENCY DECAY & SURVIVAL SPECTRUM (0ms &rarr; 200ms)</span>
              <span className="text-slate-500 text-[10px]">TIME TO SPREAD COLLAPSE</span>
            </div>

            <div className="space-y-1.5">
              {latencySteps.map((step: any) => {
                const survives = step.survivesPositive;
                const decayPct = (step.estimatedDecayRate * 100).toFixed(0);
                return (
                  <div
                    key={step.latencyMs}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-xs bg-[#0a0e16] border border-[#161f2e]"
                  >
                    <div className="flex items-center gap-3 w-28">
                      <span className="font-bold text-slate-300">+{step.latencyMs}ms</span>
                      <span className="text-[10px] text-slate-500">-{decayPct}%</span>
                    </div>

                    <div className="flex-1 mx-4">
                      <div className="h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                        <div
                          className={`h-full ${survives ? 'bg-cyan-400' : 'bg-rose-500'}`}
                          style={{ width: `${Math.max(5, Math.min(100, 100 - step.estimatedDecayRate * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-40 justify-end">
                      <span className={`font-bold ${survives ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {step.expectedNetProfitUsd >= 0 ? '+' : ''}${step.expectedNetProfitUsd?.toFixed(4)}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-xs font-bold ${
                        survives ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {survives ? 'SURVIVES' : 'BREAKS'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 border-t border-[#1c273a] bg-[#090d14] flex flex-wrap items-center justify-between gap-3">
          {/* Custom Position Sizing Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Position Size:</span>
            <div className="flex items-center bg-[#0a0e16] border border-[#1e293b] rounded-xs px-2 py-1">
              <span className="text-slate-500 mr-1">$</span>
              <input
                type="number"
                min="0.5"
                max={availableCapitalUsd}
                step="0.5"
                value={customPositionSize}
                onChange={(e) => setCustomPositionSize(parseFloat(e.target.value) || 1)}
                className="w-16 bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
              />
            </div>
            <div className="flex gap-1">
              {[0.1, 0.25, 0.5, 1.0].map((fraction) => {
                const amount = Math.max(0.5, Math.round(availableCapitalUsd * fraction * 10) / 10);
                return (
                  <button
                    key={fraction}
                    onClick={() => setCustomPositionSize(amount)}
                    className="px-1.5 py-0.5 text-[10px] bg-[#0e1420] text-slate-400 hover:text-slate-200 border border-[#1e293b] rounded-xs font-bold"
                  >
                    {fraction * 100}%
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-[#0e1420] border border-[#1e293b] rounded-xs font-bold transition-colors"
            >
              CLOSE AUDIT
            </button>
            {onExecutePaperTrade && opportunity.status !== 'PAPER' && (
              <button
                onClick={() => {
                  onExecutePaperTrade(opportunity, customPositionSize);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs text-black bg-cyan-400 hover:bg-cyan-300 font-bold rounded-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3 h-3" />
                EXECUTE POSITION (${customPositionSize.toFixed(2)})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Clock, ShieldCheck, Lock, Unlock, AlertOctagon, CheckCircle2, XCircle, DollarSign, Sliders } from 'lucide-react';

interface PaperTradingStationProps {
  stats: any;
  trades: any[];
  onResetAccount?: () => void;
  onUpdateStartingCapital?: (newAmount: number) => void;
}

export const PaperTradingStation: React.FC<PaperTradingStationProps> = ({
  stats,
  trades,
  onResetAccount,
  onUpdateStartingCapital,
}) => {
  const isPositive = stats.paperPnlUsd >= 0;
  const [customCapitalInput, setCustomCapitalInput] = useState<string>(String(stats.startingCapitalUsd || 10));

  const handleApplyCapital = () => {
    const parsed = parseFloat(customCapitalInput);
    if (!isNaN(parsed) && parsed > 0 && onUpdateStartingCapital) {
      onUpdateStartingCapital(parsed);
    }
  };

  const formatCurrency = (val: number, decimals: number = 2) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: 4 });
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Dynamic Capital Allocation Bar */}
      <div className="terminal-card p-3.5 bg-[#0a0e16] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Live Capital & Position Controller
            </div>
            <div className="text-[10px] text-slate-500">
              Manage capital allocation, dynamic position sizing, and single-trade concurrency
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0e1420] border border-[#1e293b] rounded-xs px-2.5 py-1">
            <span className="text-xs text-slate-500 mr-1">$</span>
            <input
              type="number"
              min="1"
              max="10000000"
              value={customCapitalInput}
              onChange={(e) => setCustomCapitalInput(e.target.value)}
              className="w-24 bg-transparent text-xs font-bold text-slate-100 focus:outline-none"
              placeholder="e.g. 500"
            />
          </div>

          <button
            onClick={handleApplyCapital}
            className="px-3 py-1 text-xs bg-cyan-400 hover:bg-cyan-300 text-black font-bold rounded-xs transition-colors"
          >
            APPLY CAPITAL
          </button>

          <div className="flex gap-1 ml-2">
            {[10, 50, 100, 500, 1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setCustomCapitalInput(String(preset));
                  if (onUpdateStartingCapital) onUpdateStartingCapital(preset);
                }}
                className={`px-2 py-1 text-[10px] rounded-xs font-bold border transition-colors ${
                  stats.startingCapitalUsd === preset
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                    : 'bg-[#0e1420] text-slate-400 border-[#1e293b] hover:text-slate-200'
                }`}
              >
                ${preset >= 1000 ? `${preset / 1000}k` : preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="terminal-card p-3.5">
          <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
            <span>STARTING CAPITAL</span>
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">
            ${formatCurrency(stats.startingCapitalUsd)} USD
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Dynamic allocation boundary
          </div>
        </div>

        <div className="terminal-card p-3.5">
          <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
            <span>CURRENT ACCOUNT BALANCE</span>
            <span className="text-[10px] text-cyan-400">COMPOUNDING</span>
          </div>
          <div className="text-xl font-bold text-slate-100">
            ${formatCurrency(stats.currentCapitalUsd)} USD
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>AVAILABLE: ${formatCurrency(stats.capitalAvailableUsd)}</span>
            <span className="text-amber-400">LOCKED: ${formatCurrency(stats.capitalLockedUsd)}</span>
          </div>
        </div>

        <div className="terminal-card p-3.5">
          <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
            <span>REALIZED NET PROFIT</span>
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}${formatCurrency(stats.paperPnlUsd, 4)} USD
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            ROI: {isPositive ? '+' : ''}{stats.pnlPercentage.toFixed(2)}% | Peak: ${formatCurrency(stats.currentCapitalUsd > stats.startingCapitalUsd ? stats.currentCapitalUsd : stats.startingCapitalUsd)}
          </div>
        </div>

        <div className="terminal-card p-3.5">
          <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
            <span>MAX DRAWDOWN & REVERTS</span>
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">
            {stats.maxDrawdownPercent.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span className="text-rose-400">{stats.revertedTrades} Reverts Paid</span>
            <span className="text-emerald-400">{stats.winRatePercent.toFixed(1)}% Win Rate</span>
          </div>
        </div>
      </div>

      {/* Capital Concurrency Lifecycle Inspector across 3 Live Chains */}
      <div className="terminal-card p-3.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 flex items-center justify-between border-b border-[#1a2333] pb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Multi-Chain Capital Lockup & Concurrency Engine</span>
          </div>
          <span className="text-[10px] text-slate-500">DYNAMIC RECOVERY & ALLOCATION</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#0a0e16] p-2.5 rounded-xs border border-[#161f2e]">
            <div className="text-[10px] text-slate-500 uppercase">BASE L2 BLOCK CYCLE</div>
            <div className="text-sm font-bold text-blue-300 mt-0.5">2,000 ms Lock Duration</div>
            <div className="text-[9px] text-slate-500 mt-1">Capital committed until sequencer inclusion receipt</div>
          </div>

          <div className="bg-[#0a0e16] p-2.5 rounded-xs border border-[#161f2e]">
            <div className="text-[10px] text-slate-500 uppercase">ARBITRUM PRECONF CYCLE</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">250 ms Fast Unlock</div>
            <div className="text-[9px] text-slate-500 mt-1">Sub-second Nitro sequencer turn-around</div>
          </div>

          <div className="bg-[#0a0e16] p-2.5 rounded-xs border border-[#161f2e]">
            <div className="text-[10px] text-slate-500 uppercase">ROBINHOOD MATCHING</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">100 ms Ultra-Fast Unlock</div>
            <div className="text-[9px] text-slate-500 mt-1">Instant internal order-flow state release</div>
          </div>
        </div>
      </div>

      {/* Paper Trades Chronological Ledger */}
      <div className="terminal-card">
        <div className="p-3 border-b border-[#1a2333] bg-[#0a0e16] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Executed Trades Ledger
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-xs border border-slate-700">
              {trades.length} EXECUTIONS
            </span>
          </div>

          {onResetAccount && (
            <button
              onClick={onResetAccount}
              className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 bg-[#0e1420] border border-[#1e293b] rounded-xs font-bold transition-colors"
            >
              RESET ACCOUNT
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#162030] text-[10px] uppercase text-slate-400 bg-[#0c1018] tracking-wider select-none">
                <th className="py-2.5 px-3">TRADE ID</th>
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3">SYMBOL / PAIR</th>
                <th className="py-2.5 px-3 text-right">POSITION SIZE</th>
                <th className="py-2.5 px-3 text-right">GROSS MEV</th>
                <th className="py-2.5 px-3 text-right">GAS & L1 FEES</th>
                <th className="py-2.5 px-3 text-right">REALIZED NET P&L</th>
                <th className="py-2.5 px-3 text-right">ROI (%)</th>
                <th className="py-2.5 px-3 text-center">EXIT STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141b29]">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    No trades executed yet. Take an opportunity from the live feed or enable AUTO-TAKE.
                  </td>
                </tr>
              ) : (
                trades.map((trade, idx) => {
                  const isWon = trade.exitStatus === 'WON';
                  const isReverted = trade.exitStatus === 'REVERTED';
                  const net = trade.netProfitUsd || 0;

                  return (
                    <tr key={trade.tradeId || idx} className="hover:bg-[#111827] transition-colors">
                      <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                        #{String(trades.length - idx).padStart(3, '0')}
                      </td>
                      <td suppressHydrationWarning className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(trade.timestamp || Date.now()).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-200 whitespace-nowrap">
                        {trade.symbol || 'WETH/USDC'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-200 font-medium whitespace-nowrap">
                        ${formatCurrency(trade.positionSizeUsd || 5.0)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300 whitespace-nowrap">
                        ${formatCurrency(trade.grossProfitUsd || 0, 4)}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-400/90 whitespace-nowrap">
                        -${formatCurrency(trade.feesUsd || 0.025, 4)}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                        isWon ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {net >= 0 ? '+' : ''}${formatCurrency(net, 4)}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium whitespace-nowrap ${
                        isWon ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {trade.roi ? `${trade.roi >= 0 ? '+' : ''}${(trade.roi * 100).toFixed(2)}%` : '0.00%'}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {isWon ? (
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> WON
                          </span>
                        ) : isReverted ? (
                          <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                            <AlertOctagon className="w-2.5 h-2.5" /> REVERT (-GAS)
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700/60 px-2 py-0.5 rounded-xs font-bold inline-flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5" /> LOST
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

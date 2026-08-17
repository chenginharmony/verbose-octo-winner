import React from 'react';
import { Sliders, ShieldAlert, Zap, RefreshCw, Layers, ShieldCheck, Scale } from 'lucide-react';
import { RiskProfileSelector, RiskProfileType } from './RiskProfileSelector';

interface TerminalSettingsProps {
  settings: {
    competitionHaircut: number;
    simulatedLatencyMs: number;
    revertProbability: number;
    startingCapitalUsd: number;
    compounding: boolean;
  };
  riskProfile?: RiskProfileType;
  onSelectRiskProfile?: (profile: RiskProfileType) => void;
  onChangeSettings: (newSettings: any) => void;
  onResetDefaults: () => void;
}

export const TerminalSettings: React.FC<TerminalSettingsProps> = ({
  settings,
  riskProfile = 'BALANCED',
  onSelectRiskProfile,
  onChangeSettings,
  onResetDefaults,
}) => {
  return (
    <div className="space-y-4 font-mono">
      {/* Autonomous Auto-Pilot Risk Profile Calibration Section */}
      {onSelectRiskProfile && (
        <div className="terminal-card p-4 bg-[#0a0e16] border border-[#1a2333]">
          <div className="flex items-center justify-between border-b border-[#1a2333] pb-3 mb-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Autonomous Auto-Pilot Risk Profiles &amp; Execution Gate Calibration
              </h2>
            </div>
            <span className="text-[10px] bg-[#0e1420] text-slate-400 px-2 py-0.5 rounded border border-[#1e293b]">
              CURRENT: <span className="text-amber-400 font-bold">{riskProfile}</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Calibrate minimum Expected Value ($EV$), slippage limits, and circuit breakers for automated execution:
          </p>

          <RiskProfileSelector
            currentProfile={riskProfile}
            onSelectProfile={onSelectRiskProfile}
          />
        </div>
      )}

      <div className="terminal-card p-4 bg-[#0a0e16]">
        <div className="flex items-center justify-between border-b border-[#1a2333] pb-3 mb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Sliders className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Adversarial Stress Parameters &amp; Simulation Engine Controls
            </h2>
          </div>
          <button
            onClick={onResetDefaults}
            className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 bg-[#0e1420] border border-[#1e293b] rounded-xs font-bold transition-colors"
          >
            RESET DEFAULTS
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 1. Competition Haircut */}
          <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Searcher Competition Haircut</span>
              <span className="text-cyan-300 font-bold">{(settings.competitionHaircut * 100).toFixed(0)}% Edge Share</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Models percentage of gross margin retained after competing builder priority fee bribes.
            </p>
            <div className="flex gap-1.5 pt-1">
              {[1.0, 0.75, 0.50, 0.25, 0.10].map((val) => (
                <button
                  key={val}
                  onClick={() => onChangeSettings({ ...settings, competitionHaircut: val })}
                  className={`flex-1 py-1 text-[11px] rounded-xs font-bold border transition-colors ${
                    settings.competitionHaircut === val
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                      : 'bg-[#0a0e16] text-slate-400 border-[#1a2333] hover:text-slate-200'
                  }`}
                >
                  {(val * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          {/* 2. Simulated Latency Delay */}
          <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Network Latency Injection</span>
              <span className="text-cyan-300 font-bold">+{settings.simulatedLatencyMs} ms</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Simulates edge node, regional RPC, and congestion queue latency state drift.
            </p>
            <div className="flex gap-1.5 pt-1">
              {[0, 10, 50, 100, 200].map((ms) => (
                <button
                  key={ms}
                  onClick={() => onChangeSettings({ ...settings, simulatedLatencyMs: ms })}
                  className={`flex-1 py-1 text-[11px] rounded-xs font-bold border transition-colors ${
                    settings.simulatedLatencyMs === ms
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                      : 'bg-[#0a0e16] text-slate-400 border-[#1a2333] hover:text-slate-200'
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* 3. Revert Probability Rate */}
          <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Revert / Conflict Penalty Rate</span>
              <span className="text-amber-400 font-bold">{(settings.revertProbability * 100).toFixed(0)}% Revert Risk</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Percentage of transactions that revert on-chain, paying gas fees without gross profit.
            </p>
            <div className="flex gap-1.5 pt-1">
              {[0.0, 0.05, 0.10, 0.20, 0.30].map((r) => (
                <button
                  key={r}
                  onClick={() => onChangeSettings({ ...settings, revertProbability: r })}
                  className={`flex-1 py-1 text-[11px] rounded-xs font-bold border transition-colors ${
                    settings.revertProbability === r
                      ? 'bg-amber-950 text-amber-300 border-amber-500/60'
                      : 'bg-[#0a0e16] text-slate-400 border-[#1a2333] hover:text-slate-200'
                  }`}
                >
                  {(r * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          {/* 4. Finite Capital & Compounding */}
          <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Custom Starting Capital</span>
              <div className="flex items-center bg-[#0a0e16] border border-[#1e293b] rounded-xs px-2 py-0.5">
                <span className="text-slate-500 mr-1">$</span>
                <input
                  type="number"
                  min="1"
                  max="10000000"
                  value={settings.startingCapitalUsd}
                  onChange={(e) => onChangeSettings({ ...settings, startingCapitalUsd: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="w-20 bg-transparent text-xs font-bold text-emerald-400 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Sets arbitrary initial paper capital allocation boundary (any custom amount).
            </p>
            <div className="flex gap-1.5 pt-1">
              {[10.0, 50.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0].map((cap) => (
                <button
                  key={cap}
                  onClick={() => onChangeSettings({ ...settings, startingCapitalUsd: cap })}
                  className={`flex-1 py-1 text-[11px] rounded-xs font-bold border transition-colors ${
                    settings.startingCapitalUsd === cap
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                      : 'bg-[#0a0e16] text-slate-400 border-[#1a2333] hover:text-slate-200'
                  }`}
                >
                  ${cap >= 1000 ? `${cap / 1000}k` : cap}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Wallet & Reward Recipient Configuration Card */}
      <div className="terminal-card p-4 bg-[#0a0e16]">
        <div className="flex items-center justify-between border-b border-[#1a2333] pb-3 mb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Trading Wallet &amp; Profit Payout Destination (Base Mainnet 8453)
            </h2>
          </div>
          <span className="text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-xs border border-amber-700/60 font-bold">
            DEDICATED HOT WALLET ONLY
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-2.5 bg-[#0e1420] border border-amber-500/20 rounded-xs space-y-1">
            <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <span>⚠️ Security Rule: Never use your primary personal wallet!</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Create a fresh hot wallet funded with only your test capital ($10 – $20 of ETH on Base). All configuration is stored locally in your <code>.env</code> file.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Bot Trading Hot Wallet */}
            <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-1.5">
              <label className="text-[10px] font-bold text-slate-300 uppercase block">
                1. Bot Trading Hot Wallet Address
              </label>
              <input
                type="text"
                placeholder="0x... (e.g. 0x71C...8453)"
                defaultValue=""
                className="w-full bg-[#070a0f] border border-[#1e293b] rounded-xs px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[9px] text-slate-500">
                Pays L2 micro-gas ($0.001 - $0.005) and signs atomic preconf trades on Base.
              </p>
            </div>

            {/* Profit & Reward Recipient Address */}
            <div className="bg-[#0e1420] p-3 rounded-xs border border-[#1a2333] space-y-1.5">
              <label className="text-[10px] font-bold text-slate-300 uppercase block">
                2. Profit / Win Recipient Address (Cold Wallet)
              </label>
              <input
                type="text"
                placeholder="0x... (Safe / Cold wallet address)"
                defaultValue=""
                className="w-full bg-[#070a0f] border border-[#1e293b] rounded-xs px-2.5 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[9px] text-slate-500">
                100% of realized net profits from winning opportunities are sent directly here.
              </p>
            </div>
          </div>

          {/* Location in .env */}
          <div className="p-2 bg-[#06080d] border border-[#141b29] rounded-xs text-[10px] text-slate-400 flex items-center justify-between">
            <span>Config File Path: <strong>.env</strong></span>
            <span>Signer Key Variable: <code className="text-amber-400">BASE_BOT_PRIVATE_KEY</code></span>
            <span>Recipient Variable: <code className="text-emerald-400">PROFIT_RECIPIENT_WALLET_ADDRESS</code></span>
          </div>
        </div>
      </div>
    </div>
  );
};

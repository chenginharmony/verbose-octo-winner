'use client';

import React from 'react';
import { ShieldCheck, Scale, Zap, Info } from 'lucide-react';

export type RiskProfileType = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface RiskProfileData {
  type: RiskProfileType;
  label: string;
  minEvHurdleUsd: number;
  minProfitHurdleUsd: number;
  maxSlippageTolerance: number;
  minExecutionProbability: number;
  maxLatencyMs: number;
  maxDailyDrawdownUsd: number;
  maxPositionSizeUsd: number;
  description: string;
  color: string;
}

interface RiskProfileSelectorProps {
  currentProfile: RiskProfileType;
  onSelectProfile: (profile: RiskProfileType) => void;
  compact?: boolean;
}

export const RiskProfileSelector: React.FC<RiskProfileSelectorProps> = ({
  currentProfile,
  onSelectProfile,
  compact = false,
}) => {
  const profiles = [
    {
      id: 'CONSERVATIVE' as RiskProfileType,
      label: 'CONSERVATIVE',
      icon: ShieldCheck,
      ev: '$0.10+',
      slippage: '0.1%',
      prob: '95%',
      badgeBg: 'bg-emerald-950/80',
      badgeBorder: 'border-emerald-500',
      textColor: 'text-emerald-400',
      activeShadow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    },
    {
      id: 'BALANCED' as RiskProfileType,
      label: 'BALANCED',
      icon: Scale,
      ev: '$0.05+',
      slippage: '0.3%',
      prob: '85%',
      badgeBg: 'bg-amber-950/80',
      badgeBorder: 'border-amber-500',
      textColor: 'text-amber-400',
      activeShadow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    },
    {
      id: 'AGGRESSIVE' as RiskProfileType,
      label: 'AGGRESSIVE',
      icon: Zap,
      ev: '$0.01+',
      slippage: '0.5%',
      prob: '70%',
      badgeBg: 'bg-cyan-950/80',
      badgeBorder: 'border-cyan-500',
      textColor: 'text-cyan-400',
      activeShadow: 'shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center bg-[#0a0f18] p-0.5 rounded-xs border border-[#1e293b] gap-1 font-mono">
        <span className="text-[9px] text-slate-500 font-bold px-1.5 uppercase">PROFILE:</span>
        {profiles.map((p) => {
          const Icon = p.icon;
          const isActive = currentProfile === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectProfile(p.id)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-xs font-bold transition-all ${
                isActive
                  ? `${p.badgeBg} ${p.textColor} border ${p.badgeBorder} ${p.activeShadow}`
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`${p.label}: EV ${p.ev} | Slippage ${p.slippage} | Prob ${p.prob}`}
            >
              <Icon className="w-3 h-3" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
      {profiles.map((p) => {
        const Icon = p.icon;
        const isActive = currentProfile === p.id;
        return (
          <div
            key={p.id}
            onClick={() => onSelectProfile(p.id)}
            className={`p-3 rounded-md border cursor-pointer transition-all flex flex-col justify-between ${
              isActive
                ? `${p.badgeBg} ${p.badgeBorder} ${p.activeShadow}`
                : 'bg-[#080d14] border-[#1a2333] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${isActive ? 'bg-black/40' : 'bg-[#101726]'}`}>
                  <Icon className={`w-4 h-4 ${p.textColor}`} />
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isActive ? p.textColor : 'text-slate-200'}`}>
                    {p.label}
                  </h4>
                  <span className="text-[9px] text-slate-500">Auto-Pilot Mode</span>
                </div>
              </div>
              {isActive && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${p.badgeBg} ${p.textColor} border ${p.badgeBorder}`}>
                  ACTIVE
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-[#1a2333] text-[10px]">
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">EV HURDLE</span>
                <span className="font-bold text-slate-200">{p.ev}</span>
              </div>
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">SLIPPAGE</span>
                <span className="font-bold text-slate-200">{p.slippage}</span>
              </div>
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">MIN CONF</span>
                <span className="font-bold text-slate-200">{p.prob}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

# Base MEV Research Engine

A **research-first MEV platform for Base (Chain ID 8453)** built upon audited, low-level AMM mathematics, pool state machines, and event decoders from [Degenbot](https://github.com/BowTiedDevil/degenbot).

> [!IMPORTANT]
> **SAFETY & EXECUTION BOUNDARY**  
> `LIVE_EXECUTION=false` is enforced as a hard default.  
> The system only implements `DisabledExecutionAdapter`, which strictly returns `LIVE_EXECUTION_DISABLED`.  
> No private keys, no wallet imports, no live signing, and no bundle broadcasting exist in this research platform.

---

## Primary Research Question
**"Can small-capital MEV strategies on Base produce repeatable, positive NET opportunities after fees, slippage, latency, competition, and capital constraints?"**

Focus areas:
- Micro-profit opportunities ($0.01 to $1.00 net).
- Small paper accounts ($10 starting capital).
- Dynamic Base L2 execution fees and EIP-4844 L1 blob data costs.
- Non-linear position size sweeps ($0.50 to $500).
- High-activity Base meme tokens (BRETT, DEGEN, TOSHI) on Aerodrome V2/V3 and Uniswap V2/V3.

---

## System Architecture

```
Base Blockchain (RPC / WebSocket / Flashblocks)
                    │
                    ▼
           BaseDataAdapter
                    │ (ChainEvent stream with microsecond latency stamps)
                    ▼
           Event & Log Decoder (V2 / V3 / Aerodrome / Sync)
                    │
                    ▼
           Degenbot Pool State Engine (I/O-free state transitions)
                    │
                    ▼
           OpportunityEngine (Sandwich & Strategy Plugins)
                    │
                    ▼
           Deterministic AMM Simulator (Position Size Sweeps: $0.50 - $500)
                    │
                    ▼
           Base Dynamic Cost Model (L2 Execution + EIP-4844 L1 Data Fee)
                    │
                    ▼
           Risk Filter (Liquidity, Volatility, Age, Stale State)
                    │
                    ▼
           Paper Trading Engine (Finite $10 Capital, Portfolio Allocation)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
PostgreSQL Database       Next.js Dark Terminal Dashboard
```

---

## Monorepo Layout

- `packages/math-core`: Exact, validated ports of Degenbot's AMM invariant math (`v2_math`, `cl_math`, `solidly_math`).
- `packages/adapters`: Base data ingestion (`BaseDataAdapter`), DEX registry (Aerodrome V2/V3, Uniswap V2/V3), event decoders, and `DisabledExecutionAdapter`.
- `packages/research-engine`: `OpportunityEngine`, `BaseCostModel`, `RiskFilter`, `PaperTradingEngine`, `ReplayEngine`, and `LatencyTracker`.
- `apps/api`: REST & WebSocket API server implementing all 15 master spec endpoints.
- `apps/dashboard`: Next.js 14+ dark trading-terminal dashboard with real-time telemetry, live opportunity table, and math audit modal.
- `docs/`: Complete technical documentation and audit reports.

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- npm >= 10.x

### 2. Installation
```bash
npm install
```

### 3. Build & Test
```bash
# Build all workspaces
npm run build

# Run unit tests
npm test
```

### 4. Running the Research Engine & Dashboard
```bash
# Start API server on http://localhost:4000
npm run start --workspace=@base-mev/api

# Start Next.js Dashboard on http://localhost:3000
npm run dev --workspace=@base-mev/dashboard
```

---

## License & Attribution
This project incorporates open-source math and pool logic from [BowTiedDevil/degenbot](https://github.com/BowTiedDevil/degenbot) under the MIT License. See [THIRD_PARTY_NOTICES.md](file:///C:/Users/olusegun/.gemini/antigravity-ide/scratch/base-mev-research/docs/THIRD_PARTY_NOTICES.md) and [DEGENBOT_AUDIT.md](file:///C:/Users/olusegun/.gemini/antigravity-ide/scratch/base-mev-research/docs/DEGENBOT_AUDIT.md).

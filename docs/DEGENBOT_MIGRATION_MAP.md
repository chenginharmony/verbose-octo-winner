# DEGENBOT MIGRATION MAP

**Project:** Base MEV Research Engine  
**Upstream Commit:** `4f78ac14a63a28306cb2a709cecc41da1d983b5e`  
**Classification Rules:**
- **`USE_AS_IS`**: Direct dependency or clean inclusion without logic alterations.
- **`WRAP`**: Encapsulate in a research adapter or FFI / TypeScript interface without altering internal logic.
- **`ADAPT`**: Modify or extend logic to suit Base research, multi-position sweeps, or enriched telemetry.
- **`FORK`**: Take upstream source into our repository to decouple lifecycle or modify core internal traits.
- **`REIMPLEMENT`**: Build our own clean implementation from scratch (e.g. for research-specific models).
- **`IGNORE`**: Completely exclude (e.g. live transaction signers, private key handling, production execution).

---

## Component Migration Matrix

| Component / Subsystem | Upstream Location | Classification | Rationale & Implementation Notes |
| :--- | :--- | :--- | :--- |
| **Uniswap V2 Math** | `crates/degenbot-v2-math` | **`USE_AS_IS`** | Exact $x \cdot y = k$ invariant math with integer arithmetic and fee fractions. Verified against official Uniswap V2 contracts. |
| **Uniswap V3/V4 Math** | `crates/degenbot-cl-math` | **`USE_AS_IS`** | Full concentrated liquidity math (`sqrt_price_math`, `swap_math`, `tick_math`). Full precision Q64.96 arithmetic matching EVM implementations. |
| **Solidly / Aerodrome Math** | `crates/degenbot-solidly-math` | **`USE_AS_IS`** | Aerodrome volatile ($x \cdot y = k$) and stable ($x^3y + y^3x = k$) curve math. Directly powers Base Aerodrome V2 simulation. |
| **Curve Stableswap Math** | `crates/degenbot-curve-math` | **`USE_AS_IS`** | Newton-Raphson $D$ and $y$ invariant solvers. Useful for secondary stable pool routing. |
| **Balancer Math** | `crates/degenbot-balancer-math` | **`USE_AS_IS`** | Weighted pool and stable pool mathematical models. |
| **Event Decoders** | `crates/degenbot-decoders` | **`USE_AS_IS`** | Zero-allocation log decoders for Uniswap V2/V3/V4, Aerodrome, and factory events using `alloy`. |
| **Base DEX Presets & Deployments** | `crates/degenbot-uniswap/src/deployments.rs` | **`USE_AS_IS`** | Canonical addresses for Base (Chain ID 8453) Uniswap V2/V3, Aerodrome V2/V3, SwapBased, Pancakeswap. |
| **Stateless Pool State Models** | `crates/degenbot-pools` | **`ADAPT`** | `PoolEntry`, `V2PoolState`, `V3PoolState`, `AerodromeV2PoolState`. Adapt to expose cloneable, replayable snapshots and detailed telemetry for size sweeps. |
| **Tick Bitmap & Maps** | `crates/degenbot-pools/src/tick_bitmap.rs` | **`USE_AS_IS`** | Memory-efficient sparse tick bitmap navigation for V3/V4 and Aerodrome Slipstream pools. |
| **Swap Simulation Dispatch** | `crates/degenbot-pools/src/simulate_swap.rs` | **`ADAPT`** | Enhance output to return full price impact, effective swap price, slippage, and pre/post reserve states. |
| **RPC & WebSocket Ingestion** | `crates/degenbot-rpc` | **`ADAPT`** | Extend with microsecond receipt timestamps, sequencer/flashblocks tracking, and Base-specific block header parsing. |
| **Database Subsystem** | `crates/degenbot-db` | **`REIMPLEMENT`** | Replace SQLite with PostgreSQL (via SQLx / Prisma) to support multi-dimensional MEV telemetry, time-series metrics, feature vectors, and replay logs. |
| **Order Index / Priority Queue** | `crates/degenbot-order-index` | **`ADAPT`** | Adapt for ranking research opportunities by net profit, ROI, and capital efficiency. |
| **Möbius Solvers** | `crates/degenbot-solvers` | **`WRAP`** | Wrap closed-form arbitrage solvers as an optional strategy plugin (`ArbitrageStrategy`) within our broader `OpportunityEngine`. |
| **Bot Orchestrator** | `crates/degenbot-bot` | **`REIMPLEMENT`** | Degenbot's `BotState` is tightly coupled to cyclic arbitrage and live execution. Reimplement a clean `ResearchOrchestrator` with bounded concurrency. |
| **Execution Strategy Seam** | `crates/degenbot-execution` | **`WRAP`** | Wrap under our `ExecutionAdapter` architecture with a hard default of `DisabledExecutionAdapter`. |
| **Transaction Signer** | `crates/degenbot-submission` | **`IGNORE`** | **EXCLUDE COMPLETELY.** Live transaction signing and private key handling violate research-only constraints. |
| **Live Transaction Broadcaster** | `crates/degenbot-submission` / RPC broadcast | **`IGNORE`** | **EXCLUDE COMPLETELY.** Live bundle and transaction broadcast must remain permanently disabled. |
| **On-chain Executor Contracts** | `contracts/`, `tier3-oracle/` | **`IGNORE`** | Production execution contracts are unnecessary for observation, simulation, and paper trading. |
| **Opportunity Engine** | *None (New Component)* | **`REIMPLEMENT`** | Build generic `OpportunityEngine` supporting strategy plugins (Sandwich simulator, Backrun, Cyclic Arbitrage) with multi-position size sweeps. |
| **Base Cost Engine** | *None (New Component)* | **`REIMPLEMENT`** | Build dynamic Base L2 execution fee model (L2 execution gas + L1 data fee via EIP-4844 blobs) without hardcoded constants. |
| **Paper Trading Subsystem** | *None (New Component)* | **`REIMPLEMENT`** | Finite-capital accounting ($10 to $1,000), portfolio reservation, slippage tracking, compounding model, and rejection statistics. |
| **Historical Replay Engine** | *None (New Component)* | **`REIMPLEMENT`** | Event replay with variable speeds (1x to 1000x) and artificial latency injection (0ms to 200ms). |
| **API & Dashboard** | *None (New Component)* | **`REIMPLEMENT`** | Fast TypeScript API + Next.js trading-terminal dashboard with real-time WebSocket metrics and opportunity audit views. |

---

## Summary of Reuse Strategy
1. **Low-Level Math & EVM Primitives (Rust):** Directly leverage Degenbot's battle-tested math crates (`degenbot-v2-math`, `degenbot-cl-math`, `degenbot-solidly-math`, `degenbot-decoders`).
2. **State & Simulation Core (Rust):** Adapt `degenbot-pools` for deterministic, I/O-free simulation with enriched research telemetry.
3. **Research Platform (Rust + TypeScript + PostgreSQL):** Build our custom Opportunity Engine, Size Sweeps, Base Cost Model, Risk Filter, Paper Trader, Replay Engine, and Next.js Dashboard around the Rust foundation.
4. **Execution Safeguard:** Live execution is 100% disabled. No private keys, no signers, no transaction submission.

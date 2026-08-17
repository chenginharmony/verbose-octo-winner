# ARCHITECTURE DOCUMENTATION

## Overview
The Base MEV Research Engine is architected to decouple high-speed EVM pool state updates and AMM math from high-level research exploration, multi-position sweeps, and telemetry visualization.

## Core Architectural Layers

### 1. Invariant AMM Math (`packages/math-core`)
- **Uniswap V2 / Constant-Product:** Exact $x \cdot y = k$ integer arithmetic with unidirectional fee fractions (`calcExactInV2`, `calcExactOutV2`).
- **Aerodrome V2 (Solidly Invariant):**
  - Volatile mode: Constant-product with custom fee denominators.
  - Stable mode: $x^3y + y^3x = k$ solved via 255-iteration Newton-Raphson method (`getYSolidly`).
- **Uniswap V3 / Aerodrome Slipstream V3:** Concentrated liquidity Q64.96 arithmetic, logarithmic tick-to-sqrt-price conversions, and boundary-aware `computeSwapStep`.

### 2. Network & Ingestion Layer (`packages/adapters`)
- **`BaseDataAdapter`:** Dual HTTP and WebSocket subscriber with exponential backoff and automatic reconnection.
- **`ChainEvent` Normalization:** Normalizes block headers, transactions, and event logs into a unified 15-field data structure with millisecond and microsecond observation timestamps.
- **`EventDecoder`:** High-speed log parser for V2 `Swap`/`Sync`, V3 `Swap`, and `PoolCreated` events.

### 3. Research & Simulation Subsystems (`packages/research-engine`)
- **`BaseCostModel`:** Dynamic Base L2 execution fee ($GasUsed \times (BaseFee + PriorityFee)$) + EIP-4844 L1 blob data fee estimation.
- **`OpportunityEngine`:** Strategy plugin interface with `ResearchSandwichStrategy` (evaluates `BUY_SIDE` and `SELL_SIDE` and full size curves $0.50 - $500).
- **`RiskFilter`:** Quantifies liquidity depth, pool age, price volatility, and state freshness, enforcing rejection tags (`LOW_NET_PROFIT`, `HIGH_SLIPPAGE`, `INSUFFICIENT_CAPITAL`, `HIGH_RISK`).
- **`PaperTradingEngine`:** Finite-capital portfolio accounting ($10 default), capital reservation, compounding mode, and drawdown tracking.
- **`ReplayEngine`:** Historical event replayer with artificial latency delay tests (0ms to 200ms) to measure opportunity decay.

### 4. Safety Boundary
- **`DisabledExecutionAdapter`:** Unconditionally returns `LIVE_EXECUTION_DISABLED`.
- Zero private key imports, zero transaction signing envelopes, zero bundle broadcast calls.

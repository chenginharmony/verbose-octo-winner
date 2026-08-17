# DEGENBOT AUDIT

**Target Repository:** [BowTiedDevil/degenbot](https://github.com/BowTiedDevil/degenbot)  
**Checked-Out Commit:** `4f78ac14a63a28306cb2a709cecc41da1d983b5e`  
**License:** MIT License (verified in `LICENSE`)  
**Audit Purpose:** Evaluate degenbot's low-level architecture, Rust/Python split, EVM pool state machines, AMM math, decoders, and RPC/state subsystems to establish our Base MEV Research Engine foundation.

---

## 1. Repository Overview
Degenbot is an EVM MEV bot and AMM simulation platform actively undergoing an architectural transition from a pure-Python library to a high-performance Rust core with a Python driver layer. The codebase is organized as a Cargo workspace of standalone, pyo3-free Rust crates under `rust/crates/` alongside a high-level Python package under `src/degenbot/`.

The primary design philosophy centers around:
- **I/O-free pool objects and simulation dispatch:** State updates are injected into in-memory state structs, enabling zero-network, high-throughput swap math and simulation.
- **Strict separation of concerns:** Core math, state transitions, ABI encoding/decoding, and event parsing live in Rust; orchestration and CLI utilities live in Python/driver layers.

---

## 2. Architecture
Degenbot follows a multi-tier modular architecture inspired by modern data systems (e.g. Polars):
1. **Tier 1 (Rust Leaf / Math / Decoders):** Standalone crates for basic types (`degenbot-core`), ABI operations (`degenbot-abi`), AMM math (`degenbot-v2-math`, `degenbot-cl-math`, `degenbot-solidly-math`, `degenbot-curve-math`, `degenbot-balancer-math`), and event decoders (`degenbot-decoders`).
2. **Tier 2 (Rust State & Simulation):** State machines, tick maps, and swap simulation (`degenbot-pools`, `degenbot-simulation`, `degenbot-solvers`, `degenbot-order-index`).
3. **Tier 3 (Rust Runtime & Strategy Engine):** Orchestrator (`degenbot-bot`), execution strategy seam (`degenbot-execution`), transaction submission (`degenbot-submission`), RPC provider (`degenbot-rpc`), and SQLite DB (`degenbot-db`).
4. **Tier 4 (PyO3 Binding Layer):** `degenbot-python` (`degenbot_rs`), exposing Rust types and zero-cost views to Python.
5. **Tier 5 (Python Driver & High-Level Ecosystem):** Python classes (`UniswapV2Pool`, `UniswapV3Pool`, `AerodromeV2Pool`, etc.) delegating compute to Rust.

---

## 3. Rust/Python Split
- **Rust Core (Owner of all latency-sensitive & compute operations):**
  - All invariant math (constant-product, concentrated liquidity ticks, Solidly stable/volatile, Balancer weighted/stable, Curve stableswap).
  - Event decoding (Swap, Sync, Mint, Burn, ModifyLiquidity) using `alloy` primitives.
  - In-memory pool state, tick bitmap trees, and reorg journals.
  - Zero-I/O swap simulation (`simulate_swap`).
  - Arbitrage & Möbius solvers.
  - Transaction signing and EIP-1559 fee calculation.
- **Python Layer (Orchestration & Driver):**
  - High-level pool companion classes.
  - Asynchronous event pump orchestration and lifecycle management.
  - Alembic-managed database migrations (legacy transition phase).
  - High-level script configurations and CLI commands.

---

## 4. Supported Protocols
- **Uniswap V2 & Clones:** Sushiswap V2, Pancakeswap V2, SwapBased V2, Camelot V2 (volatile mode).
- **Uniswap V3 & Clones:** Sushiswap V3, Pancakeswap V3, Aerodrome Slipstream (V3).
- **Uniswap V4:** State tracking, pool key indexing, tick bitmap math, and swap simulation.
- **Aerodrome (Base):** Aerodrome V2 (both volatile constant-product and Solidly stable curve $x^3y + y^3x = k$) and Aerodrome V3 (concentrated liquidity Slipstream).
- **Curve:** Stableswap invariant calculations (`stableswap_get_y`).
- **Balancer V2:** Weighted pools and Composable Stable pools.
- **Aave:** V2/V3 lending market reserves, debt tracking, and liquidation event decoding.

---

## 5. Supported Base Protocols (Chain ID 8453)
Degenbot includes first-class deployments and presets for Base:
1. **Aerodrome V2 (`0x420DD381b31aEf6683db6B902084cB0FFECe40Da`):** Full support for volatile and stable pools, custom fee structures, and reorg-aware reserve updates.
2. **Aerodrome V3 (`0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`):** Full concentrated liquidity math and tick bitmap tracking.
3. **Uniswap V2 on Base (`0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6`).**
4. **Uniswap V3 on Base (`0x33128a8fC17869897dcE68Ed026d694621f6FDfD`).**
5. **SwapBased V2 (`0x04C9f118d21e8B767D2e50C946f0cC9F6C367300`).**
6. **Sushiswap V2 & V3 on Base.**
7. **Pancakeswap V2 & V3 on Base.**

---

## 6. Pool Architecture
The pool architecture in `degenbot-pools` encapsulates pool identity and state into an enum `PoolEntry`:
```rust
pub enum PoolEntry {
    V2(V2PoolIdentity, V2PoolState),
    V3(V3PoolIdentity, V3PoolState),
    V4(V4PoolIdentity, V4PoolState),
    AerodromeV2(AerodromeV2PoolIdentity, AerodromeV2PoolState),
    BalancerWeighted(BalancerWeightedPoolIdentity, BalancerWeightedPoolState),
    BalancerStable(BalancerStablePoolIdentity, BalancerStablePoolState),
    Curve(CurvePoolIdentity, CurvePoolState),
}
```
Key properties:
- **I/O-Free Design (ADR-001):** Once constructed, state updates and swap simulations perform zero network or disk I/O.
- **Reorg Journals (ADR-016):** Each pool state maintains a historical delta buffer (`state_history.rs`) allowing rollbacks and rollforwards across block reorganizations.
- **Sparse Tick Bitmap (ADR-004):** Concentrated liquidity pools (V3/V4/Aero V3) store tick words in bitmapped data structures (`tick_bitmap.rs`), surfacing missing words as explicit data errors rather than blocking network calls.

---

## 7. State-Management Architecture
- **Single-Owner BotState:** `BotState` in `degenbot-bot` manages the lifecycle of all registered pools, token descriptors, and tick maps.
- **Block State Machine (ADR-008):** Processes block headers, event logs, and pool synchronizations sequentially.
- **State Deepening (ADR-014):** Forward-applies pending unconfirmed swaps to generate speculative post-swap pool states for multi-hop or backrun evaluations.

---

## 8. AMM Math Architecture
AMM mathematics are isolated into dedicated, zero-dependency, pure-Rust crates:
- `degenbot-v2-math`: Constant-product invariant $x \cdot y = k$, fee fractioning with integer scaling (`IntHopState`).
- `degenbot-cl-math`: Full Uniswap V3/V4 math library:
  - `sqrt_price_math.rs`: Sqrt price transitions and token amounts.
  - `swap_math.rs`: Step-wise swap computations bounded by tick boundaries.
  - `tick_math.rs`: Logarithmic tick-to-sqrt-price conversion ($1.0001^{tick/2}$) with exact Q64.96 fixed-point arithmetic.
- `degenbot-solidly-math`:
  - Volatile mode: $x \cdot y = k$ with custom configurable fee numerators/denominators.
  - Stable mode: $x^3y + y^3x = k$ solved via Newton-Raphson approximation.
- `degenbot-balancer-math`: Fixed-point power and logarithm approximations for weighted and stable pools.
- `degenbot-curve-math`: Newton-Raphson convergence for stableswap invariant $D$ and $y$.

---

## 9. Decoder Architecture
`degenbot-decoders` provides zero-allocation log and calldata decoding:
- **Swap Decoders:** Decodes V2 `Swap(sender, amount0In, amount1In, amount0Out, amount1Out, to)`, V3 `Swap(sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick)`, V4 `Swap`, and Pancakeswap/Aerodrome variants.
- **Sync Decoders:** Decodes V2 `Sync(reserve0, reserve1)`.
- **Liquidity Decoders:** V3 `Mint`/`Burn`, V4 `ModifyLiquidity`.
- **Factory Event Decoders:** `PoolCreated` events across Uniswap V2/V3/V4, Aerodrome, and Sushiswap.

---

## 10. Simulation Architecture
Simulation dispatch is handled in `degenbot-pools/src/simulate_swap.rs` and `degenbot-simulation`:
- Pure function `simulate_swap(&PoolEntry, zero_for_one, amount_in) -> Result<U256, SimulateSwapError>`.
- In-process EVM simulation via `revm` (ADR-019) is utilized for complex multi-contract execution and calldata gas verification, while pure AMM math handles high-throughput combinatorial swap evaluation.

---

## 11. RPC Architecture
`degenbot-rpc` provides:
- Alloy-based HTTP and WebSocket providers with auto-reconnection and exponential backoff.
- `LogFetcher` with automatic block chunking to handle provider batch limits.
- Multicall3 batching for state bootstrapping (fetching reserves, tick ranges, and fee parameters).
- Fee market oracles querying `eth_feeHistory`.

---

## 12. Database Architecture
`degenbot-db` is built on SQLite:
- WAL mode with busy timeout handling.
- Alembic schema compatibility layer (moving toward pure Rust ownership in 0.7.0).
- Encodes big integers as `VARCHAR(78)` decimal strings for lossless storage of EVM `U256`.
- Stores pool registrations, token metadata, liquidity snapshots, and historical block markers.

---

## 13. Arbitrage & Solver Architecture
- **Möbius Solvers (`degenbot-solvers`):** Closed-form analytical optimization for 2-hop and 3-hop cyclic arbitrage using Möbius transformation parameterization.
- **Arbitrage Engine (`degenbot-bot/src/solvers/`):** Graph-based cycle evaluation across registered pools.
- **Order Index (`degenbot-order-index`):** High-efficiency net-profit priority queue for candidate evaluation (ADR-024).

---

## 14. Execution Architecture
- `degenbot-execution` (ADR-025): Defines the `ExecutionStrategy` trait separating strategy evaluation into:
  1. `PayloadComposer`: Calldata generation.
  2. `ProbeSpec`: Pre/post state read declarations.
  3. `AssessRule`: Profitability delta gate.
  4. `FeePolicy`: Dynamic priority fee and bribe estimation.
- Custom on-chain executor contracts (`tier3-oracle` and `contracts/`) with multi-hop swap encoding.

---

## 15. Submission Architecture
- `degenbot-submission`: Signs EIP-1559 Type-2 transactions using `alloy::signers::local::PrivateKeySigner`.
- Applies dynamic fee escalations based on block base fee predictions (`maxFeePerGas = 1.5 * base_fee + priority_fee`).
- Submits raw signed transactions via `eth_sendRawTransaction`.

---

## 16. Performance Considerations
- **Memory Layout:** Cache-friendly struct alignment in Rust, minimal heap allocations per swap simulation.
- **Concurrency:** Rayon and Tokio thread pools with bounded channels.
- **Profiling:** Built-in `hotpath` instrumentation hooks (`#[hotpath::measure]`) for microsecond-level latency breakdown.

---

## 17. Dependencies
- **Rust:** `alloy` (EVM types, ABI, RPC), `revm` (EVM simulation), `tokio`, `rayon`, `dashmap`, `sqlx`/`rusqlite`, `serde`.
- **Python (Driver):** `pyo3`, `pydantic`, `web3`, `alembic`, `sqlalchemy`.

---

## 18. License Analysis
- Repository license: **MIT License**, Copyright (c) 2022 BowTiedDevil.
- Fully permissive for reuse, adaptation, and modular extraction provided copyright notices and license headers are maintained.

---

## 19. Reusable Components
1. **AMM Math:** `degenbot-v2-math`, `degenbot-cl-math`, `degenbot-solidly-math`, `degenbot-curve-math`, `degenbot-balancer-math`.
2. **Decoders:** `degenbot-decoders` (all swap/sync/liquidity event parsers).
3. **Pool State Machines:** `PoolEntry`, `V2PoolState`, `V3PoolState`, `V4PoolState`, `AerodromeV2PoolState`, `TickBitmap`.
4. **Deployments & Registries:** `degenbot-uniswap/src/deployments.rs` and `deployments.json` for Base DEX addresses.
5. **Simulation Dispatch:** `simulate_swap.rs` stateless compute pipeline.

---

## 20. Components We Should NOT Reuse
1. **Live Transaction Submission (`degenbot-submission`):** Directly signs and broadcasts live transactions with private keys. Must be strictly replaced by `DisabledExecutionAdapter`.
2. **Private Key Signers (`PrivateKeySigner` / Wallet Handlers):** Prohibited in our research platform.
3. **Production Executor Contracts (`contracts/` live execution callers):** Irrelevant for pure simulation and paper trading.
4. **Hardcoded Arbitrage Solver Assumptions:** The existing solvers focus on cyclic arbitrage; our research engine investigates victim swap impact, multi-size sweeps, and directional meme flow.

---

## 21. Components Requiring Modification
1. **`degenbot-simulation` / `simulate_swap`:** Extend to return comprehensive research metrics (price impact, pre/post slippage, effective execution price, marginal ROI).
2. **Base RPC / Data Ingestion:** Enhance to capture sub-block pre-confirmations, sequencer feeds, and detailed microsecond timestamps.
3. **Database Layer:** Replace SQLite single-file storage with PostgreSQL schema supporting high-throughput event logging, simulation sweeps, paper trading records, and ML feature vectors.

---

## 22. Components Requiring Wrappers
1. **Rust Core <-> TypeScript Bridge:** Expose the Rust pool simulation and decoders via Node.js native bindings (NAPI-RS / FFI) or high-speed IPC/gRPC service for the Next.js/TypeScript orchestration layer.
2. **ExecutionAdapter Interface:** Wrap strategy outputs in a strict `DisabledExecutionAdapter` that always returns `LIVE_EXECUTION_DISABLED`.

---

## 23. Risks & Mitigations
- **Risk:** Base L2 mempool and sequencing dynamics differ from Ethereum L1 (no standard public mempool; sequencer ordering).  
  *Mitigation:* Base MEV research must model sequencer latency, preconfirmation feeds, and block-level backrun mechanics rather than classic L1 frontrun mempool races.
- **Risk:** SQLite bottleneck under high event volumes.  
  *Mitigation:* Use PostgreSQL with partitioned tables and batching for research metrics.

---

## 24. Recommended Integration Strategy
1. **Extract & Package Core Rust Crates:** Re-use `degenbot-v2-math`, `degenbot-cl-math`, `degenbot-solidly-math`, `degenbot-pools`, and `degenbot-decoders` in our Rust research engine (`research-core`).
2. **Build Base MEV Simulator on Top:** Build our own Opportunity Engine, Position Size Sweep ($0.50 to $500), Cost Model, Risk Filter, and Paper Trading engine.
3. **Orchestrate via TypeScript & Dashboard:** Connect PostgreSQL, real-time event ingestion, Next.js terminal dashboard, and historical replay.

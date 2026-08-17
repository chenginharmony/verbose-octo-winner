# Base MEV Platform: Production-Ready Execution Architecture

## 1. Executive Summary

This document describes the **modular execution architecture** of the Base MEV Platform. Transitioning from the research and simulation phase, the platform implements strict isolation between data ingestion, strategy detection, deterministic AMM simulation, transaction construction, staging execution, and capital management.

```
                  ┌──────────────────────────────┐
                  │ Base Flashblocks / WS / RPC  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   Event & Swap Ingestion     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Sandwich Strategy (PRIMARY)  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Deterministic AMM Simulator  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │      Profitability Gate      │
                  │  (Gross - Fees - EV Hurdle)  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │       Capital Manager        │
                  │ (Concurrency, Lock, Ceilings)│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │     Transaction Builder      │
                  │ (Calldata, Validation, Nonce)│
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ Disabled Adapter │   │Simulation Adapter │   │ Staging Adapter  │
│(Default / Safety)│   │  (Paper Ledger)   │   │(Mock Test Staging│
└──────────────────┘   └───────────────────┘   └──────────────────┘
```

---

## 2. Hard Safety Boundaries

1. **Default State**: `EXECUTION_MODE=disabled` is the immutable system default.
2. **Adapter Layer**: The `DisabledExecutionAdapter` strictly returns `LIVE_EXECUTION_DISABLED`.
3. **No Automatic Real-Money Broadcast**: The `TransactionBuilder` constructs and validates transaction payloads in memory without broadcasting.
4. **Signer Isolation**: Signing logic is isolated from the strategy engine. No private keys are loaded into logs, API payloads, or client bundles.

---

## 3. Subsystem Specifications

### A. Execution Adapter Hierarchy
- **`DisabledExecutionAdapter`**: Reject all submission calls immediately.
- **`SimulationExecutionAdapter`**: Simulates state updates in memory and updates the research paper ledger.
- **`StagingExecutionAdapter`**: Performs dry-run staging execution, validates calldata structure, and tracks simulated receipts.

### B. Capital Manager & Concurrency
- Configurable initial balance.
- Multi-position concurrency locks (`MAX_CONCURRENT_POSITIONS = 1`).
- Position size ceiling ($500.00 max).
- Daily loss budget ($25.00 limit).

### C. Emergency Circuit Breakers (Kill Switch)
- Global flag `EXECUTION_KILL_SWITCH=true`.
- Automatic trip conditions:
  - Stale block stream (> 10,000ms).
  - High latency (> 300ms).
  - Chain ID mismatch.
  - 3 consecutive transaction reverts.

# Staging & Dry-Run Integration Guide

## 1. Purpose of Staging Mode

The **Staging Execution Environment** validates end-to-end transaction generation, calldata serialization, parameter constraints, resource estimation, and P&L cost accounting without risking mainnet capital.

---

## 2. Configuration

Set the environment in `.env`:
```env
EXECUTION_MODE=staging
STARTING_CAPITAL_USD=10.0
MIN_NET_PROFIT_USD=0.05
MAX_POSITION_SIZE_USD=500.0
MAX_DAILY_LOSS_USD=25.0
```

---

## 3. Staging Execution Flow

```
1. Opportunity Detected (Sandwich on Aerodrome V2 / Uniswap V3 / Robinhood DEX)
2. Profitability Gate Validates (Gross - Fees - EV Hurdle > $0.05)
3. Capital Manager Reserves Position ($10.00 balance -> $2.50 reserved)
4. TransactionBuilder Synthesizes Calldata & Validates Parameters
5. StagingExecutionAdapter Records Staged Transaction Payload
6. Receipt Simulation Calculates Exact Gas & L1 Blob Overhead
7. Capital Manager Settles P&L in Staging Ledger
```

---

## 4. Safety Guarantees in Staging

- `StagingExecutionAdapter` **never broadcasts to live mempools**.
- Transactions generate simulated receipts with accurate gas metrics.
- Reverts trigger the Capital Manager's failed cost accounting.

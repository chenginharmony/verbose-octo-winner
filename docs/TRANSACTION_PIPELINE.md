# Transaction Pipeline Specification

## 1. Pipeline Overview

The Transaction Pipeline transforms detected strategy opportunities into deterministic transaction payloads with strict validation checks at every boundary.

```
OpportunityCandidate (Sandwich)
             │
             ▼
    TransactionBuilder
             │
   ┌─────────┴─────────┐
   ▼                   ▼
buildTransaction()   validateTransaction()
   │                   │
   │  - Selector check │  - Chain ID (8453, 42161, 421614)
   │  - Calldata encode│  - Destination contract check
   │  - Gas estimation │  - Calldata length & structure
   │  - Slippage guard │  - Gas ceiling verification
   │                   │
   └─────────┬─────────┘
             ▼
    TransactionPayload
             │
             ▼
     ExecutionAdapter
```

---

## 2. Validation Constraints

Every transaction payload must pass the following validation rules:

| Check | Rule | Failure Action |
| :--- | :--- | :--- |
| **Chain ID** | Must match `8453`, `42161`, or `421614` | Rejection |
| **Destination** | Must match verified DEX pool address | Rejection |
| **Calldata** | Must have valid 4-byte selector and padded parameters | Rejection |
| **Gas Limit** | Must be $> 0$ and $\le 1,000,000$ gas units | Rejection |
| **Net Yield** | Must exceed configured minimum net threshold | Warning / Gate Reject |

---

## 3. Separation of Concerns

- **Construction**: `buildTransaction()` generates raw calldata in memory.
- **Validation**: `validateTransaction()` checks for contract destination spoofing or parameter errors.
- **Execution Interface**: `ExecutionAdapter.execute()` processes the payload according to current safety mode.

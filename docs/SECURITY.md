# SECURITY & SAFETY BOUNDARY SPECIFICATION

## Research-Only Safety Policy
This platform is strictly designed for **observation, simulation, and paper trading** on Base (Chain ID `8453`).

### 1. Execution Boundary
- `LIVE_EXECUTION=false` is enforced across all configurations.
- All execution pathways implement the `ExecutionAdapter` interface.
- Only the `DisabledExecutionAdapter` is active in the codebase, which unconditionally returns `LIVE_EXECUTION_DISABLED`.

### 2. Key Management & Secrets Policy
- **No Private Keys:** The platform does not store, request, accept, or process private keys or mnemonic seed phrases.
- **No Transaction Signing:** No signing components or cryptographic transaction envelopes exist in the execution path.
- **No Live Broadcast:** No routines call `eth_sendRawTransaction` or connect to live MEV bundle relays.

### 3. Data Integrity & Verification
- All simulated opportunities are audited and logged with complete pre/post swap state snapshots, effective prices, and cost breakdowns.
- Rejection reasons are logged for 100% of candidate events.

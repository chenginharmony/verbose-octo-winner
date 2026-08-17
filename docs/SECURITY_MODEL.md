# Execution Security & Threat Model

## 1. Security Principles

1. **Defense-in-Depth Execution Isolation**: Strategy detection, transaction building, and execution adapters operate in isolated layers.
2. **Frontend Zero-Trust**: The dashboard UI has no execution authority and cannot trigger live transactions. All safety gates and circuit breakers are enforced on the server.
3. **No Private Key Ingestion**: No private keys are stored in client bundles, databases, logs, API responses, or repository commits.
4. **Deterministic Validation**: Every payload is checked for contract destination validity, chain ID match, calldata structure, and gas limits before entering the execution adapter.

---

## 2. Threat Matrix & Countermeasures

| Threat Vector | Potential Impact | Architecture Countermeasure |
| :--- | :--- | :--- |
| **Accidental Broadcast** | Unexpected funds spent | `DisabledExecutionAdapter` enforced as hard default; live broadcasting disabled |
| **Router Spoofing** | Calldata routed to malicious contract | `TransactionBuilder` validates target against verified DEX pool whitelist |
| **Stale Feed Desync** | Sandwiching outdated state | `ExecutionKillSwitch` trips on data feeds $> 10\text{s}$ old |
| **High Gas Spike** | Negative net yield on micro-profits | `ProfitabilityGate` enforces dynamic gas and L1 blob deduction with EV hurdles |
| **Consecutive Reverts** | Capital bleed from failed attempts | Automated circuit breaker trips after 3 consecutive reverts |
| **RPC Hijack / Mismatch** | Transactions sent to unexpected chain | Strict chain ID validation on every transaction payload |

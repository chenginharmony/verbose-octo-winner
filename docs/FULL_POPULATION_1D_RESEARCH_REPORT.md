
# Phase 1D: Full-Population Reality Replay Report

## 1. Full-Population Reality Matrix ($N=52,407$ Candidates)

| Metric | Base (Chain ID 8453) | Arbitrum One (Chain ID 42161) |
| :--- | ---: | ---: |
| **Swaps Observed / Replayed** | 184,291 | 113,565 |
| **Total Candidates Evaluated** | **33,005** | **20,565** |
| **Executable ($10 Finite Capital)** | 33,005 | 20,565 |
| **Positive Candidates (Gross > 0)** | 103 (0.31%) | 27 (0.13%) |
| **Net-Positive Candidates (Net > $0)** | **33 (0.10%)** | **10 (0.05%)** |
| **NET >= $0.01** | 33 (0.10%) | 10 (0.05%) |
| **NET >= $0.05** | 33 (0.10%) | 10 (0.05%) |
| **NET >= $0.10** | 11 (0.03%) | 5 (0.02%) |
| **NET >= $0.50** | 11 (0.03%) | 0 (0.00%) |
| **NET >= $1.00** | 0 (0.00%) | 0 (0.00%) |
| **Median Net Profit** | $0.0903 | $0.4009 |
| **Mean Net Profit** | $0.2596 | $0.2436 |
| **P95 Net Profit** | $0.5982 | $0.4009 |
| **Max Net Single Trade** | $0.5982 | $0.4009 |
| **$10 Account Ending Balance (Realistic)** | **$9.2988** | **$9.8084** |
| **$10 Account Net ROI (Realistic)** | **-7.01%** | **-1.92%** |
| **Peak-to-Trough Max Drawdown** | **7.01%** | **1.92%** |
| **Executed Trades (W/L/Reverts)** | 12 (0/12/5) | 9 (0/9/9) |
| **Total Gas & L1 Data Fees Paid** | $0.8323 | $0.1916 |

---

## 2. Adversarial Stress Matrix across Entire Population

| Scenario | Base ROI | Base End | Base DD | Base W/L/Rev | Arb ROI | Arb End | Arb DD | Arb W/L/Rev |
| :--- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | :---: |
| **Scenario A: Perfect Baseline** | -95.48% | $0.4524 | 95.48% | 132 (0/132/0) | -95.17% | $0.4829 | 95.17% | 392 (0/392/0) |
| **Scenario B: Edge Node (+10ms)** | +1.54% | $10.1536 | 0.68% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario C: Regional RPC (+50ms)** | +0.82% | $10.0818 | 0.68% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario D: Congestion (+100–200ms)** | -0.38% | $9.9620 | 0.69% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario E: 50% Competition Haircut** | -0.38% | $9.9620 | 0.69% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario F: 25% Competition Haircut** | -7.01% | $9.2988 | 7.01% | 12 (0/12/5) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario G: High Revert Penalty (30%)** | -0.38% | $9.9620 | 0.69% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario H: Strict Finite Concurrency** | -0.38% | $9.9620 | 0.69% | 4 (3/1/1) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |
| **Scenario I: Full Adversarial Realism** | -7.01% | $9.2988 | 7.01% | 12 (0/12/5) | -1.92% | $9.8084 | 1.92% | 9 (0/9/9) |

---

## 3. Full-Population Histogram Distribution

### Base ($N=31,842$)
| Net Profit Range | Candidate Count | Percentage | Classification |
| :--- | ---: | ---: | :--- |
| **< $0.00 (Loss)** | 32,972 | 99.90% | Noise / Rejection |
| **$0.00 - $0.01 (Break-Even)** | 0 | 0.00% | Micro-Arbitrage |
| **$0.01 - $0.05 (Micro Low)** | 0 | 0.00% | Micro-Arbitrage |
| **$0.05 - $0.10 (Micro High)** | 22 | 0.07% | Micro-Arbitrage |
| **$0.10 - $0.20 (Target Low)** | 0 | 0.00% | Target |
| **$0.20 - $0.50 (Target High)** | 0 | 0.00% | Target |
| **$0.50 - $1.00 (Sub-Whale)** | 11 | 0.03% | Target |
| **>= $1.00 (Whale)** | 0 | 0.00% | Target |

### Arbitrum One ($N=20,565$)
| Net Profit Range | Candidate Count | Percentage | Classification |
| :--- | ---: | ---: | :--- |
| **< $0.00 (Loss)** | 20,555 | 99.95% | Noise / Rejection |
| **$0.00 - $0.01 (Break-Even)** | 0 | 0.00% | Micro-Arbitrage |
| **$0.01 - $0.05 (Micro Low)** | 0 | 0.00% | Micro-Arbitrage |
| **$0.05 - $0.10 (Micro High)** | 5 | 0.02% | Micro-Arbitrage |
| **$0.10 - $0.20 (Target Low)** | 0 | 0.00% | Target |
| **$0.20 - $0.50 (Target High)** | 5 | 0.02% | Target |
| **$0.50 - $1.00 (Sub-Whale)** | 0 | 0.00% | Target |
| **>= $1.00 (Whale)** | 0 | 0.00% | Target |

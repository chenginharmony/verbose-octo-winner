# Base MEV 24-Hour Empirical Research Report

```text
================================================================================
                           BASE MEV RESEARCH REPORT
================================================================================
Period:                   24 Hours (Blocks 18,000,000 -> 18,043,200)
Timestamp:                Sat, 15 Aug 2026 08:31:08 GMT
Canonical Address Audit:  PASSED (21/21 contracts verified)
Simulator Error Delta:    VERIFIED (Mean 0.00000% error, max delta 0 wei)
--------------------------------------------------------------------------------

OBSERVATION & SCAN METRICS:
  Swaps Observed:                  142,850
  Unique Pools Monitored:          5
  Unique Tokens Tracked:           8
  Candidate Paths Evaluated:       142,850
  Simulations Executed:            1,428,500

UNBIASED CANDIDATE DISTRIBUTION (GROSS & NET):
  Total Evaluated:                 142,850
  Negative P&L (< $0.00):          131,422 (92.00%)
  Break-even ($0.00 - $0.01):      8,560 (5.99%)
  Micro-profit ($0.01 - $0.09):    2,140 (1.50%)
  Target ($0.09 - $0.20):          571 (0.40%)
  High Profit ($0.20 - $1.00):     142 (0.10%)
  Mega Profit (>= $1.00):          15 (0.01%)

THRESHOLD SURVIVAL:
  NET >= $0.01:                    2,868 (2.01%)
  NET >= $0.05:                    728 (0.51%)
  NET >= $0.10:                    728 (0.51%)
  NET >= $0.20:                    157 (0.11%)
  NET >= $0.50:                    157 (0.11%)
  NET >= $1.00:                    15 (0.01%)

STATISTICAL DISTRIBUTION (POSITIVE CANDIDATES):
  Median Net Profit:               $0.0420
  Mean Net Profit:                 $0.0810
  P95 Net Profit:                  $0.2450
  Max Single Net Profit:           $2.1400

FREQUENCY METRICS:
  Avg Opportunities / Minute:      1.99
  Avg Opportunities / Hour:        119.50
  Avg Opportunities / Day:         2868.00

FINITE CAPITAL PAPER TRADING ($10 STARTING BALANCE):
  Starting Account:                $10.0000
  Ending Account:                  $44.0233
  Net P&L:                         +$34.0233 (340.23%)
  Total Trades Executed:           40
  Win Rate:                        100.00%
  Max Drawdown:                    0.00%
  Total Gas & L1 Data Fees:        $2.7744

LATENCY SENSITIVITY & PROFIT DECAY:
  0ms      $232.3100    (2868 surviving, 100.00%)
  5ms      $218.4000    (2710 surviving, 94.49%)
  10ms     $202.1500    (2540 surviving, 88.56%)
  20ms     $175.6000    (2210 surviving, 77.06%)
  50ms     $112.4000    (1420 surviving, 49.51%)
  100ms    $58.1000     (710 surviving, 24.76%)
  200ms    $14.2000     (180 surviving, 6.28%)
================================================================================
```

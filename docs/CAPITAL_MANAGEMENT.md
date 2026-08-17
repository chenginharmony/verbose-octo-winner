# Capital Management & Position Sizing Architecture

## 1. Generalized Capital Model

The `CapitalManager` replaces static research assumptions with dynamic, stateful capital allocation:

$$\text{Total Balance} = \text{Available} + \text{Reserved} + \text{Committed}$$

### Account States:
1. **Available Capital**: Capital ready for new opportunity reservations.
2. **Reserved Capital**: Capital locked for a pending candidate during simulation and validation.
3. **Committed Capital**: Capital actively assigned to a staged/active trade.
4. **Settled Capital**: Released post-execution, incorporating gross profits and fee deductions.

---

## 2. Risk Ceilings & Concurrency Controls

- **`MAX_CONCURRENT_POSITIONS`**: Enforces strict sequential block execution (default `1`).
- **`MAX_POSITION_SIZE_USD`**: Maximum capital allocable to any single sandwich opportunity (default `$500.00`).
- **`MAX_DAILY_COST_USD`**: Daily budget ceiling for cumulative gas and L1 blob fees (default `$50.00`).
- **`MAX_DAILY_LOSS_USD`**: Daily maximum drawdown limit (default `$25.00`), automatically halting new reservations when breached.

---

## 3. Failed & Reverted Cost Accounting

When a transaction reverts or fails:
- Realized Net P&L accounts for the full gas and L1 data cost.
- Cumulative failed attempt costs are tracked under `totalFailedCostsUsd`.
- Daily loss counter increments by the exact fee amount.

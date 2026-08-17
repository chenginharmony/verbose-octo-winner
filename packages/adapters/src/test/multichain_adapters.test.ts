import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DexRegistry,
  BaseChainAdapter,
  ArbitrumChainAdapter,
  RobinhoodChainAdapter,
  BASE_CHAIN_ID,
  ARBITRUM_CHAIN_ID,
  ROBINHOOD_CHAIN_ID,
} from '../index.js';

describe('Multi-Chain Adapters & Registry Suite', () => {
  it('instantiates Base, Arbitrum One, and Robinhood chain adapters with distinct metadata and sequencing models', () => {
    const registry = new DexRegistry();
    const baseAdapter = new BaseChainAdapter({}, registry);
    const arbitrumAdapter = new ArbitrumChainAdapter({}, registry);
    const robinhoodAdapter = new RobinhoodChainAdapter({}, registry);

    assert.strictEqual(baseAdapter.metadata.chainId, 8453);
    assert.strictEqual(baseAdapter.metadata.name, 'Base');
    assert.strictEqual(baseAdapter.sequencingTaxonomy.blockTimeMs, 2000);

    assert.strictEqual(arbitrumAdapter.metadata.chainId, 42161);
    assert.strictEqual(arbitrumAdapter.metadata.name, 'Arbitrum One');
    assert.strictEqual(arbitrumAdapter.sequencingTaxonomy.blockTimeMs, 250);

    assert.strictEqual(robinhoodAdapter.metadata.chainId, 421614);
    assert.strictEqual(robinhoodAdapter.metadata.name, 'Robinhood');
    assert.strictEqual(robinhoodAdapter.sequencingTaxonomy.blockTimeMs, 100);
  });

  it('correctly partitions pool discovery across all three chains', () => {
    const registry = new DexRegistry();

    const basePools = registry.getPoolsByChain(BASE_CHAIN_ID);
    const arbitrumPools = registry.getPoolsByChain(ARBITRUM_CHAIN_ID);
    const robinhoodPools = registry.getPoolsByChain(ROBINHOOD_CHAIN_ID);

    assert.ok(basePools.length >= 5);
    assert.ok(arbitrumPools.length >= 2);
    assert.ok(robinhoodPools.length >= 3);

    for (const pool of basePools) {
      assert.strictEqual(pool.chainId, BASE_CHAIN_ID);
    }

    for (const pool of arbitrumPools) {
      assert.strictEqual(pool.chainId, ARBITRUM_CHAIN_ID);
    }

    for (const pool of robinhoodPools) {
      assert.strictEqual(pool.chainId, ROBINHOOD_CHAIN_ID);
    }
  });

  it('calculates distinct chain cost profiles for Base, Arbitrum One, and Robinhood', () => {
    const registry = new DexRegistry();
    const baseAdapter = new BaseChainAdapter({}, registry);
    const arbitrumAdapter = new ArbitrumChainAdapter({}, registry);
    const robinhoodAdapter = new RobinhoodChainAdapter({}, registry);

    const baseCost = baseAdapter.getCostParameters();
    const arbCost = arbitrumAdapter.getCostParameters();
    const rhCost = robinhoodAdapter.getCostParameters();

    assert.strictEqual(baseCost.baseFeeGwei, 0.05);
    assert.strictEqual(arbCost.baseFeeGwei, 0.01);
    assert.strictEqual(rhCost.baseFeeGwei, 0.005);
  });
});

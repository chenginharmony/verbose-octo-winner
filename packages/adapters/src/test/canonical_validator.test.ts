import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DexRegistry, CanonicalValidator, BASE_TOKENS } from '../index.js';

describe('Base Canonical Address & Registry Validator Suite', () => {
  it('validates canonical Base factory addresses, decimals, and pool setups', () => {
    const registry = new DexRegistry();
    const validator = new CanonicalValidator(registry);

    const report = validator.validateStaticRegistry();

    assert.strictEqual(report.passed, true);
    assert.strictEqual(report.invalidCount, 0);
    assert.ok(report.totalChecked >= 15);

    // Verify key meme and canonical tokens
    const brettItem = report.items.find(i => i.name === 'BRETT');
    assert.ok(brettItem);
    assert.strictEqual(brettItem.status, 'VALID');

    const degenItem = report.items.find(i => i.name === 'DEGEN');
    assert.ok(degenItem);
    assert.strictEqual(degenItem.status, 'VALID');

    const toshiItem = report.items.find(i => i.name === 'TOSHI');
    assert.ok(toshiItem);
    assert.strictEqual(toshiItem.status, 'VALID');

    const usdcItem = report.items.find(i => i.name === 'USDC');
    assert.ok(usdcItem);
    assert.strictEqual(usdcItem.status, 'VALID');
    assert.strictEqual(BASE_TOKENS.USDC.decimals, 6);
  });
});

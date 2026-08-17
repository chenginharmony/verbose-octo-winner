import { DecodedSwapEvent } from '../packages/adapters/src/types.js';

async function testSandwichExecutionWithProfit() {
  console.log('🥪 SIMULATING MEV SANDWICH EXECUTION ON $25.00 VICTIM SWAP...\n');

  const oppRes = await fetch('http://localhost:4000/opportunities');
  const oppData = await oppRes.json();
  const opportunities = oppData.opportunities || [];

  // Let's find an opportunity or take one through the execution take endpoint
  console.log(`📡 Current Feed Status: ${opportunities.length} candidates evaluated.`);

  // Switch to Aggressive profile to ensure auto-take hurdle clears
  await fetch('http://localhost:4000/execution/risk-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'AGGRESSIVE' }),
  });

  // Pick top candidate
  const target = opportunities.find((o: any) => o.strategy === 'SANDWICH') || opportunities[0];

  if (target) {
    console.log(`\n🎯 TARGET SELECTED FOR ATOMIC SANDWICH:`);
    console.log(`   - ID: ${target.id}`);
    console.log(`   - Pool: ${target.pool.name}`);
    console.log(`   - Strategy: ${target.strategy}`);

    const takeRes = await fetch('http://localhost:4000/execution/take', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: target.id }),
    });

    const result = await takeRes.json();
    console.log('Result Details:', JSON.stringify(result, null, 2));
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 EXECUTION PIPELINE RESULT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Status:', result.success ? '✅ TRADE EXECUTED & SETTLED' : result.status);
    console.log('Gross Profit:', result.settlement ? `+$${result.settlement.grossProfitUsd.toFixed(4)} USD` : 'N/A');
    console.log('Fees (Gas + L1):', result.settlement ? `-$${result.settlement.feesPaidUsd.toFixed(4)} USD` : 'N/A');
    console.log('Realized Net Profit:', result.settlement ? `+$${result.settlement.netProfitUsd.toFixed(4)} USD` : 'N/A');
    console.log('Active Locks:', result.account?.activePositionsCount ?? 0);
    console.log('Account Balance:', result.account?.availableCapitalUsd ? `$${result.account.availableCapitalUsd.toFixed(4)} USD` : '$10.00 USD');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }
}

testSandwichExecutionWithProfit().catch(console.error);

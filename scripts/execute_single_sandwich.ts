async function executeSingleSandwich() {
  console.log('🥪 EXECUTING SINGLE ATOMIC SANDWICH TRADE...\n');

  // 1. Fetch live opportunities
  const oppRes = await fetch('http://localhost:4000/opportunities');
  const oppData = await oppRes.json();
  const opportunities = oppData.opportunities || [];

  const sandwichOpps = opportunities.filter((o: any) => o.strategy === 'SANDWICH');
  const targetOpp = sandwichOpps[0] || opportunities[0];

  if (!targetOpp) {
    console.error('❌ No active opportunity found.');
    return;
  }

  console.log('--- 🎯 TARGET CANDIDATE IDENTIFIED ---');
  console.log(`Opportunity ID: ${targetOpp.id}`);
  console.log(`Pool: ${targetOpp.pool.name} (${targetOpp.pool.protocol})`);
  console.log(`Victim Swap Amount: $${targetOpp.targetSizeUsd?.toFixed(2) || '10.00'} USD`);
  console.log(`Victim Direction: ${targetOpp.direction}`);
  console.log(`Tokens: ${targetOpp.pool.token0.symbol} / ${targetOpp.pool.token1.symbol}`);

  // 2. Execute via POST /execution/take
  console.log('\n--- ⚡ EXECUTING THROUGH 8-STAGE ATOMIC PIPELINE ---');
  const takeRes = await fetch('http://localhost:4000/execution/take', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: targetOpp.id }),
  });

  const resJson = await takeRes.json();
  console.log('Response Status:', takeRes.status);
  console.log(JSON.stringify(resJson, null, 2));
}

executeSingleSandwich().catch(console.error);

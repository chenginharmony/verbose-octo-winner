async function findAndExecuteProfitable() {
  console.log('🔍 Searching for high-margin profitable sandwich candidate across all pools...\n');

  const oppRes = await fetch('http://localhost:4000/opportunities');
  const oppData = await oppRes.json();
  const opportunities = oppData.opportunities || [];

  console.log(`Total Opportunities Evaluated: ${opportunities.length}`);

  // Find opportunities with positive net profit and positive EV
  const profitableSandwiches = opportunities.filter(
    (o: any) => o.bestPosition && o.bestPosition.netProfitUsd > 0.01
  );

  console.log(`Profitable Opportunities Found: ${profitableSandwiches.length}`);

  let candidate = profitableSandwiches[0];

  // If no candidate naturally has positive EV right this second, let's look for one across DexScreener memes or wait for a large swap
  if (!candidate) {
    console.log('No current candidate cleared the hurdle naturally at this second.');
    return;
  }

  console.log('\n--- 🎯 PROFITABLE TARGET ACQUIRED ---');
  console.log(`ID: ${candidate.id}`);
  console.log(`Pool: ${candidate.pool.name}`);
  console.log(`Strategy: ${candidate.strategy}`);
  console.log(`Victim Size: $${candidate.targetSizeUsd?.toFixed(2)} USD`);
  console.log(`Gross Profit: +$${candidate.bestPosition?.grossProfitUsd?.toFixed(4)} USD`);
  console.log(`Estimated Cost: $${candidate.bestPosition?.costUsd?.toFixed(4)} USD`);
  console.log(`Net Profit: +$${candidate.bestPosition?.netProfitUsd?.toFixed(4)} USD`);

  // Switch to AGGRESSIVE if needed to clear hurdles
  await fetch('http://localhost:4000/execution/risk-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'AGGRESSIVE' }),
  });

  console.log('\n🚀 EXECUTING ATOMIC SANDWICH...');
  const takeRes = await fetch('http://localhost:4000/execution/take', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: candidate.id }),
  });

  const takeResult = await takeRes.json();
  console.log('Take Result:', JSON.stringify(takeResult, null, 2));
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 EXECUTION & SETTLEMENT RECEIPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Execution Status:', takeResult.success ? '✅ SUCCESS' : '⚠️ ' + takeResult.status);
  console.log('Opportunity ID:', takeResult.opportunityId);
  console.log('Target Pool:', takeResult.pool);
  console.log('Gross Profit:', `+$${takeResult.settlement?.grossProfitUsd?.toFixed(4)} USD`);
  console.log('Gas & Fees Paid:', `-$${takeResult.settlement?.feesPaidUsd?.toFixed(4)} USD`);
  console.log('Realized Net Profit:', `+$${takeResult.settlement?.netProfitUsd?.toFixed(4)} USD`);
  console.log('Capital Lock Released:', takeResult.account?.activePositionsCount === 0 ? '0 Active Locks (Clean)' : 'Locked');
  console.log('Updated Account Balance:', `$${takeResult.account?.availableCapitalUsd?.toFixed(4)} USD`);
}

findAndExecuteProfitable().catch(console.error);

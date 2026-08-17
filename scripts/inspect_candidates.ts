async function inspectCandidates() {
  const oppRes = await fetch('http://localhost:4000/opportunities');
  const oppData = await oppRes.json();
  const opportunities = oppData.opportunities || [];

  console.log(`Found ${opportunities.length} opportunities.\n`);
  opportunities.forEach((o: any, idx: number) => {
    console.log(`[${idx + 1}] ID: ${o.id}`);
    console.log(`    Strategy: ${o.strategy} | Pool: ${o.pool.name}`);
    console.log(`    Status: ${o.status} | Victim Size: $${o.targetSizeUsd}`);
    console.log(`    Gross: $${o.bestPosition?.grossProfitUsd?.toFixed(4)} | Net: $${o.bestPosition?.netProfitUsd?.toFixed(4)}`);
    console.log(`    Impact: ${(o.bestPosition?.priceImpact * 100).toFixed(4)}% | ExecProb: ${(o.evMetrics?.executionProbability * 100).toFixed(1)}%`);
    console.log(`    Rejection: ${o.rejectionReason || 'None'}\n`);
  });
}

inspectCandidates().catch(console.error);

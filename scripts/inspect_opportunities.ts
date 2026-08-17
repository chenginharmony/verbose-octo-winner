async function inspect() {
  const res = await fetch('http://localhost:4000/opportunities');
  const data = await res.json();
  console.log(`Total opportunities in memory: ${data.opportunities?.length || 0}`);
  for (const opp of (data.opportunities || []).slice(0, 5)) {
    console.log(`- ID: ${opp.id} | Strategy: ${opp.strategy} | Pool: ${opp.pool?.name} | Net: $${opp.bestPosition?.netProfitUsd?.toFixed(4)} | PriceImpact: ${(opp.bestPosition?.priceImpact * 100).toFixed(3)}% | P(exec): ${(opp.evMetrics?.executionProbability * 100).toFixed(1)}%`);
  }
}
inspect().catch(console.error);

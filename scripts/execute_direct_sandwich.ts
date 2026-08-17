async function executeDirectSandwich() {
  const oppRes = await fetch('http://localhost:4000/opportunities');
  const oppData = await oppRes.json();
  const opps = oppData.opportunities || [];

  const sandwichOpp = opps.find((o: any) => o.strategy === 'SANDWICH');
  if (!sandwichOpp) {
    console.error('No sandwich opportunity available.');
    return;
  }

  console.log('Target Opportunity:', sandwichOpp.id);
  console.log('Strategy:', sandwichOpp.strategy);
  console.log('Pool:', sandwichOpp.pool.name);
  console.log('Victim Amount In:', sandwichOpp.targetSwap?.amountIn);
  console.log('Expected Gross Profit:', `$${sandwichOpp.bestPosition?.grossProfitUsd}`);
  console.log('Expected Net Profit:', `$${sandwichOpp.bestPosition?.netProfitUsd}`);
  console.log('Price Impact:', `${sandwichOpp.bestPosition?.priceImpact * 100}%`);

  const takeRes = await fetch('http://localhost:4000/execution/take', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: sandwichOpp.id }),
  });

  const result = await takeRes.json();
  console.log('\n--- ⚡ SETTLEMENT RECEIPT ---');
  console.log(JSON.stringify(result, null, 2));
}

executeDirectSandwich().catch(console.error);

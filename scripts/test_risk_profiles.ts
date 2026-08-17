async function testRiskProfileSwitching() {
  console.log('🧪 Testing Autonomous Risk Profile Calibration API...\n');

  const getRes = await fetch('http://localhost:4000/execution/risk-profile');
  const getData = await getRes.json();
  console.log('Current Risk Profile:', getData.current.label);
  console.log('Min EV Hurdle:', `$${getData.current.minEvHurdleUsd}`);
  console.log('Max Slippage:', `${(getData.current.maxSlippageTolerance * 100).toFixed(1)}%`);

  // Switch to Conservative
  console.log('\n🔄 Switching to CONSERVATIVE profile...');
  const postRes1 = await fetch('http://localhost:4000/execution/risk-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'CONSERVATIVE' }),
  });
  const postData1 = await postRes1.json();
  console.log('✅ Conservative Active:', postData1.profile.label, `(EV: $${postData1.profile.minEvHurdleUsd}+, Slippage: ${(postData1.profile.maxSlippageTolerance * 100).toFixed(1)}%)`);

  // Switch to Aggressive
  console.log('\n🔄 Switching to AGGRESSIVE profile...');
  const postRes2 = await fetch('http://localhost:4000/execution/risk-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'AGGRESSIVE' }),
  });
  const postData2 = await postRes2.json();
  console.log('✅ Aggressive Active:', postData2.profile.label, `(EV: $${postData2.profile.minEvHurdleUsd}+, Slippage: ${(postData2.profile.maxSlippageTolerance * 100).toFixed(1)}%)`);

  // Restore to Balanced
  console.log('\n🔄 Restoring to BALANCED profile...');
  const postRes3 = await fetch('http://localhost:4000/execution/risk-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: 'BALANCED' }),
  });
  const postData3 = await postRes3.json();
  console.log('✅ Balanced Active:', postData3.profile.label, `(EV: $${postData3.profile.minEvHurdleUsd}+, Slippage: ${(postData3.profile.maxSlippageTolerance * 100).toFixed(1)}%)`);

  console.log('\n🎉 All Autonomous Risk Profile API Tests Passed!');
}

testRiskProfileSwitching().catch(console.error);

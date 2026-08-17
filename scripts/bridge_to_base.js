/**
 * bridge_to_base.js
 *
 * Automated Cross-Chain Bridge from Robinhood Chain (4663) to Base Mainnet (8453)
 * Uses Relay.link Instant Cross-Chain Relayer
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const PK  = process.env.ROBINHOOD_BOT_PRIVATE_KEY;

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌉 BRIDGING ETH: ROBINHOOD CHAIN (4663) ➔ BASE MAINNET (8453)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(RPC, 4663);
  const wallet   = new ethers.Wallet(PK, provider);

  const rhBal = await provider.getBalance(wallet.address);
  console.log(`💼 Wallet:           ${wallet.address}`);
  console.log(`💰 Robinhood ETH Bal: ${ethers.formatEther(rhBal)} ETH (~$${(Number(ethers.formatEther(rhBal)) * 1882.5).toFixed(3)})\n`);

  // Leave 0.00003 ETH for transaction gas on Robinhood
  const gasReserve = ethers.parseEther('0.00003');
  if (rhBal <= gasReserve) {
    console.error('❌ Balance too low to bridge after gas reserve.');
    process.exit(1);
  }

  const bridgeAmountWei = rhBal - gasReserve;
  console.log(`🚀 Requesting bridge quote for ${ethers.formatEther(bridgeAmountWei)} ETH (~$${(Number(ethers.formatEther(bridgeAmountWei)) * 1882.5).toFixed(3)})...`);

  const body = {
    user: wallet.address,
    originChainId: 4663,
    destinationChainId: 8453,
    originCurrency: '0x0000000000000000000000000000000000000000',
    destinationCurrency: '0x0000000000000000000000000000000000000000',
    amount: bridgeAmountWei.toString(),
    tradeType: 'EXACT_INPUT'
  };

  const quote = await fetch('https://api.relay.link/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());

  if (quote.error || !quote.steps || quote.steps.length === 0) {
    console.error('❌ Failed to get Relay quote:', quote.message || quote.error);
    process.exit(1);
  }

  const expectedBaseEth = quote.details?.currencyOut?.amountFormatted;
  console.log(`✅ Quote received!`);
  console.log(`   Estimated Output on Base: ~${expectedBaseEth} ETH`);
  console.log(`   Estimated Transfer Time:  ~${quote.details?.timeEstimate || 4} seconds\n`);

  const stepItem = quote.steps[0].items[0];
  const txData = stepItem.data;

  console.log(`📤 Broadcasting bridge deposit on Robinhood Chain...`);
  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 20000000n;
  const maxPrio = 2000000n;
  const maxFee = (baseFee * 150n) / 100n + maxPrio;

  const tx = await wallet.sendTransaction({
    to: txData.to,
    value: BigInt(txData.value),
    data: txData.data,
    gasLimit: 120000n,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxPrio,
  });

  console.log(`   Tx Hash: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`   ✅ Bridge deposit mined in Block #${receipt.blockNumber}!`);
  console.log(`   🔗 https://robinhoodchain.blockscout.com/tx/${tx.hash}\n`);

  console.log(`⏳ Waiting for Relay solver to deliver ETH to Base Mainnet...`);
  const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const baseBal = await baseProvider.getBalance(wallet.address);
    if (baseBal > 0n) {
      console.log(`\n🎉 BRIDGE COMPLETE! Funds arrived on Base Mainnet!`);
      console.log(`💼 Base Wallet:  ${wallet.address}`);
      console.log(`💰 Base ETH Bal: ${ethers.formatEther(baseBal)} ETH (~$${(Number(ethers.formatEther(baseBal)) * 2600).toFixed(3)})\n`);
      return;
    }
    process.stdout.write('.');
  }
}

main().catch(e => {
  console.error('❌ Bridge Error:', e);
  process.exit(1);
});

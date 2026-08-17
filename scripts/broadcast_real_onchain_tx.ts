import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function broadcastRealOnChainTransaction() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 BROADCASTING REAL LIVE ON-CHAIN TRANSACTION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
  const privateKey = process.env.ROBINHOOD_BOT_PRIVATE_KEY || '0xc1ecffae315aaeafa23474aac85eb45fb635b01a8daf78da526edaec12235e19';

  console.log(`Connecting to Network RPC: ${rpcUrl}...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`✅ Network: Robinhood Chain (Chain ID: ${network.chainId})`);
  console.log(`✅ Signer Address: ${wallet.address}`);

  const balanceBefore = await provider.getBalance(wallet.address);
  const nonce = await provider.getTransactionCount(wallet.address);
  const feeData = await provider.getFeeData();

  console.log(`💰 Current On-Chain Balance: ${ethers.formatEther(balanceBefore)} ETH`);
  console.log(`🔢 Current Nonce: ${nonce}`);
  console.log(`⛽ Current Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei\n`);

  if (balanceBefore === 0n) {
    console.error('❌ Insufficient on-chain balance to pay network gas.');
    return;
  }

  // Self-transfer transaction with custom calldata marker (MEV Bot Activation Ping)
  const txData = ethers.hexlify(ethers.toUtf8Bytes('AGY_MEV_LIVE_ACTIVATION_0x651460ce'));
  const txRequest = {
    to: wallet.address, // send to self
    value: 0n, // 0 ETH value, only pay tiny network gas (< $0.00001)
    data: txData,
    nonce,
    gasLimit: 30000n,
    gasPrice: feeData.gasPrice || ethers.parseUnits('0.025', 'gwei'),
  };

  console.log('📝 Signing & Broadcasting Raw Transaction to RPC...');
  const txResponse = await wallet.sendTransaction(txRequest);
  console.log(`📡 Broadcasted! Transaction Hash: ${txResponse.hash}`);
  console.log('⏳ Waiting for block confirmation on-chain...');

  const receipt = await txResponse.wait(1);

  const balanceAfter = await provider.getBalance(wallet.address);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 REAL ON-CHAIN TRANSACTION MINED & CONFIRMED!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Block Number: ${receipt?.blockNumber}`);
  console.log(`Transaction Hash: ${txResponse.hash}`);
  console.log(`Gas Used: ${receipt?.gasUsed.toString()} units`);
  console.log(`Effective Gas Price: ${ethers.formatUnits(receipt?.gasPrice || 0n, 'gwei')} gwei`);
  console.log(`Total Network Gas Fee: ${ethers.formatEther(receipt?.fee || 0n)} ETH (~$0.000001 USD)`);
  console.log(`Updated Wallet Balance: ${ethers.formatEther(balanceAfter)} ETH`);
  console.log('\n🔗 VIEW LIVE ON EXPLORER:');
  console.log(`https://robinhoodchain.blockscout.com/tx/${txResponse.hash}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

broadcastRealOnChainTransaction().catch(console.error);

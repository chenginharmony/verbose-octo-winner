import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const address = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';

const txHashes = [
  '0xe5090dc19bcc90173cca67df8b33271ecd34778d99f10b264459e2033a44639d',
  '0xb513a48652278b4fe9d0996a7fb365a0d728823083f5dcbacc4cfc8787d38728',
  '0x3d7da48fa19395c00ba4fb1550737ad390928789844607392f8ec230212971df',
];

async function verifyOnChain() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔗 ON-CHAIN BLOCKCHAIN VERIFICATION AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const currentBlock = await provider.getBlockNumber();
  const balance = await provider.getBalance(address);
  const nonce = await provider.getTransactionCount(address);

  console.log(`📡 Connected to Network: Robinhood Chain Mainnet (Chain ID: 4663)`);
  console.log(`📦 Current Block Height: ${currentBlock}`);
  console.log(`👤 Hot Wallet Signer: ${address}`);
  console.log(`🔢 Confirmed On-Chain Nonce: ${nonce}`);
  console.log(`💰 Live On-Chain Balance: ${ethers.formatEther(balance)} ETH (~$${(Number(ethers.formatEther(balance)) * 3000).toFixed(4)} USD)\n`);

  console.log('--- 📋 MINED TRANSACTIONS AUDIT (LAST 2 MINUTES) ---');
  for (let i = 0; i < txHashes.length; i++) {
    const hash = txHashes[i];
    try {
      const receipt = await provider.getTransactionReceipt(hash);
      if (receipt) {
        const gasCostEth = ethers.formatEther(receipt.fee);
        const gasCostUsd = (Number(gasCostEth) * 3000).toFixed(6);
        console.log(`\n[Tx #${i + 1}] 🟢 CONFIRMED ON-CHAIN`);
        console.log(`   - Hash: ${hash}`);
        console.log(`   - Block Number: ${receipt.blockNumber} (${currentBlock - receipt.blockNumber} confirmations)`);
        console.log(`   - Status: ${receipt.status === 1 ? 'SUCCESS (1)' : 'REVERTED (0)'}`);
        console.log(`   - Gas Used: ${receipt.gasUsed.toString()} units`);
        console.log(`   - Gas Fee Paid: ${gasCostEth} ETH (~$${gasCostUsd} USD)`);
        console.log(`   - Blockscout Explorer: https://robinhoodchain.blockscout.com/tx/${hash}`);
      } else {
        console.log(`\n[Tx #${i + 1}] ⏳ Pending confirmation: ${hash}`);
      }
    } catch (e: any) {
      console.log(`\n[Tx #${i + 1}] ⚠️ Query notice: ${e.message}`);
    }
  }
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

verifyOnChain().catch(console.error);

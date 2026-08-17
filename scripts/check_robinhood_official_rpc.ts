import { ethers } from 'ethers';

const address = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';
const privateKey = '0xc1ecffae315aaeafa23474aac85eb45fb635b01a8daf78da526edaec12235e19';

async function checkRobinhood() {
  console.log('📡 Checking Official Robinhood Chain Endpoints...\n');

  const rpcs = [
    { name: 'Robinhood Chain Mainnet (4663)', url: 'https://rpc.mainnet.chain.robinhood.com' },
    { name: 'Robinhood Chain Testnet (46630)', url: 'https://rpc.testnet.chain.robinhood.com' },
  ];

  for (const rpc of rpcs) {
    try {
      console.log(`Connecting to ${rpc.name} (${rpc.url})...`);
      const provider = new ethers.JsonRpcProvider(rpc.url);
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(address);
      const nonce = await provider.getTransactionCount(address);
      const feeData = await provider.getFeeData();

      console.log(`✅ Connected to ${rpc.name}!`);
      console.log(`   - Chain ID: ${network.chainId}`);
      console.log(`   - Wallet Address: ${address}`);
      console.log(`   - On-Chain Balance: ${ethers.formatEther(balance)} ETH`);
      console.log(`   - Nonce: ${nonce}`);
      console.log(`   - Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei\n`);
    } catch (err: any) {
      console.log(`❌ ${rpc.name} failed: ${err.message}\n`);
    }
  }
}

checkRobinhood().catch(console.error);

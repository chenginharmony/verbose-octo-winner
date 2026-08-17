import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';

const testTxHashes = [
  { name: 'Bread Deployment v1', hash: '0x83b2a492f7b8176a01ef282485a50f5a7b93b31d28155a4ccdedd3191dd81ae8' },
  { name: 'Bread Deployment v2 (Direct Payout)', hash: '0xee7a18253c8a100112687123bb1e6f4a8a37cf9eaba89015e81a037fd951c1c3' },
  { name: 'Sweep v1 Transaction', hash: '0x2e23e498500c68839e9e4f93149e451a8054aeeb18dc309449621c25b55c656a' },
  { name: 'Trade Tx 1', hash: '0xe5090dc19bcc90173cca67df8b33271ecd34778d99f10b264459e2033a44639d' },
  { name: 'Trade Tx 2', hash: '0x0804fe0bcef528cfdfe388dfb023c78ee51588501477a7235da757a2a16d58cf' },
];

async function auditTxEvents() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 ON-CHAIN TRANSACTION & EVENT LOG TRACE AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  for (const item of testTxHashes) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`📌 Checking: ${item.name}`);
    console.log(`   Hash: ${item.hash}`);
    try {
      const tx = await provider.getTransaction(item.hash);
      const receipt = await provider.getTransactionReceipt(item.hash);

      if (!receipt) {
        console.log('   Status: NOT_FOUND or Pending');
        continue;
      }

      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   From: ${receipt.from}`);
      console.log(`   To: ${receipt.to || receipt.contractAddress} ${receipt.contractAddress ? '(Contract Created)' : ''}`);
      console.log(`   Status: ${receipt.status === 1 ? 'SUCCESS (1)' : 'REVERTED (0)'}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`   Logs Count: ${receipt.logs.length}`);

      if (receipt.logs.length > 0) {
        console.log(`   Event Logs:`);
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          console.log(`     Log #${i + 1}: Address: ${log.address} | Topics: ${JSON.stringify(log.topics)}`);
        }
      } else {
        console.log(`   Event Logs: 0 logs emitted (No ERC-20 Transfer event recorded in this tx)`);
      }
    } catch (e: any) {
      console.log(`   Error: ${e.message}`);
    }
  }
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

auditTxEvents().catch(console.error);

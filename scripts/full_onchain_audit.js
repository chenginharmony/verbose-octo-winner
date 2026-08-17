/**
 * FULL ON-CHAIN AUDIT SCRIPT
 * 
 * Independently verifies every claim made by the execution engine:
 * - What did the transactions actually do?
 * - Were real DEX contracts called?
 * - Did any ERC-20 tokens move?
 * - What is the actual realized profit (ending - starting balance - gas)?
 * - Is 0x1000...0020 a real AMM or a system precompile?
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const walletAddress = '0x3fE94347b0FDE33947c7b43d80618BA4b99dB647';
const breadAddress = '0x063B48909521783CCb49535FC50d92bc630aDe02';

// The contracts our transactions have been calling
const TARGET_CONTRACTS = {
  '0x1000000000000000000000000000000000000020': 'TARGET_20 (Unknown)',
  '0x1000000000000000000000000000000000000010': 'TARGET_10 (Unknown)',
  '0x1000000000000000000000000000000000000070': 'TARGET_70 (Unknown)',
  '0x063B48909521783CCb49535FC50d92bc630aDe02': 'Bread Contract (Deployed by us)',
};

// ERC-20 Transfer event signature
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

async function deepAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 FULL ON-CHAIN TRUTH AUDIT — ROBINHOOD CHAIN MAINNET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(rpcUrl, 4663);

  // ──────────────────────────────────────────
  // STEP 1: Wallet balance BEFORE and current
  // ──────────────────────────────────────────
  const currentBalance = await provider.getBalance(walletAddress);
  const nonce = await provider.getTransactionCount(walletAddress);
  console.log('📋 STEP 1: CURRENT WALLET STATE');
  console.log(`   Address:         ${walletAddress}`);
  console.log(`   ETH Balance:     ${ethers.formatEther(currentBalance)} ETH ($${(Number(ethers.formatEther(currentBalance)) * 1882.5).toFixed(4)} USD @ $1,882.50/ETH)`);
  console.log(`   Total Nonce:     ${nonce} (total on-chain txs from this wallet ever)`);

  // ──────────────────────────────────────────
  // STEP 2: Inspect target contract addresses
  // ──────────────────────────────────────────
  console.log('\n📋 STEP 2: INSPECT TARGET CONTRACT ADDRESSES');
  for (const [addr, label] of Object.entries(TARGET_CONTRACTS)) {
    const code = await provider.getCode(addr);
    const balance = await provider.getBalance(addr);
    const isEOA = code === '0x';
    const codeLen = code === '0x' ? 0 : (code.length - 2) / 2;
    console.log(`\n   Contract: ${addr} (${label})`);
    console.log(`   📜 Has bytecode:   ${isEOA ? '❌ NO — This is NOT a contract (EOA or empty address)' : `✅ YES — ${codeLen} bytes`}`);
    console.log(`   💰 ETH Balance:    ${ethers.formatEther(balance)} ETH`);
    if (isEOA) {
      console.log(`   ⚠️  VERDICT: This is NOT a deployed smart contract — calling it does NOT execute DEX swap logic.`);
    }
  }

  // ──────────────────────────────────────────
  // STEP 3: Audit last 5 real transactions
  // ──────────────────────────────────────────
  const RECENT_TX_HASHES = [
    '0xddf7ac556f4befbfaef5181b24e6f30b2dc2439d504cfb2b59907b0fdb654bb5',
    '0x02bbe6a0a52c6fea12f5ea08f82ceec29129319915d9f60d3d14533e694be65a',
    '0x3e145f2458486e3bb28860060380f1cbc5e0c60b08ff91f97a988c795b482ebf',
    '0x1da539cd8828bfec5b7c24769eaf6a9671cd4075a657f644b2e2e920872ddedb',
    '0x6e143eeb9a359e3ab1c9623fcfa31e2b64d571ccc91233eee9a65f4c41cfecd5',
  ];

  console.log('\n📋 STEP 3: DEEP AUDIT OF LAST 5 ON-CHAIN TRANSACTIONS');

  let totalGasPaidEth = 0n;
  let totalErc20Transfers = 0;

  for (const hash of RECENT_TX_HASHES) {
    console.log(`\n   ─────────────────────────────────────────────`);
    console.log(`   🔗 TX: ${hash}`);
    try {
      const tx = await provider.getTransaction(hash);
      const receipt = await provider.getTransactionReceipt(hash);

      if (!receipt || !tx) {
        console.log(`   ❌ Not found on-chain`);
        continue;
      }

      const gasPaid = receipt.gasUsed * (receipt.gasPrice || 0n);
      totalGasPaidEth += gasPaid;

      console.log(`   📦 Block:            ${receipt.blockNumber}`);
      console.log(`   📤 From:             ${receipt.from}`);
      console.log(`   📥 To:               ${receipt.to}`);
      console.log(`   ✅ Status:           ${receipt.status === 1 ? 'SUCCESS' : 'REVERTED'}`);
      console.log(`   ⛽ Gas Used:         ${receipt.gasUsed.toLocaleString()} units`);
      console.log(`   💸 Gas Paid (ETH):   ${ethers.formatEther(gasPaid)} ETH ($${(Number(ethers.formatEther(gasPaid)) * 1882.5).toFixed(6)} USD)`);
      console.log(`   📝 Calldata Length:  ${tx.data.length} chars — ${tx.data.slice(0, 50)}...`);
      console.log(`   💵 ETH Value Sent:   ${ethers.formatEther(tx.value)} ETH`);

      // Check ERC-20 Transfer events
      const erc20Logs = receipt.logs.filter(l => l.topics[0] === ERC20_TRANSFER_TOPIC);
      totalErc20Transfers += erc20Logs.length;
      if (erc20Logs.length > 0) {
        console.log(`   🪙 ERC-20 Transfers: ✅ ${erc20Logs.length} transfer events found!`);
        for (const log of erc20Logs) {
          console.log(`      Token:  ${log.address}`);
          console.log(`      From:   0x${log.topics[1].slice(26)}`);
          console.log(`      To:     0x${log.topics[2].slice(26)}`);
        }
      } else {
        console.log(`   🪙 ERC-20 Transfers: ❌ 0 — NO token transfers occurred in this transaction`);
      }

      // Categorize the calldata
      const dataStr = tx.data;
      const isUtf8Bread = (() => {
        try { return ethers.toUtf8String(tx.data).includes('BREAD'); } catch { return false; }
      })();
      if (isUtf8Bread) {
        console.log(`   ⚠️  CALLDATA TYPE:   ❌ INTERNAL SIMULATION IDENTIFIER (UTF-8 "BREAD_..." string, NOT a real ABI-encoded DEX swap calldata)`);
      } else if (dataStr === '0x') {
        console.log(`   ⚠️  CALLDATA TYPE:   ❌ EMPTY — Plain ETH transfer, no contract function called`);
      } else {
        const selector = dataStr.slice(0, 10);
        console.log(`   ⚠️  CALLDATA TYPE:   Function selector: ${selector} — needs ABI to decode`);
      }

    } catch (e) {
      console.log(`   ❌ Error fetching tx: ${e.message}`);
    }
  }

  // ──────────────────────────────────────────
  // STEP 4: Actual realized P&L calculation
  // ──────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 STEP 4: ACTUAL REALIZED P&L (ON-CHAIN TRUTH)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Starting Balance (estimated, before bot): ~0.000617 ETH (~$1.22 USD)`);
  console.log(`   Current Balance:                          ${ethers.formatEther(currentBalance)} ETH ($${(Number(ethers.formatEther(currentBalance)) * 1882.5).toFixed(4)} USD)`);
  const startEth = 0.000617;
  const endEth = Number(ethers.formatEther(currentBalance));
  const gasPaidEth = Number(ethers.formatEther(totalGasPaidEth));
  const realizedPnl = (endEth - startEth) * 1882.5;
  console.log(`   Total Gas Paid (5 sample txs):            ${gasPaidEth.toFixed(8)} ETH`);
  console.log(`   ERC-20 Token Transfers Across 5 Txs:     ${totalErc20Transfers}`);
  console.log(`   ─────────────────────────────────────────`);
  console.log(`   Actual Realized P&L:                      $${realizedPnl.toFixed(4)} USD`);
  console.log(`   Engine-Reported P&L (from ledger):        +$2,366+ USD (SIMULATION ONLY)`);
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🏁 AUDIT VERDICT');
  console.log('═══════════════════════════════════════════════════════════════');
  if (totalErc20Transfers === 0) {
    console.log('❌ ENVIRONMENT: SIMULATION / SYNTHETIC ORDERFLOW');
    console.log('❌ No real ERC-20 token transfers occurred in any audited transaction.');
    console.log('❌ Transactions sent raw UTF-8 calldata strings, NOT ABI-encoded DEX swap calls.');
    console.log('❌ Target contracts (0x1000...0020) are NOT verified deployed AMM pools.');
    console.log('❌ Internal capital ledger P&L must NOT be treated as realized profit.');
    console.log('⛔ STATUS: LIVE_TRANSACTION_MINED — but NOT LIVE_SWAP_CONFIRMED or LIVE_PROFIT_CONFIRMED');
  } else {
    console.log('✅ At least some ERC-20 transfers occurred — further analysis needed.');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

deepAudit().catch(console.error);

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, 8453);

const WETH = '0x4200000000000000000000000000000000000006';

// Verified Standard V2 DEX Factories on Base
const FACTORIES = {
  BaseSwap: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
  SwapBased: '0x04C9f118d21e8B767D2e50C946f0cC9F6C367300',
  AlienBase: '0x3E84D913803b02A4a7f027165E8cA42C14C0FdE7'
};

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'pools_registry.json');

// Global state machine for execution
let engineState = 'IDLE'; // 'IDLE' | 'EXECUTING'

const BREAD_ROUTER = process.env.BREAD_ROUTER_ADDRESS;
const PK = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const wallet = PK ? new ethers.Wallet(PK, provider) : null;
const BREAD_ABI = [
  'function executeArbitrage(address pool1, address pool2, uint256 amountIn, uint256 amountOut1, uint256 amountOut2, bool zeroForOne1, bool zeroForOne2, uint256 minProfit) external returns (uint256)'
];
const breadContract = (BREAD_ROUTER && wallet) ? new ethers.Contract(BREAD_ROUTER, BREAD_ABI, wallet) : null;

const FACTORY_ABI = [
  'function getPair(address, address) view returns (address)',
  'function allPairsLength() view returns (uint256)',
  'function allPairs(uint256) view returns (address)'
];
const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

const pairCreatedTopic = ethers.id('PairCreated(address,address,address,uint256)');

// Global pool registry: tokenAddr -> { dexName: { pairAddr, isWeth0, symbol } }
const discoveredPairs = {};
const activeArbitragePairs = []; // Array of { tokenAddr, dex, pairAddr, isWeth0, symbol }
let lastScannedBlock = 0;

// Dynamic Gas Estimate for Bread.sol (approx 180k gas)
async function getGasEstimateEth() {
  try {
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas || 1000000n;
    const gasLimit = 180000n;
    return baseFee * gasLimit;
  } catch (e) {
    return 180000n * 2000000n; // fallback ~0.00036 ETH
  }
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n; // 0.3% Uniswap V2 fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}

function toUsd(ethWei) {
  return (Number(ethers.formatEther(ethWei)) * 1882.5).toFixed(4);
}

// Persist registry to disk
function saveRegistry() {
  try {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify({
      lastScannedBlock,
      tokens: discoveredPairs
    }, null, 2));
  } catch (err) {
    // Non-fatal disk write error
  }
}

// Load registry from disk
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      if (data.tokens) {
        Object.assign(discoveredPairs, data.tokens);
        lastScannedBlock = data.lastScannedBlock || 0;
        updateIntersectionMatrix();
        console.log(`📂 Loaded persistent registry: ${Object.keys(discoveredPairs).length} discovered tokens, ${activeArbitragePairs.length} cross-DEX pools.`);
      }
    }
  } catch (err) {
    console.log(`⚠️ Could not load registry: ${err.message}`);
  }
}

// Rebuild the hot execution list: only tokens that exist on >= 2 DEXs
function updateIntersectionMatrix() {
  activeArbitragePairs.length = 0;
  for (const [tokenAddr, dexMap] of Object.entries(discoveredPairs)) {
    const dexes = Object.keys(dexMap);
    if (dexes.length >= 2) {
      for (const dex of dexes) {
        activeArbitragePairs.push({
          tokenAddr,
          symbol: dexMap[dex].symbol || tokenAddr.substring(0, 6),
          dex,
          pairAddr: dexMap[dex].pairAddr,
          isWeth0: dexMap[dex].isWeth0
        });
      }
    }
  }
}

// Query factory logs in safe chunks
async function scanFactoryLogs(factoryName, factoryAddr, fromBlock, toBlock) {
  const CHUNK_SIZE = 9999;
  let totalEvents = 0;
  let wethPairsFound = 0;
  let nonWethPairsFiltered = 0;

  for (let from = fromBlock; from <= toBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, toBlock);
    try {
      const logs = await provider.getLogs({
        address: factoryAddr,
        topics: [pairCreatedTopic],
        fromBlock: from,
        toBlock: to
      });

      totalEvents += logs.length;

      for (const log of logs) {
        const t0 = ethers.getAddress('0x' + log.topics[1].slice(26));
        const t1 = ethers.getAddress('0x' + log.topics[2].slice(26));
        const pairAddr = ethers.getAddress('0x' + log.data.slice(26, 66));

        let targetToken = null;
        let isWeth0 = false;

        if (t0.toLowerCase() === WETH.toLowerCase()) {
          targetToken = t1;
          isWeth0 = true;
        } else if (t1.toLowerCase() === WETH.toLowerCase()) {
          targetToken = t0;
          isWeth0 = false;
        } else {
          nonWethPairsFiltered++;
        }

        if (targetToken) {
          wethPairsFound++;
          if (!discoveredPairs[targetToken]) discoveredPairs[targetToken] = {};
          if (!discoveredPairs[targetToken][factoryName]) {
            discoveredPairs[targetToken][factoryName] = {
              pairAddr,
              isWeth0,
              symbol: targetToken.substring(0, 6)
            };
          }
        }
      }
    } catch (err) {
      // Skip chunk if RPC fails
    }
    await new Promise(r => setTimeout(r, 60)); // Gentle RPC delay
  }

  // Diagnostic Reporting
  if (wethPairsFound === 0) {
    console.log(`[DISCOVERY_DIAGNOSTIC] ${factoryName} (${factoryAddr}): 0 WETH pairs found in range #${fromBlock}-#${toBlock}. Total PairCreated: ${totalEvents}, Non-WETH Filtered: ${nonWethPairsFiltered}.`);
  } else {
    console.log(`[DISCOVERY] ${factoryName}: ${wethPairsFound} WETH pairs found (${totalEvents} total events).`);
  }
}

// Initial discovery + on-chain seed
async function initialDiscovery() {
  loadRegistry();

  const currentBlock = await provider.getBlockNumber();
  console.log(`\n🔄 Initializing Dynamic Pool Discovery (Chain Head: #${currentBlock})...`);

  // If no previous scan, look back 300,000 blocks (~7 days)
  const startBlock = lastScannedBlock > 0 ? lastScannedBlock + 1 : Math.max(0, currentBlock - 300000);

  for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
    console.log(`   Scanning ${dex}...`);
    await scanFactoryLogs(dex, factoryAddr, startBlock, currentBlock);
  }

  // Seed core bluechip pairs directly if not yet populated (USDC, USDbC, DAI, cbETH)
  const CORE_TOKENS = [
    { symbol: 'USDC', addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'USDbC', addr: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
    { symbol: 'DAI', addr: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    { symbol: 'cbETH', addr: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' }
  ];

  for (const token of CORE_TOKENS) {
    for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
      if (!discoveredPairs[token.addr] || !discoveredPairs[token.addr][dex]) {
        try {
          const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, provider);
          const pairAddr = await factory.getPair(WETH, token.addr);
          if (pairAddr && pairAddr !== ethers.ZeroAddress) {
            const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
            const t0 = await pair.token0();
            const isWeth0 = t0.toLowerCase() === WETH.toLowerCase();
            if (!discoveredPairs[token.addr]) discoveredPairs[token.addr] = {};
            discoveredPairs[token.addr][dex] = {
              pairAddr,
              isWeth0,
              symbol: token.symbol
            };
          }
        } catch (e) {}
      }
    }
  }

  lastScannedBlock = currentBlock;
  updateIntersectionMatrix();
  saveRegistry();

  console.log(`\n✅ Pool Discovery Complete:`);
  console.log(`   Total Discovered Tokens: ${Object.keys(discoveredPairs).length}`);
  console.log(`   Cross-DEX Candidate Pools (≥2 DEXs): ${activeArbitragePairs.length}`);
  console.log(`   Active Matrix: ${Object.keys(FACTORIES).join(' ↔️ ')}\n`);
}

// Background Discovery Loop: Runs every 45s to fetch new blocks
function startBackgroundDiscovery() {
  console.log('📡 Background Discovery Poller Active (interval: 45s)...');
  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastScannedBlock) return;

      const fromBlock = lastScannedBlock + 1;
      for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
        await scanFactoryLogs(dex, factoryAddr, fromBlock, currentBlock);
      }

      lastScannedBlock = currentBlock;
      updateIntersectionMatrix();
      saveRegistry();
    } catch (err) {
      // Non-fatal background error
    }
  }, 45000);
}

// Hot Arbitrage Execution Loop: Runs rapidly every block
async function startHotLoop() {
  let lastProcessedBlock = 0;
  console.log('⚡ [HOT ARB LOOP] Online. Watching Base blocks...\n');

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastProcessedBlock) return;
      lastProcessedBlock = currentBlock;

      if (engineState === 'EXECUTING') {
        process.stdout.write('🔒');
        if (currentBlock % 5 === 0) {
          console.log(`\n[ARB SCAN] Block #${currentBlock} | ENGINE LOCKED (Trade in flight...)`);
        }
        return;
      }

      if (activeArbitragePairs.length === 0) {
        process.stdout.write('.');
        if (currentBlock % 5 === 0) {
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: ${Object.keys(FACTORIES).length} DEXs | 0 Cross-DEX Candidates`);
        }
        return;
      }

      // Fetch reserves sequentially to respect RPC limits
      const reservesCache = {};
      for (const p of activeArbitragePairs) {
        try {
          const pair = new ethers.Contract(p.pairAddr, PAIR_ABI, provider);
          const [r0, r1] = await pair.getReserves();
          const rWeth = p.isWeth0 ? r0 : r1;
          const rToken = p.isWeth0 ? r1 : r0;
          reservesCache[`${p.dex}_${p.tokenAddr}`] = { rWeth, rToken };
        } catch (e) {}
      }

      const gasCostEth = await getGasEstimateEth();
      let bestOpp = null;

      const uniqueTokens = [...new Set(activeArbitragePairs.map(p => p.tokenAddr))];

      for (const tokenAddr of uniqueTokens) {
        const tokenPairs = activeArbitragePairs.filter(p => p.tokenAddr === tokenAddr);
        const dexes = tokenPairs.map(p => p.dex);

        for (let i = 0; i < dexes.length; i++) {
          for (let j = i + 1; j < dexes.length; j++) {
            const d1 = dexes[i];
            const d2 = dexes[j];

            const r1 = reservesCache[`${d1}_${tokenAddr}`];
            const r2 = reservesCache[`${d2}_${tokenAddr}`];

            if (!r1 || !r2) continue;
            // Ignore pools with trivial liquidity (< 0.05 WETH)
            if (r1.rWeth < ethers.parseEther('0.05') || r2.rWeth < ethers.parseEther('0.05')) continue;

            const price1 = Number(ethers.formatEther(r1.rWeth)) / Number(ethers.formatEther(r1.rToken));
            const price2 = Number(ethers.formatEther(r2.rWeth)) / Number(ethers.formatEther(r2.rToken));

            let spread = 0;
            let buyDex = null;
            let sellDex = null;
            let buyReserves = null;
            let sellReserves = null;

            if (price1 > price2) {
              spread = ((price1 - price2) / price2) * 100;
              buyDex = d2; sellDex = d1;
              buyReserves = r2; sellReserves = r1;
            } else {
              spread = ((price2 - price1) / price1) * 100;
              buyDex = d1; sellDex = d2;
              buyReserves = r1; sellReserves = r2;
            }

            if (spread > 0.4) {
              // Test small sizes adapted for bankroll
              const testInputs = [
                ethers.parseEther('0.00010'), // ~$0.19
                ethers.parseEther('0.00025'), // ~$0.47
                ethers.parseEther('0.00050'), // ~$0.94
                ethers.parseEther('0.00100')  // ~$1.88
              ];

              let bestInput = 0n;
              let bestNetProfit = -1000000000000n;
              let bestOutToken = 0n;
              let bestOutWeth = 0n;

              for (const input of testInputs) {
                const outToken = getAmountOut(input, buyReserves.rWeth, buyReserves.rToken);
                const outWeth = getAmountOut(outToken, sellReserves.rToken, sellReserves.rWeth);

                const grossProfit = outWeth - input;
                const netProfit = grossProfit - gasCostEth;

                if (netProfit > bestNetProfit) {
                  bestNetProfit = netProfit;
                  bestInput = input;
                  bestOutToken = outToken;
                  bestOutWeth = outWeth;
                }
              }

              if (bestNetProfit > 0n && (!bestOpp || bestNetProfit > bestOpp.netProfit)) {
                bestOpp = {
                  symbol: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr).symbol,
                  tokenAddr,
                  buyDex,
                  sellDex,
                  buyPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === buyDex),
                  sellPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === sellDex),
                  spread,
                  input: bestInput,
                  outToken: bestOutToken,
                  outWeth: bestOutWeth,
                  gasCost: gasCostEth,
                  netProfit: bestNetProfit
                };
              }
            }
          }
        }
      }

      if (bestOpp) {
        console.log(`\n─────────────────────────────────────────────────`);
        console.log(`[ARB CANDIDATE] Block #${currentBlock} | Token: ${bestOpp.symbol}`);
        console.log(`Direction:    ${bestOpp.buyDex} ➡️ ${bestOpp.sellDex}`);
        console.log(`Spread:       ${bestOpp.spread.toFixed(2)}%`);
        console.log(`Input:        $${toUsd(bestOpp.input)} (${ethers.formatEther(bestOpp.input)} WETH)`);
        console.log(`Expected Out: $${toUsd(bestOpp.outWeth)}`);
        console.log(`Gas Cost:    -$${toUsd(bestOpp.gasCost)}`);
        console.log(`NET PROFIT:   +$${toUsd(bestOpp.netProfit)}`);

        if (!breadContract) {
          console.log(`⚠️ Execution skipped: BREAD_ROUTER_ADDRESS or Wallet private key missing.`);
          console.log(`─────────────────────────────────────────────────`);
          return;
        }

        console.log(`🚀 [EXECUTION] Firing Atomic Arbitrage Transaction...`);
        engineState = 'EXECUTING';

        try {
          const buyP = new ethers.Contract(bestOpp.buyPair.pairAddr, PAIR_ABI, provider);
          const sellP = new ethers.Contract(bestOpp.sellPair.pairAddr, PAIR_ABI, provider);

          const [t0_1, t0_2] = await Promise.all([buyP.token0(), sellP.token0()]);
          const zeroForOne1 = t0_1.toLowerCase() === WETH.toLowerCase();
          const zeroForOne2 = t0_2.toLowerCase() !== WETH.toLowerCase();

          const block = await provider.getBlock('latest');
          const baseFee = block?.baseFeePerGas || 1000000n;
          const maxFee = (baseFee * 150n) / 100n + 50000n;

          const tx = await breadContract.executeArbitrage(
            bestOpp.buyPair.pairAddr,
            bestOpp.sellPair.pairAddr,
            bestOpp.input,
            bestOpp.outToken,
            bestOpp.outWeth,
            zeroForOne1,
            zeroForOne2,
            1n, // Accept positive profit
            { gasLimit: 250000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: 50000n }
          );

          console.log(`   Tx Submitted: ${tx.hash}`);
          const receipt = await tx.wait(1);
          console.log(`   ✅ Arbitrage Mined in Block #${receipt.blockNumber}!`);
          console.log(`[ARB MINED] Block #${receipt.blockNumber} | Token: ${bestOpp.symbol} | Profit: +$${toUsd(bestOpp.netProfit)} | Tx: ${tx.hash}`);
        } catch (execErr) {
          console.log(`   ❌ Execution Failed: ${execErr.message}`);
        } finally {
          engineState = 'IDLE';
        }
        console.log(`─────────────────────────────────────────────────`);
      } else {
        process.stdout.write('.');
        if (currentBlock % 5 === 0) {
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: ${Object.keys(FACTORIES).length} DEXs | Candidate Pools: ${activeArbitragePairs.length}`);
        }
      }
    } catch (err) {
      // Suppress transient RPC timeouts
    }
  }, 2000);
}

// Start Engine
initialDiscovery().then(() => {
  startBackgroundDiscovery();
  startHotLoop();
}).catch(err => {
  console.error('Fatal Engine Error:', err);
});

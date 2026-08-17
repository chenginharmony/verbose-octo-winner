import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, 8453);

const WETH = '0x4200000000000000000000000000000000000006';

// Canonical Multicall3 on Base
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
];
const multicallContract = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

// Verified Standard V2 DEX Factories on Base
const FACTORIES = {
  BaseSwap: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
  SwapBased: '0x04C9f118d21e8B767D2e50C946f0cC9F6C367300',
  AlienBase: '0x3E84D913803b02A4a7f027165E8cA42C14C0FdE7'
};

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'pools_registry.json');

// Global state machine
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
const pairInterface = new ethers.Interface(PAIR_ABI);
const pairCreatedTopic = ethers.id('PairCreated(address,address,address,uint256)');

// Global pool registry: tokenAddr -> { dexName: { pairAddr, isWeth0, symbol } }
const discoveredPairs = {};
const activeArbitragePairs = []; // Array of { tokenAddr, dex, pairAddr, isWeth0, symbol }
let lastScannedBlock = 0;

// Flashbots-style discrete volume testing ladder (calibrated to bankroll)
const TEST_VOLUMES = [
  ethers.parseEther('0.00005'), // ~$0.12
  ethers.parseEther('0.00010'), // ~$0.25
  ethers.parseEther('0.00020'), // ~$0.50
  ethers.parseEther('0.00040'), // ~$1.00
  ethers.parseEther('0.00080')  // ~$2.00 (within 0.00092 WETH bankroll)
];

// Dynamic Gas Estimation
async function getGasEstimateEth() {
  try {
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas || 1000000n;
    const gasLimit = 180000n;
    return baseFee * gasLimit;
  } catch (e) {
    return 180000n * 2000000n;
  }
}

// Uniswap V2 Constant Product Formula (0.3% fee)
function getAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
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
  } catch (err) {}
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

// Rebuild active list: only tokens that exist on >= 2 DEXs
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

// 1-Call Multicall3 Reserve Batch Reader
async function updateAllReservesMulticall() {
  if (activeArbitragePairs.length === 0) return {};
  
  const callData = pairInterface.encodeFunctionData('getReserves');
  const calls = activeArbitragePairs.map(p => ({
    target: p.pairAddr,
    allowFailure: true,
    callData
  }));

  const reservesCache = {}; // `${dex}_${tokenAddr}` -> { rWeth, rToken }

  try {
    const results = await multicallContract.aggregate3(calls);
    for (let i = 0; i < activeArbitragePairs.length; i++) {
      const p = activeArbitragePairs[i];
      const res = results[i];
      if (res && res.success && res.returnData !== '0x') {
        const decoded = pairInterface.decodeFunctionResult('getReserves', res.returnData);
        const r0 = decoded[0];
        const r1 = decoded[1];
        const rWeth = p.isWeth0 ? r0 : r1;
        const rToken = p.isWeth0 ? r1 : r0;
        reservesCache[`${p.dex}_${p.tokenAddr}`] = { rWeth, rToken };
      }
    }
  } catch (err) {
    // Transient Multicall failure
  }

  return reservesCache;
}

// Flashbots-style Market Evaluator with Binary Step Optimization
function evaluateCrossedMarkets(reservesCache, gasCostEth) {
  let bestOpportunity = null;
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
        if (r1.rWeth < ethers.parseEther('0.002') || r2.rWeth < ethers.parseEther('0.002')) continue;
        if (r1.rToken <= 0n || r2.rToken <= 0n) continue;

        // Fast probe check (raw ratio: WETH / Token)
        const price1 = Number(r1.rWeth) / Number(r1.rToken);
        const price2 = Number(r2.rWeth) / Number(r2.rToken);

        let buyDex = null;
        let sellDex = null;
        let buyReserves = null;
        let sellReserves = null;
        let spread = 0;

        if (price1 > price2) {
          spread = ((price1 - price2) / price2) * 100;
          buyDex = d2; sellDex = d1;
          buyReserves = r2; sellReserves = r1;
        } else {
          spread = ((price2 - price1) / price1) * 100;
          buyDex = d1; sellDex = d2;
          buyReserves = r1; sellReserves = r2;
        }

        // Only evaluate if spread exceeds DEX fees + minimum threshold (0.6% total fees)
        if (spread > 0.4) {
          let bestInput = 0n;
          let bestNetProfit = -1000000000000n;
          let bestOutToken = 0n;
          let bestOutWeth = 0n;

          // Multi-tier ladder evaluation
          for (const size of TEST_VOLUMES) {
            const outToken = getAmountOut(size, buyReserves.rWeth, buyReserves.rToken);
            const outWeth = getAmountOut(outToken, sellReserves.rToken, sellReserves.rWeth);
            const grossProfit = outWeth - size;
            const netProfit = grossProfit - gasCostEth;

            if (bestInput > 0n && netProfit < bestNetProfit) {
              // Half-step binary search convergence (Flashbots pattern)
              const trySize = (size + bestInput) / 2n;
              const tryOutToken = getAmountOut(trySize, buyReserves.rWeth, buyReserves.rToken);
              const tryOutWeth = getAmountOut(tryOutToken, sellReserves.rToken, sellReserves.rWeth);
              const tryNet = (tryOutWeth - trySize) - gasCostEth;

              if (tryNet > bestNetProfit) {
                bestNetProfit = tryNet;
                bestInput = trySize;
                bestOutToken = tryOutToken;
                bestOutWeth = tryOutWeth;
              }
              break;
            }

            if (netProfit > bestNetProfit) {
              bestNetProfit = netProfit;
              bestInput = size;
              bestOutToken = outToken;
              bestOutWeth = outWeth;
            }
          }

          if (bestNetProfit > 0n && (!bestOpportunity || bestNetProfit > bestOpportunity.netProfit)) {
            bestOpportunity = {
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

  return bestOpportunity;
}

// Background Factory Log Scanner
async function scanFactoryLogs(factoryName, factoryAddr, fromBlock, toBlock) {
  const CHUNK_SIZE = 9999;
  let totalEvents = 0;
  let wethPairsFound = 0;

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
    } catch (err) {}
    await new Promise(r => setTimeout(r, 60));
  }

  if (wethPairsFound > 0) {
    console.log(`\n[DISCOVERY] ${factoryName}: ${wethPairsFound} new WETH pairs found.`);
  }
}

// Initial discovery + core bluechip pair discovery
async function initialDiscovery() {
  loadRegistry();

  const currentBlock = await provider.getBlockNumber();
  console.log(`\n🔄 Initializing Dynamic Pool Discovery (Chain Head: #${currentBlock})...`);

  const startBlock = lastScannedBlock > 0 ? lastScannedBlock + 1 : Math.max(0, currentBlock - 300000);

  for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
    console.log(`   Scanning ${dex}...`);
    await scanFactoryLogs(dex, factoryAddr, startBlock, currentBlock);
  }

  // Seed core and popular Base tokens
  const CORE_TOKENS = [
    { symbol: 'USDC', addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'USDbC', addr: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
    { symbol: 'DAI', addr: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    { symbol: 'cbETH', addr: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' },
    { symbol: 'TOSHI', addr: '0xAC3211A50254149e59203673F9217646549E7090' },
    { symbol: 'DEGEN', addr: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed' },
    { symbol: 'BRETT', addr: '0x532f27101965dd16442E59d40670FaF5eBB142E4' },
    { symbol: 'AERO', addr: '0x940181a94A35A4569E4529A3CDfB74e438E73580' },
    { symbol: 'HIGHER', addr: '0x0578d8A44db98B23BF096A382e016e29a5CE0FFE' },
    { symbol: 'VIRTUAL', addr: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b' },
    { symbol: 'CLANKER', addr: '0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb' },
    { symbol: 'KEYCAT', addr: '0x9a26F5433671751C3276a26524315446dd1ecc82' },
    { symbol: 'MOCHI', addr: '0xF6e932Ca12afa26665dC4dDe7e27be02A7669e50' },
    { symbol: 'NORMIE', addr: '0x7F12d43B53671407868050643494077F55c8429c' },
    { symbol: 'SEAM', addr: '0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85' },
    { symbol: 'BSWAP', addr: '0x78a087d713Be963Bf307b18F2Ff8122EF9A63ae9' },
    { symbol: 'ALB', addr: '0x1dd2d631c92b68df9ad7a7a3b155c991d474c29d' }
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

// Background Discovery Poller (every 45s)
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
    } catch (err) {}
  }, 45000);
}

// Flashbots-Accelerated Hot Arb Loop (via Multicall3)
async function startHotLoop() {
  let lastProcessedBlock = 0;
  console.log('⚡ [HOT ARB LOOP] Online (Multicall3 Accelerated). Watching Base blocks...\n');

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
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: ${Object.keys(FACTORIES).length} DEXs | 0 Candidates`);
        }
        return;
      }

      // 1. Single-Call Multicall3 Batch Reserve Update
      const [reservesCache, gasCostEth] = await Promise.all([
        updateAllReservesMulticall(),
        getGasEstimateEth()
      ]);

      // 2. Flashbots Crossed-Market Evaluation
      const bestOpp = evaluateCrossedMarkets(reservesCache, gasCostEth);

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
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: ${Object.keys(FACTORIES).join(' ↔️ ')} | Candidates: ${activeArbitragePairs.length} pools`);
          
          const uniqueTokens = [...new Set(activeArbitragePairs.map(p => p.tokenAddr))];
          for (const tAddr of uniqueTokens) {
            const tokenPairs = activeArbitragePairs.filter(p => p.tokenAddr === tAddr);
            const sym = tokenPairs[0].symbol;
            const priceEntries = [];
            const prices = [];

            for (const tp of tokenPairs) {
              const r = reservesCache[`${tp.dex}_${tAddr}`];
              if (r && r.rToken > 0n && r.rWeth > 0n) {
                const is6Dec = sym.toUpperCase().includes('USD') && !sym.toUpperCase().includes('DAI');
                const rawPrice = Number(r.rWeth) / Number(r.rToken);
                const pWeth = is6Dec ? rawPrice * 1e12 : rawPrice;
                prices.push({ dex: tp.dex, price: pWeth });

                let displayStr = '';
                if (sym.toUpperCase().includes('USD')) {
                  const ethPrice = (1 / pWeth).toFixed(2);
                  displayStr = `${tp.dex}: $${ethPrice}`;
                } else {
                  displayStr = `${tp.dex}: ${pWeth < 0.0001 ? pWeth.toExponential(2) : pWeth.toFixed(6)} WETH`;
                }
                priceEntries.push(displayStr);
              }
            }

            let maxSpread = 0;
            if (prices.length >= 2) {
              for (let a = 0; a < prices.length; a++) {
                for (let b = a + 1; b < prices.length; b++) {
                  const sp = Math.abs(prices[a].price - prices[b].price) / Math.min(prices[a].price, prices[b].price) * 100;
                  if (sp > maxSpread) maxSpread = sp;
                }
              }
            }

            console.log(`  🪙 ${sym.padEnd(8)} | ${priceEntries.join(' | ')} (Spread: ${maxSpread.toFixed(2)}%)`);
          }
        }
      }
    } catch (err) {}
  }, 2000);
}

// Start Engine
initialDiscovery().then(() => {
  startBackgroundDiscovery();
  startHotLoop();
}).catch(err => {
  console.error('Fatal Engine Error:', err);
});

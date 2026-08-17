import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 8453, name: 'base' }, { staticNetwork: true });

const WETH = '0x4200000000000000000000000000000000000006';

// Canonical Multicall3 on Base
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
];
const multicallContract = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

// Verified Standard V2 DEX Factories on Base
const FACTORIES = {
  UniswapV2: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
  Aerodrome: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
  SushiSwap: '0x71524B4f93c58fcbF659783284E38825f0622859',
  BaseSwap: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
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
const factoryInterface = new ethers.Interface(FACTORY_ABI);
const aeroInterface = new ethers.Interface([
  'function getPool(address, address, bool) view returns (address)'
]);
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
  ethers.parseEther('0.00005'), // ~$0.10
  ethers.parseEther('0.00010'), // ~$0.20
  ethers.parseEther('0.00020'), // ~$0.40
  ethers.parseEther('0.00035'), // ~$0.70
  ethers.parseEther('0.00055')  // ~$1.10 (within 0.00062 WETH bankroll)
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

// Accurate DEX Fee Aware Constant Product Formula
function getAmountOut(amountIn, reserveIn, reserveOut, dexName = 'UniswapV2') {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  // Aerodrome volatile pools have 100 bps (1.00%) fee; standard V2 (Uniswap, Sushi, BaseSwap, AlienBase) is 30 bps (0.30%)
  const feeBps = (dexName === 'Aerodrome') ? 100n : 30n;
  const multiplier = 10000n - feeBps;
  const amountInWithFee = amountIn * multiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 10000n) + amountInWithFee;
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
        for (const [tAddr, dexMap] of Object.entries(data.tokens)) {
          discoveredPairs[tAddr.toLowerCase()] = dexMap;
        }
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
    const tAddr = tokenAddr.toLowerCase();
    const dexes = Object.keys(dexMap);
    if (dexes.length >= 2) {
      for (const dex of dexes) {
        activeArbitragePairs.push({
          tokenAddr: tAddr,
          symbol: dexMap[dex].symbol || tAddr.substring(0, 6),
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
        reservesCache[`${p.dex}_${p.tokenAddr.toLowerCase()}`] = { rWeth, rToken };
      }
    }
  } catch (err) {
    // Transient Multicall failure
  }

  return reservesCache;
}

// Flashbots-style Market Evaluator with Binary Step Optimization and Transparent Telemetry
function evaluateCrossedMarkets(reservesCache, gasCostEth) {
  let bestOpportunity = null;
  const evaluations = [];
  const uniqueTokens = [...new Set(activeArbitragePairs.map(p => p.tokenAddr))];

  for (const tokenAddr of uniqueTokens) {
    const tokenPairs = activeArbitragePairs.filter(p => p.tokenAddr === tokenAddr);
    const sym = tokenPairs[0].symbol;
    const dexes = tokenPairs.map(p => p.dex);

    let tokenBestEval = null;

    for (let i = 0; i < dexes.length; i++) {
      for (let j = i + 1; j < dexes.length; j++) {
        const d1 = dexes[i];
        const d2 = dexes[j];

        const r1 = reservesCache[`${d1}_${tokenAddr.toLowerCase()}`];
        const r2 = reservesCache[`${d2}_${tokenAddr.toLowerCase()}`];

        if (!r1 || !r2 || r1.rToken <= 0n || r2.rToken <= 0n) continue;

        // Check minimum liquidity
        if (r1.rWeth < ethers.parseEther('0.0001') || r2.rWeth < ethers.parseEther('0.0001')) {
          tokenBestEval = {
            symbol: sym,
            tokenAddr,
            spread: 0,
            status: 'REJECTED',
            reason: `Liquidity too shallow (<$0.25 on ${r1.rWeth < r2.rWeth ? d1 : d2})`,
            details: null
          };
          continue;
        }

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

        let bestInput = TEST_VOLUMES[0];
        const initialOutToken = getAmountOut(TEST_VOLUMES[0], buyReserves.rWeth, buyReserves.rToken, buyDex);
        const initialOutWeth = getAmountOut(initialOutToken, sellReserves.rToken, sellReserves.rWeth, sellDex);
        let bestGrossProfit = initialOutWeth - TEST_VOLUMES[0];
        let bestNetProfit = bestGrossProfit - gasCostEth;
        let bestOutToken = initialOutToken;
        let bestOutWeth = initialOutWeth;

        // Multi-tier ladder evaluation
        for (const size of TEST_VOLUMES) {
          const outToken = getAmountOut(size, buyReserves.rWeth, buyReserves.rToken, buyDex);
          const outWeth = getAmountOut(outToken, sellReserves.rToken, sellReserves.rWeth, sellDex);
          const grossProfit = outWeth - size;
          const netProfit = grossProfit - gasCostEth;

          if (bestInput > 0n && netProfit < bestNetProfit) {
            // Half-step binary search convergence
            const trySize = (size + bestInput) / 2n;
            const tryOutToken = getAmountOut(trySize, buyReserves.rWeth, buyReserves.rToken, buyDex);
            const tryOutWeth = getAmountOut(tryOutToken, sellReserves.rToken, sellReserves.rWeth, sellDex);
            const tryGross = tryOutWeth - trySize;
            const tryNet = tryGross - gasCostEth;

            if (tryNet > bestNetProfit) {
              bestGrossProfit = tryGross;
              bestNetProfit = tryNet;
              bestInput = trySize;
              bestOutToken = tryOutToken;
              bestOutWeth = tryOutWeth;
            }
            break;
          }

          if (netProfit > bestNetProfit) {
            bestGrossProfit = grossProfit;
            bestNetProfit = netProfit;
            bestInput = size;
            bestOutToken = outToken;
            bestOutWeth = outWeth;
          }
        }

        let reason = '';
        let status = 'REJECTED';

        if (bestNetProfit > 0n) {
          status = 'PROFITABLE';
          reason = 'Net profit exceeds gas + DEX fees';
        } else if (bestGrossProfit <= 0n) {
          status = 'REJECTED';
          reason = spread < 0.6 ? `Spread (${spread.toFixed(2)}%) < 0.60% DEX fees` : `Slippage on ${buyDex}/${sellDex} exceeds spread`;
        } else {
          status = 'REJECTED';
          reason = `Gross profit (+$${toUsd(bestGrossProfit)}) < L2 gas (-$${toUsd(gasCostEth)})`;
        }

        const evalItem = {
          symbol: sym,
          tokenAddr,
          buyDex,
          sellDex,
          spread,
          status,
          reason,
          details: {
            input: bestInput,
            outToken: bestOutToken,
            outWeth: bestOutWeth,
            grossProfit: bestGrossProfit,
            gasCost: gasCostEth,
            netProfit: bestNetProfit,
            buyPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === buyDex),
            sellPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === sellDex)
          }
        };

        if (!tokenBestEval || (evalItem.details.netProfit > (tokenBestEval.details?.netProfit || -1000000000000n))) {
          tokenBestEval = evalItem;
        }

        if (bestNetProfit > 0n && (!bestOpportunity || bestNetProfit > bestOpportunity.netProfit)) {
          bestOpportunity = {
            symbol: sym,
            tokenAddr,
            buyDex,
            sellDex,
            buyPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === buyDex),
            sellPair: activeArbitragePairs.find(p => p.tokenAddr === tokenAddr && p.dex === sellDex),
            spread,
            input: bestInput,
            outToken: bestOutToken,
            outWeth: bestOutWeth,
            grossProfit: bestGrossProfit,
            gasCost: gasCostEth,
            netProfit: bestNetProfit
          };
        }
      }
    }

    if (tokenBestEval) evaluations.push(tokenBestEval);
  }

  return { bestOpportunity, evaluations };
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

// Initial discovery + Multicall3 fast batch initialization
async function initialDiscovery() {
  loadRegistry();

  const currentBlock = await provider.getBlockNumber();
  console.log(`\n🔄 Initializing Dynamic Pool Discovery (Chain Head: #${currentBlock})...`);

  // Fast Multicall3 check for MEME & CORE tokens across all FACTORIES
  const CORE_TOKENS = [
    // Major Base Meme Coins
    { symbol: 'BRETT', addr: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
    { symbol: 'DEGEN', addr: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
    { symbol: 'TOSHI', addr: '0xac3211a50254149e59203673f9217646549e7090' },
    { symbol: 'KEYCAT', addr: '0x9a26f5433671751c3276a065f57e5a02d2817973' },
    { symbol: 'MOCHI', addr: '0xf6e932ca12afa26665dc4dde7e27be02a7669e50' },
    { symbol: 'NORMIE', addr: '0x7f12d43b53671407868050643494077f55c8429c' },
    { symbol: 'MOG', addr: '0x2da56acb9ea78330f947bd57c54119debda7af71' },
    { symbol: 'TYBG', addr: '0x0d97f261b1e88845f81716070093a4b6c7e2e089' },
    { symbol: 'DOGINME', addr: '0x6921b130d297cc43754afba22e5eac0fbf8db75b' },
    { symbol: 'HIGHER', addr: '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe' },
    { symbol: 'VIRTUAL', addr: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b' },
    { symbol: 'CLANKER', addr: '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb' },
    { symbol: 'CHOMP', addr: '0xe3c4baa68b60e589f77f54c2579df6469619669e' },
    { symbol: 'MIGGLES', addr: '0xbbcfe075253818e69d7249a5b7ff22ebaa803ec2' },
    { symbol: 'SKI', addr: '0x76427245647a748c9df17434a9496a7ef64ee800' },
    { symbol: 'BASED', addr: '0x018b14421ea9ec0d3dcbb39f972bcae2f1f50689' },
    { symbol: 'FOFAR', addr: '0xeff38fb87d7b003a274534fb68d9e6eb73f15c7e' },
    { symbol: 'BOOMER', addr: '0xb46166371c667431264c9bf6fa5947a79e43b174' },
    { symbol: 'BSTONK', addr: '0x0f61edbfe6cd86024c0f210c0695b08df55fdfc9' },
    { symbol: 'MEOW', addr: '0x03ee11923326d54a580af44ec633f1cdcb414632' },
    { symbol: 'Basecat', addr: '0xb2000000000000000000004c27f6523082f41d01' },
    { symbol: 'ROOST', addr: '0xe1a0ddeb706684169879756c9a591179469385b3' },
    { symbol: 'BENJI', addr: '0xbc45647ea894030a4e9801ec03479739fa983b4d' },
    { symbol: 'PEPE', addr: '0x52b492a33e447cdb854c7fc19f1e5648d6117263' },
    { symbol: 'SHIB', addr: '0x4642995b018dd0c83eb6d3e3ba4cb9b014be3618' },
    { symbol: 'ELSA', addr: '0x0bc989104ad5c40464f1d39f40822659e98e7278' },
    { symbol: 'VVV', addr: '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf' },
    { symbol: 'BRIAN', addr: '0x5d9ab553cfb9b80b27b3b9b47e828d57865c3bb5' },
    { symbol: 'ALB', addr: '0x1dd2d631c92b68df9ad7a7a3b155c991d474c29d' },
    { symbol: 'BSWAP', addr: '0x78a087d713be963bf307b18f2ff8122ef9a63ae9' },
    { symbol: 'SEAM', addr: '0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85' },
    { symbol: 'AERO', addr: '0x940181a94a35a4569e4529a3cdfb74e438e73580' },
    // Major Base Core / DeFi
    { symbol: 'USDC', addr: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
    { symbol: 'USDbC', addr: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' },
    { symbol: 'USDT', addr: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2' },
    { symbol: 'DAI', addr: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' },
    { symbol: 'cbETH', addr: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' },
    { symbol: 'wstETH', addr: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452' },
    { symbol: 'cbBTC', addr: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' },
    { symbol: 'EZETH', addr: '0x2416092f143378750bb29b79ed961ab195cceea5' },
    { symbol: 'WEETH', addr: '0x04c0599ae5a44757c0af6f9ec3b93da8976c150a' }
  ];

  const calls = [];
  const meta = [];

  for (const token of CORE_TOKENS) {
    for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
      if (dex === 'Aerodrome') {
        calls.push({
          target: factoryAddr,
          allowFailure: true,
          callData: aeroInterface.encodeFunctionData('getPool', [WETH, token.addr.toLowerCase(), false])
        });
      } else {
        calls.push({
          target: factoryAddr,
          allowFailure: true,
          callData: factoryInterface.encodeFunctionData('getPair', [WETH, token.addr.toLowerCase()])
        });
      }
      meta.push({ dex, tokenAddr: token.addr.toLowerCase(), symbol: token.symbol });
    }
  }

  try {
    const results = await multicallContract.aggregate3(calls);
    const discoveredList = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const m = meta[i];
      if (r.success && r.returnData !== '0x') {
        const decoded = m.dex === 'Aerodrome'
          ? aeroInterface.decodeFunctionResult('getPool', r.returnData)
          : factoryInterface.decodeFunctionResult('getPair', r.returnData);
        const pairAddr = decoded[0];
        if (pairAddr && pairAddr !== ethers.ZeroAddress) {
          discoveredList.push({ ...m, pairAddr });
        }
      }
    }

    // Check token0 orientation for discovered pairs via Multicall
    if (discoveredList.length > 0) {
      const t0Calls = discoveredList.map(p => ({
        target: p.pairAddr,
        allowFailure: true,
        callData: pairInterface.encodeFunctionData('token0')
      }));
      const t0Res = await multicallContract.aggregate3(t0Calls);

      for (let i = 0; i < discoveredList.length; i++) {
        const item = discoveredList[i];
        const res = t0Res[i];
        let isWeth0 = true;
        if (res.success && res.returnData !== '0x') {
          const decoded = pairInterface.decodeFunctionResult('token0', res.returnData);
          isWeth0 = decoded[0].toLowerCase() === WETH.toLowerCase();
        }

        if (!discoveredPairs[item.tokenAddr]) discoveredPairs[item.tokenAddr] = {};
        discoveredPairs[item.tokenAddr][item.dex] = {
          pairAddr: item.pairAddr,
          isWeth0,
          symbol: item.symbol
        };
      }
    }
  } catch (err) {
    // Graceful fallback to persistent registry
  }

  lastScannedBlock = currentBlock;
  updateIntersectionMatrix();
  saveRegistry();

  const uniqueDiscovered = Object.keys(discoveredPairs).length;
  console.log(`\n✅ Pool Discovery Complete:`);
  console.log(`   Total Discovered Tokens: ${uniqueDiscovered}`);
  console.log(`   Cross-DEX Candidate Pools (≥2 DEXs): ${activeArbitragePairs.length}`);
  console.log(`   Active Matrix: ${Object.keys(FACTORIES).join(' ↔️ ')}\n`);
}

// Dynamic Background Discovery Engine (Active GeckoTerminal Feed + On-chain Multicall)
async function fetchTrendingBaseTokens() {
  const discoveredMap = new Map();
  try {
    const endpoints = [
      'https://api.geckoterminal.com/api/v2/networks/base/trending_pools',
      'https://api.geckoterminal.com/api/v2/networks/base/new_pools'
    ];
    for (const url of endpoints) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) continue;

      for (const pool of data.data) {
        const baseAddr = pool.relationships?.base_token?.data?.id?.replace('base_', '');
        const quoteAddr = pool.relationships?.quote_token?.data?.id?.replace('base_', '');
        const name = pool.attributes?.name || '';
        const parts = name.split(' / ');

        if (baseAddr && ethers.isAddress(baseAddr) && baseAddr.toLowerCase() !== WETH.toLowerCase()) {
          discoveredMap.set(baseAddr.toLowerCase(), parts[0]?.replace(/\s.*$/, '') || 'TOKEN');
        }
        if (quoteAddr && ethers.isAddress(quoteAddr) && quoteAddr.toLowerCase() !== WETH.toLowerCase()) {
          discoveredMap.set(quoteAddr.toLowerCase(), parts[1]?.replace(/\s.*$/, '') || 'TOKEN');
        }
      }
    }
  } catch (e) {}
  return Array.from(discoveredMap.entries()).map(([addr, symbol]) => ({ addr, symbol }));
}

function startBackgroundDiscovery() {
  console.log('📡 Dynamic Market Feed Active (Scanning trending & new tokens every 45s)...');
  
  setInterval(async () => {
    try {
      const candidates = await fetchTrendingBaseTokens();
      const newTokens = candidates.filter(c => !discoveredPairs[c.addr.toLowerCase()]);

      if (newTokens.length > 0) {
        const calls = [];
        const meta = [];

        for (const token of newTokens) {
          for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
            if (dex === 'Aerodrome') {
              calls.push({
                target: factoryAddr,
                allowFailure: true,
                callData: aeroInterface.encodeFunctionData('getPool', [WETH, token.addr, false])
              });
            } else {
              calls.push({
                target: factoryAddr,
                allowFailure: true,
                callData: factoryInterface.encodeFunctionData('getPair', [WETH, token.addr])
              });
            }
            meta.push({ dex, tokenAddr: token.addr, symbol: token.symbol });
          }
        }

        const results = await multicallContract.aggregate3(calls);
        const newlyFoundPairs = [];

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const m = meta[i];
          if (r.success && r.returnData !== '0x') {
            const decoded = m.dex === 'Aerodrome'
              ? aeroInterface.decodeFunctionResult('getPool', r.returnData)
              : factoryInterface.decodeFunctionResult('getPair', r.returnData);
            const pairAddr = decoded[0];
            if (pairAddr && pairAddr !== ethers.ZeroAddress) {
              newlyFoundPairs.push({
                dex: m.dex,
                tokenAddr: m.tokenAddr,
                symbol: m.symbol,
                pairAddr
              });
            }
          }
        }

        // Verify token0 orientation on-chain via Multicall3
        if (newlyFoundPairs.length > 0) {
          const t0Calls = newlyFoundPairs.map(p => ({
            target: p.pairAddr,
            allowFailure: true,
            callData: pairInterface.encodeFunctionData('token0')
          }));

          const t0Results = await multicallContract.aggregate3(t0Calls);
          for (let i = 0; i < newlyFoundPairs.length; i++) {
            const p = newlyFoundPairs[i];
            const t0Res = t0Results[i];
            let isWeth0 = true;
            if (t0Res.success && t0Res.returnData !== '0x') {
              const decodedT0 = pairInterface.decodeFunctionResult('token0', t0Res.returnData)[0];
              isWeth0 = (decodedT0.toLowerCase() === WETH.toLowerCase());
            }

            if (!discoveredPairs[p.tokenAddr]) discoveredPairs[p.tokenAddr] = {};
            discoveredPairs[p.tokenAddr][p.dex] = {
              pairAddr: p.pairAddr,
              isWeth0,
              symbol: p.symbol
            };
          }
        }

        const beforePools = activeArbitragePairs.length;
        updateIntersectionMatrix();
        const afterPools = activeArbitragePairs.length;

        if (afterPools > beforePools) {
          saveRegistry();
          console.log(`\n✨ [NEW TOKENS DISCOVERED] Expanded candidate universe to ${activeArbitragePairs.length} pools across ${Object.keys(discoveredPairs).length} tokens!`);
        }
      }
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
        return;
      }

      // 1. Single-Call Multicall3 Batch Reserve Update
      const [reservesCache, gasCostEth] = await Promise.all([
        updateAllReservesMulticall(),
        getGasEstimateEth()
      ]);

      // 2. Flashbots Crossed-Market Evaluation with Full Simulation Trace
      const { bestOpportunity: bestOpp, evaluations } = evaluateCrossedMarkets(reservesCache, gasCostEth);

      if (bestOpp) {
        console.log(`\n═════════════════════════════════════════════════════════════════`);
        console.log(`🚀 [ARBITRAGE OPPORTUNITY ACCEPTED] Block #${currentBlock} | Token: ${bestOpp.symbol}`);
        console.log(`═════════════════════════════════════════════════════════════════`);
        console.log(`Route:        ${bestOpp.buyDex} (Buy) ➡️ ${bestOpp.sellDex} (Sell)`);
        console.log(`Spread:       ${bestOpp.spread.toFixed(2)}%`);
        console.log(`Input:        $${toUsd(bestOpp.input)} (${ethers.formatEther(bestOpp.input)} WETH)`);
        console.log(`Expected Out: $${toUsd(bestOpp.outWeth)} (${ethers.formatEther(bestOpp.outWeth)} WETH)`);
        console.log(`Gross Profit: +$${toUsd(bestOpp.grossProfit)}`);
        console.log(`Gas Cost:    -$${toUsd(bestOpp.gasCost)}`);
        console.log(`NET PROFIT:   +$${toUsd(bestOpp.netProfit)}`);
        console.log(`═════════════════════════════════════════════════════════════════`);

        if (!breadContract) {
          console.log(`⚠️ Execution skipped: BREAD_ROUTER_ADDRESS or Wallet private key missing.`);
          console.log(`─────────────────────────────────────────────────`);
          return;
        }

        console.log(`⚡ [EXECUTION] Submitting atomic transaction via Bread.sol...`);
        engineState = 'EXECUTING';

        try {
          const buyP = new ethers.Contract(bestOpp.buyPair.pairAddr, PAIR_ABI, provider);
          const sellP = new ethers.Contract(bestOpp.sellPair.pairAddr, PAIR_ABI, provider);

          const [t0_1, t0_2] = await Promise.all([buyP.token0(), sellP.token0()]);
          const zeroForOne1 = t0_1.toLowerCase() === WETH.toLowerCase();
          const zeroForOne2 = t0_2.toLowerCase() !== WETH.toLowerCase();

          // 1. Pre-Flight Zero-Gas StaticCall Simulation
          try {
            await breadContract.executeArbitrage.staticCall(
              bestOpp.buyPair.pairAddr,
              bestOpp.sellPair.pairAddr,
              bestOpp.input,
              bestOpp.outToken,
              bestOpp.outWeth,
              zeroForOne1,
              zeroForOne2,
              1n
            );
            console.log(`   ✅ Pre-Flight Simulation Passed! Executing on-chain...`);
          } catch (simErr) {
            console.log(`   ⚠️ Pre-Flight Simulation Rejected (Safe, 0 Gas Spent): ${simErr.message}`);
            return;
          }

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
          console.log(`   ✅ Arbitrage Mined on Base in Block #${receipt.blockNumber}!`);
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
          const uniqueTokens = [...new Set(activeArbitragePairs.map(p => p.tokenAddr))];
          const notableEvals = evaluations.filter(e => e.spread > 0.3 || (e.details && e.details.grossProfit > 0n));
          const topSpread = evaluations.reduce((max, e) => e.spread > (max.spread || 0) ? e : max, {});

          const topStr = topSpread.symbol ? `${topSpread.symbol} (${topSpread.spread.toFixed(2)}%)` : 'None (>0.3%)';
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: 5 DEXs | Monitored: ${uniqueTokens.length} tokens (${activeArbitragePairs.length} pools) | Top Spread: ${topStr}`);
          
          if (notableEvals.length > 0) {
            console.log(`  🔬 Active Price Dislocation Traces:`);
            for (const ev of notableEvals) {
              if (ev.details) {
                const inStr = `$${toUsd(ev.details.input)}`;
                const outStr = `$${toUsd(ev.details.outWeth)}`;
                const netStr = (ev.details.netProfit >= 0n ? '+' : '') + `$${toUsd(ev.details.netProfit)}`;
                console.log(`  🪙 ${ev.symbol.padEnd(8)} | Spread: ${ev.spread.toFixed(2).padStart(5)}% (${ev.buyDex} ➡️ ${ev.sellDex}) | Sim: In ${inStr} ➡️ Out ${outStr} | Net: ${netStr} | [${ev.status}: ${ev.reason}]`);
              } else {
                console.log(`  🪙 ${ev.symbol.padEnd(8)} | Spread: ${ev.spread.toFixed(2).padStart(5)}% | [${ev.status}: ${ev.reason}]`);
              }
            }
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

import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const provider = new ethers.JsonRpcProvider(RPC, 8453);

const WETH = '0x4200000000000000000000000000000000000006';

const FACTORIES = {
  BaseSwap: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
  SwapBased: '0x04C9f118d21e8B767D2e50C946f0cC9F6C367300',
  SushiSwap: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
};

// Removed hardcoded TOKENS list - we will dynamically discover them

// Global state machine for execution
let engineState = 'IDLE'; // 'IDLE' | 'EXECUTING'


const BREAD_ROUTER = process.env.BREAD_ROUTER_ADDRESS;
const PK = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const wallet = new ethers.Wallet(PK, provider);
const BREAD_ABI = [
  'function executeArbitrage(address pool1, address pool2, uint256 amountIn, uint256 amountOut1, uint256 amountOut2, bool zeroForOne1, bool zeroForOne2, uint256 minProfit) external returns (uint256)'
];
const breadContract = new ethers.Contract(BREAD_ROUTER, BREAD_ABI, wallet);

const FACTORY_ABI = ['function getPair(address, address) view returns (address)'];
const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

const pairsData = []; // { symbol, dex, pairAddr, isWeth0 }

// Estimated gas cost for the Bread.sol executeArbitrage call (approx 160k gas)
// On Base, execution + L1 data fee usually ends up around $0.005 - $0.01
// We will dynamically estimate using current baseFee
async function getGasEstimateEth() {
  const block = await provider.getBlock('latest');
  const baseFee = block?.baseFeePerGas || 1000000n;
  const gasLimit = 180000n;
  return baseFee * gasLimit;
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}

function toUsd(ethWei) {
  return (Number(ethers.formatEther(ethWei)) * 1882.5).toFixed(4);
}

// Dynamically discover all recently active WETH pools across our target factories
async function setupPairs() {
  console.log('🔄 Dynamically discovering V2 Pools from the blockchain...');
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 500000; // Scan last 500,000 blocks (~11 days of pools)
  const CHUNK_SIZE = 9999;
  
  const pairCreatedTopic = ethers.id('PairCreated(address,address,address,uint256)');
  
  const discoveredPairs = {}; // symbol (token address) -> { DEX_Name: pairAddr }

  for (const [dex, factoryAddr] of Object.entries(FACTORIES)) {
    process.stdout.write(`   Scanning ${dex} logs... `);
    let factoryPools = 0;
    
    for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
      const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
      try {
        const logs = await provider.getLogs({
          address: factoryAddr,
          topics: [pairCreatedTopic],
          fromBlock: from,
          toBlock: to
        });
        
        for (const log of logs) {
          // Topics: [0] Event signature, [1] token0, [2] token1
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
            if (!discoveredPairs[targetToken]) discoveredPairs[targetToken] = {};
            discoveredPairs[targetToken][dex] = { pairAddr, isWeth0 };
            factoryPools++;
          }
        }
      } catch (err) {
        // Silently skip chunk on error to continue progress
      }
      await new Promise(r => setTimeout(r, 100)); // Rate limit pause
    }
    console.log(`Found ${factoryPools} recent WETH pairs.`);
  }
  
  // Filter for intersection (Token must be on at least 2 DEXs)
  console.log(`\n🔄 Building cross-DEX intersection matrix...`);
  for (const [tokenAddr, dexes] of Object.entries(discoveredPairs)) {
    const dexNames = Object.keys(dexes);
    if (dexNames.length >= 2) { // Exists on multiple DEXs
      for (const dex of dexNames) {
        pairsData.push({
          symbol: tokenAddr.substring(0, 6), // Use short address as symbol
          tokenAddr: tokenAddr,
          dex: dex,
          pairAddr: dexes[dex].pairAddr,
          isWeth0: dexes[dex].isWeth0
        });
      }
    }
  }

  console.log(`✅ Loaded ${pairsData.length} dynamic cross-DEX Liquidity Pools for Arbitrage.\n`);
}

async function scan() {
  let lastBlock = 0;
  console.log('\n📡 [ARB SCAN] Simulation Engine Online. Waiting for blocks...\n');

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;
      lastBlock = currentBlock;

      // Group by tokenAddr to compare DEXs
      const reservesCache = {}; // dex_tokenAddr -> { rWeth, rToken }

      // Fetch sequentially to avoid rate limiting
      for (const p of pairsData) {
        try {
          const pair = new ethers.Contract(p.pairAddr, PAIR_ABI, provider);
          const [r0, r1] = await pair.getReserves();
          const rWeth = p.isWeth0 ? r0 : r1;
          const rToken = p.isWeth0 ? r1 : r0;
          reservesCache[`${p.dex}_${p.tokenAddr}`] = { rWeth, rToken };
        } catch (e) {
          // If a single pair fails to fetch, we just skip it for this block
        }
      }

      const gasCostEth = await getGasEstimateEth();
      let bestOpp = null;

      // Extract unique tokens from pairsData
      const uniqueTokens = [...new Set(pairsData.map(p => p.tokenAddr))];

      for (const tokenAddr of uniqueTokens) {
        const tokenPairs = pairsData.filter(p => p.tokenAddr === tokenAddr);
        const dexes = tokenPairs.map(p => p.dex);

        for (let i = 0; i < dexes.length; i++) {
          for (let j = i + 1; j < dexes.length; j++) {
            const d1 = dexes[i];
            const d2 = dexes[j];
            
            const r1 = reservesCache[`${d1}_${tokenAddr}`];
            const r2 = reservesCache[`${d2}_${tokenAddr}`];
            
            if (!r1 || !r2) continue;
            if (r1.rWeth < ethers.parseEther('1') || r2.rWeth < ethers.parseEther('1')) continue; // Ignore low liquidity

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

            if (spread > 0.3) {
              // Simulate trade sizes starting around the bottom ($1)
              const testInputs = [
                ethers.parseEther('0.00010'), // ~$0.20
                ethers.parseEther('0.00025'), // ~$0.50
                ethers.parseEther('0.00050'), // ~$1.00
                ethers.parseEther('0.00100')  // ~$2.00
              ];

              let bestInput = 0n;
              let bestNetProfit = -100000000000n; // negative infinity
              let bestOutToken = 0n;
              let bestOutWeth = 0n;

              for (const input of testInputs) {
                // Leg 1: Buy token with WETH
                const outToken = getAmountOut(input, buyReserves.rWeth, buyReserves.rToken);
                // Leg 2: Sell token for WETH
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
                  symbol: pairsData.find(p => p.tokenAddr === tokenAddr).symbol,
                  tokenAddr: tokenAddr,
                  buyDex, sellDex,
                  buyReserves: pairsData.find(p => p.tokenAddr === tokenAddr && p.dex === buyDex),
                  sellReserves: pairsData.find(p => p.tokenAddr === tokenAddr && p.dex === sellDex),
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

      if (engineState === 'EXECUTING') {
        process.stdout.write('⏳');
        if (currentBlock % 5 === 0) {
          console.log(`\n[ARB SCAN] Block #${currentBlock} | ENGINE LOCKED (Executing Arb...)`);
        }
        return; // Skip evaluation while executing
      }

      if (bestOpp) {
        console.log(`\n─────────────────────────────────────────────────`);
        console.log(`[ARB SCAN] Block #${currentBlock} | Token: ${bestOpp.symbol}`);
        console.log(`Direction: ${bestOpp.buyDex} -> ${bestOpp.sellDex}`);
        console.log(`Spread:    ${bestOpp.spread.toFixed(2)}%`);
        console.log(`Test Input:     $${toUsd(bestOpp.input)}`);
        console.log(`Expected Back:  $${toUsd(bestOpp.outWeth)}`);
        console.log(`Gas Estimate:  -$${toUsd(bestOpp.gasCost)}`);
        console.log(`NET EXPECTED:   ${bestOpp.netProfit > 0n ? '+' : ''}$${toUsd(bestOpp.netProfit)}`);
        
        if (bestOpp.netProfit > 0n) {
          console.log(`STATUS: ✅ EXECUTION CANDIDATE (Profitable)`);
          
          const output = `\n[ARB CANDIDATE] Token: ${bestOpp.symbol} | Route: ${bestOpp.buyDex}->${bestOpp.sellDex} | Input: $${toUsd(bestOpp.input)} | Expected Profit: $${toUsd(bestOpp.netProfit)}\n`;
          process.stdout.write(output);
          if (!BREAD_ROUTER) {
             console.log(`❌ BREAD_ROUTER_ADDRESS not found in .env. Skipping execution.`);
             return;
          }

          // Determine direction
          const buyReserves = bestOpp.buyReserves;
          const sellReserves = bestOpp.sellReserves;
          
          // Refetch to be absolutely sure
          const p1 = new ethers.Contract(buyReserves.pairAddr, PAIR_ABI, provider);
          const p2 = new ethers.Contract(sellReserves.pairAddr, PAIR_ABI, provider);
          
          const t0_1 = await p1.token0();
          const t0_2 = await p2.token0();

          const zeroForOne1 = t0_1.toLowerCase() === WETH.toLowerCase();
          const zeroForOne2 = t0_2.toLowerCase() !== WETH.toLowerCase(); // Selling token -> WETH

          const block = await provider.getBlock('latest');
          const baseFee = block?.baseFeePerGas || 1000000n;
          const maxFee = (baseFee * 150n) / 100n + 50000n;

          console.log(`🚀 Firing Atomic Arbitrage Transaction...`);
          engineState = 'EXECUTING'; // Lock state machine
          
          try {
            const tx = await breadContract.executeArbitrage(
              bestOpp.buyReserves.pairAddr,
              bestOpp.sellReserves.pairAddr,
              bestOpp.input,
              bestOpp.outToken,
              bestOpp.outWeth,
              zeroForOne1,
              zeroForOne2,
              1n, // Min profit (accept any positive profit)
              { gasLimit: 250000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: 50000n }
            );
            console.log(`   Tx Hash: ${tx.hash}`);
            const receipt = await tx.wait(1);
            console.log(`   ✅ Arbitrage Mined in Block #${receipt.blockNumber}!`);
            console.log(`[ARB MINED] Block #${receipt.blockNumber} | Token: ${bestOpp.symbol} | Profit: +$${toUsd(bestOpp.netProfit)} | Tx: ${tx.hash}`);
          } catch (execErr) {
            console.log(`   ❌ Execution Failed: ${execErr.message}`);
          } finally {
            engineState = 'IDLE'; // Unlock state machine
          }

        } else {
          console.log(`STATUS: ❌ UNPROFITABLE AFTER GAS (Skipping)`);
        }
        console.log(`─────────────────────────────────────────────────`);
      } else {
        process.stdout.write('.');
        if (currentBlock % 5 === 0) {
          console.log(`\n[ARB SCAN] Block #${currentBlock} | Active Matrix: 3 DEXs`);
        }
      }

    } catch (err) {
      if (!err.message?.includes('timeout')) {
        // silent
      }
    }
  }, 2000);
}

setupPairs().then(scan).catch(console.error);

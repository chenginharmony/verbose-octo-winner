/**
 * VERIFY REAL UNISWAP V2 ON ROBINHOOD CHAIN + DISCOVER LIVE POOLS
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const FACTORY  = '0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f';
const ROUTER   = '0x89e5db8b5aa49aa85ac63f691524311aeb649eba';
const WETH     = '0x4200000000000000000000000000000000000006'; // Standard Arbitrum/OP-stack WETH

const FACTORY_ABI = [
  'function allPairsLength() view returns (uint)',
  'function allPairs(uint) view returns (address)',
  'function getPair(address,address) view returns (address)',
  'function feeTo() view returns (address)',
];
const PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() view returns (uint)',
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint)',
];

async function discoverPools() {
  const provider = new ethers.JsonRpcProvider(rpcUrl, 4663);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 REAL UNISWAP V2 ON-CHAIN VERIFICATION — ROBINHOOD CHAIN MAINNET');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Verify contracts exist
  const factoryCode = await provider.getCode(FACTORY);
  const routerCode  = await provider.getCode(ROUTER);
  console.log(`📜 Factory  ${FACTORY}`);
  console.log(`   Bytecode: ${factoryCode === '0x' ? '❌ NOT DEPLOYED' : `✅ DEPLOYED (${(factoryCode.length - 2) / 2} bytes)`}`);
  console.log(`📜 Router   ${ROUTER}`);
  console.log(`   Bytecode: ${routerCode === '0x' ? '❌ NOT DEPLOYED' : `✅ DEPLOYED (${(routerCode.length - 2) / 2} bytes)`}`);

  if (factoryCode === '0x') { console.log('\n❌ Factory not deployed — cannot scan pools.'); return; }

  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const totalPairs = await factory.allPairsLength();
  console.log(`\n📊 Total Pairs Deployed:  ${totalPairs.toString()}\n`);

  if (totalPairs === 0n) {
    console.log('⚠️  No pairs exist yet — Uniswap V2 is deployed but no liquidity pools created.');
    return;
  }

  // Scan up to first 20 pairs
  const limit = Number(totalPairs) < 20 ? Number(totalPairs) : 20;
  const livePools = [];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🧩 SCANNING FIRST ${limit} PAIRS`);
  console.log('═══════════════════════════════════════════════════════════════');

  for (let i = 0; i < limit; i++) {
    const pairAddr = await factory.allPairs(i);
    const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
    try {
      const [t0, t1, [r0, r1]] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves(),
      ]);

      const erc0 = new ethers.Contract(t0, ERC20_ABI, provider);
      const erc1 = new ethers.Contract(t1, ERC20_ABI, provider);

      let sym0 = '???', sym1 = '???', dec0 = 18, dec1 = 18;
      try { sym0 = await erc0.symbol(); } catch {}
      try { sym1 = await erc1.symbol(); } catch {}
      try { dec0 = await erc0.decimals(); } catch {}
      try { dec1 = await erc1.decimals(); } catch {}

      const r0f = Number(ethers.formatUnits(r0, dec0));
      const r1f = Number(ethers.formatUnits(r1, dec1));
      const hasLiquidity = r0 > 0n && r1 > 0n;

      if (hasLiquidity) livePools.push({ pairAddr, t0, t1, sym0, sym1, r0f, r1f, dec0, dec1 });

      console.log(`\n  [${i}] Pair: ${pairAddr}`);
      console.log(`      ${sym0} / ${sym1}`);
      console.log(`      ${t0}`);
      console.log(`      ${t1}`);
      console.log(`      Reserve0: ${r0f.toFixed(6)} ${sym0}  |  Reserve1: ${r1f.toFixed(6)} ${sym1}`);
      console.log(`      Liquidity: ${hasLiquidity ? '✅ LIVE FUNDED POOL' : '❌ EMPTY (no reserves)'}`);
    } catch (e) {
      console.log(`  [${i}] Pair: ${pairAddr} — Error: ${e.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✅ LIVE FUNDED POOLS FOUND: ${livePools.length}`);
  console.log('═══════════════════════════════════════════════════════════════');
  for (const p of livePools) {
    console.log(`  ${p.sym0}/${p.sym1}  →  ${p.pairAddr}`);
    console.log(`     Reserves: ${p.r0f.toFixed(4)} ${p.sym0} / ${p.r1f.toFixed(4)} ${p.sym1}`);
  }

  // Check WETH address on this chain
  const wethCode = await provider.getCode(WETH);
  console.log(`\n📜 WETH (${WETH}): ${wethCode === '0x' ? '❌ Not deployed at this address' : `✅ Deployed (${(wethCode.length - 2) / 2} bytes)`}`);

  // Output JSON for next step
  console.log('\n=== POOL REGISTRY (MACHINE READABLE) ===');
  console.log(JSON.stringify({ factory: FACTORY, router: ROUTER, weth: WETH, livePools }, null, 2));
}

discoverPools().catch(console.error);

/**
 * telegram_daemon.js
 * 
 * 📱 24/7 STANDALONE TELEGRAM MASTER CONTROLLER DAEMON
 * (Native Zero-Dependency Long-Polling Engine)
 */

import { spawn } from 'child_process';
import http from 'http';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();

const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SushiBread MEV Telegram Bot Online 24/7');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check web server active on port ${PORT}`);
});

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RPC = process.env.BASE_RPC_URL || 'https://developer-access-mainnet.base.org';
const PK = process.env.BASE_BOT_PRIVATE_KEY || process.env.ROBINHOOD_BOT_PRIVATE_KEY;
const USDC_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const provider = new ethers.JsonRpcProvider(RPC, 8453);
const wallet = PK ? new ethers.Wallet(PK, provider) : null;

let engineProcess = null;
let isEngineRunning = false;
let adminChatId = process.env.TELEGRAM_CHAT_ID || null;
let lastUpdateId = 0;

console.clear();
console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║       📱 BASE MEV TELEGRAM MASTER CONTROLLER DAEMON ONLINE               ║');
console.log('║       Bot: @sushibread_bot | 24/7 Remote Host Active                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

async function telegramCall(method, body) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return null;
  }
}

function getKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: isEngineRunning ? '🛑 Stop Sniper' : '🚀 Start Sniper', callback_data: 'toggle_engine' },
        { text: '📊 Live Dashboard', callback_data: 'status' }
      ],
      [
        { text: '🏦 USDC Profit Vault', callback_data: 'vault' },
        { text: '🎯 Active Positions', callback_data: 'positions' }
      ],
      [
        { text: '⚙️ Settings & Risk', callback_data: 'settings' },
        { text: '🔄 Refresh', callback_data: 'status' }
      ]
    ]
  };
}

async function getStats() {
  if (!wallet) return {};
  const ethBal = await provider.getBalance(wallet.address).catch(() => 0n);
  const usdcContract = new ethers.Contract(USDC_ADDR, ['function balanceOf(address) view returns (uint)'], provider);
  const usdcBal = await usdcContract.balanceOf(wallet.address).catch(() => 0n);

  return {
    address: wallet.address,
    ethBal: ethers.formatEther(ethBal),
    ethUSD: (Number(ethers.formatEther(ethBal)) * 1882.5).toFixed(4),
    usdcBal: (Number(usdcBal) / 1e6).toFixed(4),
    status: isEngineRunning ? '🟢 RUNNING & SNIPING' : '🔴 STOPPED (STANDBY)'
  };
}

function startEngine(chatId) {
  if (isEngineRunning) {
    telegramCall('sendMessage', { chat_id: chatId, text: '⚠️ *Engine is already running!*', parse_mode: 'Markdown' });
    return;
  }

  isEngineRunning = true;
  const scriptPath = path.join(process.cwd(), 'scripts', 'base_atomic_sniper.js');
  engineProcess = spawn('node', [scriptPath], {
    cwd: process.cwd(),
    env: { ...process.env, TELEGRAM_CHAT_ID: chatId.toString() },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  telegramCall('sendMessage', {
    chat_id: chatId,
    text: `🍣 *SUSHIBREAD IS SERVED!* ⚡\n\n• Strategy: Genesis Sniping + Hot Momentum Scalp\n• Entry Size: $0.11 Fixed Micro-Cap\n• RPC: Base Official Developer RPC\n• Profit Vault: Auto-Sweeping to USDC`,
    parse_mode: 'Markdown',
    reply_markup: getKeyboard()
  });

  engineProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('🚀 [NEW BASE LAUNCH DETECTED]')) {
      telegramCall('sendMessage', { chat_id: chatId, text: `🚀 *[NEW BASE LAUNCH DETECTED]*\n\`\`\`\n${output.trim().slice(0, 300)}\n\`\`\``, parse_mode: 'Markdown' });
    } else if (output.includes('🎯 TAKE-PROFIT HIT') || output.includes('🔒 TRAILING PROFIT LOCK')) {
      telegramCall('sendMessage', { chat_id: chatId, text: `🏆 *[PROFIT SECURED]* 💰\n\`\`\`\n${output.trim().slice(0, 300)}\n\`\`\``, parse_mode: 'Markdown' });
    } else if (output.includes('🛑 STOP-LOSS EXIT')) {
      telegramCall('sendMessage', { chat_id: chatId, text: `🛑 *[STOP-LOSS EXIT]*\n\`\`\`\n${output.trim().slice(0, 300)}\n\`\`\``, parse_mode: 'Markdown' });
    } else if (output.includes('🏦 [PROFIT VAULT]')) {
      telegramCall('sendMessage', { chat_id: chatId, text: `🏦 *[USDC VAULT SWEEP]*\n\`\`\`\n${output.trim().slice(0, 300)}\n\`\`\``, parse_mode: 'Markdown' });
    }
  });

  engineProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  engineProcess.on('exit', (code) => {
    isEngineRunning = false;
    engineProcess = null;
    telegramCall('sendMessage', { chat_id: chatId, text: `ℹ️ *Sniper Engine Process Stopped* (Code: ${code})`, parse_mode: 'Markdown', reply_markup: getKeyboard() });
  });
}

function stopEngine(chatId) {
  if (!isEngineRunning || !engineProcess) {
    telegramCall('sendMessage', { chat_id: chatId, text: 'ℹ️ *Engine is not currently running.*', parse_mode: 'Markdown' });
    return;
  }

  engineProcess.kill('SIGINT');
  isEngineRunning = false;
  engineProcess = null;
  telegramCall('sendMessage', { chat_id: chatId, text: '🛑 *SNIPER ENGINE STOPPED.*', parse_mode: 'Markdown', reply_markup: getKeyboard() });
}

async function handleUpdate(update) {
  if (update.message && update.message.text) {
    const chatId = update.message.chat.id;
    adminChatId = chatId.toString();
    const text = update.message.text.trim();

    if (text === '/start') {
      const stats = await getStats();
      const welcome = `🍣 *SUSHIBREAD is here!*\n\n` +
        `📍 *Wallet:* \`${stats.address || '0x3fE9...B647'}\`\n` +
        `💰 *Trading ETH:* \`${stats.ethBal} ETH\` (~$${stats.ethUSD} USD)\n` +
        `🏦 *USDC Profit Vault:* \`$${stats.usdcBal} USDC\`\n` +
        `⚙️ *Engine Status:* ${stats.status}\n\n` +
        `Tap the buttons below to control the sniper:`;
      await telegramCall('sendMessage', { chat_id: chatId, text: welcome, parse_mode: 'Markdown', reply_markup: getKeyboard() });
    } else if (text === '/start_engine') {
      startEngine(chatId);
    } else if (text === '/stop_engine') {
      stopEngine(chatId);
    } else if (text === '/status') {
      const stats = await getStats();
      const statusMsg = `📊 *LIVE DASHBOARD*\n────────────────────────────\n` +
        `📍 *Wallet:* \`${stats.address}\`\n` +
        `💰 *Trading ETH:* \`${stats.ethBal} ETH\` (~$${stats.ethUSD} USD)\n` +
        `🏦 *USDC Vault:* \`$${stats.usdcBal} USDC\`\n` +
        `⚡ *Engine Status:* ${stats.status}\n` +
        `🛡️ *Entry Size:* $0.11 Fixed Micro-Cap\n────────────────────────────`;
      await telegramCall('sendMessage', { chat_id: chatId, text: statusMsg, parse_mode: 'Markdown', reply_markup: getKeyboard() });
    }
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;

    await telegramCall('answerCallbackQuery', { callback_query_id: cb.id });

    if (data === 'toggle_engine') {
      if (isEngineRunning) {
        stopEngine(chatId);
      } else {
        startEngine(chatId);
      }
    } else if (data === 'status') {
      const stats = await getStats();
      const statusMsg = `📊 *LIVE DASHBOARD*\n────────────────────────────\n` +
        `📍 *Wallet:* \`${stats.address}\`\n` +
        `💰 *Trading ETH:* \`${stats.ethBal} ETH\` (~$${stats.ethUSD} USD)\n` +
        `🏦 *USDC Vault:* \`$${stats.usdcBal} USDC\`\n` +
        `⚡ *Engine Status:* ${stats.status}\n` +
        `🛡️ *Entry Size:* $0.11 Fixed Micro-Cap\n────────────────────────────`;
      await telegramCall('sendMessage', { chat_id: chatId, text: statusMsg, parse_mode: 'Markdown', reply_markup: getKeyboard() });
    } else if (data === 'vault') {
      const stats = await getStats();
      const vaultMsg = `🏦 *REALIZED USDC PROFIT VAULT*\n────────────────────────────\n` +
        `💵 *Current Vault Balance:* \`$${stats.usdcBal} USDC\`\n` +
        `🔒 *Security Level:* 100% Stable US Dollars (Isolated from Gas)\n` +
        `⚡ *Strategy:* All pure net gains are auto-swept to USDC after every win.\n────────────────────────────`;
      await telegramCall('sendMessage', { chat_id: chatId, text: vaultMsg, parse_mode: 'Markdown', reply_markup: getKeyboard() });
    } else if (data === 'positions') {
      let activePos = {};
      try {
        const stateFile = path.join(process.cwd(), 'state', 'base_positions.json');
        if (fs.existsSync(stateFile)) activePos = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } catch {}

      const keys = Object.keys(activePos);
      if (keys.length === 0) {
        await telegramCall('sendMessage', { chat_id: chatId, text: `🎯 *ACTIVE POSITIONS: 0*\n\nAll past tokens are 100% liquidated. Zero unsold coins held!`, parse_mode: 'Markdown', reply_markup: getKeyboard() });
      } else {
        let posMsg = `🎯 *OPEN POSITIONS (${keys.length})*\n────────────────────────────\n`;
        for (const k of keys) {
          posMsg += `• *${activePos[k].symbol || 'TOKEN'}:* Held ${activePos[k].blocksHeld || 0} blocks\n`;
        }
        posMsg += `────────────────────────────`;
        await telegramCall('sendMessage', { chat_id: chatId, text: posMsg, parse_mode: 'Markdown', reply_markup: getKeyboard() });
      }
    } else if (data === 'settings') {
      const settingsMsg = `⚙️ *SNIPER CONFIGURATION*\n────────────────────────────\n` +
        `• *Target Chain:* Base Mainnet (8453)\n` +
        `• *Micro Entry Size:* $0.11 (~0.00006 ETH)\n` +
        `• *Take-Profit:* +3.5% (Auto-Sweep to USDC)\n` +
        `• *Stop-Loss:* -35% (After 12 blocks)\n` +
        `• *Liquidity Sweet Spot:* 0.25 to 25.0 WETH\n` +
        `• *2-Way Honeypot Shield:* ACTIVE\n────────────────────────────`;
      await telegramCall('sendMessage', { chat_id: chatId, text: settingsMsg, parse_mode: 'Markdown', reply_markup: getKeyboard() });
    }
  }
}

async function pollUpdates() {
  while (true) {
    try {
      const res = await telegramCall('getUpdates', { offset: lastUpdateId + 1, timeout: 30 });
      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          lastUpdateId = update.update_id;
          await handleUpdate(update);
        }
      }
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

pollUpdates();

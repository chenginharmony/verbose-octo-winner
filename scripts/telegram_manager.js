/**
 * telegram_manager.js
 * 
 * 📱 PRO-LEVEL TELEGRAM BOT CONTROLLER & TELEMETRY ENGINE
 * (Native Zero-Dependency Telemetry Dispatcher)
 */

import dotenv from 'dotenv';
dotenv.config();

class TelegramManager {
  constructor(engineState = {}) {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.engineState = engineState;
    this.isPaused = false;

    if (this.token && this.token.length > 20) {
      console.log('📱 [TELEGRAM NOTIFIER] Native Telegram Alert Channel Ready!');
    }
  }

  async sendTelegram(method, body) {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  sendMessage(text, options = {}) {
    if (!this.chatId) return;
    this.sendTelegram('sendMessage', {
      chat_id: this.chatId,
      text,
      parse_mode: 'Markdown',
      ...options,
    });
  }

  notifySnipe(symbol, tokenAddr, poolWeth, entryEth, txHash, tokenScore, sizingTier, usdValue) {
    const text = `🚀 *[NEW LAUNCH SNIPED]*\n` +
      `────────────────────────────\n` +
      `🪙 *Token:* \`${symbol}\`\n` +
      `🎯 *Score:* \`${tokenScore}/100\` (${sizingTier} TIER)\n` +
      `💧 *Pool Liquidity:* \`${poolWeth} WETH\`\n` +
      `⚡ *Dynamic Entry:* \`${entryEth} ETH\` (~$${usdValue} USD)\n` +
      `📍 *Address:* \`${tokenAddr.slice(0, 10)}...${tokenAddr.slice(-6)}\`\n` +
      `🔗 [View on Basescan](https://basescan.org/tx/${txHash})`;
    this.sendMessage(text);
  }

  notifyTakeProfit(symbol, gainPct, ethOut, usdcSwept, txHash) {
    const text = `🏆 *[TAKE-PROFIT HIT: +${gainPct}%]* 💰\n` +
      `────────────────────────────\n` +
      `🪙 *Token:* \`${symbol}\`\n` +
      `💵 *Sold For:* \`${ethOut} ETH\`\n` +
      `🏦 *Swept to USDC Vault:* \`+$${usdcSwept} USDC\`\n` +
      `✅ *ETH Capital Kept for Next Trade!*\n` +
      `🔗 [View on Basescan](https://basescan.org/tx/${txHash})`;
    this.sendMessage(text);
  }

  notifyStopLoss(symbol, lossPct, ethRecovered, txHash) {
    const text = `🛑 *[STOP-LOSS EXECUTED]*\n` +
      `────────────────────────────\n` +
      `🪙 *Token:* \`${symbol}\` (${lossPct}%)\n` +
      `💵 *Recovered:* \`${ethRecovered} ETH\` back to wallet\n` +
      `🔗 [View on Basescan](https://basescan.org/tx/${txHash})`;
    this.sendMessage(text);
  }

  notifyHoneypotBlocked(symbol, tokenAddr) {
    const text = `🛡️ *[HONEYPOT PREVENTED]*\n` +
      `────────────────────────────\n` +
      `🚫 Token \`${symbol}\` had a hidden sell-lock or 100% tax.\n` +
      `💰 *Capital Protected:* $0.00 spent.`;
    this.sendMessage(text);
  }
}

export default TelegramManager;

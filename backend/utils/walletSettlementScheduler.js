const cron = require('node-cron');
const { processPendingWalletCredits } = require('../services/walletSettlementService');

/**
 * Initializes recurring 5-minute cron worker to settle 24-hour mature wallet credits.
 */
const initWalletSettlementScheduler = () => {
  // Settle immediately on startup
  processPendingWalletCredits().then((res) => {
    if (res && res.settledCount > 0) {
      console.log(`[WalletSettlement] Startup pass: settled ${res.settledCount} mature credit(s) (₹${res.settledAmount})`);
    }
  }).catch((err) => {
    console.error('[WalletSettlement] Startup pass error:', err);
  });

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const res = await processPendingWalletCredits();
      if (res && res.settledCount > 0) {
        console.log(`[WalletSettlement] Periodic pass: settled ${res.settledCount} mature credit(s) (₹${res.settledAmount})`);
      }
    } catch (err) {
      console.error('[WalletSettlement] Scheduler tick error:', err);
    }
  });

  console.log('✅ 24-Hour Wallet Settlement Scheduler initialized (running every 5 minutes)');
};

module.exports = {
  initWalletSettlementScheduler,
};

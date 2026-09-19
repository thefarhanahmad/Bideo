const cron = require('node-cron');
const { processPendingWalletCredits } = require('../services/walletSettlementService');

/**
 * Recurring cron worker to settle matured wallet credits in safe batches.
 * Runs every minute (* * * * *).
 *
 * Flow:
 * - Throughout the day: 0 mature credits found (<1ms check, zero server load).
 * - Starting at 12:00 AM Midnight: settles matured credits smoothly batch-by-batch
 *   (e.g., 12:00, 12:01, 12:02) so server CPU and MongoDB stay completely calm
 *   and users experience zero lag or errors on the app.
 */
const initWalletSettlementScheduler = () => {
  // Settle any matured credits immediately on startup (catch-up if server was offline)
  processPendingWalletCredits().then((res) => {
    if (res && res.settledCount > 0) {
      console.log(`[WalletSettlement] Startup catch-up pass: settled ${res.settledCount} mature credit(s) (₹${res.settledAmount})`);
    }
  }).catch((err) => {
    console.error('[WalletSettlement] Startup pass error:', err);
  });

  // Run every minute for gentle, batch-by-batch settlement
  cron.schedule('* * * * *', async () => {
    try {
      const res = await processPendingWalletCredits();
      if (res && res.settledCount > 0) {
        console.log(`[WalletSettlement] Batch settled: ${res.settledCount} credit(s) (₹${res.settledAmount})`);
      }
    } catch (err) {
      console.error('[WalletSettlement] Periodic pass error:', err);
    }
  });

  console.log('✅ Safe Batch Wallet Settlement Scheduler initialized (running every minute for smooth 12:00 AM batch settlement).');
};

module.exports = {
  initWalletSettlementScheduler,
};

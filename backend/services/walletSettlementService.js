const WalletCredit = require('../models/WalletCredit');
const User = require('../models/User');

/**
 * Helper to calculate the upcoming 12:00 AM Midnight (00:00:00) in Indian Standard Time (Asia/Kolkata).
 * All views and earnings accumulated during the day mature at 12:00 AM midnight sharp.
 */
const getNextMidnightIST = (fromDate = new Date()) => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(fromDate.getTime() + IST_OFFSET_MS);

  // Advance to next calendar day at 00:00:00.000 in IST
  istTime.setUTCDate(istTime.getUTCDate() + 1);
  istTime.setUTCHours(0, 0, 0, 0);

  // Return back as standard UTC Date
  return new Date(istTime.getTime() - IST_OFFSET_MS);
};

/**
 * Queue a wallet reward credit to be settled at 12:00 AM Midnight IST.
 * Atomically increases user's pendingBalance so it is immediately visible as pending.
 */
exports.queueWalletCredit = async ({ userId, videoId = null, amount, source = 'video_view', meta = {}, availableAt = null }) => {
  if (!userId || !amount || amount <= 0) return null;

  const numericAmount = Math.round(Number(amount) * 10000) / 10000;
  const settlementDate = availableAt instanceof Date ? availableAt : getNextMidnightIST();

  const credit = await WalletCredit.create({
    user: userId,
    video: videoId,
    amount: numericAmount,
    source,
    status: 'pending',
    isCredited: false,
    availableAt: settlementDate,
    meta,
  });

  // Track pending balance on User for fast retrieval
  await User.findByIdAndUpdate(userId, {
    $inc: { pendingBalance: numericAmount },
  });

  return credit;
};

// Concurrency lock to ensure only one settlement batch runs at any given moment
let isSettling = false;

/**
 * Settle a safe, manageable batch of matured pending credits (availableAt <= now).
 * Strictly guarantees no double crediting via atomic findOneAndUpdate with status/isCredited guard.
 * Processes in gentle batches (default 100) so server CPU and MongoDB stay calm and the app never lags.
 */
exports.processPendingWalletCredits = async (batchLimit = 100) => {
  if (isSettling) {
    return { settledCount: 0, settledAmount: 0, busy: true };
  }
  isSettling = true;

  try {
    const now = new Date();
    // Fetch a single safe batch of matured pending credits
    const dueCredits = await WalletCredit.find({
      status: 'pending',
      isCredited: false,
      availableAt: { $lte: now },
    })
      .limit(batchLimit)
      .lean();

    if (!dueCredits.length) {
      return { settledCount: 0, settledAmount: 0 };
    }

    let settledCount = 0;
    let settledAmount = 0;

    for (const credit of dueCredits) {
      try {
        // 1. Atomic status transition guard prevents double processing
        const claim = await WalletCredit.findOneAndUpdate(
          {
            _id: credit._id,
            status: 'pending',
            isCredited: false,
          },
          {
            $set: {
              status: 'credited',
              isCredited: true,
              creditedAt: new Date(),
            },
          },
          { new: true }
        );

        // 2. Only proceed if THIS execution succeeded in transitioning status
        if (claim) {
          const roundedAmount = Math.round(credit.amount * 100) / 100;
          await User.findByIdAndUpdate(credit.user, {
            $inc: {
              walletBalance: roundedAmount,
              totalEarnings: roundedAmount,
              pendingBalance: -credit.amount,
            },
          });

          settledCount++;
          settledAmount += credit.amount;
        }
      } catch (itemErr) {
        console.error(`[WalletSettlement] Error settling credit ${credit._id}:`, itemErr.message);
      }
    }

    // Safety cleanup: clamp any negative pendingBalance to 0
    await User.updateMany({ pendingBalance: { $lt: 0 } }, { $set: { pendingBalance: 0 } });

    return { settledCount, settledAmount: Math.round(settledAmount * 100) / 100 };
  } catch (err) {
    console.error('[WalletSettlement] Error processing pending wallet credits:', err);
    return { error: err.message };
  } finally {
    isSettling = false;
  }
};

/**
 * Returns accurate earnings breakdown for a specific user:
 * - walletBalance (available for withdrawal)
 * - pendingBalance (maturing in 24h)
 * - todayEarnings (earnings queued today)
 * - totalEarnings (lifetime)
 */
exports.getUserEarningsSummary = async (userId) => {
  const user = await User.findById(userId).select('walletBalance pendingBalance totalEarnings').lean();
  if (!user) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Sum all credits registered today (whether pending or credited)
  const todayAgg = await WalletCredit.aggregate([
    {
      $match: {
        user: user._id,
        status: { $in: ['pending', 'credited'] },
        createdAt: { $gte: startOfToday },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);

  const todayEarnings = Math.round((todayAgg[0]?.total || 0) * 100) / 100;

  // Real-time recalculation of pending credits sum to guarantee exact precision
  const pendingAgg = await WalletCredit.aggregate([
    {
      $match: {
        user: user._id,
        status: 'pending',
        isCredited: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);

  const pendingBalance = Math.round((pendingAgg[0]?.total || 0) * 100) / 100;
  const walletBalance = Math.round((user.walletBalance || 0) * 100) / 100;
  const totalEarnings = Math.round((user.totalEarnings || 0) * 100) / 100;

  return {
    walletBalance,
    pendingBalance,
    todayEarnings,
    totalEarnings,
  };
};

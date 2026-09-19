const WalletCredit = require('../models/WalletCredit');
const User = require('../models/User');
const Video = require('../models/Video');

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
 * Helper to get reward rates dynamically from process.env.
 * Ensures consistent rate calculation across all services without hardcoding.
 */
const getRewardRates = () => {
  const defaultRate = !isNaN(Number(process.env.VIEW_REWARD_RATE))
    ? Number(process.env.VIEW_REWARD_RATE)
    : 0.01;
  const longRate = !isNaN(Number(process.env.LONG_VIDEO_REWARD_RATE))
    ? Number(process.env.LONG_VIDEO_REWARD_RATE)
    : defaultRate;
  const shortRate = !isNaN(Number(process.env.SHORT_VIDEO_REWARD_RATE))
    ? Number(process.env.SHORT_VIDEO_REWARD_RATE)
    : 0.001;
  return { longRate, shortRate, defaultRate };
};
exports.getRewardRates = getRewardRates;

/**
 * Queue a wallet reward credit to be settled at 12:00 AM Midnight IST.
 * Atomically increases user's pendingBalance so it is immediately visible as pending.
 * Also tracks pending revenue on the video.
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

  // Track pending revenue on Video if linked
  if (videoId) {
    try {
      await Video.findByIdAndUpdate(videoId, {
        $inc: { pendingRevenue: numericAmount },
      });
    } catch (vErr) {
      console.warn(`[WalletSettlement] Warning updating video pending revenue: ${vErr.message}`);
    }
  }

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

          // Move pending revenue into settled revenue on Video
          if (credit.video) {
            try {
              await Video.findByIdAndUpdate(credit.video, {
                $inc: {
                  revenue: roundedAmount,
                  pendingRevenue: -credit.amount,
                },
              });
            } catch (vErr) {
              console.warn(`[WalletSettlement] Warning settling video revenue: ${vErr.message}`);
            }
          }

          settledCount++;
          settledAmount += credit.amount;
        }
      } catch (itemErr) {
        console.error(`[WalletSettlement] Error settling credit ${credit._id}:`, itemErr.message);
      }
    }

    // Safety cleanup: clamp any negative balances to 0
    await User.updateMany({ pendingBalance: { $lt: 0 } }, { $set: { pendingBalance: 0 } });
    await Video.updateMany({ pendingRevenue: { $lt: 0 } }, { $set: { pendingRevenue: 0 } });

    return { settledCount, settledAmount: Math.round(settledAmount * 100) / 100 };
  } catch (err) {
    console.error('[WalletSettlement] Error processing pending wallet credits:', err);
    return { error: err.message };
  } finally {
    isSettling = false;
  }
};

/**
 * Deducts all revenue generated by a video from the creator's wallet when the video is deleted.
 * Handles both already-credited/settled revenue and pending revenue accumulated today.
 */
exports.revertVideoEarningsOnDeletion = async ({
  videoId,
  ownerId,
  videoTitle = '',
  videoRevenue = 0,
  videoPendingRevenue = 0,
  deletedBy = null,
  deletedByRole = 'user',
}) => {
  if (!videoId || !ownerId) return { settledDeducted: 0, pendingDeducted: 0 };

  try {
    // 1. Find all credits generated for this video in the WalletCredit ledger
    const credits = await WalletCredit.find({
      video: videoId,
      status: { $in: ['credited', 'pending'] },
    }).lean();

    let settledSum = 0;
    let pendingSum = 0;
    const pendingCreditIds = [];

    for (const c of credits) {
      if (c.status === 'credited' && c.isCredited) {
        settledSum += Number(c.amount || 0);
      } else if (c.status === 'pending') {
        pendingSum += Number(c.amount || 0);
        pendingCreditIds.push(c._id);
      }
    }

    // Dual-layer reconciliation: use whichever is higher between the ledger records and Video document fields
    const roundedSettled = Math.max(
      Math.round(settledSum * 100) / 100,
      Math.round(Number(videoRevenue || 0) * 100) / 100
    );
    const roundedPending = Math.max(
      Math.round(pendingSum * 10000) / 10000,
      Math.round(Number(videoPendingRevenue || 0) * 10000) / 10000
    );

    // 2. Cancel all pending credits for this video so the midnight scheduler won't credit them
    if (pendingCreditIds.length > 0) {
      await WalletCredit.updateMany(
        { _id: { $in: pendingCreditIds } },
        { $set: { status: 'cancelled' } }
      );
    }

    // 3. Deduct from User's wallet balance, total earnings, and pending balance
    const userUpdates = {};
    if (roundedSettled > 0) {
      userUpdates.walletBalance = -roundedSettled;
      userUpdates.totalEarnings = -roundedSettled;
    }
    if (roundedPending > 0) {
      userUpdates.pendingBalance = -roundedPending;
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(ownerId, { $inc: userUpdates });

      // Safety clamps so balances never fall below zero
      await User.updateOne(
        { _id: ownerId, walletBalance: { $lt: 0 } },
        { $set: { walletBalance: 0 } }
      );
      await User.updateOne(
        { _id: ownerId, totalEarnings: { $lt: 0 } },
        { $set: { totalEarnings: 0 } }
      );
      await User.updateOne(
        { _id: ownerId, pendingBalance: { $lt: 0 } },
        { $set: { pendingBalance: 0 } }
      );

      // 4. Create an audit adjustment ledger entry in WalletCredit
      await WalletCredit.create({
        user: ownerId,
        video: videoId,
        amount: -(roundedSettled + roundedPending),
        source: 'adjustment',
        status: 'credited',
        isCredited: true,
        availableAt: new Date(),
        creditedAt: new Date(),
        meta: {
          action: 'video_deleted_revenue_reversal',
          videoTitle,
          deletedBy,
          deletedByRole,
          settledDeducted: roundedSettled,
          pendingDeducted: roundedPending,
        },
      });
    }

    return {
      settledDeducted: roundedSettled,
      pendingDeducted: roundedPending,
      totalDeducted: Math.round((roundedSettled + roundedPending) * 100) / 100,
    };
  } catch (err) {
    console.error(`[WalletSettlement] Error reverting earnings for deleted video ${videoId}:`, err);
    return { error: err.message };
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

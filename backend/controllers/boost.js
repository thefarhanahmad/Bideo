const User = require('../models/User');
const Video = require('../models/Video');
const VideoBoost = require('../models/VideoBoost');
const CoinTransaction = require('../models/CoinTransaction');
const Notification = require('../models/Notification');
const { processBoostQueue } = require('../utils/boostQueueScheduler');

const DAILY_MAX_ADS = 16;
const SESSION_BURST_MAX = 3;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const CYCLE_RESET_MS = 60 * 60 * 1000; // 1 hour reset after 16 ads
const BADGE_COIN_PRICE = 1500;
const BADGE_DURATION_DAYS = 30;

const BOOST_TIERS = {
  1: { hours: 1, coins: 100, label: '1 Hour', discount: null },
  3: { hours: 3, coins: 250, label: '3 Hours', discount: 'Save 50 coins' },
  6: { hours: 6, coins: 500, label: '6 Hours', discount: 'Save 100 coins' },
  24: { hours: 24, coins: 1000, label: '24 Hours', discount: 'Save 1,400 coins' },
};

/**
 * Helper to normalize and get user ad limits & cooldown status
 * Production-grade: 3 ads instant, 10 min session cooldown, and 16 ads resets after 1 hour.
 */
const getUserAdStatus = (user) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  let dailyCount = user.adRewards?.dailyCount || 0;
  let sessionCount = user.adRewards?.sessionCount || 0;
  const lastAdWatchedAt = user.adRewards?.lastAdWatchedAt ? new Date(user.adRewards.lastAdWatchedAt) : null;
  const now = Date.now();

  let cooldownSeconds = 0;
  let isCycleReset = false;

  // Reset counters if a new calendar day has started
  if (user.adRewards?.dailyDate && user.adRewards.dailyDate !== todayStr) {
    dailyCount = 0;
    sessionCount = 0;
  }

  // 1. Check if user reached the 16-ad cycle limit
  if (dailyCount >= DAILY_MAX_ADS) {
    if (lastAdWatchedAt) {
      const elapsed = now - lastAdWatchedAt.getTime();
      if (elapsed >= CYCLE_RESET_MS) {
        // 1-hour cooldown completed! Reset cycle back to 0
        dailyCount = 0;
        sessionCount = 0;
      } else {
        // Still inside 1-hour cycle reset cooldown
        cooldownSeconds = Math.ceil((CYCLE_RESET_MS - elapsed) / 1000);
        isCycleReset = true;
      }
    } else {
      dailyCount = 0;
      sessionCount = 0;
    }
  }

  // 2. Check session burst limit & 10-minute session cooldown
  if (dailyCount < DAILY_MAX_ADS && lastAdWatchedAt) {
    const elapsed = now - lastAdWatchedAt.getTime();
    if (elapsed >= COOLDOWN_MS) {
      // 10-minute cooldown expired or user was idle for 10+ min: unlock fresh 3-ad burst
      sessionCount = 0;
    } else if (sessionCount >= SESSION_BURST_MAX) {
      // Still inside 10-minute cooldown after 3-ad burst
      cooldownSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    }
  }

  const remainingDaily = Math.max(0, DAILY_MAX_ADS - dailyCount);
  const canWatch = remainingDaily > 0 && cooldownSeconds === 0;

  return {
    todayStr,
    dailyCount,
    sessionCount,
    remainingDaily,
    cooldownSeconds,
    isCycleReset,
    canWatch,
  };
};

/**
 * @route   GET /api/boost/status
 * @desc    Get user coins, ad watching status, boost queue status & active boosts
 * @access  Private
 */
exports.getBoostStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Process any queue expirations/promotions first
    await processBoostQueue();

    // Self-healing check for coin-purchased verified badge expiration
    if (
      user.isVerified &&
      user.verifiedUntil &&
      new Date(user.verifiedUntil) <= new Date() &&
      user.verifiedSource === 'coin_purchase'
    ) {
      user.isVerified = false;
      user.verifiedUntil = null;
      user.verifiedSource = null;
      await user.save();
    }

    const adStatus = getUserAdStatus(user);

    // Save normalization if cycle count or session state changed
    if (
      user.adRewards?.dailyCount !== adStatus.dailyCount ||
      user.adRewards?.sessionCount !== adStatus.sessionCount
    ) {
      user.adRewards = {
        dailyCount: adStatus.dailyCount,
        dailyDate: adStatus.todayStr,
        sessionCount: adStatus.sessionCount,
        lastAdWatchedAt: user.adRewards?.lastAdWatchedAt || null,
      };
      await user.save();
    }

    // Fetch user's active boost
    const activeBoost = await VideoBoost.findOne({
      user: req.user.id,
      status: 'active',
      expiresAt: { $gt: new Date() },
    }).populate('video', 'title thumbnail views duration');

    // Fetch user's queued boosts
    const queuedBoosts = await VideoBoost.find({
      user: req.user.id,
      status: 'queued',
    })
      .sort({ queuePosition: 1, createdAt: 1 })
      .populate('video', 'title thumbnail views duration');

    // Global queue stats
    const totalQueuedCount = await VideoBoost.countDocuments({ status: 'queued' });
    const globalActiveBoost = await VideoBoost.findOne({
      status: 'active',
      expiresAt: { $gt: new Date() },
    })
      .populate('video', 'title thumbnail')
      .populate('user', 'name channelName');

    res.status(200).json({
      success: true,
      data: {
        coins: user.coins || 0,
        dailyAds: {
          watched: adStatus.dailyCount,
          total: DAILY_MAX_ADS,
          remaining: adStatus.remainingDaily,
          sessionCount: adStatus.sessionCount,
          sessionMax: SESSION_BURST_MAX,
          cooldownSeconds: adStatus.cooldownSeconds,
          isCycleReset: adStatus.isCycleReset,
          canWatch: adStatus.canWatch,
        },
        verifiedBadge: {
          isVerified: Boolean(user.isVerified),
          verifiedUntil: user.verifiedUntil,
          verifiedSource: user.verifiedSource,
          priceCoins: BADGE_COIN_PRICE,
        },
        boostTiers: Object.values(BOOST_TIERS),
        activeBoost: activeBoost
          ? {
              _id: activeBoost._id,
              video: activeBoost.video,
              coinsSpent: activeBoost.coinsSpent,
              durationHours: activeBoost.durationHours,
              startedAt: activeBoost.startedAt,
              expiresAt: activeBoost.expiresAt,
              remainingSeconds: Math.max(0, Math.ceil((new Date(activeBoost.expiresAt).getTime() - Date.now()) / 1000)),
            }
          : null,
        queuedBoosts: queuedBoosts.map((b) => ({
          _id: b._id,
          video: b.video,
          coinsSpent: b.coinsSpent,
          durationHours: b.durationHours,
          queuePosition: b.queuePosition,
          estimatedStartTime: b.estimatedStartTime,
        })),
        globalQueue: {
          totalQueued: totalQueuedCount,
          currentActive: globalActiveBoost
            ? {
                videoTitle: globalActiveBoost.video?.title,
                channelName: globalActiveBoost.user?.channelName || globalActiveBoost.user?.name,
                expiresAt: globalActiveBoost.expiresAt,
              }
            : null,
        },
      },
    });
  } catch (err) {
    console.error('Error fetching boost status:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch boost status' });
  }
};

/**
 * @route   POST /api/boost/claim-ad-reward
 * @desc    Award coins after user successfully watches an AdMob rewarded ad
 * @access  Private
 */
exports.claimAdReward = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const adStatus = getUserAdStatus(user);

    if (adStatus.dailyCount >= DAILY_MAX_ADS) {
      const minutes = Math.ceil(adStatus.cooldownSeconds / 60) || 60;
      return res.status(400).json({
        success: false,
        cooldownSeconds: adStatus.cooldownSeconds,
        message: `Cycle limit reached (${DAILY_MAX_ADS}/${DAILY_MAX_ADS} ads). Limit resets in ${minutes} minutes!`,
      });
    }

    if (adStatus.cooldownSeconds > 0) {
      const minutes = Math.floor(adStatus.cooldownSeconds / 60);
      const seconds = adStatus.cooldownSeconds % 60;
      return res.status(400).json({
        success: false,
        cooldownSeconds: adStatus.cooldownSeconds,
        message: adStatus.isCycleReset
          ? `Cycle limit reached. Please wait ${minutes}m ${seconds}s for the 1-hour reset.`
          : `Cooldown active. Please wait ${minutes}m ${seconds}s before watching your next ad.`,
      });
    }

    // Calculate coin reward (1-6 coins: 80% chance 1-3, 20% chance 4-6)
    const isHighReward = Math.random() < 0.20;
    const coinsEarned = isHighReward
      ? Math.floor(Math.random() * 3) + 4 // 4, 5, 6
      : Math.floor(Math.random() * 3) + 1; // 1, 2, 3

    user.coins = (user.coins || 0) + coinsEarned;

    const newDailyCount = adStatus.dailyCount + 1;
    const newSessionCount = adStatus.sessionCount + 1;
    const now = new Date();

    user.adRewards = {
      dailyCount: newDailyCount,
      dailyDate: adStatus.todayStr,
      sessionCount: newSessionCount,
      lastAdWatchedAt: now,
    };

    await user.save();

    // Record coin transaction
    await CoinTransaction.create({
      user: user._id,
      type: 'ad_reward',
      amount: coinsEarned,
      balanceAfter: user.coins,
      description: `Watched rewarded ad (+${coinsEarned} coins)`,
      metadata: {
        dailyCount: newDailyCount,
        sessionCount: newSessionCount,
      },
    });

    // Check if new cooldown triggered:
    // If completed 16 ads -> 1-hour (3600s) cooldown; if reached 3 ads in session -> 10-minute (600s) cooldown
    let newCooldownSeconds = 0;
    if (newDailyCount >= DAILY_MAX_ADS) {
      newCooldownSeconds = 3600;
    } else if (newSessionCount >= SESSION_BURST_MAX) {
      newCooldownSeconds = 600;
    }

    res.status(200).json({
      success: true,
      data: {
        coinsEarned,
        totalCoins: user.coins,
        dailyWatched: newDailyCount,
        dailyTotal: DAILY_MAX_ADS,
        remainingDaily: Math.max(0, DAILY_MAX_ADS - newDailyCount),
        sessionCount: newSessionCount,
        cooldownSeconds: newCooldownSeconds,
      },
      message: `🎉 You earned ${coinsEarned} coins!`,
    });
  } catch (err) {
    console.error('Error claiming ad reward:', err);
    res.status(500).json({ success: false, message: 'Failed to claim ad reward' });
  }
};

/**
 * @route   POST /api/boost/create
 * @desc    Spend coins to boost / pin a video on the Home Feed (immediate or queued)
 * @access  Private
 */
exports.createVideoBoost = async (req, res) => {
  try {
    const { videoId, durationHours } = req.body;

    if (!videoId || !durationHours) {
      return res.status(400).json({ success: false, message: 'Video ID and duration are required' });
    }

    const tier = BOOST_TIERS[durationHours];
    if (!tier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid duration tier. Allowed values: 1, 3, 6, 24 hours',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if ((user.coins || 0) < tier.coins) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. You have ${user.coins || 0} coins, but this boost costs ${tier.coins} coins.`,
      });
    }

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      owner: req.user.id,
      visibility: 'public',
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found or is not publicly published.',
      });
    }

    // Check if video already has an active or queued boost
    const existingActiveOrQueued = await VideoBoost.findOne({
      video: videoId,
      status: { $in: ['active', 'queued'] },
    });

    if (existingActiveOrQueued) {
      return res.status(400).json({
        success: false,
        message: 'This video is already currently pinned or in the boost queue.',
      });
    }

    // Deduct coins
    user.coins -= tier.coins;
    await user.save();

    // Record coin transaction
    await CoinTransaction.create({
      user: user._id,
      type: 'boost_spend',
      amount: -tier.coins,
      balanceAfter: user.coins,
      description: `Boosted video "${video.title}" for ${tier.hours}h (-${tier.coins} coins)`,
      metadata: {
        videoId: video._id,
        durationHours: tier.hours,
      },
    });

    // Run queue check to see if an active boost exists right now
    await processBoostQueue();

    const now = new Date();
    const currentActive = await VideoBoost.findOne({
      status: 'active',
      expiresAt: { $gt: now },
    });

    let newBoost;

    if (!currentActive) {
      // Immediately activate
      const expiresAt = new Date(now.getTime() + tier.hours * 3600 * 1000);
      newBoost = await VideoBoost.create({
        video: video._id,
        user: user._id,
        coinsSpent: tier.coins,
        durationHours: tier.hours,
        status: 'active',
        queuePosition: 0,
        startedAt: now,
        expiresAt,
        estimatedStartTime: now,
      });

      await Video.findByIdAndUpdate(video._id, {
        isPinned: true,
        boostExpiresAt: expiresAt,
        boostType: 'user',
      });
    } else {
      // Queue behind existing boosts
      const lastQueued = await VideoBoost.findOne({ status: 'queued' }).sort({ estimatedStartTime: -1 });
      const baseTime = lastQueued && lastQueued.estimatedStartTime
        ? new Date(new Date(lastQueued.estimatedStartTime).getTime() + lastQueued.durationHours * 3600 * 1000)
        : new Date(currentActive.expiresAt.getTime());

      const queuedCount = await VideoBoost.countDocuments({ status: 'queued' });

      newBoost = await VideoBoost.create({
        video: video._id,
        user: user._id,
        coinsSpent: tier.coins,
        durationHours: tier.hours,
        status: 'queued',
        queuePosition: queuedCount + 1,
        estimatedStartTime: baseTime,
      });
    }

    // Refresh queue state
    await processBoostQueue();

    res.status(201).json({
      success: true,
      message: newBoost.status === 'active'
        ? `🚀 Success! "${video.title}" is now pinned at the top of the Home Feed!`
        : `⏳ Success! "${video.title}" is queued (Position #${newBoost.queuePosition}).`,
      data: {
        boost: newBoost,
        remainingCoins: user.coins,
      },
    });
  } catch (err) {
    console.error('Error creating video boost:', err);
    res.status(500).json({ success: false, message: 'Failed to boost video' });
  }
};

/**
 * @route   GET /api/boost/my-videos
 * @desc    Get user's public videos eligible for boosting
 * @access  Private
 */
exports.getMyEligibleVideos = async (req, res) => {
  try {
    const videos = await Video.find({
      owner: req.user.id,
      visibility: 'public',
      isShort: { $ne: true }, // Long videos for main feed pinning
    })
      .sort({ createdAt: -1 })
      .select('title thumbnail views duration isPinned createdAt')
      .lean();

    // Check which videos are currently active or queued in boost
    const activeBoosts = await VideoBoost.find({
      user: req.user.id,
      status: { $in: ['active', 'queued'] },
    }).select('video status queuePosition expiresAt estimatedStartTime');

    const boostMap = new Map();
    activeBoosts.forEach((b) => {
      boostMap.set(b.video.toString(), b);
    });

    const enrichedVideos = videos.map((v) => ({
      ...v,
      boostInfo: boostMap.get(v._id.toString()) || null,
      isBoosted: boostMap.has(v._id.toString()),
    }));

    res.status(200).json({
      success: true,
      data: enrichedVideos,
    });
  } catch (err) {
    console.error('Error fetching eligible videos:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch videos' });
  }
};

/**
 * @route   POST /api/boost/buy-verified-badge
 * @desc    Spend 1500 coins to purchase or extend a 1-month verified blue tick badge
 * @access  Private
 */
exports.buyVerifiedBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if ((user.coins || 0) < BADGE_COIN_PRICE) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. You have ${user.coins || 0} coins, but the Verified Badge costs ${BADGE_COIN_PRICE} coins.`,
      });
    }

    const now = new Date();
    // If user already has an active verified badge with future expiry, extend it by 30 days
    let newExpiryDate;
    if (user.isVerified && user.verifiedUntil && new Date(user.verifiedUntil) > now) {
      newExpiryDate = new Date(new Date(user.verifiedUntil).getTime() + BADGE_DURATION_DAYS * 24 * 60 * 60 * 1000);
    } else {
      newExpiryDate = new Date(now.getTime() + BADGE_DURATION_DAYS * 24 * 60 * 60 * 1000);
    }

    // Production-grade atomic deduction preventing race condition double-spending
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        coins: { $gte: BADGE_COIN_PRICE },
      },
      {
        $inc: { coins: -BADGE_COIN_PRICE },
        $set: {
          isVerified: true,
          verifiedSource: 'coin_purchase',
          verifiedUntil: newExpiryDate,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: 'Transaction could not be completed. Please check your coin balance.',
      });
    }

    // Record coin transaction
    await CoinTransaction.create({
      user: updatedUser._id,
      type: 'verified_badge_spend',
      amount: -BADGE_COIN_PRICE,
      balanceAfter: updatedUser.coins,
      description: `Purchased 1-Month Verified Badge (-${BADGE_COIN_PRICE} coins)`,
      metadata: {
        verifiedUntil: newExpiryDate,
        durationDays: BADGE_DURATION_DAYS,
      },
    });

    // Create system notification for user
    const formattedExpiry = newExpiryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const message = `🎉 Congratulations! Your profile is now officially Verified with a blue tick until ${formattedExpiry}!`;

    Notification.create({
      recipient: updatedUser._id,
      actor: updatedUser._id,
      type: 'system',
      message,
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `🎉 Success! You are now verified with the official blue badge until ${formattedExpiry}!`,
      data: {
        isVerified: true,
        verifiedUntil: newExpiryDate,
        verifiedSource: updatedUser.verifiedSource,
        remainingCoins: updatedUser.coins,
      },
    });
  } catch (err) {
    console.error('Error purchasing verified badge:', err);
    res.status(500).json({ success: false, message: 'Failed to purchase verified badge' });
  }
};


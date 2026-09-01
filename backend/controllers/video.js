const mongoose = require("mongoose");
const Video = require("../models/Video");
const User = require("../models/User");
const Category = require("../models/Category");
const Follower = require("../models/Follower");
const VideoView = require("../models/VideoView");
const VideoReport = require("../models/VideoReport");
const Notification = require("../models/Notification");
const VideoMonetizationReview = require("../models/VideoMonetizationReview");
const MonetizationApplication = require("../models/MonetizationApplication");
const fs = require("fs");
const { saveLocalFile, deleteLocalFile } = require("../utils/localUpload");

const FALLBACK_THUMBNAIL =
  "https://via.placeholder.com/640x360.png?text=Tube+India";

const formatDefaultTitle = () =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (!tags || typeof tags !== "string") return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizeOptionalValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null")
      return undefined;
    return trimmed;
  }
  return value;
};

const isNineBySixteen = (aspectRatio) => {
  if (!aspectRatio) return false;
  const target = 9 / 16;
  return Math.abs(aspectRatio - target) <= 0.035;
};

const applyVideoTypeFilter = (query, type) => {
  if (type === "short") query.isShort = true;
  if (type === "video" || type === "long") query.isShort = { $ne: true };
  return query;
};

const getVideoQuery = (req) => {
  const query = {};
  const isAdmin = req.user && req.user.role === "admin";

  // Admin can view all or specific visibility; public users only see public videos
  if (req.query.visibility && req.query.visibility !== "all") {
    query.visibility = req.query.visibility;
  } else if (!isAdmin) {
    query.visibility = "public";
  }

  if (req.query.owner) query.owner = req.query.owner;
  if (req.query.category) query.category = req.query.category;
  if (req.query.isPinned !== undefined) {
    query.isPinned = req.query.isPinned === "true";
  }
  return applyVideoTypeFilter(query, req.query.type);
};

const getSort = (sort) => {
  if (sort === "popular") return { isPinned: -1, views: -1, createdAt: -1 };
  if (sort === "oldest") return { createdAt: 1 };
  return { isPinned: -1, createdAt: -1 };
};

const formatMediaUrl = (url, req) => {
  if (!url) return url;
  if (
    url.startsWith("https://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  ) {
    return url;
  }

  let serverBase = process.env.BASE_URL;
  if (!serverBase && req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host =
      req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
    serverBase = `${proto}://${host}`;
  }
  if (!serverBase) return url;
  serverBase = serverBase.replace(/\/$/, "");

  if (url.startsWith("/")) {
    return `${serverBase}${url}`;
  }

  if (url.includes("localhost:5000") || url.includes("127.0.0.1:5000")) {
    return url
      .replace(/https?:\/\/localhost:5000/, serverBase)
      .replace(/https?:\/\/127\.0\.0\.1:5000/, serverBase);
  }

  return url;
};

const decorateVideos = async (videos, req) => {
  let results = videos.map((v) => {
    const obj = typeof v.toObject === "function" ? v.toObject() : { ...v };
    if (obj.thumbnail) obj.thumbnail = formatMediaUrl(obj.thumbnail, req);
    if (obj.videoUrl) obj.videoUrl = formatMediaUrl(obj.videoUrl, req);
    if (obj.owner && obj.owner.avatar)
      obj.owner.avatar = formatMediaUrl(obj.owner.avatar, req);
    return obj;
  });

  if (!req.user) return results;

  const user = await User.findById(req.user.id);
  results = results.map((v) => ({
    ...v,
    isLiked: v.likes
      ? v.likes.some((id) => id.toString() === req.user.id.toString())
      : false,
    isDisliked: v.dislikes
      ? v.dislikes.some((id) => id.toString() === req.user.id.toString())
      : false,
    isFollowing:
      user && user.followingChannels && v.owner
        ? user.followingChannels.some(
            (id) =>
              id.toString() ===
              (v.owner._id ? v.owner._id.toString() : v.owner.toString()),
          )
        : false,
  }));
  return results;
};

// Helper for escaping regex strings
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Helper to tokenize query into individual keywords and clean phrases
const parseSearchKeywords = (rawQuery) => {
  const clean = (rawQuery || "").trim();
  if (!clean) return { phrase: "", terms: [], regexes: [], phraseRegex: null };

  const phrase = clean.replace(/^[#@]+/, "").trim();
  const phraseRegex = new RegExp(escapeRegex(phrase), "i");

  // Split on whitespace, commas, pluses, slashes, hashtags
  const rawTerms = clean
    .split(/[\s,+#|/]+/)
    .map((t) => t.trim().replace(/^[#@]+/, ""))
    .filter((t) => t.length > 0);

  const terms = Array.from(new Set(rawTerms));
  const regexes = terms.map((t) => new RegExp(escapeRegex(t), "i"));

  return { phrase, terms, regexes, phraseRegex };
};

// Relevance scorer for videos
const scoreVideoRelevance = (v, { phrase, terms }) => {
  let score = 0;
  const title = (v.title || "").toLowerCase();
  const desc = (v.description || "").toLowerCase();
  const channel = (v.owner?.channelName || "").toLowerCase();
  const ownerName = (v.owner?.name || "").toLowerCase();
  const catName = (v.category?.name || "").toLowerCase();
  const idStr = (v._id ? v._id.toString() : "").toLowerCase();

  const rawTags = Array.isArray(v.tags) ? v.tags : (v.tags || "").split(",");
  const tags = rawTags
    .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
    .filter(Boolean);
  const tagsStr = tags.join(" ");

  const phraseLower = phrase.toLowerCase();

  // 1. Exact Video ID Match
  if (idStr && idStr === phraseLower) return 10000;

  // 2. Title scoring
  if (title === phraseLower) score += 3000;
  else if (title.startsWith(phraseLower)) score += 1500;
  else if (title.includes(phraseLower)) score += 800;

  // 3. Tag scoring
  if (tags.includes(phraseLower)) score += 1200;
  else if (tagsStr.includes(phraseLower)) score += 600;

  // 4. Channel / Owner scoring
  if (channel === phraseLower || ownerName === phraseLower) score += 1000;
  else if (channel.includes(phraseLower) || ownerName.includes(phraseLower))
    score += 500;

  // 5. Description scoring
  if (desc.includes(phraseLower)) score += 200;

  // 6. Category scoring
  if (catName.includes(phraseLower)) score += 150;

  // 7. Individual keyword terms scoring
  let matchedTermsCount = 0;
  for (const term of terms) {
    const tLower = term.toLowerCase();
    let termMatched = false;

    if (title.includes(tLower)) {
      score += 250;
      termMatched = true;
    }
    if (tags.some((tag) => tag.includes(tLower) || tLower.includes(tag))) {
      score += 200;
      termMatched = true;
    }
    if (channel.includes(tLower) || ownerName.includes(tLower)) {
      score += 180;
      termMatched = true;
    }
    if (desc.includes(tLower)) {
      score += 50;
      termMatched = true;
    }
    if (catName.includes(tLower)) {
      score += 40;
      termMatched = true;
    }

    if (termMatched) matchedTermsCount++;
  }

  // Bonus if all terms matched
  if (terms.length > 1 && matchedTermsCount === terms.length) {
    score += 500;
  }

  // Engagement tie-breaker (views)
  score += Math.min(20, Math.log10((v.views || 0) + 1) * 3);

  return score;
};

// Relevance scorer for users / channels
const scoreUserRelevance = (u, { phrase, terms }) => {
  let score = 0;
  const channel = (u.channelName || "").toLowerCase();
  const name = (u.name || "").toLowerCase();
  const email = (u.email || "").toLowerCase();
  const phone = (u.phone || "").toLowerCase();
  const about = (u.about || "").toLowerCase();
  const idStr = (
    u._id ? u._id.toString() : u.id ? u.id.toString() : ""
  ).toLowerCase();
  const phraseLower = phrase.toLowerCase();

  if (idStr && idStr === phraseLower) return 10000;

  if (channel === phraseLower || name === phraseLower) score += 3000;
  else if (channel.startsWith(phraseLower) || name.startsWith(phraseLower))
    score += 1500;
  else if (channel.includes(phraseLower) || name.includes(phraseLower))
    score += 800;

  if (email.includes(phraseLower) || phone.includes(phraseLower)) score += 700;
  if (about.includes(phraseLower)) score += 150;

  let matchedTermsCount = 0;
  for (const term of terms) {
    const tLower = term.toLowerCase();
    let termMatched = false;
    if (channel.includes(tLower)) {
      score += 300;
      termMatched = true;
    }
    if (name.includes(tLower)) {
      score += 250;
      termMatched = true;
    }
    if (email.includes(tLower) || phone.includes(tLower)) {
      score += 200;
      termMatched = true;
    }
    if (about.includes(tLower)) {
      score += 50;
      termMatched = true;
    }
    if (termMatched) matchedTermsCount++;
  }

  if (terms.length > 1 && matchedTermsCount === terms.length) score += 500;
  if (u.isVerified) score += 50;

  return score;
};

exports.searchVideos = async (req, res, next) => {
  try {
    const rawQ = req.query.q || req.query.search || "";
    const q = rawQ.trim();
    if (!q)
      return res
        .status(200)
        .json({ success: true, count: 0, data: { channels: [], videos: [] } });

    const { phrase, terms, regexes, phraseRegex } = parseSearchKeywords(q);
    const isObjectId = mongoose.Types.ObjectId.isValid(q);
    const isAdmin = req.user && req.user.role === "admin";

    // 1. Search channels (users with a channelName or matching name/email/phone)
    const channelOrClauses = [];
    if (phraseRegex) {
      channelOrClauses.push({ channelName: phraseRegex });
      channelOrClauses.push({ name: phraseRegex });
      channelOrClauses.push({ email: phraseRegex });
      channelOrClauses.push({ phone: phraseRegex });
    }
    regexes.forEach((tRegex) => {
      channelOrClauses.push({ channelName: tRegex });
      channelOrClauses.push({ name: tRegex });
      channelOrClauses.push({ email: tRegex });
      channelOrClauses.push({ phone: tRegex });
    });
    if (isObjectId) {
      channelOrClauses.push({ _id: q });
    }

    const channels = await User.find({ $or: channelOrClauses })
      .select("name avatar channelName followersCount about isVerified role")
      .limit(30)
      .lean();

    const channelIds = channels.map((c) => c._id);

    // 2. Search videos (matches title, description, tags, matching channel/creator, or ID)
    const videoOrClauses = [];
    if (phraseRegex) {
      videoOrClauses.push({ title: phraseRegex });
      videoOrClauses.push({ description: phraseRegex });
      videoOrClauses.push({ tags: phraseRegex });
      videoOrClauses.push({ tags: { $in: [phraseRegex] } });
    }
    regexes.forEach((tRegex) => {
      videoOrClauses.push({ title: tRegex });
      videoOrClauses.push({ description: tRegex });
      videoOrClauses.push({ tags: tRegex });
      videoOrClauses.push({ tags: { $in: [tRegex] } });
    });
    if (channelIds.length > 0) {
      videoOrClauses.push({ owner: { $in: channelIds } });
    }
    if (isObjectId) {
      videoOrClauses.push({ _id: q });
    }

    const videoQuery = { $or: videoOrClauses };

    if (!isAdmin) {
      videoQuery.visibility = "public";
    }

    const videos = await Video.find(videoQuery)
      .populate("owner", "name avatar channelName followersCount isVerified")
      .populate("category", "name")
      .limit(60)
      .lean();

    // Score and rank channels
    const scoredChannels = channels
      .map((c) => ({ ...c, _score: scoreUserRelevance(c, { phrase, terms }) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    const channelsData = [];
    for (let c of scoredChannels) {
      const channelObj = typeof c === "object" ? { ...c } : c;
      if (req.user) {
        const isFollowing = await Follower.findOne({
          follower: req.user.id,
          channel: c._id,
        });
        channelObj.isFollowing = !!isFollowing;
      } else {
        channelObj.isFollowing = false;
      }
      channelsData.push(channelObj);
    }

    // Score and rank videos
    const scoredVideos = videos
      .map((v) => ({ ...v, _score: scoreVideoRelevance(v, { phrase, terms }) }))
      .sort((a, b) => b._score - a._score);

    const results = await decorateVideos(scoredVideos, req);

    res.status(200).json({
      success: true,
      count: results.length,
      data: {
        channels: channelsData,
        videos: results,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getVideos = async (req, res, next) => {
  try {
    const isAdmin = req.user && req.user.role === "admin";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const requestedLimit = parseInt(req.query.limit, 10);
    const fetchAll = req.query.all === "true" || req.query.limit === "all";

    // Set appropriate pagination limits
    let limit = 50;
    if (fetchAll) {
      limit = 3000;
    } else if (requestedLimit > 0) {
      limit = isAdmin
        ? Math.min(requestedLimit, 3000)
        : Math.min(requestedLimit, 100);
    }
    const skip = (page - 1) * limit;

    const query = getVideoQuery(req);

    // Support search query parameter in getVideos
    const rawSearch = (req.query.search || req.query.q || "").trim();
    let searchKeywords = null;

    if (rawSearch) {
      searchKeywords = parseSearchKeywords(rawSearch);
      const { phrase, terms, regexes, phraseRegex } = searchKeywords;
      const isObjectId = mongoose.Types.ObjectId.isValid(rawSearch);

      const userSearchOr = [];
      if (phraseRegex) {
        userSearchOr.push(
          { name: phraseRegex },
          { channelName: phraseRegex },
          { email: phraseRegex },
          { phone: phraseRegex },
        );
      }
      regexes.forEach((tRegex) => {
        userSearchOr.push(
          { name: tRegex },
          { channelName: tRegex },
          { email: tRegex },
          { phone: tRegex },
        );
      });

      const [matchingUsers, matchingCategories] = await Promise.all([
        User.find({ $or: userSearchOr }).select("_id").lean(),
        Category.find({
          $or: [
            ...(phraseRegex
              ? [{ name: phraseRegex }, { slug: phraseRegex }]
              : []),
            ...regexes.map((r) => ({ name: r })),
          ],
        })
          .select("_id")
          .lean(),
      ]);

      const matchingUserIds = matchingUsers.map((u) => u._id);
      const matchingCatIds = matchingCategories.map((c) => c._id);

      const searchOr = [];
      if (phraseRegex) {
        searchOr.push(
          { title: phraseRegex },
          { description: phraseRegex },
          { tags: phraseRegex },
          { tags: { $in: [phraseRegex] } },
        );
      }
      regexes.forEach((tRegex) => {
        searchOr.push(
          { title: tRegex },
          { description: tRegex },
          { tags: tRegex },
          { tags: { $in: [tRegex] } },
        );
      });

      if (matchingUserIds.length > 0) {
        searchOr.push({ owner: { $in: matchingUserIds } });
      }
      if (matchingCatIds.length > 0) {
        searchOr.push({ category: { $in: matchingCatIds } });
      }
      if (isObjectId) {
        searchOr.push({ _id: rawSearch });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const sortOption = req.query.sort;
    const [videos, total] = await Promise.all([
      Video.find(query)
        .populate(
          "owner",
          "name avatar channelName followersCount isVerified email phone",
        )
        .populate("category", "name")
        .sort(getSort(sortOption))
        .skip(skip)
        .limit(limit)
        .lean(),
      Video.countDocuments(query),
    ]);

    let results = await decorateVideos(videos, req);

    // If searching and no explicit custom sort requested, rank by keyword relevance
    if (searchKeywords && (!sortOption || sortOption === "latest")) {
      results = results
        .map((v) => ({ ...v, _score: scoreVideoRelevance(v, searchKeywords) }))
        .sort((a, b) => b._score - a._score);
    }

    res.status(200).json({
      success: true,
      count: results.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

exports.getVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate("owner", "name avatar channelName followersCount isVerified")
      .populate("category", "name");

    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    if (video.visibility !== "public") {
      const isOwner =
        req.user &&
        video.owner &&
        video.owner._id &&
        video.owner._id.toString() === req.user.id.toString();
      const isAdmin = req.user && req.user.role === "admin";
      if (!isOwner && !isAdmin) {
        return res
          .status(404)
          .json({ success: false, message: "Video not found" });
      }
    }

    const [videoData] = await decorateVideos([video], req);
    res.status(200).json({ success: true, data: videoData });
  } catch (err) {
    next(err);
  }
};

exports.recordView = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user?._id;
    const deviceId =
      req.headers["x-device-id"] ||
      req.body.deviceId ||
      req.ip ||
      req.connection?.remoteAddress ||
      "anonymous_viewer";

    // 5-hour cooldown deduplication window per user / device
    const VIEW_COOLDOWN_MS = 5 * 60 * 60 * 1000; // 5 hours
    const cooldownDate = new Date(Date.now() - VIEW_COOLDOWN_MS);

    const existingViewQuery = {
      video: video._id,
      createdAt: { $gte: cooldownDate },
    };

    if (userId) {
      existingViewQuery.user = userId;
    } else {
      existingViewQuery.deviceId = String(deviceId);
    }

    const recentView = await VideoView.findOne(existingViewQuery).lean();

    if (recentView) {
      // Repeat view within 5-hour cooldown window: ignore duplicate count & earnings
      return res.status(200).json({
        success: true,
        message: "Repeat view within 5h cooldown window",
        views: video.views,
      });
    }

    // Record the valid new view log
    try {
      await VideoView.create({
        video: video._id,
        user: userId || undefined,
        deviceId: userId ? undefined : String(deviceId),
      });
    } catch (err) {
      if (err.code !== 11000)
        console.warn("VideoView logging warning:", err.message);
    }

    const updatedVideo = await Video.findByIdAndUpdate(
      video._id,
      { $inc: { views: 1 } },
      { new: true },
    );

    // Real-time earnings: credit ₹0.15 per view (₹150 per 1,000 views) ONLY when a real viewer (not the creator) watches
    const isSelfView =
      userId && video.owner && userId.toString() === video.owner.toString();
    if (video.owner && !isSelfView) {
      try {
        const isMonetized = await MonetizationApplication.exists({
          user: video.owner,
          status: "approved",
        });
        if (isMonetized) {
          const rewardPerView = Number(process.env.VIEW_REWARD_RATE) || 0.15;
          await User.findByIdAndUpdate(video.owner, {
            $inc: {
              walletBalance: rewardPerView,
              totalEarnings: rewardPerView,
            },
          });
        }
      } catch (earnErr) {
        console.error("Failed to credit view earnings:", earnErr);
      }
    }

    res.status(200).json({
      success: true,
      views: updatedVideo ? updatedVideo.views : video.views + 1,
    });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedVideos = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id });
    const channelIds = followings.map((f) => f.channel);
    const query = applyVideoTypeFilter(
      { owner: { $in: channelIds }, visibility: "public" },
      req.query.type,
    );

    const videos = await Video.find(query)
      .populate("owner", "name avatar channelName followersCount isVerified")
      .populate("category", "name")
      .sort("-createdAt");

    const results = await decorateVideos(videos, req);
    res
      .status(200)
      .json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getMyVideos = async (req, res, next) => {
  try {
    const query = applyVideoTypeFilter({ owner: req.user.id }, req.query.type);
    const videos = await Video.find(query)
      .populate("owner", "name avatar channelName isVerified")
      .populate("category", "name")
      .sort("-createdAt");
    res.status(200).json({ success: true, count: videos.length, data: videos });
  } catch (err) {
    next(err);
  }
};

exports.toggleLike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user.id;
    const userIdStr = userId.toString();
    const alreadyLiked = (video.likes || []).some((id) => id.toString() === userIdStr);

    let updatedVideo;
    if (alreadyLiked) {
      updatedVideo = await Video.findByIdAndUpdate(
        video._id,
        { $pull: { likes: userId } },
        { new: true }
      );
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { likedVideos: video._id },
      });
    } else {
      updatedVideo = await Video.findByIdAndUpdate(
        video._id,
        {
          $addToSet: { likes: userId },
          $pull: { dislikes: userId },
        },
        { new: true }
      );
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { likedVideos: video._id },
      });
      await createNotification({
        recipient: video.owner,
        actor: req.user.id,
        type: "video_like",
        video: video._id,
        message: `${req.user.channelName || req.user.name} liked your video`,
      });
    }

    res.status(200).json({
      success: true,
      likes: updatedVideo ? updatedVideo.likes : [],
      dislikes: updatedVideo ? updatedVideo.dislikes : [],
      isLiked: !alreadyLiked,
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleDislike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user.id;
    const userIdStr = userId.toString();
    const alreadyDisliked = (video.dislikes || []).some((id) => id.toString() === userIdStr);

    let updatedVideo;
    if (alreadyDisliked) {
      updatedVideo = await Video.findByIdAndUpdate(
        video._id,
        { $pull: { dislikes: userId } },
        { new: true }
      );
    } else {
      updatedVideo = await Video.findByIdAndUpdate(
        video._id,
        {
          $addToSet: { dislikes: userId },
          $pull: { likes: userId },
        },
        { new: true }
      );
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { likedVideos: video._id },
      });
    }

    res.status(200).json({
      success: true,
      likes: updatedVideo ? updatedVideo.likes : [],
      dislikes: updatedVideo ? updatedVideo.dislikes : [],
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadVideo = async (req, res, next) => {
  const tempFiles = [];
  try {
    if (!req.files || !req.files.video || !req.files.video[0]) {
      return res
        .status(400)
        .json({ success: false, message: "Please upload a video file" });
    }

    tempFiles.push(req.files.video[0].path);
    if (req.files.thumbnail && req.files.thumbnail[0]) {
      tempFiles.push(req.files.thumbnail[0].path);
    }

    const uploadType = req.body.uploadType === "short" ? "short" : "video";

    // Save video locally
    const videoResult = await saveLocalFile(req, req.files.video[0], "video");
    const videoIdx = tempFiles.indexOf(req.files.video[0].path);
    if (videoIdx !== -1) tempFiles.splice(videoIdx, 1);

    // Read details passed from frontend or default to 0
    const width = Number(req.body.width || 0);
    const height = Number(req.body.height || 0);
    const aspectRatio = width && height ? width / height : null;
    let duration = Number(req.body.duration || 0);
    if (duration > 1000) {
      duration = Math.round(duration / 1000);
    }

    if (uploadType === "short" && !isNineBySixteen(aspectRatio)) {
      await deleteLocalFile(videoResult.url);
      return res.status(400).json({
        success: false,
        message: "Shorts must be portrait 9:16 videos",
      });
    }

    const originalVideoSize = Number(req.body.originalVideoSize || 0);
    const compressedVideoSize = req.files.video[0].size || 0;

    let originalThumbnailSize = 0;
    let compressedThumbnailSize = 0;

    let thumbnail = FALLBACK_THUMBNAIL;
    if (req.files.thumbnail && req.files.thumbnail[0]) {
      originalThumbnailSize = Number(req.body.originalThumbnailSize || 0);
      compressedThumbnailSize = req.files.thumbnail[0].size || 0;

      const thumbnailResult = await saveLocalFile(
        req,
        req.files.thumbnail[0],
        "image",
      );
      thumbnail = thumbnailResult.url;
      const thumbIdx = tempFiles.indexOf(req.files.thumbnail[0].path);
      if (thumbIdx !== -1) tempFiles.splice(thumbIdx, 1);
    }

    let targetOwnerId = req.user.id;
    if (req.user.role === "admin" && req.body.owner) {
      const targetUser = await User.findById(req.body.owner);
      if (targetUser) {
        targetOwnerId = targetUser._id;
      }
    }

    let isPinned = false;
    if (
      req.user.role === "admin" &&
      (req.body.isPinned === "true" || req.body.isPinned === true)
    ) {
      isPinned = true;
    }

    const video = await Video.create({
      title: req.body.title || formatDefaultTitle(),
      description: req.body.description || "",
      category: req.body.category || undefined,
      tags: normalizeTags(req.body.tags),
      videoUrl: videoResult.url,
      thumbnail: thumbnail,
      duration: duration,
      isShort: uploadType === "short",
      isPinned,
      aspectRatio,
      owner: targetOwnerId,
      visibility: req.body.visibility || "public",
      originalVideoSize,
      compressedVideoSize,
      originalThumbnailSize,
      compressedThumbnailSize,
    });

    // Auto-create pending monetization review
    await VideoMonetizationReview.create({
      video: video._id,
      user: targetOwnerId,
      status: "pending",
    });

    res.status(201).json({ success: true, data: video });
  } catch (err) {
    next(err);
  } finally {
    for (const filePath of tempFiles) {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`Failed to delete temp file ${filePath}:`, err);
        }
      });
    }
  }
};

exports.updateVideo = async (req, res, next) => {
  const tempFiles = [];
  try {
    let video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    const isOwner =
      video.owner && video.owner.toString() === req.user.id.toString();
    const isAdmin =
      req.user && (req.user.role === "admin" || req.user.isAdmin === true);

    if (!isOwner && !isAdmin) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this video",
      });
    }

    const updates = {};
    ["title", "description", "category", "visibility"].forEach((key) => {
      const value = normalizeOptionalValue(req.body[key]);
      if (value !== undefined) updates[key] = value;
    });
    if (req.body.tags !== undefined)
      updates.tags = normalizeTags(req.body.tags);

    if (isAdmin && req.body.owner) {
      const targetUser = await User.findById(req.body.owner);
      if (targetUser) {
        updates.owner = targetUser._id;
      }
    }

    if (isAdmin && req.body.isPinned !== undefined) {
      updates.isPinned =
        req.body.isPinned === "true" || req.body.isPinned === true;
    }

    if (req.body.duration !== undefined && req.body.duration !== null) {
      let dur = Number(req.body.duration);
      if (dur > 1000) dur = Math.round(dur / 1000);
      updates.duration = dur;
    }

    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      tempFiles.push(req.files.thumbnail[0].path);
      const thumbnailResult = await saveLocalFile(
        req,
        req.files.thumbnail[0],
        "image",
      );
      updates.thumbnail = thumbnailResult.url;
      updates.originalThumbnailSize = Number(
        req.body.originalThumbnailSize || 0,
      );
      updates.compressedThumbnailSize = req.files.thumbnail[0].size || 0;
      const thumbIdx = tempFiles.indexOf(req.files.thumbnail[0].path);
      if (thumbIdx !== -1) tempFiles.splice(thumbIdx, 1);

      if (video.thumbnail) await deleteLocalFile(video.thumbnail);
    }

    video = await Video.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ success: true, data: video });
  } catch (err) {
    next(err);
  } finally {
    for (const filePath of tempFiles) {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.error(`Failed to delete temp file ${filePath}:`, err);
        }
      });
    }
  }
};

exports.reportVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    const reason = (req.body.reason || "").trim();
    if (!reason)
      return res
        .status(400)
        .json({ success: false, message: "Report reason is required" });

    const report = await VideoReport.findOneAndUpdate(
      { video: video._id, reporter: req.user.id },
      { reason, status: "open", updatedAt: Date.now() },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    if (video.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this video",
      });
    }

    if (video.videoUrl) await deleteLocalFile(video.videoUrl);
    if (video.thumbnail) await deleteLocalFile(video.thumbnail);

    await video.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

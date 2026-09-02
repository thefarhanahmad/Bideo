const mongoose = require('mongoose');
const User = require('../models/User');

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't", 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', "can't", 'cannot', 'could', "couldn't",
  'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't", 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself', 'his', 'how', "how's",
  'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself',
  'let', "let's", 'me', 'more', 'most', "mustn't", 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', "shan't", 'she', "she'd", "she'll", "she's", 'should', "shouldn't", 'so', 'some', 'such',
  'than', 'that', "that's", 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've", 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', "wasn't", 'we', "we'd", "we'll", "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which', 'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't", 'would', "wouldn't",
  'you', "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves',
  // Common video/media filler terms
  'video', 'videos', 'watch', 'official', 'full', 'hd', 'part', 'new', 'best', 'latest', 'top', 'bideo'
]);

/**
 * Tokenize string into lowercase meaningful keywords, filtering out stopwords
 */
const extractKeywords = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s#]/g, ' ')
    .split(/[\s,+#|/]+/)
    .map((w) => w.trim().replace(/^#+/, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
};

/**
 * Fisher-Yates array shuffle helper
 */
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Build user interest profile from their last up to 5 watched videos.
 * Handles cases where the user has watched fewer than 5 videos (1, 2, 3, or 4)
 * by dynamically weighting recency and scaling relevance.
 * Returns null if user is not logged in or has empty watch history.
 */
const getUserInterestProfile = async (user) => {
  if (!user || (!user._id && !user.id)) return null;

  try {
    const userId = user._id || user.id;
    const userDoc = await User.findById(userId)
      .select({ watchHistory: { $slice: 5 } })
      .populate({
        path: 'watchHistory',
        select: 'title description tags category owner',
        populate: { path: 'category', select: '_id name' },
      })
      .lean();

    if (!userDoc || !userDoc.watchHistory || userDoc.watchHistory.length === 0) {
      return null;
    }

    // Filter out null or missing video entries (e.g. deleted videos)
    const watchedVideos = userDoc.watchHistory.filter((v) => v && (v._id || v.title));
    if (watchedVideos.length === 0) return null;

    const watchedVideoIds = new Set(watchedVideos.map((v) => (v._id ? v._id.toString() : '')));
    const categoryWeights = new Map(); // categoryId -> weight
    const categoryNames = new Set();
    const creatorIds = new Set();
    const keywordSet = new Set();

    watchedVideos.forEach((v, idx) => {
      // Recency weight: 1st (most recent) = 5, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1
      // If user has watched fewer than 5, the most recent still gets top weight (5)
      const recencyWeight = 5 - idx;

      // 1. Category extraction
      if (v.category) {
        const catId = (v.category._id || v.category).toString();
        categoryWeights.set(catId, (categoryWeights.get(catId) || 0) + recencyWeight);
        if (v.category.name) {
          categoryNames.add(v.category.name.toLowerCase());
        }
      }

      // 2. Creator extraction
      if (v.owner) {
        const ownerId = (v.owner._id || v.owner).toString();
        creatorIds.add(ownerId);
      }

      // 3. Keywords from title, tags, description
      const titleKeywords = extractKeywords(v.title);
      titleKeywords.forEach((k) => keywordSet.add(k));

      const tagKeywords = extractKeywords(Array.isArray(v.tags) ? v.tags.join(' ') : v.tags);
      tagKeywords.forEach((k) => keywordSet.add(k));

      const descKeywords = extractKeywords(v.description).slice(0, 8);
      descKeywords.forEach((k) => keywordSet.add(k));
    });

    return {
      watchedVideoIds,
      categoryWeights,
      categoryNames: Array.from(categoryNames),
      creatorIds,
      keywords: Array.from(keywordSet).slice(0, 40),
    };
  } catch (err) {
    console.error('Error constructing user interest profile:', err);
    return null;
  }
};

/**
 * Ranks candidate videos/shorts according to user interest profile and applies
 * tier-based shuffling so recommendations are relevant yet dynamically randomized.
 * Pinned videos always stay at the top.
 */
const rankAndShuffleVideos = (videos, profile) => {
  if (!videos || videos.length === 0) return [];

  const pinned = [];
  const regular = [];

  for (const v of videos) {
    if (v.isPinned === true || v.isPinned === 'true') {
      pinned.push(v);
    } else {
      regular.push(v);
    }
  }

  // If no profile (guest or no watch history), return pinned first, then shuffled regular
  if (!profile) {
    return [...pinned, ...shuffle(regular)];
  }

  const scored = regular.map((v) => {
    let score = 0;
    const catId = (v.category?._id || v.category || '').toString();
    const catName = (v.category?.name || '').toLowerCase();
    const ownerId = (v.owner?._id || v.owner || '').toString();
    const vId = (v._id || '').toString();

    // Already-watched video penalty so user is recommended fresh videos
    if (profile.watchedVideoIds.has(vId)) {
      score -= 300;
    }

    // 1. Category Matching (Dominant factor)
    if (catId && profile.categoryWeights.has(catId)) {
      score += profile.categoryWeights.get(catId) * 80;
    } else if (catName && profile.categoryNames.includes(catName)) {
      score += 60;
    }

    // 2. Creator Matching
    if (ownerId && profile.creatorIds.has(ownerId)) {
      score += 40;
    }

    // 3. Title & Tags Keyword Matching
    const titleLower = (v.title || '').toLowerCase();
    const rawTags = Array.isArray(v.tags) ? v.tags.join(' ') : (v.tags || '');
    const tagsLower = rawTags.toLowerCase();

    for (const kw of profile.keywords) {
      if (titleLower.includes(kw)) {
        score += 30;
      }
      if (tagsLower.includes(kw)) {
        score += 20;
      }
    }

    // 4. Description Keyword Matching
    const descLower = (v.description || '').toLowerCase();
    if (descLower) {
      for (const kw of profile.keywords) {
        if (descLower.includes(kw)) {
          score += 10;
        }
      }
    }

    // 5. Engagement baseline
    const views = Number(v.views) || 0;
    score += Math.min(15, Math.log10(views + 1) * 3);

    return { video: v, score };
  });

  // Segregate into High-Relevance (matched interests) vs Discovery
  const highRelevance = [];
  const discovery = [];

  for (const item of scored) {
    if (item.score >= 40) {
      highRelevance.push(item.video);
    } else {
      discovery.push(item.video);
    }
  }

  // Tier-based shuffling: High-relevance recommendations are shuffled among themselves
  // for freshness, followed by discovery videos (also shuffled).
  const shuffledHigh = shuffle(highRelevance);
  const shuffledDiscovery = shuffle(discovery);

  return [...pinned, ...shuffledHigh, ...shuffledDiscovery];
};

/**
 * Ranks candidate posts according to user interest profile and applies tier-based shuffling.
 */
const rankAndShufflePosts = (posts, profile) => {
  if (!posts || posts.length === 0) return [];

  if (!profile) {
    return shuffle(posts);
  }

  const scored = posts.map((p) => {
    let score = 0;
    const ownerId = (p.owner?._id || p.owner || '').toString();
    const textLower = (p.text || '').toLowerCase();

    // 1. Creator matching (posts by authors of recently watched videos)
    if (ownerId && profile.creatorIds.has(ownerId)) {
      score += 60;
    }

    // 2. Category name mentioned in post text
    for (const catName of profile.categoryNames) {
      if (textLower.includes(catName)) {
        score += 40;
      }
    }

    // 3. Keyword match in post text
    for (const kw of profile.keywords) {
      if (textLower.includes(kw)) {
        score += 25;
      }
    }

    // Engagement bonus
    const likesCount = Array.isArray(p.likes) ? p.likes.length : 0;
    score += Math.min(10, likesCount);

    return { post: p, score };
  });

  const highRelevance = [];
  const discovery = [];

  for (const item of scored) {
    if (item.score >= 25) {
      highRelevance.push(item.post);
    } else {
      discovery.push(item.post);
    }
  }

  const shuffledHigh = shuffle(highRelevance);
  const shuffledDiscovery = shuffle(discovery);

  return [...shuffledHigh, ...shuffledDiscovery];
};

module.exports = {
  getUserInterestProfile,
  rankAndShuffleVideos,
  rankAndShufflePosts,
};

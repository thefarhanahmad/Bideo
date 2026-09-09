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
 * Build user interest profile from their last up to 50 watched videos.
 * Uses a deep history window (up to 50 items) with graduated recency weighting.
 * Returns null if user is not logged in or has empty watch history.
 */
const getUserInterestProfile = async (user) => {
  if (!user || (!user._id && !user.id)) return null;

  try {
    const userId = user._id || user.id;
    const userDoc = await User.findById(userId)
      .select({ watchHistory: { $slice: 50 } })
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

    const watchedVideoRecency = new Map(); // videoId -> index in history (0 = most recent)
    const categoryWeights = new Map(); // categoryId -> weight
    const categoryNames = new Set();
    const creatorIds = new Set();
    const keywordSet = new Set();

    watchedVideos.forEach((v, idx) => {
      const vId = (v._id ? v._id.toString() : '');
      if (vId && !watchedVideoRecency.has(vId)) {
        watchedVideoRecency.set(vId, idx);
      }

      // Weight active interests heavily from the top 15 most recent videos
      if (idx < 15) {
        const recencyWeight = Math.max(1, 15 - idx);

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

        const descKeywords = extractKeywords(v.description).slice(0, 5);
        descKeywords.forEach((k) => keywordSet.add(k));
      }
    });

    const watchedVideoIds = new Set(watchedVideoRecency.keys());

    return {
      watchedVideoRecency,
      watchedVideoIds,
      categoryWeights,
      categoryNames: Array.from(categoryNames),
      creatorIds,
      keywords: Array.from(keywordSet).slice(0, 50),
    };
  } catch (err) {
    console.error('Error constructing user interest profile:', err);
    return null;
  }
};

/**
 * Ranks candidate videos/shorts: pure randomized feed with pinned videos at top.
 * Watch history ranking is disabled so refresh always provides a fresh, non-repetitive mix.
 */
const rankAndShuffleVideos = (videos) => {
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

  return [...pinned, ...shuffle(regular)];
};

/**
 * Ranks candidate posts: pure randomized posts feed.
 */
const rankAndShufflePosts = (posts) => {
  if (!posts || posts.length === 0) return [];
  return shuffle(posts);
};

module.exports = {
  shuffle,
  getUserInterestProfile,
  rankAndShuffleVideos,
  rankAndShufflePosts,
};

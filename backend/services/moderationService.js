const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const Post = require('../models/Post');
const User = require('../models/User');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const VideoReport = require('../models/VideoReport');
const Comment = require('../models/Comment');
const ErrorLog = require('../models/ErrorLog');
const { deleteLocalFile } = require('../utils/localUpload');

// ============================================================================
// 1. EXHAUSTIVE ADULT DOMAINS, NETWORKS & BRANDS (Checked against stripped text)
// ============================================================================
const ADULT_DOMAINS_AND_WATERMARKS = [
  // Major Adult Video Sites & Tubes
  'xvideos', 'pornhub', 'xnxx', 'xhamster', 'redtube', 'youporn', 'spankbang',
  'eporner', 'tube8', 'beeg', 'faphouse', 'motherless', 'heavy-r', 'thumbzilla',
  'porntrex', 'daftsex', 'txxx', 'upornia', 'porn555', 'hqporner', 'vjav',
  'missav', 'jable', 'netflav', '7mmtv', 'tktube', 'hentaibar', 'hanime',
  'cliphunter', 'empflix', 'pornhat', 'fuq', 'nuvid', 'proporn', 'gotporn',
  'brazzers', 'bangbros', 'naughtyamerica', 'realitykings', 'evilangel', 'tushy',
  'blacked', 'vixen', 'digitalplayground', 'twistys', 'babes', 'fakeagent',
  'faketaxi', 'fakedrive', 'passion-hd', 'puremature', 'naughtyoffice', 'sweetinner',
  'deeper', 'slayxxx', 'mofos', 'teamreal', 'kink', 'fetishnetwork',
  'wickedpictures', 'hustler', 'penthouse', 'playboy', 'dorcel',

  // Cam & Live Streaming Adult Portals
  'chaturbate', 'stripchat', 'cam4', 'camsoda', 'myfreecams', 'bongacams',
  'livejasmin', 'flirt4free', 'streamate', 'imlive', 'adultwork', 'jasmin',
  'webcammodels', 'babestation',

  // Adult Creators, Paid Content & Leaks
  'onlyfans', 'fansly', 'fanvue', 'manyvids', 'clips4sale', 'loyalfans',
  'pocketstars', 'modelhub', 'erome', 'thothub', 'coomer', 'kemono',
  'simpcity', 'fapello', 'bunkr', 'cyberdrop', 'leakedbb', 'leakgirls',

  // South Asian & Indian Adult Portals
  'desipapa', 'kamababa', 'malluporn', 'desisex', 'antarvasna', 'savitabhabhi',
  'desikahani', 'kamabhabhi', 'desilover', 'kamaking', 'hindisexstories',
  'desiporn', 'bhabhixxx', 'indiansex', 'desihot', 'sexmex', 'tamilsex',
  'telugusex', 'mallusex', 'banglasex', 'punjabisex',

  // Anime / Hentai Networks
  'rule34', 'hentai', 'e-hentai', 'nhentai', 'gelbooru', 'danbooru', 'fakku',
];

// ============================================================================
// 2. EXHAUSTIVE MULTI-WORD ADULT PHRASES (Checked against lowercase text)
// ============================================================================
const ADULT_PHRASES = [
  // English Explicit Phrases
  'sex video', 'sex clip', 'sex tape', 'sex movie', 'adult video', 'adult movie',
  'adult film', 'blue film', 'nude video', 'nude clip', 'nude photo', 'nude pics',
  'naked girl', 'naked woman', 'naked female', 'naked dancing', 'naked video',
  'strip dance', 'strip club', 'strip tease', 'striptease', 'hot romance',
  'bedroom romance', 'first night sex', 'honeymoon sex', 'sex scandal', 'leaked tape',
  'leaked mms', 'viral mms', 'mms leak', 'mms scandal', 'hotel scandal',
  'bathroom mms', 'hidden cam', 'spy cam', 'changing room scandal', 'private video leak',
  'onlyfans leak', 'patreon leak', 'fansly leak', 'naked in public', 'exposed body',
  'boobs press', 'boob press', 'press boobs', 'touch boobs', 'ass shake',
  'twerk naked', 'hard sex', 'rough sex', 'anal sex', 'oral sex', 'deep throat',
  'open clothes', 'remove clothes', 'undress girl', 'undressing video',
  'without clothes', 'bina kapde', 'kapde utar', 'kapde khol', 'full uncensored',
  'uncensored leak', 'creampie compilation', 'cumshot compilation', 'gangbang party',
  'erotic dance', 'erotic massage', 'happy ending massage', 'call girl service',
  'escort service', 'paid sex', 'butt naked', 'bare ass', 'naked ass', 'big ass twerk',

  // Hindi / Urdu / Desi Explicit Phrases
  'desi mms', 'viral mms', 'leaked mms', 'scandal video', 'bhabhi sex', 'desi bhabhi',
  'hot bhabhi', 'chachi sex', 'aunty sex', 'sexy aunty', 'dewar bhabhi sex',
  'suhagrat sex', 'suhagraat video', 'pelai video', 'chudai video', 'chudai clip',
  'gand marna', 'gaand marna', 'choot chatna', 'chut chatna', 'choot chatai',
  'lund chusna', 'lauda chusna', 'lund chusai', 'doodh chusna', 'doodh chusai',
  'khol ke nach', 'kapde utar ke', 'kapde khol ke', 'bina kapdo ke', 'nangi ladki',
  'nangi aurat', 'nanga nach', 'nanga hoke', 'nangi hoke', 'nange hokar',
  'garam video', 'sexy bhabhi romance', 'dehati sex', 'gav ki ladki sex',
  'bhabhi dewar ka romance', 'chachi bhatija ka sex', 'choda chodi',
  'shadi ki pehli raat sex', 'muth marna', 'muth maar', 'chut maro', 'gand maro',
  'chudai ki kahani', 'sex kahani', 'kamvasna', 'jism ki garmi', 'jismfaroshi',
  'randi khana', 'randi bazi', 'desi chudai', 'desi pelai', 'chudai ka maza',
];

// ============================================================================
// 3. EXHAUSTIVE SINGLE-WORD ADULT VOCABULARY (Boundaries \b applied)
// ============================================================================
const ADULT_EXPLICIT_WORDS = [
  // English anatomy, acts, and pornography
  'porn', 'porno', 'pornography', 'pornographic', 'nsfw', 'hardcore',
  'blowjob', 'handjob', 'footjob', 'titjob', 'boobjob', 'creampie', 'cumshot',
  'gangbang', 'orgy', 'masturbation', 'masturbate', 'masturbating', 'dildo',
  'vibrator', 'fleshlight', 'sextoy', 'penis', 'vagina', 'vulva', 'clitoris',
  'clit', 'labia', 'scrotum', 'testicles', 'boner', 'squirt', 'squirting',
  'bukkake', 'anilingus', 'rimming', 'pegging', 'threesome', 'foursome',
  'cuckold', 'cuck', 'bdsm', 'bondage', 'dominatrix', 'voyeur', 'voyeurism',
  'exhibitionism', 'upskirt', 'downblouse', 'cameltoe', 'nipslip', 'boobs',
  'boobies', 'tits', 'titties', 'nipples', 'nude', 'nudes', 'nudity',
  'stripper', 'erotic', 'erotica', 'eroticism', 'escort', 'prostitute',
  'prostitution', 'hooker', 'brothel', 'incest', 'milf', 'shemale', 'ladyboy',
  'tranny', 'gloryhole', 'doggystyle', 'penetration', 'felching', 'ejaculation',
  'ejaculate', 'cumming', 'femdom', 'orgasm', 'orgasms', 'horny', 'jav',

  // Hindi / Urdu / Hinglish Vulgar & Adult Terms
  'chut', 'chooth', 'choot', 'chudai', 'chudaai', 'choda', 'chodi', 'chodna',
  'chodne', 'chudwana', 'gaand', 'gand', 'lund', 'loda', 'lauda', 'lawda',
  'muth', 'mutha', 'randi', 'raand', 'chinal', 'jism', 'hawsi', 'havas',
  'chudakkad', 'pelai', 'pela', 'pelo', 'chochi', 'chochiya', 'nangi', 'nanga',
  'nange', 'bur', 'boor', 'bhosda', 'bhosadi', 'bhosdike', 'chodampatti',
  'mutthal', 'chootmarike', 'chutmarike', 'kamukta', 'vasna', 'suhagraat',
];

// Word-boundary Regex for adult terms (case-insensitive)
const ADULT_WORDS_REGEX = new RegExp('\\b(' + ADULT_EXPLICIT_WORDS.join('|') + ')\\b', 'i');

// Obfuscated patterns regex (e.g. 18+, +18, p*rn, p0rn, s*x, s3x, xxx, etc.)
const OBFUSCATED_ADULT_REGEX = /(?:^|\W)(18\+|\+18|18plus|adultsonly|nsfw|p[\*0o]rn[o0]?|s[\*3e]x|n[\*u]d[e3]s?|b[\*0o]{2}bs?|c[\*u]m|x{3,})(?:\W|$)/i;

/**
 * Resolves a media URL to an absolute filesystem path if stored locally.
 */
const resolveToLocalPath = (mediaUrl) => {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;

  let relativePath = '';
  const uploadsIdx = mediaUrl.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    relativePath = mediaUrl.substring(uploadsIdx + 1);
  } else if (mediaUrl.startsWith('uploads/') || mediaUrl.startsWith('uploads\\')) {
    relativePath = mediaUrl.replace(/\\/g, '/');
  } else {
    return null;
  }

  const uploadsBaseDir = path.resolve(__dirname, '../uploads');
  const absolutePath = path.resolve(path.join(__dirname, '..', relativePath));

  if (absolutePath.startsWith(uploadsBaseDir) && fs.existsSync(absolutePath)) {
    return absolutePath;
  }
  return null;
};

/**
 * Layer 1: Fast metadata heuristic check (0ms, 0 API calls)
 * Scans title, description, and tags for adult keywords, porn domains, and leetspeak obfuscation.
 */
const checkMetadata = ({ title = '', description = '', tags = [] }) => {
  try {
    const rawText = `${title || ''} ${description || ''} ${(Array.isArray(tags) ? tags.join(' ') : '')}`.toLowerCase();
    // Stripped text removes spaces, dots, hyphens, and underscores for domain catching (e.g. "x v i d e o s" -> "xvideos")
    const strippedText = rawText.replace(/[\s\.\-_]/g, '');

    // 1. Check Domains and Watermarks
    for (const domain of ADULT_DOMAINS_AND_WATERMARKS) {
      if (strippedText.includes(domain)) {
        return {
          isAdult: true,
          reason: `Adult domain/network reference detected: "${domain}"`,
        };
      }
    }

    // 2. Check Multi-word explicit phrases
    for (const phrase of ADULT_PHRASES) {
      if (rawText.includes(phrase)) {
        return {
          isAdult: true,
          reason: `Explicit adult phrase detected: "${phrase}"`,
        };
      }
    }

    // 3. Check Single-word explicit terms with word boundaries
    if (ADULT_WORDS_REGEX.test(rawText)) {
      const match = rawText.match(ADULT_WORDS_REGEX);
      return {
        isAdult: true,
        reason: `Explicit adult keyword detected: "${match ? match[0] : 'adult term'}"`,
      };
    }

    // 4. Check Obfuscated adult patterns (e.g., p0rn, s*x, 18+, xxx)
    if (OBFUSCATED_ADULT_REGEX.test(rawText)) {
      const match = rawText.match(OBFUSCATED_ADULT_REGEX);
      return {
        isAdult: true,
        reason: `Obfuscated adult pattern detected: "${match ? match[1] : '18+'}"`,
      };
    }

    return { isAdult: false };
  } catch (err) {
    console.error('[Moderation] Error in checkMetadata heuristic:', err.message);
    return { isAdult: false };
  }
};

/**
 * Reads image binary buffer from local filesystem or downloads it via HTTP with strict timeout.
 */
const getImageBuffer = async (imageUrl, localPath) => {
  try {
    if (localPath && fs.existsSync(localPath)) {
      return {
        buffer: fs.readFileSync(localPath),
        filename: path.basename(localPath),
        isLocal: true,
      };
    }

    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        filename: 'image.jpg',
        isLocal: false,
      };
    }
  } catch (err) {
    // Gracefully ignore fetch errors
  }
  return null;
};

/**
 * Provider 1: Sightengine nudity-2.0 Visual AI Analysis
 * Handles free tier quotas (2,000/mo, 500/day) and fails gracefully if exhausted.
 */
const checkImageWithSightengine = async (imageUrl, localPath) => {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    return { isAdult: false, skipped: true, reason: 'Sightengine credentials not configured' };
  }

  try {
    let res = null;
    const resolvedPath = localPath || resolveToLocalPath(imageUrl);

    if (resolvedPath && fs.existsSync(resolvedPath)) {
      const fileBuffer = fs.readFileSync(resolvedPath);
      const filename = path.basename(resolvedPath);
      const fileBlob = new Blob([fileBuffer]);

      const formData = new FormData();
      formData.append('api_user', apiUser);
      formData.append('api_secret', apiSecret);
      formData.append('models', 'nudity-2.0');
      formData.append('media', fileBlob, filename);

      res = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(7000),
      });
    } else if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      const params = new URLSearchParams({
        models: 'nudity-2.0',
        api_user: apiUser,
        api_secret: apiSecret,
        url: imageUrl,
      });
      res = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
        signal: AbortSignal.timeout(7000),
      });
    } else {
      return { isAdult: false, skipped: true };
    }

    // Quota exhausted (402 Payment Required) or Rate limited (429)
    if (res.status === 402 || res.status === 429) {
      console.warn(`[Moderation] Sightengine quota limit reached (HTTP ${res.status}). Skipping Sightengine.`);
      return { isAdult: false, quotaExceeded: true, status: res.status };
    }

    if (!res.ok) {
      console.warn(`[Moderation] Sightengine returned HTTP ${res.status}.`);
      return { isAdult: false, error: true, status: res.status };
    }

    const data = await res.json();
    if (data.status !== 'success' || !data.nudity) {
      return { isAdult: false };
    }

    const { sexual_activity = 0, sexual_display = 0, erotica = 0, sextoy = 0 } = data.nudity;

    const isExplicit =
      sexual_activity >= 0.35 ||
      sexual_display >= 0.35 ||
      erotica >= 0.60 ||
      sextoy >= 0.50;

    if (isExplicit) {
      return {
        isAdult: true,
        provider: 'Sightengine',
        reason: 'Visual nudity or explicit sexual content detected by Sightengine AI',
        scores: { sexual_activity, sexual_display, erotica, sextoy },
      };
    }

    return { isAdult: false, provider: 'Sightengine', scores: data.nudity };
  } catch (err) {
    console.warn('[Moderation] Sightengine scan error (safe ignore):', err.message);
    return { isAdult: false, error: true, message: err.message };
  }
};

/**
 * Provider 2: Hugging Face Serverless Inference API (Falconsai/nsfw_image_detection)
 * 100% Free Serverless AI Tier with high community rate limits.
 * Fails gracefully without throwing or stopping the server if quota runs out.
 */
const checkImageWithHuggingFace = async (imageUrl, localPath) => {
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;

  if (!hfToken) {
    return { isAdult: false, skipped: true, reason: 'Hugging Face token not configured' };
  }

  try {
    const resolvedPath = localPath || resolveToLocalPath(imageUrl);
    const media = await getImageBuffer(imageUrl, resolvedPath);

    if (!media || !media.buffer) {
      return { isAdult: false, skipped: true, reason: 'Image file could not be read' };
    }

    // Modern Hugging Face Inference router endpoint
    const hfUrl = 'https://router.huggingface.co/hf-inference/models/Falconsai/nsfw_image_detection';

    const res = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: media.buffer,
      signal: AbortSignal.timeout(7000),
    });

    // If quota ends or serverless endpoint is sleeping/busy
    if (res.status === 429 || res.status === 402) {
      console.warn(`[Moderation] Hugging Face rate limit or quota reached (HTTP ${res.status}). Skipping safely.`);
      return { isAdult: false, quotaExceeded: true, status: res.status };
    }

    if (!res.ok) {
      console.warn(`[Moderation] Hugging Face returned HTTP ${res.status}. Continuing safely.`);
      return { isAdult: false, error: true, status: res.status };
    }

    const results = await res.json();

    // Output format: [ { label: 'nsfw', score: 0.98 }, { label: 'normal', score: 0.02 } ]
    if (Array.isArray(results)) {
      const nsfwItem = results.find(
        (item) => item.label && item.label.toLowerCase() === 'nsfw'
      );

      if (nsfwItem && nsfwItem.score >= 0.65) {
        return {
          isAdult: true,
          provider: 'HuggingFace',
          reason: `Explicit NSFW visuals detected by Hugging Face AI (${Math.round(nsfwItem.score * 100)}% confidence)`,
          score: nsfwItem.score,
        };
      }
    }

    return { isAdult: false, provider: 'HuggingFace' };
  } catch (err) {
    console.warn('[Moderation] Hugging Face scan error (safe ignore):', err.message);
    return { isAdult: false, error: true, message: err.message };
  }
};

/**
 * Intelligent Multi-Provider Visual Moderator
 * Tries Sightengine -> Automatically falls back to Hugging Face -> Never crashes server if quotas end.
 */
const checkImageVisually = async (imageUrl) => {
  try {
    const localPath = resolveToLocalPath(imageUrl);

    // 1. Try Sightengine (Primary)
    if (process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET) {
      const seResult = await checkImageWithSightengine(imageUrl, localPath);
      if (seResult.isAdult) return seResult;

      // If clean and successful, return clean
      if (!seResult.quotaExceeded && !seResult.error) {
        return seResult;
      }
      // If quota exceeded or error, smoothly fall back to Hugging Face
    }

    // 2. Try Hugging Face Serverless (Fallback or Primary if configured)
    const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
    if (hfToken) {
      const hfResult = await checkImageWithHuggingFace(imageUrl, localPath);
      if (hfResult.isAdult) return hfResult;
    }

    return { isAdult: false, skipped: true };
  } catch (err) {
    // Under NO circumstances should visual scanning crash the server or throw
    console.warn('[Moderation] Visual check safely bypassed:', err.message);
    return { isAdult: false, skipped: true };
  }
};

/**
 * Cascading Auto-Purge: Permanently purges an adult video without banning the user account.
 */
const purgeAdultVideo = async (video, reason) => {
  try {
    const videoId = video._id;
    const ownerId = video.owner?._id || video.owner;

    console.warn(`[MODERATION] AUTO-PURGING ADULT VIDEO ${videoId}: ${reason}`);

    // 1. Unlink media files from filesystem
    if (video.videoUrl) deleteLocalFile(video.videoUrl);
    if (video.thumbnail) deleteLocalFile(video.thumbnail);

    // 2. Cascade delete records from MongoDB
    await Promise.allSettled([
      Video.findByIdAndDelete(videoId),
      VideoMonetizationReview.deleteMany({ video: videoId }),
      VideoReport.deleteMany({ video: videoId }),
      Comment.deleteMany({ video: videoId }),
    ]);

    // 3. Log in ErrorLog for Admin Dashboard tracking
    await ErrorLog.create({
      message: `[Auto-Moderation] Adult video automatically purged: "${video.title}"`,
      stack: `Reason: ${reason}\nVideo ID: ${videoId}\nUser ID: ${ownerId}\nURL: ${video.videoUrl}`,
      statusCode: 403,
      endpoint: '/api/videos/upload',
      method: 'POST',
      status: 'resolved',
    }).catch(() => {});

    console.log(`[MODERATION] Video ${videoId} and its files were purged successfully.`);
  } catch (err) {
    console.error('[MODERATION] Failed to purge adult video safely:', err.message);
  }
};

/**
 * Cascading Auto-Purge: Permanently purges an adult post without banning the user account.
 */
const purgeAdultPost = async (post, reason) => {
  try {
    const postId = post._id;
    const ownerId = post.owner?._id || post.owner;

    console.warn(`[MODERATION] AUTO-PURGING ADULT POST ${postId}: ${reason}`);

    // 1. Unlink media file from disk
    if (post.imageUrl) deleteLocalFile(post.imageUrl);

    // 2. Cascade delete from MongoDB
    await Promise.allSettled([
      Post.findByIdAndDelete(postId),
      Comment.deleteMany({ post: postId }),
    ]);

    // 3. Log in ErrorLog
    await ErrorLog.create({
      message: `[Auto-Moderation] Adult post automatically purged. Text: "${(post.text || '').slice(0, 50)}"`,
      stack: `Reason: ${reason}\nPost ID: ${postId}\nUser ID: ${ownerId}`,
      statusCode: 403,
      endpoint: '/api/posts',
      method: 'POST',
      status: 'resolved',
    }).catch(() => {});
  } catch (err) {
    console.error('[MODERATION] Failed to purge adult post safely:', err.message);
  }
};

/**
 * Smart Reputation Evaluator:
 * Determines if an uploader requires visual AI scanning or is trusted.
 * 
 * New / Untrusted Accounts (MUST visually scan):
 * - Account created within the last 1 day (24 hours)
 * - OR Account has active/open user reports against their content
 * 
 * Trusted Creators (Bypass visual AI scan to preserve free quota):
 * - Admin or explicitly verified (isVerified === true)
 * - Established account (age > 1 day) with 0 open reports
 * 
 * NOTE: Layer 1 (Metadata/Keyword/Domain filter) ALWAYS runs on 100% of videos
 * from ALL creators regardless of reputation.
 */
const shouldPerformVisualScan = async (ownerId, contentId) => {
  if (!ownerId) return true;

  try {
    const user = await User.findById(ownerId).select('createdAt isVerified role').lean().catch(() => null);
    if (!user) return true;

    // 1. Admins and verified channels are trusted
    if (user.role === 'admin' || user.isVerified) {
      return false;
    }

    // 2. New accounts (< 1 day / 24 hours old) MUST be scanned
    const accountAgeMs = Date.now() - new Date(user.createdAt || 0).getTime();
    if (accountAgeMs < 1 * 24 * 60 * 60 * 1000) {
      return true;
    }

    // 3. Accounts with open reports against their content MUST be scanned
    const userVideoIds = await Video.find({ owner: ownerId }).distinct('_id').catch(() => []);
    if (userVideoIds && userVideoIds.length > 0) {
      const openReportCount = await VideoReport.countDocuments({
        video: { $in: userVideoIds },
        status: 'open',
      }).catch(() => 0);
      if (openReportCount > 0) {
        return true;
      }
    }

    // Established creator (account > 1 day old and 0 open reports)
    return false;
  } catch (err) {
    // Fail safe: default to scanning if any error occurs
    return true;
  }
};

/**
 * Schedules automated adult content moderation for a newly uploaded video.
 * Runs in exactly delayMs (default 10,000ms = 10 seconds).
 */
const scheduleVideoModeration = (video, delayMs = 10000, options = {}) => {
  if (!video || !video._id) return;

  const videoId = video._id;

  setTimeout(async () => {
    try {
      // Re-fetch video from DB to make sure it hasn't been deleted or altered
      const currentVideo = await Video.findById(videoId).lean().catch(() => null);
      if (!currentVideo) return;

      // Layer 1: Instant Metadata Heuristic (Runs on ALL 1,000+ uploads, 0 cost, 0 API consumption)
      const metaCheck = checkMetadata({
        title: currentVideo.title,
        description: currentVideo.description,
        tags: currentVideo.tags,
      });

      if (metaCheck.isAdult) {
        await purgeAdultVideo(currentVideo, metaCheck.reason);
        return;
      }

      // Check Creator Reputation: only scan new / untrusted uploaders to stay 100% within free AI quotas
      const ownerId = currentVideo.owner?._id || currentVideo.owner;
      const needsVisualScan = options.forceVisualScan || (await shouldPerformVisualScan(ownerId, videoId));

      if (!needsVisualScan) {
        console.log(`[MODERATION] Video ${videoId} from trusted creator passed audit (visual AI bypassed).`);
        return;
      }

      // Layer 2: Visual AI Scan (Sightengine with Hugging Face failover)
      if (currentVideo.thumbnail) {
        const visualCheck = await checkImageVisually(currentVideo.thumbnail);
        if (visualCheck.isAdult) {
          await purgeAdultVideo(currentVideo, visualCheck.reason);
          return;
        }
      }

      console.log(`[MODERATION] Video ${videoId} passed safety audit cleanly.`);
    } catch (err) {
      console.error(`[MODERATION] Error during moderation of video ${videoId} (handled):`, err.message);
    }
  }, delayMs);
};

/**
 * Schedules automated adult content moderation for a newly created post.
 * Runs in delayMs (default 10,000ms = 10 seconds).
 */
const schedulePostModeration = (post, delayMs = 10000, options = {}) => {
  if (!post || !post._id) return;

  const postId = post._id;

  setTimeout(async () => {
    try {
      const currentPost = await Post.findById(postId).lean().catch(() => null);
      if (!currentPost) return;

      // Layer 1: Check Text (Runs on ALL posts, 0 cost)
      const textCheck = checkMetadata({ title: currentPost.text });
      if (textCheck.isAdult) {
        await purgeAdultPost(currentPost, textCheck.reason);
        return;
      }

      // Check Creator Reputation
      const ownerId = currentPost.owner?._id || currentPost.owner;
      const needsVisualScan = options.forceVisualScan || (await shouldPerformVisualScan(ownerId, postId));

      if (!needsVisualScan) {
        console.log(`[MODERATION] Post ${postId} from trusted creator passed audit (visual AI bypassed).`);
        return;
      }

      // Layer 2: Check Post Image Visually
      if (currentPost.imageUrl) {
        const visualCheck = await checkImageVisually(currentPost.imageUrl);
        if (visualCheck.isAdult) {
          await purgeAdultPost(currentPost, visualCheck.reason);
          return;
        }
      }

      console.log(`[MODERATION] Post ${postId} passed safety audit cleanly.`);
    } catch (err) {
      console.error(`[MODERATION] Error during moderation of post ${postId} (handled):`, err.message);
    }
  }, delayMs);
};

module.exports = {
  checkMetadata,
  checkImageWithSightengine,
  checkImageWithHuggingFace,
  checkImageVisually,
  shouldPerformVisualScan,
  scheduleVideoModeration,
  schedulePostModeration,
  purgeAdultVideo,
  purgeAdultPost,
};

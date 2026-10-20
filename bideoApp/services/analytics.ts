import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const STORAGE_KEYS = {
  WATCHED_VIDEOS_COUNT: 'bideo_analytics_watched_videos_count',
  ACTIVATION_FIRED: 'bideo_analytics_activation_fired',
  REVIEW_REQUESTED: 'bideo_analytics_review_requested',
};

// Target thresholds based on Bideo-Ads-Plan.xlsx (P16, P20, P21)
const ACTIVATION_THRESHOLD = 3; // 3 videos watched within 24h = "Activated User"
const REVIEW_THRESHOLD = 10;     // 10 videos watched = Happy moment for Play Store rating

let cachedAnalytics: any = null;
let firebaseAnalyticsModule: any = null;

function getSafeAnalytics(): any {
  // Never load native Firebase in Expo Go or storeClient (avoids NativeRNFBTurboApp crash)
  const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    return null;
  }

  if (!cachedAnalytics) {
    try {
      if (!firebaseAnalyticsModule) {
        firebaseAnalyticsModule = require('@react-native-firebase/analytics');
      }
      const getAnalyticsFn =
        firebaseAnalyticsModule.getAnalytics ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.getAnalytics);
      if (typeof getAnalyticsFn === 'function') {
        cachedAnalytics = getAnalyticsFn();
      }
    } catch {
      // In dev or web environment without native Firebase setup
    }
  }
  return cachedAnalytics;
}

/**
 * Safely logs a custom event to Firebase Analytics
 */
export async function logEvent(name: string, params?: Record<string, any>): Promise<void> {
  try {
    const a = getSafeAnalytics();
    if (a && firebaseAnalyticsModule) {
      const firebaseLogEvent =
        firebaseAnalyticsModule.logEvent ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.logEvent);
      if (typeof firebaseLogEvent === 'function') {
        firebaseLogEvent(a, name as any, params as any);
      }
      if (__DEV__) {
        console.log(`[Analytics] ${name}:`, params);
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.warn(`[Analytics Error] Failed to log ${name}:`, err);
    }
  }
}

/**
 * Set current user ID and properties once authenticated
 */
export async function setAnalyticsUser(userId?: string, properties?: Record<string, string>): Promise<void> {
  try {
    const a = getSafeAnalytics();
    if (a && firebaseAnalyticsModule) {
      const firebaseSetUserId =
        firebaseAnalyticsModule.setUserId ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.setUserId);
      const firebaseSetUserProperty =
        firebaseAnalyticsModule.setUserProperty ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.setUserProperty);

      if (typeof firebaseSetUserId === 'function') {
        if (userId) {
          await firebaseSetUserId(a, userId);
        } else {
          await firebaseSetUserId(a, null);
        }
      }
      if (properties && typeof firebaseSetUserProperty === 'function') {
        for (const [key, value] of Object.entries(properties)) {
          await firebaseSetUserProperty(a, key, value);
        }
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[Analytics Error] Failed to set user:', err);
    }
  }
}

/**
 * Log Screen View for navigation
 */
export async function logScreen(screenName: string, screenClassOverride?: string): Promise<void> {
  try {
    const a = getSafeAnalytics();
    if (a && firebaseAnalyticsModule) {
      const firebaseLogScreenView =
        firebaseAnalyticsModule.logScreenView ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.logScreenView);
      if (typeof firebaseLogScreenView === 'function') {
        await firebaseLogScreenView(a, {
          screen_name: screenName,
          screen_class: screenClassOverride || screenName,
        });
      }
    }
  } catch (err) {}
}

/**
 * Log App Open
 */
export async function logAppLaunch(): Promise<void> {
  try {
    const a = getSafeAnalytics();
    if (a && firebaseAnalyticsModule) {
      const firebaseLogAppOpen =
        firebaseAnalyticsModule.logAppOpen ||
        (firebaseAnalyticsModule.default && firebaseAnalyticsModule.default.logAppOpen);
      if (typeof firebaseLogAppOpen === 'function') {
        await firebaseLogAppOpen(a);
      }
    }
  } catch (err) {}
}

/**
 * Track when a video starts playing
 */
export async function logVideoStart(videoId: string, isShort: boolean, category?: string): Promise<void> {
  await logEvent('video_start', {
    video_id: videoId,
    content_type: isShort ? 'short' : 'long_video',
    category: category || 'general',
  });
}

/**
 * Track when a video is successfully watched (meets view threshold)
 * Automatically checks and fires:
 * 1. P21: "watched_3_videos" (Activated User event for Google Ads)
 * 2. P16: Google Play In-App Review API prompt after 10th video
 */
export async function trackVideoWatched(videoId: string, isShort: boolean, category?: string): Promise<void> {
  try {
    // 1. Log video completion / view event
    await logEvent('video_view', {
      video_id: videoId,
      content_type: isShort ? 'short' : 'long_video',
      category: category || 'general',
    });

    // 2. Increment cumulative videos watched count
    const rawCount = await AsyncStorage.getItem(STORAGE_KEYS.WATCHED_VIDEOS_COUNT);
    const count = (rawCount ? parseInt(rawCount, 10) : 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.WATCHED_VIDEOS_COUNT, count.toString());

    // 3. P21: Check for Activation Event ("watched_3_videos")
    const activationAlreadyFired = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVATION_FIRED);
    if (!activationAlreadyFired && count >= ACTIVATION_THRESHOLD) {
      await logEvent('watched_3_videos', {
        total_watched: count,
        source: 'in_app_feed',
      });
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVATION_FIRED, 'true');
      if (__DEV__) {
        console.log('>>> [Analytics] ACTIVATED USER EVENT FIRED: watched_3_videos <<<');
      }
    }

    // 4. P16: Check for Happy Moment In-App Review prompt (10+ videos watched)
    const reviewAlreadyRequested = await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_REQUESTED);
    if (!reviewAlreadyRequested && count >= REVIEW_THRESHOLD) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
        await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_REQUESTED, 'true');
        await logEvent('in_app_review_prompted', { videos_watched: count });
        if (__DEV__) {
          console.log('>>> [StoreReview] Google Play In-App Review Dialog Prompted <<<');
        }
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[Analytics Error] trackVideoWatched failed:', err);
    }
  }
}

/**
 * Track user interactions
 */
export async function logShare(videoId: string, platform = 'whatsapp'): Promise<void> {
  await logEvent('share', {
    item_id: videoId,
    content_type: 'video',
    method: platform,
  });
}

export async function logSignUp(method: string): Promise<void> {
  await logEvent('sign_up', { method });
}

export async function logVideoUploaded(isShort: boolean, category?: string): Promise<void> {
  await logEvent('video_uploaded', {
    content_type: isShort ? 'short' : 'long_video',
    category: category || 'general',
  });
}

export async function logFollowCreator(creatorId: string): Promise<void> {
  await logEvent('follow_creator', { creator_id: creatorId });
}

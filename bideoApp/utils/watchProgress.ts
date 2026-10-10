import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const PROGRESS_KEY_PREFIX = '@bideo_watch_progress_';

export interface WatchProgressData {
  videoId: string;
  progress: number;
  duration: number;
  updatedAt: number;
}

/**
 * Checks if a progress timestamp should be considered finished
 * (e.g. within 5 seconds of the end or watched >= 95% of duration).
 */
export const isVideoFinished = (progress: number, duration: number): boolean => {
  if (duration <= 5) return false;
  return progress >= duration * 0.95 || progress >= duration - 5;
};

/**
 * Retrieves the local saved watch progress for a video (seconds).
 * Returns 0 if none exists, or if the video was previously completed.
 */
export const getLocalWatchProgress = async (videoId: string): Promise<number> => {
  if (!videoId) return 0;
  try {
    const raw = await AsyncStorage.getItem(`${PROGRESS_KEY_PREFIX}${videoId}`);
    if (!raw) return 0;
    const data: WatchProgressData = JSON.parse(raw);
    if (!data || typeof data.progress !== 'number') return 0;

    if (isVideoFinished(data.progress, data.duration)) {
      return 0;
    }

    // Only return if watched at least 5 seconds
    return data.progress >= 5 ? Math.floor(data.progress) : 0;
  } catch {
    return 0;
  }
};

/**
 * Saves watch progress locally in AsyncStorage and immediately syncs to backend.
 */
export const saveWatchProgress = async (
  videoId: string,
  progress: number,
  duration: number
): Promise<void> => {
  if (!videoId) return;

  const prog = Math.max(0, Math.floor(progress || 0));
  const dur = Math.max(0, Math.floor(duration || 0));

  // If completed, or watched < 5s, treat as 0
  const shouldReset = prog < 5 || isVideoFinished(prog, dur);
  const finalProg = shouldReset ? 0 : prog;

  try {
    if (finalProg === 0) {
      await AsyncStorage.removeItem(`${PROGRESS_KEY_PREFIX}${videoId}`);
    } else {
      const payload: WatchProgressData = {
        videoId,
        progress: finalProg,
        duration: dur,
        updatedAt: Date.now(),
      };
      await AsyncStorage.setItem(`${PROGRESS_KEY_PREFIX}${videoId}`, JSON.stringify(payload));
    }
  } catch {
    // Ignore local storage error
  }

  // Sync to backend (fire-and-forget)
  api
    .put('/users/history/progress', {
      videoId,
      progress: finalProg,
      duration: dur,
    })
    .catch(() => {});
};

/**
 * Clears saved watch progress for a video.
 */
export const clearWatchProgress = async (videoId: string): Promise<void> => {
  if (!videoId) return;
  try {
    await AsyncStorage.removeItem(`${PROGRESS_KEY_PREFIX}${videoId}`);
  } catch {}
  api
    .put('/users/history/progress', {
      videoId,
      progress: 0,
      duration: 0,
    })
    .catch(() => {});
};

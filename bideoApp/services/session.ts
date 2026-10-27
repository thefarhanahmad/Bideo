import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import api, { setAuthToken, clearAuthSession, isSessionInvalidError, SESSION_EXPIRED_EVENT } from './api';
import { logoutCurrentAccount } from './accountManager';
import { logout } from '../redux/slices/authSlice';
import { showAlert } from '../components/AppAlert';

// Logins last 7 days on the server. Swapping the token for a fresh one once a day keeps
// people who use the app signed in; only someone away for 7+ days has to sign in again.
const RENEW_EVERY_MS = 24 * 60 * 60 * 1000;
const renewedAtKey = (userId: string) => `token_renewed_at:${userId}`;
let renewing = false;
let endingSession = false;

/**
 * Gets a fresh token for the signed-in user when the last renewal was over a day ago.
 * Returns the new token (already saved and in use), or null when nothing changed.
 */
export const renewTokenIfDue = async (userId?: string | null): Promise<string | null> => {
  if (!userId || renewing) return null;
  renewing = true; // set before any await, so calls at the same moment can't both renew
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem('token');
    if (!token) return null;
    const last = Number(await AsyncStorage.getItem(renewedAtKey(userId))) || 0;
    if (Date.now() - last < RENEW_EVERY_MS) return null;

    const res = await api.post('/auth/renew-token', null, { skipSessionExpiry: true, timeout: 10000 });
    const fresh = res.data?.token;
    if (typeof fresh !== 'string' || !fresh) return null;
    // Signed out or switched account while waiting: keep whatever is current now
    if ((await AsyncStorage.getItem('token')) !== token) return null;
    await AsyncStorage.setItem('token', fresh);
    setAuthToken(fresh);
    await AsyncStorage.setItem(renewedAtKey(userId), String(Date.now()));
    return fresh;
  } catch (err: any) {
    if (isSessionInvalidError(err) && (await AsyncStorage.getItem('token')) === token) {
      DeviceEventEmitter.emit(SESSION_EXPIRED_EVENT, token);
    } else if (err?.response?.status === 404) {
      // A server without this endpoint yet: don't ask again until tomorrow
      await AsyncStorage.setItem(renewedAtKey(userId), String(Date.now())).catch(() => {});
    }
    return null;
  } finally {
    renewing = false;
  }
};

/**
 * Signs out an account whose login the server no longer accepts, the same way as tapping
 * "Log out": switches to another saved account if one is still valid, otherwise guest mode.
 * Acts only while `expiredToken` is still the signed-in token, so a second report of the same
 * expiry (or a late one after switching accounts) changes nothing.
 */
export const endExpiredSession = async (
  dispatch: any,
  userId: string | null | undefined,
  expiredToken: string | null | undefined
): Promise<void> => {
  if (endingSession || !expiredToken) return;
  endingSession = true;
  try {
    if ((await AsyncStorage.getItem('token')) !== expiredToken) return;
    let switched = false;
    if (userId) {
      switched = await logoutCurrentAccount(dispatch, userId);
    } else {
      await clearAuthSession();
      dispatch(logout());
    }
    showAlert(
      'Session expired',
      switched
        ? 'You were signed out of one account, so we switched to your other saved account.'
        : 'Please sign in again to continue.'
    );
  } catch (err) {
    console.error('Failed to end expired session:', err);
    dispatch(logout());
  } finally {
    endingSession = false;
  }
};

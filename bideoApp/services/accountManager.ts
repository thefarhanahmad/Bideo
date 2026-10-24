/**
 * Multi-Account Manager
 *
 * Manages a device-local registry of authenticated Bideo accounts in AsyncStorage.
 * Only ONE account is "active" at any time — its JWT token is set on the axios
 * instance and used for all API calls. The other accounts' tokens sit idle in
 * storage, ready to be swapped in with a single tap.
 *
 * Security: The stored_accounts array never leaves the device. Each account's
 * token is a standard JWT that the backend validates independently. Switching
 * accounts simply changes which token is attached to outgoing requests.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken, clearAuthSession } from './api';
import { loginSuccess, logout } from '../redux/slices/authSlice';
import { initSocket, disconnectSocket } from './socket';
import { registerForPushNotificationsAsync } from './notifications';
import { setAnalyticsUser } from './analytics';

const STORED_ACCOUNTS_KEY = 'stored_accounts';
const ACTIVE_ACCOUNT_KEY = 'active_account_id';
const MAX_ACCOUNTS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredAccount {
  id: string;
  name: string;
  channelName?: string;
  avatar?: string | null;
  token: string;
  isVerified?: boolean;
  phone?: string;
  email?: string;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all stored accounts from AsyncStorage. Never throws; returns [] on
 * any failure so callers don't need try/catch.
 */
export const getStoredAccounts = async (): Promise<StoredAccount[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Returns the user-id of the currently active account, or null.
 */
export const getActiveAccountId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
};

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Persist the accounts array to AsyncStorage.
 */
const persistAccounts = async (accounts: StoredAccount[]): Promise<void> => {
  await AsyncStorage.setItem(STORED_ACCOUNTS_KEY, JSON.stringify(accounts));
};

/**
 * Persist the active account id.
 */
const persistActiveId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
};

// ─── Core operations ──────────────────────────────────────────────────────────

/**
 * Upsert an account into the stored list. Called after every successful
 * login / signup / token refresh. If the account already exists (same id),
 * its fields are updated in-place; otherwise a new entry is appended.
 *
 * Also marks this account as the active one and syncs the legacy
 * `token` / `cached_user` keys that the rest of the app expects.
 */
export const saveAccount = async (
  user: any,
  token: string,
): Promise<StoredAccount[]> => {
  if (!user?._id || !token) return getStoredAccounts();

  const accounts = await getStoredAccounts();
  const entry: StoredAccount = {
    id: user._id,
    name: user.name || '',
    channelName: user.channelName || undefined,
    avatar: user.avatar || null,
    token,
    isVerified: !!user.isVerified,
    phone: user.phone || undefined,
    email: user.email || undefined,
  };

  const idx = accounts.findIndex((a) => a.id === entry.id);
  if (idx >= 0) {
    // Update existing entry (token may have changed, avatar/name may have changed)
    accounts[idx] = { ...accounts[idx], ...entry };
  } else {
    if (accounts.length >= MAX_ACCOUNTS) {
      // Silently refuse — the UI should prevent reaching this, but be safe
      console.warn(`[AccountManager] Max ${MAX_ACCOUNTS} accounts reached. Ignoring save.`);
      return accounts;
    }
    accounts.push(entry);
  }

  await persistAccounts(accounts);
  await persistActiveId(entry.id);

  // Keep legacy keys in sync for _layout.tsx Startup and other consumers
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('cached_user', JSON.stringify(user));

  return accounts;
};

/**
 * Update the stored profile data for a specific account without changing
 * the active account or token. Useful when the user edits their channel.
 */
export const updateStoredAccountProfile = async (
  userId: string,
  updates: Partial<Omit<StoredAccount, 'id' | 'token'>>,
): Promise<void> => {
  const accounts = await getStoredAccounts();
  const idx = accounts.findIndex((a) => a.id === userId);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...updates };
    await persistAccounts(accounts);
  }
};

/**
 * Switch to a different stored account.
 *
 * 1. Disconnect current socket.
 * 2. Set the new account's token on the axios instance.
 * 3. Fetch fresh user data from backend to validate the token.
 * 4. Dispatch loginSuccess to Redux.
 * 5. Reconnect socket + re-register push token for the new account.
 *
 * Returns `true` on success. On failure (e.g. expired token), removes the
 * broken account from the list and returns `false`.
 */
export const switchToAccount = async (
  targetId: string,
  dispatch: any,
): Promise<boolean> => {
  const accounts = await getStoredAccounts();
  const target = accounts.find((a) => a.id === targetId);
  if (!target) return false;

  try {
    // 1. Disconnect existing socket (will reconnect for new user)
    disconnectSocket();

    // 2. Set the new token globally
    setAuthToken(target.token);
    await AsyncStorage.setItem('token', target.token);
    await persistActiveId(target.id);

    // 3. Validate token & get fresh user data from server
    let freshUser: any = null;
    try {
      const res = await api.get('/auth/me', { timeout: 8000 });
      freshUser = res.data?.data || res.data;
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        // Token is invalid / user is blocked — remove this account
        console.warn(`[AccountManager] Token invalid for ${target.name}. Removing account.`);
        await removeStoredAccount(targetId);
        setAuthToken(null);
        return false;
      }
      // Network error — use cached profile from the stored entry
      freshUser = null;
    }

    // 4. Build user object for Redux
    const userData = freshUser || {
      _id: target.id,
      name: target.name,
      channelName: target.channelName,
      avatar: target.avatar,
      isVerified: target.isVerified,
    };

    // Check if user is blocked
    if (userData.isBlocked) {
      await removeStoredAccount(targetId);
      setAuthToken(null);
      return false;
    }

    // 5. Update Redux state
    dispatch(loginSuccess({ user: userData, token: target.token } as any));

    // 6. Update cached user
    await AsyncStorage.setItem('cached_user', JSON.stringify(userData));

    // 7. Update stored account with fresh data
    if (freshUser) {
      await updateStoredAccountProfile(targetId, {
        name: freshUser.name || target.name,
        channelName: freshUser.channelName || target.channelName,
        avatar: freshUser.avatar || target.avatar,
        isVerified: !!freshUser.isVerified,
      });
    }

    // 8. Analytics
    setAnalyticsUser(userData._id, {
      name: userData.name || '',
      channelName: userData.channelName || '',
    });

    // 9. Reconnect socket for new user
    initSocket(target.token).catch(() => {});

    // 10. Register push token for new user
    registerForPushNotificationsAsync().catch(() => {});

    return true;
  } catch (err) {
    console.error('[AccountManager] switchToAccount failed:', err);
    return false;
  }
};

/**
 * Remove a stored account by id. If it's the currently active account,
 * this does NOT switch away — call logoutCurrentAccount for that.
 */
export const removeStoredAccount = async (userId: string): Promise<StoredAccount[]> => {
  const accounts = await getStoredAccounts();
  const filtered = accounts.filter((a) => a.id !== userId);
  await persistAccounts(filtered);
  return filtered;
};

/**
 * Log out the currently active account.
 *
 * - Clears the server-side push token for this account.
 * - Removes the account from the stored list.
 * - If other accounts remain, automatically switches to the first one.
 * - If no accounts remain, dispatches a full logout (guest mode).
 *
 * Returns `true` if another account was activated, `false` if guest mode.
 */
export const logoutCurrentAccount = async (
  dispatch: any,
  currentUserId: string,
): Promise<boolean> => {
  // Clear push token & auth session for current account
  await clearAuthSession();

  // Remove from stored list
  const remaining = await removeStoredAccount(currentUserId);

  if (remaining.length > 0) {
    // Switch to the first remaining account
    const switched = await switchToAccount(remaining[0].id, dispatch);
    if (switched) return true;
    // If switch failed (expired token), try the next one
    for (let i = 1; i < remaining.length; i++) {
      const ok = await switchToAccount(remaining[i].id, dispatch);
      if (ok) return true;
    }
  }

  // No valid accounts left — go to guest mode
  dispatch(logout());
  return false;
};

/**
 * Log out ALL stored accounts. Clears everything and goes to guest mode.
 */
export const logoutAllAccounts = async (dispatch: any): Promise<void> => {
  // Clear push token for current session
  await clearAuthSession();

  // Wipe multi-account storage
  await AsyncStorage.multiRemove([STORED_ACCOUNTS_KEY, ACTIVE_ACCOUNT_KEY]);

  // Disconnect socket
  disconnectSocket();

  // Full Redux logout
  dispatch(logout());
};

/**
 * Migrate a single-account session (existing users upgrading) into the
 * multi-account registry. Called once during app startup in _layout.tsx.
 * If `stored_accounts` is already populated, this is a no-op.
 */
export const migrateExistingSession = async (): Promise<void> => {
  const existing = await getStoredAccounts();
  if (existing.length > 0) return; // already migrated

  const token = await AsyncStorage.getItem('token');
  const cachedUserStr = await AsyncStorage.getItem('cached_user');
  if (!token || !cachedUserStr) return;

  try {
    const user = JSON.parse(cachedUserStr);
    if (user?._id) {
      await saveAccount(user, token);
    }
  } catch {
    // ignore parse errors — will be handled on next login
  }
};

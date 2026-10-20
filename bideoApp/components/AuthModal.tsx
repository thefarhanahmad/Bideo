import { showAlert } from './AppAlert';
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Keyboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../constants/Colors";
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../redux/slices/authSlice';
import { authService, setAuthToken } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { registerForPushNotificationsAsync } from '../services/notifications';
import { setAnalyticsUser, logSignUp } from '../services/analytics';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Minimal, elegant wavy ribbon lines ONLY in top-right (5 lines) and bottom-left (4 lines)
const TOP_RIGHT_WAVES = [
  { key: 'tr-0', width: SCREEN_WIDTH * 1.30, height: SCREEN_HEIGHT * 0.36, top: -SCREEN_HEIGHT * 0.10, right: -SCREEN_WIDTH * 0.35, rotate: '-25deg', opacity: 0.35 },
  { key: 'tr-1', width: SCREEN_WIDTH * 1.36, height: SCREEN_HEIGHT * 0.39, top: -SCREEN_HEIGHT * 0.11, right: -SCREEN_WIDTH * 0.37, rotate: '-26deg', opacity: 0.28 },
  { key: 'tr-2', width: SCREEN_WIDTH * 1.42, height: SCREEN_HEIGHT * 0.42, top: -SCREEN_HEIGHT * 0.12, right: -SCREEN_WIDTH * 0.39, rotate: '-27deg', opacity: 0.22 },
  { key: 'tr-3', width: SCREEN_WIDTH * 1.48, height: SCREEN_HEIGHT * 0.45, top: -SCREEN_HEIGHT * 0.13, right: -SCREEN_WIDTH * 0.41, rotate: '-28deg', opacity: 0.16 },
  { key: 'tr-4', width: SCREEN_WIDTH * 1.54, height: SCREEN_HEIGHT * 0.48, top: -SCREEN_HEIGHT * 0.14, right: -SCREEN_WIDTH * 0.43, rotate: '-29deg', opacity: 0.11 },
];

const BOTTOM_LEFT_WAVES = [
  { key: 'bl-0', width: SCREEN_WIDTH * 1.20, height: SCREEN_HEIGHT * 0.30, bottom: -SCREEN_HEIGHT * 0.08, left: -SCREEN_WIDTH * 0.40, rotate: '18deg', opacity: 0.26 },
  { key: 'bl-1', width: SCREEN_WIDTH * 1.26, height: SCREEN_HEIGHT * 0.33, bottom: -SCREEN_HEIGHT * 0.09, left: -SCREEN_WIDTH * 0.42, rotate: '19deg', opacity: 0.20 },
  { key: 'bl-2', width: SCREEN_WIDTH * 1.32, height: SCREEN_HEIGHT * 0.36, bottom: -SCREEN_HEIGHT * 0.10, left: -SCREEN_WIDTH * 0.44, rotate: '20deg', opacity: 0.15 },
  { key: 'bl-3', width: SCREEN_WIDTH * 1.38, height: SCREEN_HEIGHT * 0.39, bottom: -SCREEN_HEIGHT * 0.11, left: -SCREEN_WIDTH * 0.46, rotate: '21deg', opacity: 0.10 },
];

// Clean wavy background: subtle corners only, zero obstruction across screen center
const WavyBackground: React.FC = React.memo(() => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Warm beige / luxury cream base gradient */}
      <LinearGradient
        colors={['#F5EFE4', '#FAF6EE', '#F3ECE0']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Top right subtle warm glow */}
      <LinearGradient
        colors={['rgba(255, 138, 20, 0.24)', 'rgba(255, 175, 60, 0.08)', 'transparent']}
        style={styles.topRightGlow}
        pointerEvents="none"
      />

      {/* Bottom left subtle warm glow */}
      <LinearGradient
        colors={['rgba(255, 122, 0, 0.15)', 'rgba(255, 170, 70, 0.05)', 'transparent']}
        style={styles.bottomLeftGlow}
        pointerEvents="none"
      />

      {/* Top right waves only */}
      {TOP_RIGHT_WAVES.map((line) => (
        <View
          key={line.key}
          pointerEvents="none"
          style={[
            styles.waveLine,
            {
              width: line.width,
              height: line.height,
              borderRadius: line.width / 2,
              top: line.top,
              right: line.right,
              opacity: line.opacity,
              transform: [{ rotate: line.rotate }],
            },
          ]}
        />
      ))}

      {/* Bottom left waves only */}
      {BOTTOM_LEFT_WAVES.map((line) => (
        <View
          key={line.key}
          pointerEvents="none"
          style={[
            styles.waveLine,
            {
              width: line.width,
              height: line.height,
              borderRadius: line.width / 2,
              bottom: line.bottom,
              left: line.left,
              opacity: line.opacity,
              transform: [{ rotate: line.rotate }],
            },
          ]}
        />
      ))}

      {/* Delicate 4-point star accent at bottom right */}
      <View style={styles.sparkleContainer} pointerEvents="none">
        <View style={styles.sparkleHalo} pointerEvents="none" />
        <View style={[styles.sparkleBeam, styles.sparkleVertical]} pointerEvents="none" />
        <View style={[styles.sparkleBeam, styles.sparkleHorizontal]} pointerEvents="none" />
        <View style={styles.sparkleDiamond} pointerEvents="none" />
      </View>
    </View>
  );
});

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess?: (user?: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onLoginSuccess }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'password' | null>(null);

  // Input refs for instant touch response anywhere on the row
  const nameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Feature flag — hide Google login entirely unless explicitly enabled via env.
  const GOOGLE_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true';
  const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
  const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

  const googleConfig = useMemo(() => ({
    redirectUri: AuthSession.makeRedirectUri(),
    clientId: CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID || CLIENT_ID,
  }), [CLIENT_ID, ANDROID_CLIENT_ID]);

  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  const persistAuth = useCallback(async (backendRes: any) => {
    const token = backendRes.token || backendRes.data?.token;
    const userData = backendRes.user || backendRes.data?.user || backendRes.data || backendRes;
    if (!token || !userData) {
      throw new Error('Invalid authentication response');
    }
    if (token) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('cached_user', JSON.stringify(userData));
      setAuthToken(token);
    }
    dispatch(loginSuccess({ user: userData, token } as any));
    setAnalyticsUser(userData._id, {
      name: userData.name || '',
      channelName: userData.channelName || '',
    });
    if (isSignup) {
      logSignUp('phone_password');
    }
    onLoginSuccess?.(userData);
    onClose();

    // Register push token immediately on login
    registerForPushNotificationsAsync().catch(() => {});

    if (userData.deletionScheduled) {
      router.push('/account-recovery');
    }
  }, [dispatch, onLoginSuccess, onClose, router, isSignup]);

  const getUserInfo = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", { headers: { Authorization: `Bearer ${accessToken}` } });
      const user = await res.json();
      dispatch(loginStart());
      try {
        const backendRes = await authService.googleLogin({
          name: user.name,
          email: user.email,
          avatar: user.picture || user.avatar || ''
        });
        await persistAuth(backendRes);
      }
      catch (err: any) {
        dispatch(loginFailure('Backend login failed'));
        showAlert('Login Failed', 'Unable to complete login with backend');
      }
    } catch {
      showAlert("Login Failed", "Could not fetch user info");
    }
  }, [dispatch, persistAuth]);

  useEffect(() => {
    if (response?.type === "success") {
      const { accessToken } = response.authentication || {};
      if (accessToken) getUserInfo(accessToken);
    }
  }, [response, getUserInfo]);

  const cleanPhoneInput = useCallback((val: string): string => {
    let digits = val.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length > 10) {
      digits = digits.slice(0, 10);
    }
    return digits;
  }, []);

  const handlePhoneAuth = useCallback(async () => {
    const trimmedName = name.trim();
    const sanitizedPhone = cleanPhoneInput(phone);
    const trimmedPassword = password.trim();

    if (isSignup) {
      if (!trimmedName) return showAlert('Missing Username', 'Please enter a username.');
      if (/\s/.test(trimmedName)) return showAlert('Invalid Username', 'Username cannot contain spaces.');
      if (!/^[a-zA-Z0-9._]+$/.test(trimmedName)) return showAlert('Invalid Username', 'Username can only contain letters, numbers, underscores (_), and periods (.).');
      if (trimmedName.length < 3 || trimmedName.length > 30) return showAlert('Invalid Username', 'Username must be between 3 and 30 characters.');
    }
    if (!sanitizedPhone) return showAlert('Missing Phone', 'Please enter your 10-digit mobile number.');
    if (sanitizedPhone.length !== 10) return showAlert('Invalid Phone', 'Mobile number must be exactly 10 digits.');
    if (!trimmedPassword) return showAlert('Missing Password', 'Please enter your password.');
    if (isSignup && trimmedPassword.length < 6) return showAlert('Short Password', 'Password must be at least 6 characters.');

    setAuthLoading(true);
    dispatch(loginStart());
    try {
      const backendRes = isSignup 
        ? await authService.signupWithPhone({ name: trimmedName, phone: sanitizedPhone, password: trimmedPassword }) 
        : await authService.loginWithPhone({ phone: sanitizedPhone, password: trimmedPassword });
      await persistAuth(backendRes);
    } catch (err: any) {
      dispatch(loginFailure('Phone auth failed'));
      const apiError =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.errors?.[0]?.message ||
        (err?.message === 'Network Error' ? 'Unable to connect to server. Please check your internet connection.' : null) ||
        (err?.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : null) ||
        err?.message ||
        'Unable to authenticate. Please check your credentials.';
      showAlert('Authentication Failed', apiError);
    } finally {
      setAuthLoading(false);
    }
  }, [isSignup, name, phone, password, cleanPhoneInput, dispatch, persistAuth]);

  const handleGoogleLogin = useCallback(async () => {
    if (Platform.OS === 'android' && !ANDROID_CLIENT_ID) return showAlert('Google Login Not Configured', 'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your app env to enable Google login on Android.');
    try { await promptAsync(); } catch { showAlert("Login Error", "Something went wrong"); }
  }, [ANDROID_CLIENT_ID, promptAsync]);

  const handleForgotPassword = useCallback(() => {
    onClose();
    router.push('/forgot-password');
  }, [onClose, router]);

  const toggleSignup = useCallback(() => {
    setIsSignup(prev => !prev);
  }, []);

  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="dark" />
      <View style={styles.overlay}>
        {/* Subtle, non-interfering wavy background */}
        <WavyBackground />

        {/* Pinned Top-Left Close Button */}
        <TouchableOpacity
          style={[styles.closeButton, { top: Math.max(insets.top, 16) + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={26} color="#18181B" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardHeight > 0 && {
                justifyContent: 'flex-start',
                paddingTop: Math.max(insets.top, 16) + 20,
                paddingBottom: keyboardHeight + 30,
              },
            ]}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Centered content block */}
            <View style={styles.centerContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
                <Text style={styles.subtitle}>
                  {isSignup ? 'Join Bideo community today.' : 'Login to your account to continue.'}
                </Text>
              </View>

              {/* Form Fields */}
              <View style={styles.formContainer}>
                {/* Username field (Signup only) */}
                {isSignup && (
                  <View style={styles.fieldWrapper}>
                    <Pressable
                      style={[
                        styles.inputRow,
                        focusedField === 'name' && styles.inputRowFocused,
                      ]}
                      onPress={() => nameInputRef.current?.focus()}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={focusedField === 'name' ? Colors.primary : '#475569'}
                        style={styles.fieldIcon}
                      />
                      <TextInput
                        ref={nameInputRef}
                        style={styles.textInput}
                        placeholder="Username (e.g. johndoe)"
                        placeholderTextColor="#64748B"
                        value={name}
                        onChangeText={(v) => setName(v.replace(/\s+/g, ''))}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={30}
                        onFocus={() => {
                          setFocusedField('name');
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                          }, 100);
                        }}
                        onBlur={() => setFocusedField(null)}
                      />
                    </Pressable>
                    <Text style={styles.inputHint} numberOfLines={1} adjustsFontSizeToFit>
                      No spaces. Letters, numbers, dots & underscores only.
                    </Text>
                  </View>
                )}

                {/* Phone Number field */}
                <View style={styles.fieldWrapper}>
                  <Pressable
                    style={[
                      styles.inputRow,
                      focusedField === 'phone' && styles.inputRowFocused,
                    ]}
                    onPress={() => phoneInputRef.current?.focus()}
                  >
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={focusedField === 'phone' ? Colors.primary : '#475569'}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      ref={phoneInputRef}
                      style={styles.textInput}
                      placeholder="Phone Number"
                      placeholderTextColor="#64748B"
                      value={phone}
                      onChangeText={(v) => setPhone(cleanPhoneInput(v))}
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoCorrect={false}
                      onFocus={() => {
                        setFocusedField('phone');
                        if (isSignup) {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 60, animated: true });
                          }, 100);
                        }
                      }}
                      onBlur={() => setFocusedField(null)}
                    />
                  </Pressable>
                </View>

                {/* Password field */}
                <View style={[styles.fieldWrapper, !isSignup && { marginBottom: 6 }]}>
                  <Pressable
                    style={[
                      styles.inputRow,
                      focusedField === 'password' && styles.inputRowFocused,
                    ]}
                    onPress={() => passwordInputRef.current?.focus()}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedField === 'password' ? Colors.primary : '#475569'}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      ref={passwordInputRef}
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder="Password"
                      placeholderTextColor="#64748B"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => {
                        setFocusedField('password');
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 120);
                      }}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={togglePassword}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={21}
                        color={focusedField === 'password' ? Colors.primary : '#475569'}
                      />
                    </TouchableOpacity>
                  </Pressable>
                </View>

                {/* Forgot Password link (Login mode only) */}
                {!isSignup && (
                  <TouchableOpacity
                    style={styles.forgotBtn}
                    onPress={handleForgotPassword}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}

                {/* Primary Action Button (Login / Sign Up) */}
                <TouchableOpacity
                  style={[styles.primaryButton, authLoading && { opacity: 0.8 }]}
                  onPress={handlePhoneAuth}
                  activeOpacity={0.85}
                  disabled={authLoading}
                >
                  <LinearGradient
                    colors={[Colors.primary, '#F36800']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {authLoading ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Switch between Login and Signup */}
                <TouchableOpacity
                  onPress={toggleSignup}
                  activeOpacity={0.7}
                  style={styles.switchTouchable}
                >
                  <Text style={styles.switchLineText}>
                    {isSignup ? 'Already have an account? ' : 'New user? '}
                    <Text style={styles.switchLineAction}>
                      {isSignup ? 'Login' : 'Sign up with phone'}
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Optional Google Login */}
                {GOOGLE_ENABLED && (
                  <>
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.orText}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                      style={styles.googleButton}
                      onPress={handleGoogleLogin}
                      disabled={!request}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-google" size={19} color="#EA4335" />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#F5EFE4',
  },
  keyboardView: {
    flex: 1,
  },
  // True vertical and horizontal centering
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 30,
  },
  centerContainer: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
  },

  // Subtle ambient glows in corners only
  topRightGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  bottomLeftGlow: {
    position: 'absolute',
    bottom: -40,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },

  // Minimal wave lines in corners
  waveLine: {
    position: 'absolute',
    borderWidth: 1.3,
    borderColor: 'rgba(217, 119, 20, 0.9)',
  },

  // 4-point star accent at bottom right
  sparkleContainer: {
    position: 'absolute',
    bottom: 55,
    right: 28,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  sparkleBeam: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.95,
  },
  sparkleVertical: {
    width: 5,
    height: 42,
    borderRadius: 2.5,
  },
  sparkleHorizontal: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
  },
  sparkleDiamond: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
    opacity: 0.95,
  },

  // Close Button
  closeButton: {
    position: 'absolute',
    left: 20,
    zIndex: 50,
    padding: 6,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
    paddingHorizontal: 20,
  },

  // Form Container
  formContainer: {
    width: '100%',
  },
  fieldWrapper: {
    width: '100%',
    marginBottom: 14,
  },

  // Clear, interactive input row with full-touch capture
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 2,
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.8)',
    borderBottomWidth: 2,
    borderBottomColor: '#64748B',
  },
  inputRowFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(255, 122, 0, 0.5)',
    borderBottomColor: Colors.primary,
    borderBottomWidth: 2.2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldIcon: {
    marginRight: 10,
    marginLeft: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: Platform.OS === 'ios' ? 2 : 5,
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },

  // Forgot password (tight spacing right below password field)
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 0,
    marginBottom: 12,
    paddingVertical: 2,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Primary Action Button (Compact 46px height, modern pill shape, tight margins)
  primaryButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Switch between Login & Signup (cohesive tight spacing)
  switchTouchable: {
    paddingVertical: 2,
    alignItems: 'center',
  },
  switchLineText: {
    fontSize: 13.5,
    color: '#334155',
    textAlign: 'center',
  },
  switchLineAction: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Divider & Google Button
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  orText: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 10,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  googleButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default AuthModal;

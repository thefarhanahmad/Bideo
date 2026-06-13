import { showAlert } from './AppAlert';
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from "react-native";
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

WebBrowser.maybeCompleteAuthSession();

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
    const userData = backendRes.user || backendRes.data?.user || backendRes;
    if (!token || !userData) {
      throw new Error('Invalid authentication response');
    }
    if (token) {
      await AsyncStorage.setItem('token', token);
      setAuthToken(token);
    }
    dispatch(loginSuccess({ user: userData, token } as any));
    onLoginSuccess?.(userData);
    onClose();
  }, [dispatch, onLoginSuccess, onClose]);

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

  const handlePhoneAuth = useCallback(async () => {
    if ((isSignup && !name.trim()) || !phone.trim() || !password) return showAlert('Missing Fields', 'Please fill name, phone and password.');
    if (phone.trim().length !== 10) return showAlert('Invalid Phone', 'Phone number must be 10 digits.');

    setAuthLoading(true);
    dispatch(loginStart());
    try {
      const backendRes = isSignup 
        ? await authService.signupWithPhone({ name: name.trim(), phone: phone.trim(), password }) 
        : await authService.loginWithPhone({ phone: phone.trim(), password });
      await persistAuth(backendRes);
    } catch (err: any) {
      dispatch(loginFailure('Phone auth failed'));
      const apiError = err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg;
      showAlert('Authentication Failed', apiError || 'Unable to authenticate');
    } finally {
      setAuthLoading(false);
    }
  }, [isSignup, name, phone, password, dispatch, persistAuth]);

  const handleGoogleLogin = useCallback(async () => {
    if (Platform.OS === 'android' && !ANDROID_CLIENT_ID) return showAlert('Google Login Not Configured', 'Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your app env to enable Google login on Android.');
    try { await promptAsync(); } catch { showAlert("Login Error", "Something went wrong"); }
  }, [ANDROID_CLIENT_ID, promptAsync]);

  const handleForgotPassword = useCallback(() => {
    onClose();
    router.push('/forgot-password');
  }, [onClose, router]);

  const toggleSignup = useCallback(() => setIsSignup(prev => !prev), []);
  const togglePassword = useCallback(() => setShowPassword(prev => !prev), []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>

              <View style={styles.header}>

                <Text style={styles.title}>{isSignup ? 'Create Account' : 'Welcome Back'}</Text>
                <Text style={styles.subtitle}>{isSignup ? 'Join Bideo community today.' : 'Login to your account to continue.'}</Text>
              </View>

              {isSignup && (
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                autoCorrect={false}
              />

              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={togglePassword} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={Colors.textGray} />
                </TouchableOpacity>
              </View>

              {!isSignup && (
                <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.primaryButton, authLoading && { opacity: 0.7 }]} 
                onPress={handlePhoneAuth} 
                activeOpacity={0.8}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleSignup} activeOpacity={0.7}>
                <Text style={styles.switchLineText}>
                  {isSignup ? 'Already have an account? ' : 'New user? '}
                  <Text style={styles.switchLineAction}>{isSignup ? 'Login' : 'Sign up with phone'}</Text>
                </Text>
              </TouchableOpacity>

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
                    <Ionicons name="logo-google" size={22} color={Colors.white} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    width: '100%',
    paddingBottom: 20,
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    left: -5,
    padding: 10,
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: -60,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 15
  },
  input: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
    marginBottom: 12
  },
  passwordRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    paddingRight: 8
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 0,
    backgroundColor: 'transparent'
  },
  eyeButton: {
    padding: 10
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    paddingVertical: 2
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700'
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    width: "100%",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: "700"
  },
  switchLineText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
    marginBottom: 20
  },
  switchLineAction: {
    color: Colors.primary,
    fontWeight: "800"
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  orText: {
    fontSize: 13,
    color: Colors.textGray,
    marginHorizontal: 12,
    fontWeight: '600'
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: '#4285F4', // Official Google Blue
    width: "100%",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  googleButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 12
  }
});

export default AuthModal;
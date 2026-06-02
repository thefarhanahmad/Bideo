import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import Constants from 'expo-constants';
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../redux/slices/authSlice';
import { authService, setAuthToken } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";

WebBrowser.maybeCompleteAuthSession();
interface AuthModalProps { visible: boolean; onClose: () => void; onLoginSuccess?: (user?: any) => void; }
const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onLoginSuccess }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || (Constants.manifest?.extra && (Constants.manifest.extra.EXPO_PUBLIC_GOOGLE_CLIENT_ID || Constants.manifest.extra.EXPO_PUBLIC_GOOGLE_CLIENT_ID)) || '';
  const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const [request, response, promptAsync] = Google.useAuthRequest({
    redirectUri: AuthSession.makeRedirectUri(),
    clientId: CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID || CLIENT_ID,
  });
  useEffect(() => { if (response?.type === "success") { const { accessToken } = response.authentication || {}; if (accessToken) getUserInfo(accessToken); } }, [response]);
  const persistAuth = async (backendRes: any) => {
    const token = backendRes.token || backendRes.data?.token;
    const userData = backendRes.user || backendRes.data?.user || backendRes;
    if (!token || !userData) {
      throw new Error('Invalid authentication response');
    }
    if (token) { await AsyncStorage.setItem('token', token); setAuthToken(token); }
    dispatch(loginSuccess({ user: userData, token } as any));
    onLoginSuccess?.(userData);
    onClose();
  };
  const handlePhoneAuth = async () => {
    if ((isSignup && !name.trim()) || !phone.trim() || !password) return Alert.alert('Missing Fields', 'Please fill name, phone and password.');
    if (phone.trim().length !== 10) return Alert.alert('Invalid Phone', 'Phone number must be 10 digits.');
    dispatch(loginStart());
    try {
      const backendRes = isSignup ? await authService.signupWithPhone({ name: name.trim(), phone: phone.trim(), password }) : await authService.loginWithPhone({ phone: phone.trim(), password });
      await persistAuth(backendRes);
    } catch (err: any) {
      dispatch(loginFailure('Phone auth failed'));
      const apiError = err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg;
      Alert.alert('Authentication Failed', apiError || 'Unable to authenticate');
    }
  };
  const getUserInfo = async (accessToken: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", { headers: { Authorization: `Bearer ${accessToken}` } });
      const user = await res.json(); dispatch(loginStart());
      try { const backendRes = await authService.googleLogin({ name: user.name, email: user.email, avatar: user.picture || user.avatar || '' }); await persistAuth(backendRes); }
      catch (err: any) { dispatch(loginFailure('Backend login failed')); Alert.alert('Login Failed','Unable to complete login with backend'); }
    } catch { Alert.alert("Login Failed", "Could not fetch user info"); }
  };
  const handleGoogleLogin = async () => {
    if (Platform.OS === 'android' && !ANDROID_CLIENT_ID) return Alert.alert('Google Login Not Configured','Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your app env to enable Google login on Android.');
    try { await promptAsync(); } catch { Alert.alert("Login Error", "Something went wrong"); }
  };

  const handleForgotPassword = () => {
    onClose();
    router.push('/forgot-password');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', width: '100%' }} bounces={false}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            
            <View style={styles.header}>
              <Ionicons name="person-circle-outline" size={80} color={Colors.primary} />
              <Text style={styles.title}>Sign in to TubeIndia</Text>
              <Text style={styles.subtitle}>Login with phone and password or continue with Google.</Text>
            </View>

            {isSignup && <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />}
            
            <TextInput 
              style={styles.input} 
              placeholder="Phone" 
              value={phone} 
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} 
              keyboardType="phone-pad" 
              maxLength={10} 
            />
            
            <View style={styles.passwordRow}>
              <TextInput 
                style={[styles.input, styles.passwordInput]} 
                placeholder="Password" 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry={!showPassword} 
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textGray} />
              </TouchableOpacity>
            </View>

            {!isSignup && (
              <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handlePhoneAuth}>
              <Text style={styles.googleButtonText}>{isSignup ? 'Sign Up' : 'Login'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignup(!isSignup)}>
              <Text style={styles.switchLineText}>
                {isSignup ? 'Already have an account? ' : 'New user? '}
                <Text style={styles.switchLineAction}>{isSignup ? 'Login' : 'Sign up with phone'}</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.orText}>or</Text>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={!request}>
              <Ionicons name="logo-google" size={22} color={Colors.white} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const styles = StyleSheet.create({ 
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }, 
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' }, 
  closeButton: { alignSelf: "flex-end" }, 
  header: { alignItems: "center", marginBottom: 24 }, 
  title: { fontSize: 24, fontWeight: "700", color: Colors.text, marginTop: 14, marginBottom: 10 }, 
  subtitle: { fontSize: 14, color: Colors.textGray, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 }, 
  input: { width: "100%", borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 }, 
  passwordRow: { width: "100%", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 12, marginBottom: 10, paddingRight: 8 }, 
  passwordInput: { flex: 1, marginBottom: 0, borderWidth: 0 }, 
  eyeButton: { paddingHorizontal: 8, paddingVertical: 8 }, 
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 15 },
  forgotText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  primaryButton: { backgroundColor: Colors.primary, width: "100%", paddingVertical: 15, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 10 }, 
  switchLineText: { fontSize: 12, color: Colors.textGray, textAlign: "center", lineHeight: 18, marginBottom: 2 }, 
  switchLineAction: { color: Colors.primary, fontWeight: "700" }, 
  orText: { fontSize: 12, color: Colors.textGray, textAlign: "center", marginVertical: 10, lineHeight: 18 }, 
  googleButton: { flexDirection: "row", backgroundColor: Colors.primary, width: "100%", paddingVertical: 15, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 12 }, 
  googleButtonText: { color: Colors.white, fontSize: 16, fontWeight: "700", marginLeft: 10 }, 
  footerText: { fontSize: 12, color: Colors.textGray, textAlign: "center", lineHeight: 18 } 
});
export default AuthModal;

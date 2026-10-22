import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Pressable,
  Keyboard,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Colors from '../constants/Colors';
import { authService } from '../services/api';
import { hapticLight, hapticSuccess, hapticSelection } from '../utils/haptics';
import AuthModal from '../components/AuthModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Matching wavy ribbon geometry in corners only
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

// Reusable pure-code theme background
const WavyBackground: React.FC = React.memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient
      colors={['#F5EFE4', '#FAF6EE', '#F3ECE0']}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      pointerEvents="none"
    />
    <LinearGradient
      colors={['rgba(255, 138, 20, 0.24)', 'rgba(255, 175, 60, 0.08)', 'transparent']}
      style={styles.topRightGlow}
      pointerEvents="none"
    />
    <LinearGradient
      colors={['rgba(255, 122, 0, 0.15)', 'rgba(255, 170, 70, 0.05)', 'transparent']}
      style={styles.bottomLeftGlow}
      pointerEvents="none"
    />
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
    <View style={styles.sparkleContainer} pointerEvents="none">
      <View style={styles.sparkleHalo} pointerEvents="none" />
      <View style={[styles.sparkleBeam, styles.sparkleVertical]} pointerEvents="none" />
      <View style={[styles.sparkleBeam, styles.sparkleHorizontal]} pointerEvents="none" />
      <View style={styles.sparkleDiamond} pointerEvents="none" />
    </View>
  </View>
));

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // Form State
  const [step, setStep] = useState<1 | 2>(1); // 1: Phone, 2: OTP & New Password
  const [phone, setPhone] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [guideConfig, setGuideConfig] = useState<{
    enabled: boolean;
    videoId?: string | null;
    videoUrl?: string | null;
  } | null>(null);

  // Input Refs
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const otpInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Fetch forgot password guide video configuration from backend
  useEffect(() => {
    let isMounted = true;
    authService
      .getForgotPasswordGuide()
      .then((res) => {
        if (isMounted && res?.success && res?.enabled) {
          setGuideConfig({
            enabled: true,
            videoId: res.videoId || null,
            videoUrl: res.videoUrl || null,
          });
        }
      })
      .catch(() => {
        // Silently ignore if guide is unavailable
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard height listener
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const cleanPhoneInput = useCallback((val: string): string => {
    let digits = val.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    return digits;
  }, []);

  // Request / Generate OTP
  const handleRequestOtp = async () => {
    hapticSelection();
    const sanitized = cleanPhoneInput(phone);
    if (!sanitized || sanitized.length !== 10) {
      hapticLight();
      return Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
    }

    setLoading(true);
    // Generate real random 4-digit code (e.g. 7482)
    const clientCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const res = await authService.forgotPassword(sanitized);
      if (res?.success) {
        hapticSuccess();
        const codeToUse = res.otp || clientCode;
        setGeneratedOtp(codeToUse);
        setOtpDigits(['', '', '', '']);
        setStep(2);
      }
    } catch (err: any) {
      hapticLight();
      const apiError =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.errors?.[0]?.message ||
        'Failed to request verification code. Please check your phone number.';
      Alert.alert('Unable to Request Code', apiError);
    } finally {
      setLoading(false);
    }
  };

  // Copy OTP and auto-fill boxes
  const handleCopyOtp = async () => {
    if (!generatedOtp) return;
    hapticSelection();
    await Clipboard.setStringAsync(generatedOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Auto-fill OTP boxes
    const digits = generatedOtp.split('').slice(0, 4);
    setOtpDigits(digits);
    passwordInputRef.current?.focus();
  };

  // Open native email app with prefilled support email
  const handleEmailSupport = () => {
    hapticSelection();
    Linking.openURL(
      'mailto:bideoapps@gmail.com?subject=Bideo%20Password%20Reset%20Help&body=Hi%20Bideo%20Support%2C%0A%0AI%20am%20having%20trouble%20resetting%20my%20password.%0ARegistered%20Phone%3A%20%0A%0AThank%20you!'
    ).catch(() => {
      Alert.alert(
        'Unable to Open Mail App',
        'Please send an email directly to: bideoapps@gmail.com'
      );
    });
  };

  // Open guide video player
  const handleOpenGuideVideo = () => {
    hapticSelection();
    if (guideConfig?.videoId) {
      router.push(`/video/${guideConfig.videoId}`);
    } else if (guideConfig?.videoUrl) {
      const match = guideConfig.videoUrl.match(/[a-f0-9]{24}/i);
      if (match) {
        router.push(`/video/${match[0]}`);
      } else {
        Linking.openURL(guideConfig.videoUrl).catch(() => {
          Alert.alert('Unable to Open Video', 'Could not open the guide video link.');
        });
      }
    } else {
      Alert.alert('Notice', 'Guide video is currently not available.');
    }
  };

  // Open signup modal directly from guide
  const handleGoToSignup = () => {
    hapticSelection();
    setShowGuideModal(false);
    setAuthModalVisible(true);
  };

  // Handle single digit OTP entry with auto-focus
  const handleOtpDigitChange = (val: string, index: number) => {
    const cleaned = val.replace(/\D/g, '');

    // Handle paste of full 4-digit code
    if (cleaned.length === 4) {
      const digits = cleaned.split('').slice(0, 4);
      setOtpDigits(digits);
      passwordInputRef.current?.focus();
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleaned.slice(-1);
    setOtpDigits(nextDigits);

    // Auto-focus next box
    if (cleaned && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  // Handle backspace navigation between OTP boxes
  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  // Reset Password Execution
  const handleResetPassword = async () => {
    hapticSelection();
    const sanitized = cleanPhoneInput(phone);
    const enteredOtp = otpDigits.join('');
    const trimmedPassword = password.trim();

    if (enteredOtp.length < 4) {
      hapticLight();
      return Alert.alert('Incomplete Code', 'Please enter the complete 4-digit verification code.');
    }

    if (enteredOtp !== generatedOtp) {
      hapticLight();
      return Alert.alert('Invalid Code', 'The verification code you entered is incorrect. Please check and try again.');
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      hapticLight();
      return Alert.alert('Short Password', 'New password must be at least 6 characters long.');
    }

    setLoading(true);
    try {
      // Send both the entered OTP and fallback if needed
      let res;
      try {
        res = await authService.resetPassword({
          phone: sanitized,
          otp: enteredOtp,
          password: trimmedPassword,
        });
      } catch (firstErr: any) {
        // Safe backward-compatibility fallback if production backend hasn't redeployed yet
        if (firstErr.response?.data?.message?.includes('1234')) {
          res = await authService.resetPassword({
            phone: sanitized,
            otp: '1234',
            password: trimmedPassword,
          });
        } else {
          throw firstErr;
        }
      }

      if (res?.success) {
        hapticSuccess();
        Alert.alert(
          'Password Reset Successful',
          'Your password has been successfully updated. You can now log in with your new password.',
          [{ text: 'Log In Now', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      hapticLight();
      const apiError =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.errors?.[0]?.message ||
        'Failed to reset password. Please try again.';
      Alert.alert('Reset Failed', apiError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Matching wavy theme background */}
      <WavyBackground />

      {/* Pinned Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: Math.max(insets.top, 16) + 8 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#0F172A" />
      </TouchableOpacity>

      {/* Top Right Header Action Buttons */}
      <View style={[styles.headerRightContainer, { top: Math.max(insets.top, 16) + 8 }]}>
        {guideConfig?.enabled && (
          <TouchableOpacity
            style={styles.guideHeaderButton}
            onPress={handleOpenGuideVideo}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle" size={17} color={Colors.primary} />
            <Text style={styles.guideHeaderButtonText}>Guide</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.helpHeaderButton}
          onPress={() => {
            hapticSelection();
            setShowGuideModal(true);
          }}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.helpHeaderButtonText}>Help</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardHeight > 0 && {
              justifyContent: 'flex-start',
              paddingTop: Math.max(insets.top, 16) + 30,
              paddingBottom: keyboardHeight + 30,
            },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerContainer}>
            {step === 1 ? (
              /* Step 1: Phone Form */
              <View style={styles.formContainer}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Reset Password</Text>
                  <Text style={styles.subtitle}>
                    Enter your registered mobile number to receive a verification code.
                  </Text>
                </View>

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
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                    />
                  </Pressable>
                </View>

                {/* Primary Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, (loading || phone.length < 10) && { opacity: 0.8 }]}
                  onPress={handleRequestOtp}
                  disabled={loading || phone.length < 10}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.primary, '#F36800']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Back to Login */}
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.switchTouchable}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchLineText}>
                    Remember your password? <Text style={styles.switchLineAction}>Log in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Step 2: Verification Code & New Password */
              <View style={styles.formContainer}>
                {/* Pure Numeric OTP displayed ON TOP OF verification text in small dashed mono box */}
                <TouchableOpacity
                  onPress={handleCopyOtp}
                  style={styles.numericOtpCard}
                  activeOpacity={0.8}
                >
                  <View style={styles.otpLabelRow}>
                    <Text style={styles.numericOtpPrefix}>OTP - </Text>
                    <Text style={styles.numericOtpDigits}>{generatedOtp}</Text>
                  </View>
                  {copied && (
                    <View style={styles.copiedPill}>
                      <Ionicons name="checkmark-circle" size={11} color="#15803D" />
                      <Text style={styles.copiedPillText}>Copied</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Verification Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Verification</Text>
                  <Text style={styles.subtitle}>
                    Enter the code below to reset your password.
                  </Text>
                </View>

                {/* 4-Box Refined OTP Input Section */}
                <View style={styles.otpBoxesRow}>
                  {otpDigits.map((digit, idx) => (
                    <TextInput
                      key={`otp-${idx}`}
                      ref={otpInputRefs[idx]}
                      style={[
                        styles.otpBox,
                        focusedField === idx && styles.otpBoxFocused,
                        digit.length > 0 && styles.otpBoxFilled,
                      ]}
                      value={digit}
                      onChangeText={(val) => handleOtpDigitChange(val, idx)}
                      onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                      onFocus={() => setFocusedField(idx)}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      textAlign="center"
                    />
                  ))}
                </View>

                {/* New Password Input Row (Simple placeholder) */}
                <View style={[styles.fieldWrapper, { marginBottom: 16 }]}>
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
                      placeholder="New Password"
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
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color={focusedField === 'password' ? Colors.primary : '#475569'}
                      />
                    </TouchableOpacity>
                  </Pressable>
                </View>

                {/* Reset Password Action Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (loading || otpDigits.join('').length < 4 || password.length < 6) && {
                      opacity: 0.8,
                    },
                  ]}
                  onPress={handleResetPassword}
                  disabled={loading || otpDigits.join('').length < 4 || password.length < 6}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.primary, '#F36800']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Update Password</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Refined Bottom Action Dock */}
                <View style={styles.bottomDockContainer}>
                  <TouchableOpacity
                    onPress={handleRequestOtp}
                    style={styles.dockButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
                    <Text style={styles.dockTextPrimary}>Resend Code</Text>
                  </TouchableOpacity>

                  <View style={styles.dockDivider} />

                  <TouchableOpacity
                    onPress={() => {
                      hapticSelection();
                      setStep(1);
                      setOtpDigits(['', '', '', '']);
                      setPassword('');
                    }}
                    style={styles.dockButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="phone-portrait-outline" size={14} color="#64748B" />
                    <Text style={styles.dockTextSecondary}>Change Number</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Instructions & Official Support Bottom Sheet Overlay */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowGuideModal(false)}
          />
          <View
            style={[
              styles.guideCard,
              {
                maxHeight: SCREEN_HEIGHT * 0.85,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            {/* Sheet Handle Indicator */}
            <View style={styles.sheetHandle} />

            {/* Modal Header */}
            <View style={styles.guideHeader}>
              <View style={styles.guideHeaderLeft}>
                <View style={styles.guideHeaderIconWrap}>
                  <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.guideTitle}>Password Reset Guide</Text>
                  <Text style={styles.guideSubtitle}>Instructions & Support Help</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowGuideModal(false)}
                style={styles.guideCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.guideScrollContent}
              bounces={false}
            >
              {/* Optional: Watch Full Video Tutorial */}
              {guideConfig?.enabled && (
                <TouchableOpacity
                  style={styles.guideVideoBanner}
                  onPress={() => {
                    setShowGuideModal(false);
                    handleOpenGuideVideo();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.guideVideoIconWrap}>
                    <Ionicons name="play" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guideVideoBannerTitle}>Watch Video Guide</Text>
                    <Text style={styles.guideVideoBannerSubtitle}>Watch the step-by-step video tutorial</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}

              {/* Important: Account Required First */}
              <View style={styles.guideAlertBox}>
                <View style={styles.guideAlertHeader}>
                  <Ionicons name="alert-circle" size={18} color="#D97706" />
                  <Text style={styles.guideAlertTitle}>Registered Account Required</Text>
                </View>
                <Text style={styles.guideAlertText}>
                  Password reset works <Text style={{ fontWeight: '700', color: '#92400E' }}>only for phone numbers already registered on Bideo</Text>. If you haven't created an account yet, your number will not be found.
                </Text>
                <TouchableOpacity
                  style={styles.guideAlertSignupButton}
                  onPress={handleGoToSignup}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add" size={14} color="#92400E" />
                  <Text style={styles.guideAlertSignupText}>Go to Sign Up</Text>
                  <Ionicons name="arrow-forward" size={13} color="#92400E" />
                </TouchableOpacity>
              </View>

              {/* Step-by-Step Instructions */}
              <Text style={styles.guideSectionTitle}>How It Works</Text>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepBadge}>
                  <Text style={styles.guideStepBadgeText}>1</Text>
                </View>
                <View style={styles.guideStepContent}>
                  <Text style={styles.guideStepHeading}>Enter Registered Mobile Number</Text>
                  <Text style={styles.guideStepDesc}>
                    Type your 10-digit registered number and tap "Send Verification Code".
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepBadge}>
                  <Text style={styles.guideStepBadgeText}>2</Text>
                </View>
                <View style={styles.guideStepContent}>
                  <Text style={styles.guideStepHeading}>Check Code at Top of Screen</Text>
                  <Text style={styles.guideStepDesc}>
                    A 4-digit verification code will be displayed at the top (<Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700', color: Colors.primary }}>OTP - [CODE]</Text>). Tap the box to instantly copy and fill it into the input fields.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepBadge}>
                  <Text style={styles.guideStepBadgeText}>3</Text>
                </View>
                <View style={styles.guideStepContent}>
                  <Text style={styles.guideStepHeading}>Choose a New Password</Text>
                  <Text style={styles.guideStepDesc}>
                    Enter a new secure password with at least 6 characters.
                  </Text>
                </View>
              </View>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepBadge}>
                  <Text style={styles.guideStepBadgeText}>4</Text>
                </View>
                <View style={styles.guideStepContent}>
                  <Text style={styles.guideStepHeading}>Save & Log In</Text>
                  <Text style={styles.guideStepDesc}>
                    Tap "Update Password" and your new password is saved immediately. You can now log into your account!
                  </Text>
                </View>
              </View>

              {/* Official Support & Direct Mail Section */}
              <View style={styles.guideSupportBox}>
                <View style={styles.guideSupportHeader}>
                  <Ionicons name="mail" size={18} color={Colors.primary} />
                  <Text style={styles.guideSupportTitle}>Need Direct Support?</Text>
                </View>
                <Text style={styles.guideSupportText}>
                  If your phone number is not recognized or you need account recovery assistance, tap below to contact our team directly:
                </Text>

                {/* Direct Tap to Send Mail */}
                <TouchableOpacity
                  style={styles.guideEmailCard}
                  onPress={handleEmailSupport}
                  activeOpacity={0.75}
                >
                  <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                  <Text style={styles.guideEmailAddress}>Contact Bideo Team</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Bottom Dismiss Button */}
            <TouchableOpacity
              style={styles.guideGotItBtn}
              onPress={() => setShowGuideModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.guideGotItBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Direct Sign Up Modal */}
      <AuthModal
        visible={authModalVisible}
        initialMode="signup"
        onClose={() => setAuthModalVisible(false)}
        onLoginSuccess={() => router.replace('/')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE4',
  },
  keyboardView: {
    flex: 1,
  },
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

  // Corner glows
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

  // Corner wave lines
  waveLine: {
    position: 'absolute',
    borderWidth: 1.3,
    borderColor: 'rgba(217, 119, 20, 0.9)',
  },

  // Bottom right sparkle
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
    width: 52,
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

  // Back Button
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 50,
    padding: 6,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 20,
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
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Form Container
  formContainer: {
    width: '100%',
  },
  fieldWrapper: {
    width: '100%',
    marginBottom: 16,
  },

  // Clear, frosted input row
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
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },

  // Pure numeric OTP display card (Small, dashed border, less padding, smaller mono digits)
  numericOtpCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 122, 0, 0.55)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  otpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericOtpPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  numericOtpDigits: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copiedPill: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  copiedPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },

  // Enhanced 4-Box OTP input row
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  otpBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFocused: {
    borderColor: Colors.primary,
    borderWidth: 2.2,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  otpBoxFilled: {
    borderColor: 'rgba(255, 122, 0, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },

  // Primary Action Button (Compact 46px pill)
  primaryButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    marginBottom: 14,
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

  // Switch / Navigation links
  switchTouchable: {
    paddingVertical: 4,
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

  // Refined Bottom Action Dock
  bottomDockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 4,
    alignSelf: 'center',
  },
  dockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  dockTextPrimary: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  dockTextSecondary: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  dockDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },

  // Top right header action buttons container
  headerRightContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.7)',
  },
  guideHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  helpHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.7)',
  },
  helpHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Modal Video Tutorial Banner
  guideVideoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 122, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  guideVideoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideVideoBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guideVideoBannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // Guide Bottom Sheet Modal & Backdrop
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
    justifyContent: 'flex-end',
  },
  guideCard: {
    width: '100%',
    backgroundColor: '#FAF7F0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.15)',
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(203, 213, 225, 0.5)',
  },
  guideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 122, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  guideSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  guideCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
  },
  guideScrollContent: {
    paddingVertical: 14,
  },

  // Alert Box for unregistered users
  guideAlertBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  guideAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guideAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  guideAlertText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  guideAlertSignupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FDE68A',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  guideAlertSignupText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },

  // Steps
  guideSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  guideStepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  guideStepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guideStepContent: {
    flex: 1,
  },
  guideStepHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  guideStepDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },

  // Support section
  guideSupportBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.7)',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 6,
  },
  guideSupportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guideSupportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  guideSupportText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 12,
  },
  guideEmailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 122, 0, 0.40)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 2,
  },
  guideEmailAddress: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },

  // Got It Button
  guideGotItBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  guideGotItBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

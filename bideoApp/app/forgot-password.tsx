import React, { useState, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { authService } from '../services/api';
import { hapticLight, hapticSuccess, hapticSelection } from '../utils/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // 1: Phone, 2: OTP & New Password
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleRequestOtp = async () => {
    hapticSelection();
    const sanitized = cleanPhoneInput(phone);
    if (!sanitized || sanitized.length !== 10) {
      hapticLight();
      return Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
    }

    setLoading(true);
    try {
      const res = await authService.forgotPassword(sanitized);
      if (res?.success) {
        hapticSuccess();
        setStep(2);
        Alert.alert('OTP Sent', 'Use dummy OTP 1234 to proceed with resetting your password.');
      }
    } catch (err: any) {
      hapticLight();
      const apiError =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.errors?.[0]?.message ||
        'Failed to request OTP. Please verify your phone number.';
      Alert.alert('Unable to Send OTP', apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    hapticSelection();
    const sanitized = cleanPhoneInput(phone);
    const trimmedOtp = otp.trim();
    const trimmedPassword = password.trim();

    if (!trimmedOtp) {
      hapticLight();
      return Alert.alert('Missing OTP', 'Please enter the 4-digit OTP.');
    }

    if (trimmedOtp !== '1234') {
      hapticLight();
      return Alert.alert('Invalid OTP', 'Please enter dummy OTP 1234 to proceed.');
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      hapticLight();
      return Alert.alert('Short Password', 'New password must be at least 6 characters long.');
    }

    setLoading(true);
    try {
      const res = await authService.resetPassword({
        phone: sanitized,
        otp: trimmedOtp,
        password: trimmedPassword,
      });

      if (res?.success) {
        hapticSuccess();
        Alert.alert(
          'Password Reset Successful',
          'Your password has been updated! You can now log in with your new password.',
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

  const handleEmailSupport = () => {
    hapticSelection();
    Linking.openURL(
      'mailto:bideoapps@gmail.com?subject=Bideo%20Password%20Reset%20Help&body=Hi%20Bideo%20Support%2C%0A%0AI%20am%20having%20trouble%20resetting%20my%20password.%0ARegistered%20Phone%3A%20%0A%0AThank%20you!'
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Top Trust & Notice Banner */}
        <View style={styles.trustBanner}>
          <Ionicons name="shield-checkmark" size={15} color="#15803D" style={{ marginTop: 1 }} />
          <Text style={styles.trustDesc}>
            SMS gateway integration is underway. Dummy OTP <Text style={{ fontWeight: '700' }}>1234</Text> is temporary and will be secured with live SMS shortly.
          </Text>
        </View>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={step === 1 ? 'key-outline' : 'shield-checkmark-outline'}
              size={36}
              color={Colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {step === 1 ? 'Forgot Password?' : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Enter your registered phone number to verify your account and receive an OTP.'
              : 'Enter the dummy OTP 1234 and choose a new password for your account.'}
          </Text>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.fieldLabel}>Registered Phone Number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={Colors.textGray}
                  value={phone}
                  onChangeText={(v) => setPhone(cleanPhoneInput(v))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.infoBannerText}>
                Use dummy OTP <Text style={{ fontWeight: '700' }}>1234</Text> in the next step to verify and set a new password.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (loading || phone.length < 10) && styles.disabledButton]}
              onPress={handleRequestOtp}
              disabled={loading || phone.length < 10}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Phone Info Badge */}
            <View style={styles.phoneBadge}>
              <View style={styles.phoneBadgeLeft}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.textGray} />
                <Text style={styles.phoneBadgeText}>+91 {phone}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  hapticSelection();
                  setStep(1);
                  setOtp('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.changePhoneText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* OTP Input */}
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Enter OTP</Text>
                <Text style={styles.otpHint}>Dummy OTP: 1234</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter 1234"
                placeholderTextColor={Colors.textGray}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                editable={!loading}
              />
            </View>

            {/* New Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={Colors.textGray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={Colors.textGray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (loading || otp.length < 4 || password.length < 6) && styles.disabledButton]}
              onPress={handleResetPassword}
              disabled={loading || otp.length < 4 || password.length < 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticSelection();
                setStep(1);
                setOtp('');
              }}
              style={styles.backToStepBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.backToStepText}>Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Fallback Support Link */}
        <View style={styles.footerSection}>
          <Text style={styles.footerHelpText}>Still having trouble?</Text>
          <TouchableOpacity onPress={handleEmailSupport} activeOpacity={0.7}>
            <Text style={styles.supportLinkText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 36,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 6,
    marginBottom: 16,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    gap: 8,
  },
  trustDesc: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary + '16',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  otpHint: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  countryCodeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    color: Colors.text,
  },
  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    padding: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#92400E',
    lineHeight: 18,
  },
  phoneBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  phoneBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  changePhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backToStepBtn: {
    marginTop: 18,
    alignItems: 'center',
    padding: 8,
  },
  backToStepText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 36,
    gap: 6,
  },
  footerHelpText: {
    fontSize: 13,
    color: Colors.textGray,
  },
  supportLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});

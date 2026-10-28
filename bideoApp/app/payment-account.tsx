import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import AuthModal from '../components/AuthModal';
import Colors from '../constants/Colors';
import StickyBannerAd from '../components/StickyBannerAd';
import { showAlert } from '../components/AppAlert';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { userService, PaymentAccount, PaymentAccountInput } from '../services/api';

type FormState = {
  name: string;
  phone: string;
  adharNumber: string;
  upiId: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
};

type FieldKey = keyof FormState;
type FormErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  adharNumber: '',
  upiId: '',
  bankName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
};

const RULES = {
  phone: /^[6-9]\d{9}$/,
  adharNumber: /^\d{12}$/,
  upiId: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/,
  accountNumber: /^\d{9,18}$/,
  ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/,
};

const STATUS_META: Record<PaymentAccount['status'], { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { label: 'Active', color: '#16A34A', icon: 'checkmark-circle' },
  pending: { label: 'Under review', color: '#D97706', icon: 'time-outline' },
  rejected: { label: 'Rejected', color: '#DC2626', icon: 'close-circle' },
};

const digitsOnly = (value?: string) => String(value || '').replace(/\D/g, '');

const toForm = (account: PaymentAccount): FormState => ({
  name: (account.name || '').trim(),
  phone: digitsOnly(account.phone).slice(-10),
  adharNumber: digitsOnly(account.adharNumber).slice(0, 12),
  upiId: (account.upiId || '').replace(/\s/g, ''),
  bankName: (account.bankDetails?.bankName || '').trim(),
  accountNumber: digitsOnly(account.bankDetails?.accountNumber).slice(0, 18),
  confirmAccountNumber: '',
  ifscCode: (account.bankDetails?.ifscCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11),
});

const toPayload = (form: FormState): PaymentAccountInput => ({
  name: form.name.trim(),
  phone: form.phone.trim(),
  adharNumber: form.adharNumber.trim(),
  upiId: form.upiId.trim(),
  bankDetails: {
    bankName: form.bankName.trim(),
    accountNumber: form.accountNumber.trim(),
    ifscCode: form.ifscCode.trim().toUpperCase(),
  },
});

const validate = (form: FormState, accountNumberChanged: boolean, isEditMode: boolean): FormErrors => {
  const p = toPayload(form);
  const errors: FormErrors = {};
  if (p.name.length < 2) errors.name = 'Enter the account holder name';
  if (!RULES.phone.test(p.phone)) errors.phone = 'Enter a valid 10-digit mobile number';
  if (p.adharNumber && !RULES.adharNumber.test(p.adharNumber)) errors.adharNumber = 'Aadhaar must be 12 digits';
  if (p.upiId && !RULES.upiId.test(p.upiId)) errors.upiId = 'Enter a valid UPI ID (e.g. name@okhdfcbank)';
  if (p.bankDetails.bankName.length < 2) errors.bankName = 'Enter your bank name';
  if (!RULES.accountNumber.test(p.bankDetails.accountNumber)) errors.accountNumber = 'Account number must be 9 to 18 digits';

  if (!isEditMode || accountNumberChanged) {
    if (!form.confirmAccountNumber.trim()) {
      errors.confirmAccountNumber = 'Please confirm account number';
    } else if (form.confirmAccountNumber.trim() !== p.bankDetails.accountNumber) {
      errors.confirmAccountNumber = 'Account numbers do not match';
    }
  }

  if (!RULES.ifscCode.test(p.bankDetails.ifscCode)) errors.ifscCode = 'Enter a valid 11-character IFSC code';
  return errors;
};

const maskTail = (value: string, visible = 4) => (value ? `•••• ${value.slice(-visible)}` : 'Not added');

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  right?: React.ReactNode;
};

const Field = React.memo(function Field({
  label,
  error,
  hint,
  optional,
  right,
  style,
  ...inputProps
}: FieldProps) {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {optional && <Text style={styles.optionalBadge}>Optional</Text>}
      </View>
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        <TextInput
          placeholderTextColor="#9CA3AF"
          style={[styles.textInput, style]}
          {...inputProps}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default function PaymentAccountScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [account, setAccount] = useState<PaymentAccount | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [accountNumberFocused, setAccountNumberFocused] = useState(false);

  const allowLeaveRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const isEditMode = Boolean(account);

  const loadAccount = useCallback(async () => {
    if (!isAuthenticated) {
      setInitialLoading(false);
      return;
    }
    try {
      // 4-second timeout race so network never leaves the screen hanging
      const fetchPromise = userService.getPaymentAccount();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
      const data = await Promise.race([fetchPromise, timeoutPromise]);

      hasLoadedRef.current = true;
      if (data) {
        setAccount(data);
        const next = toForm(data);
        setInitialForm(next);
        setForm(next);
      } else {
        setAccount(null);
        setInitialForm(EMPTY_FORM);
        setForm((prev) => ({
          ...EMPTY_FORM,
          name: prev.name || (user?.name || '').trim(),
          phone: prev.phone || digitsOnly(user?.phone).slice(-10),
        }));
      }
    } catch (err: any) {
      console.log('Payment account load result:', err?.message || err);
      hasLoadedRef.current = true;
      setAccount(null);
      setInitialForm(EMPTY_FORM);
      setForm((prev) => ({
        ...EMPTY_FORM,
        name: prev.name || (user?.name || '').trim(),
        phone: prev.phone || digitsOnly(user?.phone).slice(-10),
      }));
    } finally {
      setInitialLoading(false);
    }
  }, [isAuthenticated, user?.name, user?.phone]);

  // Initial load on mount
  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  // Pre-fill user profile info if empty
  useEffect(() => {
    if (!account && isAuthenticated && user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || (user.name || '').trim(),
        phone: prev.phone || digitsOnly(user.phone).slice(-10),
      }));
    }
  }, [account, isAuthenticated, user]);

  const accountNumberChanged = form.accountNumber.trim() !== initialForm.accountNumber;

  const isDirty = useMemo(() => {
    if (!account) {
      return (Object.keys(EMPTY_FORM) as FieldKey[]).some((k) => form[k].trim() !== '');
    }
    return (Object.keys(EMPTY_FORM) as FieldKey[]).some(
      (k) => k !== 'confirmAccountNumber' && form[k] !== initialForm[k]
    );
  }, [form, initialForm, account]);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useFocusEffect(
    useCallback(() => {
      if (!isDirtyRef.current && !hasLoadedRef.current) {
        loadAccount();
      }
    }, [loadAccount])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || saving || allowLeaveRef.current) return;
      e.preventDefault();
      showAlert('Discard changes?', 'You have unsaved changes to your payment account.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowLeaveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, isDirty, saving]);

  const setField = useCallback((key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (isEditMode && !isDirty) return;

    const nextErrors = validate(form, accountNumberChanged, isEditMode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      hapticLight();
      return;
    }

    setSaving(true);
    try {
      const updated = await userService.updatePaymentAccount(toPayload(form));
      const next = toForm(updated);
      setAccount(updated);
      setInitialForm(next);
      setForm(next);
      setShowAccountNumber(false);
      hapticSuccess();
      showAlert(
        isEditMode ? 'Payment account updated' : 'Payment account saved',
        isEditMode
          ? 'Your new details will be used for future withdrawals.'
          : 'Your payment details have been saved for withdrawals.'
      );
    } catch (err: any) {
      const serverErrors = err?.response?.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') setErrors(serverErrors);
      showAlert('Could not save', err?.response?.data?.message || 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [form, isDirty, isEditMode, saving, accountNumberChanged]);

  const canSave = !saving && (isEditMode ? isDirty : true);
  const status = account ? STATUS_META[account.status] || STATUS_META.pending : null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Short and clean header: "Payment Account" */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Account</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          style={styles.saveHeaderBtn}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text
              style={[
                styles.saveHeaderBtnText,
                !canSave && styles.saveHeaderBtnTextDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <StickyBannerAd position="top" />

      {/* Subtle non-blocking loader */}
      {initialLoading && (
        <View style={styles.inlineLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.inlineLoaderText}>Loading details...</Text>
        </View>
      )}

      {!isAuthenticated ? (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons name="wallet-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>Sign In Required</Text>
          <Text style={styles.stateText}>Please sign in to view and manage your payment account details.</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={() => setAuthModalVisible(true)}>
            <Text style={styles.submitBtnText}>Sign In</Text>
          </TouchableOpacity>
          <AuthModal
            visible={authModalVisible}
            onClose={() => setAuthModalVisible(false)}
            onLoginSuccess={() => loadAccount()}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Status / Info Banner */}
          {account ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.bankIconWrap}>
                  <Ionicons name="card-outline" size={18} color={Colors.primary} />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryBankName}>{initialForm.bankName || 'Bank Account'}</Text>
                  <Text style={styles.summaryAccountNum}>
                    A/C {maskTail(initialForm.accountNumber)} · {initialForm.ifscCode}
                  </Text>
                </View>
                {status && (
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
                    <Ionicons name={status.icon} size={11} color={status.color} />
                    <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} style={{ marginTop: 1 }} />
              <Text style={styles.infoBannerText}>
                Add your bank details and UPI ID to receive withdrawals and creator payouts.
              </Text>
            </View>
          )}

          {/* Section 1: Account Holder */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>Account Holder</Text>
            <Field
              label="Full Legal Name"
              value={form.name}
              onChangeText={(v) => setField('name', v)}
              placeholder="Name as per bank account"
              autoCapitalize="words"
              maxLength={100}
              error={errors.name}
            />
            <Field
              label="Mobile Number"
              value={form.phone}
              onChangeText={(v) => setField('phone', v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
            />
            <Field
              label="Aadhaar Number"
              optional
              value={form.adharNumber}
              onChangeText={(v) => setField('adharNumber', v.replace(/\D/g, '').slice(0, 12))}
              placeholder="12-digit Aadhaar UID"
              keyboardType="number-pad"
              maxLength={12}
              error={errors.adharNumber}
            />
          </View>

          {/* Section 2: Bank Account */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>Bank Details</Text>
            <Field
              label="Bank Name"
              value={form.bankName}
              onChangeText={(v) => setField('bankName', v)}
              placeholder="e.g. State Bank of India, HDFC"
              autoCapitalize="words"
              maxLength={100}
              error={errors.bankName}
            />
            <Field
              label="Account Number"
              value={form.accountNumber}
              onChangeText={(v) => setField('accountNumber', v.replace(/\D/g, '').slice(0, 18))}
              placeholder="9 to 18 digits"
              keyboardType="number-pad"
              maxLength={18}
              secureTextEntry={!showAccountNumber && !accountNumberFocused}
              onFocus={() => setAccountNumberFocused(true)}
              onBlur={() => setAccountNumberFocused(false)}
              error={errors.accountNumber}
              right={
                <TouchableOpacity
                  onPress={() => setShowAccountNumber((s) => !s)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showAccountNumber ? 'Hide' : 'Show'}
                >
                  <Ionicons name={showAccountNumber ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6B7280" />
                </TouchableOpacity>
              }
            />
            {(!isEditMode || accountNumberChanged) && (
              <Field
                label="Confirm Account Number"
                value={form.confirmAccountNumber}
                onChangeText={(v) => setField('confirmAccountNumber', v.replace(/\D/g, '').slice(0, 18))}
                placeholder="Re-enter account number"
                keyboardType="number-pad"
                maxLength={18}
                secureTextEntry={!showAccountNumber}
                contextMenuHidden
                error={errors.confirmAccountNumber}
              />
            )}
            <Field
              label="IFSC Code"
              value={form.ifscCode}
              onChangeText={(v) => setField('ifscCode', v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11))}
              placeholder="e.g. SBIN0001234"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={11}
              error={errors.ifscCode}
            />
          </View>

          {/* Section 3: UPI */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>UPI (Optional)</Text>
            <Field
              label="UPI ID"
              optional
              value={form.upiId}
              onChangeText={(v) => setField('upiId', v.replace(/\s/g, ''))}
              placeholder="e.g. username@okhdfcbank"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={320}
              error={errors.upiId}
              hint="Recommended for faster payouts"
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSave && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditMode ? 'Save Changes' : 'Save Payment Account'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.secureRow}>
            <Ionicons name="lock-closed-outline" size={12} color="#9CA3AF" />
            <Text style={styles.secureText}>Details are encrypted & used strictly for withdrawals</Text>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  saveHeaderBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  saveHeaderBtnTextDisabled: {
    color: '#9CA3AF',
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: Colors.primary + '10',
  },
  inlineLoaderText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    padding: 14,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryBankName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryAccountNum: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    height: 44,
    paddingHorizontal: 12,
  },
  inputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  eyeBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 3,
    marginLeft: 2,
  },
  hintText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
    marginLeft: 2,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  secureText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 4,
  },
});

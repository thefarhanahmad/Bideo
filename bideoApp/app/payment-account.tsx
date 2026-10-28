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

// Same rules the backend enforces on PUT /users/monetization/payment-account
const RULES = {
  phone: /^[6-9]\d{9}$/,
  adharNumber: /^\d{12}$/,
  upiId: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/,
  accountNumber: /^\d{9,18}$/,
  ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/,
};

const STATUS_META: Record<PaymentAccount['status'], { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { label: 'Monetization active', color: '#16A34A', icon: 'checkmark-circle' },
  pending: { label: 'Under review', color: '#D97706', icon: 'time' },
  rejected: { label: 'Application rejected', color: '#DC2626', icon: 'close-circle' },
};

const digitsOnly = (value?: string) => String(value || '').replace(/\D/g, '');

// Step 2 accepted free text, so saved values can hold a +91 prefix or spaces: show them the way
// the fields here expect them
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

const validate = (form: FormState, accountNumberChanged: boolean): FormErrors => {
  const p = toPayload(form);
  const errors: FormErrors = {};
  if (p.name.length < 2) errors.name = 'Enter the account holder name';
  if (!RULES.phone.test(p.phone)) errors.phone = 'Enter a valid 10-digit mobile number';
  if (p.adharNumber && !RULES.adharNumber.test(p.adharNumber)) errors.adharNumber = 'Aadhaar must be 12 digits';
  if (p.upiId && !RULES.upiId.test(p.upiId)) errors.upiId = 'Enter a valid UPI ID (e.g. name@okhdfcbank)';
  if (p.bankDetails.bankName.length < 2) errors.bankName = 'Enter your bank name';
  if (!RULES.accountNumber.test(p.bankDetails.accountNumber)) errors.accountNumber = 'Account number must be 9 to 18 digits';
  if (accountNumberChanged && form.confirmAccountNumber.trim() !== p.bankDetails.accountNumber) {
    errors.confirmAccountNumber = 'Account numbers do not match';
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

const Field = React.memo(function Field({ label, error, hint, optional, right, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.optional}>  (Optional)</Text>}
      </Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput placeholderTextColor="#9CA3AF" style={[styles.input, style]} {...inputProps} />
        {right}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
});

export default function PaymentAccountScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [account, setAccount] = useState<PaymentAccount | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  // iOS clears a hidden (secure) field when typing starts again, so the number shows while edited
  const [accountNumberFocused, setAccountNumberFocused] = useState(false);

  // Lets the unsaved-changes guard skip the prompt after a successful save
  const allowLeaveRef = useRef(false);

  const hasLoadedRef = useRef(false);

  // First load shows the spinner; later refreshes (coming back to the screen) happen quietly
  const loadAccount = useCallback(async () => {
    const quiet = hasLoadedRef.current;
    if (!quiet) setLoading(true);
    setLoadError(false);
    try {
      const data = await userService.getPaymentAccount();
      hasLoadedRef.current = true;
      setAccount(data);
      if (data) {
        const next = toForm(data);
        setInitialForm(next);
        setForm(next);
      }
    } catch (err) {
      console.error('Error loading payment account:', err);
      if (!quiet) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const accountNumberChanged = form.accountNumber.trim() !== initialForm.accountNumber;
  const isDirty = useMemo(
    () => (Object.keys(EMPTY_FORM) as FieldKey[]).some((k) => k !== 'confirmAccountNumber' && form[k] !== initialForm[k]),
    [form, initialForm]
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Load on open and refresh on return (e.g. after completing step 2 on the Earnings screen),
  // but never overwrite edits that are not saved yet
  useFocusEffect(
    useCallback(() => {
      if (!isDirtyRef.current) loadAccount();
    }, [loadAccount])
  );

  // Warn before leaving with unsaved edits (back button, gesture or hardware back)
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
    if (!isDirty || saving) return;
    const nextErrors = validate(form, accountNumberChanged);
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
      showAlert('Payment account updated', 'Your new details will be used for future withdrawals.');
    } catch (err: any) {
      const serverErrors = err?.response?.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') setErrors(serverErrors);
      showAlert('Could not save', err?.response?.data?.message || 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [form, isDirty, saving, accountNumberChanged]);

  const canSave = isDirty && !saving;

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textGray} />
          <Text style={styles.stateTitle}>Couldn't load your payment account</Text>
          <Text style={styles.stateText}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={loadAccount}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!account) {
      return (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons name="wallet-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>No payment account yet</Text>
          <Text style={styles.stateText}>
            Your payment account is created when you submit monetization step 2 (Aadhaar, UPI & bank details) on the
            Earnings screen.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/earnings')}>
            <Text style={styles.primaryBtnText}>Go to Earnings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const status = STATUS_META[account.status] || STATUS_META.pending;

    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Ionicons name="wallet" size={22} color={Colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.summaryTitle}>{initialForm.bankName || 'Bank account'}</Text>
              <Text style={styles.summarySub}>A/C {maskTail(initialForm.accountNumber)}  ·  {initialForm.ifscCode}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textGray} />
            <Text style={styles.noteText}>
              {account.status === 'rejected'
                ? 'Updating details here does not resubmit your application. Re-apply from the Earnings screen.'
                : 'Changes apply to future withdrawals. Withdrawals already requested keep the details they were sent with.'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account holder</Text>
        <View style={styles.card}>
          <Field
            label="Full legal name (as per bank)"
            value={form.name}
            onChangeText={(v) => setField('name', v)}
            placeholder="e.g. Rahul Kumar"
            autoCapitalize="words"
            maxLength={100}
            error={errors.name}
          />
          <Field
            label="Mobile number"
            value={form.phone}
            onChangeText={(v) => setField('phone', v.replace(/\D/g, '').slice(0, 10))}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.phone}
          />
          <Field
            label="Aadhaar number"
            optional
            value={form.adharNumber}
            onChangeText={(v) => setField('adharNumber', v.replace(/\D/g, '').slice(0, 12))}
            placeholder="12-digit Aadhaar UID"
            keyboardType="number-pad"
            maxLength={12}
            error={errors.adharNumber}
          />
        </View>

        <Text style={styles.sectionTitle}>UPI</Text>
        <View style={styles.card}>
          <Field
            label="UPI ID"
            optional
            value={form.upiId}
            onChangeText={(v) => setField('upiId', v.replace(/\s/g, ''))}
            placeholder="e.g. name@okhdfcbank"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={320}
            error={errors.upiId}
            hint="Fastest way to receive payouts"
          />
        </View>

        <Text style={styles.sectionTitle}>Bank account</Text>
        <View style={styles.card}>
          <Field
            label="Bank name"
            value={form.bankName}
            onChangeText={(v) => setField('bankName', v)}
            placeholder="e.g. State Bank of India"
            autoCapitalize="words"
            maxLength={100}
            error={errors.bankName}
          />
          <Field
            label="Account number"
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showAccountNumber ? 'Hide account number' : 'Show account number'}
              >
                <Ionicons name={showAccountNumber ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textGray} />
              </TouchableOpacity>
            }
          />
          {accountNumberChanged && (
            <Field
              label="Confirm account number"
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
            label="IFSC code"
            value={form.ifscCode}
            onChangeText={(v) => setField('ifscCode', v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11))}
            placeholder="e.g. SBIN0001234"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={11}
            error={errors.ifscCode}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, styles.saveBtn, !canSave && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Save changes</Text>}
        </TouchableOpacity>

        <View style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.textGray} />
          <Text style={styles.secureText}>Your details are only used to send your Bideo payouts.</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header and banner stay fixed at the top while the form scrolls */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Account</Text>
        {account && !loading ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveHeaderBtn, !canSave && styles.btnDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.saveHeaderBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
      <StickyBannerAd position="top" />

      {renderBody()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  saveHeaderBtn: {
    minWidth: 60,
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.primary + '10',
  },
  saveHeaderBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  content: {
    padding: 16,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  stateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  summarySub: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  noteRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textGray,
    lineHeight: 17,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  field: {
    marginTop: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  optional: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textGray,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: '#FBFBFB',
    marginTop: 6,
  },
  inputWrapError: {
    borderColor: '#DC2626',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: {
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  secureText: {
    fontSize: 12,
    color: Colors.textGray,
    marginLeft: 4,
  },
});

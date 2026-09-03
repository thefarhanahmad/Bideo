import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Image } from 'expo-image';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { RootState } from '../redux/store';
import { formatViews } from '../utils/formatDate';

const MIN_WITHDRAWAL = 1000;

export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [monetizationData, setMonetizationData] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const [performanceStats, setPerformanceStats] = useState({
    longCount: 0,
    longViews: 0,
    longLikes: 0,
    longComments: 0,
    shortCount: 0,
    shortViews: 0,
    shortLikes: 0,
    shortComments: 0,
    postCount: 0,
    postLikes: 0,
    postComments: 0,
  });

  // Monetization Application Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adharNumber, setAdharNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Withdrawal Modal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank'>('upi');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [customUpiId, setCustomUpiId] = useState('');
  const [customBankName, setCustomBankName] = useState('');
  const [customAccountNumber, setCustomAccountNumber] = useState('');
  const [customIfscCode, setCustomIfscCode] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/users/monetization/status');
      if (res.data.success) {
        setMonetizationData(res.data.data);
        const app = res.data.data.application;
        if (app) {
          setName(app.name || '');
          setPhone(app.phone || '');
          setAdharNumber(app.adharNumber || '');
          setUpiId(app.upiId || '');
          setCustomUpiId(app.upiId || '');
          if (app.bankDetails) {
            setBankName(app.bankDetails.bankName || '');
            setAccountNumber(app.bankDetails.accountNumber || '');
            setIfscCode(app.bankDetails.ifscCode || '');
            setCustomBankName(app.bankDetails.bankName || '');
            setCustomAccountNumber(app.bankDetails.accountNumber || '');
            setCustomIfscCode(app.bankDetails.ifscCode || '');
          }
        }
      }

      // Fetch views count & performance metrics
      const vidsRes = await api.get('/videos/me');
      const vids = vidsRes.data?.data || [];

      const ownerId = user?._id || user?.id;
      let posts = [];
      if (ownerId) {
        try {
          const postsRes = await api.get(`/posts?owner=${ownerId}`);
          posts = postsRes.data?.data || [];
        } catch (postErr) {
          console.log('Failed to fetch posts for metrics', postErr);
        }
      }

      // Calculate stats
      const longVids = vids.filter((v: any) => !v.isShort);
      const shortVids = vids.filter((v: any) => v.isShort);

      const longViews = longVids.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const longLikes = longVids.reduce((sum: number, v: any) => sum + (v.likes?.length || 0), 0);
      const longComments = longVids.reduce((sum: number, v: any) => sum + (v.commentsCount || 0), 0);

      const shortViews = shortVids.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const shortLikes = shortVids.reduce((sum: number, v: any) => sum + (v.likes?.length || 0), 0);
      const shortComments = shortVids.reduce((sum: number, v: any) => sum + (v.commentsCount || 0), 0);

      const postLikes = posts.reduce((sum: number, p: any) => sum + (p.likes?.length || 0), 0);
      const postComments = posts.reduce((sum: number, p: any) => sum + (p.commentsCount || 0), 0);

      setPerformanceStats({
        longCount: longVids.length,
        longViews,
        longLikes,
        longComments,
        shortCount: shortVids.length,
        shortViews,
        shortLikes,
        shortComments,
        postCount: posts.length,
        postLikes,
        postComments,
      });

      // Fetch past withdrawals
      try {
        const withRes = await api.get('/users/withdrawals');
        if (withRes.data.success) {
          setWithdrawals(withRes.data.data || []);
        }
      } catch (withErr) {
        console.log('Failed to fetch withdrawals', withErr);
      }
    } catch (err) {
      console.log('Failed to fetch monetization status / videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleApply = async () => {
    if (!name.trim() || !phone.trim() || !bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      showAlert('Required Fields', 'Please fill in all the required details to submit your application.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/users/monetization/apply', {
        name,
        phone,
        adharNumber,
        upiId,
        bankDetails: {
          bankName,
          accountNumber,
          ifscCode,
        },
      });
      if (res.data.success) {
        showAlert('Success', 'Monetization application submitted successfully! Admin will review your profile shortly.');
        fetchStatus();
      }
    } catch (err: any) {
      showAlert('Error', err.response?.data?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const openWithdrawModal = () => {
    const balance = Number(monetizationData?.walletBalance || 0);
    if (balance < MIN_WITHDRAWAL) {
      showAlert(
        'Minimum ₹1,000 Required',
        `Your current wallet balance is ₹${balance.toFixed(2)}. You need ₹${(MIN_WITHDRAWAL - balance).toFixed(2)} more in earnings to request a withdrawal.`
      );
      return;
    }
    setWithdrawAmount(String(Math.floor(balance)));
    setShowWithdrawModal(true);
  };

  const handleWithdrawSubmit = async () => {
    const amountNum = Number(withdrawAmount);
    const balance = Number(monetizationData?.walletBalance || 0);

    if (!amountNum || isNaN(amountNum) || amountNum < MIN_WITHDRAWAL) {
      showAlert('Invalid Amount', `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`);
      return;
    }
    if (amountNum > balance) {
      showAlert('Insufficient Balance', `You cannot withdraw more than your available balance of ₹${balance.toFixed(2)}.`);
      return;
    }

    if (withdrawMethod === 'upi' && !customUpiId.trim()) {
      showAlert('UPI ID Required', 'Please enter a valid UPI ID for payout.');
      return;
    }
    if (withdrawMethod === 'bank' && (!customAccountNumber.trim() || !customIfscCode.trim())) {
      showAlert('Bank Details Required', 'Please enter valid Bank Account Number and IFSC Code.');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await api.post('/users/withdraw', {
        amount: amountNum,
        payoutMethod: withdrawMethod,
        payoutDetails: {
          upiId: withdrawMethod === 'upi' ? customUpiId.trim() : null,
          bankName: withdrawMethod === 'bank' ? customBankName.trim() : null,
          accountNumber: withdrawMethod === 'bank' ? customAccountNumber.trim() : null,
          ifscCode: withdrawMethod === 'bank' ? customIfscCode.trim() : null,
        },
      });

      if (res.data.success) {
        setShowWithdrawModal(false);
        showAlert(
          'Withdrawal Requested 🎉',
          `₹${amountNum.toLocaleString('en-IN')} has been submitted for payout. Funds will be credited directly to your ${withdrawMethod === 'upi' ? 'UPI' : 'Bank'} within 24-48 hours.`
        );
        fetchStatus();
      }
    } catch (err: any) {
      showAlert('Withdrawal Failed', err.response?.data?.message || 'Failed to submit withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  };

  const walletBalance = Number(monetizationData?.walletBalance || 0);
  const totalEarnings = Number(monetizationData?.totalEarnings || 0);
  const progressRatio = Math.min(1, walletBalance / MIN_WITHDRAWAL);
  const canWithdraw = walletBalance >= MIN_WITHDRAWAL;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: '#E8F5E9', text: '#2E7D32', label: 'Paid / Transferred' };
      case 'rejected':
        return { bg: '#FFEBEE', text: '#C62828', label: 'Rejected (Refunded)' };
      default:
        return { bg: '#FFF8E1', text: '#F57F17', label: 'Processing / Pending' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Earnings & Payouts</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : monetizationData?.step2Completed ? (
        // Unleashed Earnings Dashboard
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          {/* Main Hero Wallet Card */}
          <LinearGradient
            colors={[Colors.primary, '#8E24AA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Available Wallet Balance</Text>
                <Text style={styles.heroAmount}>₹{walletBalance.toFixed(2)}</Text>
              </View>
              <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={12} color="#FFF" />
                <Text style={styles.badgeText}>Monetized</Text>
              </View>
            </View>

            <View style={styles.lifetimeRow}>
              <Text style={styles.lifetimeLabel}>
                Lifetime Earned: <Text style={{ fontWeight: '800', color: '#FFF' }}>₹{totalEarnings.toFixed(2)}</Text>
              </Text>
              <Text style={styles.lifetimeLabel}>
                Total Views: <Text style={{ fontWeight: '800', color: '#FFF' }}>{formatViews(monetizationData?.totalViews || 0)}</Text>
              </Text>
            </View>

            {/* Withdrawal Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Payout Threshold (Min ₹1,000)</Text>
                <Text style={styles.progressPercent}>{(progressRatio * 100).toFixed(0)}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
              activeOpacity={0.85}
              onPress={openWithdrawModal}
            >
              <Ionicons
                name={canWithdraw ? 'cash-outline' : 'lock-closed-outline'}
                size={16}
                color={canWithdraw ? Colors.primary : '#666'}
              />
              <Text style={[styles.withdrawBtnText, !canWithdraw && styles.withdrawBtnTextDisabled]}>
                Request Withdrawal
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Withdrawal & Payout History */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Payout History</Text>
            {withdrawals.length === 0 ? (
              <View style={styles.emptyHistoryCard}>
                <Ionicons name="receipt-outline" size={32} color="#AAA" />
                <Text style={styles.emptyHistoryTitle}>No Withdrawals Yet</Text>
                <Text style={styles.emptyHistorySub}>When you request a withdrawal, your payout status and transfer references will appear here.</Text>
              </View>
            ) : (
              withdrawals.map((w: any) => {
                const badge = getStatusBadge(w.status);
                return (
                  <View key={w._id} style={styles.historyCard}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyAmount}>₹{Number(w.amount).toLocaleString('en-IN')}</Text>
                      <View style={[styles.historyBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyMethod}>
                        {w.payoutMethod === 'upi' ? `UPI: ${w.payoutDetails?.upiId}` : `Bank: ${w.payoutDetails?.bankName || 'Direct Transfer'} (A/C: ${w.payoutDetails?.accountNumber})`}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {w.transactionId && (
                      <Text style={styles.historyTxn}>Reference / UTR: {w.transactionId}</Text>
                    )}
                    {w.adminNote && (
                      <Text style={styles.historyNote}>Note: {w.adminNote}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : (
        // Step 1 & 2: Onboarding Stepper Checklist
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}>
          {/* Step 1 Card */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumCircle, monetizationData?.step1Completed && styles.stepNumCircleDone]}>
                {monetizationData?.step1Completed ? (
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                ) : (
                  <Text style={styles.stepNumText}>1</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.stepTitle}>Step 1: Upload 3 Original Videos</Text>
                <Text style={styles.stepStatusText}>
                  {monetizationData?.passedVideosCount || 0} of 3 Audited Videos Passed
                </Text>
              </View>
            </View>

            <Text style={styles.stepDescription}>
              Creators must publish at least three original videos. Each video is reviewed by the audit team to ensure quality and copyright compliance.
            </Text>

            {monetizationData?.reviews && monetizationData.reviews.length > 0 && (
              <View style={styles.videoList}>
                {monetizationData.reviews.map((rev: any) => (
                  <View key={rev._id} style={styles.videoItem}>
                    {rev.video && (
                      <Image source={{ uri: rev.video.thumbnail }} style={styles.videoThumb} contentFit="cover" />
                    )}
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={1}>
                        {rev.video?.title || 'Untitled Video'}
                      </Text>
                      <Text style={styles.videoDate}>
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[styles.reviewBadge, { backgroundColor: rev.status === 'passed' ? '#E8F5E9' : rev.status === 'failed' ? '#FFEBEE' : '#FFF8E1' }]}>
                      <Text style={[styles.reviewBadgeText, { color: rev.status === 'passed' ? '#2E7D32' : rev.status === 'failed' ? '#C62828' : '#F57F17' }]}>
                        {rev.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!monetizationData?.step1Completed && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/upload-video')}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
                <Text style={styles.actionBtnText}>Upload Next Video</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stepper Connector */}
          <View style={[styles.stepperLine, monetizationData?.step1Completed && styles.stepperLineDone]} />

          {/* Step 2 Card */}
          <View style={[styles.stepCard, !monetizationData?.step1Completed && styles.cardDisabled]}>
            {!monetizationData?.step1Completed && (
              <View style={styles.lockOverlay}>
                <Ionicons name="lock-closed" size={28} color={Colors.textGray} />
                <Text style={styles.lockText}>Complete Step 1 to unlock Payout Details</Text>
              </View>
            )}

            <View style={styles.stepHeader}>
              <View style={[styles.stepNumCircle, monetizationData?.step2Completed ? styles.stepNumCircleDone : monetizationData?.application?.status === 'pending' ? styles.stepNumCirclePending : null]}>
                {monetizationData?.step2Completed ? (
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                ) : (
                  <Text style={styles.stepNumText}>2</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.stepTitle}>Step 2: Payout & Verification Details</Text>
                <Text style={styles.stepStatusText}>
                  {monetizationData?.step2Completed
                    ? 'Monetization Approved'
                    : monetizationData?.application?.status === 'pending'
                    ? 'Under Review by Admin'
                    : monetizationData?.application?.status === 'rejected'
                    ? 'Application Rejected (Please re-apply)'
                    : 'Submit Aadhaar, UPI & Bank Info'}
                </Text>
              </View>
            </View>

            {monetizationData?.application?.status === 'pending' ? (
              <View style={styles.reviewingBox}>
                <Ionicons name="hourglass-outline" size={20} color="#F57F17" />
                <Text style={styles.reviewingText}>
                  Your verification details have been received! The admin team is currently reviewing your profile. You will be approved shortly.
                </Text>
              </View>
            ) : monetizationData?.application?.status === 'rejected' ? (
              <View style={styles.alertBoxRejected}>
                <Ionicons name="alert-circle" size={20} color="#C62828" />
                <Text style={styles.alertText}>
                  Reason: {monetizationData?.application?.reviewMessage || 'Details did not match verification standards.'}
                </Text>
              </View>
            ) : null}

            {!monetizationData?.application || monetizationData?.application?.status === 'rejected' ? (
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Full Legal Name (as per Bank/Aadhaar)</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Rahul Sharma" placeholderTextColor="#999" />

                <Text style={styles.inputLabel}>Registered Phone Number</Text>
                <TextInput style={styles.input} value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="e.g. 9876543210" keyboardType="phone-pad" maxLength={10} placeholderTextColor="#999" />

                <Text style={styles.inputLabel}>Aadhaar Number <Text style={{ color: Colors.textGray, fontSize: 12 }}>(Optional)</Text></Text>
                <TextInput style={styles.input} value={adharNumber} onChangeText={setAdharNumber} placeholder="12-digit Aadhaar UID (Optional)" keyboardType="numeric" maxLength={12} placeholderTextColor="#999" />

                <View style={styles.formSectionDivider}>
                  <Text style={styles.formSectionTitle}>Direct Payout Details</Text>
                </View>

                <Text style={styles.inputLabel}>Primary UPI ID <Text style={{ color: Colors.textGray, fontSize: 12 }}>(Optional)</Text></Text>
                <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="e.g. user@okhdfcbank (Optional)" autoCapitalize="none" placeholderTextColor="#999" />

                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" placeholderTextColor="#999" />

                <Text style={styles.inputLabel}>Bank Account Number</Text>
                <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="Account Number" keyboardType="numeric" secureTextEntry placeholderTextColor="#999" />

                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput style={styles.input} value={ifscCode} onChangeText={setIfscCode} placeholder="e.g. SBIN0001234" autoCapitalize="characters" placeholderTextColor="#999" />

                {submitting ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
                ) : (
                  <TouchableOpacity style={styles.submitBtn} onPress={handleApply}>
                    <Text style={styles.submitBtnText}>Submit Verification Details</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.readonlyDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Beneficiary Name</Text>
                  <Text style={styles.detailValue}>{name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Aadhaar UID</Text>
                  <Text style={styles.detailValue}>{adharNumber ? `XXXX XXXX ${adharNumber.slice(-4)}` : 'Not Provided'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>UPI ID</Text>
                  <Text style={styles.detailValue}>{upiId ? upiId : 'Not Provided'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank Name</Text>
                  <Text style={styles.detailValue}>{bankName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account No</Text>
                  <Text style={styles.detailValue}>XXXXXX{accountNumber.slice(-4)}</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Withdrawal Request Interactive Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => !withdrawing && setShowWithdrawModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Payout</Text>
                <Text style={styles.modalSub}>Available: ₹{walletBalance.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => !withdrawing && setShowWithdrawModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Method Selector */}
              <Text style={styles.modalSectionLabel}>Select Payout Destination</Text>
              <View style={styles.methodSelector}>
                <TouchableOpacity
                  style={[styles.methodOption, withdrawMethod === 'upi' && styles.methodOptionActive]}
                  onPress={() => setWithdrawMethod('upi')}
                >
                  <Ionicons name="flash-outline" size={18} color={withdrawMethod === 'upi' ? Colors.primary : '#666'} />
                  <Text style={[styles.methodText, withdrawMethod === 'upi' && styles.methodTextActive]}>
                    UPI Transfer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodOption, withdrawMethod === 'bank' && styles.methodOptionActive]}
                  onPress={() => setWithdrawMethod('bank')}
                >
                  <Ionicons name="business-outline" size={18} color={withdrawMethod === 'bank' ? Colors.primary : '#666'} />
                  <Text style={[styles.methodText, withdrawMethod === 'bank' && styles.methodTextActive]}>
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Method details input */}
              {withdrawMethod === 'upi' ? (
                <View style={styles.payoutInputs}>
                  <Text style={styles.inputLabel}>UPI ID</Text>
                  <TextInput
                    style={styles.input}
                    value={customUpiId}
                    onChangeText={setCustomUpiId}
                    placeholder="e.g. user@okhdfcbank"
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={styles.payoutInputs}>
                  <Text style={styles.inputLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    value={customBankName}
                    onChangeText={setCustomBankName}
                    placeholder="Bank Name"
                  />
                  <Text style={styles.inputLabel}>Account Number</Text>
                  <TextInput
                    style={styles.input}
                    value={customAccountNumber}
                    onChangeText={setCustomAccountNumber}
                    placeholder="Bank Account Number"
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.input}
                    value={customIfscCode}
                    onChangeText={setCustomIfscCode}
                    placeholder="IFSC Code"
                    autoCapitalize="characters"
                  />
                </View>
              )}

              {/* Amount Input */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.inputLabel}>Withdrawal Amount (₹)</Text>
                  <TouchableOpacity onPress={() => setWithdrawAmount(String(Math.floor(walletBalance)))}>
                    <Text style={styles.maxBtnText}>Max: ₹{Math.floor(walletBalance)}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { fontSize: 18, fontWeight: '700', color: Colors.primary }]}
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  placeholder={`Min ₹${MIN_WITHDRAWAL}`}
                  keyboardType="numeric"
                />
                <Text style={styles.minNote}>Minimum payout threshold is ₹1,000.</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#1E88E5" />
                <Text style={styles.infoBoxText}>
                  Withdrawal requests are processed and credited directly to your account within 24 to 48 business hours.
                </Text>
              </View>

              {withdrawing ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity
                  style={styles.confirmWithdrawBtn}
                  onPress={handleWithdrawSubmit}
                >
                  <Text style={styles.confirmWithdrawText}>Submit Withdrawal Request</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scrollContent: {
    padding: 15,
  },
  hero: {
    margin: 12,
    borderRadius: 18,
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  heroAmount: { color: Colors.white, fontSize: 32, fontWeight: '800', marginTop: 4 },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  lifetimeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  progressContainer: {
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  progressPercent: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E676',
    borderRadius: 3,
  },
  withdrawBtn: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  withdrawBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  withdrawBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  withdrawBtnTextDisabled: { color: '#666', fontWeight: '600' },
  rateBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 16,
    fontWeight: '500',
  },
  statsSection: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  metricCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  metricSub: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
    fontWeight: '500',
  },
  metricCount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
  },
  emptyHistoryCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptyHistorySub: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  historyMethod: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGray,
  },
  historyDate: {
    fontSize: 11,
    color: '#999',
  },
  historyTxn: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  historyNote: {
    fontSize: 11,
    color: '#D32F2F',
    marginTop: 2,
  },
  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    position: 'relative',
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.8,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lockText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textGray,
    textAlign: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumCircleDone: {
    backgroundColor: '#2E7D32',
  },
  stepNumCirclePending: {
    backgroundColor: '#F57F17',
  },
  stepNumText: {
    color: Colors.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  stepStatusText: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '600',
    marginTop: 1,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: '500',
  },
  videoList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    backgroundColor: '#F9F9FA',
    padding: 8,
    borderRadius: 8,
  },
  videoThumb: {
    width: 50,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#EEE',
  },
  videoInfo: {
    flex: 1,
    marginLeft: 10,
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  videoDate: {
    fontSize: 10,
    color: Colors.textGray,
    marginTop: 2,
  },
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  stepperLine: {
    width: 2,
    height: 24,
    backgroundColor: '#DDD',
    marginLeft: 30,
    marginVertical: 4,
  },
  stepperLineDone: {
    backgroundColor: '#2E7D32',
  },
  alertBoxRejected: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '600',
  },
  formContainer: {
    marginTop: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#FBFBFB',
  },
  formSectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 4,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textGray,
    textTransform: 'uppercase',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  readonlyDetails: {
    marginTop: 14,
    backgroundColor: '#F9F9FA',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  reviewingBox: {
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#FFF59D',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    gap: 8,
  },
  reviewingText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  methodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F9F9F9',
  },
  methodOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F3E5F5',
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  methodTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  payoutInputs: {
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  maxBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  minNote: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 14,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: '#1565C0',
    lineHeight: 15,
    fontWeight: '500',
  },
  confirmWithdrawBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  confirmWithdrawText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

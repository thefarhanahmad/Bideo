import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
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

const EST_CPM = 30; // ₹ per 1,000 views (illustrative)

export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [monetizationData, setMonetizationData] = useState<any>(null);
  const [totalViews, setTotalViews] = useState(0);

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

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adharNumber, setAdharNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          if (app.bankDetails) {
            setBankName(app.bankDetails.bankName || '');
            setAccountNumber(app.bankDetails.accountNumber || '');
            setIfscCode(app.bankDetails.ifscCode || '');
          }
        }
      }

      // Fetch views count & performance metrics
      const vidsRes = await api.get('/videos/me');
      const vids = vidsRes.data?.data || [];
      setTotalViews(vids.reduce((sum: number, v: any) => sum + (v.views || 0), 0));

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
        postComments
      });
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
    if (!name.trim() || !phone.trim() || !adharNumber.trim() || !upiId.trim() || !bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      showAlert('Required Fields', 'Please fill in all the details to submit your application.');
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
          ifscCode
        }
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

  const comingSoon = () =>
    showAlert(
      'Coming Soon',
      'Withdrawals will open once monetization payout cycles start next month. Keep creating!'
    );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'passed': return '#E8F5E9';
      case 'failed': return '#FFEBEE';
      default: return '#FFF8E1';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'passed': return '#2E7D32';
      case 'failed': return '#C62828';
      default: return '#F57F17';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Onboarding</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : monetizationData?.step2Completed ? (
        // Step 3: Unleashed Earnings Dashboard
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>Total Earnings</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>Active</Text></View>
            </View>
            <Text style={styles.heroAmount}>₹0.00</Text>
            <Text style={styles.heroSub}>Monetization Approved</Text>

            <TouchableOpacity style={styles.withdrawBtn} activeOpacity={0.85} onPress={comingSoon}>
              <Ionicons name="cash-outline" size={15} color={Colors.primary} />
              <Text style={styles.withdrawBtnText}>Request Withdrawal</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Channel Analytics</Text>

            {/* Long Videos Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <View style={[styles.iconBadge, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="videocam" size={20} color="#1E88E5" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.metricTitle}>Long Videos</Text>
                  <Text style={styles.metricSub}>
                    Views: {formatViews(performanceStats.longViews)}  •  Likes: {performanceStats.longLikes}  •  Comments: {performanceStats.longComments}
                  </Text>
                </View>
                <Text style={styles.metricCount}>{performanceStats.longCount}</Text>
              </View>
            </View>

            {/* Shorts Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <View style={[styles.iconBadge, { backgroundColor: '#FBE9E7' }]}>
                  <Ionicons name="play-circle" size={20} color="#D84315" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.metricTitle}>Shorts (Reels)</Text>
                  <Text style={styles.metricSub}>
                    Views: {formatViews(performanceStats.shortViews)}  •  Likes: {performanceStats.shortLikes}  •  Comments: {performanceStats.shortComments}
                  </Text>
                </View>
                <Text style={styles.metricCount}>{performanceStats.shortCount}</Text>
              </View>
            </View>

            {/* Posts Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <View style={[styles.iconBadge, { backgroundColor: '#EDE7F6' }]}>
                  <Ionicons name="chatbubbles" size={20} color="#5E35B1" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.metricTitle}>Community Posts</Text>
                  <Text style={styles.metricSub}>
                    Likes: {performanceStats.postLikes}  •  Comments: {performanceStats.postComments}
                  </Text>
                </View>
                <Text style={styles.metricCount}>{performanceStats.postCount}</Text>
              </View>
            </View>
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

            {/* Video status items */}
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
                        {rev.video?.createdAt ? new Date(rev.video.createdAt).toLocaleDateString() : ''}
                      </Text>
                    </View>
                    <View style={[styles.reviewBadge, { backgroundColor: getStatusBadgeColor(rev.status) }]}>
                      <Text style={[styles.reviewBadgeText, { color: getStatusTextColor(rev.status) }]}>
                        {rev.status === 'passed' ? 'Passed' : rev.status === 'failed' ? 'Failed' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {(() => {
              const reviews = monetizationData?.reviews || [];
              const passedCount = reviews.filter((r: any) => r.status === 'passed').length;
              const pendingCount = reviews.filter((r: any) => r.status === 'pending').length;
              const activeCount = passedCount + pendingCount;

              if (passedCount >= 3) {
                return (
                  <View style={styles.completedBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginTop: 1.5 }} />
                    <Text style={styles.completedText}>Milestone complete! 3 of your original videos have passed review.</Text>
                  </View>
                );
              }

              if (activeCount >= 3) {
                return (
                  <View style={styles.reviewingBox}>
                    <Ionicons name="time" size={18} color="#F57F17" style={{ marginTop: 1.5 }} />
                    <Text style={styles.reviewingText}>Reviewing... Your videos are currently being audited by Bideo Administrators.</Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push('/(tabs)/upload')}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Upload Original Video ({activeCount}/3)</Text>
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Divider Line */}
          <View style={[styles.stepperLine, monetizationData?.step1Completed && styles.stepperLineDone]} />

          {/* Step 2 Card */}
          <View style={[styles.stepCard, !monetizationData?.step1Completed && styles.cardDisabled]}>
            {/* Lock Overlay if Step 1 is not complete */}
            {!monetizationData?.step1Completed && (
              <View style={styles.lockOverlay}>
                <Ionicons name="lock-closed" size={32} color="#999" />
                <Text style={styles.lockText}>Complete Step 1 to Unlock Form</Text>
              </View>
            )}

            <View style={styles.stepHeader}>
              <View style={[
                styles.stepNumCircle,
                monetizationData?.application?.status === 'approved' && styles.stepNumCircleDone,
                monetizationData?.application?.status === 'pending' && styles.stepNumCirclePending
              ]}>
                {monetizationData?.application?.status === 'approved' ? (
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                ) : (
                  <Text style={styles.stepNumText}>2</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.stepTitle}>Step 2: Submit Verification Form</Text>
                <Text style={styles.stepStatusText}>
                  {monetizationData?.application ? (
                    monetizationData.application.status === 'pending' ? 'Under Review' :
                      monetizationData.application.status === 'rejected' ? 'Action Required' : 'Approved'
                  ) : 'Not Submitted'}
                </Text>
              </View>
            </View>

            <Text style={styles.stepDescription}>
              Fill in your bank account details, UPI ID, and identity verification details. Our administrators will verify them manually.
            </Text>

            {/* Application Feedback Box */}
            {monetizationData?.application && (
              <View style={[
                styles.alertBox,
                monetizationData.application.status === 'pending' ? styles.alertBoxPending : styles.alertBoxRejected
              ]}>
                <Ionicons
                  name={monetizationData.application.status === 'pending' ? "time-outline" : "alert-circle-outline"}
                  size={20}
                  color={monetizationData.application.status === 'pending' ? "#C5A000" : "#C62828"}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[
                    styles.alertTitle,
                    { color: monetizationData.application.status === 'pending' ? "#856404" : "#721C24" }
                  ]}>
                    {monetizationData.application.status === 'pending' ? 'Verification In Progress' : 'Verification Failed'}
                  </Text>
                  <Text style={[
                    styles.alertText,
                    { color: monetizationData.application.status === 'pending' ? "#856404" : "#721C24" }
                  ]}>
                    {monetizationData.application.status === 'pending'
                      ? 'Admin is auditing your payment credentials. This process normally takes up to 48 hours.'
                      : `Reason: ${monetizationData.application.reviewMessage || 'Details provided are invalid. Check IFSC and Aadhaar.'}`
                    }
                  </Text>
                </View>
              </View>
            )}

            {/* Verification Form Inputs */}
            {(!monetizationData?.application || monetizationData.application.status === 'rejected') ? (
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Full Name (As in Bank Account / Aadhaar)</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Rahul Sharma"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <Text style={styles.inputLabel}>Contact Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <Text style={styles.inputLabel}>Aadhaar Card Number</Text>
                <TextInput
                  value={adharNumber}
                  onChangeText={setAdharNumber}
                  placeholder="12-digit Aadhaar UID"
                  keyboardType="numeric"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <Text style={styles.inputLabel}>UPI ID (Google Pay, PhonePe, etc.)</Text>
                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="e.g. name@okhdfcbank"
                  autoCapitalize="none"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <View style={styles.formSectionDivider}>
                  <Text style={styles.formSectionTitle}>Bank Settlement Details</Text>
                </View>

                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. State Bank of India"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Account number"
                  keyboardType="numeric"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  value={ifscCode}
                  onChangeText={setIfscCode}
                  placeholder="e.g. SBIN0001234"
                  autoCapitalize="characters"
                  style={styles.input}
                  placeholderTextColor="#B0B0B0"
                />

                {submitting ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 15 }} />
                ) : (
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleApply}
                  >
                    <Text style={styles.submitBtnText}>Submit Verification Details</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Read-only Details when pending or approved
              <View style={styles.readonlyDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Beneficiary Name</Text>
                  <Text style={styles.detailValue}>{name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Aadhaar UID</Text>
                  <Text style={styles.detailValue}>XXXX XXXX {adharNumber.slice(-4)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>UPI ID</Text>
                  <Text style={styles.detailValue}>{upiId}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  scrollContent: {
    padding: 15,
  },
  hero: {
    margin: 10,
    borderRadius: 16,
    padding: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  badge: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  heroAmount: { color: Colors.white, fontSize: 30, fontWeight: '800', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 1 },
  withdrawBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  withdrawBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
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
  statsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textGray,
    fontWeight: '500',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
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
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  alertBoxPending: {
    backgroundColor: '#FFFDE7',
    borderWidth: 1,
    borderColor: '#FFF59D',
  },
  alertBoxRejected: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
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
  completedBox: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    gap: 8,
  },
  completedText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 16,
    fontWeight: '600',
  },
  metricCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
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
});

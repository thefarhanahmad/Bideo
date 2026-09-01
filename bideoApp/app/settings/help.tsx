import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'How do I upload a video?',
      answer: 'Go to the Upload tab (center icon) and select your video. You can add a title, description, and thumbnail before publishing.'
    },
    {
      question: 'What are the video requirements?',
      answer: 'We support most common video formats. Shorts should be in 9:16 aspect ratio, while regular videos are best in 16:9.'
    },
    {
      question: 'How do I create a channel?',
      answer: 'Go to your Library, then click on "Edit Channel" or "Create Channel" to set up your channel name and avatar.'
    },
    {
      question: 'How can I contact support?',
      answer: 'You can email us at bideoapps@gmail.com or DM us on Instagram @bideo.app for any technical issues or assistance.'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBanner}>
           <Text style={styles.bannerTitle}>How can we help you?</Text>
           <View style={styles.iconRow}>
              <View style={styles.bannerIcon}><Ionicons name="videocam" size={24} color={Colors.white}/></View>
              <View style={styles.bannerIcon}><Ionicons name="chatbubbles" size={24} color={Colors.white}/></View>
              <View style={styles.bannerIcon}><Ionicons name="shield-checkmark" size={24} color={Colors.white}/></View>
           </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqCard}>
            {faqs.map((faq, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.faqItem, index === faqs.length - 1 && styles.noBorder]}
                onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons 
                    name={expandedIndex === index ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={expandedIndex === index ? Colors.primary : Colors.textGray} 
                  />
                </View>
                {expandedIndex === index && (
                  <View style={styles.answerContainer}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactListCard}>
            {/* Email Support Row */}
            <TouchableOpacity 
              style={styles.contactRow} 
              onPress={() => Linking.openURL('mailto:bideoapps@gmail.com')}
              activeOpacity={0.7}
            >
              <View style={[styles.contactRowIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="mail" size={22} color="#16A34A" />
              </View>
              <View style={styles.contactRowContent}>
                <Text style={styles.contactRowLabel}>Email Support</Text>
                <Text style={styles.contactRowValue}>bideoapps@gmail.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

            {/* Instagram Row */}
            <TouchableOpacity 
              style={styles.contactRow} 
              onPress={() => Linking.openURL('https://www.instagram.com/bideo.app/')}
              activeOpacity={0.7}
            >
              <View style={[styles.contactRowIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="logo-instagram" size={22} color="#E1306C" />
              </View>
              <View style={styles.contactRowContent}>
                <Text style={styles.contactRowLabel}>Instagram</Text>
                <Text style={styles.contactRowValue}>@bideo.app</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

            {/* Website Row */}
            <TouchableOpacity 
              style={[styles.contactRow, styles.noBorder]} 
              onPress={() => Linking.openURL('https://bideo.in')}
              activeOpacity={0.7}
            >
              <View style={[styles.contactRowIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="globe" size={22} color="#0284C7" />
              </View>
              <View style={styles.contactRowContent}>
                <Text style={styles.contactRowLabel}>Website</Text>
                <Text style={styles.contactRowValue}>bideo.in</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Ionicons name="time-outline" size={20} color={Colors.textGray} />
          <Text style={styles.footerText}>Response time: 24-48 hours</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  searchBanner: {
    backgroundColor: Colors.primary,
    paddingVertical: 30,
    paddingHorizontal: 15,
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 25,
    textAlign: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 20,
  },
  bannerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 15,
    marginLeft: 5,
  },
  faqCard: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  faqItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 15,
  },
  answerContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F8F9FA',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  contactListCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactRowContent: {
    flex: 1,
  },
  contactRowLabel: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contactRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 35,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  footerText: {
    color: Colors.textGray,
    fontSize: 14,
    fontWeight: '600',
  },
});

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
      answer: 'You can email us at support@bideo.com for any technical issues or inquiries.'
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
          <View style={styles.contactContainer}>
            <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('mailto:support@bideo.com')}>
              <View style={[styles.contactIcon, {backgroundColor: '#E8F5E9'}]}>
                <Ionicons name="mail" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>support@bideo.com</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('https://bideo.com')}>
              <View style={[styles.contactIcon, {backgroundColor: '#E3F2FD'}]}>
                <Ionicons name="globe" size={24} color="#2196F3" />
              </View>
              <Text style={styles.contactLabel}>Our Website</Text>
              <Text style={styles.contactValue}>www.bideo.com</Text>
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
    paddingBottom: 15,
    paddingHorizontal: 20,
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
    marginLeft: 15,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  searchBanner: {
    backgroundColor: Colors.primary,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    paddingHorizontal: 20,
    paddingTop: 30,
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
    borderRadius: 20,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  faqItem: {
    paddingVertical: 20,
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
  contactContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  contactCard: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 50,
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

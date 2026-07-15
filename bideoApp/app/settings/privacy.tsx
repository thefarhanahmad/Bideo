import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

export default function PrivacyScreen() {
  const router = useRouter();

  const sections = [
    {
      title: '1. Information we collect',
      content: 'We may collect account information such as name, phone number, email, profile details, uploaded content, comments, likes, follows, reports, device information, app activity, and approximate usage data needed to operate and protect Bideo.'
    },
    {
      title: '2. How we use information',
      content: 'We use information to provide the service, personalize feeds, process uploads, support accounts, improve performance, detect abuse, enforce policies, respond to reports, and comply with legal obligations.'
    },
    {
      title: '3. Media and service providers',
      content: 'Uploaded videos and images may be stored and delivered through service providers such as cloud hosting, media delivery, analytics, security, and infrastructure partners. These providers process information only as needed to support Bideo.'
    },
    {
      title: '4. Advertising and analytics',
      content: 'If ads or analytics are enabled, Bideo and its partners may process limited device, usage, and interaction data to measure performance, prevent fraud, and support advertiser-friendly experiences. We do not sell personal information.'
    },
    {
      title: '5. User-generated content',
      content: 'Content you upload, profile details, comments, and public interactions may be visible to other users depending on your settings and platform features. Do not upload private information you do not want others to see.'
    },
    {
      title: '6. Your choices',
      content: 'You may update your profile, delete your content where available, and request account deletion. Some information may be retained when required for security, fraud prevention, legal compliance, dispute handling, or policy enforcement.'
    },
    {
      title: '7. Contact',
      content: 'For privacy questions, contact bideoapps@gmail.com.'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
           <Ionicons name="shield-checkmark" size={50} color={Colors.primary} />
           <Text style={styles.cardTitle}>Privacy Policy</Text>
           <Text style={styles.lastUpdated}>Last updated: July 4, 2026</Text>
        </View>
        
        {sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for using Bideo!</Text>
          <View style={styles.dotRow}>
             <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
          </View>
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
    paddingHorizontal: 15,
  },
  topCard: {
    backgroundColor: Colors.white,
    marginTop: 15,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 15,
  },
  lastUpdated: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 5,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    textAlign: 'justify',
  },
  footer: {
    paddingVertical: 35,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textGray,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  }
});

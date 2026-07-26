import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

export default function TermsScreen() {
  const router = useRouter();

  const sections = [
    {
      title: '1. Acceptance of terms',
      content: 'By accessing or using Bideo, you agree to these Terms and Conditions and any policies referenced here, including our Community Guidelines, Privacy Policy, and Copyright Policy. If you do not agree, do not use Bideo.'
    },
    {
      title: '2. Accounts and eligibility',
      content: 'You are responsible for your account and all activity under it. You must provide accurate information and keep your login credentials secure. Users must meet the minimum age required by applicable law to create an account.'
    },
    {
      title: '3. User content',
      content: 'You retain ownership of content you upload. By uploading content, you grant Bideo a worldwide, non-exclusive, royalty-free license to host, store, process, display, distribute, and promote that content for the purpose of operating and improving the service.\n\nYou are solely responsible for your content and must have all rights, permissions, and licenses needed to upload it.'
    },
    {
      title: '4. Prohibited content and conduct',
      content: 'You may not upload or share content involving nudity or sexual content, graphic violence, hate speech, harassment, threats, scams, spam, impersonation, illegal activity, child safety violations, or copyrighted material you do not have permission to use.'
    },
    {
      title: '5. Moderation and enforcement',
      content: 'We may review, restrict, remove, or reduce distribution of content that violates our policies or creates legal, safety, or advertiser-suitability risk. Repeat or severe violations may result in account suspension or termination.'
    },
    {
      title: '6. Monetization',
      content: 'Bideo does not guarantee income, rewards, payouts, views, followers, or audience growth. Creator monetization features are planned for eligible creators in the future and may depend on eligibility, location, policy compliance, advertiser suitability, review status, and separate program terms.'
    },
    {
      title: '7. Service changes',
      content: 'We may update, suspend, limit, or discontinue features at any time. We may also update these Terms. Continued use of Bideo after updates means you accept the revised terms.'
    },
    {
      title: '8. Contact',
      content: 'Questions about these terms can be sent to bideoApps@gmail.com.'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
           <Ionicons name="document-text" size={50} color={Colors.primary} />
           <Text style={styles.cardTitle}>Terms of Service</Text>
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

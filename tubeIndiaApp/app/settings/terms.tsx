import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

export default function TermsScreen() {
  const router = useRouter();

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: 'By accessing and using TubeIndia, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.'
    },
    {
      title: '2. User Content',
      content: 'You retain ownership of the content you upload to TubeIndia. However, by uploading content, you grant TubeIndia a worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute your content.'
    },
    {
      title: '3. Prohibited Conduct',
      content: 'Users are prohibited from uploading content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.'
    },
    {
      title: '4. Privacy Policy',
      content: 'Your privacy is important to us. Please refer to our Privacy Policy to understand how we collect, use, and protect your personal information.'
    },
    {
      title: '5. Termination',
      content: 'TubeIndia reserves the right to terminate or suspend your account at any time, without prior notice, for conduct that we believe violates these Terms or is harmful to other users.'
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
           <Text style={styles.lastUpdated}>Last updated: June 2026</Text>
        </View>
        
        {sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for using TubeIndia!</Text>
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
    paddingHorizontal: 20,
  },
  topCard: {
    backgroundColor: Colors.white,
    marginTop: 20,
    padding: 30,
    borderRadius: 25,
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
    marginTop: 20,
    padding: 20,
    borderRadius: 15,
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
    paddingVertical: 50,
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

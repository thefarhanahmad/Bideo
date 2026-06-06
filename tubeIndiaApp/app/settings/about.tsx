import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

const { width } = Dimensions.get('window');

export default function AboutScreen() {
  const router = useRouter();

  const features = [
    { title: 'High Quality', desc: 'Seamless 4K video streaming.', icon: 'videocam' },
    { title: 'Community', desc: 'Interact via posts & comments.', icon: 'people' },
    { title: 'Shorts', desc: 'Quick vertical entertainment.', icon: 'flash' },
    { title: 'Playlists', desc: 'Organize your favorite content.', icon: 'list' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About TubeIndia</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
           <View style={styles.logoWrapper}>
              <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
           </View>
           <Text style={styles.appName}>TubeIndia</Text>
           <Text style={styles.appTagline}>Connecting Creators across India</Text>
           <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v1.0.0</Text>
           </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.description}>
            TubeIndia is a community-driven video sharing platform designed for the Indian audience. 
            We aim to provide a platform where creators can share their passion, knowledge, and entertainment with the world.
          </Text>
          <Text style={styles.description}>
            Our mission is to empower local creators and provide high-quality content that resonates with our diverse culture.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featureGrid}>
            {features.map((item, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                   <Ionicons name={item.icon as any} size={24} color={Colors.primary} />
                </View>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.divider} />
          <Text style={styles.footerText}>© 2026 TubeIndia Platform</Text>
          <Text style={styles.footerSubText}>Made with ❤️ in India</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  appTagline: {
    fontSize: 16,
    color: Colors.textGray,
    marginTop: 5,
  },
  versionBadge: {
    marginTop: 15,
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textGray,
  },
  card: {
    backgroundColor: Colors.white,
    margin: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 15,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 12,
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 55) / 2,
    backgroundColor: Colors.white,
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    padding: 40,
    alignItems: 'center',
  },
  divider: {
    width: 50,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 15,
  },
  footerText: {
    color: Colors.textGray,
    fontSize: 14,
    fontWeight: '600',
  },
  footerSubText: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 4,
  },
});

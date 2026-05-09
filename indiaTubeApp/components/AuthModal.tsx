import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onLoginSuccess }) => {
  const handleGoogleLogin = async () => {
    // This will be implemented with expo-auth-session
    console.log('Google Login Triggered');
    // For now, simulating success
    onLoginSuccess();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="person-circle-outline" size={80} color={Colors.primary} />
            <Text style={styles.title}>Sign in to IndiaTube</Text>
            <Text style={styles.subtitle}>
              Like videos, comment, and subscribe to stay updated with your favorite creators.
            </Text>
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={24} color={Colors.white} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            By continuing, you agree to IndiaTube's Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  googleButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
  },
});

export default AuthModal;

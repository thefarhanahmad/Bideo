import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";

WebBrowser.maybeCompleteAuthSession();

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: (user?: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onClose,
  onLoginSuccess,
}) => {
  const [request, response, promptAsync] =
    Google.useAuthRequest({
      expoClientId:
        "117338106850-h4j0vc8vsc5tlubqcgvmc202qtto4fl6.apps.googleusercontent.com",
    });

  useEffect(() => {
    if (response?.type === "success") {
      const { accessToken } =
        response.authentication || {};

      if (accessToken) {
        getUserInfo(accessToken);
      }
    }
  }, [response]);

  const getUserInfo = async (
    accessToken: string
  ) => {
    try {
      const res = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const user = await res.json();

      console.log("Google User:", user);

      Alert.alert(
        "Login Success",
        `Welcome ${user.name}`
      );

      onLoginSuccess(user);

      onClose();
    } catch (err) {
      console.log(err);

      Alert.alert(
        "Login Failed",
        "Could not fetch user info"
      );
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await promptAsync();
    } catch (err) {
      console.log(err);

      Alert.alert(
        "Login Error",
        "Something went wrong"
      );
    }
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
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={24}
              color={Colors.text}
            />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons
              name="person-circle-outline"
              size={80}
              color={Colors.primary}
            />

            <Text style={styles.title}>
              Sign in to IndiaTube
            </Text>

            <Text style={styles.subtitle}>
              Like videos, comment, and
              subscribe to stay updated with
              your favorite creators.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={!request}
          >
            <Ionicons
              name="logo-google"
              size={22}
              color={Colors.white}
            />

            <Text style={styles.googleButtonText}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            By continuing, you agree to
            IndiaTube's Terms of Service and
            Privacy Policy.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: "center",
  },

  closeButton: {
    alignSelf: "flex-end",
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 14,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  googleButton: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    width: "100%",
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  googleButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 10,
  },

  footerText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default AuthModal;
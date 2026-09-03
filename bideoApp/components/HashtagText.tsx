import React from 'react';
import { Text, TextStyle, StyleProp, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';

interface HashtagTextProps {
  text?: string;
  style?: StyleProp<TextStyle>;
  hashtagStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onHashtagPress?: (tag: string) => void;
  onLinkPress?: (url: string) => void;
}

/**
 * Parses and renders text with YouTube-style clickable blue hashtags and clickable web links.
 * When a hashtag is tapped, redirects to the Search page filtering videos by the clicked hashtag.
 * When a link is tapped, opens the URL in the system browser or registered deep link.
 */
export const HashtagText: React.FC<HashtagTextProps> = ({
  text = '',
  style,
  hashtagStyle,
  linkStyle,
  numberOfLines,
  onHashtagPress,
  onLinkPress,
}) => {
  const router = useRouter();

  if (!text) {
    return null;
  }

  const handleTagClick = (tag: string) => {
    if (onHashtagPress) {
      onHashtagPress(tag);
    } else {
      router.push({ pathname: '/search', params: { q: tag } });
    }
  };

  const handleUrlPress = async (rawUrl: string) => {
    if (onLinkPress) {
      onLinkPress(rawUrl);
      return;
    }
    try {
      let target = rawUrl.trim();
      if (!/^https?:\/\//i.test(target)) {
        target = `https://${target}`;
      }
      const supported = await Linking.canOpenURL(target);
      if (supported) {
        await Linking.openURL(target);
      } else {
        await Linking.openURL(target);
      }
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  };

  // Match URLs (http://, https://, www.) and hashtags (e.g. #trending)
  const regex = /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+|#[a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F]+)/gi;
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check if hashtag
        if (part.startsWith('#') && part.length > 1) {
          return (
            <Text
              key={`tag-${part}-${index}`}
              style={[styles.hashtag, hashtagStyle]}
              onPress={() => handleTagClick(part)}
              suppressHighlighting={false}
            >
              {part}
            </Text>
          );
        }

        // Check if URL
        if (/^(https?:\/\/|www\.)/i.test(part)) {
          // Separate any trailing punctuation so .,!?) isn't included in the clickable link
          let url = part;
          let trailing = '';
          const punctMatch = url.match(/[.,;:!?\)\>\]\}]+$/);
          if (punctMatch) {
            trailing = punctMatch[0];
            url = url.slice(0, -trailing.length);
          }

          return (
            <React.Fragment key={`url-${index}`}>
              <Text
                style={[styles.link, linkStyle]}
                onPress={() => handleUrlPress(url)}
                suppressHighlighting={false}
              >
                {url}
              </Text>
              {trailing ? <Text>{trailing}</Text> : null}
            </React.Fragment>
          );
        }

        return <Text key={`txt-${index}`}>{part}</Text>;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  hashtag: {
    color: '#2563EB', // YouTube-style clickable blue
    fontWeight: '600',
  },
  link: {
    color: '#065FD4', // Clickable blue link color
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});

export default HashtagText;

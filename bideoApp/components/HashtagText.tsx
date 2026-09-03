import React from 'react';
import { Text, TextStyle, StyleProp, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';

interface HashtagTextProps {
  text?: string;
  style?: StyleProp<TextStyle>;
  hashtagStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onHashtagPress?: (tag: string) => void;
  onLinkPress?: (url: string) => void;
  onMentionPress?: (mention: string) => void;
}

/**
 * Parses and renders text with:
 * - YouTube-style clickable blue hashtags (#tag)
 * - Clickable blue web links (https://..., http://..., www....)
 * - Clickable blue user mentions (@username)
 *
 * Tapping a mention redirects directly to that user's channel profile detail.
 */
export const HashtagText: React.FC<HashtagTextProps> = ({
  text = '',
  style,
  hashtagStyle,
  linkStyle,
  mentionStyle,
  numberOfLines,
  onHashtagPress,
  onLinkPress,
  onMentionPress,
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

  const handleMentionClick = (handleOrName: string) => {
    if (onMentionPress) {
      onMentionPress(handleOrName);
    } else {
      router.push(`/channel/${handleOrName}`);
    }
  };

  // Match URLs, hashtags (#tag), and mentions (@username)
  const regex = /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+|#[a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F]+|@[a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]+)/gi;
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

        // Check if mention (@username)
        if (part.startsWith('@') && part.length > 1) {
          let mention = part;
          let trailing = '';
          const punctMatch = mention.match(/[.,;:!?\)\>\]\}]+$/);
          if (punctMatch) {
            trailing = punctMatch[0];
            mention = mention.slice(0, -trailing.length);
          }
          const cleanName = mention.slice(1);

          return (
            <React.Fragment key={`mention-${index}`}>
              <Text
                style={[styles.mention, mentionStyle]}
                onPress={() => handleMentionClick(cleanName)}
                suppressHighlighting={false}
              >
                {mention}
              </Text>
              {trailing ? <Text>{trailing}</Text> : null}
            </React.Fragment>
          );
        }

        // Check if URL
        if (/^(https?:\/\/|www\.)/i.test(part)) {
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
  mention: {
    color: '#065FD4', // Clickable blue mention color
    fontWeight: '600',
  },
});

export default HashtagText;

import React from 'react';
import { Text, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface HashtagTextProps {
  text?: string;
  style?: StyleProp<TextStyle>;
  hashtagStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onHashtagPress?: (tag: string) => void;
}

/**
 * Parses and renders text with YouTube-style clickable blue hashtags.
 * When tapped, redirects to the Search page filtering videos by the clicked hashtag.
 */
export const HashtagText: React.FC<HashtagTextProps> = ({
  text = '',
  style,
  hashtagStyle,
  numberOfLines,
  onHashtagPress,
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

  // Match hashtags (e.g. #trending, #vlog, #music_2026, #bideo)
  const regex = /(#[a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F]+)/g;
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (part && part.startsWith('#') && part.length > 1) {
          return (
            <Text
              key={`${part}-${index}`}
              style={[styles.hashtag, hashtagStyle]}
              onPress={() => handleTagClick(part)}
              suppressHighlighting={false}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  hashtag: {
    color: '#2563EB', // YouTube-style clickable blue
    fontWeight: '600',
  },
});

export default HashtagText;

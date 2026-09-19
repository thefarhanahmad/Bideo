import { Share, Platform } from 'react-native';

const BASE_WEB_URL = 'https://bideo.in';

export interface ShareVideoParams {
  _id: string;
  title?: string;
  isShort?: boolean;
}

export interface ShareChannelParams {
  _id: string;
  name?: string;
  channelName?: string;
}

export interface SharePostParams {
  _id: string;
  text?: string;
  authorName?: string;
}

/**
 * Shares a video or short with optimal formatting for WhatsApp, Telegram, and social apps.
 * Putting the URL first on Android guarantees that WhatsApp's URL detector immediately triggers
 * the rich thumbnail & title preview generator without delay or drops.
 */
export const shareVideo = async ({ _id, title = '', isShort = false }: ShareVideoParams) => {
  if (!_id) return;
  try {
    const shareUrl = `${BASE_WEB_URL}/v/${_id}`;
    const cleanTitle = (title || '').trim();
    const contentType = isShort ? 'Short' : 'Video';

    // On Android, WhatsApp parses the first URL it sees in Intent.EXTRA_TEXT to generate the preview card.
    // Placing the clean URL on the first line guarantees instant rich preview card generation.
    const message =
      Platform.OS === 'android'
        ? cleanTitle
          ? `${shareUrl}\n\nWatch "${cleanTitle}" on Bideo`
          : `${shareUrl}\n\nWatch this ${contentType} on Bideo`
        : cleanTitle
        ? `Watch "${cleanTitle}" on Bideo`
        : `Watch this ${contentType} on Bideo`;

    await Share.share(
      Platform.OS === 'android'
        ? {
            message,
            title: cleanTitle || `Watch on Bideo`,
          }
        : {
            url: shareUrl,
            message,
            title: cleanTitle || `Watch on Bideo`,
          },
      {
        dialogTitle: cleanTitle ? `Share "${cleanTitle}"` : `Share ${contentType}`,
      }
    );
  } catch (err: any) {
    if (err?.message !== 'User did not share') {
      console.warn('[shareVideo] Share dismissed or failed:', err?.message || err);
    }
  }
};

/**
 * Shares a creator channel profile with guaranteed rich preview.
 */
export const shareChannel = async ({ _id, name = '', channelName = '' }: ShareChannelParams) => {
  if (!_id) return;
  try {
    const shareUrl = `${BASE_WEB_URL}/c/${_id}`;
    const displayName = (channelName || name || 'Creator').trim();

    const message =
      Platform.OS === 'android'
        ? `${shareUrl}\n\nCheck out @${displayName} on Bideo!`
        : `Check out @${displayName} on Bideo!`;

    await Share.share(
      Platform.OS === 'android'
        ? {
            message,
            title: `@${displayName} on Bideo`,
          }
        : {
            url: shareUrl,
            message,
            title: `@${displayName} on Bideo`,
          },
      {
        dialogTitle: `Share @${displayName}'s Channel`,
      }
    );
  } catch (err: any) {
    if (err?.message !== 'User did not share') {
      console.warn('[shareChannel] Share dismissed or failed:', err?.message || err);
    }
  }
};

/**
 * Shares a community post with guaranteed rich preview.
 */
export const sharePost = async ({ _id, text = '', authorName = '' }: SharePostParams) => {
  if (!_id) return;
  try {
    const shareUrl = `${BASE_WEB_URL}/p/${_id}`;
    const cleanText = (text || '').trim();
    const snippet = cleanText
      ? cleanText.length > 80
        ? `${cleanText.slice(0, 80)}...`
        : cleanText
      : '';
    const creator = authorName ? ` by ${authorName}` : '';

    const message =
      Platform.OS === 'android'
        ? snippet
          ? `${shareUrl}\n\n"${snippet}" - Post${creator} on Bideo`
          : `${shareUrl}\n\nCheck out this post${creator} on Bideo`
        : snippet
        ? `"${snippet}" - Post${creator} on Bideo`
        : `Check out this post${creator} on Bideo`;

    await Share.share(
      Platform.OS === 'android'
        ? {
            message,
            title: `Post on Bideo`,
          }
        : {
            url: shareUrl,
            message,
            title: `Post on Bideo`,
          },
      {
        dialogTitle: `Share Post on Bideo`,
      }
    );
  } catch (err: any) {
    if (err?.message !== 'User did not share') {
      console.warn('[sharePost] Share dismissed or failed:', err?.message || err);
    }
  }
};

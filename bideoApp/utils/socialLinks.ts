// Channel social links: creators often type a username ("john_123", "@mychannel") instead of a
// full link. These helpers turn either form into a URL that opens the right profile.

export const MAX_SOCIAL_LINKS = 10;

const PROFILE_URL: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://instagram.com/${h}`,
  facebook: (h) => `https://facebook.com/${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
  twitter: (h) => `https://x.com/${h}`,
};

const HOST_PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$|(^|\.)instagr\.am$/i, 'instagram'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/i, 'facebook'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, 'youtube'],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/i, 'twitter'],
];

/** Platform implied by a pasted link's domain (e.g. a youtube.com link → 'youtube'), or null. */
export const detectSocialPlatform = (raw: string | undefined): string | null => {
  const value = (raw || '').trim();
  const match = value.match(/^(?:https?:\/\/)?([^/\s?#]+)/i);
  if (!match || !match[1].includes('.')) return null;
  const host = match[1].replace(/^www\./i, '').replace(/^m\./i, '');
  const found = HOST_PLATFORMS.find(([re]) => re.test(host));
  return found ? found[1] : null;
};

const HANDLE = /^[A-Za-z0-9._-]+$/;
const LOOKS_LIKE_DOMAIN = /^[^\s/]+\.[A-Za-z]{2,}(\/|$)/;

/**
 * Returns an openable https URL for a saved/typed social link, or null when it can't be one
 * (e.g. text with spaces, or a website entry that is not a domain).
 */
export const toSocialUrl = (platform: string | undefined, raw: string | undefined): string | null => {
  const value = (raw || '').trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    const compact = value.replace(/\s+/g, '');
    return compact.length > 'https://'.length ? compact : null;
  }

  const build = PROFILE_URL[(platform || '').toLowerCase()];
  // For social platforms a bare "john.doe" is a username; it is a link only with a path or a known social domain
  const isLink =
    /^www\./i.test(value) ||
    (LOOKS_LIKE_DOMAIN.test(value) && (!build || value.includes('/') || detectSocialPlatform(value) !== null));
  if (isLink) {
    return /\s/.test(value) ? null : `https://${value}`;
  }

  const handle = value.replace(/^@+/, '');
  if (!build || !HANDLE.test(handle)) return null;
  return build(handle);
};

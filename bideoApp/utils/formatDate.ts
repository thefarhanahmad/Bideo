export const formatViews = (views: number | string | undefined | null): string => {
  const num = Number(views);
  if (isNaN(num) || num <= 0) return '0';

  if (num < 1000) {
    return String(Math.floor(num));
  }

  // 1,000 to 999,999 (including lakhs in k, e.g. 100k, 250k)
  if (num < 1000000) {
    const k = num / 1000;
    if (k < 10) {
      // e.g. 1012 -> 1.01k, 1200 -> 1.2k, 1000 -> 1k
      const rounded = Number(k.toFixed(2));
      return `${rounded}k`;
    }
    if (k < 100) {
      // e.g. 10.5k, 50k
      const rounded = Number(k.toFixed(1));
      return `${rounded}k`;
    }
    // 100k to 999k (e.g. 100k for 1 lakh)
    return `${Math.floor(k)}k`;
  }

  // 1,000,000 to 999,999,999 (Millions)
  if (num < 1000000000) {
    const m = num / 1000000;
    if (m < 10) {
      const rounded = Number(m.toFixed(1));
      return `${rounded}M`;
    }
    return `${Math.floor(m)}M`;
  }

  // 1,000,000,000+ (Billions)
  const b = num / 1000000000;
  const rounded = Number(b.toFixed(1));
  return `${rounded}B`;
};

export const formatTimeAgo = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

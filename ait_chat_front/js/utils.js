export function formatLastSeen(isoTimestamp) {
    if (!isoTimestamp) return '';
    const now = new Date();
    const lastSeenDate = new Date(isoTimestamp);
    const diffSeconds = Math.round((now - lastSeenDate) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);
  
    if (diffSeconds < 60) return 'Last seen just now';
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays === 1) return 'Last seen yesterday';
    // Optional: More specific date format for older dates
    return `Last seen ${lastSeenDate.toLocaleDateString()}`;
  }
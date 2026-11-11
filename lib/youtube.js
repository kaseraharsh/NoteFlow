const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Extracts YouTube Video ID from any URL format or raw ID
 */
function extractVideoId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;

  const trimmed = urlOrId.trim();

  // If already an 11-character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL regex patterns
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/video\/([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/clip\/[a-zA-Z0-9_-]+/i // clips handled differently if needed
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  // URL parsing fallback
  try {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname.includes('youtube.com')) {
      const v = urlObj.searchParams.get('v');
      if (v && v.length === 11) return v;
    }
  } catch (e) {
    // Not a valid URL
  }

  return null;
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
function formatTimestamp(seconds) {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Fetch video metadata via free YouTube oEmbed API
 */
async function fetchVideoMetadata(videoId) {
  const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = response.data;
    return {
      videoId,
      url: targetUrl,
      title: data.title || 'YouTube Video',
      author: data.author_name || 'YouTube Creator',
      authorUrl: data.author_url || '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      thumbnailHighUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    };
  } catch (error) {
    // Fallback if oEmbed fails
    return {
      videoId,
      url: targetUrl,
      title: `YouTube Video (${videoId})`,
      author: 'YouTube',
      authorUrl: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      thumbnailHighUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  }
}

/**
 * Fetch transcript items from YouTube
 */
async function fetchTranscript(videoId, preferredLang = null) {
  const attempts = [];
  if (preferredLang) attempts.push(preferredLang);
  attempts.push('en', 'hi', undefined); // Try requested, en, hi, then default

  let lastError = null;
  for (const lang of attempts) {
    try {
      const config = lang ? { lang } : undefined;
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (transcriptItems && transcriptItems.length > 0) {
        return processTranscriptItems(transcriptItems);
      }
    } catch (err) {
      lastError = err;
    }
  }

  // If all attempts failed, throw descriptive error
  const msg = lastError ? lastError.message : 'No transcript found';
  if (msg.includes('disabled') || msg.includes('Could not find') || msg.includes('Transcript is disabled')) {
    throw new Error('Is video ke subtitles/captions disable hain ya available nahi hain. Aap manual text paste option use kar sakte hain.');
  }
  throw new Error(`Transcript fetch nahi ho paya: ${msg}`);
}

/**
 * Process raw transcript items into structured sentences & paragraphs with timestamps
 */
function processTranscriptItems(items) {
  const processed = [];
  let fullTextParts = [];
  let currentGroup = {
    start: 0,
    timestamp: '00:00',
    text: ''
  };

  const groupDurationThreshold = 30; // group every ~30 seconds for readable study blocks

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const offsetSeconds = item.offset / 1000;
    const cleanText = item.text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) continue;

    fullTextParts.push(cleanText);

    if (!currentGroup.text) {
      currentGroup.start = offsetSeconds;
      currentGroup.timestamp = formatTimestamp(offsetSeconds);
      currentGroup.text = cleanText;
    } else {
      if (offsetSeconds - currentGroup.start > groupDurationThreshold || currentGroup.text.length > 300) {
        processed.push({ ...currentGroup });
        currentGroup = {
          start: offsetSeconds,
          timestamp: formatTimestamp(offsetSeconds),
          text: cleanText
        };
      } else {
        currentGroup.text += ' ' + cleanText;
      }
    }
  }

  if (currentGroup.text) {
    processed.push(currentGroup);
  }

  const fullText = fullTextParts.join(' ');
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const approxDurationSec = items.length > 0 ? (items[items.length - 1].offset + items[items.length - 1].duration) / 1000 : 0;

  return {
    items: processed,
    rawCount: items.length,
    fullText,
    wordCount,
    approxDuration: formatTimestamp(approxDurationSec),
    approxDurationSeconds: approxDurationSec
  };
}

module.exports = {
  extractVideoId,
  fetchVideoMetadata,
  fetchTranscript,
  formatTimestamp
};

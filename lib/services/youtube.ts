import { fetchTranscript } from '@egoist/youtube-transcript-plus';

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number; // in seconds
}

export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

// Language priority list for transcript fetching
const LANGUAGE_PRIORITY = [
  { code: 'zh', name: '中文' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁体中文' },
  { code: 'zh-CN', name: '中文(中国)' },
  { code: 'zh-TW', name: '中文(台湾)' },
  { code: 'en', name: '英文' },
  { code: 'en-US', name: '英文(美国)' },
  { code: 'en-GB', name: '英文(英国)' },
];

// Other common languages as fallback
const OTHER_LANGUAGES = [
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'es', name: '西班牙语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'ru', name: '俄语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'it', name: '意大利语' },
];

export class YouTubeService {
  static validateUrl(url: string): boolean {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return regex.test(url);
  }

  static extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Try to fetch transcript with a specific language
   */
  private static async tryFetchTranscript(videoId: string, lang: string): Promise<any> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetchTranscript(url, { lang });
      return response;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get transcript with multi-language fallback strategy
   */
  static async getTranscript(videoId: string): Promise<TranscriptItem[]> {
    let response = null;
    let usedLang = null;

    // 1. Try to fetch with priority languages (Chinese, English)
    console.log('Fetching transcript for video:', videoId);
    for (const lang of LANGUAGE_PRIORITY) {
      console.log(`Trying ${lang.name} (${lang.code})...`);
      response = await this.tryFetchTranscript(videoId, lang.code);
      if (response) {
        usedLang = lang;
        console.log(`✓ Successfully fetched ${lang.name} transcript!`);
        break;
      }
    }

    // 2. If priority languages are not available, try other common languages
    if (!response) {
      console.log('Priority languages (Chinese/English) not available, trying other languages...');
      for (const lang of OTHER_LANGUAGES) {
        console.log(`Trying ${lang.name} (${lang.code})...`);
        response = await this.tryFetchTranscript(videoId, lang.code);
        if (response) {
          usedLang = lang;
          console.log(`✓ Successfully fetched ${lang.name} transcript!`);
          break;
        }
      }
    }

    // 3. If still no transcript, throw error
    if (!response) {
      console.error('❌ Unable to fetch transcript in any language');
      throw new Error(
        'No captions found for this video. Possible reasons:\n' +
        '- The video has no captions\n' +
        '- The video ID is invalid\n' +
        '- Network connection issue'
      );
    }

    try {
      // Parse the response based on its structure
      // The library returns format: { title: string, segments: array }
      let transcriptArray: any[];
      if (response.segments && Array.isArray(response.segments)) {
        transcriptArray = response.segments;
        console.log('Video title:', response.title);
      } else if (response.transcript && Array.isArray(response.transcript)) {
        transcriptArray = response.transcript;
      } else if (Array.isArray(response)) {
        transcriptArray = response;
      } else {
        console.error('Unable to parse transcript data, unknown format');
        console.error('Response keys:', Object.keys(response));
        throw new Error('Unable to parse transcript data');
      }

      console.log(`Found ${transcriptArray.length} transcript items`);
      console.log(`Using language: ${usedLang?.name} (${usedLang?.code})`);

      // Convert to our TranscriptItem format and decode HTML entities
      return transcriptArray.map(item => {
        const text = this.decodeHtml(item.text || '');
        return {
          text,
          offset: item.offset || 0,
          duration: item.duration || 0,
        };
      }).filter(item => item.text.trim().length > 0);
    } catch (error) {
      console.error('Error processing transcript:', error);
      throw error;
    }
  }

  /**
   * Decode HTML entities in transcript text
   * Note: The library sometimes returns double-encoded entities like &amp;#39;
   * We need to decode them in the correct order
   */
  private static decodeHtml(html: string): string {
    // First pass: decode common HTML entities (including &amp; -> &)
    let decoded = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // Second pass: decode numeric HTML entities (&#39; -> ')
    // This handles cases where we had &amp;#39; which became &#39; after first pass
    decoded = decoded
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'");

    return decoded;
  }

  // Note: For full metadata (title, description, etc.), we might need the YouTube Data API or oEmbed.
  // For now, we'll use oEmbed as it doesn't require an API key for basic info.
  static async getVideoMetadata(videoId: string): Promise<VideoMetadata> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch video metadata');
      }
      const data = await response.json();

      return {
        id: videoId,
        title: data.title,
        description: '', // oEmbed doesn't provide full description
        thumbnailUrl: data.thumbnail_url,
        duration: 0, // oEmbed doesn't provide duration
      };
    } catch (error) {
      console.error('Error fetching metadata:', error);
      throw error;
    }
  }
}

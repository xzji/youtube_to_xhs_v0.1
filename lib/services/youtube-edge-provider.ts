/**
 * YouTube Transcript Provider - Edge Runtime Compatible
 * 
 * 纯 Web API 实现，完全兼容 Cloudflare Edge Runtime
 * 不依赖任何 Node.js 模块（fs, path 等）
 * 
 * 功能：
 * - 多语言字幕回退（中文优先 → 英文 → 其他语言）
 * - 内存缓存支持
 * - 完整的错误处理
 */

import type { TranscriptProvider, TranscriptItem, VideoMetadata } from './transcript-provider';

// 语言优先级配置
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

// 内存缓存
interface CacheEntry {
    data: TranscriptItem[];
    timestamp: number;
}

const transcriptCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

/**
 * YouTube Edge Runtime Provider
 */
export class YouTubeEdgeProvider implements TranscriptProvider {

    validateUrl(url: string): boolean {
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return regex.test(url);
    }

    extractVideoId(url: string): string | null {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    async getTranscript(videoId: string): Promise<TranscriptItem[]> {
        // 检查缓存
        const cached = this.getFromCache(videoId);
        if (cached) {
            console.log(`[YouTubeEdgeProvider] Using cached transcript for ${videoId}`);
            return cached;
        }

        console.log(`[YouTubeEdgeProvider] Fetching transcript for ${videoId}`);

        // 尝试多语言回退
        let transcript: TranscriptItem[] | null = null;
        let usedLang: { code: string; name: string } | null = null;

        // 1. 尝试优先语言
        for (const lang of LANGUAGE_PRIORITY) {
            console.log(`[YouTubeEdgeProvider] Trying ${lang.name} (${lang.code})...`);
            transcript = await this.tryFetchTranscript(videoId, lang.code);
            if (transcript) {
                usedLang = lang;
                console.log(`[YouTubeEdgeProvider] ✓ Successfully fetched ${lang.name} transcript`);
                break;
            }
        }

        // 2. 如果优先语言都没有，尝试其他语言
        if (!transcript) {
            console.log('[YouTubeEdgeProvider] Priority languages not available, trying others...');
            for (const lang of OTHER_LANGUAGES) {
                console.log(`[YouTubeEdgeProvider] Trying ${lang.name} (${lang.code})...`);
                transcript = await this.tryFetchTranscript(videoId, lang.code);
                if (transcript) {
                    usedLang = lang;
                    console.log(`[YouTubeEdgeProvider] ✓ Successfully fetched ${lang.name} transcript`);
                    break;
                }
            }
        }

        // 3. 如果还是没有，抛出错误
        if (!transcript) {
            console.error('[YouTubeEdgeProvider] ❌ Unable to fetch transcript in any language');
            throw new Error(
                'No captions found for this video. Possible reasons:\n' +
                '- The video has no captions\n' +
                '- The video ID is invalid\n' +
                '- Network connection issue'
            );
        }

        console.log(`[YouTubeEdgeProvider] Found ${transcript.length} transcript items using ${usedLang?.name}`);

        // 缓存结果
        this.saveToCache(videoId, transcript);

        return transcript;
    }

    async getMetadata(videoId: string): Promise<VideoMetadata> {
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
                description: '',
                thumbnailUrl: data.thumbnail_url,
                duration: 0,
            };
        } catch (error) {
            console.error('[YouTubeEdgeProvider] Error fetching metadata:', error);
            throw error;
        }
    }

    /**
     * 尝试获取指定语言的字幕
     */
    private async tryFetchTranscript(videoId: string, lang: string): Promise<TranscriptItem[] | null> {
        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            // 1. 获取视频页面
            const videoPageResponse = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept-Language': lang || 'en-US,en;q=0.9',
                },
            });

            if (!videoPageResponse.ok) {
                return null;
            }

            const html = await videoPageResponse.text();

            // 检查是否有 reCAPTCHA
            if (html.includes('class="g-recaptcha"')) {
                throw new Error('YouTube is receiving too many requests. Please try again later.');
            }

            // 2. 提取 API Key
            const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
                html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);

            if (!apiKeyMatch) {
                return null;
            }

            const apiKey = apiKeyMatch[1];

            // 3. 调用 Player API
            const playerEndpoint = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
            const playerBody = {
                context: {
                    client: {
                        clientName: 'ANDROID',
                        clientVersion: '20.10.38'
                    }
                },
                videoId: videoId
            };

            const playerRes = await fetch(playerEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    ...(lang ? { 'Accept-Language': lang } : {})
                },
                body: JSON.stringify(playerBody)
            });

            if (!playerRes.ok) {
                return null;
            }

            const playerJson = await playerRes.json();

            // 4. 获取字幕轨道
            const tracklist = playerJson?.captions?.playerCaptionsTracklistRenderer ??
                playerJson?.playerCaptionsTracklistRenderer;
            const tracks = tracklist?.captionTracks;

            if (!Array.isArray(tracks) || tracks.length === 0) {
                return null;
            }

            // 5. 查找指定语言的字幕
            const selectedTrack = lang
                ? tracks.find((t: any) => t.languageCode === lang)
                : tracks[0];

            if (!selectedTrack) {
                return null;
            }

            let transcriptURL = selectedTrack.baseUrl || selectedTrack.url;
            if (!transcriptURL) {
                return null;
            }

            // 移除 fmt 参数
            transcriptURL = transcriptURL.replace(/&fmt=[^&]+$/, '');

            // 6. 下载字幕 XML
            const transcriptResponse = await fetch(transcriptURL);

            if (!transcriptResponse.ok) {
                return null;
            }

            const transcriptXml = await transcriptResponse.text();

            // 7. 解析字幕
            return this.parseTranscriptXml(transcriptXml);

        } catch (error) {
            // 静默失败，返回 null 以便尝试下一个语言
            return null;
        }
    }

    /**
     * 解析字幕 XML
     */
    private parseTranscriptXml(xml: string): TranscriptItem[] {
        const regex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
        const segments: TranscriptItem[] = [];

        let match;
        while ((match = regex.exec(xml)) !== null) {
            const text = this.decodeHtmlEntities(match[3]);
            if (text.trim().length > 0) {
                segments.push({
                    offset: parseFloat(match[1]),
                    duration: parseFloat(match[2]),
                    text: text
                });
            }
        }

        return segments;
    }

    /**
     * 解码 HTML 实体
     */
    private decodeHtmlEntities(text: string): string {
        // 第一轮：解码常见 HTML 实体
        let decoded = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');

        // 第二轮：解码数字 HTML 实体（处理双重编码）
        decoded = decoded
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&apos;/g, "'");

        return decoded;
    }

    /**
     * 从缓存获取数据
     */
    private getFromCache(videoId: string): TranscriptItem[] | null {
        const entry = transcriptCache.get(videoId);
        if (!entry) {
            return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            transcriptCache.delete(videoId);
            return null;
        }

        return entry.data;
    }

    /**
     * 保存到缓存
     */
    private saveToCache(videoId: string, data: TranscriptItem[]): void {
        transcriptCache.set(videoId, {
            data,
            timestamp: Date.now()
        });
    }
}

// 导出单例实例（可选）
export const youtubeEdgeProvider = new YouTubeEdgeProvider();

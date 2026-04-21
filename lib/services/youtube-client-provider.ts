/**
 * YouTube Transcript Provider - Railway Backend Version
 * 
 * 通过 Railway 部署的 yt-dlp 服务获取 YouTube 字幕
 * 解决了 Cloudflare Edge Runtime 和前端 CORS 的限制
 */

import type { TranscriptProvider, TranscriptItem, VideoMetadata } from './transcript-provider';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

function normalizeSubtitleServiceUrl(rawUrl?: string): string {
    const trimmed = rawUrl?.trim();
    const fallbackUrl = 'https://youtubetoxhsv01-production.up.railway.app';

    if (!trimmed) {
        return fallbackUrl;
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
}

// Railway 字幕服务 API 地址（部署后需要更新）
const SUBTITLE_SERVICE_URL = normalizeSubtitleServiceUrl(process.env.NEXT_PUBLIC_SUBTITLE_API_URL);
const METADATA_TIMEOUT_MS = 15000;
const TRANSCRIPT_TIMEOUT_MS = 35000;

function getSubtitleServiceHint(details: string): string | null {
    if (!details) {
        return null;
    }

    if (details.includes('Sign in to confirm you’re not a bot')) {
        return 'YouTube 要求登录验证。请检查字幕服务的 YouTube cookies 是否有效，并确认 Railway 已用最新环境变量重新部署。';
    }

    if (details.includes('yt-dlp: not found')) {
        return '字幕服务缺少 yt-dlp 依赖。请检查 Railway 是否按 Dockerfile 构建。';
    }

    if (details.includes('No supported JavaScript runtime could be found')) {
        return '字幕服务缺少可用的 JavaScript runtime。请检查服务是否已部署到最新版本。';
    }

    if (details.includes('Application not found')) {
        return '字幕服务地址当前不可用。请检查 Railway 域名、服务状态或环境变量配置。';
    }

    if (details.includes('Failed to download yt-dlp')) {
        return '字幕服务启动时下载 yt-dlp 失败。请检查 Railway 构建日志和外网访问。';
    }

    return null;
}

function formatSubtitleServiceError(errorData: any, status: number): string {
    const baseMessage = typeof errorData?.error === 'string' && errorData.error.trim().length > 0
        ? errorData.error.trim()
        : `HTTP ${status}`;
    const details = typeof errorData?.details === 'string' ? errorData.details : '';
    const hint = getSubtitleServiceHint(details);

    if (hint) {
        return `${baseMessage}\n排查建议：${hint}`;
    }

    if (details) {
        const detailLines = details
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean);
        const actionableLine = detailLines.find((line: string) => line.startsWith('ERROR:'))
            || detailLines.find((line: string) => line.startsWith('WARNING:'))
            || detailLines.find((line: string) => !line.startsWith('Command failed:'));

        if (actionableLine) {
            return `${baseMessage}\n排查建议：${actionableLine.replace(/^(ERROR|WARNING):\s*/, '')}`;
        }
    }

    return baseMessage;
}

// 内存缓存
interface CacheEntry {
    data: TranscriptItem[];
    timestamp: number;
}

const transcriptCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

/**
 * YouTube Client Provider
 * 调用 Railway 部署的 yt-dlp 服务获取字幕
 */
export class YouTubeClientProvider implements TranscriptProvider {

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
            console.log(`[YouTubeClientProvider] Using cached transcript for ${videoId}`);
            return cached;
        }

        console.log(`[YouTubeClientProvider] Fetching transcript from Railway service for ${videoId}`);

        try {
            // 调用 Railway 字幕服务
            const response = await fetchWithTimeout(
                `${SUBTITLE_SERVICE_URL}/api/transcript?videoId=${videoId}&lang=en`,
                undefined,
                TRANSCRIPT_TIMEOUT_MS
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(formatSubtitleServiceError(errorData, response.status));
            }

            const data = await response.json();
            const transcript: TranscriptItem[] = data.transcript;

            if (!transcript || transcript.length === 0) {
                throw new Error('No transcript data returned');
            }

            console.log(`[YouTubeClientProvider] ✓ Fetched ${transcript.length} transcript items`);

            // 缓存结果
            this.saveToCache(videoId, transcript);

            return transcript;

        } catch (error: any) {
            console.error('[YouTubeClientProvider] Error fetching transcript:', error);
            throw new Error(
                '无法获取字幕: ' + (error.message || '服务暂时不可用，请稍后重试')
            );
        }
    }

    async getMetadata(videoId: string): Promise<VideoMetadata> {
        console.log(`[YouTubeClientProvider] Fetching metadata from Railway service for ${videoId}`);

        try {
            // 调用 Railway 字幕服务获取元数据
            const response = await fetchWithTimeout(
                `${SUBTITLE_SERVICE_URL}/api/metadata?videoId=${videoId}`,
                undefined,
                METADATA_TIMEOUT_MS
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(formatSubtitleServiceError(errorData, response.status));
            }

            const metadata = await response.json();

            return {
                id: videoId,
                title: metadata.title,
                description: metadata.description || '',
                thumbnailUrl: metadata.thumbnailUrl,
                duration: metadata.duration || 0,
            };

        } catch (error: any) {
            console.error('[YouTubeClientProvider] Error fetching metadata:', error);
            throw new Error('无法获取视频信息: ' + (error.message || '服务暂时不可用'));
        }
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

// 导出单例实例
export const youtubeClientProvider = new YouTubeClientProvider();

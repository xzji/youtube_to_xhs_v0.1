import { NextRequest, NextResponse } from 'next/server';
import { youtubeEdgeProvider } from '@/lib/services/youtube-edge-provider';
import type { TranscriptProvider } from '@/lib/services/transcript-provider';
import { MediaService } from '@/lib/services/media';
import { AIService } from '@/lib/services/ai';

// ✅ Edge Runtime - 完全兼容 Cloudflare Pages
export const runtime = 'edge';

// 使用 Provider 模式 - 易于替换不同的字幕服务
const transcriptProvider: TranscriptProvider = youtubeEdgeProvider;

export async function POST(req: NextRequest) {
    try {
        const { url, model, style, transcript: clientTranscript, metadata: clientMetadata } = await req.json();

        if (!url || !transcriptProvider.validateUrl(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        const videoId = transcriptProvider.extractVideoId(url);
        if (!videoId) {
            return NextResponse.json({ error: 'Could not extract Video ID' }, { status: 400 });
        }

        let metadata: any;
        let transcriptItems: any[];

        // 如果客户端已提供字幕和元数据，直接使用（推荐方式）
        if (clientTranscript && clientMetadata) {
            console.log('[API] Using client-provided transcript and metadata');
            transcriptItems = clientTranscript;
            metadata = clientMetadata;
        } else {
            // Fallback: 服务端获取（向后兼容，但通过顺序请求规避 IP 封禁）
            console.log('[API] Falling back to server-side transcript fetching (Sequential Mode)');

            try {
                // 1. 获取元数据
                console.log('[API] Fetching metadata...');
                metadata = await transcriptProvider.getMetadata(videoId);

                // 2. 避免并发，人为延迟 100ms
                await new Promise(resolve => setTimeout(resolve, 100));

                // 3. 获取字幕
                console.log('[API] Fetching transcript...');
                const transcriptResult = await transcriptProvider.getTranscript(videoId);
                transcriptItems = transcriptResult;

            } catch (err: any) {
                console.warn('Transcript/Metadata fetch failed:', err);
                const transcriptError = err.message || 'Unknown error';

                return NextResponse.json({
                    error: `无法获取字幕: ${transcriptError}`,
                    transcriptError
                }, { status: 400 });
            }

            // Error handled in catch block above
        }

        // Extract frames (disabled for now - requires yt-dlp and FFmpeg)
        // Use YouTube thumbnail as frames instead
        const frames: string[] = [
            metadata.thumbnailUrl.replace('hqdefault', 'maxresdefault'),
            metadata.thumbnailUrl
        ];

        // Uncomment below to enable frame extraction (requires yt-dlp + FFmpeg installation)
        // try {
        //     frames = await MediaService.extractFrames(videoId);
        // } catch (e) {
        //     console.warn('Frame extraction failed, falling back to thumbnail:', e);
        // }

        // Generate Content
        const fullTranscript = transcriptItems.map(item => item.text).join(' ');
        const generatedContent = await AIService.generateContent(
            metadata.title,
            fullTranscript,
            model,
            style
        );

        return NextResponse.json({
            metadata,
            frames,
            generated: generatedContent,
            transcript: transcriptItems,
        });

    } catch (error: any) {
        console.error('Processing error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

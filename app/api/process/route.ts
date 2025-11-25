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
        const { url, model, style } = await req.json();

        if (!url || !transcriptProvider.validateUrl(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        const videoId = transcriptProvider.extractVideoId(url);
        if (!videoId) {
            return NextResponse.json({ error: 'Could not extract Video ID' }, { status: 400 });
        }

        // Parallelize fetching metadata and transcript
        let transcriptError = null;
        const [metadata, transcriptItems] = await Promise.all([
            transcriptProvider.getMetadata(videoId),
            transcriptProvider.getTranscript(videoId).catch(err => {
                console.warn('Transcript fetch failed:', err);
                transcriptError = err.message || 'Unknown error';
                return [];
            })
        ]);

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
            transcriptError
        });

    } catch (error: any) {
        console.error('Processing error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

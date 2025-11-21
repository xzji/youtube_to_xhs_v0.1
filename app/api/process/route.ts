import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/services/youtube';
import { MediaService } from '@/lib/services/media';
import { AIService } from '@/lib/services/ai';

export async function POST(req: NextRequest) {
    try {
        const { url, model, style } = await req.json();

        if (!url || !YouTubeService.validateUrl(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        const videoId = YouTubeService.extractVideoId(url);
        if (!videoId) {
            return NextResponse.json({ error: 'Could not extract Video ID' }, { status: 400 });
        }

        // Parallelize fetching metadata and transcript
        const [metadata, transcriptItems] = await Promise.all([
            YouTubeService.getVideoMetadata(videoId),
            YouTubeService.getTranscript(videoId).catch(err => {
                console.warn('Transcript fetch failed:', err);
                return [];
            })
        ]);

        // Extract frames (this might take a while, maybe should be async/background job in production)
        // For this MVP, we'll wait.
        let frames: string[] = [];
        try {
            frames = await MediaService.extractFrames(videoId);
        } catch (e) {
            console.warn('Frame extraction failed, falling back to thumbnail:', e);
            // Fallback to high-res thumbnail if available
            frames = [
                metadata.thumbnailUrl.replace('hqdefault', 'maxresdefault'),
                metadata.thumbnailUrl
            ];
        }

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
            transcript: transcriptItems
        });

    } catch (error: any) {
        console.error('Processing error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

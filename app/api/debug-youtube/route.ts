import { NextRequest, NextResponse } from 'next/server';
import { youtubeEdgeProvider } from '@/lib/services/youtube-edge-provider';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const videoId = searchParams.get('v');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing video ID (v parameter)' }, { status: 400 });
    }

    const logs: string[] = [];
    // Override console.log to capture execution steps
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => logs.push(`[LOG] ${args.join(' ')}`);
    console.warn = (...args: any[]) => logs.push(`[WARN] ${args.join(' ')}`);
    console.error = (...args: any[]) => logs.push(`[ERROR] ${args.join(' ')}`);

    try {
        logs.push(`Starting concurrent fetch (Metadata + Transcript) for ${videoId}...`);

        const startTime = Date.now();

        // Simulate exact behavior of app/api/process/route.ts
        let transcriptError = null;
        let metadata: any = null;
        let transcript: any[] = [];

        await Promise.all([
            youtubeEdgeProvider.getMetadata(videoId).then(res => {
                logs.push(`[LOG] [Metadata] Success`);
                metadata = res;
            }).catch(err => {
                logs.push(`[ERROR] [Metadata] Failed: ${err.message}`);
                throw err;
            }),
            youtubeEdgeProvider.getTranscript(videoId).then(res => {
                logs.push(`[LOG] [Transcript] Success: ${res.length} items`);
                transcript = res;
            }).catch(err => {
                logs.push(`[ERROR] [Transcript] Failed: ${err.message}`);
                transcriptError = err.message;
                // Don't throw, just like in the real API
            })
        ]);

        const duration = Date.now() - startTime;

        return NextResponse.json({
            status: transcriptError ? 'partial_failure' : 'success',
            message: transcriptError ? 'Transcript failed but Metadata succeeded?' : 'All fetches successful',
            durationMs: duration,
            metadata,
            itemCount: transcript.length,
            transcriptError,
            logs
        });

    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            error: error.message,
            stack: error.stack,
            logs
        }, { status: 500 });
    } finally {
        // Restore console
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
    }
}

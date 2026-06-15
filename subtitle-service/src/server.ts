/**
 * YouTube Subtitle Service
 * 
 * Express API that uses yt-dlp to fetch YouTube subtitles.
 * Deployed to Railway to bypass YouTube's bot detection.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fetchTranscript } from '@egoist/youtube-transcript-plus';

const execFileAsync = promisify(execFile);
const YT_DLP_DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const YT_DLP_CACHE_PATH = process.env.YT_DLP_PATH || '/tmp/yt-dlp';
const YOUTUBE_COOKIES_CACHE_PATH = process.env.YOUTUBE_COOKIES_CACHE_PATH || '/tmp/youtube-cookies.txt';

const app = express();
const PORT = process.env.PORT || 3001;

// #region debug-point A:reporter
async function reportDebugEvent(hypothesisId: string, msg: string, data: Record<string, unknown>) {
    let debugUrl = 'http://127.0.0.1:7777/event';
    let sessionId = 'metadata-bot-check';

    try {
        const envContent = await fs.promises.readFile('.dbg/metadata-bot-check.env', 'utf-8');
        debugUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugUrl;
        sessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {
        // Ignore missing debug env in non-debug runs.
    }

    try {
        await fetch(debugUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                runId: 'pre-fix',
                hypothesisId,
                location: 'subtitle-service/src/server.ts',
                msg: `[DEBUG] ${msg}`,
                data,
                ts: Date.now(),
            }),
        });
    } catch {
        // Ignore debug reporting failures.
    }
}
// #endregion

// Enable CORS for Cloudflare frontend
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
}));

app.use(express.json());

async function fileExists(filePath: string, mode: number = fs.constants.X_OK): Promise<boolean> {
    try {
        await fs.promises.access(filePath, mode);
        return true;
    } catch {
        return false;
    }
}

async function resolveBinary(binaryName: string, candidates: string[]): Promise<string | null> {
    for (const candidate of candidates.filter(Boolean)) {
        if (await fileExists(candidate)) {
            return candidate;
        }
    }

    try {
        const { stdout } = await execFileAsync('which', [binaryName]);
        const resolved = stdout.trim();
        if (resolved && await fileExists(resolved)) {
            return resolved;
        }
    } catch {
        // Ignore resolution failures and let callers fall back gracefully.
    }

    return null;
}

async function resolveSystemYtDlp(): Promise<string | null> {
    return resolveBinary('yt-dlp', [
        process.env.YT_DLP_PATH ?? '',
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/opt/homebrew/bin/yt-dlp',
    ]);
}

async function ensureYtDlp(): Promise<string> {
    const systemPath = await resolveSystemYtDlp();
    if (systemPath) {
        return systemPath;
    }

    if (await fileExists(YT_DLP_CACHE_PATH)) {
        return YT_DLP_CACHE_PATH;
    }

    console.log(`[Subtitle Service] yt-dlp not found, downloading binary to ${YT_DLP_CACHE_PATH}`);
    const response = await fetch(YT_DLP_DOWNLOAD_URL);

    if (!response.ok) {
        throw new Error(`Failed to download yt-dlp: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(YT_DLP_CACHE_PATH, Buffer.from(arrayBuffer));
    await fs.promises.chmod(YT_DLP_CACHE_PATH, 0o755);

    return YT_DLP_CACHE_PATH;
}

async function resolveNodeBinary(): Promise<string | null> {
    return resolveBinary('node', [
        process.env.NODE_BINARY_PATH ?? '',
        '/usr/local/bin/node',
        '/usr/bin/node',
        '/opt/homebrew/bin/node',
    ]);
}

async function resolveDenoBinary(): Promise<string | null> {
    return resolveBinary('deno', [
        process.env.DENO_BINARY_PATH ?? '',
        '/usr/local/bin/deno',
        '/usr/bin/deno',
        '/opt/homebrew/bin/deno',
    ]);
}

async function ensureYoutubeCookiesFile(): Promise<string | null> {
    const cookieFilePath = process.env.YOUTUBE_COOKIES_PATH?.trim();
    if (cookieFilePath && await fileExists(cookieFilePath, fs.constants.R_OK)) {
        return cookieFilePath;
    }

    const cookieContent = process.env.YOUTUBE_COOKIES?.trim();
    const cookieContentBase64 = process.env.YOUTUBE_COOKIES_BASE64?.trim();

    if (!cookieContent && !cookieContentBase64) {
        return null;
    }

    const resolvedContent = cookieContent
        ? cookieContent.replace(/\\n/g, '\n')
        : Buffer.from(cookieContentBase64!, 'base64').toString('utf-8');

    await fs.promises.writeFile(YOUTUBE_COOKIES_CACHE_PATH, resolvedContent, { mode: 0o600 });
    return YOUTUBE_COOKIES_CACHE_PATH;
}

async function buildYtDlpArgs(commandArgs: string[]): Promise<string[]> {
    const finalArgs: string[] = [];
    const cookiesPath = await ensureYoutubeCookiesFile();
    const denoBinaryPath = await resolveDenoBinary();
    const nodeBinaryPath = await resolveNodeBinary();

    if (denoBinaryPath) {
        finalArgs.push('--js-runtimes', `deno:${denoBinaryPath}`);
    } else if (nodeBinaryPath) {
        finalArgs.push('--js-runtimes', `node:${nodeBinaryPath}`);
    }

    if (cookiesPath) {
        finalArgs.push('--cookies', cookiesPath);
    }

    finalArgs.push('--no-playlist', ...commandArgs);
    return finalArgs;
}

async function fetchMetadataFromOEmbed(videoId: string) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(oEmbedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
        },
    });

    if (!response.ok) {
        throw new Error(`oEmbed HTTP ${response.status}`);
    }

    const data = await response.json() as {
        title?: string;
        thumbnail_url?: string;
    };

    return {
        id: videoId,
        title: data.title || `video_${videoId}`,
        description: '',
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
    };
}

function buildTranscriptLanguagePriority(requestedLang: string): string[] {
    const baseLang = requestedLang.replace(/\.\*/g, '').trim();
    const priority = [
        baseLang,
        baseLang === 'en' ? 'en-US' : '',
        baseLang === 'en' ? 'en-GB' : '',
        'zh',
        'zh-Hans',
        'zh-Hant',
        'zh-CN',
        'zh-TW',
        'en',
    ].filter(Boolean);

    return Array.from(new Set(priority));
}

async function fetchTranscriptWithLibrary(videoId: string, requestedLang: string): Promise<Array<{ offset: number; duration: number; text: string }>> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const candidates = buildTranscriptLanguagePriority(requestedLang);
    let lastError: Error | null = null;

    for (const lang of candidates) {
        try {
            const result = await fetchTranscript(url, { lang }) as any;
            const segments = result?.segments || result?.transcript || result || [];

            if (Array.isArray(segments) && segments.length > 0) {
                return segments.map((item: any) => ({
                    offset: Number(item.offset ?? item.start ?? 0),
                    duration: Number(item.duration ?? item.dur ?? 0),
                    text: String(item.text ?? '').trim(),
                })).filter((item) => item.text.length > 0);
            }
        } catch (error: any) {
            lastError = error;
        }
    }

    throw lastError || new Error('No transcript available from fallback provider');
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get video metadata
app.get('/api/metadata', async (req: Request, res: Response) => {
    const { videoId } = req.query;

    if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    try {
        const ytDlpPath = await ensureYtDlp();
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        // #region debug-point A:metadata-start
        await reportDebugEvent('A', 'metadata fetch started', { videoId, url });
        // #endregion
        const { stdout } = await execFileAsync(
            ytDlpPath,
            await buildYtDlpArgs(['--dump-json', '--skip-download', url])
        );
        const metadata = JSON.parse(stdout);

        // #region debug-point A:metadata-success
        await reportDebugEvent('A', 'metadata fetch succeeded', {
            videoId,
            hasTitle: Boolean(metadata?.title),
            hasThumbnail: Boolean(metadata?.thumbnail),
        });
        // #endregion

        res.json({
            id: videoId,
            title: metadata.title,
            description: metadata.description,
            thumbnailUrl: metadata.thumbnail,
            duration: metadata.duration,
        });
    } catch (error: any) {
        // #region debug-point B:metadata-yt-dlp-error
        await reportDebugEvent('B', 'metadata fetch failed via yt-dlp', {
            videoId,
            error: error?.message || 'unknown',
        });
        // #endregion

        try {
            const fallbackMetadata = await fetchMetadataFromOEmbed(videoId);
            // #region debug-point E:metadata-fallback-success
            await reportDebugEvent('E', 'metadata fallback succeeded via oEmbed', {
                videoId,
                title: fallbackMetadata.title,
            });
            // #endregion
            res.json(fallbackMetadata);
        } catch (fallbackError: any) {
            // #region debug-point E:metadata-fallback-error
            await reportDebugEvent('E', 'metadata fallback failed', {
                videoId,
                error: fallbackError?.message || 'unknown',
            });
            // #endregion
            console.error('Metadata fetch error:', error);
            console.error('Metadata fallback error:', fallbackError);
            res.status(500).json({ error: 'Failed to fetch video metadata', details: error.message });
        }
    }
});

// Get transcript/subtitles
app.get('/api/transcript', async (req: Request, res: Response) => {
    const { videoId, lang } = req.query;

    if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    // If language is 'en', use regex 'en.*' to match en-US, en-GB, etc.
    const requestedLang = (lang as string) || 'en';
    const language = requestedLang === 'en' ? 'en.*' : requestedLang;
    const tempDir = `/tmp/subs_${videoId}_${Date.now()}`;

    try {
        const ytDlpPath = await ensureYtDlp();
        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const outputTemplate = path.join(tempDir, '%(id)s');

        // Fetch subtitles using yt-dlp
        console.log(`[Subtitle Service] Fetching subtitles for ${videoId} (${language})`);
        // #region debug-point C:transcript-start
        await reportDebugEvent('C', 'transcript fetch started', { videoId, language });
        // #endregion

        await execFileAsync(
            ytDlpPath,
            await buildYtDlpArgs(['--skip-download', '--write-auto-sub', '--sub-lang', language, '--sub-format', 'vtt', '-o', outputTemplate, url]),
            { timeout: 30000 }
        );

        // Find the subtitle file
        const files = fs.readdirSync(tempDir);
        const subtitleFile = files.find(f => f.endsWith('.vtt'));

        if (!subtitleFile) {
            // Try with original subtitles if auto-sub failed
            await execFileAsync(
                ytDlpPath,
                await buildYtDlpArgs(['--skip-download', '--write-sub', '--sub-lang', language, '--sub-format', 'vtt', '-o', outputTemplate, url]),
                { timeout: 30000 }
            );

            const filesRetry = fs.readdirSync(tempDir);
            const subtitleFileRetry = filesRetry.find(f => f.endsWith('.vtt'));

            if (!subtitleFileRetry) {
                throw new Error('No subtitles found for this video');
            }
        }

        const vttContent = fs.readFileSync(path.join(tempDir, subtitleFile || files.find(f => f.endsWith('.vtt'))!), 'utf-8');

        // Parse VTT to JSON
        const transcript = parseVTT(vttContent);

        console.log(`[Subtitle Service] ✓ Fetched ${transcript.length} subtitle segments`);
        // #region debug-point C:transcript-success
        await reportDebugEvent('C', 'transcript fetch succeeded', {
            videoId,
            language,
            transcriptCount: transcript.length,
        });
        // #endregion

        res.json({
            videoId,
            language,
            transcript,
        });

    } catch (error: any) {
        // #region debug-point D:transcript-yt-dlp-error
        await reportDebugEvent('D', 'transcript fetch failed via yt-dlp', {
            videoId,
            language,
            error: error?.message || 'unknown',
        });
        // #endregion

        try {
            const transcript = await fetchTranscriptWithLibrary(videoId, requestedLang);
            // #region debug-point E:transcript-fallback-success
            await reportDebugEvent('E', 'transcript fallback succeeded via youtube-transcript-plus', {
                videoId,
                language: requestedLang,
                transcriptCount: transcript.length,
            });
            // #endregion
            res.json({
                videoId,
                language: requestedLang,
                transcript,
            });
        } catch (fallbackError: any) {
            // #region debug-point E:transcript-fallback-error
            await reportDebugEvent('E', 'transcript fallback failed', {
                videoId,
                language: requestedLang,
                error: fallbackError?.message || 'unknown',
            });
            // #endregion
            console.error('Transcript fetch error:', error);
            console.error('Transcript fallback error:', fallbackError);
            res.status(500).json({
                error: 'Failed to fetch transcript',
                details: error.message
            });
        }
    } finally {
        // Cleanup temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    }
});

/**
 * Parse VTT format to JSON transcript items
 */
function parseVTT(vttContent: string): Array<{ offset: number; duration: number; text: string }> {
    const lines = vttContent.split('\n');
    const transcript: Array<{ offset: number; duration: number; text: string }> = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // Look for timestamp lines (e.g., "00:00:01.000 --> 00:00:04.000")
        const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);

        if (timestampMatch) {
            const startTime = parseTimestamp(timestampMatch[1]);
            const endTime = parseTimestamp(timestampMatch[2]);

            // Collect text lines until empty line
            i++;
            const textLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '') {
                // Remove VTT formatting tags
                const cleanText = lines[i]
                    .replace(/<[^>]+>/g, '')  // Remove HTML-like tags
                    .replace(/&nbsp;/g, ' ')
                    .trim();
                if (cleanText) {
                    textLines.push(cleanText);
                }
                i++;
            }

            const text = textLines.join(' ').trim();
            if (text) {
                transcript.push({
                    offset: startTime,
                    duration: endTime - startTime,
                    text,
                });
            }
        }
        i++;
    }

    // Deduplicate overlapping segments
    return deduplicateTranscript(transcript);
}

/**
 * Parse VTT timestamp to seconds
 */
function parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Remove duplicate/overlapping transcript segments
 */
function deduplicateTranscript(transcript: Array<{ offset: number; duration: number; text: string }>) {
    const seen = new Set<string>();
    return transcript.filter(item => {
        const key = item.text;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

app.listen(PORT, () => {
    console.log(`[Subtitle Service] Running on port ${PORT}`);
    console.log(`[Subtitle Service] Endpoints:`);
    console.log(`  - GET /health`);
    console.log(`  - GET /api/metadata?videoId=xxx`);
    console.log(`  - GET /api/transcript?videoId=xxx&lang=en`);
});

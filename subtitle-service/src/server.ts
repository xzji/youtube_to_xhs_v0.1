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

const execFileAsync = promisify(execFile);
const YT_DLP_DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const YT_DLP_CACHE_PATH = process.env.YT_DLP_PATH || '/tmp/yt-dlp';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for Cloudflare frontend
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
}));

app.use(express.json());

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

async function resolveSystemYtDlp(): Promise<string | null> {
    const candidates = [
        process.env.YT_DLP_PATH,
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/opt/homebrew/bin/yt-dlp',
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        if (await fileExists(candidate)) {
            return candidate;
        }
    }

    try {
        const { stdout } = await execFileAsync('which', ['yt-dlp']);
        const resolved = stdout.trim();
        if (resolved && await fileExists(resolved)) {
            return resolved;
        }
    } catch {
        // Ignore and fall back to downloading a local binary.
    }

    return null;
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
        const { stdout } = await execFileAsync(ytDlpPath, ['--dump-json', '--skip-download', url]);
        const metadata = JSON.parse(stdout);

        res.json({
            id: videoId,
            title: metadata.title,
            description: metadata.description,
            thumbnailUrl: metadata.thumbnail,
            duration: metadata.duration,
        });
    } catch (error: any) {
        console.error('Metadata fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch video metadata', details: error.message });
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

        await execFileAsync(
            ytDlpPath,
            ['--skip-download', '--write-auto-sub', '--sub-lang', language, '--sub-format', 'vtt', '-o', outputTemplate, url],
            { timeout: 30000 }
        );

        // Find the subtitle file
        const files = fs.readdirSync(tempDir);
        const subtitleFile = files.find(f => f.endsWith('.vtt'));

        if (!subtitleFile) {
            // Try with original subtitles if auto-sub failed
            await execFileAsync(
                ytDlpPath,
                ['--skip-download', '--write-sub', '--sub-lang', language, '--sub-format', 'vtt', '-o', outputTemplate, url],
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

        res.json({
            videoId,
            language,
            transcript,
        });

    } catch (error: any) {
        console.error('Transcript fetch error:', error);
        res.status(500).json({
            error: 'Failed to fetch transcript',
            details: error.message
        });
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

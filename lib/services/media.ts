import YtDlpWrap from 'yt-dlp-wrap';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

export class MediaService {
    // Use the yt-dlp installed in the virtual environment
    private static ytDlpBinaryPath = path.join(process.cwd(), 'venv', 'bin', 'yt-dlp');
    private static ytDlpWrap: YtDlpWrap;

    private static async ensureYtDlp() {
        if (this.ytDlpWrap) return;

        if (!(await exists(this.ytDlpBinaryPath))) {
            throw new Error(`yt-dlp binary not found at ${this.ytDlpBinaryPath}. Please run "python3 -m venv venv && ./venv/bin/pip install yt-dlp"`);
        }

        this.ytDlpWrap = new YtDlpWrap(this.ytDlpBinaryPath);
    }

    static async getVideoUrl(videoId: string): Promise<string> {
        await this.ensureYtDlp();
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        // Get the best video stream URL (mp4 preferred)
        const stdout = await this.ytDlpWrap.execPromise([
            url,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-g',
            '--extractor-args', 'youtube:player_client=ios',
        ]);
        return stdout.trim().split('\n')[0]; // Return the video URL (first line)
    }

    static async extractFrames(videoId: string, count: number = 5): Promise<string[]> {
        await this.ensureYtDlp();
        const videoUrl = await this.getVideoUrl(videoId);
        const outputDir = path.join(process.cwd(), 'public', 'temp', videoId);

        if (!(await exists(outputDir))) {
            await mkdir(outputDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const screenshots: string[] = [];

            ffmpeg(videoUrl)
                .on('filenames', (filenames) => {
                    filenames.forEach((filename) => {
                        screenshots.push(`/temp/${videoId}/${filename}`);
                    });
                })
                .on('end', () => {
                    resolve(screenshots);
                })
                .on('error', (err) => {
                    console.error('Error extracting frames:', err);
                    reject(err);
                })
                .screenshots({
                    count: count,
                    folder: outputDir,
                    filename: 'frame-%i.png',
                    size: '1280x720'
                });
        });
    }
}

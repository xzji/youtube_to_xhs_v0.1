import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

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

  static async getTranscript(videoId: string): Promise<TranscriptItem[]> {
    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'get_transcript.py');
      const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

      const { stdout } = await execAsync(`${pythonPath} "${scriptPath}" "${videoId}"`);
      const transcript = JSON.parse(stdout);
      return transcript;
    } catch (error) {
      console.error('Error fetching transcript:', error);
      // Return empty array on failure to allow fallback
      return [];
    }
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

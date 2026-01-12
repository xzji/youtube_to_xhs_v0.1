
import { youtubeEdgeProvider } from '../lib/services/youtube-edge-provider';

async function main() {
    const videoId = 'xNqs_S-zEBY';
    console.log(`Testing YouTubeEdgeProvider for video: ${videoId}`);

    try {
        const transcript = await youtubeEdgeProvider.getTranscript(videoId);
        console.log('Success!');
        console.log(`Fetched ${transcript.length} items.`);
        console.log('First item:', transcript[0]);
    } catch (error) {
        console.error('Failed to fetch transcript:');
        console.error(error);
    }
}

main();

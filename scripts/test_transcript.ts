import { YoutubeTranscript } from 'youtube-transcript';

const videos = [
    'jNQXAC9IVRw', // Me at the zoo
    'dQw4w9WgXcQ', // Rick Roll
    'M7FIvfx5J10', // Another popular video
];

async function test() {
    console.log('Testing youtube-transcript with multiple videos...');

    for (const videoId of videos) {
        console.log(`\nTesting video: ${videoId}`);
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            console.log(`Success! Found ${transcript.length} items.`);
            if (transcript.length > 0) {
                console.log('First item:', transcript[0]);
            }
        } catch (error) {
            console.error(`Error fetching transcript for ${videoId}:`, error);
        }
    }
}

test();

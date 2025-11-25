import { getSubtitles } from 'youtube-caption-scraper';

const videos = [
    'jNQXAC9IVRw', // Me at the zoo
    'dQw4w9WgXcQ', // Rick Roll
    'M7FIvfx5J10', // Another popular video
];

async function test() {
    console.log('Testing youtube-caption-scraper with multiple videos...');

    for (const videoId of videos) {
        console.log(`\nTesting video: ${videoId}`);
        try {
            const subtitles = await getSubtitles({
                videoID: videoId,
                lang: 'en'
            });
            console.log(`Success! Found ${subtitles.length} items.`);
            if (subtitles.length > 0) {
                console.log('First item:', subtitles[0]);
            }
        } catch (error) {
            console.error(`Error fetching transcript for ${videoId}:`, error);
        }
    }
}

test();

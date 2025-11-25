import { fetchTranscript } from '@egoist/youtube-transcript-plus';

const videos = [
    'jNQXAC9IVRw', // Me at the zoo
    'dQw4w9WgXcQ', // Rick Roll
    'M7FIvfx5J10', // Another popular video
];

async function test() {
    console.log('Testing @egoist/youtube-transcript-plus with multiple videos...');

    for (const videoId of videos) {
        console.log(`\nTesting video: ${videoId}`);
        try {
            const transcript = await fetchTranscript(videoId);
            console.log(`Success! Type: ${typeof transcript}`);
            console.log('Transcript object keys:', Object.keys(transcript));
            // console.log('Full transcript object:', JSON.stringify(transcript, null, 2).substring(0, 500) + '...');
            if (Array.isArray(transcript)) {
                console.log(`Found ${transcript.length} items.`);
                console.log('First item:', transcript[0]);
            } else {
                // It might be an object with a property containing the array
                console.log('Transcript is not an array. Inspecting structure...');
                console.log(JSON.stringify(transcript, null, 2).substring(0, 1000));
            }
        } catch (error) {
            console.error(`Error fetching transcript for ${videoId}:`, error);
        }
    }
}

test();

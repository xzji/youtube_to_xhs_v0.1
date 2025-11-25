import { YouTubeService } from '../lib/services/youtube';

const testVideos = [
    'jNQXAC9IVRw', // Me at the zoo (English)
    'dQw4w9WgXcQ', // Rick Roll (English)
];

async function testYouTubeService() {
    console.log('Testing YouTubeService.getTranscript() with new implementation...\n');

    for (const videoId of testVideos) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing video: ${videoId}`);
        console.log(`URL: https://www.youtube.com/watch?v=${videoId}`);
        console.log('='.repeat(60));

        try {
            const transcript = await YouTubeService.getTranscript(videoId);
            console.log(`\n✓ Successfully fetched transcript!`);
            console.log(`Found ${transcript.length} transcript items\n`);

            // Show first 5 items
            console.log('First 5 transcript items:');
            transcript.slice(0, 5).forEach((item, index) => {
                const minutes = Math.floor(item.offset / 60);
                const seconds = Math.floor(item.offset % 60);
                const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                console.log(`  [${index + 1}] [${timestamp}] ${item.text}`);
            });

            // Check for HTML entities (should be decoded)
            const hasHtmlEntities = transcript.some(item =>
                item.text.includes('&amp;') ||
                item.text.includes('&#39;') ||
                item.text.includes('&quot;')
            );

            if (hasHtmlEntities) {
                console.log('\n⚠️  WARNING: Found HTML entities in text (decoding may have failed)');
            } else {
                console.log('\n✓ HTML entities properly decoded');
            }

        } catch (error) {
            console.error(`\n❌ Error:`, error instanceof Error ? error.message : error);
        }
    }
}

testYouTubeService();

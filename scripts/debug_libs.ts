
import { YoutubeTranscript } from 'youtube-transcript';
// import { getSubtitles } from 'youtube-caption-scraper'; // CommonJS module, might be tricky in tsx without config, let's try dynamic import or skip for now if first one works.

const VIDEO_ID = 'xNqs_S-zEBY';

async function testYoutubeTranscript() {
    console.log('--- Testing youtube-transcript ---');
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(VIDEO_ID);
        console.log(`Success! Fetched ${transcript.length} items`);
        console.log(transcript[0]);
    } catch (e) {
        console.error('youtube-transcript failed:', e.message);
    }
}

// async function testCaptionScraper() {
//     console.log('--- Testing youtube-caption-scraper ---');
//     try {
//         // @ts-ignore
//         const scraper = await import('youtube-caption-scraper');
//         const getSubtitles = scraper.default.getSubtitles || scraper.getSubtitles;

//         const transcript = await getSubtitles({ videoID: VIDEO_ID });
//         console.log(`Success! Fetched ${transcript.length} items`);
//         console.log(transcript[0]);
//     } catch (e) {
//         console.error('youtube-caption-scraper failed:', e.message);
//     }
// }

async function main() {
    await testYoutubeTranscript();
    // await testCaptionScraper();
}

main();

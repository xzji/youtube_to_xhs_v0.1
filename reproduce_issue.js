
const fetch = require('node-fetch');

const API_URL = 'https://youtubetoxhsv01-production.up.railway.app';
const videoIdFail = 'RfDsivf0xvs';
const videoIdSuccess = 'xNqs_S-zEBY';

async function testVideo(videoId) {
    console.log(`Testing video: ${videoId}`);
    try {
        const url = `${API_URL}/api/transcript?videoId=${videoId}&lang=en`;
        console.log(`Fetching: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            const text = await response.text();
            console.error(`FAILED: HTTP ${response.status}`);
            console.error(`Response: ${text}`);
        } else {
            const data = await response.json();
            console.log(`SUCCESS: Found ${data.transcript?.length} transcript items`);
        }
    } catch (error) {
        console.error(`ERROR: ${error.message}`);
    }
    console.log('---');
}

async function run() {
    await testVideo(videoIdSuccess);
    await testVideo(videoIdFail);
}

run();

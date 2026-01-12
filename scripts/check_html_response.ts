
import fetch from 'node-fetch';

async function main() {
    const videoId = 'xNqs_S-zEBY';
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching ${url}...`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+419'
        }
    });

    const html = await response.text();
    console.log(`Length: ${html.length}`);

    if (html.includes('ytInitialPlayerResponse')) {
        console.log('Found ytInitialPlayerResponse!');

        const match = html.match(/var ytInitialPlayerResponse = ({.+?});/);
        if (match) {
            try {
                const data = JSON.parse(match[1]);
                // Check both locations
                const tracklist = data.captions?.playerCaptionsTracklistRenderer || data.playerCaptionsTracklistRenderer;
                const captions = tracklist?.captionTracks;

                console.log('Keys in data:', Object.keys(data));
                if (data.playabilityStatus) {
                    console.log('Playability:', data.playabilityStatus.status);
                    if (data.playabilityStatus.errorScreen) {
                        console.log('Error Screen:', JSON.stringify(data.playabilityStatus.errorScreen, null, 2));
                    }
                }

                if (captions) {
                    console.log(`Found ${captions.length} caption tracks in HTML!`);
                    console.log(captions[0]);
                } else {
                    console.log('ytInitialPlayerResponse found but NO captions in it.');
                    // log captions object if exists
                    if (data.captions) {
                        console.log('data.captions keys:', Object.keys(data.captions));
                    }
                }
            } catch (e) {
                console.log('Failed to parse JSON:', e);
            }
        } else {
            console.log('Regex failed to extract JSON object');
        }
    } else {
        console.log('ytInitialPlayerResponse NOT found.');
    }
}

main();

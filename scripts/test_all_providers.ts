/**
 * 测试脚本：验证三个 YouTube 字幕库的可用性
 * 视频链接: https://www.youtube.com/watch?v=xNqs_S-zEBY
 */

import { YoutubeTranscript } from 'youtube-transcript';
import YTDlpWrap from 'yt-dlp-wrap';

const VIDEO_ID = 'xNqs_S-zEBY';
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

async function testYoutubeTranscript() {
    console.log('\n═══════════════════════════════════════');
    console.log('📦 测试 youtube-transcript');
    console.log('═══════════════════════════════════════');
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(VIDEO_ID);
        console.log(`✅ 成功! 获取到 ${transcript.length} 条字幕`);
        console.log('示例:', transcript[0]);
    } catch (e: any) {
        console.error('❌ 失败:', e.message);
    }
}

async function testCaptionScraper() {
    console.log('\n═══════════════════════════════════════');
    console.log('📦 测试 youtube-caption-scraper');
    console.log('═══════════════════════════════════════');
    try {
        // 动态导入以避免 ESM/CJS 兼容问题
        const scraper = await import('youtube-caption-scraper');
        const getSubtitles = scraper.getSubtitles || scraper.default?.getSubtitles;

        if (!getSubtitles) {
            throw new Error('无法找到 getSubtitles 函数');
        }

        const transcript = await getSubtitles({ videoID: VIDEO_ID });
        console.log(`✅ 成功! 获取到 ${transcript.length} 条字幕`);
        console.log('示例:', transcript[0]);
    } catch (e: any) {
        console.error('❌ 失败:', e.message);
    }
}

async function testYtDlp() {
    console.log('\n═══════════════════════════════════════');
    console.log('📦 测试 yt-dlp-wrap');
    console.log('═══════════════════════════════════════');
    try {
        const ytDlpWrap = new YTDlpWrap();

        // 先测试能否获取视频信息
        console.log('正在获取视频信息...');
        const metadata = await ytDlpWrap.getVideoInfo(VIDEO_URL);
        console.log(`✅ 视频标题: ${metadata.title}`);

        // 检查是否有字幕轨道
        if (metadata.subtitles && Object.keys(metadata.subtitles).length > 0) {
            console.log(`✅ 可用字幕语言: ${Object.keys(metadata.subtitles).join(', ')}`);
        } else if (metadata.automatic_captions && Object.keys(metadata.automatic_captions).length > 0) {
            console.log(`✅ 可用自动字幕语言: ${Object.keys(metadata.automatic_captions).join(', ')}`);
        } else {
            console.log('⚠️ 未找到字幕轨道');
        }

    } catch (e: any) {
        console.error('❌ 失败:', e.message);
        if (e.message.includes('yt-dlp')) {
            console.log('💡 提示: 需要安装 yt-dlp 命令行工具');
            console.log('   macOS: brew install yt-dlp');
            console.log('   或: pip install yt-dlp');
        }
    }
}

async function main() {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   YouTube 字幕库兼容性测试            ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║ 视频 ID: ${VIDEO_ID}              ║`);
    console.log('╚═══════════════════════════════════════╝');

    await testYoutubeTranscript();
    await testCaptionScraper();
    await testYtDlp();

    console.log('\n═══════════════════════════════════════');
    console.log('📊 Cloudflare Edge Runtime 兼容性');
    console.log('═══════════════════════════════════════');
    console.log('• youtube-transcript:      ⚠️ 纯 Web API (理论兼容)');
    console.log('• youtube-caption-scraper: ⚠️ 纯 Web API (理论兼容)');
    console.log('• yt-dlp-wrap:             ❌ 需要二进制文件 (不兼容)');
}

main();

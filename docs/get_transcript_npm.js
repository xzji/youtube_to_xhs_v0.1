const { fetchTranscript } = require('@egoist/youtube-transcript-plus');
const fs = require('fs');

const url = process.argv[2];

if (!url) {
    console.error('请提供 YouTube URL 作为参数');
    console.error('用法: node index.js <youtube_url>');
    process.exit(1);
}

// 提取视频 ID
const videoIdMatch = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
const videoId = videoIdMatch ? videoIdMatch[1] : 'unknown';

console.log('正在获取字幕:', url);
console.log('视频 ID:', videoId);
console.log('');

// 按优先级尝试的语言列表
const languagePriority = [
    { code: 'zh', name: '中文' },
    { code: 'zh-Hans', name: '简体中文' },
    { code: 'zh-Hant', name: '繁体中文' },
    { code: 'zh-CN', name: '中文(中国)' },
    { code: 'zh-TW', name: '中文(台湾)' },
    { code: 'en', name: '英文' },
    { code: 'en-US', name: '英文(美国)' },
    { code: 'en-GB', name: '英文(英国)' },
];

// 其他常见语言作为备选
const otherLanguages = [
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' },
    { code: 'es', name: '西班牙语' },
    { code: 'fr', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'ru', name: '俄语' },
    { code: 'ar', name: '阿拉伯语' },
    { code: 'pt', name: '葡萄牙语' },
    { code: 'it', name: '意大利语' },
];

async function tryFetchTranscript(lang) {
    try {
        const response = await fetchTranscript(url, { lang });
        return response;
    } catch (err) {
        return null;
    }
}

async function getTranscript() {
    let response = null;
    let usedLang = null;

    // 1. 尝试按优先级获取字幕
    console.log('正在尝试获取字幕...');
    for (const lang of languagePriority) {
        console.log(`尝试 ${lang.name} (${lang.code})...`);
        response = await tryFetchTranscript(lang.code);
        if (response) {
            usedLang = lang;
            console.log(`✓ 成功获取 ${lang.name} 字幕!\n`);
            break;
        }
    }

    // 2. 如果优先级语言都没有,尝试其他常见语言
    if (!response) {
        console.log('\n优先语言(中文/英文)都不可用,尝试其他语言...');
        for (const lang of otherLanguages) {
            console.log(`尝试 ${lang.name} (${lang.code})...`);
            response = await tryFetchTranscript(lang.code);
            if (response) {
                usedLang = lang;
                console.log(`✓ 成功获取 ${lang.name} 字幕!\n`);
                break;
            }
        }
    }

    // 3. 如果还是没有,报错
    if (!response) {
        console.error('❌ 无法获取任何语言的字幕');
        console.error('可能的原因:');
        console.error('- 该视频没有字幕');
        console.error('- 视频 ID 无效');
        console.error('- 网络连接问题');
        process.exit(1);
    }

    try {
        // 保存原始 JSON 到文件
        const filename = `${videoId}.txt`;
        fs.writeFileSync(filename, JSON.stringify(response, null, 2), 'utf-8');
        console.log(`✓ 已保存 JSON 字幕到文件: ${filename}`);
        console.log(`使用语言: ${usedLang.name} (${usedLang.code})\n`);

        // 检查返回的数据结构
        // 库返回的格式是 { title: string, segments: array }
        let transcriptArray;
        if (response.segments && Array.isArray(response.segments)) {
            transcriptArray = response.segments;
            console.log('视频标题:', response.title);
        } else if (response.transcript && Array.isArray(response.transcript)) {
            transcriptArray = response.transcript;
        } else if (Array.isArray(response)) {
            transcriptArray = response;
        } else {
            console.error('无法解析字幕数据,未知的数据格式');
            console.error('返回的数据键:', Object.keys(response));
            process.exit(1);
        }

        console.log(`共 ${transcriptArray.length} 条字幕\n`);

        // 输出纯文本格式
        console.log('=== 纯文本格式 ===');
        transcriptArray.forEach(item => {
            // 解码 HTML 实体
            const text = item.text
                .replace(/&amp;#39;/g, "'")
                .replace(/&amp;quot;/g, '"')
                .replace(/&amp;lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&amp;amp;/g, '&');
            console.log(text);
        });

        // 输出带时间戳的格式
        console.log('\n\n=== 带时间戳格式 ===');
        transcriptArray.forEach(item => {
            const minutes = Math.floor(item.offset / 60);
            const seconds = Math.floor(item.offset % 60);
            const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // 解码 HTML 实体
            const text = item.text
                .replace(/&amp;#39;/g, "'")
                .replace(/&amp;quot;/g, '"')
                .replace(/&amp;lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&amp;amp;/g, '&');

            console.log(`[${timestamp}] ${text}`);
        });

    } catch (err) {
        console.error('处理字幕时出错:', err.message);
        process.exit(1);
    }
}

getTranscript();

import { STYLE_PROMPTS, SYSTEM_PROMPT_TEMPLATE } from '@/lib/constants/prompts';
import { DEFAULT_MODEL, getModelProvider } from '@/lib/constants/models';
import { formatGeneratedContent } from '@/lib/utils/content-emphasis';
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/utils/fetch-with-timeout';

const MAX_PROMPT_TRANSCRIPT_CHARS = 12000;
const MIN_SEGMENT_LENGTH = 18;
const AI_TIMEOUT_MS = 45000;

const AI_PROVIDERS = {
    openrouter: {
        name: 'OpenRouter',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    },
    volcengine: {
        name: '火山引擎方舟',
        apiKeyEnv: 'ARK_API_KEY',
        endpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions',
    },
} as const;

function normalizeSegment(text: string): string {
    return text
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitTranscriptIntoSegments(transcript: string): string[] {
    return transcript
        .replace(/\r\n/g, '\n')
        .split(/(?<=[。！？!?\.])\s+|\n+/)
        .map(normalizeSegment)
        .filter((segment) => segment.length >= MIN_SEGMENT_LENGTH);
}

function dedupeSegments(segments: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const segment of segments) {
        const fingerprint = segment.toLowerCase();
        const previous = unique[unique.length - 1]?.toLowerCase() ?? '';

        if (seen.has(fingerprint)) {
            continue;
        }

        if (previous && (previous.includes(fingerprint) || fingerprint.includes(previous))) {
            unique[unique.length - 1] = segment.length > previous.length ? segment : unique[unique.length - 1];
            seen.add(fingerprint);
            continue;
        }

        seen.add(fingerprint);
        unique.push(segment);
    }

    return unique;
}

function selectRepresentativeSegments(segments: string[], maxChars: number): string[] {
    if (segments.length === 0) {
        return [];
    }

    const selected: string[] = [];
    const selectedIndexes = new Set<number>();
    const targetCount = Math.min(36, segments.length);
    const priorityIndexes = new Set<number>([
        0,
        1,
        segments.length - 2,
        segments.length - 1,
    ].filter((index) => index >= 0 && index < segments.length));

    for (let i = 0; i < targetCount; i += 1) {
        const index = Math.floor((i * (segments.length - 1)) / Math.max(targetCount - 1, 1));
        priorityIndexes.add(index);
    }

    for (const index of Array.from(priorityIndexes).sort((a, b) => a - b)) {
        if (!selectedIndexes.has(index)) {
            selectedIndexes.add(index);
            selected.push(segments[index]);
        }
    }

    const joined = selected.join('\n');
    if (joined.length <= maxChars) {
        return selected;
    }

    const trimmed: string[] = [];
    let total = 0;

    for (const segment of selected) {
        const nextLength = total === 0 ? segment.length : total + 1 + segment.length;
        if (nextLength > maxChars) {
            break;
        }
        trimmed.push(segment);
        total = nextLength;
    }

    return trimmed;
}

function prepareTranscriptForPrompt(transcript: string): string {
    // Keep original content order. Only do light cleaning:
    // - strip bracketed/parenthetical annotations
    // - normalize whitespace within each line
    // - preserve line breaks
    return transcript
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => normalizeSegment(line))
        .filter(Boolean)
        .join('\n')
        .trim();
}

function buildContentPayload(
    title: string,
    content: string,
    tags: string[]
): { title: string; content: string; tags: string[] } {
    return {
        title,
        content: formatGeneratedContent(content),
        tags,
    };
}

export class AIService {
    static async generateContent(
        videoTitle: string,
        transcript: string,
        model: string = DEFAULT_MODEL,
        style: string = '故事模式'
    ): Promise<{ title: string; content: string; tags: string[] }> {
        const providerKey = getModelProvider(model);
        const provider = AI_PROVIDERS[providerKey];
        const apiKey = process.env[provider.apiKeyEnv];

        if (!apiKey) {
            console.warn(`${provider.apiKeyEnv} not found, using mock data`);
            return buildContentPayload(
                `[Mock] ${videoTitle}`,
                `这是基于视频字幕的摘要。\n\n主要内容：\n${transcript.substring(0, 200)}...`,
                ['#YouTube', '#AI生成', '#小红书']
            );
        }

        // Build prompt based on style
        const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['故事模式'];

        const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{{STYLE_PROMPT}}', stylePrompt);
        const preparedTranscript = prepareTranscriptForPrompt(transcript);
        console.log('[AIService] Transcript chars:', transcript.length, '=> prompt chars:', preparedTranscript.length);

        const userPrompt = `视频标题：${videoTitle}\n\n以下是去重并压缩后的关键字幕片段，请基于这些内容生成结构清晰、信息准确的文章：\n${preparedTranscript}`;

        try {
            const response = await fetchWithTimeout(
                provider.endpoint,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        ...(providerKey === 'openrouter' ? {
                            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                            'X-Title': 'YouTube to XHS Converter',
                        } : {}),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000
                    })
                },
                AI_TIMEOUT_MS
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${provider.name} API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content;

            if (!aiResponse || aiResponse.trim().length === 0) {
                console.error('[AIService] Empty AI response. Full data:', JSON.stringify(data));
                throw new Error(`AI 模型 (${model}) 返回了空响应，请尝试更换其他免费模型（如 Qwen 或 Llama）。`);
            }

            // Parse JSON response
            try {
                let jsonStr = aiResponse;

                // 1. Remove markdown code blocks (```json ... ```)
                const markdownMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (markdownMatch) {
                    jsonStr = markdownMatch[1];
                }

                // 2. Find outermost JSON object
                const firstOpen = jsonStr.indexOf('{');
                const lastClose = jsonStr.lastIndexOf('}');

                if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                    jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
                }

                // 3. Attempt to parse
                console.log('[AIService] Parsing JSON string:', jsonStr.substring(0, 100) + '...');
                const parsed = JSON.parse(jsonStr.trim());

                return buildContentPayload(
                    parsed.title || videoTitle,
                    parsed.content || aiResponse,
                    Array.isArray(parsed.tags) ? parsed.tags : ['#YouTube', '#AI生成']
                );
            } catch (parseError) {
                console.error('[AIService] JSON Parse Error:', parseError);
                console.log('[AIService] Raw AI Response:', aiResponse);

                // If JSON parsing fails, try to use regex to extract fields as fallback
                const titleMatch = aiResponse.match(/"title"\s*:\s*"([^"]*)"/);
                const contentMatch = aiResponse.match(/"content"\s*:\s*"([^"]*)"/); // This might fail for multiline content

                if (titleMatch || contentMatch) {
                    return buildContentPayload(
                        titleMatch ? titleMatch[1] : videoTitle,
                        aiResponse,
                        ['#YouTube', '#AI生成', '#小红书']
                    );
                }

                // Absolute fallback
                return buildContentPayload(
                    videoTitle,
                    aiResponse,
                    ['#YouTube', '#AI生成', '#小红书']
                );
            }

        } catch (error: unknown) {
            console.error('AI generation error:', error);
            // Fallback to mock data with error details
            const errorMessage = error instanceof FetchTimeoutError
                ? `AI 生成超时（>${Math.ceil(AI_TIMEOUT_MS / 1000)}s），当前模型响应较慢，请重试或切换模型。`
                : error instanceof Error
                    ? error.message
                    : '未知错误';

            return buildContentPayload(
                `${videoTitle}`,
                `生成内容时出现错误：${errorMessage}\n\n建议：请在首页尝试切换模型后重试。\n\n视频摘要：\n${transcript.substring(0, 300)}...`,
                ['#YouTube', '#视频摘要', '#错误提示']
            );
        }
    }
}

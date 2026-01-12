import { STYLE_PROMPTS, SYSTEM_PROMPT_TEMPLATE } from '@/lib/constants/prompts';

export class AIService {
    static async generateContent(
        videoTitle: string,
        transcript: string,
        model: string = 'tngtech/deepseek-r1t2-chimera:free',
        style: string = '故事模式'
    ): Promise<{ title: string; content: string; tags: string[] }> {
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            console.warn('OPENROUTER_API_KEY not found, using mock data');
            return {
                title: `[Mock] ${videoTitle}`,
                content: `这是基于视频字幕的摘要。\n\n主要内容：\n${transcript.substring(0, 200)}...`,
                tags: ['#YouTube', '#AI生成', '#小红书']
            };
        }

        // Build prompt based on style
        const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['故事模式'];

        const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{{STYLE_PROMPT}}', stylePrompt);

        const userPrompt = `视频标题：${videoTitle}\n\n视频字幕：\n${transcript}`;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                    'X-Title': 'YouTube to XHS Converter',
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
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content;

            if (!aiResponse) {
                throw new Error('No response from AI model');
            }

            // Parse JSON response
            try {
                // Try to find JSON object boundaries
                const firstOpen = aiResponse.indexOf('{');
                const lastClose = aiResponse.lastIndexOf('}');

                let jsonStr;
                if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                    jsonStr = aiResponse.substring(firstOpen, lastClose + 1);
                } else {
                    jsonStr = aiResponse;
                }

                // Attempt to parse
                const parsed = JSON.parse(jsonStr.trim());

                return {
                    title: parsed.title || videoTitle,
                    content: parsed.content || aiResponse,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : ['#YouTube', '#AI生成']
                };
            } catch (parseError) {
                // If JSON parsing fails, return raw content
                console.warn('Failed to parse AI response as JSON, using raw content');
                return {
                    title: videoTitle,
                    content: aiResponse,
                    tags: ['#YouTube', '#AI生成', '#小红书']
                };
            }

        } catch (error: any) {
            console.error('AI generation error:', error);
            // Fallback to mock data on error
            return {
                title: `${videoTitle}`,
                content: `生成内容时出现错误。\n\n视频摘要：\n${transcript.substring(0, 300)}...`,
                tags: ['#YouTube', '#视频摘要']
            };
        }
    }
}

import { STYLE_PROMPTS, SYSTEM_PROMPT_TEMPLATE } from '@/lib/constants/prompts';
import { DEFAULT_MODEL } from '@/lib/constants/models';

export class AIService {
    static async generateContent(
        videoTitle: string,
        transcript: string,
        model: string = DEFAULT_MODEL,
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

                return {
                    title: parsed.title || videoTitle,
                    content: parsed.content || aiResponse,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : ['#YouTube', '#AI生成']
                };
            } catch (parseError) {
                console.error('[AIService] JSON Parse Error:', parseError);
                console.log('[AIService] Raw AI Response:', aiResponse);

                // If JSON parsing fails, try to use regex to extract fields as fallback
                const titleMatch = aiResponse.match(/"title"\s*:\s*"([^"]*)"/);
                const contentMatch = aiResponse.match(/"content"\s*:\s*"([^"]*)"/); // This might fail for multiline content

                if (titleMatch || contentMatch) {
                    return {
                        title: titleMatch ? titleMatch[1] : videoTitle,
                        content: aiResponse, // It's safer to return full response if content regex fails
                        tags: ['#YouTube', '#AI生成', '#小红书']
                    };
                }

                // Absolute fallback
                return {
                    title: videoTitle,
                    content: aiResponse,
                    tags: ['#YouTube', '#AI生成', '#小红书']
                };
            }

        } catch (error: any) {
            console.error('AI generation error:', error);
            // Fallback to mock data with error details
            return {
                title: `${videoTitle}`,
                content: `生成内容时出现错误：${error.message || '未知错误'}\n\n建议：请在首页尝试选择其他免费模型（如 Qwen 或 GLM）。\n\n视频摘要：\n${transcript.substring(0, 300)}...`,
                tags: ['#YouTube', '#视频摘要', '#错误提示']
            };
        }
    }
}

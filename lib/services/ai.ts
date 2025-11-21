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
        const stylePrompt = style === '故事模式'
            ? '请用生动的故事叙述方式，将视频内容改写成适合小红书的图文内容。注重情节和细节描写，让读者身临其境。'
            : '请用观点分析的方式，将视频内容改写成适合小红书的图文内容。突出核心观点和论证逻辑，条理清晰。';

        const systemPrompt = `你是一位擅长将YouTube视频内容改编成小红书图文的专业写作助手。你的任务是：
1. 分析视频字幕内容
2. 提炼核心信息和亮点
3. 按照指定风格创作小红书笔记
4. 生成吸引人的标题和相关标签

${stylePrompt}

输出格式要求：
- 标题：简洁有力，15-30字，吸引点击
- 正文：结构清晰，使用emoji适当点缀，总字数500-800字
- 标签：3-5个相关话题标签，格式为 #标签名

请严格按照JSON格式返回：
{
  "title": "你的标题",
  "content": "正文内容",
  "tags": ["#标签1", "#标签2", "#标签3"]
}`;

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
                // Try to extract JSON from markdown code blocks if present
                const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) ||
                    aiResponse.match(/```\n([\s\S]*?)\n```/) ||
                    [null, aiResponse];

                const jsonStr = jsonMatch[1] || aiResponse;
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

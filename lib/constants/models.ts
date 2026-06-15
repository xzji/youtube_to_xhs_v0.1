export interface AIModel {
    id: string;
    name: string;
    description: string;
    isFree: boolean;
    provider: 'openrouter' | 'volcengine';
}

export const AI_MODELS: AIModel[] = [
    {
        id: 'ark-code-latest',
        name: 'ark-code-latest',
        description: '火山引擎方舟 Coding Plan，控制台管理模型',
        isFree: false,
        provider: 'volcengine'
    },
    {
        id: 'minimax/minimax-m2.5:free',
        name: 'Minimax: M2.5 (free)',
        description: 'Minimax 最新模型，速度极快',
        isFree: true,
        provider: 'openrouter'
    },
    {
        id: 'google/gemma-4-31b-it:free',
        name: 'Google: Gemma 4 31B (free)',
        description: 'Google 最新模型，速度极快',
        isFree: true,
        provider: 'openrouter'
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air',
        description: '智谱清言最新模型',
        isFree: true,
        provider: 'openrouter'
    }
];

export const DEFAULT_MODEL = 'ark-code-latest';

export function getModelProvider(modelId: string): AIModel['provider'] {
    return AI_MODELS.find((model) => model.id === modelId)?.provider ?? 'openrouter';
}

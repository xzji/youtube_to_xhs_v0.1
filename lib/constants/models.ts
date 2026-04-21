export interface AIModel {
    id: string;
    name: string;
    description: string;
    isFree: boolean;
}

export const AI_MODELS: AIModel[] = [
    {
        id: 'minimax/minimax-m2.5:free',
        name: 'Minimax: M2.5 (free)',
        description: 'Minimax 最新模型，速度极快',
        isFree: true
    },
    {
        id: 'google/gemma-4-31b-it:free',
        name: 'Google: Gemma 4 31B (free)',
        description: 'Google 最新模型，速度极快',
        isFree: true
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air',
        description: '智谱清言最新模型',
        isFree: true
    }
];

export const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';

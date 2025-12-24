import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiKeys {
    openai: string;
    anthropic: string;
    google: string;
    openrouter: string;
}

export type PricingProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

export const MODELS = [
    { id: 'xiaomi/mimo-v2-flash:free', name: 'Xiaomi MiMo V2 (Free)', provider: 'openrouter' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'google' },
    { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'openrouter' },
];

export interface SettingsState {
    apiKeys: ApiKeys;
    defaultModel: string;
    setApiKey: (provider: keyof ApiKeys, key: string) => void;
    setDefaultModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                openai: '',
                anthropic: '',
                google: '',
                openrouter: '',
            },
            defaultModel: 'xiaomi/mimo-v2-flash:free',
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: { ...state.apiKeys, [provider]: key },
                })),
            setDefaultModel: (model) => set({ defaultModel: model }),
        }),
        {
            name: 'spatial-ai-settings',
        }
    )
);

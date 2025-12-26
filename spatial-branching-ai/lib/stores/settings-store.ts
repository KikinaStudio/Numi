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
    { id: 'xiaomi/mimo-v2-flash:free', name: 'Xiaomi MiMo V2 (Free)', provider: 'openrouter', vision: false },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', vision: true },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', vision: true },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', vision: true },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'google', vision: true },
    { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'openrouter', vision: false },
];

export interface SettingsState {
    apiKeys: ApiKeys;
    defaultModel: string;
    theme: 'light' | 'dark';
    userName?: string;
    userId?: string;
    userColor?: string;
    setApiKey: (provider: keyof ApiKeys, key: string) => void;
    setDefaultModel: (model: string) => void;
    setTheme: (theme: 'light' | 'dark') => void;
    setUserName: (name: string) => void;
    setUserDetails: (details: { id?: string, name?: string, color?: string }) => void;
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
            theme: 'dark',
            userName: undefined,
            userId: undefined,
            userColor: undefined,
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: { ...state.apiKeys, [provider]: key },
                })),
            setDefaultModel: (model) => set({ defaultModel: model }),
            setTheme: (theme) => set({ theme }),
            setUserName: (userName) => set({ userName }),
            setUserDetails: (details: { id?: string, name?: string, color?: string }) => set((state) => ({
                userId: details.id ?? state.userId,
                userName: details.name ?? state.userName,
                userColor: details.color ?? state.userColor
            })),
        }),
        {
            name: 'spatial-ai-settings',
        }
    )
);

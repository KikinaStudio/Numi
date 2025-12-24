'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettingsStore, MODELS, ApiKeys } from '@/lib/stores/settings-store';
import { Eye, EyeOff, Check, X, Settings, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { apiKeys, setApiKey, defaultModel, setDefaultModel, theme, setTheme } = useSettingsStore();

    // Local state for masking
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});

    const toggleShowKey = (provider: string) => {
        setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your API keys and default model. Keys are stored locally in your browser.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Default Model Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Default Model
                        </label>
                        <select
                            value={defaultModel}
                            onChange={(e) => setDefaultModel(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {MODELS.map(model => (
                                <option key={model.id} value={model.id} className="bg-popover text-popover-foreground">
                                    {model.name} ({model.provider})
                                </option>
                            ))}
                        </select>
                        <p className="text-[0.8rem] text-muted-foreground">
                            The model used for generating new branches.
                        </p>
                    </div>

                    {/* Theme Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Appearance</label>
                        <div className="flex bg-muted p-1 rounded-lg w-fit gap-1">
                            <Button
                                variant={theme === 'light' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setTheme('light')}
                                className={cn("h-8 px-3 gap-2", theme === 'light' && "shadow-sm bg-background")}
                            >
                                <Sun className="h-4 w-4" />
                                Light
                            </Button>
                            <Button
                                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setTheme('dark')}
                                className={cn("h-8 px-3 gap-2", theme === 'dark' && "shadow-sm bg-background")}
                            >
                                <Moon className="h-4 w-4" />
                                Dark
                            </Button>
                        </div>
                    </div>

                    <div className="border-t" />

                    {/* API keys */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm">API Keys</h4>

                        {/* OpenRouter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">OpenRouter API Key (Recommended)</label>
                            <div className="relative">
                                <Input
                                    type={showKey.openrouter ? "text" : "password"}
                                    value={apiKeys.openrouter}
                                    onChange={(e) => setApiKey('openrouter', e.target.value)}
                                    placeholder="sk-or-..."
                                    className="pr-10 font-mono text-xs"
                                />
                                <button
                                    onClick={() => toggleShowKey('openrouter')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey.openrouter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* OpenAI */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">OpenAI API Key</label>
                            <div className="relative">
                                <Input
                                    type={showKey.openai ? "text" : "password"}
                                    value={apiKeys.openai}
                                    onChange={(e) => setApiKey('openai', e.target.value)}
                                    placeholder="sk-..."
                                    className="pr-10 font-mono text-xs"
                                />
                                <button
                                    onClick={() => toggleShowKey('openai')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Anthropic */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Anthropic API Key</label>
                            <div className="relative">
                                <Input
                                    type={showKey.anthropic ? "text" : "password"}
                                    value={apiKeys.anthropic}
                                    onChange={(e) => setApiKey('anthropic', e.target.value)}
                                    placeholder="sk-ant-..."
                                    className="pr-10 font-mono text-xs"
                                />
                                <button
                                    onClick={() => toggleShowKey('anthropic')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Google */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Google Gemini Key</label>
                            <div className="relative">
                                <Input
                                    type={showKey.google ? "text" : "password"}
                                    value={apiKeys.google}
                                    onChange={(e) => setApiKey('google', e.target.value)}
                                    placeholder="AIza..."
                                    className="pr-10 font-mono text-xs"
                                />
                                <button
                                    onClick={() => toggleShowKey('google')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

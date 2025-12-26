'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettingsStore, MODELS } from '@/lib/stores/settings-store';
import { useCanvasStore } from '@/lib/stores/canvas-store';
import { Eye, EyeOff, Sun, Moon, ChevronRight, ChevronDown, User, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { apiKeys, setApiKey, defaultModel, setDefaultModel, theme, setTheme, userName, setUserName, userId, setUserDetails } = useSettingsStore();

    // Local state for masking and advanced toggle
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Name input state (local to dialog, syncs on blur/enter)
    const [localName, setLocalName] = useState(userName || '');

    // Handle user name updates to store and collaborators
    const updateName = () => {
        if (localName.trim() && localName !== userName) {
            setUserName(localName);
            // Also update for live collaboration immediately
            if (userId) {
                const me = useCanvasStore.getState().me;
                if (me) {
                    const updatedMe = { ...me, name: localName };
                    useCanvasStore.getState().setMe(updatedMe);
                    useCanvasStore.getState().updateCollaborator(userId, updatedMe);
                }
            }
        }
    };

    const toggleShowKey = (provider: string) => {
        setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    // Filter models based on OpenRouter key availability
    // Strict logic: Show ALL only if OpenRouter Key is present. 
    // Otherwise only show Xiaomi MiMo (Free)
    const availableModels = apiKeys.openrouter?.trim()
        ? MODELS
        : MODELS.filter(m => m.id === 'xiaomi/mimo-v2-flash:free');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure your profile, API keys and AI preferences.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* User Profile Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Profile
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <User className="h-4 w-4" />
                            </div>
                            <Input
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                onBlur={updateName}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                placeholder="Enter your name"
                                className="pl-9 font-medium"
                            />
                        </div>
                    </div>

                    <div className="border-t border-border/50" />

                    {/* Data & Privacy (Theme) */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Appearance
                        </label>
                        <div className="flex bg-muted/50 p-1 rounded-lg gap-1">
                            <button
                                onClick={() => setTheme('light')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                                    theme === 'light'
                                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                <Sun className="h-4 w-4" />
                                Light
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                                    theme === 'dark'
                                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                <Moon className="h-4 w-4" />
                                Dark
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-border/50" />

                    {/* API Keys Section */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Intelligence
                        </label>

                        {/* OpenRouter Key (Primary) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">OpenRouter API Key</label>
                                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    Unlocks All Models
                                </span>
                            </div>
                            <div className="relative">
                                <Input
                                    type={showKey.openrouter ? "text" : "password"}
                                    value={apiKeys.openrouter}
                                    onChange={(e) => setApiKey('openrouter', e.target.value)}
                                    placeholder="sk-or-..."
                                    className={cn(
                                        "pr-10 font-mono text-xs shadow-sm transition-all duration-300",
                                        apiKeys.openrouter ? "border-primary/50 ring-primary/20" : ""
                                    )}
                                />
                                <button
                                    onClick={() => toggleShowKey('openrouter')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showKey.openrouter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Required to use premium models like GPT-4o and Claude 3.5.
                            </p>
                        </div>

                        {/* Model Selection (Conditional) */}
                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-medium leading-none">
                                Default Model
                            </label>
                            <select
                                value={availableModels.find(m => m.id === defaultModel) ? defaultModel : availableModels[0].id}
                                onChange={(e) => setDefaultModel(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {availableModels.map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                            {!apiKeys.openrouter?.trim() && (
                                <p className="text-[11px] text-amber-500/90 font-medium flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Add OpenRouter key above to unlock 5+ premium models.
                                </p>
                            )}
                        </div>

                        {/* Advanced Toggle */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors group"
                            >
                                {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                Advanced Settings
                            </button>

                            {/* Advanced Content */}
                            {showAdvanced && (
                                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 pl-4 border-l-2 border-muted">
                                    {/* OpenAI */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">OpenAI API Key (Direct)</label>
                                        <div className="relative">
                                            <Input
                                                type={showKey.openai ? "text" : "password"}
                                                value={apiKeys.openai}
                                                onChange={(e) => setApiKey('openai', e.target.value)}
                                                placeholder="sk-..."
                                                className="pr-10 font-mono text-xs h-8"
                                            />
                                            <button
                                                onClick={() => toggleShowKey('openai')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showKey.openai ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Anthropic */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Anthropic API Key (Direct)</label>
                                        <div className="relative">
                                            <Input
                                                type={showKey.anthropic ? "text" : "password"}
                                                value={apiKeys.anthropic}
                                                onChange={(e) => setApiKey('anthropic', e.target.value)}
                                                placeholder="sk-ant-..."
                                                className="pr-10 font-mono text-xs h-8"
                                            />
                                            <button
                                                onClick={() => toggleShowKey('anthropic')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showKey.anthropic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Google */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Google Gemini Key (Direct)</label>
                                        <div className="relative">
                                            <Input
                                                type={showKey.google ? "text" : "password"}
                                                value={apiKeys.google}
                                                onChange={(e) => setApiKey('google', e.target.value)}
                                                placeholder="AIza..."
                                                className="pr-10 font-mono text-xs h-8"
                                            />
                                            <button
                                                onClick={() => toggleShowKey('google')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showKey.google ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

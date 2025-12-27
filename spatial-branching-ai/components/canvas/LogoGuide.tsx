'use client';

import { useSettingsStore } from '@/lib/stores/settings-store';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from '@/lib/utils';
import { GitBranch, Brain, Zap, Layers, Sparkles } from 'lucide-react';

export function LogoGuide() {
    const theme = useSettingsStore(s => s.theme);

    // Inverted logic: Dark Mode -> Light Card, Light Mode -> Dark Card
    const isDark = theme === 'dark'; // Global Theme
    // Card Style: Invert the global theme
    // If Global is Dark, Card is White/Zinc-50 (Light)
    // If Global is Light, Card is Zinc-950 (Dark)

    return (
        <HoverCard openDelay={0} closeDelay={200}>
            <HoverCardTrigger asChild>
                <div className="flex items-center gap-2 pr-2 border-r border-border cursor-help group">
                    <img
                        src={theme === 'dark' ? "/assets/logo/logo-white-bg.png" : "/assets/logo/logo-black-bg.png"}
                        alt="Numi"
                        className="h-7 w-auto rounded-md shadow-sm transition-transform duration-300 group-hover:scale-105"
                    />
                </div>
            </HoverCardTrigger>
            <HoverCardContent
                side="bottom"
                align="start"
                sideOffset={10}
                className={cn(
                    "w-[380px] p-6 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300",
                    isDark
                        ? "bg-white/95 border-white/20 text-zinc-900" // Light Card on Dark Background
                        : "bg-zinc-950/95 border-zinc-800 text-zinc-50" // Dark Card on Light Background
                )}
            >
                <div className="space-y-6">
                    {/* Header / Logo */}
                    <div className="mb-2">
                        <img
                            src={isDark ? "/assets/logo/numi-text-black.png" : "/assets/logo/numi-text-white.png"}
                            alt="Numi Logo"
                            className="h-8 w-auto"
                        />
                    </div>

                    {/* Mission */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className={cn("h-4 w-4", isDark ? "text-purple-600" : "text-yellow-400")} />
                            <span className="text-xs font-bold uppercase tracking-widest opacity-70">Philosophy</span>
                        </div>
                        <h3 className={cn("text-lg font-bold leading-tight", isDark ? "text-zinc-900" : "text-white")}>
                            Designed for minds that race.
                        </h3>
                        <p className={cn("text-sm leading-relaxed", isDark ? "text-zinc-600" : "text-zinc-400")}>
                            Think in branches, create freely. Numi uses spatial design to match the speed and non-linear nature of your thoughts.
                        </p>
                    </div>

                    <div className={cn("h-px w-full", isDark ? "bg-zinc-100" : "bg-zinc-800")} />

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex gap-3 items-start">
                            <div className={cn("p-2 rounded-lg shrink-0", isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-100")}>
                                <GitBranch className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold mb-0.5">Branching Context</h4>
                                <p className={cn("text-xs opacity-80", isDark ? "text-zinc-600" : "text-zinc-400")}>
                                    Select any text or click a node to branch off a new idea instantly without losing flow.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 items-start">
                            <div className={cn("p-2 rounded-lg shrink-0", isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-100")}>
                                <Layers className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold mb-0.5">Drag & Drop</h4>
                                <p className={cn("text-xs opacity-80", isDark ? "text-zinc-600" : "text-zinc-400")}>
                                    Drop images or PDFs directly onto the canvas to analyze them with vision models.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 items-start">
                            <div className={cn("p-2 rounded-lg shrink-0", isDark ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-100")}>
                                <Brain className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold mb-0.5">Personas</h4>
                                <p className={cn("text-xs opacity-80", isDark ? "text-zinc-600" : "text-zinc-400")}>
                                    Assign specific roles (Expert, Creative, Critic) to different nodes for varied perspectives.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

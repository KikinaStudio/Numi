import { useCanvasStore } from '@/lib/stores/canvas-store';
import { Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DiagnosticsPanel() {
    const { realtimeStatus, lastRealtimeEvent, syncError } = useCanvasStore();

    if (process.env.NODE_ENV === 'production' && realtimeStatus === 'SUBSCRIBED' && !syncError) {
        // Hide in production if everything is fine, or keep it subtle
        // For debugging session, let's keep it visible but small
    }

    return (
        <div className="fixed bottom-3 left-3 z-[100] flex flex-col gap-2 pointer-events-none">
            <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full shadow-md border backdrop-blur-md transition-all duration-300",
                realtimeStatus === 'SUBSCRIBED' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                    realtimeStatus === 'CONNECTING' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                        "bg-red-500/10 border-red-500/20 text-red-500 animate-pulse"
            )}>
                {realtimeStatus === 'SUBSCRIBED' ? <Wifi className="h-4 w-4" /> :
                    realtimeStatus === 'CONNECTING' ? <Activity className="h-4 w-4 animate-spin" /> :
                        <WifiOff className="h-4 w-4" />}
            </div>

            {syncError && (
                <div className="bg-red-950/90 text-red-200 text-[10px] font-mono p-2 rounded-lg max-w-[200px] break-words shadow-2xl animate-in slide-in-from-bottom-2 pointer-events-auto">
                    <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Sync Error
                    </div>
                </div>
            )}
        </div>
    );
}

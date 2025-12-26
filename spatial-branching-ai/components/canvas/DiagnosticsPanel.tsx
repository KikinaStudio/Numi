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
        <div className="fixed bottom-6 left-28 z-50 pointer-events-none">
            <div className={cn(
                "flex items-center justify-center h-6 w-6 rounded-full shadow-lg border backdrop-blur-md transition-all duration-300",
                realtimeStatus === 'SUBSCRIBED' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/10" :
                    realtimeStatus === 'CONNECTING' ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-pulse" :
                        "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse"
            )}>
                {realtimeStatus === 'SUBSCRIBED' ? <Wifi className="h-3 w-3" /> :
                    realtimeStatus === 'CONNECTING' ? <Activity className="h-3 w-3 animate-spin" /> :
                        <WifiOff className="h-3 w-3" />}
            </div>

            {syncError && (
                <div className="absolute bottom-full mb-2 left-0 bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap">
                    {syncError}
                </div>
            )}
        </div>
    );
}

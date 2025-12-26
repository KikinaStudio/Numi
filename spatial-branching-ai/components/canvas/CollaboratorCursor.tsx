import { MousePointer2 } from 'lucide-react';
import { memo } from 'react';

interface CollaboratorCursorProps {
    x: number;
    y: number;
    name: string;
    color: string;
}

export const CollaboratorCursor = memo(({ x, y, name, color }: CollaboratorCursorProps) => {
    return (
        <div
            className="absolute top-0 left-0 pointer-events-none z-[1000] will-change-transform transition-transform duration-100 ease-linear"
            style={{
                transform: `translate(${x}px, ${y}px)`,
            }}
        >
            <MousePointer2
                className="h-5 w-5 fill-current text-white drop-shadow-md"
                style={{ color: color }}
            />
            <div
                className="absolute left-4 top-4 px-2 py-1 rounded-full text-[10px] font-bold text-white whitespace-nowrap shadow-md"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </div>
    );
});

CollaboratorCursor.displayName = 'CollaboratorCursor';

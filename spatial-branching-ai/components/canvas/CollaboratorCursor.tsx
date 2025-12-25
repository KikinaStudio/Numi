'use client';

import { MousePointer2 } from 'lucide-react';
import { memo } from 'react';

interface CollaboratorCursorProps {
    name: string;
    color: string;
    x: number;
    y: number;
}

const CollaboratorCursor = memo(({ name, color, x, y }: CollaboratorCursorProps) => {
    return (
        <div
            className="absolute pointer-events-none z-[9999] transition-all duration-75 ease-out"
            style={{
                left: x,
                top: y,
                color: color,
            }}
        >
            <MousePointer2
                className="h-5 w-5 drop-shadow-md"
                style={{ fill: color }}
            />
            <div
                className="ml-3 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg whitespace-nowrap backdrop-blur-sm border border-white/20"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </div>
    );
});

CollaboratorCursor.displayName = 'CollaboratorCursor';

export default CollaboratorCursor;

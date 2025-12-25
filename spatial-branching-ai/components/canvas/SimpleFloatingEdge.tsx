import React, { useCallback } from 'react';
import { useInternalNode, getBezierPath, EdgeProps } from '@xyflow/react';
import { getEdgeParams } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settings-store';

function SimpleFloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
    const sourceNode = useInternalNode(source);
    const targetNode = useInternalNode(target);
    const { theme } = useSettingsStore();

    if (!sourceNode || !targetNode) {
        return null;
    }

    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

    const [edgePath] = getBezierPath({
        sourceX: sx,
        sourceY: sy,
        sourcePosition: sourcePos,
        targetPosition: targetPos,
        targetX: tx,
        targetY: ty,
    });

    const edgeStyle = {
        stroke: theme === 'dark' ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)',
        strokeWidth: 2,
        ...style
    }

    return (
        <path
            id={id}
            className="react-flow__edge-path"
            d={edgePath}
            markerEnd={markerEnd}
            style={edgeStyle}
        />
    );
}

export default SimpleFloatingEdge;

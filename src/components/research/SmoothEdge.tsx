import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { cn } from '@/lib/utils';

interface SmoothEdgeProps extends EdgeProps {
  data?: {
    label?: string;
    animated?: boolean;
  };
}

export const SmoothEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: SmoothEdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const isAnimated = selected || data?.animated;

  return (
    <>
      {/* Glow effect for selected edges */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          className="react-flow__edge-path"
          style={{
            stroke: 'hsl(var(--primary))',
            strokeWidth: 8,
            opacity: 0.2,
            filter: 'blur(4px)',
          }}
        />
      )}
      
      {/* Main edge path */}
      <path
        id={id}
        className={cn(
          "react-flow__edge-path transition-all duration-200",
          isAnimated && "animate-pulse"
        )}
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? 'hsl(var(--primary))' : style.stroke || 'hsl(var(--muted-foreground) / 0.5)',
          strokeWidth: selected ? 3 : (style.strokeWidth as number) || 2,
          strokeDasharray: isAnimated ? '5,5' : undefined,
        }}
      />

      {/* Interactive hit area */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />

      {/* Label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              "px-2 py-1 rounded-md text-xs font-medium transition-all",
              selected 
                ? "bg-primary text-primary-foreground shadow-lg" 
                : "bg-card/90 text-muted-foreground border border-border shadow-sm"
            )}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

SmoothEdge.displayName = 'SmoothEdge';

import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { cn } from '@/lib/utils';

interface AnimatedEdgeProps extends EdgeProps {
  data?: {
    isGenerating?: boolean;
    isActive?: boolean;
  };
}

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: AnimatedEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isGenerating = data?.isGenerating;
  const isActive = data?.isActive;

  return (
    <>
      {/* Background path for better visibility */}
      <path
        id={`${id}-bg`}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={4}
        stroke="transparent"
        fill="none"
      />
      
      {/* Main edge path */}
      <path
        id={id}
        className={cn(
          "react-flow__edge-path transition-all duration-300",
          isGenerating && "animate-pulse"
        )}
        d={edgePath}
        strokeWidth={isActive || isGenerating ? 3 : 2}
        stroke={
          isGenerating 
            ? "url(#gradient-generating)" 
            : isActive 
              ? "hsl(var(--primary))" 
              : "hsl(var(--muted-foreground))"
        }
        strokeOpacity={isActive || isGenerating ? 1 : 0.5}
        fill="none"
        markerEnd={markerEnd}
        style={style}
      />
      
      {/* Animated flow indicator when generating */}
      {isGenerating && (
        <circle r="4" fill="hsl(var(--primary))">
          <animateMotion dur="1.5s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
      
      {/* SVG Defs for gradient */}
      <defs>
        <linearGradient id="gradient-generating" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3">
            <animate 
              attributeName="offset" 
              values="0;1;0" 
              dur="2s" 
              repeatCount="indefinite" 
            />
          </stop>
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1">
            <animate 
              attributeName="offset" 
              values="0.5;1.5;0.5" 
              dur="2s" 
              repeatCount="indefinite" 
            />
          </stop>
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3">
            <animate 
              attributeName="offset" 
              values="1;2;1" 
              dur="2s" 
              repeatCount="indefinite" 
            />
          </stop>
        </linearGradient>
      </defs>
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);

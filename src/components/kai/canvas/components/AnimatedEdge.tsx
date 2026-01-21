import { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { cn } from '@/lib/utils';

interface AnimatedEdgeProps extends EdgeProps {
  data?: {
    isGenerating?: boolean;
    isActive?: boolean;
    hasData?: boolean;
    status?: 'empty' | 'ready' | 'generating' | 'complete';
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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isGenerating = data?.isGenerating;
  const isActive = data?.isActive;
  const hasData = data?.hasData;
  const status = data?.status || (hasData ? 'ready' : 'empty');

  // Determine edge color based on status
  const getEdgeColor = () => {
    if (isGenerating) return 'url(#gradient-generating)';
    switch (status) {
      case 'complete':
        return 'hsl(142, 76%, 45%)'; // green-500
      case 'ready':
        return 'hsl(217, 91%, 60%)'; // blue-500
      case 'generating':
        return 'hsl(var(--primary))';
      case 'empty':
      default:
        return 'hsl(var(--muted-foreground))';
    }
  };

  // Determine stroke dash array for status
  const getStrokeDash = () => {
    if (status === 'empty') return '5,5';
    return 'none';
  };

  return (
    <>
      {/* Background path for better visibility */}
      <path
        id={`${id}-bg`}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={6}
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
        stroke={getEdgeColor()}
        strokeOpacity={isActive || isGenerating || status === 'ready' || status === 'complete' ? 1 : 0.4}
        strokeDasharray={getStrokeDash()}
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

      {/* Data flow indicator when has data */}
      {(status === 'ready' || status === 'complete') && !isGenerating && (
        <circle r="3" fill={status === 'complete' ? 'hsl(142, 76%, 45%)' : 'hsl(217, 91%, 60%)'} opacity="0.8">
          <animateMotion dur="3s" repeatCount="indefinite">
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

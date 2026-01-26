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
    curvature: 0.4, // More pronounced curve
  });

  const isGenerating = data?.isGenerating;
  const isActive = data?.isActive;
  const hasData = data?.hasData;
  const status = data?.status || (hasData ? 'ready' : 'empty');

  // Determine edge color based on status
  const getEdgeColor = () => {
    if (isGenerating) return 'url(#gradient-generating-' + id + ')';
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
    if (status === 'empty') return '8,6';
    return 'none';
  };

  return (
    <>
      {/* Background path for glow effect */}
      {(isGenerating || status === 'ready' || status === 'complete') && (
        <path
          className="react-flow__edge-path"
          d={edgePath}
          strokeWidth={isGenerating ? 12 : 8}
          stroke={isGenerating ? 'hsl(var(--primary))' : getEdgeColor()}
          strokeOpacity={isGenerating ? 0.15 : 0.1}
          fill="none"
          style={{ filter: 'blur(4px)' }}
        />
      )}
      
      {/* Main edge path */}
      <path
        id={id}
        className={cn(
          "react-flow__edge-path transition-all duration-300",
        )}
        d={edgePath}
        strokeWidth={isActive || isGenerating ? 3 : 2}
        stroke={getEdgeColor()}
        strokeOpacity={isActive || isGenerating || status === 'ready' || status === 'complete' ? 1 : 0.4}
        strokeDasharray={getStrokeDash()}
        strokeLinecap="round"
        fill="none"
        markerEnd={markerEnd}
        style={style}
      />
      
      {/* Multiple animated circles when generating */}
      {isGenerating && (
        <>
          {/* Primary pulse circle */}
          <circle r="5" fill="hsl(var(--primary))">
            <animate
              attributeName="opacity"
              values="1;0.6;1"
              dur="0.8s"
              repeatCount="indefinite"
            />
            <animateMotion dur="1.2s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          {/* Secondary trailing circle */}
          <circle r="3" fill="hsl(var(--primary))" opacity="0.6">
            <animateMotion dur="1.2s" repeatCount="indefinite" begin="0.4s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          {/* Tertiary faint circle */}
          <circle r="2" fill="hsl(var(--primary))" opacity="0.3">
            <animateMotion dur="1.2s" repeatCount="indefinite" begin="0.8s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
        </>
      )}

      {/* Data flow indicator when has data (not generating) */}
      {(status === 'ready' || status === 'complete') && !isGenerating && (
        <circle 
          r="3" 
          fill={status === 'complete' ? 'hsl(142, 76%, 45%)' : 'hsl(217, 91%, 60%)'} 
          opacity="0.8"
        >
          <animateMotion dur="3s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
      
      {/* SVG Defs for animated gradient */}
      <defs>
        <linearGradient id={`gradient-generating-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4">
            <animate 
              attributeName="offset" 
              values="-0.5;1.5" 
              dur="1.5s" 
              repeatCount="indefinite" 
            />
          </stop>
          <stop offset="25%" stopColor="hsl(var(--primary))" stopOpacity="1">
            <animate 
              attributeName="offset" 
              values="-0.25;1.75" 
              dur="1.5s" 
              repeatCount="indefinite" 
            />
          </stop>
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.4">
            <animate 
              attributeName="offset" 
              values="0;2" 
              dur="1.5s" 
              repeatCount="indefinite" 
            />
          </stop>
        </linearGradient>
      </defs>
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);

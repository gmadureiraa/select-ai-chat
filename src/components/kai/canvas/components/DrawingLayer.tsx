import { memo, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface DrawingStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  createdAt: string;
}

interface DrawingLayerProps {
  strokes: DrawingStroke[];
  isDrawing: boolean;
  isErasing: boolean;
  brushColor: string;
  brushSize: number;
  viewport: { x: number; y: number; zoom: number };
  onAddStroke: (stroke: DrawingStroke) => void;
  onDeleteStroke: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

function DrawingLayerComponent({
  strokes,
  isDrawing,
  isErasing,
  brushColor,
  brushSize,
  viewport,
  onAddStroke,
  onDeleteStroke,
  containerRef,
}: DrawingLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }> | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport, containerRef]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing && !isErasing) return;

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsPressing(true);

      if (isDrawing) {
        const point = screenToCanvas(e.clientX, e.clientY);
        setCurrentStroke([point]);
      }
    },
    [isDrawing, isErasing, screenToCanvas]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing) return;

      e.preventDefault();
      e.stopPropagation();

      const point = screenToCanvas(e.clientX, e.clientY);

      if (isDrawing && currentStroke) {
        setCurrentStroke((prev) => [...(prev || []), point]);
      }

      // Drag-to-erase: check if pointer is near any stroke
      if (isErasing) {
        const eraserRadius = brushSize * 3;
        for (const stroke of strokes) {
          for (const pt of stroke.points) {
            const screenPt = {
              x: pt.x * viewport.zoom + viewport.x,
              y: pt.y * viewport.zoom + viewport.y,
            };
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) continue;
            
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const dist = Math.sqrt(
              Math.pow(screenPt.x - screenX, 2) + Math.pow(screenPt.y - screenY, 2)
            );
            if (dist < eraserRadius) {
              onDeleteStroke(stroke.id);
              break;
            }
          }
        }
      }
    },
    [isPressing, isDrawing, isErasing, currentStroke, screenToCanvas, strokes, viewport, brushSize, onDeleteStroke, containerRef]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsPressing(false);

      if (isDrawing && currentStroke && currentStroke.length > 1) {
        const newStroke: DrawingStroke = {
          id: `stroke-${Date.now()}`,
          points: currentStroke,
          color: brushColor,
          width: brushSize,
          createdAt: new Date().toISOString(),
        };
        onAddStroke(newStroke);
      }
      setCurrentStroke(null);
    },
    [isPressing, isDrawing, currentStroke, brushColor, brushSize, onAddStroke]
  );

  const handleStrokeClick = useCallback(
    (strokeId: string, e: React.MouseEvent) => {
      if (!isErasing) return;
      e.preventDefault();
      e.stopPropagation();
      onDeleteStroke(strokeId);
    },
    [isErasing, onDeleteStroke]
  );

  // Create SVG path from points with smoothing
  const createPath = useCallback((points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return "";

    let path = `M ${points[0].x} ${points[0].y}`;

    if (points.length === 2) {
      path += ` L ${points[1].x} ${points[1].y}`;
      return path;
    }

    // Use quadratic bezier curves for smooth lines
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      path += ` Q ${p1.x} ${p1.y} ${midX} ${midY}`;
    }

    // Add the last point
    const lastPoint = points[points.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;

    return path;
  }, []);

  // Handle pointer leave
  const handlePointerLeave = useCallback(() => {
    if (isPressing && isDrawing && currentStroke && currentStroke.length > 1) {
      const newStroke: DrawingStroke = {
        id: `stroke-${Date.now()}`,
        points: currentStroke,
        color: brushColor,
        width: brushSize,
        createdAt: new Date().toISOString(),
      };
      onAddStroke(newStroke);
    }
    setIsPressing(false);
    setCurrentStroke(null);
  }, [isPressing, isDrawing, currentStroke, brushColor, brushSize, onAddStroke]);

  // Don't render if not drawing/erasing and no strokes
  if (!isDrawing && !isErasing && strokes.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className={cn(
        "absolute inset-0 pointer-events-none",
        (isDrawing || isErasing) && "pointer-events-auto z-50",
        isDrawing && "cursor-crosshair",
        isErasing && "cursor-cell"
      )}
      style={{
        width: "100%",
        height: "100%",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <g
        transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
      >
        {/* Existing strokes */}
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={createPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width / viewport.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "transition-opacity",
              isErasing && "cursor-cell hover:opacity-30"
            )}
            onClick={(e) => handleStrokeClick(stroke.id, e)}
            style={{ 
              pointerEvents: isErasing ? "stroke" : "none",
              strokeWidth: isErasing ? Math.max(stroke.width / viewport.zoom, 8) : stroke.width / viewport.zoom,
            }}
          />
        ))}

        {/* Current stroke being drawn */}
        {currentStroke && currentStroke.length > 0 && (
          <path
            d={createPath(currentStroke)}
            fill="none"
            stroke={brushColor}
            strokeWidth={brushSize / viewport.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}
      </g>

      {/* Eraser cursor indicator */}
      {isErasing && isPressing && (
        <circle
          cx="50%"
          cy="50%"
          r={brushSize * 2}
          fill="none"
          stroke="rgba(239, 68, 68, 0.5)"
          strokeWidth={2}
          strokeDasharray="4 4"
          className="pointer-events-none"
          style={{ display: "none" }}
        />
      )}
    </svg>
  );
}

export const DrawingLayer = memo(DrawingLayerComponent);

import { memo, useRef, useState, useCallback, useEffect } from "react";
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
}: DrawingLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }> | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing && !isErasing) return;

      e.preventDefault();
      e.stopPropagation();
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
      if (!isDrawing && !isErasing) return;

      e.preventDefault();
      e.stopPropagation();

      const point = screenToCanvas(e.clientX, e.clientY);

      if (isDrawing && currentStroke) {
        setCurrentStroke((prev) => [...(prev || []), point]);
      }
    },
    [isPressing, isDrawing, isErasing, currentStroke, screenToCanvas]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing) return;
      e.preventDefault();
      e.stopPropagation();
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
      const p0 = points[i - 1];
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

  if (!isDrawing && !isErasing && strokes.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className={cn(
        "absolute inset-0 pointer-events-none",
        (isDrawing || isErasing) && "pointer-events-auto z-10",
        isDrawing && "cursor-crosshair",
        isErasing && "cursor-pointer"
      )}
      style={{
        width: "100%",
        height: "100%",
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
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "transition-opacity",
              isErasing && "cursor-pointer hover:opacity-50"
            )}
            onClick={(e) => handleStrokeClick(stroke.id, e)}
            style={{ pointerEvents: isErasing ? "stroke" : "none" }}
          />
        ))}

        {/* Current stroke being drawn */}
        {currentStroke && currentStroke.length > 0 && (
          <path
            d={createPath(currentStroke)}
            fill="none"
            stroke={brushColor}
            strokeWidth={brushSize}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}
      </g>
    </svg>
  );
}

export const DrawingLayer = memo(DrawingLayerComponent);

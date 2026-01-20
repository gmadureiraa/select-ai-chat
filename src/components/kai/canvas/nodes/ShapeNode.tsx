import { memo, useState, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShapeType = "rectangle" | "circle" | "diamond" | "arrow";

export interface ShapeNodeData {
  type: "shape";
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  width: number;
  height: number;
  label?: string;
}

interface ShapeNodeProps extends NodeProps<ShapeNodeData> {
  onUpdateData: (id: string, data: Partial<ShapeNodeData>) => void;
  onDelete: (id: string) => void;
}

const FILL_COLORS = [
  "transparent",
  "#fef3c7", // yellow
  "#dbeafe", // blue
  "#dcfce7", // green
  "#fce7f3", // pink
  "#f3e8ff", // purple
];

const STROKE_COLORS = [
  "#1f2937", // gray-800
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f97316", // orange
  "#8b5cf6", // purple
];

function ShapeNodeComponent({ id, data, selected, onUpdateData, onDelete }: ShapeNodeProps) {
  const [showControls, setShowControls] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
  }, []);

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateData(id, { label: e.target.value });
    },
    [id, onUpdateData]
  );

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setIsEditingLabel(false);
    }
    e.stopPropagation();
  }, []);

  const cycleFill = useCallback(() => {
    const currentIndex = FILL_COLORS.indexOf(data.fill);
    const nextIndex = (currentIndex + 1) % FILL_COLORS.length;
    onUpdateData(id, { fill: FILL_COLORS[nextIndex] });
  }, [id, data.fill, onUpdateData]);

  const cycleStroke = useCallback(() => {
    const currentIndex = STROKE_COLORS.indexOf(data.stroke);
    const nextIndex = (currentIndex + 1) % STROKE_COLORS.length;
    onUpdateData(id, { stroke: STROKE_COLORS[nextIndex] });
  }, [id, data.stroke, onUpdateData]);

  const renderShape = () => {
    const { width = 100, height = 100, fill, stroke, strokeWidth, shapeType } = data;

    switch (shapeType) {
      case "circle":
        return (
          <svg width={width} height={height} className="overflow-visible">
            <ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width / 2 - strokeWidth}
              ry={height / 2 - strokeWidth}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "diamond":
        return (
          <svg width={width} height={height} className="overflow-visible">
            <polygon
              points={`${width / 2},${strokeWidth} ${width - strokeWidth},${height / 2} ${width / 2},${height - strokeWidth} ${strokeWidth},${height / 2}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "arrow":
        const arrowWidth = width * 0.3;
        const arrowHeight = height * 0.4;
        return (
          <svg width={width} height={height} className="overflow-visible">
            <polygon
              points={`
                ${strokeWidth},${height / 2 - arrowHeight / 2}
                ${width - arrowWidth},${height / 2 - arrowHeight / 2}
                ${width - arrowWidth},${strokeWidth}
                ${width - strokeWidth},${height / 2}
                ${width - arrowWidth},${height - strokeWidth}
                ${width - arrowWidth},${height / 2 + arrowHeight / 2}
                ${strokeWidth},${height / 2 + arrowHeight / 2}
              `}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "rectangle":
      default:
        return (
          <svg width={width} height={height} className="overflow-visible">
            <rect
              x={strokeWidth / 2}
              y={strokeWidth / 2}
              width={width - strokeWidth}
              height={height - strokeWidth}
              rx={4}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        "group relative",
        selected && "ring-2 ring-primary ring-offset-2 rounded"
      )}
      style={{ width: data.width || 100, height: data.height || 100 }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />

      {/* Controls */}
      {(showControls || selected) && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border shadow-lg rounded-lg p-1 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={cycleFill}
            title="Mudar preenchimento"
          >
            <div
              className="w-3 h-3 rounded border border-foreground/20"
              style={{ backgroundColor: data.fill === "transparent" ? "white" : data.fill }}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={cycleStroke}
            title="Mudar contorno"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.stroke }}
            />
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(id)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      )}

      {/* Shape */}
      {renderShape()}

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onDoubleClick={handleLabelDoubleClick}
      >
        {isEditingLabel ? (
          <input
            type="text"
            value={data.label || ""}
            onChange={handleLabelChange}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            className="bg-transparent text-center text-sm outline-none border-b border-primary max-w-[80%]"
            autoFocus
          />
        ) : (
          <span className="text-sm text-center max-w-[80%] truncate cursor-text">
            {data.label}
          </span>
        )}
      </div>
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);

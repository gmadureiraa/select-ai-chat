import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Rss } from "lucide-react";

interface RSSNodeData {
  label: string;
  config?: {
    rss_url?: string;
  };
}

export const RSSNode = memo(({ data, selected }: NodeProps<RSSNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-orange-500 shadow-orange-500/20 shadow-lg" : "border-orange-200"}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-orange-500">
          <Rss className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "RSS Feed"}</span>
      </div>
      
      {data.config?.rss_url && (
        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
          {data.config.rss_url}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
    </div>
  );
});

RSSNode.displayName = "RSSNode";

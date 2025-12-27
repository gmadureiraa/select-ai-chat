import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Send, Twitter, Linkedin, Instagram } from "lucide-react";

interface PublishNodeData {
  label: string;
  config?: {
    publish_platform?: 'twitter' | 'linkedin' | 'instagram';
    publish_mode?: 'direct' | 'draft';
  };
}

const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
};

export const PublishNode = memo(({ data, selected }: NodeProps<PublishNodeData>) => {
  const platform = data.config?.publish_platform;
  const PlatformIcon = platform ? platformIcons[platform] : Send;

  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] rounded-xl border-2 bg-card shadow-sm
        ${selected ? "border-pink-500 shadow-pink-500/20 shadow-lg" : "border-pink-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-pink-500">
          <PlatformIcon className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{data.label || "Publicar"}</span>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {platform && (
          <span className="capitalize">{platform}</span>
        )}
        {data.config?.publish_mode && (
          <span className="px-1.5 py-0.5 rounded bg-muted">
            {data.config.publish_mode === 'draft' ? 'Rascunho' : 'Direto'}
          </span>
        )}
      </div>
    </div>
  );
});

PublishNode.displayName = "PublishNode";

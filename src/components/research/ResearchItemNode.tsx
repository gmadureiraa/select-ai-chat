import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, Youtube, FileText, Link as LinkIcon, Image as ImageIcon, Music, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResearchItem } from "@/hooks/useResearchItems";

interface ResearchItemNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
}

export const ResearchItemNode = memo(({ data }: NodeProps<ResearchItemNodeData>) => {
  const { item, onDelete } = data;

  const getIcon = () => {
    switch (item.type) {
      case "note": return <FileText className="h-4 w-4 text-yellow-600" />;
      case "youtube": return <Youtube className="h-4 w-4 text-red-600" />;
      case "text": return <FileText className="h-4 w-4 text-blue-600" />;
      case "link": return <LinkIcon className="h-4 w-4 text-green-600" />;
      case "image": return <ImageIcon className="h-4 w-4 text-purple-600" />;
      case "audio": return <Music className="h-4 w-4 text-pink-600" />;
      case "pdf": return <FileType className="h-4 w-4 text-orange-600" />;
      case "ai_chat": return <FileText className="h-4 w-4 text-purple-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case "note": return "Nota";
      case "youtube": return "YouTube";
      case "text": return "Texto";
      case "link": return "Link";
      case "image": return "Imagem";
      case "audio": return "Áudio";
      case "pdf": return "PDF";
      case "ai_chat": return "Chat IA";
      default: return item.type;
    }
  };

  const getBorderColor = () => {
    switch (item.type) {
      case "note": return "border-yellow-200";
      case "youtube": return "border-red-200";
      case "text": return "border-blue-200";
      case "link": return "border-green-200";
      case "image": return "border-purple-200";
      case "audio": return "border-pink-200";
      case "pdf": return "border-orange-200";
      case "ai_chat": return "border-purple-300";
      default: return "border-gray-200";
    }
  };

  return (
    <div className={`bg-white border-2 ${getBorderColor()} rounded-xl shadow-lg hover:shadow-xl transition-shadow p-4 min-w-[280px] max-w-[320px] group relative`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Left} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-gray-400" />

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-red-50 hover:text-red-600"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium mb-2">
            {getTypeLabel()}
          </div>
          {item.processed && (
            <div className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium ml-2">
              Processado
            </div>
          )}
          <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">
            {item.title || "Sem título"}
          </h3>
        </div>
      </div>

      {item.thumbnail_url && (
        <img
          src={item.thumbnail_url}
          alt={item.title || "Thumbnail"}
          className="w-full h-32 object-cover rounded-lg mb-3 border border-gray-200"
        />
      )}

      {item.content && (
        <p className="text-xs text-gray-600 line-clamp-3 mb-3 leading-relaxed">
          {item.content}
        </p>
      )}

      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline block truncate font-medium"
        >
          {item.source_url}
        </a>
      )}
    </div>
  );
});

ResearchItemNode.displayName = "ResearchItemNode";

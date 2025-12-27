import { memo } from "react";
import { NodeProps } from "reactflow";
import { FileText } from "lucide-react";

interface NoteNodeData {
  label: string;
  config?: {
    note_content?: string;
  };
}

export const NoteNode = memo(({ data, selected }: NodeProps<NoteNodeData>) => {
  return (
    <div
      className={`
        relative px-4 py-3 min-w-[180px] max-w-[250px] rounded-xl border-2 bg-yellow-50 shadow-sm
        ${selected ? "border-yellow-500 shadow-yellow-500/20 shadow-lg" : "border-yellow-200"}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-yellow-500">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm text-yellow-800">{data.label || "Nota"}</span>
      </div>
      
      {data.config?.note_content && (
        <div className="text-xs text-yellow-700 line-clamp-3">
          {data.config.note_content}
        </div>
      )}
    </div>
  );
});

NoteNode.displayName = "NoteNode";

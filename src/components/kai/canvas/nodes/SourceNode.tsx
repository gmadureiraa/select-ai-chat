import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Link2, FileText, Upload, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SourceNodeData } from "../hooks/useCanvasState";

interface SourceNodeProps extends NodeProps<SourceNodeData> {
  onExtractUrl?: (nodeId: string, url: string) => void;
  onUpdateData?: (nodeId: string, data: Partial<SourceNodeData>) => void;
  onDelete?: (nodeId: string) => void;
}

function SourceNodeComponent({ 
  id, 
  data, 
  selected,
  onExtractUrl,
  onUpdateData,
  onDelete 
}: SourceNodeProps) {
  const [localUrl, setLocalUrl] = useState(data.value || "");
  const [localText, setLocalText] = useState(data.value || "");

  const handleExtract = () => {
    if (localUrl.trim() && onExtractUrl) {
      onExtractUrl(id, localUrl.trim());
      onUpdateData?.(id, { value: localUrl.trim(), sourceType: "url" });
    }
  };

  const handleTextChange = (text: string) => {
    setLocalText(text);
    onUpdateData?.(id, { value: text, sourceType: "text", extractedContent: text });
  };

  const handleTabChange = (tab: string) => {
    onUpdateData?.(id, { sourceType: tab as "url" | "text" | "file" });
  };

  return (
    <Card className={cn(
      "w-[320px] shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-blue-500/50",
      "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-blue-500 flex items-center justify-center">
            <Link2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Fonte</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-3">
        <Tabs 
          value={data.sourceType} 
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="url" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              URL
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="file" className="text-xs gap-1">
              <Upload className="h-3 w-3" />
              Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-2 space-y-2">
            <div className="flex gap-1.5">
              <Input
                placeholder="Cole a URL aqui..."
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="h-8 text-xs"
                disabled={data.isExtracting}
              />
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={handleExtract}
                disabled={!localUrl.trim() || data.isExtracting}
              >
                {data.isExtracting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {data.extractedContent && (
              <div className="p-2 rounded-md bg-muted/50 max-h-[100px] overflow-y-auto">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">
                  {data.title || "Conteúdo extraído"}
                </p>
                <p className="text-[10px] line-clamp-4">
                  {data.extractedContent.substring(0, 300)}...
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="mt-2">
            <Textarea
              placeholder="Cole ou digite o texto aqui..."
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[80px] text-xs resize-none"
              rows={4}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-2">
            <div className="border-2 border-dashed rounded-md p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                Arraste ou clique para upload
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const SourceNode = memo(SourceNodeComponent);

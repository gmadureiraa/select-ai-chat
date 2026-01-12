import { memo, useState, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Link2, FileText, Upload, Loader2, Check, X, Youtube, FileAudio, FileImage, Trash2, Eye, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SourceNodeData, SourceFile } from "../hooks/useCanvasState";

interface SourceNodeProps extends NodeProps<SourceNodeData> {
  onExtractUrl?: (nodeId: string, url: string) => void;
  onUpdateData?: (nodeId: string, data: Partial<SourceNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onTranscribeFile?: (nodeId: string, fileId: string) => void;
  onAnalyzeStyle?: (nodeId: string, fileId: string) => void;
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function getFileType(file: File): "image" | "audio" | "video" | "document" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function SourceNodeComponent({ 
  id, 
  data, 
  selected,
  onExtractUrl,
  onUpdateData,
  onDelete,
  onTranscribeFile,
  onAnalyzeStyle
}: SourceNodeProps) {
  const [localUrl, setLocalUrl] = useState(data.value || "");
  const [localText, setLocalText] = useState(data.value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExtract = () => {
    if (localUrl.trim() && onExtractUrl) {
      const urlType = isYoutubeUrl(localUrl) ? "youtube" : "article";
      onUpdateData?.(id, { value: localUrl.trim(), sourceType: "url", urlType });
      onExtractUrl(id, localUrl.trim());
    }
  };

  const handleTextChange = (text: string) => {
    setLocalText(text);
    onUpdateData?.(id, { value: text, sourceType: "text", extractedContent: text });
  };

  const handleTabChange = (tab: string) => {
    onUpdateData?.(id, { sourceType: tab as "url" | "text" | "file" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: SourceFile[] = [];

    for (const file of Array.from(selectedFiles)) {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileType = getFileType(file);
      
      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push({
        id: fileId,
        name: file.name,
        type: fileType,
        mimeType: file.type,
        size: file.size,
        url,
        isProcessing: false,
      });
    }

    const existingFiles = data.files || [];
    onUpdateData?.(id, { 
      sourceType: "file",
      files: [...existingFiles, ...newFiles] 
    });
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = (data.files || []).filter(f => f.id !== fileId);
    onUpdateData?.(id, { files: updatedFiles });
  };

  const handleTranscribe = (fileId: string) => {
    onTranscribeFile?.(id, fileId);
  };

  const handleAnalyzeStyle = (fileId: string) => {
    onAnalyzeStyle?.(id, fileId);
  };

  const isYoutube = data.urlType === "youtube" || (localUrl && isYoutubeUrl(localUrl));

  return (
    <Card className={cn(
      "w-[340px] shadow-lg transition-all border-2",
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
              <div className="relative flex-1">
                <Input
                  placeholder="Cole a URL aqui..."
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  className={cn(
                    "h-8 text-xs pr-8",
                    isYoutube && "border-red-500/50"
                  )}
                  disabled={data.isExtracting}
                />
                {isYoutube && (
                  <Youtube className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>
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
            
            {data.urlType && (
              <Badge variant="secondary" className="text-[10px]">
                {data.urlType === "youtube" ? "🎬 YouTube - Transcrição" : "📄 Artigo"}
              </Badge>
            )}

            {data.thumbnail && (
              <img 
                src={data.thumbnail} 
                alt="Thumbnail" 
                className="w-full h-20 object-cover rounded-md"
              />
            )}

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

          <TabsContent value="file" className="mt-2 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.docx,.doc,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div 
              className="border-2 border-dashed rounded-md p-3 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                Arraste ou clique para upload
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Imagens, áudio, vídeo, PDF, DOCX
              </p>
            </div>

            {data.files && data.files.length > 0 && (
              <ScrollArea className="max-h-[150px]">
                <div className="space-y-1.5">
                  {data.files.map((file) => (
                    <div 
                      key={file.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
                    >
                      {file.type === "image" && (
                        <FileImage className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      )}
                      {file.type === "audio" && (
                        <FileAudio className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {file.type === "video" && (
                        <FileAudio className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      {file.type === "document" && (
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] truncate font-medium">{file.name}</p>
                        {file.transcription && (
                          <p className="text-[9px] text-green-600 dark:text-green-400">
                            ✓ Transcrito
                          </p>
                        )}
                        {file.styleAnalysis && (
                          <p className="text-[9px] text-purple-600 dark:text-purple-400">
                            ✓ Estilo analisado
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(file.type === "audio" || file.type === "video") && !file.transcription && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleTranscribe(file.id)}
                            disabled={file.isProcessing}
                            title="Transcrever"
                          >
                            {file.isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        
                        {file.type === "image" && !file.styleAnalysis && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleAnalyzeStyle(file.id)}
                            disabled={file.isProcessing}
                            title="Analisar estilo"
                          >
                            {file.isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-destructive"
                          onClick={() => handleRemoveFile(file.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
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

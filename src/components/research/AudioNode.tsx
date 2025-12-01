import { memo, useState, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, Mic, Square, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useResearchItems } from "@/hooks/useResearchItems";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AudioNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
}

export const AudioNode = memo(({ data }: NodeProps<AudioNodeData>) => {
  const { item, onDelete, projectId } = data;
  const { updateItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState(item.title || "");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());

        // Transcrever o áudio
        setIsTranscribing(true);
        try {
          // Converter blob para base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: base64Audio }
            });

            if (error) throw error;

            // Salvar áudio com transcrição
            updateItem.mutate({
              id: item.id,
              title: title || `Áudio ${new Date().toLocaleString()}`,
              content: audioUrl,
              metadata: { 
                duration: recordingTime,
                transcript: data.text 
              },
              processed: true,
            });

            toast({ title: "Áudio transcrito com sucesso" });
          };
        } catch (error: any) {
          console.error('Erro ao transcrever:', error);
          toast({
            title: "Erro na transcrição",
            description: error.message,
            variant: "destructive",
          });
          // Salvar sem transcrição
          updateItem.mutate({
            id: item.id,
            title: title || `Áudio ${new Date().toLocaleString()}`,
            content: audioUrl,
            metadata: { duration: recordingTime },
          });
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({ title: "Gravação iniciada" });
    } catch (error) {
      toast({
        title: "Erro ao acessar microfone",
        description: "Permissão negada ou microfone não disponível",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      toast({ title: "Gravação finalizada" });
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(item.content || '');
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border-2 border-pink-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-4 min-w-[300px] max-w-[320px] group relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Left} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-gray-400" />

      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-8 px-2 rounded-full border-red-200 text-red-600 bg-red-50/80 hover:bg-red-100 hover:text-red-700 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2.5 bg-pink-50 rounded-lg border border-pink-200">
          <Mic className="h-4 w-4 text-pink-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center px-2 py-1 rounded-md bg-pink-100 text-pink-700 text-xs font-medium mb-2">
            Áudio
          </div>
        </div>
      </div>

      {!item.content ? (
        <div className="space-y-3">
          <Input
            placeholder="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
          />
          
          {isRecording ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-lg font-mono font-semibold">{formatTime(recordingTime)}</span>
              </div>
              <Button onClick={stopRecording} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-1" />
                Parar Gravação
              </Button>
            </div>
          ) : (
            <Button onClick={startRecording} className="w-full" variant="outline">
              <Mic className="h-4 w-4 mr-2" />
              Iniciar Gravação
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">
            {item.title || "Gravação de áudio"}
          </h3>
          
          {isTranscribing ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Transcrevendo áudio...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button onClick={togglePlayback} size="sm" variant="outline">
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1 h-1 bg-pink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500 w-0 animate-pulse" />
                </div>
              </div>
              {item.metadata?.duration && (
                <p className="text-xs text-gray-500">
                  Duração: {formatTime(item.metadata.duration as number)}
                </p>
              )}
              {item.metadata?.transcript && (
                <div className="mt-3 pt-3 border-t border-pink-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Transcrição:</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {item.metadata.transcript as string}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

AudioNode.displayName = "AudioNode";

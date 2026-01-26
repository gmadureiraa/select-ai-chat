import { useState, useCallback, useEffect, useRef } from "react";
import { Node, Edge } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CanvasNodeData, SavedCanvas } from "./useCanvasState";

interface UseCanvasPersistenceProps {
  clientId: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<CanvasNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useCanvasPersistence({
  clientId,
  nodes,
  edges,
  setNodes,
  setEdges
}: UseCanvasPersistenceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [currentCanvasName, setCurrentCanvasName] = useState<string>("Novo Canvas");
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const autoLoadAttemptedRef = useRef(false);
  const previousClientIdRef = useRef<string | null>(null);

  // Detect client change and reset canvas
  useEffect(() => {
    if (previousClientIdRef.current && previousClientIdRef.current !== clientId) {
      console.log(`[useCanvasPersistence] Client changed: ${previousClientIdRef.current} -> ${clientId}`);
      
      // Reset canvas state
      setNodes([]);
      setEdges([]);
      setCurrentCanvasId(null);
      setCurrentCanvasName("Novo Canvas");
      lastSavedRef.current = '';
      autoLoadAttemptedRef.current = false;
    }
    
    previousClientIdRef.current = clientId;
  }, [clientId, setNodes, setEdges]);

  // Fetch saved canvases for this client
  const { data: savedCanvases = [], isLoading: isLoadingCanvases } = useQuery({
    queryKey: ['content-canvas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as SavedCanvas[];
    },
    enabled: !!clientId
  });

  // Auto-load the last used canvas when entering the canvas tab
  useEffect(() => {
    if (
      !isLoadingCanvases && 
      savedCanvases.length > 0 && 
      nodes.length === 0 && 
      edges.length === 0 && 
      !currentCanvasId &&
      !autoLoadAttemptedRef.current
    ) {
      autoLoadAttemptedRef.current = true;
      
      const lastCanvasKey = `lastCanvas_${clientId}`;
      const lastCanvasId = localStorage.getItem(lastCanvasKey);
      
      const canvasToLoad = lastCanvasId 
        ? savedCanvases.find(c => c.id === lastCanvasId) || savedCanvases[0]
        : savedCanvases[0];
      
      if (canvasToLoad) {
        console.log(`[useCanvasPersistence] Auto-loading last canvas: ${canvasToLoad.name}`);
        setNodes((canvasToLoad.nodes as any) || []);
        setEdges((canvasToLoad.edges as any) || []);
        setCurrentCanvasId(canvasToLoad.id);
        setCurrentCanvasName(canvasToLoad.name);
        lastSavedRef.current = JSON.stringify({ 
          nodes: canvasToLoad.nodes, 
          edges: canvasToLoad.edges, 
          currentCanvasName: canvasToLoad.name 
        });
      }
    }
  }, [isLoadingCanvases, savedCanvases, nodes.length, edges.length, currentCanvasId, clientId, setNodes, setEdges]);

  // Save last used canvas to localStorage
  useEffect(() => {
    if (currentCanvasId && clientId) {
      const lastCanvasKey = `lastCanvas_${clientId}`;
      localStorage.setItem(lastCanvasKey, currentCanvasId);
    }
  }, [currentCanvasId, clientId]);

  // Save canvas
  const saveCanvas = useCallback(async (name?: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: client } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", clientId)
        .single();

      if (!client) throw new Error("Cliente não encontrado");

      const canvasData = {
        id: currentCanvasId || undefined,
        client_id: clientId,
        workspace_id: client.workspace_id,
        user_id: user.id,
        name: name || currentCanvasName || `Canvas ${new Date().toLocaleDateString("pt-BR")}`,
        nodes: nodes as any,
        edges: edges as any,
      };

      const { data, error } = await supabase
        .from('content_canvas')
        .upsert(canvasData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
        queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });
      }

      toast({
        title: "Canvas salvo",
        description: `"${data?.name}" foi salvo com sucesso`,
      });

      return data as unknown as SavedCanvas;
    } catch (error) {
      console.error("Error saving canvas:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o canvas",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, currentCanvasId, currentCanvasName, clientId, queryClient, toast]);

  // Load canvas
  const loadCanvas = useCallback(async (canvasId: string) => {
    try {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('id', canvasId)
        .single();

      if (error) throw error;

      if (data) {
        setNodes((data.nodes as any) || []);
        setEdges((data.edges as any) || []);
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
      }

      toast({
        title: "Canvas carregado",
        description: `"${data?.name}" foi carregado`,
      });
    } catch (error) {
      console.error("Error loading canvas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar o canvas",
        variant: "destructive",
      });
    }
  }, [setNodes, setEdges, toast]);

  // Delete canvas
  const deleteCanvas = useCallback(async (canvasId: string) => {
    try {
      const { error } = await supabase
        .from('content_canvas')
        .delete()
        .eq('id', canvasId);

      if (error) throw error;

      if (currentCanvasId === canvasId) {
        setCurrentCanvasId(null);
        setCurrentCanvasName("Novo Canvas");
        setNodes([]);
        setEdges([]);
      }

      queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });

      toast({
        title: "Canvas excluído",
        description: "O canvas foi removido",
      });
    } catch (error) {
      console.error("Error deleting canvas:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o canvas",
        variant: "destructive",
      });
    }
  }, [currentCanvasId, clientId, queryClient, setNodes, setEdges, toast]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCurrentCanvasId(null);
    setCurrentCanvasName("Novo Canvas");
  }, [setNodes, setEdges]);

  const setCanvasName = useCallback((name: string) => {
    setCurrentCanvasName(name);
  }, []);

  // Auto-save functionality with debounce
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) {
      setAutoSaveStatus('idle');
      return;
    }

    const currentState = JSON.stringify({ nodes, edges, currentCanvasName });
    
    if (currentState === lastSavedRef.current) {
      return;
    }

    setAutoSaveStatus('pending');

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAutoSaveStatus('error');
          return;
        }

        const { data: client } = await supabase
          .from("clients")
          .select("workspace_id")
          .eq("id", clientId)
          .single();

        if (!client) {
          setAutoSaveStatus('error');
          return;
        }

        const canvasData = {
          id: currentCanvasId || undefined,
          client_id: clientId,
          workspace_id: client.workspace_id,
          user_id: user.id,
          name: currentCanvasName || `Canvas ${new Date().toLocaleDateString("pt-BR")}`,
          nodes: nodes as any,
          edges: edges as any,
        };

        const { data, error } = await supabase
          .from('content_canvas')
          .upsert(canvasData)
          .select()
          .single();

        if (error) {
          console.error("Auto-save error:", error);
          setAutoSaveStatus('error');
          return;
        }

        if (data) {
          lastSavedRef.current = currentState;
          if (!currentCanvasId) {
            setCurrentCanvasId(data.id);
          }
          queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });
        }

        setAutoSaveStatus('saved');
        
        setTimeout(() => {
          setAutoSaveStatus((prev) => prev === 'saved' ? 'idle' : prev);
        }, 2000);
        
      } catch (error) {
        console.error("Auto-save error:", error);
        setAutoSaveStatus('error');
      }
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, currentCanvasName, currentCanvasId, clientId, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    savedCanvases,
    isLoadingCanvases,
    isSaving,
    autoSaveStatus,
    currentCanvasId,
    currentCanvasName,
    setCanvasName,
    saveCanvas,
    loadCanvas,
    deleteCanvas,
    clearCanvas
  };
}

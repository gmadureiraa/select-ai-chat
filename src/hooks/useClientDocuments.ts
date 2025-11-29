import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClientDocument {
  id: string;
  client_id: string;
  name: string;
  file_type: string;
  file_path: string;
  created_at: string;
}

export const useClientDocuments = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!clientId,
  });

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save document metadata
      const { data, error: dbError } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId,
          name: file.name,
          file_type: file.type,
          file_path: fileName,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast({
        title: "Documento enviado",
        description: "O documento foi adicionado ao contexto do cliente.",
      });
    },
    onError: (error) => {
      console.error("Error uploading document:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o documento.",
        variant: "destructive",
      });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (doc: ClientDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("client-files")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("client_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast({
        title: "Documento removido",
        description: "O documento foi removido do contexto.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o documento.",
        variant: "destructive",
      });
    },
  });

  return {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
  };
};

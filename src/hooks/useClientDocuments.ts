import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/lib/storage";

export interface ClientDocument {
  id: string;
  client_id: string;
  name: string;
  file_type: string;
  file_path: string;
  extracted_content: string | null;
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

      // Save document metadata first
      const { data: docRecord, error: dbError } = await supabase
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

      // Extract content based on file type
      let extractedContent: string | null = null;

      try {
        // Get signed URL for extraction
        const signedUrl = await getSignedUrl(fileName);

        if (file.type.includes("pdf")) {
          // Use PDF extraction
          const { data: pdfData, error: pdfError } = await supabase.functions.invoke("extract-pdf", {
            body: { fileUrl: signedUrl, fileName: file.name },
          });

          if (!pdfError && pdfData?.content) {
            extractedContent = pdfData.content;
          }
        } else if (file.type.includes("image")) {
          // Use image transcription
          const { data: imgData, error: imgError } = await supabase.functions.invoke("transcribe-images", {
            body: { imageUrls: [signedUrl] },
          });

          if (!imgError && imgData?.transcriptions?.[0]) {
            extractedContent = imgData.transcriptions[0];
          }
        } else if (file.type.includes("text") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
          // Read text directly
          extractedContent = await file.text();
        }

        // Update document with extracted content
        if (extractedContent) {
          await supabase
            .from("client_documents")
            .update({ extracted_content: extractedContent })
            .eq("id", docRecord.id);
        }
      } catch (extractError) {
        console.error("Error extracting content:", extractError);
        // Don't fail the upload if extraction fails
      }

      return { ...docRecord, extracted_content: extractedContent };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast({
        title: "Documento enviado",
        description: "O documento foi adicionado e transcrito para o contexto do cliente.",
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

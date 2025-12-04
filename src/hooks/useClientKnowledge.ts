import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClientDocument {
  id: string;
  name: string;
  file_type: string;
  extracted_content: string | null;
}

interface ClientKnowledge {
  identityGuide: string | null;
  knowledgeFiles: Record<string, string>;
  documents: ClientDocument[];
  isLoading: boolean;
}

// Map client name to folder slug
const getClientSlug = (clientName: string): string => {
  const slugMap: Record<string, string> = {
    'Gabriel Madureira': 'madureira',
    'Madureira': 'madureira',
    'NeoBankless': 'neobankless',
    'Neobankless': 'neobankless',
    'Defiverso': 'defiverso',
    'Jornal Cripto': 'jornal-cripto',
    'Kaleidos': 'kaleidos',
    'Layla Foz': 'layla-foz',
  };
  
  return slugMap[clientName] || clientName.toLowerCase().replace(/\s+/g, '-');
};

// Knowledge files to attempt to load for each client
const KNOWLEDGE_FILES = [
  'README.md',
  'guia-conteudo.md',
  'guia-copywriting.md',
  'guia-carrossel-instagram.md',
  'guia-universal-conteudo.md',
];

export const useClientKnowledge = (clientId: string | undefined, clientName?: string): ClientKnowledge => {
  const [identityGuide, setIdentityGuide] = useState<string | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchKnowledge = async () => {
      if (!clientId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // 1. Fetch identity_guide from database
        const { data: client, error } = await supabase
          .from("clients")
          .select("name, identity_guide")
          .eq("id", clientId)
          .single();

        if (error) {
          console.error("Error fetching client identity:", error);
        } else {
          setIdentityGuide(client?.identity_guide || null);
          
          // Use client name from DB if not provided
          const name = clientName || client?.name;
          
          if (name) {
            // 2. Fetch knowledge files from public folder
            const slug = getClientSlug(name);
            const files: Record<string, string> = {};
            
            await Promise.all(
              KNOWLEDGE_FILES.map(async (filename) => {
                try {
                  const response = await fetch(`/clients/${slug}/${filename}`);
                  if (response.ok) {
                    const content = await response.text();
                    // Only save if it's actual markdown content (not 404 HTML)
                    if (content && !content.includes('<!DOCTYPE html>')) {
                      files[filename] = content;
                    }
                  }
                } catch (e) {
                  // File not found, skip silently
                }
              })
            );
            
            setKnowledgeFiles(files);
          }
        }

        // 3. Fetch documents with extracted content
        const { data: docs, error: docsError } = await supabase
          .from("client_documents")
          .select("id, name, file_type, extracted_content")
          .eq("client_id", clientId)
          .not("extracted_content", "is", null);

        if (!docsError && docs) {
          setDocuments(docs);
        }
      } catch (e) {
        console.error("Error in useClientKnowledge:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKnowledge();
  }, [clientId, clientName]);

  return { identityGuide, knowledgeFiles, documents, isLoading };
};

// Helper to format knowledge for AI context
export const formatKnowledgeForContext = (
  identityGuide: string | null,
  knowledgeFiles: Record<string, string>,
  documents?: ClientDocument[]
): string => {
  const parts: string[] = [];

  // Priority 1: Identity Guide from database
  if (identityGuide) {
    parts.push(`## 🎯 IDENTIDADE E POSICIONAMENTO DO CLIENTE`);
    parts.push(``);
    parts.push(identityGuide);
    parts.push(``);
  }

  // Priority 2: Knowledge files from public folder
  const fileEntries = Object.entries(knowledgeFiles);
  
  if (fileEntries.length > 0) {
    // README first (overview)
    const readme = knowledgeFiles['README.md'];
    if (readme) {
      parts.push(`## 📖 RESUMO DO CLIENTE`);
      parts.push(``);
      parts.push(readme);
      parts.push(``);
    }

    // Content guide
    const guiaConteudo = knowledgeFiles['guia-conteudo.md'];
    if (guiaConteudo) {
      parts.push(`## 📋 GUIA DE CONTEÚDO`);
      parts.push(``);
      parts.push(guiaConteudo);
      parts.push(``);
    }

    // Copywriting guide
    const guiaCopywriting = knowledgeFiles['guia-copywriting.md'];
    if (guiaCopywriting) {
      parts.push(`## ✍️ GUIA DE COPYWRITING`);
      parts.push(``);
      parts.push(guiaCopywriting);
      parts.push(``);
    }

    // Carousel guide
    const guiaCarrossel = knowledgeFiles['guia-carrossel-instagram.md'];
    if (guiaCarrossel) {
      parts.push(`## 🎠 GUIA DE CARROSSEL INSTAGRAM`);
      parts.push(``);
      parts.push(guiaCarrossel);
      parts.push(``);
    }

    // Universal content guide
    const guiaUniversal = knowledgeFiles['guia-universal-conteudo.md'];
    if (guiaUniversal) {
      parts.push(`## 📚 GUIA UNIVERSAL DE CONTEÚDO`);
      parts.push(``);
      parts.push(guiaUniversal);
      parts.push(``);
    }
  }

  // Priority 3: Extracted documents content
  if (documents && documents.length > 0) {
    parts.push(`## 📄 DOCUMENTOS DO CLIENTE`);
    parts.push(``);
    
    for (const doc of documents) {
      if (doc.extracted_content) {
        parts.push(`### ${doc.name}`);
        parts.push(``);
        parts.push(doc.extracted_content);
        parts.push(``);
      }
    }
  }

  return parts.join('\n');
};

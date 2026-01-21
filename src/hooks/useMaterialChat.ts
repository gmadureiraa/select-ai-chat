import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseOpenAIStream } from '@/lib/parseOpenAIStream';

export interface MaterialChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface UseMaterialChatOptions {
  clientId: string;
  materialContext: string;
  materialTitle?: string;
}

export function useMaterialChat({ clientId, materialContext, materialTitle }: UseMaterialChatOptions) {
  const [messages, setMessages] = useState<MaterialChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: MaterialChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessageId = `assistant-${Date.now()}`;
    
    // Add placeholder for assistant message
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-about-material`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            clientId,
            materialContext,
            materialTitle,
            message: text.trim(),
            history: messages.map(m => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao processar mensagem');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream não disponível');

      await parseOpenAIStream(reader, {
        onProgress: (content) => {
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content } 
              : m
          ));
        },
      });

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: 'Erro ao processar mensagem. Tente novamente.' } 
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [clientId, materialContext, materialTitle, messages, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    setMessages,
  };
}

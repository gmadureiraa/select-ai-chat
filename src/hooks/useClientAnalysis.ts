import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTokenError } from './useTokenError';

export interface ClientAnalysis {
  generated_at: string;
  executive_summary: string;
  visual_identity: {
    colors: string[];
    typography: string[];
    style: string;
    logo_url?: string;
  };
  tone_of_voice: {
    primary: string;
    secondary: string[];
    avoid: string[];
  };
  target_audience: {
    demographics: { age?: string; role?: string; location?: string };
    psychographics: string[];
  };
  objectives: string[];
  content_themes: string[];
  recommendations: string[];
  sources_analyzed: {
    website: boolean;
    branding: boolean;
    documents: number;
    social_profiles: string[];
  };
}

export interface AnalysisProgress {
  step: string;
  progress: number;
}

interface ClientData {
  name: string;
  description?: string;
  segment?: string;
  tone?: string;
  audience?: string;
  objectives?: string;
  socialMedia?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
    newsletter?: string;
  };
  websites?: string[];
  documentContents?: string[];
}

export function useClientAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ClientAnalysis | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({ step: '', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const { handleTokenError } = useTokenError();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const runAnalysis = useCallback(async (clientData: ClientData): Promise<ClientAnalysis | null> => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress({ step: 'Iniciando análise...', progress: 10 });

    try {
      // Simulate progress updates with detailed steps
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev.progress >= 90) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            return prev;
          }
          
          const newProgress = prev.progress + 5;
          let step = prev.step;
          
          if (newProgress <= 15) step = 'Conectando ao website...';
          else if (newProgress <= 30) step = 'Extraindo identidade visual (logo, cores)...';
          else if (newProgress <= 45) step = 'Analisando conteúdo das páginas...';
          else if (newProgress <= 60) step = 'Processando redes sociais...';
          else if (newProgress <= 75) step = 'Processando documentos...';
          else if (newProgress <= 90) step = 'Gerando perfil completo com IA...';
          else step = 'Finalizando...';
          
          return { step, progress: newProgress };
        });
      }, 600);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-client-onboarding', {
        body: { clientData }
      });

      // Clear interval after API call
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (fnError) {
        // Check if it's a 402 token error
        const errorData = data || {};
        if (fnError.message?.includes('402') || errorData.error === 'insufficient_tokens') {
          await handleTokenError(errorData, 402);
          throw new Error('Créditos insuficientes');
        }
        throw new Error(fnError.message);
      }

      if (!data?.success || !data?.analysis) {
        // Also check for token error in data response
        if (data?.error === 'insufficient_tokens') {
          await handleTokenError(data, 402);
          throw new Error('Créditos insuficientes');
        }
        throw new Error(data?.error || 'Falha ao gerar análise');
      }

      setProgress({ step: 'Análise completa!', progress: 100 });
      setAnalysis(data.analysis);
      return data.analysis;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar cliente';
      setError(message);
      toast.error('Erro na análise', { description: message });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const updateAnalysis = useCallback((updates: Partial<ClientAnalysis>) => {
    setAnalysis(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setProgress({ step: '', progress: 0 });
  }, []);

  return {
    isAnalyzing,
    analysis,
    progress,
    error,
    runAnalysis,
    updateAnalysis,
    resetAnalysis,
    setAnalysis,
  };
}

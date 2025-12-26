import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const runAnalysis = useCallback(async (clientData: ClientData): Promise<ClientAnalysis | null> => {
    setIsAnalyzing(true);
    setError(null);
    setProgress({ step: 'Iniciando análise...', progress: 10 });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.progress >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          
          const newProgress = prev.progress + 10;
          let step = prev.step;
          
          if (newProgress <= 20) step = 'Extraindo branding do website...';
          else if (newProgress <= 40) step = 'Analisando conteúdo das páginas...';
          else if (newProgress <= 60) step = 'Processando documentos...';
          else if (newProgress <= 80) step = 'Gerando análise com IA...';
          else step = 'Finalizando...';
          
          return { step, progress: newProgress };
        });
      }, 800);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-client-onboarding', {
        body: { clientData }
      });

      clearInterval(progressInterval);

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success || !data?.analysis) {
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

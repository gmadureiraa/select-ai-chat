// MetricoolBrandMapper — UI pra mapear KAI client → Metricool blogId.
// Lista todas as brands disponíveis na conta Metricool e mostra qual está
// linkada ao cliente atual. Permite trocar / linkar / auto-sync handles.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMetricoolBrands } from '@/hooks/useMetricoolBrands';
import { apiInvoke } from '@/lib/apiInvoke';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ExternalLink, Link2, Unlink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Props {
  clientId: string;
  currentBlogId?: string | null;
  onMapped?: (blogId: string) => void;
}

export function MetricoolBrandMapper({ clientId, currentBlogId, onMapped }: Props) {
  const { data: brands, isLoading, error } = useMetricoolBrands();
  const [mappingId, setMappingId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleMap = async (blogId: string, label: string) => {
    setMappingId(String(blogId));
    try {
      const { data, error: err } = await apiInvoke('metricool-map-brand', {
        body: { clientId, blogId, brandLabel: label, autoSync: true },
      });
      if (err) throw err;
      const r = data as any;
      toast({
        title: 'Brand mapeado',
        description: `${label} → ${r.credentialsUpdated} contas atualizadas, ${r.credentialsInserted} novas adicionadas`,
      });
      qc.invalidateQueries({ queryKey: ['client-credentials', clientId] });
      qc.invalidateQueries({ queryKey: ['metricool-analytics', clientId] });
      onMapped?.(String(blogId));
    } catch (e: any) {
      toast({ title: 'Erro ao mapear', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setMappingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando brands Metricool...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          Erro: {(error as Error).message}. Verifique se METRICOOL_USER_TOKEN está configurado.
        </CardContent>
      </Card>
    );
  }

  if (!brands || brands.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nenhuma brand encontrada na conta Metricool. Crie brands em{' '}
          <a
            href="https://app.metricool.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            app.metricool.com <ExternalLink className="inline h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Mapear cliente para brand Metricool
        </CardTitle>
        <CardDescription>
          Cada cliente KAI 2.0 mapeia para uma brand do Metricool. As contas conectadas (IG/FB/LI/TT/YT)
          do brand viram automaticamente as integrações do cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {brands.map((b) => {
          const isMapped = currentBlogId && String(currentBlogId) === String(b.id);
          const isMapping = mappingId === String(b.id);
          return (
            <div
              key={b.id}
              className={
                'flex items-center justify-between gap-3 rounded-md border p-3 ' +
                (isMapped ? 'border-primary bg-primary/5' : 'hover:border-foreground/20')
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                {b.picture ? (
                  <img src={b.picture} alt={b.label} className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-sm font-medium">
                    {b.label?.[0] || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {b.label}
                    {isMapped && <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Linkado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    blogId: {b.id}
                    {b.url ? ` · ${b.url}` : ''}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={isMapped ? 'outline' : 'default'}
                onClick={() => handleMap(String(b.id), b.label)}
                disabled={isMapping}
              >
                {isMapping ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isMapped ? (
                  'Re-sincronizar'
                ) : (
                  'Linkar'
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

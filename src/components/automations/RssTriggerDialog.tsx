import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Rss, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useRssTriggers } from '@/hooks/useRssTriggers';
import { useClients } from '@/hooks/useClients';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RssTrigger, CreateRssTriggerInput } from '@/types/rssTrigger';

interface RssTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: RssTrigger | null;
}

const platforms = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog' },
];

const contentTypes = [
  { value: 'post', label: 'Post Simples' },
  { value: 'thread', label: 'Thread' },
  { value: 'article', label: 'Artigo' },
];

export function RssTriggerDialog({ open, onOpenChange, trigger }: RssTriggerDialogProps) {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();
  const { createTrigger, updateTrigger, testFeed } = useRssTriggers();
  
  const [name, setName] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [contentType, setContentType] = useState<string>('post');
  const [promptTemplate, setPromptTemplate] = useState('Crie um {contentType} sobre: {title}\n\nDescrição original: {description}');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isActive, setIsActive] = useState(true);
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; items?: number; error?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch columns
  const { data: columns } = useQuery({
    queryKey: ['kanban-columns', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('position');
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.id,
  });

  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setRssUrl(trigger.rss_url);
      setClientId(trigger.client_id || '');
      setColumnId(trigger.target_column_id || '');
      setPlatform(trigger.platform || '');
      setContentType(trigger.content_type || 'post');
      setPromptTemplate(trigger.prompt_template || '');
      setAutoGenerate(trigger.auto_generate_content);
      setIsActive(trigger.is_active);
    } else {
      setName('');
      setRssUrl('');
      setClientId('');
      setColumnId(columns?.[0]?.id || '');
      setPlatform('');
      setContentType('post');
      setPromptTemplate('Crie um {contentType} sobre: {title}\n\nDescrição original: {description}');
      setAutoGenerate(false);
      setIsActive(true);
      setTestResult(null);
    }
  }, [trigger, open, columns]);

  const handleTest = async () => {
    if (!rssUrl) return;
    setIsTesting(true);
    setTestResult(null);
    
    const result = await testFeed(rssUrl);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !rssUrl.trim() || !workspace?.id) return;
    
    setIsSubmitting(true);
    try {
      const data: CreateRssTriggerInput = {
        workspace_id: workspace.id,
        name: name.trim(),
        rss_url: rssUrl.trim(),
        client_id: clientId || null,
        target_column_id: columnId || null,
        platform: platform || null,
        content_type: contentType,
        prompt_template: promptTemplate.trim() || null,
        auto_generate_content: autoGenerate,
        is_active: isActive,
      };

      if (trigger) {
        await updateTrigger.mutateAsync({ id: trigger.id, ...data });
      } else {
        await createTrigger.mutateAsync(data);
      }
      
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            {trigger ? 'Editar RSS Trigger' : 'Novo RSS Trigger'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do Trigger *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Monitorar Blog Concorrente"
            />
          </div>

          <div>
            <Label>URL do RSS Feed *</Label>
            <div className="flex gap-2">
              <Input
                value={rssUrl}
                onChange={(e) => {
                  setRssUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="https://exemplo.com/feed.xml"
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTest}
                disabled={!rssUrl || isTesting}
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar'}
              </Button>
            </div>
            {testResult && (
              <div className={`mt-2 p-2 rounded text-sm flex items-center gap-2 ${
                testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
              }`}>
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Feed válido! {testResult.items} itens encontrados.
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Erro: {testResult.error}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Coluna de Destino</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {columns?.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label>Gerar Conteúdo Automaticamente</Label>
                <p className="text-xs text-muted-foreground">Usa IA para criar o conteúdo com base no item do RSS</p>
              </div>
              <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            </div>

            {autoGenerate && (
              <div>
                <Label className="text-sm">Prompt Template</Label>
                <Textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  placeholder="Use {title}, {description}, {link} como variáveis"
                  rows={3}
                  className="mt-1 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {'{title}'}, {'{description}'}, {'{link}'}, {'{contentType}'}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>Trigger Ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !name.trim() || !rssUrl.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {trigger ? 'Salvar' : 'Criar Trigger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

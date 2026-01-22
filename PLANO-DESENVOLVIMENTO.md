# 🚀 PLANO DE DESENVOLVIMENTO - SELECT AI CHAT (KAI)

**Objetivo:** Transformar o app em uma aplicação de produção robusta, escalável e livre de débitos técnicos.

**Metodologia:** Desenvolvimento iterativo em 5 fases, cada uma entregando valor incremental.

---

## 📋 VISÃO GERAL DO PLANO

### Estratégia:
1. **Estabilização** → Corrigir problemas críticos
2. **Refatoração** → Melhorar qualidade do código
3. **Performance** → Otimizar velocidade e tamanho
4. **Testes** → Garantir confiabilidade
5. **Polimento** → Melhorias finais e documentação

### Princípios:
- ✅ Desenvolvimento local primeiro
- ✅ Commits pequenos e frequentes
- ✅ Testes em cada fase
- ✅ Zero breaking changes para usuários
- ✅ Rollback fácil se necessário

---

## 🎯 FASE 1: ESTABILIZAÇÃO CRÍTICA
**Objetivo:** Corrigir problemas que podem causar crashes ou bugs em produção

### 1.1 Habilitar TypeScript Strict Mode
**Prioridade:** 🔴 CRÍTICA

**Ações:**
```json
// tsconfig.json - Habilitar gradualmente
{
  "compilerOptions": {
    "strict": true,                    // ✅ Habilitar modo strict
    "noImplicitAny": true,            // ✅ Proibir 'any' implícito
    "strictNullChecks": true,         // ✅ Verificar null/undefined
    "noUnusedLocals": true,           // ✅ Alertar sobre variáveis não usadas
    "noUnusedParameters": true,       // ✅ Alertar sobre parâmetros não usados
    "strictFunctionTypes": true,      // ✅ Verificar tipos de funções
    "strictBindCallApply": true       // ✅ Verificar bind/call/apply
  }
}
```

**Passos:**
1. Habilitar `noImplicitAny` primeiro
2. Corrigir ~200 erros de tipo (batch de 20-30 arquivos por vez)
3. Habilitar `strictNullChecks`
4. Adicionar verificações de null onde necessário
5. Habilitar `strict: true` completo

**Resultado Esperado:**
- ✅ Zero erros de tipo
- ✅ Código mais seguro
- ✅ Autocomplete melhorado no VSCode
- ✅ Menos bugs em runtime

**Arquivos Principais:**
- `src/components/kai/canvas/ContentCanvas.tsx` (28 erros de 'any')
- `src/components/kai/canvas/hooks/useCanvasState.ts` (30 erros de 'any')
- `src/components/clients/TemplateRulesDialog.tsx` (12 erros de 'any')

---

### 1.2 Adicionar Error Boundaries
**Prioridade:** 🔴 CRÍTICA

**Ações:**
```typescript
// src/components/ErrorBoundary.tsx - CRIAR NOVO
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);

    // TODO: Enviar para serviço de monitoramento (Sentry, LogRocket)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-screen p-8">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Algo deu errado</h2>
          <p className="text-muted-foreground mb-4">
            Desculpe, encontramos um problema inesperado.
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Implementação:**
```typescript
// src/App.tsx - Adicionar boundaries estratégicos
<ErrorBoundary>
  <WorkspaceProvider>
    <ErrorBoundary fallback={<CanvasErrorFallback />}>
      <ContentCanvas /> {/* Componente mais complexo */}
    </ErrorBoundary>

    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <PerformanceDashboard />
    </ErrorBoundary>
  </WorkspaceProvider>
</ErrorBoundary>
```

**Resultado Esperado:**
- ✅ App não quebra completamente em erros
- ✅ Usuário vê mensagem amigável
- ✅ Botão de reload disponível
- ✅ Erros logados para análise

---

### 1.3 Corrigir Erros Críticos do Linter
**Prioridade:** 🔴 CRÍTICA

**Ações:**
1. **Corrigir erros de Rules of Hooks:**
```typescript
// ❌ ANTES - src/components/kai/ProactiveSuggestions.tsx:40
const handleUseSuggestion = () => {
  useSuggestion(); // ❌ Hook chamado em função normal
};

// ✅ DEPOIS
const { mutate: useSuggestion } = useMutation(...);
const handleUseSuggestion = () => {
  useSuggestion(); // ✅ Chama mutation, não hook
};
```

2. **Corrigir empty blocks:**
```typescript
// ❌ ANTES
try {
  // código
} catch (error) {
  // ❌ Bloco vazio
}

// ✅ DEPOIS
try {
  // código
} catch (error) {
  console.error('Erro ao processar:', error);
  toast.error('Falha ao processar. Tente novamente.');
}
```

3. **Corrigir prefer-const:**
```typescript
// ❌ ANTES
let imageReferences = []; // Nunca reatribuído

// ✅ DEPOIS
const imageReferences = [];
```

**Meta:** Reduzir de 479 erros para < 50 erros

---

### 1.4 Remover Console.logs de Produção
**Prioridade:** 🟡 ALTA

**Ações:**
```typescript
// src/lib/logger.ts - CRIAR NOVO
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: any[]) => isDev && console.debug(...args),
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => console.warn(...args), // Sempre mostrar warnings
  error: (...args: any[]) => console.error(...args), // Sempre mostrar erros
};

// Uso em vez de console.log:
import { logger } from '@/lib/logger';
logger.debug('Debug info'); // Só em dev
logger.error('Error'); // Em dev e prod
```

**Buscar e substituir (160 ocorrências):**
```bash
# Encontrar
console.log\(

# Substituir por
logger.debug(
```

---

### 1.5 Resolver Vulnerabilidades de Dependências
**Prioridade:** 🟡 ALTA

**Ações:**
```bash
# 1. Auditar vulnerabilidades
npm audit

# 2. Corrigir automáticas
npm audit fix

# 3. Revisar manualmente conflitos
npm audit fix --force # Usar com cuidado

# 4. Atualizar dependências específicas
npm update react-day-picker date-fns

# 5. Verificar browserslist
npx update-browserslist-db@latest
```

**Resultado Esperado:**
- ✅ 0 vulnerabilidades críticas
- ✅ < 2 vulnerabilidades moderadas (aceitas)
- ✅ Dependências sem conflitos

---

## 🔄 FASE 2: REFATORAÇÃO DE CÓDIGO
**Objetivo:** Melhorar manutenibilidade e legibilidade

### 2.1 Refatorar ContentCanvas (1,143 LOC)
**Prioridade:** 🔴 CRÍTICA

**Estratégia de Decomposição:**

```
ContentCanvas (1,143 LOC)
├── CanvasViewport (250 LOC) ✅
│   └── Gerencia ReactFlow, zoom, pan
├── CanvasToolbar (843 LOC) - JÁ EXISTE ✅
│   └── Seleção e controle de ferramentas
├── CanvasWhiteboard (200 LOC) ✅
│   └── Desenho, sticky notes, formas
├── CanvasNodeManager (300 LOC) ✅
│   └── Criação, conexão e deleção de nodes
├── CanvasStateManager (usar hook existente) ✅
│   └── Estado global do canvas
└── CanvasContextMenu (150 LOC) ✅
    └── Menu de contexto e ações
```

**Implementação:**
```typescript
// src/components/kai/canvas/ContentCanvas.tsx - REFATORADO
export const ContentCanvas = () => {
  const canvasState = useCanvasState();

  return (
    <div className="relative w-full h-full">
      <CanvasToolbar {...canvasState} />
      <CanvasViewport {...canvasState}>
        <CanvasWhiteboard {...canvasState} />
        <CanvasNodeManager {...canvasState} />
      </CanvasViewport>
      <CanvasContextMenu {...canvasState} />
    </div>
  );
};
```

**Resultado Esperado:**
- ✅ Componente principal: ~100 LOC
- ✅ Subcomponentes: 150-300 LOC cada
- ✅ Mais fácil de testar
- ✅ Mais fácil de manter

---

### 2.2 Refatorar useCanvasState (2,269 LOC)
**Prioridade:** 🔴 CRÍTICA

**Estratégia de Decomposição:**

```
useCanvasState (2,269 LOC)
├── useCanvasNodes (400 LOC) ✅
│   └── CRUD de nodes
├── useCanvasEdges (200 LOC) ✅
│   └── Conexões entre nodes
├── useCanvasDrawing (300 LOC) ✅
│   └── Lógica de desenho
├── useCanvasSelection (150 LOC) ✅
│   └── Seleção e multi-seleção
├── useCanvasHistory (200 LOC) ✅
│   └── Undo/Redo
├── useCanvasPersistence (300 LOC) - JÁ EXISTE ✅
│   └── Save/Load do Supabase
└── useCanvasGeneration (400 LOC) - JÁ EXISTE ✅
    └── Geração de conteúdo IA
```

**Implementação:**
```typescript
// src/hooks/canvas/useCanvasState.ts - REFATORADO
export const useCanvasState = () => {
  const nodes = useCanvasNodes();
  const edges = useCanvasEdges();
  const drawing = useCanvasDrawing();
  const selection = useCanvasSelection();
  const history = useCanvasHistory();
  const persistence = useCanvasPersistence();
  const generation = useCanvasGeneration();

  return {
    ...nodes,
    ...edges,
    ...drawing,
    ...selection,
    ...history,
    ...persistence,
    ...generation,
  };
};
```

---

### 2.3 Refatorar InstagramDashboard (996 LOC)
**Prioridade:** 🟡 ALTA

**Decomposição:**
```
InstagramDashboard (996 LOC)
├── InstagramMetricsHeader (150 LOC) ✅
│   └── Cards de métricas principais
├── InstagramFilters (100 LOC) ✅
│   └── Filtros de data, tipo, etc.
├── InstagramPostsTable (300 LOC) ✅
│   └── Tabela de posts com virtualização
├── InstagramCharts (200 LOC) ✅
│   └── Gráficos de performance
└── InstagramInsights (150 LOC) ✅
    └── Insights e recomendações
```

---

### 2.4 Consolidar Implementações de Chat
**Prioridade:** 🟡 ALTA

**Problema Atual:**
- `useClientChat` (500+ LOC)
- `useKAISimpleChat` (simplificado)
- `useMaterialChat` (documentos)

**Solução - Chat Service Unificado:**
```typescript
// src/services/chatService.ts - CRIAR NOVO
interface ChatConfig {
  mode: 'client' | 'simple' | 'material';
  clientId?: string;
  materialId?: string;
  features?: {
    streaming?: boolean;
    attachments?: boolean;
    context?: boolean;
  };
}

export class ChatService {
  constructor(private config: ChatConfig) {}

  async sendMessage(content: string, options?: SendOptions) {
    // Lógica unificada
  }

  streamResponse(messageId: string) {
    // SSE streaming unificado
  }

  addAttachment(file: File) {
    // Upload unificado
  }
}

// Hook wrapper
export const useChat = (config: ChatConfig) => {
  const service = useMemo(() => new ChatService(config), [config]);

  return {
    sendMessage: service.sendMessage.bind(service),
    // ... outras funções
  };
};
```

**Uso:**
```typescript
// Cliente
const chat = useChat({ mode: 'client', clientId: '123' });

// Simples
const chat = useChat({ mode: 'simple' });

// Material
const chat = useChat({ mode: 'material', materialId: '456' });
```

---

### 2.5 Simplificar Provider Nesting
**Prioridade:** 🟢 MÉDIA

**Antes (6 níveis):**
```typescript
<Theme>
  <QueryClient>
    <Tooltip>
      <Router>
        <Workspace>
          <TokenError>
            <UpgradePrompt>
              <GlobalKAI>
                <App />
```

**Depois (3-4 níveis):**
```typescript
// src/providers/AppProviders.tsx - CRIAR NOVO
export const AppProviders = ({ children }) => {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <TooltipProvider>
          <AuthProvider> {/* Combinar Workspace + TokenError */}
            <Router>
              {children}
            </Router>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

// GlobalKAI vira Context API local, não provider global
```

---

## ⚡ FASE 3: OTIMIZAÇÃO DE PERFORMANCE
**Objetivo:** Reduzir bundle size e melhorar velocidade

### 3.1 Implementar Code Splitting
**Prioridade:** 🔴 CRÍTICA

**Ações:**
```typescript
// src/App.tsx - Lazy loading de rotas
import { lazy, Suspense } from 'react';

const ContentCanvas = lazy(() => import('./components/kai/canvas/ContentCanvas'));
const PerformanceDashboard = lazy(() => import('./pages/Performance'));
const PlanningBoard = lazy(() => import('./pages/Planning'));
const LibraryPage = lazy(() => import('./pages/Library'));

// Uso com Suspense
<Suspense fallback={<PageLoader />}>
  <Route path="/canvas" element={<ContentCanvas />} />
</Suspense>
```

**Configuração de chunks manuais:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'chart-vendor': ['recharts', 'framer-motion'],
          'canvas': ['@xyflow/react'],
          'editor': ['react-markdown', 'html-to-image'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Aumentar temporariamente
  },
});
```

**Meta:**
- Bundle principal: < 500 KB (gzip)
- Chunks de rota: 100-300 KB cada
- First Load JS: < 800 KB total

---

### 3.2 Adicionar Virtualização em Tabelas
**Prioridade:** 🟡 ALTA

**Implementação:**
```typescript
// src/components/performance/InstagramPostsTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export const InstagramPostsTable = ({ posts }: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Altura estimada da linha
    overscan: 5, // Renderizar 5 items extras
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const post = posts[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <PostRow post={post} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**Instalar:**
```bash
npm install @tanstack/react-virtual
```

**Resultado Esperado:**
- ✅ Renderizar apenas 10-20 linhas visíveis
- ✅ Scroll suave com 1000+ items
- ✅ Memória reduzida em 80%

---

### 3.3 Otimizar Memoização
**Prioridade:** 🟢 MÉDIA

**Auditoria de Re-renders:**
```bash
# Instalar
npm install @welldone-software/why-did-you-render

# src/main.tsx - Só em desenvolvimento
if (import.meta.env.DEV) {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
```

**Adicionar memoização estratégica:**
```typescript
// ❌ ANTES - Re-render desnecessário
const ExpensiveComponent = ({ data }) => {
  const processed = processLargeData(data); // Recalcula sempre
  return <div>{processed}</div>;
};

// ✅ DEPOIS - Memoizado
const ExpensiveComponent = memo(({ data }) => {
  const processed = useMemo(
    () => processLargeData(data),
    [data]
  );
  return <div>{processed}</div>;
});
```

**Focar em:**
- Componentes de lista (PostCard, ClientCard)
- Calculações pesadas (analytics, agregações)
- Callbacks passados como props

---

### 3.4 Otimizar Imagens e Assets
**Prioridade:** 🟢 MÉDIA

**Ações:**
```typescript
// vite.config.ts - Otimização de imagens
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
});
```

**Lazy loading de imagens:**
```typescript
// src/components/ui/LazyImage.tsx
export const LazyImage = ({ src, alt, ...props }) => {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
};
```

---

## 🧪 FASE 4: TESTES E QUALIDADE
**Objetivo:** Garantir confiabilidade e evitar regressões

### 4.1 Configurar Testes Unitários (Vitest)
**Prioridade:** 🟡 ALTA

**Instalação:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event jsdom
```

**Configuração:**
```typescript
// vitest.config.ts - CRIAR NOVO
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
});
```

**Setup file:**
```typescript
// src/test/setup.ts - CRIAR NOVO
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

---

### 4.2 Testes de Hooks Críticos
**Prioridade:** 🟡 ALTA

**Exemplo - useCanvasNodes:**
```typescript
// src/hooks/canvas/__tests__/useCanvasNodes.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCanvasNodes } from '../useCanvasNodes';

describe('useCanvasNodes', () => {
  it('deve adicionar um novo node', () => {
    const { result } = renderHook(() => useCanvasNodes());

    act(() => {
      result.current.addNode({
        type: 'attachment',
        position: { x: 100, y: 100 },
      });
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].type).toBe('attachment');
  });

  it('deve remover node por id', () => {
    const { result } = renderHook(() => useCanvasNodes());

    act(() => {
      result.current.addNode({ type: 'attachment', position: { x: 0, y: 0 } });
      const nodeId = result.current.nodes[0].id;
      result.current.removeNode(nodeId);
    });

    expect(result.current.nodes).toHaveLength(0);
  });
});
```

**Prioridade de testes:**
1. ✅ useCanvasNodes, useCanvasEdges
2. ✅ useClientChat (lógica de chat)
3. ✅ useWorkspace, useAuth
4. ✅ Utilitários (formatters, validators)

---

### 4.3 Testes de Componentes Críticos
**Prioridade:** 🟢 MÉDIA

**Exemplo - Button:**
```typescript
// src/components/ui/__tests__/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('deve renderizar children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('deve estar disabled quando loading', () => {
    render(<Button loading>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---

### 4.4 Mocks do Supabase
**Prioridade:** 🟡 ALTA

**Mock factory:**
```typescript
// src/test/mocks/supabase.ts - CRIAR NOVO
import { vi } from 'vitest';

export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: '123' } } },
      error: null,
    }),
    signIn: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    })),
  },
});

// Uso nos testes
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient(),
}));
```

---

### 4.5 E2E Tests (Playwright)
**Prioridade:** 🟢 BAIXA

**Testes críticos:**
```typescript
// tests/e2e/canvas.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Canvas', () => {
  test('deve criar novo canvas', async ({ page }) => {
    await page.goto('/app/canvas');
    await page.click('[data-testid="new-canvas"]');

    // Verificar que canvas foi criado
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('deve adicionar node de attachment', async ({ page }) => {
    await page.goto('/app/canvas/123');
    await page.click('[data-testid="add-attachment-node"]');

    // Verificar que node apareceu
    await expect(page.locator('[data-nodetype="attachment"]')).toBeVisible();
  });
});
```

**Meta de cobertura:**
- ✅ Hooks: > 80%
- ✅ Utilitários: > 90%
- ✅ Componentes UI: > 70%
- ✅ Componentes complexos: > 60%

---

## 🛡️ FASE 5: SEGURANÇA E POLIMENTO
**Objetivo:** Fortalecer segurança e adicionar melhorias finais

### 5.1 Validação Server-Side de Tokens
**Prioridade:** 🔴 CRÍTICA

**Edge Function:**
```typescript
// supabase/functions/validate-tokens/index.ts - CRIAR NOVO
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verificar autenticação
  const authHeader = req.headers.get('Authorization');
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader?.replace('Bearer ', '') || ''
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
    });
  }

  // Buscar tokens do workspace
  const { data: workspace } = await supabase
    .from('workspace_tokens')
    .select('balance')
    .eq('workspace_id', user.user_metadata.workspace_id)
    .single();

  const tokensRequired = await req.json().then(body => body.tokens || 0);

  if (!workspace || workspace.balance < tokensRequired) {
    return new Response(JSON.stringify({
      error: 'Tokens insuficientes',
      balance: workspace?.balance || 0
    }), {
      status: 402,
    });
  }

  // Deduzir tokens
  await supabase
    .from('workspace_tokens')
    .update({ balance: workspace.balance - tokensRequired })
    .eq('workspace_id', user.user_metadata.workspace_id);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
  });
});
```

**Cliente:**
```typescript
// src/hooks/useTokenValidation.ts - CRIAR NOVO
export const useTokenValidation = () => {
  return useMutation({
    mutationFn: async (tokens: number) => {
      const response = await supabase.functions.invoke('validate-tokens', {
        body: { tokens },
      });

      if (!response.data?.success) {
        throw new Error(response.error?.message || 'Falha na validação');
      }

      return response.data;
    },
  });
};
```

---

### 5.2 Rate Limiting
**Prioridade:** 🟡 ALTA

**Edge Function Middleware:**
```typescript
// supabase/functions/_shared/rateLimiter.ts - CRIAR NOVO
import { createClient } from '@supabase/supabase-js';

interface RateLimitConfig {
  windowMs: number; // Janela de tempo (ex: 60000 = 1 minuto)
  max: number;      // Máximo de requisições
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Buscar requisições recentes
  const { data: requests } = await supabase
    .from('rate_limit_requests')
    .select('count')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', new Date(windowStart).toISOString())
    .single();

  const currentCount = requests?.count || 0;

  if (currentCount >= config.max) {
    return { allowed: false, remaining: 0 };
  }

  // Registrar requisição
  await supabase.from('rate_limit_requests').insert({
    user_id: userId,
    endpoint,
    count: currentCount + 1,
  });

  return { allowed: true, remaining: config.max - currentCount - 1 };
}
```

**Uso:**
```typescript
// supabase/functions/kai-chat/index.ts
import { checkRateLimit } from '../_shared/rateLimiter.ts';

Deno.serve(async (req) => {
  const user = await authenticateUser(req);

  const rateLimit = await checkRateLimit(user.id, 'kai-chat', {
    windowMs: 60000, // 1 minuto
    max: 10,         // 10 mensagens por minuto
  });

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit excedido. Tente novamente em breve.'
    }), {
      status: 429,
      headers: { 'X-RateLimit-Remaining': '0' },
    });
  }

  // Continuar processamento...
});
```

---

### 5.3 Sanitização de Inputs
**Prioridade:** 🟡 ALTA

**Instalação:**
```bash
npm install dompurify isomorphic-dompurify
```

**Uso:**
```typescript
// src/lib/sanitize.ts - CRIAR NOVO
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
};

export const sanitizeMarkdown = (markdown: string): string => {
  // Remover scripts e HTML perigoso antes de renderizar
  return markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};
```

**Aplicar em componentes:**
```typescript
// src/components/chat/MessageContent.tsx
import ReactMarkdown from 'react-markdown';
import { sanitizeMarkdown } from '@/lib/sanitize';

export const MessageContent = ({ content }: Props) => {
  const sanitized = sanitizeMarkdown(content);

  return (
    <ReactMarkdown
      components={{
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {sanitized}
    </ReactMarkdown>
  );
};
```

---

### 5.4 Monitoramento de Erros (Sentry)
**Prioridade:** 🟢 MÉDIA

**Instalação:**
```bash
npm install @sentry/react @sentry/vite-plugin
```

**Configuração:**
```typescript
// src/lib/sentry.ts - CRIAR NOVO
import * as Sentry from '@sentry/react';

export const initSentry = () => {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
    });
  }
};

// src/main.tsx
import { initSentry } from './lib/sentry';
initSentry();
```

**Integrar com ErrorBoundary:**
```typescript
// src/components/ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error('ErrorBoundary caught:', error, errorInfo);

  // Enviar para Sentry
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
  });

  this.props.onError?.(error, errorInfo);
}
```

---

### 5.5 Documentação Final
**Prioridade:** 🟢 BAIXA

**Criar documentação:**
```markdown
## /docs

/docs
├── ARCHITECTURE.md      # Arquitetura geral
├── COMPONENTS.md        # Guia de componentes
├── HOOKS.md             # Documentação de hooks
├── API.md               # Endpoints e Edge Functions
├── DATABASE.md          # Schema e relações
├── DEPLOYMENT.md        # Deploy e CI/CD
├── TESTING.md           # Estratégia de testes
└── CONTRIBUTING.md      # Guia de contribuição
```

**JSDoc em hooks:**
```typescript
/**
 * Hook para gerenciar nodes do canvas
 *
 * @returns {Object} Funções e estado dos nodes
 * @property {Node[]} nodes - Lista de nodes atuais
 * @property {Function} addNode - Adiciona novo node
 * @property {Function} removeNode - Remove node por ID
 * @property {Function} updateNode - Atualiza propriedades do node
 *
 * @example
 * const { nodes, addNode, removeNode } = useCanvasNodes();
 * addNode({ type: 'attachment', position: { x: 100, y: 100 } });
 */
export const useCanvasNodes = () => {
  // ...
};
```

---

## 📊 MÉTRICAS DE SUCESSO

### Antes vs Depois:

| Métrica | Antes | Meta | Melhoria |
|---------|-------|------|----------|
| Bundle Size (gzip) | 1.07 MB | < 500 KB | -53% |
| Build Time | 30.88s | < 20s | -35% |
| Lint Errors | 479 | 0 | -100% |
| TypeScript Strict | Não | Sim | ✅ |
| Test Coverage | 0% | > 70% | +70% |
| Error Boundaries | 0 | 5+ | ✅ |
| Largest Component | 1,290 LOC | < 300 LOC | -77% |
| Vulnerabilities | 6 | 0 | -100% |
| Console Logs | 160 | 0 (prod) | -100% |
| Page Load (3G) | ~8s | < 3s | -62% |

---

## 🎯 CRONOGRAMA SUGERIDO

### Sprints de 2 semanas:

**Sprint 1-2: Fase 1 - Estabilização**
- Semana 1: TypeScript Strict + Error Boundaries
- Semana 2: Lint fixes + Console removal + Dependencies

**Sprint 3-4: Fase 2 - Refatoração**
- Semana 3: ContentCanvas + useCanvasState
- Semana 4: InstagramDashboard + Chat consolidation

**Sprint 5-6: Fase 3 - Performance**
- Semana 5: Code splitting + Virtualização
- Semana 6: Memoização + Assets optimization

**Sprint 7-8: Fase 4 - Testes**
- Semana 7: Setup + Testes de hooks
- Semana 8: Testes de componentes + E2E

**Sprint 9-10: Fase 5 - Segurança**
- Semana 9: Server-side validation + Rate limiting
- Semana 10: Sanitização + Monitoring + Docs

**Total:** ~20 semanas (5 meses)

---

## ✅ CHECKLIST DE CONCLUSÃO

### Fase 1: Estabilização
- [ ] TypeScript Strict Mode habilitado
- [ ] 0 erros de tipo
- [ ] Error Boundaries implementados
- [ ] < 50 erros de lint
- [ ] 0 console.logs em produção
- [ ] 0 vulnerabilidades críticas

### Fase 2: Refatoração
- [ ] ContentCanvas < 300 LOC
- [ ] useCanvasState decomposto
- [ ] InstagramDashboard refatorado
- [ ] Chat service unificado
- [ ] Provider nesting < 4 níveis

### Fase 3: Performance
- [ ] Bundle < 500 KB (gzip)
- [ ] Code splitting implementado
- [ ] Tabelas virtualizadas
- [ ] Build time < 20s
- [ ] First Load < 3s (3G)

### Fase 4: Testes
- [ ] Vitest configurado
- [ ] > 80% cobertura em hooks
- [ ] > 70% cobertura em componentes
- [ ] Supabase mockado
- [ ] E2E tests críticos

### Fase 5: Segurança
- [ ] Validação server-side de tokens
- [ ] Rate limiting implementado
- [ ] Inputs sanitizados
- [ ] Sentry configurado
- [ ] Documentação completa

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

### Você decide a prioridade! O que prefere começar?

**Opção A: RÁPIDO E IMPACTANTE** (2-3 dias)
1. Adicionar Error Boundaries (2h)
2. Remover console.logs (1h)
3. Corrigir erros críticos de lint (4h)
4. Resolver vulnerabilidades (1h)

**Opção B: ESTRUTURAL E DURADOURO** (1-2 semanas)
1. Habilitar TypeScript Strict (3-4 dias)
2. Refatorar ContentCanvas (3-4 dias)
3. Adicionar testes básicos (2-3 dias)

**Opção C: PERFORMANCE PRIMEIRO** (1 semana)
1. Implementar code splitting (2 dias)
2. Adicionar virtualização (1 dia)
3. Otimizar bundle (2 dias)

**Opção D: PLANO COMPLETO** (5 meses)
- Seguir todas as 5 fases
- Entregas incrementais
- App production-ready

---

## 💬 CONSIDERAÇÕES FINAIS

### Pontos Fortes do App:
✅ Features sofisticadas e funcionais
✅ Stack moderna e bem escolhida
✅ Arquitetura organizada por features
✅ Banco de dados bem estruturado
✅ Integrações complexas funcionando

### Áreas de Atenção:
⚠️ Débitos técnicos acumulados
⚠️ TypeScript não strict
⚠️ Componentes muito grandes
⚠️ Falta de testes

### Recomendação:
**Começar pela Fase 1 (Estabilização)** - São mudanças rápidas com alto impacto que previnem bugs e crashes. Depois partir para Fase 2 (Refatoração) para facilitar manutenção futura.

---

**Desenvolvido por:** Claude Code
**Data:** 22 de Janeiro de 2026
**Repositório:** https://github.com/gmadureiraa/select-ai-chat

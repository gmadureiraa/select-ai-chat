# 🚀 Onboarding de Clientes

## Visão Geral

O sistema de onboarding guia novos usuários na configuração inicial do workspace e criação do primeiro cliente.

---

## 🔄 Fluxos

### 1. Novo Workspace (Owner)
```
Signup → verify-checkout-and-create-workspace
  → Onboarding Dialog:
    Step 1: Boas-vindas
    Step 2: Criar primeiro cliente (nome + descrição)
    Step 3: Tutorial de como usar (menções @)
  → Marca onboarding como completo
```

### 2. Usuário Convidado (Joining)
```
Convite por email → accept_pending_invite()
  → Onboarding Dialog:
    Step 1: Boas-vindas ao workspace
    Step 2: Tutorial de como usar
  → Marca onboarding como completo
```

---

## 📋 Configuração do Cliente

Após onboarding, o cliente pode ser configurado com:

| Campo | Descrição | Importância |
|-------|-----------|-------------|
| **Identity Guide** | Guia de identidade da marca (texto livre) | 🔴 Crítico — Base de toda geração |
| **Brand Assets** | Cores, fontes, logos (JSON) | 🟡 Visual |
| **Voice Profile** | Perfil de voz gerado por IA | 🟢 Auto-gerado |
| **Social Media** | Handles das redes sociais | 🟡 Métricas |
| **Context Notes** | Notas adicionais de contexto | 🟢 Opcional |
| **Documents** | PDFs, DOCXs para extração | 🟢 Knowledge base |
| **Websites** | URLs para scraping | 🟢 Knowledge base |

### Geração Automática de Context

Edge function `generate-client-context`:
- Analisa identity guide + documentos + websites
- Gera resumo estruturado do cliente
- Usado como context_notes

### Geração de Voice Profile

Edge function `generate-voice-profile`:
- Analisa content library do cliente
- Extrai padrões de: tom, vocabulário, estrutura, ritmo
- Salva como JSON estruturado em `clients.voice_profile`

---

## 🔐 Convites

### Fluxo de Convite
```sql
add_workspace_member_or_invite(workspace_id, email, role, invited_by, client_ids)
```

1. Se usuário já existe → adiciona como membro diretamente
2. Se não existe → cria `workspace_invite` + envia email
3. Na signup → `handle_workspace_invite_on_signup()` trigger aceita automaticamente
4. Se já logado → `accept_pending_invite()` aceita manualmente

### Controle de Acesso por Cliente
- `workspace_member_clients` — Tabela de acesso por cliente
- Membros podem ter acesso a clientes específicos (não todos)
- `workspace_invite_clients` — Clientes atribuídos no convite

---

*Última atualização: Março 2025*

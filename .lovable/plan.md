
# Plano: Completar e Padronizar Configurações

## Problema
O `SettingsTab` atual está incompleto. O componente `AccountSettingsSection.tsx` tem funcionalidades essenciais (editar nome, alterar senha, excluir conta) que **não estão sendo utilizadas**. Além disso, faltam preferências de notificação e exibição de créditos.

---

## Fase 1: Integrar Funcionalidades Faltantes no Perfil

### 1.1 Adicionar Edição de Nome
**Arquivo:** `src/components/settings/SettingsTab.tsx`

Na função `renderProfileSection()`, adicionar campo para editar nome:

```typescript
// Após o AvatarUpload, adicionar:
<div className="space-y-2">
  <Label htmlFor="name">Nome</Label>
  <div className="flex gap-2">
    <Input
      id="name"
      value={editedName ?? profile?.full_name ?? ""}
      onChange={(e) => setEditedName(e.target.value)}
      placeholder="Seu nome completo"
    />
    {hasNameChanges && (
      <Button onClick={handleSaveName} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
      </Button>
    )}
  </div>
</div>
```

### 1.2 Adicionar Seção de Segurança
No `renderProfileSection()`, adicionar card de segurança:

```typescript
// Card de Segurança (após o card de Perfil)
<Card className="mt-4">
  <CardHeader>
    <div className="flex items-center gap-2">
      <Key className="h-5 w-5 text-muted-foreground" />
      <CardTitle>Segurança</CardTitle>
    </div>
  </CardHeader>
  <CardContent>
    <Button variant="outline" onClick={handlePasswordReset}>
      Enviar link para redefinir senha
    </Button>
  </CardContent>
</Card>
```

### 1.3 Adicionar Zona de Perigo
No `renderProfileSection()`, adicionar card de exclusão de conta:

```typescript
// Card Zona de Perigo (último)
<Card className="mt-4 border-destructive/30">
  <CardHeader>
    <CardTitle className="text-destructive flex items-center gap-2">
      <Trash2 className="h-5 w-5" />
      Zona de Perigo
    </CardTitle>
  </CardHeader>
  <CardContent>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Excluir minha conta</Button>
      </AlertDialogTrigger>
      {/* ... dialog de confirmação ... */}
    </AlertDialog>
  </CardContent>
</Card>
```

---

## Fase 2: Restaurar Exibição de Créditos no Billing

### 2.1 Adicionar Card de Créditos
**Arquivo:** `src/components/settings/PlanBillingCard.tsx`

Adicionar exibição de créditos/tokens disponíveis:

```typescript
// Após os limites de perfis/membros, adicionar:
<div className="flex items-center justify-between text-sm">
  <div className="flex items-center gap-2 text-muted-foreground">
    <Coins className="h-4 w-4" />
    Créditos disponíveis
  </div>
  <span className="font-medium">
    {isUnlimited ? (
      <span className="flex items-center gap-1">
        <Infinity className="h-4 w-4" /> Ilimitado
      </span>
    ) : (
      `${creditsAvailable} créditos`
    )}
  </span>
</div>

{/* Barra de uso */}
{!isUnlimited && (
  <div className="space-y-2">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>Usado: {creditsUsed}</span>
      <span>Mensal: {creditsMonthly}</span>
    </div>
    <Progress value={usagePercentage} className="h-2" />
  </div>
)}
```

---

## Fase 3: Adicionar Seção de Notificações

### 3.1 Criar Componente NotificationSettings
**Novo arquivo:** `src/components/settings/NotificationSettings.tsx`

```typescript
export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = usePushNotifications();
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Notificações</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Push notifications */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Notificações push</Label>
            <p className="text-sm text-muted-foreground">
              Receba alertas no navegador
            </p>
          </div>
          {isSupported ? (
            permission === "granted" ? (
              <Badge className="bg-primary/10 text-primary">Ativado</Badge>
            ) : (
              <Button variant="outline" onClick={requestPermission}>
                Ativar
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">
              Não suportado
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.2 Atualizar SettingsNavigation
**Arquivo:** `src/components/settings/SettingsNavigation.tsx`

Adicionar item de Notificações:

```typescript
const sections = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "billing", label: "Plano", icon: CreditCard },
  { id: "team", label: "Time", icon: Users, requiresPermission: "team" },
  { id: "notifications", label: "Notificações", icon: Bell },  // NOVO
  { id: "appearance", label: "Aparência", icon: Palette },
];
```

### 3.3 Atualizar SettingsTab
**Arquivo:** `src/components/settings/SettingsTab.tsx`

Adicionar case para notificações:

```typescript
const renderNotificationsSection = () => (
  <NotificationSettings />
);

// No switch:
case "notifications":
  return renderNotificationsSection();
```

---

## Fase 4: Adicionar Configurações do Workspace (Opcional para Owners)

### 4.1 Criar Componente WorkspaceSettings
**Novo arquivo:** `src/components/settings/WorkspaceSettings.tsx`

Para owners/admins, permitir editar:
- Nome do workspace
- URL (slug) do workspace

```typescript
export function WorkspaceSettings() {
  const { workspace, isOwner } = useWorkspace();
  
  if (!isOwner) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do Workspace</Label>
          <Input value={workspace?.name} onChange={...} />
        </div>
        <div className="space-y-2">
          <Label>URL</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">kai.app/</span>
            <Input value={workspace?.slug} disabled />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Fase 5: Limpar e Remover Código Duplicado

### 5.1 Remover AccountSettingsSection.tsx
Como todas as funcionalidades serão integradas no `SettingsTab`, podemos remover ou depreciar o `AccountSettingsSection.tsx`.

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `SettingsTab.tsx` | Adicionar edição de nome, segurança, zona de perigo |
| `SettingsNavigation.tsx` | Adicionar item "Notificações" |
| `PlanBillingCard.tsx` | Restaurar exibição de créditos/tokens |
| `NotificationSettings.tsx` | **NOVO** - Preferências de notificação |
| `WorkspaceSettings.tsx` | **NOVO** (opcional) - Config do workspace |

---

## Resultado Esperado

### Perfil (completo)
- [x] Avatar editável
- [x] Nome editável
- [x] Email (somente leitura)
- [x] ID do usuário
- [x] Alterar senha
- [x] Excluir conta

### Plano (completo)
- [x] Plano atual
- [x] Limites
- [x] Créditos disponíveis
- [x] Barra de uso
- [x] Gerenciar assinatura
- [x] Upgrade

### Time
- [x] Convidar
- [x] Gerenciar roles
- [x] Controle de acesso

### Notificações (novo)
- [x] Push notifications
- [ ] Email preferences (futuro)

### Aparência
- [x] Tema claro/escuro

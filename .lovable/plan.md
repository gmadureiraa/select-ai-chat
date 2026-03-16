

# Plano: Simplificar Dialog de Planejamento + Remover Analytics do Menu

## Mudanças

### 1. Unificar data no PlanningItemDialog (`PlanningItemDialog.tsx`)

**Problema:** Existem dois campos de data — "Data" (due_date, linha 711-722) e "Agendamento" (scheduled_at, dentro de "Mais opções", linhas 799-830). O usuário quer que exista apenas uma data+hora que serve como data de agendamento.

**Solução:**
- Remover o campo `dueDate` separado (linha 711-722)
- Mover o seletor de data+hora do "Agendamento" para onde está o campo "Data" atual, ao lado do "Responsável"
- Quando o usuário selecionar data+hora, isso define o `scheduled_at` diretamente
- O `due_date` será derivado automaticamente do `scheduled_at` (mesma data)
- Auto-mover para coluna "scheduled" quando data+hora estiverem definidos e plataformas selecionadas

### 2. Remover "Mais opções" — mostrar tudo inline (`PlanningItemDialog.tsx`)

**Problema:** Coluna, prioridade, recorrência e comentários ficam escondidos no collapsible "Mais opções".

**Solução:**
- Remover o `Collapsible` wrapper (linhas 759-845)
- Mostrar Coluna + Prioridade inline após o seletor de data/responsável
- Mostrar Recorrência e Comentários diretamente no form

### 3. Remover Analytics do menu (`KaiSidebar.tsx`)

- Remover o NavItem "Analytics ✨" (linhas 309-316)

## Arquivos a Modificar

- `src/components/planning/PlanningItemDialog.tsx` — Unificar datas, remover collapsible
- `src/components/kai/KaiSidebar.tsx` — Remover item Analytics


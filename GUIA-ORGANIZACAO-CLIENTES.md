# Guia de Organização de Informações por Cliente

## 🎯 Sistema Implementado

Este projeto usa uma estrutura organizada de pastas para gerenciar todas as informações de cada cliente de forma centralizada e automática.

## 📂 Estrutura de Pastas

```
public/clients/
├── README.md                          # Documentação geral do sistema
├── layla-foz/                         # Pasta da cliente Layla Foz
│   ├── README.md                      # Índice de arquivos da Layla
│   ├── newsletters-completas.md       # Todas newsletters publicadas
│   └── temas-e-ideias.md             # Banco de temas e ideias
├── [outro-cliente]/                   # Pasta de outro cliente
│   ├── README.md
│   └── [arquivos de contexto]
└── ...
```

## 🔄 Como Funciona

### Fluxo Automático

1. **Você cria informação** (manualmente ou via IA)
2. **Salva na pasta do cliente** (`public/clients/[nome-cliente]/`)
3. **Referencia no template** (em "Gerenciar Templates")
4. **IA carrega automaticamente** quando usa o template

### Exemplo Prático

**Cenário**: Adicionar nova newsletter da Layla Foz

```
Você pede:
"Adicione esta newsletter ao contexto da Layla Foz"
    ↓
IA salva em: public/clients/layla-foz/newsletters-completas.md
    ↓
Já está referenciado no template "Newsletter Semanal"
    ↓
Próxima vez que usar o template, a IA já conhece essa newsletter
```

## ✨ Como Adicionar Informações de Clientes

### Método 1: Via Chat (Recomendado)

**Para adicionar conteúdo novo:**
```
"Adicione [informação] ao contexto da [cliente]"
"Salve esse documento na pasta da Layla Foz"
"Crie uma referência de tom de voz para João Silva"
```

**Para atualizar existente:**
```
"Atualize as newsletters da Layla com este novo conteúdo"
"Adicione esses temas ao banco de ideias da Layla"
```

### Método 2: Upload de Arquivos

1. Faça upload do arquivo no chat
2. Diga: "Processe e adicione ao contexto da [cliente]"
3. IA extrai informações e organiza na pasta correta

### Método 3: Manual (Dev Mode)

1. Ative Dev Mode (canto superior esquerdo)
2. Navegue até `public/clients/[nome-cliente]/`
3. Crie/edite arquivos `.md` diretamente
4. Adicione referência no template do cliente

## 📋 Tipos de Informação por Cliente

### 📝 Conteúdo Escrito
- Newsletters/posts anteriores
- Tom de voz e estilo
- Exemplos de copy
- Guidelines de escrita
- Glossário de termos

**Exemplo de arquivo:**
```markdown
# Tom de Voz - [Cliente]

## Características
- Pessoal e intimista
- Uso de "Deusa" como vocativo
- Filosofia acessível
- Vulnerabilidade compartilhada

## O que evitar
- Jargões técnicos
- Tom corporativo
- Linguagem impessoal
```

### 🎯 Estratégia e Objetivos
- Metas de comunicação
- KPIs e métricas
- Público-alvo
- Posicionamento
- Calendário editorial

### 🎨 Referências Visuais
- Paleta de cores
- Tipografia
- Mood boards
- Exemplos de design
- Guidelines de marca

### 📊 Dados e Análises
- Performance de conteúdos
- Feedback de audiência
- Pesquisas de mercado
- Dados demográficos

## 🆕 Criando Novo Cliente

### Passo a Passo

1. **Crie a pasta do cliente**
   ```
   public/clients/[nome-cliente]/
   ```

2. **Adicione README inicial**
   ```markdown
   # [Nome do Cliente] - Base de Conhecimento
   
   ## Sobre
   [Descrição do cliente]
   
   ## Arquivos
   - file1.md - [descrição]
   - file2.md - [descrição]
   ```

3. **Crie arquivos de contexto**
   - `tom-de-voz.md`
   - `objetivos.md`
   - `publico-alvo.md`
   - `referencias.md`

4. **Configure templates**
   - Vá em "Gerenciar Templates" do cliente
   - Adicione referências aos arquivos criados
   - Teste gerando conteúdo

### Exemplo Completo

**Cliente**: João Silva (Coach de Carreira)

```
public/clients/joao-silva/
├── README.md
├── tom-de-voz.md           # Motivacional, direto, empático
├── temas-abordados.md      # Transição de carreira, liderança
├── posts-anteriores.md     # Histórico de conteúdo
├── publico-alvo.md         # Profissionais 30-45 anos
└── referencias.md          # Simon Sinek, Brené Brown
```

## 🔗 Vinculando aos Templates

### Como Criar Referência

1. Vá no Dashboard do Cliente
2. Clique em "Gerenciar Templates"
3. Edite o template desejado
4. Adicione regra tipo "Referência de Conteúdo"
5. Insira o caminho do arquivo: `/clients/[cliente]/[arquivo].md`

### Exemplo de Configuração

**Template**: "Post LinkedIn"  
**Referências**:
```json
[
  {
    "type": "content",
    "content": "Tom de voz e estilo",
    "file_url": "/clients/joao-silva/tom-de-voz.md"
  },
  {
    "type": "content", 
    "content": "Posts de maior sucesso",
    "file_url": "/clients/joao-silva/posts-anteriores.md"
  }
]
```

## 🤖 Como a IA Usa Essas Informações

### Processo Automático

1. **Você seleciona template** (ex: "Newsletter Semanal")
2. **IA carrega todas as referências** do template
3. **Lê os arquivos** da pasta do cliente
4. **Usa como contexto** para gerar conteúdo
5. **Mantém consistência** com histórico e estilo

### O que a IA Faz Automaticamente

✅ Analisa tom de voz dos exemplos  
✅ Evita repetir temas já abordados  
✅ Mantém estrutura similar a conteúdos anteriores  
✅ Usa referências visuais como inspiração  
✅ Respeita guidelines e objetivos definidos  

## 💡 Melhores Práticas

### Organização

- **Nomes claros**: Use nomes descritivos para arquivos
- **Um tema por arquivo**: Não misture tom de voz com estratégia
- **README atualizado**: Mantenha índice dos arquivos
- **Markdown formatado**: Use headers, listas, destaques

### Conteúdo

- **Exemplos concretos**: Não só teoria, mostre exemplos reais
- **Contexto completo**: Explique o "porquê" das decisões
- **Atualização regular**: Adicione novos conteúdos criados
- **Organização cronológica**: Ordene por data quando relevante

### Templates

- **Referências específicas**: Link apenas o que é relevante para aquele template
- **Descrições claras**: Explique o que cada referência contém
- **Teste regularmente**: Verifique se as referências estão funcionando

## 🔍 Buscando Informações

### Via Chat

```
"Mostre todas as newsletters da Layla Foz sobre Sêneca"
"Quais temas a Layla ainda não abordou?"
"Qual é o tom de voz do João Silva?"
```

### Via Arquivos

1. Dev Mode → `public/clients/`
2. Use Ctrl+F para buscar termos
3. Navegue pelos arquivos .md

## 🚀 Casos de Uso

### 1. Nova Newsletter

```
Você: "Crie newsletter sobre mindfulness para Layla Foz"
IA: 
  - Carrega newsletters-completas.md
  - Carrega temas-e-ideias.md
  - Verifica se já falou de mindfulness
  - Usa tom de voz dos exemplos
  - Gera conteúdo consistente
```

### 2. Post para Novo Cliente

```
Você: "Crie post LinkedIn para João Silva sobre liderança"
IA:
  - Carrega tom-de-voz.md
  - Carrega posts-anteriores.md
  - Carrega publico-alvo.md
  - Cria post alinhado ao estilo e audiência
```

### 3. Campanha Multi-Formato

```
Você: "Crie campanha sobre [tema] para [cliente]"
IA:
  - Usa todos os arquivos de referência
  - Mantém consistência entre formatos
  - Adapta tom para cada canal
  - Baseado em estratégias documentadas
```

## 📈 Evolução do Sistema

### Próximos Passos

- [ ] Adicionar versionamento de conteúdos
- [ ] Dashboard de estatísticas por cliente
- [ ] Busca avançada nos arquivos
- [ ] Tags e categorização automática
- [ ] Integração com analytics

### Feedback

Encontrou algo que pode melhorar? Adicione sugestões em:
`public/clients/SUGESTOES.md`

---

## 🆘 Suporte

**Dúvidas sobre:**
- Organização → Veja `public/clients/README.md`
- Templates → Veja documentação em "Gerenciar Templates"
- IA não carrega contexto → Verifique caminhos das referências
- Novo cliente → Siga seção "Criando Novo Cliente" acima

**Precisa de ajuda?**
Peça no chat: "Como adicionar [tipo de informação] para [cliente]?"

# Base de Conhecimento dos Clientes

Esta estrutura organiza todas as informações e contexto de cada cliente em pastas dedicadas.

## 📂 Estrutura de Pastas

```
public/clients/
├── README.md (este arquivo)
├── layla-foz/
│   ├── README.md
│   ├── newsletters-completas.md
│   └── temas-e-ideias.md
├── [outro-cliente]/
│   ├── README.md
│   └── [arquivos de contexto]
└── ...
```

## 🎯 Como Funciona

### Para cada cliente:

1. **Pasta dedicada**: `public/clients/[nome-cliente]/`
2. **Arquivos de contexto**: Todos os arquivos `.md` com informações relevantes
3. **README**: Documenta o que cada arquivo contém
4. **Templates**: Referenciam estes arquivos para a IA usar automaticamente

### Fluxo de Trabalho

```
Criação de Cliente
    ↓
Pasta em /clients/[nome-cliente]/
    ↓
Adicionar arquivos de contexto (.md)
    ↓
Referenciar nos Templates do Cliente
    ↓
IA carrega automaticamente ao usar o template
```

## ✨ Tipos de Informação por Cliente

### Conteúdo Escrito
- Newsletters/blogs anteriores
- Tom de voz e estilo
- Temas abordados
- Guidelines de escrita
- Exemplos de copy

### Estratégia
- Objetivos de comunicação
- Público-alvo e personas
- Posicionamento de marca
- Temas prioritários
- Calendário editorial

### Referências Visuais
- Exemplos de design
- Paleta de cores
- Tipografia
- Mood boards

### Dados e Pesquisas
- Análises de performance
- Feedback de audiência
- Pesquisas de mercado
- Dados demográficos

## 🔄 Adicionando Informações

### Método 1: Via Chat
"Adicione [informação] ao contexto da [cliente]"

A IA criará/atualizará arquivos na pasta do cliente.

### Método 2: Manual
1. Navegue até `public/clients/[nome-cliente]/`
2. Crie/edite arquivos `.md`
3. Adicione referências nos templates

### Método 3: Upload de Arquivos
1. Faça upload de documentos no chat
2. Peça para adicionar ao contexto do cliente
3. A IA processa e organiza na pasta correta

## 📋 Exemplo: Novo Cliente

```markdown
Criar pasta para novo cliente "João Silva":

1. Crie: public/clients/joao-silva/
2. Adicione: README.md (descrição do cliente)
3. Adicione: tom-de-voz.md (estilo de comunicação)
4. Adicione: objetivos.md (metas e KPIs)
5. Referencie nos templates do João Silva
```

## 🤖 Integração com IA

Quando você usa um template de um cliente:
1. A IA carrega TODOS os arquivos referenciados da pasta do cliente
2. Usa esse contexto para gerar conteúdo personalizado
3. Mantém consistência com o histórico e estilo do cliente

## ⚠️ Boas Práticas

- **Nomes de pastas**: Use kebab-case (ex: `joao-silva`)
- **Arquivos organizados**: Um arquivo por tipo de informação
- **README atualizado**: Documente o que cada arquivo contém
- **Referências nos templates**: Vincule os arquivos aos templates corretos
- **Manutenção regular**: Atualize conforme novo conteúdo é criado

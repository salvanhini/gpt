# Tutorial de Configuracao - FEMIC GPT

## 1. Requisitos

- Navegador moderno (Chrome, Edge, Brave, Firefox, Opera)
- Conexao com internet (para carregar as bibliotecas CDN e chamar as APIs)
- Nao precisa instalar nada — e 100% client-side (roda no navegador)

---

## 2. Hospedagem

### Opcao A — Local (recomendado para desenvolvimento)
```bash
# Com Node.js instalado:
npx serve .
# Abre em http://localhost:3000
```

### Opcao B — Arquivo local
Abra o `index.html` diretamente no navegador (duplo clique).
**Atencao:** Alguns recursos (streaming, cache) funcionam melhor servindo via HTTP.

### Opcao C — Online (Netlify, Vercel, GitHub Pages)
Basta fazer upload da pasta inteira para qualquer host estatico.

---

## 3. Primeiro Acesso

1. Abra o sistema
2. Clique no icone de engrenagem **(⚙)** no canto inferior esquerdo da sidebar
3. Preencha as chaves de API (veja secao abaixo)
4. Clique em "Salvar"

---

## 4. Obtendo Chaves de API

### Provedores de Chat (obrigatorio — pelo menos um)

| Provedor | Como obter | Custo |
|----------|-----------|-------|
| **OpenRouter** (recomendado) | Acesse [openrouter.ai/keys](https://openrouter.ai/keys), crie conta e gere uma chave `sk-or-v1-...` | Pago por uso (~$0.15/1M tokens) |
| **DeepSeek** | Acesse [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys), crie conta e gere chave `sk-...` | Gratuito (limitado) |
| **Groq** | Acesse [console.groq.com/keys](https://console.groq.com/keys), crie conta e gere chave `gsk_...` | Gratuito (rate limit) |

### Para Geracao de Imagens (opcional)

| Provedor | Como obter | Custo |
|----------|-----------|-------|
| **fal.ai** | Acesse [fal.ai/dashboard](https://fal.ai/dashboard), crie conta e gere chave | Pago (~$0.01/imagem) |

### Para Busca Web (opcional)

| Provedor | Como obter | Custo |
|----------|-----------|-------|
| **Tavily** | Acesse [tavily.com](https://tavily.com), crie conta | Gratuito (1000 req/mes) |
| **Brave Search** | Acesse [brave.com/search/api](https://brave.com/search/api), crie conta | Gratuito (2000 req/mes) |
| **DuckDuckGo** | Nao precisa de chave (usado como fallback automatico) | Gratuito |

### Para Transcricao/Audio (opcional)

| Provedor | Como obter |
|----------|-----------|
| **Groq** (mesma chave do chat) | Ja configurada se voce ja tem chave Groq |
| **OpenAI** | Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

---

## 5. Configuracoes Principais

### Aba "Chaves"
Cole cada chave no campo correspondente:
- `sk-or-v1-...` → OpenRouter
- `sk-...` → DeepSeek
- `gsk_...` → Groq
- `Key ...` → fal.ai

### Aba "Modelo"
Escolha o provedor padrao e o modelo:
- **OpenRouter:** `qwen/qwen3.7-plus` (equilibrado) ou `deepseek/deepseek-v4-pro` (qualidade)
- **DeepSeek direto:** `deepseek-v4-flash` (rapido) ou `deepseek-v4-pro` (profundo)
- **Groq:** `openai/gpt-oss-20b` (rapido) ou `llama-3.1-8b-instant` (ultra-rapido)

### Aba "Audio"
- **Provedor de transcricao:** Groq (recomendado) ou OpenAI
- **Modelo TTS:** `gpt-4o-mini-tts` (voz natural)
- **Voz:** `coral`, `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

---

## 6. Funcionalidades Novas

### Streaming (efeito maquina de escrever)
- Ativo automaticamente para todos os provedores
- A resposta aparece palavra por palavra
- Timeline rola automaticamente
- Tres pontinhos animados aparecem enquanto a resposta nao comeca

### Cache local
- Respostas identicas (mesmo texto + mesmo modelo) sao instantaneas na segunda vez
- Cache expira apos 24 horas
- Nao afeta buscas web

### Limitar conversa
- O sistema mantem automaticamente as ultimas 12 mensagens no contexto
- Para limpar o historico manualmente: clique no icone **🗑️** ao lado do titulo da conversa

### Proxy Backend (para futuro)
- Em `js/api.js`, localize `BACKEND_PROXY`
- Mude `enabled: true` e defina a `baseUrl` do seu servidor
- Quando ativo, as chaves de API nao sao enviadas do frontend

---

## 7. Estrutura de Arquivos

```
/
├── index.html            ← Entrada do sistema
├── css/
│   └── style.css         ← Estilos visuais
├── js/
│   ├── app.js            ← Orquestracao, estado, handlers
│   ├── api.js            ← Chamadas de API, streaming, cache, proxy
│   ├── ui.js             ← Renderizacao da interface
│   ├── chat.js           ← Modelo de dados das conversas
│   ├── agents.js         ← Modelo de dados dos agentes
│   ├── audio.js          ← Captura de audio
│   ├── voiceController.js← Sintese de voz
│   ├── storage.js        ← Persistencia (localStorage)
│   └── ...               ← Demais modulos
└── tests/                ← Testes automatizados
```

---

## 8. Testando as Funcionalidades

### Streaming
1. Envie uma pergunta longa (ex: "Explique a teoria da relatividade em detalhes")
2. A resposta deve aparecer palavra por palavra
3. Teste com cada provedor (troque em Configuracoes > Modelo)

### Cache
1. Envie uma mensagem
2. Envie EXATAMENTE a mesma mensagem novamente
3. A segunda resposta deve ser instantânea

### Typing Dots
1. Envie uma mensagem
2. Observe os tres pontinhos piscando no bubble da IA antes do texto comecar

### Proxy
1. Em `js/api.js`, mude `BACKEND_PROXY.enabled = true`
2. Defina `BACKEND_PROXY.baseUrl = "http://localhost:3001/api"`
3. As requisicoes vao para `/chat/completions` sem Authorization header
4. (Requer implementacao do servidor proxy — apenas preparado, nao implementado)

### Limpar conversa
1. Envie algumas mensagens
2. Clique no icone 🗑️ ao lado do titulo da conversa
3. O historico e limpo e uma mensagem de confirmacao aparece

### Tratamento de erros
1. Remova a chave de API e tente enviar → mensagem "Adicione sua chave..."
2. Configure uma chave invalida → mensagem "Chave de API invalida"
3. Desligue a internet e tente enviar → mensagem "Sem conexao com a API"

---

## 9. Solucao de Problemas

| Problema | Causa | Solucao |
|----------|-------|---------|
| Tela branca ao carregar | Cache do navegador | Ctrl+F5 para limpar cache |
| "Sem conexao com a API" | Chave invalida ou sem internet | Verifique a chave e a conexao |
| "Muitas requisicoes" | Rate limit do provedor | Aguarde 1 minuto e tente novamente |
| Streaming nao funciona | Navegador muito antigo | Use Chrome, Edge ou Firefox atualizado |
| Cache nao funciona | localStorage cheio | Limpe o localStorage do site |

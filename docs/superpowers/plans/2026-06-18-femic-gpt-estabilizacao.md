# FEMIC GPT Estabilizacao Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir voz, leitura em voz alta e anexos PDF no app atual, além de melhorar a navegação da sidebar e o acabamento visual do composer.

**Architecture:** A implementação preserva a estrutura atual em `index.html` + módulos JS + CSS único. As correções técnicas ficam concentradas em helpers pequenos para áudio e PDF, enquanto a melhoria visual reorganiza apenas a renderização da interface e os estilos já existentes, sem migrar de stack nem reescrever o estado global.

**Tech Stack:** HTML estático, JavaScript ES modules, Tailwind via CDN, CSS customizado, Web Speech API, pdf.js via CDN, navegador local para validação manual.

---

## File Structure

- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/index.html`
  Responsável por garantir o carregamento consistente das bibliotecas globais usadas por PDF e UI.
- Create: `/home/marco/Documentos/Workspace/FEMIC GPT/js/audio.js`
  Responsável por detectar suporte, listar vozes, escolher voz PT-BR e criar reconhecimento/síntese de forma segura.
- Create: `/home/marco/Documentos/Workspace/FEMIC GPT/js/pdf.js`
  Responsável por centralizar o acesso ao `pdfjsLib`, configurar worker e fornecer erro útil quando a lib não estiver disponível.
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/app.js`
  Responsável por integrar os novos helpers de áudio, endurecer estados de voz e melhorar feedback de erro.
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/fileProcessor.js`
  Responsável por usar o helper de PDF e tornar o fluxo de anexo mais robusto.
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/ui.js`
  Responsável por reorganizar sidebar, composer e labels de suporte ao usuário.
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/css/style.css`
  Responsável por reforçar separação visual, profundidade, sidebar premium e espaçamento do fim da timeline.

### Task 1: Padronizar helpers de audio e PDF

**Files:**
- Create: `/home/marco/Documentos/Workspace/FEMIC GPT/js/audio.js`
- Create: `/home/marco/Documentos/Workspace/FEMIC GPT/js/pdf.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/index.html`

- [ ] **Step 1: Criar helper de audio com suporte e selecao de voz**

```js
const SpeechRecognitionCtor =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

export function isSpeechRecognitionSupported() {
  return Boolean(SpeechRecognitionCtor);
}

export function createSpeechRecognition() {
  if (!SpeechRecognitionCtor) {
    throw new Error("Ditado por voz indisponivel neste navegador.");
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "pt-BR";
  recognition.interimResults = true;
  recognition.continuous = false;
  return recognition;
}

export function getSpeechSynthesis() {
  return globalThis.speechSynthesis || null;
}

export function pickPortugueseVoice(voices) {
  const normalizedVoices = Array.isArray(voices) ? voices : [];
  return (
    normalizedVoices.find((voice) => voice.lang === "pt-BR") ||
    normalizedVoices.find((voice) => voice.lang?.toLowerCase().startsWith("pt")) ||
    normalizedVoices[0] ||
    null
  );
}
```

- [ ] **Step 2: Criar helper de PDF com carregamento protegido**

```js
const PDF_WORKER_SRC =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs";

export function getPdfJs() {
  const pdfjs = globalThis.pdfjsLib;
  if (!pdfjs) {
    throw new Error("Leitor de PDF indisponivel no momento. Recarregue a pagina e tente novamente.");
  }

  if (pdfjs.GlobalWorkerOptions?.workerSrc !== PDF_WORKER_SRC) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }

  return pdfjs;
}
```

- [ ] **Step 3: Confirmar que `index.html` carrega as libs antes do app**

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script type="module" src="./js/app.js"></script>
```

- [ ] **Step 4: Abrir o app local e verificar carregamento sem erro inicial**

Run: `python3 -m http.server 4173 --bind 127.0.0.1`
Expected: servidor sobe em `http://127.0.0.1:4173/` e a home do app carrega com título `FEMIC GPT`.

### Task 2: Corrigir ditado por voz e leitura em voz alta

**Files:**
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/app.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/ui.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/css/style.css`

- [ ] **Step 1: Importar os helpers de audio no app**

```js
import {
  createSpeechRecognition,
  getSpeechSynthesis,
  isSpeechRecognitionSupported,
  pickPortugueseVoice,
} from "./audio.js";
```

- [ ] **Step 2: Endurecer o estado de voz no `state`**

```js
const state = {
  // ...
  isListening: false,
  speakingMessageId: null,
  recognition: null,
  availableVoice: null,
};
```

- [ ] **Step 3: Inicializar vozes disponiveis no carregamento**

```js
function syncSpeechVoice() {
  const synth = getSpeechSynthesis();
  if (!synth) {
    state.availableVoice = null;
    return;
  }

  const applyVoices = () => {
    state.availableVoice = pickPortugueseVoice(synth.getVoices());
  };

  applyVoices();
  if (!state.availableVoice) {
    synth.onvoiceschanged = () => {
      applyVoices();
      render();
    };
  }
}
```

- [ ] **Step 4: Reescrever o fluxo de leitura em voz alta com voz selecionada**

```js
function handleSpeakMessage(messageId) {
  const synth = getSpeechSynthesis();
  if (!synth) {
    showToast("Seu navegador nao suporta leitura em voz alta.", "error");
    return;
  }

  if (state.speakingMessageId === messageId) {
    synth.cancel();
    state.speakingMessageId = null;
    render();
    return;
  }

  const chat = getActiveChat();
  const message = chat?.messages.find((item) => item.id === messageId);
  if (!message?.content) {
    return;
  }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(message.content);
  utterance.lang = state.availableVoice?.lang || "pt-BR";
  if (state.availableVoice) {
    utterance.voice = state.availableVoice;
  }
  utterance.onend = () => {
    state.speakingMessageId = null;
    render();
  };
  utterance.onerror = () => {
    state.speakingMessageId = null;
    showToast("Nao foi possivel reproduzir a resposta em voz alta.", "error");
    render();
  };

  state.speakingMessageId = messageId;
  synth.speak(utterance);
  render();
}
```

- [ ] **Step 5: Reescrever o fluxo de ditado com fallback claro**

```js
function handleToggleVoice() {
  if (state.isListening && state.recognition) {
    state.recognition.stop();
    return;
  }

  if (!isSpeechRecognitionSupported()) {
    showToast("Ditado por voz funciona em Chrome ou Edge desktop.", "error");
    return;
  }

  const recognition = createSpeechRecognition();
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    state.draftMessage = transcript;
    render();
  };
  recognition.onerror = (event) => {
    const messageByError = {
      "not-allowed": "Permissao do microfone negada.",
      "no-speech": "Nenhuma fala detectada. Tente novamente.",
      "audio-capture": "Nenhum microfone disponivel.",
      aborted: "Captura de voz interrompida.",
    };
    showToast(messageByError[event.error] || "Nao foi possivel usar o microfone.", "error");
  };
  recognition.onend = () => {
    state.isListening = false;
    state.recognition = null;
    render();
  };

  state.isListening = true;
  state.recognition = recognition;
  recognition.start();
  render();
}
```

- [ ] **Step 6: Ajustar labels da UI para refletir disponibilidade**

```js
title="${
  state.isListening
    ? "Parar ditado"
    : "Ditado por voz (Chrome ou Edge desktop)"
}"
```

- [ ] **Step 7: Validar manualmente leitura e microfone**

Run: abrir `http://127.0.0.1:4173/` no Chrome/Edge, clicar no microfone, falar uma frase curta, depois testar o botao `🔊` em uma resposta da IA.
Expected: o texto aparece no composer, o botao de voz alterna entre ativo/inativo e a leitura encerra sem deixar a UI travada.

### Task 3: Tornar anexos PDF confiaveis

**Files:**
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/fileProcessor.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/ui.js`

- [ ] **Step 1: Importar o helper de PDF**

```js
import { getPdfJs } from "./pdf.js";
```

- [ ] **Step 2: Reescrever `readPdf` usando o helper central**

```js
async function readPdf(file) {
  const pdfjsLib = getPdfJs();
  const bytes = await readAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ").trim();
    pages.push(`Pagina ${pageNumber}\n${text}`);
  }

  return pages.join("\n\n");
}
```

- [ ] **Step 3: Melhorar mensagem de erro de arquivo nao suportado ou falha na leitura**

```js
export async function processFile(file) {
  try {
    // fluxo atual por extensao
  } catch (error) {
    throw new Error(`Falha ao preparar ${file.name}: ${error.message}`);
  }
}
```

- [ ] **Step 4: Tornar o chip de anexo mais informativo**

```js
<div class="composer-chip ...">
  <span>📎</span>
  <span>${escapeHtml(file.summary)}</span>
  <span class="text-[10px] text-sky-700/70">pronto para envio</span>
</div>
```

- [ ] **Step 5: Validar anexo de PDF**

Run: abrir o seletor de arquivo, anexar um PDF pequeno e observar o chip no composer.
Expected: o app mostra o chip do arquivo e exibe toast de sucesso sem erro `Biblioteca PDF nao carregada`.

### Task 4: Reorganizar a sidebar e melhorar navegacao

**Files:**
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/ui.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/css/style.css`

- [ ] **Step 1: Reorganizar o topo da sidebar**

```js
<div class="sidebar-brand-panel ...">
  <div class="sidebar-brand-mark">✦</div>
  <div class="sidebar-expanded-only">
    <div class="text-lg font-semibold tracking-tight">FEMIC GPT</div>
    <div class="text-[11px] uppercase tracking-[0.18em] text-white/55">Workspace de IA</div>
  </div>
</div>
```

- [ ] **Step 2: Criar area de acoes rapidas acima das listas**

```js
<div class="sidebar-shortcuts">
  <button ... data-action="create-chat">Nova conversa</button>
  <button ... data-action="open-agent-modal">Novo agente</button>
  <button ... data-action="open-settings">Configuracoes</button>
</div>
```

- [ ] **Step 3: Melhorar anatomia dos cards de conversa**

```js
<div class="chat-card ${isActive ? "active" : ""} ...">
  <button type="button" class="min-w-0 flex-1 text-left" ...>
    <div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(chat.title)}</div>
    <div class="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
      <span>${formatRelativeDay(chat.updatedAt)}</span>
      <span>${formatTime(chat.updatedAt)}</span>
    </div>
  </button>
</div>
```

- [ ] **Step 4: Refinar o modo recolhido com icones e dicas melhores**

```css
.sidebar-collapsed .sidebar-shortcuts .label-text {
  display: none;
}

.sidebar-collapsed .sidebar-brand-panel {
  justify-content: center;
}
```

- [ ] **Step 5: Validar a navegacao lateral**

Run: trocar de agente, criar conversa, recolher sidebar, expandir sidebar e alternar entre conversas.
Expected: a conversa ativa fica evidente, os botoes principais ficam faceis de achar e a barra recolhida continua util.

### Task 5: Elevar o visual do chat e separar melhor o composer

**Files:**
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/js/ui.js`
- Modify: `/home/marco/Documentos/Workspace/FEMIC GPT/css/style.css`

- [ ] **Step 1: Criar uma zona de respiro no fim da timeline**

```js
<section id="messages-panel" class="chat-timeline scroll-soft min-h-0 flex-1 space-y-3 overflow-auto pr-2 pb-10">
  ${renderMessages(state)}
  ${state.isLoading ? renderTyping() : ""}
  <div class="timeline-end-spacer" aria-hidden="true"></div>
</section>
```

- [ ] **Step 2: Separar visualmente o composer do corpo**

```js
<footer class="composer-dock shrink-0 pt-3">
  <div class="composer-panel glass-panel rounded-[1.35rem] border border-white/60 px-3 py-3 shadow-panel">
    ...
  </div>
</footer>
```

- [ ] **Step 3: Aplicar tokens visuais premium no CSS**

```css
.composer-dock {
  position: relative;
}

.composer-dock::before {
  content: "";
  display: block;
  height: 24px;
  margin-bottom: 6px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0), rgba(248, 250, 252, 0.92));
  pointer-events: none;
}

.timeline-end-spacer {
  height: 3rem;
}
```

- [ ] **Step 4: Ajustar textarea e controles para um acabamento superior**

```css
#composer-input {
  min-height: 52px;
  border-radius: 1rem;
}

.control-btn {
  backdrop-filter: blur(12px);
}
```

- [ ] **Step 5: Validar a diferenca visual no navegador**

Run: recarregar `http://127.0.0.1:4173/`, abrir uma conversa com conteudo longo e observar o fim da timeline antes do composer.
Expected: existe separacao clara entre ultima mensagem e barra inferior, sem sensacao de elementos colados.

## Self-Review

- Cobertura do spec: audio, leitura, PDF, sidebar e separacao visual do composer aparecem explicitamente nas Tasks 2 a 5.
- Placeholder scan: o plano nao usa `TODO`, `TBD`, nem referencia indireta a “fazer depois”.
- Consistencia: `audio.js` e `pdf.js` definem os helpers usados por `app.js` e `fileProcessor.js`, e o plano preserva os nomes `state.availableVoice`, `createSpeechRecognition` e `getPdfJs` ao longo das tarefas.

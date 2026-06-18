# FEMIC GPT: estabilização funcional e polimento premium

## Objetivo

Executar uma rodada de estabilização focada em:

- corrigir o ditado por voz no Chrome/Edge desktop;
- corrigir a leitura em voz alta das respostas da IA;
- garantir anexos PDF funcionando de forma confiável;
- tornar a barra lateral mais funcional e com navegação melhor;
- elevar o visual com melhor separação entre o fim do conteúdo e a barra inferior.

Esta rodada deve preservar a base atual do app e evitar uma reestruturação ampla.

## Escopo

### Incluído

- ajustes de compatibilidade para `SpeechRecognition` em navegadores suportados;
- ajustes de síntese de voz com seleção e carregamento de vozes disponíveis;
- robustez no carregamento e uso da biblioteca de PDF;
- melhoria de layout, hierarquia visual e usabilidade da sidebar;
- refinamento do compositor inferior para criar respiro entre mensagens e barra de ação;
- validação manual no navegador local.

### Não incluído

- suporte principal a Electron/WebView nesta rodada;
- migração para framework;
- persistência em backend;
- refatoração completa da arquitetura do app.

## Abordagem escolhida

A abordagem aprovada é de correção mínima com polimento cirúrgico.

Isso significa:

- manter a estrutura atual em HTML/CSS/JS modular;
- corrigir primeiro os fluxos quebrados;
- redesenhar apenas os pontos com maior impacto visual e de navegação;
- reduzir risco de regressão.

## Arquitetura da mudança

### 1. Estabilização de áudio

O módulo principal (`js/app.js`) continuará orquestrando o estado de voz, mas com proteção melhor para:

- detectar se o navegador realmente suporta reconhecimento de fala;
- tratar permissões, ausência de microfone e silêncio de forma clara;
- impedir estados presos quando o reconhecimento falhar;
- preparar a leitura em voz alta apenas quando houver voz disponível.

A síntese de voz passará a:

- aguardar o carregamento da lista de vozes quando necessário;
- escolher preferencialmente uma voz em português do Brasil;
- cair para uma voz genérica apenas se não houver voz PT-BR;
- sincronizar corretamente os estados de tocar/parar na interface.

### 2. Estabilização de PDF

O processador de arquivos (`js/fileProcessor.js`) continuará responsável pela extração, mas a leitura de PDF será protegida contra problemas de carregamento global.

O comportamento esperado:

- a biblioteca precisa estar disponível antes da leitura;
- o worker do PDF deve ser configurado de forma consistente;
- falhas de leitura devem gerar mensagens úteis, e não apenas “biblioteca não carregada”;
- o fluxo de anexo deve continuar funcionando para os demais formatos sem regressão.

### 3. Sidebar mais funcional

A sidebar será reorganizada sem trocar o modelo de dados atual.

Melhorias previstas:

- separar melhor áreas de marca, agentes, conversas e ações rápidas;
- destacar a conversa ativa com mais clareza;
- melhorar legibilidade de títulos, datas e ações;
- deixar o modo recolhido mais útil, e não apenas mais estreito;
- reforçar ações principais como nova conversa e configurações.

### 4. Polimento premium no corpo do chat

O layout principal continuará com timeline + composer fixado no rodapé, mas com refinamento visual.

Mudanças previstas:

- criar uma zona de respiro real entre a última mensagem e a barra inferior;
- reforçar a distinção entre área de conteúdo e área de composição;
- melhorar superfícies, bordas, sombra e profundidade;
- reduzir a sensação de “elementos colados” no fim da tela.

## Fluxo de interação

### Ditado por voz

Fluxo sob teste:

`abrir app -> clicar no microfone -> falar -> texto aparecer no composer -> encerrar gravação sem travar estado`

### Leitura em voz alta

Fluxo sob teste:

`resposta da IA renderizada -> clicar em ouvir -> reprodução iniciar -> clicar novamente ou encerrar -> estado voltar ao normal`

### PDF

Fluxo sob teste:

`selecionar PDF -> arquivo ser processado -> chip de anexo aparecer -> contexto ficar pronto para o próximo envio`

### Navegação lateral

Fluxo sob teste:

`trocar agente -> trocar conversa -> criar nova conversa -> recolher/expandir sidebar -> navegação continuar clara`

## Tratamento de erros

- Se o navegador não suportar reconhecimento de fala, mostrar mensagem explícita de incompatibilidade.
- Se a permissão de microfone falhar, informar o motivo ao usuário quando possível.
- Se a leitura em voz alta falhar por falta de vozes disponíveis, informar isso claramente.
- Se o PDF falhar, mostrar erro específico do carregamento ou da extração.

## Testes e validação

Validação manual local no navegador com foco em:

- renderização inicial sem erros de app;
- fluxo do microfone no Chrome/Edge desktop;
- leitura em voz alta com voz disponível;
- anexo de PDF;
- comportamento visual do espaço entre timeline e composer;
- navegação da sidebar em desktop e viewport menor.

Também serão observados:

- logs de console relevantes;
- ausência de overlay de erro;
- resposta visual coerente dos controles tocados.

## Riscos conhecidos

- reconhecimento de fala depende do suporte real do navegador e de contexto seguro;
- leitura em voz alta depende das vozes instaladas/disponíveis no sistema;
- leitura de PDF por CDN pode continuar sensível a bloqueios externos, embora o fluxo fique mais robusto.

## Critérios de sucesso

- o botão de microfone funciona no Chrome/Edge desktop e preenche o composer;
- o botão de ouvir resposta inicia e encerra a fala corretamente;
- PDFs podem ser anexados e processados para contexto;
- a sidebar fica mais clara, prática e fácil de navegar;
- o fim das mensagens deixa de encostar visualmente na barra inferior;
- o app transmite sensação visual mais premium sem perder simplicidade.

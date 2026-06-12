# Relatório de acessibilidade - EDU.IA

Data: 2026-06-12

## Base normativa usada

- LBI - Lei 13.146/2015, art. 63: acessibilidade obrigatória em sites mantidos por empresas com sede ou representação comercial no Brasil, conforme melhores práticas internacionais. Fonte: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm
- Decreto 7.724/2012: reforça diretrizes de acessibilidade na divulgação de informações por órgãos e entidades. Fonte: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/decreto/d7724.htm
- eMAG 3.1: referência brasileira para acessibilidade digital em governo eletrônico, usada como guia prático de marcação, navegação e conteúdo. Fonte: https://emag.governoeletronico.gov.br/
- WCAG 2.1 AA: referência internacional adotada para contraste, teclado, leitor de tela, movimento, linguagem e estrutura semântica. Fonte: https://www.w3.org/TR/WCAG21/

## Auditoria inicial

- Login e cadastro não tinham uma etapa opcional para preferências de acessibilidade.
- O app não tinha menu global de acessibilidade, atalho de teclado ou persistência de preferências por usuário.
- Chat renderizava mensagens sem `aria-live`, e o efeito de digitação podia ser ruim para leitor de tela e pessoas sensíveis a movimento.
- O simulador e a matrícula por IA não adaptavam linguagem, ritmo ou apresentação quando o usuário indicava baixa visão, leitor de tela, daltonismo, autismo/TEA ou preferência por linguagem simples.
- Kanban usava cor como sinal forte da etapa; agora também mostra texto de etapa.
- Upload de documentos na matrícula tinha select/input sem rótulos explícitos.
- PDF de comprovante tinha metadados básicos, mas sem melhorias de idioma, título, assunto e texto auxiliar para o QR.

## Implementado no backend

- Novas preferências no `User`: `screenReader`, `highContrast`, `colorBlindMode`, `reduceMotion`, `simpleLanguage`, `fontScale`.
- Novo módulo `AccessibilityModule`.
- Endpoints autenticados:
  - `GET /me/accessibility`
  - `PUT /me/accessibility`
- Validação de entrada com whitelist, enum de daltonismo e escala de fonte limitada entre 90% e 135%.
- Tool nova para a IA: `ajustar_acessibilidade`.
- Prompt da IA de matrícula agora:
  - detecta e responde em português, inglês ou espanhol;
  - reconhece Brasil, EUA, Canadá e Espanha como origem/documentação;
  - oferece ajustes de acessibilidade sem diagnosticar o usuário;
  - usa linguagem literal e uma pergunta por vez quando `simpleLanguage` está ativo;
  - evita depender de cor, animação ou mensagens longas quando as preferências indicam necessidade.
- Simulador passou a enviar `userId` para o fluxo de matrícula, permitindo salvar preferências disparadas pela conversa.
- PDF de matrícula ganhou metadados mais completos, idioma `pt-BR`, tentativa de saída tagged via PDFKit e texto visível para o QR de autenticação.

## Implementado no frontend

- Composable global `useAccessibility`.
- Persistência local imediata em `localStorage` e sincronização com o servidor após login.
- Atributos globais no `<html>`:
  - `data-high-contrast`
  - `data-reduce-motion`
  - `data-screen-reader`
  - `data-simple-language`
  - `data-color-blind-mode`
- Variável global `--a11y-font-scale`.
- Menu global de acessibilidade com botão fixo e atalho `Alt+A`.
- Preferências opcionais no cadastro, sem obrigar o usuário a se declarar como PCD.
- Modo alto contraste.
- Modos de daltonismo: protanopia, deuteranopia e tritanopia.
- Redução global de animações respeitando preferência do app e `prefers-reduced-motion`.
- Chat com `role="log"` e `aria-live="polite"`.
- Efeito typewriter escondido de leitor de tela e desativado com redução de movimento.
- Campo de mensagem e botão de envio com rótulos acessíveis.
- Cards do kanban com etapa textual, além da cor.
- Upload de documentos com labels explícitos e botões com `aria-label`.

## Limitações conhecidas

- PDFKit ajuda com metadados e estrutura básica, mas não garante conformidade PDF/UA completa. Se o contrato exigir PDF totalmente etiquetado, o próximo passo é validar com ferramenta específica e considerar uma biblioteca/fila especializada.
- A detecção automática de necessidade de acessibilidade pela IA é uma ajuda prática, não diagnóstico médico. O fluxo salva preferências apenas quando o usuário sinaliza claramente a necessidade ou aceita o ajuste.
- A auditoria automatizada final ainda deve ser repetida em produção depois do deploy para capturar diferenças de ambiente, cache e domínio.

## Validação executada

- `backend`: `pnpm exec prisma validate`
- `backend`: `pnpm exec prisma db push`
- `backend`: `pnpm exec prisma generate`
- `backend`: `pnpm run build`
- `frontend`: `pnpm run build`
- `frontend`: `pnpm run type-check`
- API local: login demo, `GET /me/accessibility`, `PUT /me/accessibility` e restauração do perfil demo.
- API em produção: login demo, `GET /me/accessibility`, `PUT /me/accessibility` e restauração do perfil demo.
- Lighthouse local em preview de produção (`http://localhost:4173/login`): acessibilidade 100/100.
- Lighthouse em produção (`https://edu-ia-front.vercel.app/login`): acessibilidade 100/100.

Observação: no servidor de desenvolvimento (`vite dev`), o Lighthouse marcou 96/100 por causa do overlay do Vue DevTools, com `aria-label` em uma `div` interna do plugin. No preview de produção, sem esse overlay, não houve falhas.

# Bloco 9 - Pre-producao e demo comercial

Este bloco fecha a versao demonstravel da EDU.IA antes de plugar APIs reais.

## O que validar na demo

1. Login com `admin@demo.edu` / `Admin@1234`.
2. Simulador respondendo cursos, valores, descontos, documentos, horario, localizacao e transporte.
3. Matricula conduzida pela IA sem mandar para consultor humano.
4. Envio de documentos aceitando PDF unico ou arquivos separados.
5. Pos-venda com pagamento fake, contrato fake, documentos fake, timeline e risco de evasao.
6. Ficha do aluno funcionando como hub operacional.
7. Dashboard executivo exibindo receita, gargalos, funil, risco, automacoes e conversao por curso.
8. Configuracoes permitindo editar mensagens, cursos, documentos, descontos, horarios, localizacao e atendimento.
9. Aba `Pre-producao` mostrando score de prontidao e pendencias da demo.

## O que continua simulado

- WhatsApp real.
- Gateway de pagamento.
- Assinatura digital.
- Upload externo/storage definitivo de documentos.
- Integracao com AVA ou projeto mae.

Esses pontos ja estao isolados por servicos fake, entao a troca futura deve ser feita substituindo a implementacao do servico, sem redesenhar a UI.

## Proximos passos reais

1. Configurar WhatsApp Cloud API: app Meta, numero, webhook, token, templates aprovados.
2. Trocar `FakeWhatsAppService` por implementacao real mantendo os logs.
3. Trocar `FakePaymentService` por gateway real.
4. Trocar `FakeContractService` por D4Sign, Clicksign ou equivalente.
5. Conectar matricula confirmada ao banco/API do projeto principal.
6. Resolver credencial Git local para subir commits no GitHub.

## Observacao para deploy

O frontend pode ser publicado diretamente pela Vercel CLI. O GitHub local ainda precisa de autenticacao para `git push`.

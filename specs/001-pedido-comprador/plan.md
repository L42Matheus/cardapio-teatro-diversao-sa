# Implementation Plan: Pedido do comprador (cardápio, formulário e Pix)

**Branch**: `001-pedido-comprador` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Spec Version**: 4

**Input**: Feature specification from `/specs/001-pedido-comprador/spec.md` (versão 4, aprovada)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A versão 1 da especificação descrevia o código em produção (commit d4e635b). As versões 2, 3 e 4
(CR-001, CR-002, CR-003) acrescentam ou modificam requisitos de percepção por tecnologias
assistivas, navegação estável e nomes/estados/contraste dos controles:

| Requisito | Situação | Origem |
|-----------|----------|--------|
| FR-003 | modificado: atualização periódica sem retirar o foco nem mudar a posição | v3 (CR-002) |
| FR-004 | modificado: formulário na mesma aba (ou aviso antes de nova aba) | v3 (CR-002) |
| FR-012 | novo: foco no primeiro campo inválido, `aria-invalid`, mensagem anunciada | v2 (CR-001) |
| FR-013 | novo: confirmação anunciada; janela como diálogo, com foco de ida e volta | v2 (CR-001) |
| FR-014 | novo: nome acessível do botão de produto identifica o produto | v4 (CR-003) |
| FR-015 | novo: todo controle com nome acessível (ex.: "Enviar anônimo") | v4 (CR-003) |
| FR-016 | novo: categoria ativa informada; emojis fora do nome lido | v4 (CR-003) |
| FR-017 | novo: textos do cardápio (inclusive esgotados) com contraste ≥ 4,5:1 | v4 (CR-003) |

Abordagem técnica: mudanças pequenas no front-end existente (`public/index.html`, `public/app.js`,
`public/style.css`), com HTML/ARIA nativos, JavaScript sem dependências e CSS existente. A API
(`routes/publicas.js`), o banco (`db.js`), a cobrança (`pix.js`) e o webhook (`routes/webhook.js`)
não mudam de comportamento. Detalhes em [research.md](./research.md).

## Technical Context

**Language/Version**: JavaScript (Node.js 20.x no servidor; JavaScript de navegador sem build no front-end), HTML5, CSS3

**Primary Dependencies**: Express 4 (servidor), `pg` (PostgreSQL), `sdk-node-apis-efi` (Pix). Front-end sem frameworks nem bibliotecas (princípio V) — nenhuma dependência nova

**Storage**: PostgreSQL (sem mudança de esquema nesta feature)

**Testing**: os testes de aceitação oficiais e as ferramentas de verificação (EvoSpec-UX) não estão neste workspace; serão aplicados por outra pessoa. Aqui: verificação manual na demonstração local (`npm run demo`, Pix simulado) e checagem de sintaxe (`node --check`)

**Target Platform**: navegadores modernos de celular e computador (o site é usado sobretudo no celular, durante o evento); servidor Linux (Railway)

**Project Type**: aplicação web (servidor Express servindo páginas estáticas em `public/`)

**Performance Goals**: confirmação de pagamento percebida em até 10 s (SC-002; o polling atual é de 2 s); atualização do cardápio a cada 5 s sem re-renderização completa

**Constraints**: sem novas dependências no front-end; preservar temas (trote, prisão, obrigado) e a identidade visual; WCAG 2.2 AA como piso; textos em pt-BR; não tocar em credenciais, `.env` ou certificados

**Scale/Scope**: um evento (centenas de participantes, ~20 produtos); 3 arquivos de front-end alterados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação | Situação |
|-----------|-------------|----------|
| I. Pedido e Pix não regridem | Comportamentos a preservar listados abaixo; API, banco, Pix e webhook não são alterados; nenhuma leitura de `.env`, credenciais ou certificados | PASSA (reverificação oficial pendente — ver abaixo) |
| II. Acessibilidade verificável | O plano implementa FR-012 a FR-017 e ajusta FR-003/FR-004; nenhuma barreira nova introduzida | PASSA (verificação automática e inspeção oficiais pendentes) |
| III. Especificação como fonte da verdade | `**Spec Version**: 4` neste plano e em `tasks.md`; anotação `@spec 001-pedido-comprador@4` nos arquivos de código da feature | PASSA |
| IV. Evolução por evidências | Spec v4 aprovada por Lucas Matheus Silva (CR-001..CR-003; EVD-01..EVD-05, EVD-07, EVD-08). As pastas `evidence/` e `changes/` não estão neste workspace: não foi possível conferir os documentos | PASSA com ressalva (conferência de evidências/propostas pendente) |
| V. Mudanças pequenas, sem dependências | Só HTML/CSS/JS existentes; temas e textos preservados; nomes acessíveis acrescentados sem mudar o texto visível | PASSA |

**Comportamentos de pedido e pagamento a preservar (princípio I)**:

1. Cardápio lista produtos com foto, nome, descrição, preço e estoque; filtro por categoria.
2. Produto esgotado e pedidos pausados impedem a escolha.
3. Abertura do formulário pelo endereço `/?produto=<id>`; produto inexistente mostra "Produto não encontrado".
4. Validações (nome ≥ 4, WhatsApp com 10/11 dígitos, destinatário ≥ 4, equipe da lista, mensagem ≤ 50) no cliente e no servidor.
5. Vários destinatários em uma única cobrança (`POST /api/pedidos` com `destinatarios`).
6. Trava contra cliques repetidos em "Gerar cobrança Pix" (`enviandoPedido`).
7. Exibição de código, valor, copia e cola (com cópia) e contagem até a expiração; mensagem de Pix expirado.
8. Polling de `GET /api/pedidos/:ticket` a cada 2 s e popup no tema do produto (obrigado, polícia, padrão).
9. Webhook `/webhook/pix` e estoque transacional no servidor — sem alteração.

**Portões externos pendentes** (não existem neste workspace): validação de governança do
EvoSpec-UX, testes de aceitação dos novos requisitos (escritos por quem não implementa) e
reverificação dos comportamentos acima antes da integração na `main`.

## Project Structure

### Documentation (this feature)

```text
specs/001-pedido-comprador/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan)
├── quickstart.md        # Fase 1 (/speckit-plan)
├── contracts/
│   └── ui-acessibilidade.md   # Contrato de interface (DOM/ARIA) da página pública
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
server.js                 # sem mudança
routes/publicas.js        # sem mudança de comportamento (anotação @spec)
db.js, pix.js, routes/webhook.js   # sem mudança
public/
├── index.html            # cardápio, formulário, Pix e popups (alterado)
├── app.js                # lógica do comprador (alterado)
└── style.css             # identidade visual compartilhada (alterado: contraste, sr-only, foco)
```

**Structure Decision**: projeto único existente (Express + `public/`). Nenhum diretório novo de
código; as mudanças ficam nos três arquivos de front-end da página do comprador.

## Complexity Tracking

Sem violações da constituição a justificar.

## Post-Design Constitution Check

Reavaliado após a Fase 1: o contrato de interface usa apenas atributos HTML/ARIA nativos
(`aria-pressed`, `aria-invalid`, `aria-describedby`, `role="alert"`, `role="dialog"`,
`aria-modal`, `inert`), sem bibliotecas; a API pública não muda; temas preservados. Todos os
princípios continuam PASSANDO, com as mesmas pendências externas.

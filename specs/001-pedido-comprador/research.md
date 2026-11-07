# Research: Pedido do comprador (Spec Version 4)

**Spec Version**: 4

Não havia itens "NEEDS CLARIFICATION" no Technical Context. As decisões abaixo resolvem como
implementar os requisitos novos/modificados no código existente, sem dependências novas.
Não houve usuário disponível para perguntas: cada escolha registra a opção considerada mais
razoável.

## R1 — Atualização periódica sem perder foco nem posição (FR-003)

- **Decision**: a cada 5 s, buscar `/api/produtos` e `/api/status` e **atualizar no lugar** os
  cartões existentes (texto de estoque, classe `esgotado`, estado e nome do botão), sem recriar o
  DOM. Recriação completa só quando a lista de produtos visíveis muda (produto novo/removido,
  nome, foto, preço ou descrição alterados); nesse caso o foco é devolvido ao botão equivalente e
  a rolagem é preservada. O aviso de pausa só é reescrito quando muda.
- **Detalhe**: um botão que precisa ser desabilitado enquanto está com o foco recebe
  `aria-disabled="true"` (continua focável, não aciona) e só vira `disabled` quando perde o foco,
  porque desabilitar um elemento focado tira o foco dele.
- **Rationale**: o código atual faz `container.innerHTML = ''` a cada 5 s, o que retira o foco e
  pode mudar a posição de leitura (EVD-03/EVD-05).
- **Alternatives considered**: (a) parar a atualização quando há foco no cardápio — deixaria o
  estoque desatualizado; (b) usar sempre `aria-disabled` — mudaria a semântica de "não pode ser
  escolhido" que testes existentes podem conferir com `disabled`.

## R2 — Formulário na mesma aba (FR-004)

- **Decision**: "Enviar este"/"Denunciar" navega na **mesma aba** para `/?produto=<id>` (o fluxo
  por endereço já existe). "Voltar ao cardápio"/"Cancelar" volta pelo histórico quando a página
  anterior é o cardápio do próprio site, ou navega para `/`; `window.close()` é removido.
- **Rationale**: abrir nova aba sem aviso desorienta (WCAG 3.2.5) e é a mudança da v3. A mesma aba
  preserva o endereço `/?produto=` (edge case "Produto não encontrado") sem reescrever o fluxo.
- **Alternatives considered**: (a) manter nova aba com aviso no nome do botão — mais texto e a
  aba extra continua; (b) abrir o formulário na própria página sem navegar — mudança maior.

## R3 — Erros de validação percebidos (FR-012)

- **Decision**: cada validação aponta o campo a corrigir; o sistema marca `aria-invalid="true"`
  e `aria-describedby="form-erro"` no campo, leva o foco a ele e escreve a mensagem em
  `#form-erro`, que passa a ter `role="alert"` (anúncio sem ação do participante). A marcação é
  limpa quando o participante altera o campo ou em nova tentativa. Mensagens de destinatário
  passam a dizer exatamente o que falta (nome com 4 caracteres ou equipe), usando os textos do
  tema (ex.: "Nome do suspeito" na prisão). Erros vindos do servidor são associados ao campo pelo
  conteúdo da mensagem quando possível.
- **Alternatives considered**: mensagens por campo (uma por input) — mais HTML e mudança visual.

## R4 — Confirmação do pagamento (FR-013)

- **Decision**: os três popups (`popup-pagamento`, `popup-obrigado`, `popup-policia`) recebem
  `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (título) e `aria-describedby` (texto),
  além de `tabindex="-1"` no cartão. Ao abrir: guardar o elemento focado, marcar o restante da
  página como `inert`, focar o cartão do diálogo (o botão "Entendi" dos temas obrigado/polícia só
  aparece após 3,5 s; quando aparece, o foco vai para ele). Tab fica preso no diálogo; Esc fecha.
  Ao fechar: retirar `inert` e devolver o foco ao elemento guardado (ou ao título do Pix). O
  `#pix-status` ganha `role="status"` para anunciar "pagamento confirmado" mesmo fora do diálogo.
- **Alternatives considered**: `<dialog>` nativo com `showModal()` — mudaria o CSS das
  sobreposições e animações dos temas.

## R5 — Nomes acessíveis (FR-014, FR-015)

- **Decision**: botão do produto com `aria-label` "Enviar <produto>", "Denunciar <produto>" ou
  "<produto> esgotado"; texto visível mantido. Opção anônima: texto visualmente oculto (`.sr-only`)
  dentro do `<label>` ("Enviar anônimo"/"Denúncia anônima", trocado pelo tema). "Copia e cola"
  vira `<label for="pix-copiacola">`; botões "Remover" recebem "Remover <nome>"; emoji do botão
  copiar fica `aria-hidden`.
- **Rationale**: o `aria-label` atual está no `<label>` (não nomeia o checkbox) e o conteúdo do
  label é só um emoji.

## R6 — Categoria ativa e emojis (FR-016)

- **Decision**: abas viram botões de alternância com `aria-pressed` (true na ativa) dentro de um
  grupo `role="group"` com nome "Categorias"; emojis em `<span aria-hidden="true">` nas abas, na
  etiqueta de categoria do cartão e no resumo do pedido.
- **Alternatives considered**: padrão `tablist`/`tab` — exigiria navegação por setas e painéis.

## R7 — Contraste (FR-017)

- **Decision**: remover `opacity: 0.6` do cartão esgotado (fica só a foto em tons de cinza e
  esmaecida); botões desabilitados do cardápio com cores próprias legíveis (texto `#4a4a4a` sobre
  `#efefec`, ≈ 8:1) em vez de `opacity: .45`; vermelho de "Últimas unidades"/"Esgotado" passa de
  `#e53935` (≈ 4,0:1) para `#c62828` (≈ 5,6:1 sobre branco). Verde (`#2e7d32`, ≈ 5,1:1), texto
  fraco (`#6b6b6b`, ≈ 5,3:1) e etiqueta (`#2b2b2b` sobre `#f5b301`) já atendem.
- **Rationale**: preserva a identidade (o cartão esgotado continua visualmente "apagado" pela
  foto) e garante 4,5:1 no texto.

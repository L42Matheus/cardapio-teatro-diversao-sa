// @spec 001-pedido-comprador@4
let produtoSelecionado = null;
let ticketAtual = null;
let intervaloConsulta = null;
let intervaloExpiracao = null;

let categorias = [];
let produtos = [];
let categoriaAtiva = 'todos';
let pedidosPausados = false;
let modoPedidoDireto = false;
let destinatariosPedido = [];

function nomeValido(nome) {
  return String(nome || '').trim().length >= 4;
}

function somenteDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

function telefoneValido(contato) {
  const digitos = somenteDigitos(contato);
  return digitos.length === 10 || digitos.length === 11;
}

// ---------- Erros do formulario (FR-012) ----------
const CAMPOS_FORMULARIO = ['nomeComprador', 'contato', 'nomeDestinatario', 'equipeDestinatario', 'mensagemEspecial'];

// Mostra a mensagem em #form-erro (role="alert", anunciada sem acao do
// participante) e, se houver campo, marca-o como invalido e leva o foco a ele.
function marcarErroCampo(idCampo, mensagem) {
  const erroEl = document.getElementById('form-erro');
  erroEl.textContent = mensagem;
  erroEl.classList.remove('oculto');
  const campo = idCampo ? document.getElementById(idCampo) : null;
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.setAttribute('aria-describedby', 'form-erro');
    campo.focus();
  }
}

function limparErroCampo(campo) {
  if (!campo) return;
  campo.removeAttribute('aria-invalid');
  if (campo.getAttribute('aria-describedby') === 'form-erro') campo.removeAttribute('aria-describedby');
}

function limparErrosCampos() {
  CAMPOS_FORMULARIO.forEach(id => limparErroCampo(document.getElementById(id)));
  const erroEl = document.getElementById('form-erro');
  if (erroEl) {
    erroEl.textContent = '';
    erroEl.classList.add('oculto');
  }
}

// Erro de um destinatario: { campo, mensagem } ou null. Usa os textos do tema
// (ex.: "Nome do suspeito" na prisao).
function erroDestinatario(d) {
  if (!nomeValido(d.nomeDestinatario)) {
    return { campo: 'nomeDestinatario', mensagem: `O campo "${textosFormulario.nome}" precisa ter pelo menos 4 caracteres.` };
  }
  if (!d.equipeDestinatario) {
    return { campo: 'equipeDestinatario', mensagem: `Escolha na lista o campo "${textosFormulario.equipe}".` };
  }
  return null;
}

// Associa a mensagem de erro do servidor ao campo correspondente.
function campoDoErroServidor(mensagem) {
  const m = String(mensagem || '').toLowerCase();
  if (m.includes('whatsapp')) return 'contato';
  if (m.includes('seu nome')) return 'nomeComprador';
  if (m.includes('equipe')) return 'equipeDestinatario';
  if (m.includes('quem vai receber') || m.includes('pessoa')) return 'nomeDestinatario';
  return null;
}

// ---------- Status (botão do pânico) ----------
// Atualizado a cada 5 s; so mexe na pagina quando a pausa muda, para nao
// tirar o foco nem a posicao de quem esta navegando (FR-003).
async function carregarStatus() {
  const res = await fetch('/api/status');
  const dados = await res.json();
  const pausado = !!dados.pausado;
  const mudou = pausado !== pedidosPausados;
  pedidosPausados = pausado;

  const info = document.getElementById('estoque-info');
  const texto = pedidosPausados
    ? '⏸️ Pedidos pausados no momento. Volte a tentar em instantes.'
    : '';
  if (info.textContent !== texto) info.textContent = texto;

  if (mudou) {
    document.querySelectorAll('#lista-produtos .produto-card').forEach(card => {
      const produto = produtos.find(p => String(p.id) === card.dataset.produtoId);
      if (produto) atualizarBotaoProduto(card.querySelector('button.destaque'), produto);
    });
  }
}

// ---------- Abas de categoria ----------
async function carregarCategorias() {
  const res = await fetch('/api/categorias');
  categorias = await res.json();

  const abas = document.getElementById('abas-categorias');
  abas.innerHTML = '';

  const todos = criarAba('todos', '✨', 'Todos');
  abas.appendChild(todos);

  categorias.forEach(cat => {
    abas.appendChild(criarAba(cat.id, cat.emoji, cat.nome));
  });

  marcarAbaAtiva();
}

// Emoji decorativo fica fora do nome lido (FR-016).
function htmlEmojiTexto(emoji, texto) {
  return `${emoji ? `<span aria-hidden="true">${esc(emoji)}</span> ` : ''}${esc(texto)}`;
}

function criarAba(id, emoji, texto) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'aba';
  btn.dataset.categoria = id;
  btn.innerHTML = htmlEmojiTexto(emoji, texto);
  btn.setAttribute('aria-pressed', 'false');
  btn.onclick = () => {
    categoriaAtiva = id;
    marcarAbaAtiva();
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    renderizarProdutos();
  };
  return btn;
}

// A categoria ativa e informada a tecnologias assistivas por aria-pressed (FR-016).
function marcarAbaAtiva() {
  document.querySelectorAll('#abas-categorias .aba').forEach(a => {
    const ativa = a.dataset.categoria === categoriaAtiva;
    a.classList.toggle('ativa', ativa);
    a.setAttribute('aria-pressed', ativa ? 'true' : 'false');
  });
}

// ---------- Produtos ----------
async function carregarProdutos() {
  const res = await fetch('/api/produtos');
  produtos = await res.json();
  renderizarProdutos();
}

// Atualizacao periodica (FR-003): atualiza os cartoes no lugar; so recria a
// lista quando os produtos exibidos mudam, devolvendo foco e rolagem.
async function atualizarProdutos() {
  let novos;
  try {
    const res = await fetch('/api/produtos');
    if (!res.ok) return;
    novos = await res.json();
  } catch (err) {
    return; // sem conexao: tenta de novo no proximo ciclo
  }
  const assinatura = lista => lista
    .filter(p => categoriaAtiva === 'todos' || p.categoria === categoriaAtiva)
    .map(p => [p.id, p.nome, p.descricao, p.foto, p.preco, p.categoria].join('|'))
    .join('\n');
  const mesmaLista = assinatura(novos) === assinatura(produtos);
  produtos = novos;

  if (!mesmaLista) {
    const focado = document.activeElement;
    const card = focado && focado.closest ? focado.closest('#lista-produtos .produto-card') : null;
    const idFocado = card ? card.dataset.produtoId : null;
    const rolagem = window.scrollY;
    renderizarProdutos();
    if (idFocado) {
      const novoBotao = document.querySelector(`#lista-produtos .produto-card[data-produto-id="${CSS.escape(idFocado)}"] button`);
      if (novoBotao) novoBotao.focus({ preventScroll: true });
    }
    window.scrollTo({ top: rolagem });
    return;
  }

  document.querySelectorAll('#lista-produtos .produto-card').forEach(card => {
    const produto = produtos.find(p => String(p.id) === card.dataset.produtoId);
    if (!produto) return;
    const esgotado = Number(produto.estoque) <= 0;
    card.classList.toggle('esgotado', esgotado);
    const estoqueEl = card.querySelector('.estoque-info');
    const htmlEstoque = textoEstoque(produto.estoque);
    if (estoqueEl && estoqueEl.outerHTML !== htmlEstoque) estoqueEl.outerHTML = htmlEstoque;
    atualizarBotaoProduto(card.querySelector('button.destaque'), produto);
  });
}

function nomeCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? `${c.emoji} ${c.nome}` : id;
}

function htmlCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? htmlEmojiTexto(c.emoji, c.nome) : esc(id);
}

function produtoIndisponivel(produto) {
  return pedidosPausados || Number(produto.estoque) <= 0;
}

// Texto visivel e nome acessivel do botao do produto (FR-014).
function rotulosBotaoProduto(produto) {
  if (Number(produto.estoque) <= 0) {
    return { html: 'Esgotado', nome: `${produto.nome} esgotado` };
  }
  if (produto.categoria === 'prisao') {
    return { html: '<span aria-hidden="true">🚔</span> Denunciar', nome: `Denunciar ${produto.nome}` };
  }
  return { html: 'Enviar este', nome: `Enviar ${produto.nome}` };
}

// Aplica estado e rotulo ao botao sem recria-lo. Um botao com foco nao e
// desabilitado na hora (isso tiraria o foco dele): fica aria-disabled ate
// perder o foco (FR-002, FR-003).
function atualizarBotaoProduto(btn, produto) {
  if (!btn) return;
  const rotulos = rotulosBotaoProduto(produto);
  if (btn.innerHTML !== rotulos.html) btn.innerHTML = rotulos.html;
  if (btn.getAttribute('aria-label') !== rotulos.nome) btn.setAttribute('aria-label', rotulos.nome);

  const indisponivel = produtoIndisponivel(produto);
  if (!indisponivel) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    return;
  }
  if (btn.disabled) return;
  if (document.activeElement === btn) {
    if (btn.getAttribute('aria-disabled') === 'true') return; // ja aguardando o blur
    btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('blur', () => {
      const atual = produtos.find(p => String(p.id) === String(produto.id));
      if (atual && produtoIndisponivel(atual)) {
        btn.disabled = true;
        btn.removeAttribute('aria-disabled');
      }
    }, { once: true });
  } else {
    btn.disabled = true;
    btn.removeAttribute('aria-disabled');
  }
}

// Escapa texto antes de colocar em innerHTML (nomes e equipes digitados).
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Estoque no card: verde quando tem bastante, vermelho com urgencia quando
// esta acabando (ate ESTOQUE_ULTIMAS unidades) e "Esgotado" quando zera.
const ESTOQUE_ULTIMAS = 10;
function textoEstoque(estoque) {
  const n = Number(estoque);
  if (n <= 0) return '<p class="estoque-info zerado">Esgotado</p>';
  if (n <= ESTOQUE_ULTIMAS) {
    return `<p class="estoque-info ultimas">🔥 ${n === 1 ? 'Última unidade!' : `Últimas ${n} unidades!`}</p>`;
  }
  return `<p class="estoque-info tem">${n} disponíveis</p>`;
}

function renderizarProdutos() {
  const container = document.getElementById('lista-produtos');
  container.innerHTML = '';

  const filtrados = categoriaAtiva === 'todos'
    ? produtos
    : produtos.filter(p => p.categoria === categoriaAtiva);

  if (filtrados.length === 0) {
    container.innerHTML = `<div class="aviso info">Nenhum item nesta categoria por enquanto.</div>`;
    return;
  }

  filtrados.forEach(p => {
    const esgotado = Number(p.estoque) <= 0;
    const rotulos = rotulosBotaoProduto(p);
    const div = document.createElement('div');
    div.className = `produto-card${esgotado ? ' esgotado' : ''}`;
    div.dataset.produtoId = String(p.id);
    div.innerHTML = `
      <div class="imagem">
        <img src="${esc(p.foto)}" alt="${esc(p.nome)}" onerror="this.style.opacity=0.2">
      </div>
      ${p.categoria ? `<span class="categoria-tag">${htmlCategoria(p.categoria)}</span>` : ''}
      <h3>${esc(p.nome)}</h3>
      <p class="descricao">${esc(p.descricao || '')}</p>
      <div class="preco">R$ ${p.preco.toFixed(2).replace('.', ',')}</div>
      ${textoEstoque(p.estoque)}
      <button type="button" class="destaque" ${produtoIndisponivel(p) ? 'disabled' : ''} aria-label="${esc(rotulos.nome)}">${rotulos.html}</button>
    `;
    div.querySelector('button.destaque').addEventListener('click', () => abrirFormulario(p.id, p.nome));
    container.appendChild(div);
  });
}

// ---------- Formulário ----------
// O formulario abre na mesma aba (FR-004).
function abrirFormulario(id, nome) {
  const produto = produtos.find(p => Number(p.id) === Number(id));
  if (pedidosPausados) {
    alert('Os pedidos estão pausados no momento. Tente novamente em instantes.');
    return;
  }
  if (produto && Number(produto.estoque) <= 0) return; // esgotado (botao aria-disabled)

  if (!modoPedidoDireto) {
    window.location.href = `/?produto=${encodeURIComponent(id)}`;
    return;
  }

  abrirFormularioNaPagina(id, nome);
}

function abrirFormularioNaPagina(id, nome, opcoes = {}) {
  if (pedidosPausados) {
    alert('Os pedidos estão pausados no momento. Tente novamente em instantes.');
    return;
  }
  produtoSelecionado = id;
  destinatariosPedido = [];
  const produto = produtos.find(p => Number(p.id) === Number(id));
  if (produto) preencherResumoPedido(produto);
  aplicarTemaFormulario(produto);
  document.getElementById('secao-formulario').classList.remove('oculto');
  document.getElementById('secao-pix').classList.add('oculto');
  limparErrosCampos();
  renderizarDestinatariosPedido();
  atualizarBotoesPedido();
  if (!opcoes.semScroll) {
    window.scrollTo({
      top: document.getElementById('secao-formulario').offsetTop - 20,
      behavior: 'smooth'
    });
  }
}

// Textos do formulario. Para a prisao o formulario vira uma "denuncia" na
// Delegacia EAC; os outros produtos usam os textos normais.
const TEXTOS_FORMULARIO = {
  padrao: {
    etapa1: '1. Quem está enviando?',
    anonimo: 'Enviar anônimo',
    etapa2: '2. Quem vai receber?',
    nome: 'Nome de quem vai receber',
    nomePlaceholder: 'Nome de quem receberá a surpresa',
    equipe: 'Equipe do destinatário',
    etapa3: '3. Mensagem ou instrução especial',
    mensagem: 'Mensagem ou instrução especial',
    mensagemPlaceholder: 'Recado curto, até 50 caracteres',
    tituloLista: n => `${n} pessoa${n > 1 ? 's' : ''} adicionada${n > 1 ? 's' : ''}`,
    maisUma: 'Enviar para mais uma pessoa',
    adicionar: 'Adicionar esta pessoa à lista',
    gerar: 'Gerar cobrança Pix',
    gerarVarios: n => `Gerar Pix para ${n} pessoa${n > 1 ? 's' : ''}`
  },
  prisao: {
    etapa1: '1. Quem está denunciando?',
    anonimo: 'Denúncia anônima',
    etapa2: '2. Quem deve ser preso?',
    nome: 'Nome do suspeito',
    nomePlaceholder: 'Nome de quem vai para a prisão',
    equipe: 'Equipe do suspeito',
    etapa3: '3. Qual foi o crime?',
    mensagem: 'Motivo da prisão',
    mensagemPlaceholder: 'Ex.: furou a fila do lanche',
    tituloLista: n => `${n} suspeito${n > 1 ? 's' : ''} na lista`,
    maisUma: 'Denunciar mais uma pessoa',
    adicionar: 'Adicionar este suspeito à lista',
    gerar: 'Gerar Pix do mandado',
    gerarVarios: n => `Gerar Pix para ${n} mandado${n > 1 ? 's' : ''}`
  }
};
let textosFormulario = TEXTOS_FORMULARIO.padrao;

function aplicarTemaFormulario(produto) {
  const prisao = !!produto && produto.categoria === 'prisao';
  const t = { ...(prisao ? TEXTOS_FORMULARIO.prisao : TEXTOS_FORMULARIO.padrao) };
  if (prisao && /padre/i.test(produto.nome)) {
    Object.assign(t, { etapa2: '2. Qual padre deve ser preso?', nome: 'Nome do padre', nomePlaceholder: 'Ex.: Padre João', equipe: 'Equipe do padre' });
  } else if (prisao && /coordenador/i.test(produto.nome)) {
    Object.assign(t, { etapa2: '2. Qual coordenador deve ser preso?', nome: 'Nome do coordenador', nomePlaceholder: 'Nome do coordenador', equipe: 'Equipe do coordenador' });
  }
  textosFormulario = t;

  document.getElementById('secao-formulario').classList.toggle('modo-prisao', prisao);
  document.getElementById('faixa-delegacia').classList.toggle('oculto', !prisao);
  document.getElementById('txt-etapa-1').textContent = t.etapa1;
  // Nome acessivel do checkbox vem do texto oculto dentro do label (FR-015).
  document.getElementById('check-anonimo').title = t.anonimo;
  document.getElementById('txt-anonimo').textContent = t.anonimo;
  document.getElementById('txt-etapa-2').textContent = t.etapa2;
  document.getElementById('txt-nome-destinatario').textContent = t.nome;
  document.getElementById('nomeDestinatario').placeholder = t.nomePlaceholder;
  document.getElementById('txt-equipe-destinatario').textContent = t.equipe;
  document.getElementById('txt-etapa-3').textContent = t.etapa3;
  document.getElementById('txt-mensagem').textContent = t.mensagem;
  document.getElementById('mensagemEspecial').placeholder = t.mensagemPlaceholder;
}

function preencherResumoPedido(produto) {
  document.getElementById('pedido-resumo')?.classList.remove('oculto');
  const foto = document.getElementById('pedido-resumo-foto');
  foto.src = produto.foto;
  foto.alt = produto.nome;
  document.getElementById('pedido-resumo-categoria').innerHTML = produto.categoria ? htmlCategoria(produto.categoria) : '';
  document.getElementById('pedido-resumo-nome').textContent = produto.nome;
  document.getElementById('pedido-resumo-valor').textContent = `R$ ${produto.preco.toFixed(2).replace('.', ',')}`;
}

function cancelarFormulario() {
  voltarAoCardapio();
}

function voltarAoCardapio() {
  pararContagemExpiracao();
  if (intervaloConsulta) { clearInterval(intervaloConsulta); intervaloConsulta = null; }
  if (modoPedidoDireto) {
    // Mesma aba (FR-004): volta pelo historico se veio do cardapio (mantem a
    // posicao), senao abre o cardapio.
    let veioDoCardapio = false;
    try {
      const anterior = document.referrer ? new URL(document.referrer) : null;
      veioDoCardapio = !!anterior && anterior.origin === window.location.origin
        && anterior.pathname === '/' && !anterior.searchParams.get('produto');
    } catch (err) { veioDoCardapio = false; }
    if (veioDoCardapio && window.history.length > 1) window.history.back();
    else window.location.href = '/';
    return;
  }
  document.getElementById('secao-formulario').classList.add('oculto');
  document.getElementById('secao-pix').classList.add('oculto');
  document.getElementById('pedido-resumo')?.classList.add('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function dadosDestinatarioAtual() {
  return {
    nomeDestinatario: document.getElementById('nomeDestinatario').value.trim(),
    equipeDestinatario: document.getElementById('equipeDestinatario').value.trim(),
    anonimo: document.getElementById('anonimo').checked,
    mensagemEspecial: document.getElementById('mensagemEspecial').value.trim()
  };
}

function destinatarioAtualCompleto() {
  const atual = dadosDestinatarioAtual();
  return !!atual.nomeDestinatario && !!atual.equipeDestinatario;
}

function quantidadeDestinatariosParaPix() {
  return destinatariosPedido.length + (destinatarioAtualCompleto() ? 1 : 0);
}

function atualizarBotoesPedido() {
  const btnAdicionar = document.getElementById('btn-adicionar-destinatario');
  const btnGerar = document.getElementById('btn-gerar-pix');
  const quantidade = quantidadeDestinatariosParaPix();

  if (btnAdicionar) {
    btnAdicionar.disabled = !destinatarioAtualCompleto();
    btnAdicionar.textContent = destinatariosPedido.length > 0
      ? textosFormulario.adicionar
      : textosFormulario.maisUma;
  }

  if (btnGerar) {
    btnGerar.textContent = quantidade > 0
      ? textosFormulario.gerarVarios(quantidade)
      : textosFormulario.gerar;
  }
}

function limparDestinatarioAtual() {
  document.getElementById('nomeDestinatario').value = '';
  document.getElementById('equipeDestinatario').value = '';
  document.getElementById('anonimo').checked = false;
  document.getElementById('mensagemEspecial').value = '';
  atualizarBotoesPedido();
  document.getElementById('nomeDestinatario').focus();
}

function renderizarDestinatariosPedido() {
  const box = document.getElementById('lista-destinatarios');
  if (!box) return;
  if (destinatariosPedido.length === 0) {
    box.classList.add('oculto');
    box.innerHTML = '';
    atualizarBotoesPedido();
    return;
  }

  box.classList.remove('oculto');
  box.innerHTML = `
    <div class="destinatarios-titulo">${textosFormulario.tituloLista(destinatariosPedido.length)}</div>
    ${destinatariosPedido.map((d, i) => `
      <div class="destinatario-item">
        <span><strong>${i + 1}. ${esc(d.nomeDestinatario)}</strong><br><small>${esc(d.equipeDestinatario)}</small></span>
        ${d.anonimo ? '<span class="pill-info">Anônimo</span>' : ''}
        <button type="button" class="secundario pequeno" onclick="removerDestinatario(${i})" aria-label="Remover ${esc(d.nomeDestinatario)}">Remover</button>
      </div>
    `).join('')}
  `;
  atualizarBotoesPedido();
}

function adicionarDestinatario() {
  const destinatario = dadosDestinatarioAtual();
  limparErrosCampos();

  const erro = erroDestinatario(destinatario);
  if (erro) {
    marcarErroCampo(erro.campo, erro.mensagem);
    return;
  }

  destinatariosPedido.push(destinatario);
  renderizarDestinatariosPedido();
  limparDestinatarioAtual();
}

function removerDestinatario(indice) {
  destinatariosPedido.splice(indice, 1);
  renderizarDestinatariosPedido();
  atualizarBotoesPedido();
}

function montarDestinatariosParaEnvio() {
  const atual = dadosDestinatarioAtual();
  const lista = [...destinatariosPedido];
  if (atual.nomeDestinatario || atual.equipeDestinatario) {
    lista.push(atual);
  }
  return lista;
}

let enviandoPedido = false;

async function enviarPedido() {
  // Trava contra cliques repetidos (ex: clicar varias vezes enquanto a API
  // ainda esta respondendo) — sem isso, cada clique gerava um pedido/Pix
  // duplicado. So libera de novo quando a requisicao terminar (sucesso ou erro).
  if (enviandoPedido) return;

  const nomeComprador = document.getElementById('nomeComprador').value.trim();
  const contato = document.getElementById('contato').value.trim();
  const destinatarios = montarDestinatariosParaEnvio();
  limparErrosCampos();

  // Erro de validacao: foco no primeiro campo a corrigir, campo marcado como
  // invalido e mensagem anunciada (#form-erro e role="alert") (FR-006, FR-012).
  if (!nomeValido(nomeComprador)) {
    marcarErroCampo('nomeComprador', 'Seu nome precisa ter pelo menos 4 caracteres.');
    return;
  }

  if (!telefoneValido(contato)) {
    marcarErroCampo('contato', 'Informe um WhatsApp válido com DDD. Ex: (83) 90000-0000.');
    return;
  }

  if (destinatarios.length === 0) {
    marcarErroCampo('nomeDestinatario', `Preencha o campo "${textosFormulario.nome}" com pelo menos 4 caracteres.`);
    return;
  }
  const invalido = destinatarios.find(d => erroDestinatario(d));
  if (invalido) {
    const erro = erroDestinatario(invalido);
    marcarErroCampo(erro.campo, erro.mensagem);
    return;
  }

  const btnGerar = document.getElementById('btn-gerar-pix');
  const textoOriginalBtn = btnGerar.textContent;
  enviandoPedido = true;
  btnGerar.disabled = true;
  btnGerar.textContent = 'Gerando cobrança…';

  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produtoId: produtoSelecionado,
        nomeComprador,
        contato,
        destinatarios
      })
    });

    const dados = await res.json();

    if (!res.ok) {
      const mensagem = dados.erro || 'Erro ao criar pedido.';
      marcarErroCampo(campoDoErroServidor(mensagem), mensagem);
      return;
    }

    ticketAtual = dados.ticket;
    document.getElementById('secao-formulario').classList.add('oculto');
    document.getElementById('secao-pix').classList.remove('oculto');
    document.getElementById('pix-ticket').textContent = dados.ticket;
    document.getElementById('pix-valor').textContent = `R$ ${dados.pix.valor.toFixed(2).replace('.', ',')}`;
    document.getElementById('pix-copiacola').value = dados.pix.copiaECola;
    renderizarItensPix(dados.itens || []);
    document.getElementById('pix-status').innerHTML =
      'Status: <span class="status-pendente_pagamento">aguardando pagamento...</span>';

    window.scrollTo({
      top: document.getElementById('secao-pix').offsetTop - 20,
      behavior: 'smooth'
    });
    // O botao focado sumiu com o formulario: leva o foco ao titulo do Pix.
    document.getElementById('titulo-pix')?.focus({ preventScroll: true });

    iniciarContagemExpiracao(dados.pix.expiraEm);
    iniciarPollingStatus(dados.ticket);
  } catch (err) {
    marcarErroCampo(null, 'Falha de conexão. Verifique sua internet e tente novamente.');
  } finally {
    enviandoPedido = false;
    btnGerar.disabled = false;
    btnGerar.textContent = textoOriginalBtn;
  }
}

async function copiarPixCopiaECola() {
  const campo = document.getElementById('pix-copiacola');
  const texto = campo.value;
  const btn = document.getElementById('btn-copiar-pix');

  try {
    await navigator.clipboard.writeText(texto);
  } catch (err) {
    // Fallback para navegadores sem suporte a Clipboard API (ex: contexto sem HTTPS)
    campo.select();
    campo.setSelectionRange(0, texto.length);
    document.execCommand('copy');
  }

  const textoOriginal = btn.textContent;
  btn.textContent = '✅ Copiado!';
  setTimeout(() => { btn.textContent = textoOriginal; }, 2000);
}

function renderizarItensPix(itens) {
  const box = document.getElementById('pix-itens');
  if (!box) return;
  if (!Array.isArray(itens) || itens.length <= 1) {
    box.classList.add('oculto');
    box.innerHTML = '';
    return;
  }

  box.classList.remove('oculto');
  box.innerHTML = `
    <div class="destinatarios-titulo">${itens.length} entregas neste pedido</div>
    ${itens.map((item, i) => `
      <div class="destinatario-item sem-acao">
        <span><strong>${i + 1}. ${esc(item.destinatario)}</strong><br><small>${esc(item.equipe)}</small></span>
        ${item.anonimo ? '<span class="pill-info">Anônimo</span>' : ''}
        <span>${Number(item.valor).toFixed(2).replace('.', ',')}</span>
      </div>
    `).join('')}
  `;
}

function iniciarPollingStatus(ticket) {
  if (intervaloConsulta) clearInterval(intervaloConsulta);
  intervaloConsulta = setInterval(async () => {
    const res = await fetch(`/api/pedidos/${ticket}`);
    if (!res.ok) return;
    const dados = await res.json();
    if (dados.status !== 'pendente_pagamento') {
      document.getElementById('pix-status').innerHTML =
        `Status: <span class="status-${dados.status}">${legendaStatus(dados.status)}</span> — pagamento confirmado! Guarde seu código <strong>${dados.ticket}</strong>.`;
      clearInterval(intervaloConsulta);
      pararContagemExpiracao();
      if (!mostrarPopupPolicia(dados) && !mostrarPopupObrigado(dados)) mostrarPopupPagamento(dados.ticket);
    }
  }, 2000);
}

// ---------- Expiração do Pix ----------
function iniciarContagemExpiracao(expiraEmIso) {
  pararContagemExpiracao();
  const el = document.getElementById('pix-expira');
  if (!el || !expiraEmIso) return;
  el.classList.remove('oculto');

  function atualizar() {
    const restanteMs = new Date(expiraEmIso).getTime() - Date.now();
    if (restanteMs <= 0) {
      el.textContent = '⏰ Este Pix expirou. Volte ao cardápio e gere um novo código.';
      el.className = 'aviso erro';
      pararContagemExpiracao();
      return;
    }
    const min = Math.floor(restanteMs / 60000);
    const seg = Math.floor((restanteMs % 60000) / 1000);
    el.textContent = `⏳ Este Pix expira em ${min}:${String(seg).padStart(2, '0')}`;
    el.className = 'aviso info';
  }

  atualizar();
  intervaloExpiracao = setInterval(atualizar, 1000);
}

function pararContagemExpiracao() {
  if (intervaloExpiracao) {
    clearInterval(intervaloExpiracao);
    intervaloExpiracao = null;
  }
}

// ---------- Dialogo de confirmacao (FR-013) ----------
// Os popups sao dialogos (role="dialog" no .popup-card): ao abrir recebem o
// foco e o resto da pagina fica inerte; ao fechar o foco volta para onde estava.
let dialogoAberto = null;
let focoAntesDoDialogo = null;
const PARTES_PAGINA = ['.eac-header', '.eac-faixa', 'main', '.eac-rodape'];

function elementosFocaveis(container) {
  return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && el.offsetParent !== null);
}

function abrirDialogo(popup) {
  if (dialogoAberto && dialogoAberto !== popup) fecharDialogo(dialogoAberto, { semDevolverFoco: true });
  if (!dialogoAberto) focoAntesDoDialogo = document.activeElement;
  dialogoAberto = popup;
  popup.classList.remove('oculto');
  PARTES_PAGINA.forEach(sel => document.querySelectorAll(sel).forEach(el => { el.inert = true; }));
  const card = popup.querySelector('[role="dialog"]') || popup;
  card.focus({ preventScroll: true });
}

function fecharDialogo(popup, opcoes = {}) {
  popup.classList.add('oculto');
  if (dialogoAberto !== popup) return;
  dialogoAberto = null;
  PARTES_PAGINA.forEach(sel => document.querySelectorAll(sel).forEach(el => { el.inert = false; }));
  if (opcoes.semDevolverFoco) return;
  const destino = focoAntesDoDialogo && document.contains(focoAntesDoDialogo) && focoAntesDoDialogo.offsetParent !== null
    ? focoAntesDoDialogo
    : document.getElementById('titulo-pix');
  focoAntesDoDialogo = null;
  destino?.focus({ preventScroll: true });
}

// Quando o botao "Entendi" aparece (temas obrigado/policia), o foco vai para ele.
function dialogoPronto(popup) {
  popup.classList.add('pronto');
  if (dialogoAberto !== popup) return;
  const botao = popup.querySelector('button');
  if (botao && botao.offsetParent !== null) botao.focus({ preventScroll: true });
}

document.addEventListener('keydown', evento => {
  if (!dialogoAberto) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    const fechar = { 'popup-pagamento': fecharPopupPagamento, 'popup-obrigado': fecharPopupObrigado, 'popup-policia': fecharPopupPolicia }[dialogoAberto.id];
    if (fechar) fechar();
    return;
  }
  if (evento.key !== 'Tab') return;
  const card = dialogoAberto.querySelector('[role="dialog"]') || dialogoAberto;
  const focaveis = elementosFocaveis(card);
  if (focaveis.length === 0) { evento.preventDefault(); card.focus(); return; }
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === card)) {
    evento.preventDefault(); ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault(); primeiro.focus();
  } else if (!card.contains(document.activeElement)) {
    evento.preventDefault(); primeiro.focus();
  }
});

// ---------- Popup de pagamento confirmado ----------
function mostrarPopupPagamento(ticket) {
  document.getElementById('popup-pagamento-ticket').textContent = ticket;
  abrirDialogo(document.getElementById('popup-pagamento'));
}

// Prisao: em vez do popup comum, mostra a tela "A Policia EAC esta a
// caminho" com a foto do policial. Por produto (id), para cada tipo de
// prisao poder ter a sua foto; hoje so a Prisao normal (20) tem.
const FOTO_POLICIA_A_CAMINHO = {
  20: '/uploads/prisao/policial-a-caminho.jpg'
};

function mostrarPopupPolicia(dados) {
  const foto = FOTO_POLICIA_A_CAMINHO[Number(produtoSelecionado)];
  if (!foto) return false;
  const nomes = (Array.isArray(dados.itens) && dados.itens.length ? dados.itens.map(i => i.destinatario) : [dados.destinatario])
    .filter(Boolean);
  document.getElementById('popup-policia-foto').src = foto;
  document.getElementById('popup-policia-texto').textContent = nomes.length
    ? `O mandado foi expedido e a nossa polícia já saiu atrás de ${juntarNomes(nomes)}.`
    : 'O mandado foi expedido e a nossa polícia já saiu atrás do suspeito.';
  document.getElementById('popup-policia-ticket').textContent = dados.ticket;
  const popup = document.getElementById('popup-policia');
  popup.classList.remove('pronto');
  abrirDialogo(popup);
  // "Carregando" por alguns segundos, depois mostra o codigo e o botao.
  clearTimeout(mostrarPopupPolicia.timer);
  mostrarPopupPolicia.timer = setTimeout(() => dialogoPronto(popup), 3500);
  return true;
}

// "Ana", "Ana e Bruno", "Ana, Bruno e Carla"
function juntarNomes(nomes) {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : (nomes[0] || '');
}

// Rosas, botons e trotes: tela de agradecimento com a foto do produto.
// Rosas e botons usam o tema padrao; cada trote tem o seu tema engracado
// (por id do produto). Textos sao funcoes que recebem "para Fulano".
const TEMA_OBRIGADO_PADRAO = {
  emojis: ['💛', '❤️', '💛', '🤍', '❤️', '💛'],
  titulo: 'Obrigado pelo carinho! 💛',
  texto: (produto, para) => `A nossa equipe de entrega já vai levar ${produto.nome}${para ? ' para ' + para : ''}.`
};
const CATEGORIAS_OBRIGADO = ['rosa', 'boton'];
const TEMAS_TROTE = {
  17: { // Trote da Xuxa
    classe: 'tema-xuxa',
    emojis: ['⭐', '🎀', '✨', '💖', '⭐', '🎀'],
    titulo: '⭐ A Rainha dos Baixinhos aprovou!',
    texto: (produto, para) => `Prepare a plateia: o trote da Xuxa já está a caminho${para ? ' de ' + para : ''}!`
  },
  18: { // Trote Panela de Pressao
    classe: 'tema-panela',
    emojis: ['💨', '🔥', '💨', '♨️', '💨', '🔥'],
    titulo: '💨 Tsssss! A pressão subiu!',
    texto: (produto, para) => `A panela já está no fogo… ${para || 'o alvo'} que se prepare!`
  },
  19: { // Trote Celular do Vovo
    classe: 'tema-vovo',
    emojis: ['📞', '🔊', '📱', '👴', '🔊', '📞'],
    titulo: '📞 Alô? ALÔÔÔ??',
    texto: (produto, para) => `O vovô está ligando${para ? ' para ' + para : ''}… com o volume no máximo!`
  },
  23: { // Trote Danca do Bambole
    classe: 'tema-bambole',
    emojis: ['🌀', '💃', '🕺', '🌀', '💃', '🕺'],
    titulo: '🌀 Gira, gira, gira!',
    texto: (produto, para) => `${para || 'Alguém'} vai ter que rebolar: o bambolê já está a caminho!`
  }
};

function mostrarPopupObrigado(dados) {
  const produto = produtos.find(p => Number(p.id) === Number(produtoSelecionado));
  if (!produto) return false;
  const tema = TEMAS_TROTE[produto.id] || (CATEGORIAS_OBRIGADO.includes(produto.categoria) ? TEMA_OBRIGADO_PADRAO : null);
  if (!tema) return false;
  const nomes = (Array.isArray(dados.itens) && dados.itens.length ? dados.itens.map(i => i.destinatario) : [dados.destinatario])
    .filter(Boolean);
  const foto = document.getElementById('popup-obrigado-foto');
  foto.src = produto.foto;
  foto.alt = produto.nome;
  document.querySelectorAll('#popup-obrigado-emojis span').forEach((el, i) => { el.textContent = tema.emojis[i % tema.emojis.length]; });
  document.getElementById('popup-obrigado-titulo').textContent = tema.titulo;
  document.getElementById('popup-obrigado-texto').textContent = tema.texto(produto, juntarNomes(nomes));
  document.getElementById('popup-obrigado-ticket').textContent = dados.ticket;
  const popup = document.getElementById('popup-obrigado');
  popup.className = `popup-overlay popup-obrigado ${tema.classe || ''} oculto`.replace(/\s+/g, ' ');
  abrirDialogo(popup);
  clearTimeout(mostrarPopupObrigado.timer);
  mostrarPopupObrigado.timer = setTimeout(() => dialogoPronto(popup), 3500);
  return true;
}

function fecharPopupObrigado() {
  fecharDialogo(document.getElementById('popup-obrigado'));
}

function fecharPopupPolicia() {
  fecharDialogo(document.getElementById('popup-policia'));
}

function fecharPopupPagamento() {
  fecharDialogo(document.getElementById('popup-pagamento'));
}

function legendaStatus(status) {
  const legendas = {
    pendente_pagamento: 'aguardando pagamento',
    pago: 'pago',
    aguardando: 'aguardando entrega',
    entregue: 'entregue',
    cancelado: 'cancelado'
  };
  return legendas[status] || status;
}

function iniciarPedidoDireto() {
  const params = new URLSearchParams(window.location.search);
  const produtoId = Number(params.get('produto'));
  if (!produtoId) return;

  const produto = produtos.find(p => Number(p.id) === produtoId);
  modoPedidoDireto = true;
  document.body.classList.add('pedido-page');
  document.getElementById('secao-cardapio').classList.add('oculto');
  document.getElementById('btn-voltar-pedido')?.classList.remove('oculto');

  if (!produto) {
    document.getElementById('secao-formulario').classList.remove('oculto');
    document.getElementById('secao-formulario').innerHTML =
      '<h2>Produto não encontrado</h2><div class="aviso erro">Volte ao cardápio e escolha o item novamente.</div><a href="/" class="botao-link secundario">Voltar ao cardápio</a>';
    return;
  }

  abrirFormularioNaPagina(produto.id, produto.nome, { semScroll: true });
}

// Lista de equipes de quem vai receber (vem do servidor, que tambem recusa
// equipe fora dela). Escolher numa lista evita erro de digitacao.
async function carregarEquipes() {
  const select = document.getElementById('equipeDestinatario');
  if (!select) return;
  const res = await fetch('/api/equipes');
  const equipes = await res.json();
  equipes.forEach(nome => {
    const opcao = document.createElement('option');
    opcao.value = nome;
    opcao.textContent = nome;
    select.appendChild(opcao);
  });
}

// ---------- Boot ----------
(async () => {
  await carregarEquipes();
  await carregarCategorias();
  await carregarProdutos();
  await carregarStatus();
  iniciarPedidoDireto();
  ['nomeDestinatario', 'equipeDestinatario'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarBotoesPedido);
    document.getElementById(id)?.addEventListener('change', atualizarBotoesPedido);
  });
  // Campo alterado deixa de ser marcado como invalido (FR-012).
  CAMPOS_FORMULARIO.forEach(id => {
    const campo = document.getElementById(id);
    campo?.addEventListener('input', () => limparErroCampo(campo));
    campo?.addEventListener('change', () => limparErroCampo(campo));
  });
  atualizarBotoesPedido();
  setInterval(carregarStatus, 5000);
  setInterval(atualizarProdutos, 5000);
})();

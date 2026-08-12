let produtoSelecionado = null;
let ticketAtual = null;
let intervaloConsulta = null;

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

// ---------- Status (botão do pânico) ----------
async function carregarStatus() {
  const res = await fetch('/api/status');
  const dados = await res.json();
  pedidosPausados = !!dados.pausado;

  const info = document.getElementById('estoque-info');
  info.textContent = pedidosPausados
    ? '⏸️ Pedidos pausados no momento. Volte a tentar em instantes.'
    : '';

  document.querySelectorAll('#lista-produtos button.destaque').forEach(btn => {
    btn.disabled = pedidosPausados;
  });
}

// ---------- Abas de categoria ----------
async function carregarCategorias() {
  const res = await fetch('/api/categorias');
  categorias = await res.json();

  const abas = document.getElementById('abas-categorias');
  abas.innerHTML = '';

  const todos = criarAba('todos', '✨ Todos');
  abas.appendChild(todos);

  categorias.forEach(cat => {
    abas.appendChild(criarAba(cat.id, `${cat.emoji} ${cat.nome}`));
  });

  marcarAbaAtiva();
}

function criarAba(id, texto) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'aba';
  btn.dataset.categoria = id;
  btn.textContent = texto;
  btn.onclick = () => {
    categoriaAtiva = id;
    marcarAbaAtiva();
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    renderizarProdutos();
  };
  return btn;
}

function marcarAbaAtiva() {
  document.querySelectorAll('.aba').forEach(a => {
    a.classList.toggle('ativa', a.dataset.categoria === categoriaAtiva);
  });
}

// ---------- Produtos ----------
async function carregarProdutos() {
  const res = await fetch('/api/produtos');
  produtos = await res.json();
  renderizarProdutos();
}

function nomeCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? `${c.emoji} ${c.nome}` : id;
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
    const div = document.createElement('div');
    div.className = `produto-card${esgotado ? ' esgotado' : ''}`;
    div.innerHTML = `
      <div class="imagem">
        <img src="${p.foto}" alt="${p.nome}" onerror="this.style.opacity=0.2">
      </div>
      ${p.categoria ? `<span class="categoria-tag">${nomeCategoria(p.categoria)}</span>` : ''}
      <h3>${p.nome}</h3>
      <p class="descricao">${p.descricao || ''}</p>
      <div class="preco">R$ ${p.preco.toFixed(2).replace('.', ',')}</div>
      <p class="estoque-info${esgotado ? ' zerado' : ''}">${esgotado ? 'Esgotado' : `${p.estoque} disponíveis`}</p>
      <button class="destaque" ${(pedidosPausados || esgotado) ? 'disabled' : ''} onclick="abrirFormulario(${p.id}, '${p.nome.replace(/'/g, "\\'")}')">${esgotado ? 'Esgotado' : 'Enviar este'}</button>
    `;
    container.appendChild(div);
  });
}

// ---------- Formulário ----------
function abrirFormulario(id, nome) {
  if (!modoPedidoDireto) {
    const url = `/?produto=${encodeURIComponent(id)}`;
    const novaAba = window.open(url, '_blank');
    if (novaAba) novaAba.opener = null;
    if (!novaAba) window.location.href = url;
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
  document.getElementById('secao-formulario').classList.remove('oculto');
  document.getElementById('secao-pix').classList.add('oculto');
  document.getElementById('form-erro').classList.add('oculto');
  renderizarDestinatariosPedido();
  atualizarBotoesPedido();
  if (!opcoes.semScroll) {
    window.scrollTo({
      top: document.getElementById('secao-formulario').offsetTop - 20,
      behavior: 'smooth'
    });
  }
}

function preencherResumoPedido(produto) {
  document.getElementById('pedido-resumo')?.classList.remove('oculto');
  const foto = document.getElementById('pedido-resumo-foto');
  foto.src = produto.foto;
  foto.alt = produto.nome;
  document.getElementById('pedido-resumo-categoria').textContent = produto.categoria ? nomeCategoria(produto.categoria) : '';
  document.getElementById('pedido-resumo-nome').textContent = produto.nome;
  document.getElementById('pedido-resumo-valor').textContent = `R$ ${produto.preco.toFixed(2).replace('.', ',')}`;
}

function cancelarFormulario() {
  voltarAoCardapio();
}

function voltarAoCardapio() {
  if (modoPedidoDireto) {
    window.close();
    window.location.href = '/';
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
      ? 'Adicionar esta pessoa à lista'
      : 'Enviar para mais uma pessoa';
  }

  if (btnGerar) {
    btnGerar.textContent = quantidade > 0
      ? `Gerar Pix para ${quantidade} pessoa${quantidade > 1 ? 's' : ''}`
      : 'Gerar cobrança Pix';
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
    <div class="destinatarios-titulo">${destinatariosPedido.length} pessoa${destinatariosPedido.length > 1 ? 's' : ''} adicionada${destinatariosPedido.length > 1 ? 's' : ''}</div>
    ${destinatariosPedido.map((d, i) => `
      <div class="destinatario-item">
        <span><strong>${i + 1}. ${d.nomeDestinatario}</strong><br><small>${d.equipeDestinatario}</small></span>
        ${d.anonimo ? '<span class="pill-info">Anônimo</span>' : ''}
        <button class="secundario pequeno" onclick="removerDestinatario(${i})">Remover</button>
      </div>
    `).join('')}
  `;
  atualizarBotoesPedido();
}

function adicionarDestinatario() {
  const erroEl = document.getElementById('form-erro');
  const destinatario = dadosDestinatarioAtual();

  if (!destinatario.nomeDestinatario || !destinatario.equipeDestinatario) {
    erroEl.textContent = 'Preencha o nome e a equipe dessa pessoa antes de adicionar.';
    erroEl.classList.remove('oculto');
    return;
  }
  if (!nomeValido(destinatario.nomeDestinatario)) {
    erroEl.textContent = 'O nome de quem vai receber precisa ter pelo menos 4 caracteres.';
    erroEl.classList.remove('oculto');
    return;
  }

  destinatariosPedido.push(destinatario);
  erroEl.classList.add('oculto');
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

async function enviarPedido() {
  const nomeComprador = document.getElementById('nomeComprador').value.trim();
  const contato = document.getElementById('contato').value.trim();
  const destinatarios = montarDestinatariosParaEnvio();
  const erroEl = document.getElementById('form-erro');

  if (!nomeValido(nomeComprador)) {
    erroEl.textContent = 'Seu nome precisa ter pelo menos 4 caracteres.';
    erroEl.classList.remove('oculto');
    return;
  }

  if (!telefoneValido(contato)) {
    erroEl.textContent = 'Informe um WhatsApp válido com DDD. Ex: (83) 90000-0000.';
    erroEl.classList.remove('oculto');
    return;
  }

  if (destinatarios.length === 0 || destinatarios.some(d => !nomeValido(d.nomeDestinatario) || !d.equipeDestinatario)) {
    erroEl.textContent = 'Preencha seu nome e os dados de quem vai receber.';
    erroEl.classList.remove('oculto');
    return;
  }

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
    erroEl.textContent = dados.erro || 'Erro ao criar pedido.';
    erroEl.classList.remove('oculto');
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

  iniciarPollingStatus(dados.ticket);
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
        <span><strong>${i + 1}. ${item.destinatario}</strong><br><small>${item.equipe}</small></span>
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
    }
  }, 2000);
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

// ---------- Boot ----------
(async () => {
  await carregarCategorias();
  await carregarProdutos();
  await carregarStatus();
  iniciarPedidoDireto();
  ['nomeDestinatario', 'equipeDestinatario'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarBotoesPedido);
  });
  atualizarBotoesPedido();
  setInterval(carregarStatus, 5000);
  setInterval(carregarProdutos, 5000);
})();

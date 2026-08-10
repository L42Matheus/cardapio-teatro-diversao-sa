let produtoSelecionado = null;
let ticketAtual = null;
let intervaloConsulta = null;

let categorias = [];
let produtos = [];
let categoriaAtiva = 'todos';
let pedidosPausados = false;

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
  if (pedidosPausados) {
    alert('Os pedidos estão pausados no momento. Tente novamente em instantes.');
    return;
  }
  produtoSelecionado = id;
  document.getElementById('form-produto-nome').textContent = nome;
  document.getElementById('secao-formulario').classList.remove('oculto');
  document.getElementById('secao-pix').classList.add('oculto');
  document.getElementById('form-erro').classList.add('oculto');
  window.scrollTo({
    top: document.getElementById('secao-formulario').offsetTop - 20,
    behavior: 'smooth'
  });
}

function cancelarFormulario() {
  document.getElementById('secao-formulario').classList.add('oculto');
}

async function enviarPedido() {
  const nomeComprador = document.getElementById('nomeComprador').value.trim();
  const contato = document.getElementById('contato').value.trim();
  const nomeDestinatario = document.getElementById('nomeDestinatario').value.trim();
  const equipeDestinatario = document.getElementById('equipeDestinatario').value.trim();
  const erroEl = document.getElementById('form-erro');

  if (!nomeComprador || !nomeDestinatario || !equipeDestinatario) {
    erroEl.textContent = 'Preencha seu nome, o nome e a equipe de quem vai receber.';
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
      nomeDestinatario,
      equipeDestinatario
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
  document.getElementById('pix-status').innerHTML =
    'Status: <span class="status-pendente_pagamento">aguardando pagamento...</span>';

  window.scrollTo({
    top: document.getElementById('secao-pix').offsetTop - 20,
    behavior: 'smooth'
  });

  iniciarPollingStatus(dados.ticket);
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

async function simularPagamento() {
  if (!ticketAtual) return;
  await fetch(`/api/pedidos/${ticketAtual}/simular-pagamento`, { method: 'POST' });
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

// ---------- Boot ----------
(async () => {
  await carregarCategorias();
  await carregarProdutos();
  await carregarStatus();
  setInterval(carregarStatus, 5000);
  setInterval(carregarProdutos, 5000);
})();

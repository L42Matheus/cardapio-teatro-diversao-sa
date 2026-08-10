let produtoSelecionado = null;
let ticketAtual = null;
let intervaloConsulta = null;

async function carregarEstoque() {
  const res = await fetch('/api/estoque');
  const dados = await res.json();
  document.getElementById('estoque-info').textContent =
    `Vagas disponiveis: ${dados.disponiveis} de ${dados.limiteTotal}`;
}

async function carregarProdutos() {
  const res = await fetch('/api/produtos');
  const produtos = await res.json();
  const container = document.getElementById('lista-produtos');
  container.innerHTML = '';
  produtos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'produto-card';
    div.innerHTML = `
      <img src="${p.foto}" alt="${p.nome}" onerror="this.style.opacity=0.2">
      <h3>${p.nome}</h3>
      <div class="preco">R$ ${p.preco.toFixed(2)}</div>
      <button onclick="abrirFormulario(${p.id}, '${p.nome}')">Comprar</button>
    `;
    container.appendChild(div);
  });
}

function abrirFormulario(id, nome) {
  produtoSelecionado = id;
  document.getElementById('form-produto-nome').textContent = nome;
  document.getElementById('secao-formulario').classList.remove('oculto');
  document.getElementById('secao-pix').classList.add('oculto');
  document.getElementById('form-erro').classList.add('oculto');
  window.scrollTo({ top: document.getElementById('secao-formulario').offsetTop - 20, behavior: 'smooth' });
}

function cancelarFormulario() {
  document.getElementById('secao-formulario').classList.add('oculto');
}

async function enviarPedido() {
  const nomeComprador = document.getElementById('nomeComprador').value.trim();
  const contato = document.getElementById('contato').value.trim();
  const nomeDestinatario = document.getElementById('nomeDestinatario').value.trim();
  const erroEl = document.getElementById('form-erro');

  if (!nomeComprador || !nomeDestinatario) {
    erroEl.textContent = 'Preencha seu nome e o nome de quem vai receber.';
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
      nomeDestinatario
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
  document.getElementById('pix-ticket').textContent = `#${dados.ticket}`;
  document.getElementById('pix-valor').textContent = `R$ ${dados.pix.valor.toFixed(2)}`;
  document.getElementById('pix-copiacola').value = dados.pix.copiaECola;
  document.getElementById('pix-status').innerHTML = 'Status: <span class="status-pendente_pagamento">aguardando pagamento...</span>';

  iniciarPollingStatus(dados.ticket);
  carregarEstoque();
}

function iniciarPollingStatus(ticket) {
  if (intervaloConsulta) clearInterval(intervaloConsulta);
  intervaloConsulta = setInterval(async () => {
    const res = await fetch(`/api/pedidos/${ticket}`);
    if (!res.ok) return;
    const dados = await res.json();
    if (dados.status !== 'pendente_pagamento') {
      document.getElementById('pix-status').innerHTML =
        `Status: <span class="status-${dados.status}">${legendaStatus(dados.status)}</span> — pagamento confirmado! Guarde seu ticket #${dados.ticket}.`;
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

async function consultarTicket() {
  const ticket = document.getElementById('ticketConsulta').value.trim();
  const resultadoEl = document.getElementById('resultado-consulta');
  if (!ticket) return;

  const res = await fetch(`/api/pedidos/${ticket}`);
  if (!res.ok) {
    resultadoEl.innerHTML = `<div class="aviso erro">Pedido nao encontrado.</div>`;
    return;
  }
  const dados = await res.json();
  resultadoEl.innerHTML = `
    <div class="aviso sucesso">
      Ticket #${dados.ticket} — ${dados.produto} para ${dados.destinatario}<br>
      Status: <span class="status-${dados.status}">${legendaStatus(dados.status)}</span>
    </div>
  `;
}

carregarEstoque();
carregarProdutos();

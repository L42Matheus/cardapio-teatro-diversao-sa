let entregadoresCache = [];

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

async function carregarEntregadores() {
  const res = await fetch('/api/admin/entregadores');
  entregadoresCache = await res.json();
}

function opcoesEntregadores(pedido) {
  let html = `<option value="">-- selecionar --</option>`;
  entregadoresCache.forEach(e => {
    const selecionado = pedido.entregadorId === e.id ? 'selected' : '';
    html += `<option value="${e.id}" ${selecionado}>${e.nome}</option>`;
  });
  return html;
}

async function carregarPedidos() {
  const res = await fetch('/api/admin/pedidos');
  const pedidos = await res.json();
  const corpo = document.getElementById('corpo-tabela');
  corpo.innerHTML = '';

  pedidos.forEach(p => {
    const tr = document.createElement('tr');

    const podeAtribuir = p.status === 'pago' || p.status === 'aguardando';
    const podeEntregar = p.status === 'aguardando';

    tr.innerHTML = `
      <td>#${p.id}</td>
      <td>${p.produtoNome}</td>
      <td>${p.nomeComprador}<br><small>${p.contato || ''}</small></td>
      <td>${p.nomeDestinatario}</td>
      <td>R$ ${p.valor.toFixed(2)}</td>
      <td><span class="status-${p.status}">${legendaStatus(p.status)}</span></td>
      <td>
        <select class="small" id="entregador-${p.id}" ${podeAtribuir ? '' : 'disabled'}>
          ${opcoesEntregadores(p)}
        </select>
      </td>
      <td>
        <button ${podeAtribuir ? '' : 'disabled'} onclick="atribuir(${p.id})">Atribuir</button>
        <button ${podeEntregar ? '' : 'disabled'} onclick="marcarEntregue(${p.id})">Entregue</button>
      </td>
    `;
    corpo.appendChild(tr);
  });
}

async function atribuir(pedidoId) {
  const select = document.getElementById(`entregador-${pedidoId}`);
  const entregadorId = select.value;
  if (!entregadorId) {
    alert('Selecione um entregador.');
    return;
  }
  const res = await fetch(`/api/admin/pedidos/${pedidoId}/atribuir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entregadorId })
  });
  const dados = await res.json();
  if (!res.ok) {
    alert(dados.erro || 'Erro ao atribuir.');
    return;
  }
  carregarPedidos();
}

async function marcarEntregue(pedidoId) {
  const res = await fetch(`/api/admin/pedidos/${pedidoId}/entregar`, { method: 'POST' });
  const dados = await res.json();
  if (!res.ok) {
    alert(dados.erro || 'Erro ao marcar como entregue.');
    return;
  }
  carregarPedidos();
}

async function iniciar() {
  await carregarEntregadores();
  await carregarPedidos();
  setInterval(carregarPedidos, 5000); // atualiza sozinho a cada 5s
}

iniciar();

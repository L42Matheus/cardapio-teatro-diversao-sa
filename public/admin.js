let entregadoresCache = [];
let categoriasCache = [];
let pedidosCache = [];

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

function nomeCategoria(id) {
  const c = categoriasCache.find(x => x.id === id);
  return c ? `${c.emoji} ${c.nome}` : (id || '-');
}

function formatarBRL(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

// ---------- Carregar dados de apoio ----------
async function carregarEntregadores() {
  const res = await fetch('/api/admin/entregadores');
  entregadoresCache = await res.json();
}

async function carregarCategorias() {
  const res = await fetch('/api/categorias');
  categoriasCache = await res.json();
  const sel = document.getElementById('filtro-categoria');
  categoriasCache.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.emoji} ${c.nome}`;
    sel.appendChild(opt);
  });
}

// ---------- Resumo ----------
function renderResumo(pedidos) {
  const total = pedidos.length;
  const pagos = pedidos.filter(p => p.status !== 'pendente_pagamento' && p.status !== 'cancelado').length;
  const entregues = pedidos.filter(p => p.status === 'entregue').length;
  const pendentes = pedidos.filter(p => p.status === 'pago' || p.status === 'aguardando').length;
  const arrecadado = pedidos
    .filter(p => p.status !== 'pendente_pagamento' && p.status !== 'cancelado')
    .reduce((soma, p) => soma + Number(p.valor || 0), 0);

  const el = document.getElementById('resumo');
  el.innerHTML = `
    <div class="caixa azul">
      <div class="label">Pedidos totais</div>
      <div class="valor">${total}</div>
    </div>
    <div class="caixa">
      <div class="label">Pagos</div>
      <div class="valor">${pagos}</div>
    </div>
    <div class="caixa vermelho">
      <div class="label">A entregar</div>
      <div class="valor">${pendentes}</div>
    </div>
    <div class="caixa verde">
      <div class="label">Entregues</div>
      <div class="valor">${entregues}</div>
    </div>
    <div class="caixa">
      <div class="label">Arrecadado</div>
      <div class="valor">${formatarBRL(arrecadado)}</div>
    </div>
  `;
}

// ---------- Tabela ----------
function opcoesEntregadores(pedido) {
  let html = `<option value="">-- selecionar --</option>`;
  entregadoresCache.forEach(e => {
    const selecionado = pedido.entregadorId === e.id ? 'selected' : '';
    html += `<option value="${e.id}" ${selecionado}>${e.nome}</option>`;
  });
  return html;
}

function filtrar(pedidos) {
  const status = document.getElementById('filtro-status').value;
  const cat = document.getElementById('filtro-categoria').value;
  const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();

  return pedidos.filter(p => {
    if (status !== 'todos' && p.status !== status) return false;
    if (cat !== 'todos' && p.categoria !== cat) return false;
    if (busca) {
      const alvo = `${p.nomeComprador || ''} ${p.nomeDestinatario || ''}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

function renderTabela() {
  const corpo = document.getElementById('corpo-tabela');
  corpo.innerHTML = '';

  const lista = filtrar(pedidosCache);

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhum pedido para esses filtros.</td></tr>`;
    return;
  }

  lista.forEach(p => {
    const tr = document.createElement('tr');
    const podeAtribuir = p.status === 'pago' || p.status === 'aguardando';
    const podeEntregar = p.status === 'aguardando';

    tr.innerHTML = `
      <td><strong>${p.codigo || '#' + p.id}</strong><br><small style="color:var(--texto-fraco);">#${p.id}</small></td>
      <td>${nomeCategoria(p.categoria)}</td>
      <td>${p.produtoNome}</td>
      <td>${p.nomeComprador}<br><small>${p.contato || ''}</small></td>
      <td>${p.nomeDestinatario}</td>
      <td>${formatarBRL(p.valor)}</td>
      <td><span class="status-${p.status}">${legendaStatus(p.status)}</span></td>
      <td>
        <select class="small" id="entregador-${p.id}" ${podeAtribuir ? '' : 'disabled'}>
          ${opcoesEntregadores(p)}
        </select>
      </td>
      <td style="white-space:nowrap;">
        <button ${podeAtribuir ? '' : 'disabled'} onclick="atribuir(${p.id})">Atribuir</button>
        <button class="destaque" ${podeEntregar ? '' : 'disabled'} onclick="marcarEntregue(${p.id})">Entregue</button>
      </td>
    `;
    corpo.appendChild(tr);
  });
}

async function carregarPedidos() {
  const res = await fetch('/api/admin/pedidos');
  pedidosCache = await res.json();
  renderResumo(pedidosCache);
  renderTabela();
}

async function atribuir(pedidoId) {
  const select = document.getElementById(`entregador-${pedidoId}`);
  const entregadorId = select.value;
  if (!entregadorId) {
    alert('Selecione uma equipe entregadora.');
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
  await carregarCategorias();
  await carregarEntregadores();
  await carregarPedidos();

  document.getElementById('filtro-status').addEventListener('change', renderTabela);
  document.getElementById('filtro-categoria').addEventListener('change', renderTabela);
  document.getElementById('filtro-busca').addEventListener('input', renderTabela);

  setInterval(carregarPedidos, 5000);
}

iniciar();

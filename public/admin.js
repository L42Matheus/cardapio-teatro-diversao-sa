let categoriasCache = [];
let pedidosCache = [];
let minhaEquipe = localStorage.getItem('minhaEquipe') || '';

const RESERVA_TTL_MS = 10 * 60 * 1000;

function nomeCategoria(id) {
  const c = categoriasCache.find(x => x.id === id);
  return c ? `${c.emoji} ${c.nome}` : (id || '-');
}

function formatarBRL(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

function formatarHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function minutosDesde(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function reservaAtiva(p) {
  if (!p.claimedBy || !p.claimedAt) return false;
  return (Date.now() - new Date(p.claimedAt).getTime()) < RESERVA_TTL_MS;
}

// ---------- Escolha da equipe ----------
function definirEquipe(sugestao) {
  const atual = minhaEquipe || sugestao || '';
  const resposta = prompt(
    'Qual equipe está usando este painel?\n\nSugestões: Equipe 1, Equipe 2, Anjos, Servos...',
    atual
  );
  if (resposta && resposta.trim()) {
    minhaEquipe = resposta.trim();
    localStorage.setItem('minhaEquipe', minhaEquipe);
    atualizarBadgeEquipe();
    return true;
  }
  return false;
}

function atualizarBadgeEquipe() {
  const el = document.getElementById('badge-equipe');
  if (!el) return;
  el.innerHTML = minhaEquipe
    ? `Equipe atual: <strong>${minhaEquipe}</strong> <a href="#" onclick="event.preventDefault(); definirEquipe();" style="margin-left:8px; font-size:0.8rem;">trocar</a>`
    : `<a href="#" onclick="event.preventDefault(); definirEquipe();">Definir minha equipe</a>`;
}

// ---------- API ----------
async function carregarCategorias() {
  const res = await fetch('/api/categorias');
  categoriasCache = await res.json();
  const sel = document.getElementById('filtro-categoria-pendentes');
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
  const aEntregar = pedidos.filter(p => p.status === 'pago' || p.status === 'aguardando').length;
  const arrecadado = pedidos
    .filter(p => p.status !== 'pendente_pagamento' && p.status !== 'cancelado')
    .reduce((soma, p) => soma + Number(p.valor || 0), 0);

  document.getElementById('resumo').innerHTML = `
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
      <div class="valor">${aEntregar}</div>
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

// ---------- Filtros e ordenação ----------
function filtroTexto(p, termo) {
  if (!termo) return true;
  const alvo = `${p.nomeComprador || ''} ${p.nomeDestinatario || ''} ${p.equipeDestinatario || ''}`.toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

function estadoReserva(p) {
  if (!p.claimedBy || !reservaAtiva(p)) return 'livre';
  if (p.claimedBy === minhaEquipe) return 'minha';
  return 'outra';
}

// ---------- Pendentes ----------
function renderPendentes() {
  const corpo = document.getElementById('corpo-pendentes');
  const categoria = document.getElementById('filtro-categoria-pendentes').value;
  const busca = document.getElementById('filtro-busca-pendentes').value.trim();

  const lista = pedidosCache
    .filter(p => p.status === 'pago' || p.status === 'aguardando')
    .filter(p => categoria === 'todos' || p.categoria === categoria)
    .filter(p => filtroTexto(p, busca));

  // Ordem: livres primeiro (FIFO), depois minhas, depois de outras equipes,
  // dentro de cada grupo por horário de criação (mais antigo primeiro).
  const prioridade = { livre: 0, minha: 1, outra: 2 };
  lista.sort((a, b) => {
    const pa = prioridade[estadoReserva(a)];
    const pb = prioridade[estadoReserva(b)];
    if (pa !== pb) return pa - pb;
    return new Date(a.criadoEm) - new Date(b.criadoEm);
  });

  document.getElementById('contador-pendentes').textContent = `(${lista.length})`;
  corpo.innerHTML = '';

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhum pedido aguardando entrega. 🎉</td></tr>`;
    return;
  }

  let primeiroLivreJaMarcado = false;

  lista.forEach(p => {
    const estado = estadoReserva(p);
    const tr = document.createElement('tr');

    let acoesHTML = '';
    let indicadorHTML = '';
    let corLinha = '';

    if (estado === 'livre') {
      if (!primeiroLivreJaMarcado) {
        corLinha = 'background: rgba(245, 179, 1, 0.10);';
        indicadorHTML = '<br><small style="color:var(--amarelo-esc); font-weight:600;">PRÓXIMO</small>';
        primeiroLivreJaMarcado = true;
      }
      acoesHTML = `<button onclick="pegar(${p.id})">Peguei este</button>`;
    } else if (estado === 'minha') {
      corLinha = 'background: rgba(30,90,168,0.08);';
      indicadorHTML = `<br><small style="color:var(--azul); font-weight:600;">🔵 VOCÊ (${minutosDesde(p.claimedAt)} min)</small>`;
      acoesHTML = `
        <button class="destaque" onclick="entregar(${p.id})">Entregue</button>
        <button class="secundario" onclick="liberar(${p.id}, false)">Liberar</button>
      `;
    } else {
      corLinha = 'background: #f5f5f5; opacity: 0.75;';
      indicadorHTML = `<br><small style="color:var(--texto-fraco);">🔒 ${p.claimedBy} (${minutosDesde(p.claimedAt)} min)</small>`;
      acoesHTML = `<button class="secundario" onclick="liberar(${p.id}, true)" title="Só use se souber que a equipe desistiu">Forçar liberação</button>`;
    }

    tr.style.cssText = corLinha;
    tr.innerHTML = `
      <td><strong>${p.codigo || '#' + p.id}</strong>${indicadorHTML}</td>
      <td>${formatarHora(p.criadoEm)}</td>
      <td>${nomeCategoria(p.categoria)}</td>
      <td>${p.produtoNome}</td>
      <td><strong>${p.nomeDestinatario}</strong></td>
      <td>${p.equipeDestinatario || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td>${p.nomeComprador}<br><small>${p.contato || ''}</small></td>
      <td>${formatarBRL(p.valor)}</td>
      <td style="white-space:nowrap;">${acoesHTML}</td>
    `;
    corpo.appendChild(tr);
  });
}

// ---------- Entregues ----------
function renderEntregues() {
  const corpo = document.getElementById('corpo-entregues');
  const busca = document.getElementById('filtro-busca-entregues').value.trim();

  const lista = pedidosCache
    .filter(p => p.status === 'entregue')
    .filter(p => filtroTexto(p, busca))
    .sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  document.getElementById('contador-entregues').textContent = `(${lista.length})`;
  corpo.innerHTML = '';

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhuma entrega concluída ainda.</td></tr>`;
    return;
  }

  lista.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.codigo || '#' + p.id}</strong></td>
      <td>${formatarHora(p.atualizadoEm)}</td>
      <td>${p.equipeEntregou || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td>${nomeCategoria(p.categoria)}</td>
      <td>${p.produtoNome}</td>
      <td>${p.nomeDestinatario}</td>
      <td>${p.equipeDestinatario || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td>${p.nomeComprador}</td>
      <td>${formatarBRL(p.valor)}</td>
    `;
    corpo.appendChild(tr);
  });
}

async function carregarPedidos() {
  const res = await fetch('/api/admin/pedidos');
  pedidosCache = await res.json();
  renderResumo(pedidosCache);
  renderPendentes();
  renderEntregues();
}

// ---------- Ações ----------
function garantirEquipe() {
  if (!minhaEquipe) {
    if (!definirEquipe()) {
      alert('É preciso definir sua equipe antes de agir nos pedidos.');
      return false;
    }
  }
  return true;
}

async function pegar(pedidoId) {
  if (!garantirEquipe()) return;
  const res = await fetch(`/api/admin/pedidos/${pedidoId}/pegar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipe: minhaEquipe })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao pegar.'); carregarPedidos(); return; }
  carregarPedidos();
}

async function liberar(pedidoId, forcado) {
  if (!garantirEquipe()) return;
  if (forcado && !confirm('Confirmar liberação forçada? Só faça isso se a outra equipe realmente desistiu.')) return;
  const res = await fetch(`/api/admin/pedidos/${pedidoId}/liberar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipe: minhaEquipe, forcado })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao liberar.'); carregarPedidos(); return; }
  carregarPedidos();
}

async function entregar(pedidoId) {
  if (!garantirEquipe()) return;
  const res = await fetch(`/api/admin/pedidos/${pedidoId}/entregar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipe: minhaEquipe })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao marcar como entregue.'); carregarPedidos(); return; }
  carregarPedidos();
}

// ---------- Boot ----------
async function iniciar() {
  atualizarBadgeEquipe();
  if (!minhaEquipe) definirEquipe();

  await carregarCategorias();
  await carregarPedidos();

  document.getElementById('filtro-categoria-pendentes').addEventListener('change', renderPendentes);
  document.getElementById('filtro-busca-pendentes').addEventListener('input', renderPendentes);
  document.getElementById('filtro-busca-entregues').addEventListener('input', renderEntregues);

  setInterval(carregarPedidos, 5000);
}

iniciar();

let categoriasCache = [];
let pedidosCache = [];
let pedidosPausados = false;
let sessao = null; // { token, usuario, nome, papel }

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

// ---------- Sessão / autenticação ----------
function authHeader() {
  return sessao ? { Authorization: `Bearer ${sessao.token}` } : {};
}

async function apiAdmin(caminho, opts = {}) {
  const res = await fetch(`/api/admin${caminho}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...authHeader() }
  });
  if (res.status === 401) {
    alert('Sessão expirada. Faça login novamente.');
    sair();
    throw new Error('SESSAO_EXPIRADA');
  }
  return res;
}

async function fazerLogin(ev) {
  ev.preventDefault();
  const usuario = document.getElementById('login-usuario').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.classList.add('oculto');

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha })
  });
  const dados = await res.json();

  if (!res.ok) {
    erroEl.textContent = dados.erro || 'Erro ao entrar.';
    erroEl.classList.remove('oculto');
    return;
  }

  sessao = dados;
  localStorage.setItem('sessaoAdmin', JSON.stringify(sessao));
  await mostrarPainel();
}

function sair() {
  if (sessao) {
    fetch('/api/admin/logout', { method: 'POST', headers: authHeader() }).catch(() => {});
  }
  localStorage.removeItem('sessaoAdmin');
  sessao = null;
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById('tela-login').classList.remove('oculto');
  document.getElementById('painel-admin').classList.add('oculto');
}

async function mostrarPainel() {
  document.getElementById('tela-login').classList.add('oculto');
  document.getElementById('painel-admin').classList.remove('oculto');

  const ehAdmin = sessao.papel === 'admin';
  document.getElementById('badge-equipe').innerHTML =
    `Logado como <strong>${sessao.nome}</strong> (${ehAdmin ? 'admin' : 'equipe'}) ` +
    `<a href="#" onclick="event.preventDefault(); sair();" style="margin-left:8px; font-size:0.8rem;">sair</a>`;
  document.getElementById('botao-panico').classList.toggle('oculto', !ehAdmin);
  document.getElementById('secao-estoque').classList.toggle('oculto', !ehAdmin);

  await carregarCategorias();
  await carregarPedidos();
  setInterval(carregarPedidos, 5000);

  if (ehAdmin) {
    await carregarStatusPanico();
    await carregarEstoque();
    setInterval(carregarStatusPanico, 5000);
  }

  document.getElementById('filtro-categoria-pendentes').addEventListener('change', renderPendentes);
  document.getElementById('filtro-busca-pendentes').addEventListener('input', renderPendentes);
  document.getElementById('filtro-busca-entregues').addEventListener('input', renderEntregues);
}

// ---------- Botão do pânico (somente admin) ----------
async function carregarStatusPanico() {
  const res = await apiAdmin('/status');
  const dados = await res.json();
  pedidosPausados = !!dados.pausado;
  atualizarBotaoPanico();
}

function atualizarBotaoPanico() {
  const botao = document.getElementById('botao-panico');
  const aviso = document.getElementById('aviso-panico');
  botao.textContent = pedidosPausados ? '✅ Retomar pedidos' : '🚨 Botão do Pânico';
  botao.classList.toggle('ativo', pedidosPausados);
  aviso.classList.toggle('oculto', !pedidosPausados);
}

async function alternarPanico() {
  const mensagem = pedidosPausados
    ? 'Retomar os pedidos no site principal?'
    : 'Isso vai PAUSAR IMEDIATAMENTE os pedidos no site principal. Confirmar?';
  if (!confirm(mensagem)) return;

  const res = await apiAdmin('/panico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ativar: !pedidosPausados })
  });
  const dados = await res.json();
  pedidosPausados = !!dados.pausado;
  atualizarBotaoPanico();
}

// ---------- Estoque (somente admin) ----------
async function carregarEstoque() {
  const res = await apiAdmin('/produtos');
  const lista = await res.json();
  const corpo = document.getElementById('corpo-estoque');
  corpo.innerHTML = '';

  lista.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${nomeCategoria(p.categoria)}</td>
      <td><input type="number" min="0" step="1" value="${p.estoque}" id="estoque-input-${p.id}" style="width:80px;"></td>
      <td><button class="secundario" onclick="salvarEstoque(${p.id})">Salvar</button></td>
    `;
    corpo.appendChild(tr);
  });
}

async function salvarEstoque(produtoId) {
  const input = document.getElementById(`estoque-input-${produtoId}`);
  const estoque = input.value;

  const res = await apiAdmin(`/produtos/${produtoId}/estoque`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estoque })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao salvar estoque.'); return; }
  input.value = dados.estoque;
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
  if (p.claimedBy === sessao.nome) return 'minha';
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
  const res = await apiAdmin('/pedidos');
  pedidosCache = await res.json();
  renderResumo(pedidosCache);
  renderPendentes();
  renderEntregues();
}

// ---------- Ações ----------
async function pegar(pedidoId) {
  const res = await apiAdmin(`/pedidos/${pedidoId}/pegar`, { method: 'POST' });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao pegar.'); carregarPedidos(); return; }
  carregarPedidos();
}

async function liberar(pedidoId, forcado) {
  if (forcado && !confirm('Confirmar liberação forçada? Só faça isso se a outra equipe realmente desistiu.')) return;
  const res = await apiAdmin(`/pedidos/${pedidoId}/liberar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forcado })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao liberar.'); carregarPedidos(); return; }
  carregarPedidos();
}

async function entregar(pedidoId) {
  const res = await apiAdmin(`/pedidos/${pedidoId}/entregar`, { method: 'POST' });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao marcar como entregue.'); carregarPedidos(); return; }
  carregarPedidos();
}

// ---------- Boot ----------
async function iniciar() {
  const salva = localStorage.getItem('sessaoAdmin');
  if (!salva) {
    mostrarLogin();
    return;
  }

  sessao = JSON.parse(salva);
  const res = await fetch('/api/admin/me', { headers: authHeader() });
  if (!res.ok) {
    localStorage.removeItem('sessaoAdmin');
    sessao = null;
    mostrarLogin();
    return;
  }

  await mostrarPainel();
}

iniciar();

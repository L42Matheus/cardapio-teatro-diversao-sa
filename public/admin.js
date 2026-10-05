let categoriasCache = [];
let pedidosCache = [];
let sessao = null; // { token, usuario, nome, papel }
let entregadoresCache = [];
let equipeOperacao = null;
let pedidosTimer = null;

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

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${data} ${formatarHora(iso)}`;
}

function statusPedido(status) {
  const nomes = {
    pendente_pagamento: 'Aguardando Pix',
    pago: 'Pago',
    aguardando: 'A entregar',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };
  return `<span class="status-chip status-${status}">${nomes[status] || status || '-'}</span>`;
}

function mensagemCurta(texto) {
  const msg = String(texto || '').trim();
  if (!msg) return '<span style="color:var(--texto-fraco);">—</span>';
  return msg.length > 50 ? `${msg.slice(0, 50)}...` : msg;
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

function nomeEquipeAtual() {
  return sessao && sessao.papel === 'admin'
    ? equipeOperacao
    : sessao?.nome;
}

function selecionarEquipeOperacao(nome) {
  equipeOperacao = nome;
  localStorage.setItem('equipeOperacaoAdmin', nome);
  renderSeletorEquipe();
  renderTodos();
  renderPendentes();
}

function selecionarEquipeLogin(nome) {
  equipeOperacao = nome;
  localStorage.setItem('equipeOperacaoAdmin', nome);
  renderEquipeLogin();
}

function renderEquipeLogin() {
  const salva = localStorage.getItem('equipeOperacaoAdmin') || equipeOperacao;
  document.querySelectorAll('#botoes-equipe-login .perfil-login').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.equipe === salva);
  });
}

async function carregarEntregadores() {
  const res = await apiAdmin('/entregadores');
  entregadoresCache = await res.json();
  const salva = localStorage.getItem('equipeOperacaoAdmin');
  if (sessao.papel === 'admin') {
    equipeOperacao = entregadoresCache.some(e => e.nome === salva) ? salva : null;
  } else {
    equipeOperacao = sessao.nome;
  }
  renderSeletorEquipe();
}

function renderSeletorEquipe() {
  const box = document.getElementById('seletor-equipe');
  const botoes = document.getElementById('botoes-equipe-operacao');
  const status = document.getElementById('equipe-operacao-status');
  if (!box || !botoes || !status) return;

  if (!sessao || sessao.papel !== 'admin') {
    box.classList.add('oculto');
    return;
  }

  box.classList.remove('oculto');
  status.textContent = equipeOperacao
    ? `Operando como ${equipeOperacao}.`
    : 'Escolha quem está operando este painel.';
  botoes.innerHTML = entregadoresCache.map((e, i) => `
    <button type="button"
            class="perfil-login${equipeOperacao === e.nome ? ' ativo' : ''}"
            onclick="selecionarEquipeOperacao('${e.nome.replace(/'/g, "\\'")}')">
      Equipe ${i + 1}
    </button>
  `).join('');
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
  if (pedidosTimer) {
    clearInterval(pedidosTimer);
    pedidosTimer = null;
  }
  localStorage.removeItem('sessaoAdmin');
  sessao = null;
  mostrarLogin();
}

function mostrarLogin() {
  if (pedidosTimer) {
    clearInterval(pedidosTimer);
    pedidosTimer = null;
  }
  document.getElementById('tela-login').classList.remove('oculto');
  document.getElementById('painel-admin').classList.add('oculto');
  renderEquipeLogin();
}

async function mostrarPainel() {
  document.getElementById('tela-login').classList.add('oculto');
  document.getElementById('painel-admin').classList.remove('oculto');

  const ehAdmin = sessao.papel === 'admin';
  document.getElementById('badge-equipe').innerHTML =
    `Logado como <strong>${sessao.nome}</strong> (${ehAdmin ? 'admin' : 'equipe'}) ` +
    `<a href="#" onclick="event.preventDefault(); sair();" style="margin-left:8px; font-size:0.8rem;">sair</a>`;
  // Aba "Estoque" so aparece para admin.
  document.getElementById('aba-estoque').classList.toggle('oculto', !ehAdmin);
  document.getElementById('aba-relatorio').classList.toggle('oculto', !ehAdmin);
  configurarAbas();
  configurarCarrosselKanban();
  configurarConfirmacao();

  await carregarCategorias();
  await carregarEntregadores();
  await carregarPedidos();
  if (pedidosTimer) clearInterval(pedidosTimer);
  pedidosTimer = setInterval(carregarPedidos, 5000);

  if (ehAdmin) {
    await carregarEstoque();
  }

  document.getElementById('filtro-categoria-pendentes').addEventListener('change', renderPendentes);
  document.getElementById('filtro-busca-todos').addEventListener('input', renderTodos);
  document.getElementById('filtro-busca-pendentes').addEventListener('input', renderPendentes);
  document.getElementById('filtro-busca-entregues').addEventListener('input', renderEntregues);
}

// ---------- Estoque (somente admin) ----------
let estoqueCache = []; // lista de produtos (com estoque atual) vinda da API

async function carregarEstoque() {
  const res = await apiAdmin('/produtos');
  estoqueCache = await res.json();
  renderEstoque();
}

// Vendas contam pedidos que geraram receita — pagos ou ja entregues.
// Pedidos pendentes de pagamento ou cancelados nao contam.
function vendidosDoProduto(produtoId) {
  return pedidosCache.filter(p =>
    p.produtoId === produtoId &&
    p.status !== 'pendente_pagamento' &&
    p.status !== 'cancelado'
  ).length;
}

// Valores digitados e ainda nao salvos (produtoId -> { preco, estoque }).
// O painel re-renderiza a cada 5s (carregarPedidos); sem isso o que o admin
// esta digitando seria apagado no meio da edicao.
const rascunhoEstoque = {};

function formatarPrecoInput(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

function guardarRascunho(produtoId, campo, valor) {
  rascunhoEstoque[produtoId] = { ...rascunhoEstoque[produtoId], [campo]: valor };
}

function renderEstoque() {
  const corpo = document.getElementById('corpo-estoque');
  if (!corpo || estoqueCache.length === 0) return;
  // Nao redesenha enquanto o admin esta com o cursor num campo da tabela
  // (no celular, redesenhar fecha o teclado). Atualiza no proximo ciclo.
  if (corpo.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  corpo.innerHTML = '';

  estoqueCache.forEach(p => {
    const vendidos = vendidosDoProduto(p.id);
    const disponivel = Number.isFinite(Number(p.estoque)) ? Number(p.estoque) : 0;
    const total = vendidos + disponivel;
    const esgotado = disponivel <= 0;
    const rascunho = rascunhoEstoque[p.id] || {};
    const precoTela = rascunho.preco ?? formatarPrecoInput(p.preco);
    const estoqueTela = rascunho.estoque ?? p.estoque;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Produto" class="estoque-produto">
        <strong>${p.nome}</strong><br>
        <small style="color:var(--texto-fraco);">${nomeCategoria(p.categoria)}</small>
      </td>
      <td data-label="Preço (R$)" class="estoque-preco">
        <input class="estoque-input preco-input" type="text" inputmode="decimal" value="${precoTela}" id="preco-input-${p.id}"
          oninput="guardarRascunho(${p.id}, 'preco', this.value)">
      </td>
      <td data-label="Disponíveis" class="estoque-disponivel">
        <input class="estoque-input" type="number" min="0" step="1" value="${estoqueTela}" id="estoque-input-${p.id}"
          oninput="guardarRascunho(${p.id}, 'estoque', this.value)">
        ${esgotado ? '<small class="estoque-esgotado">Esgotado</small>' : ''}
      </td>
      <td data-label="Vendidos" class="estoque-numero"><strong>${vendidos}</strong></td>
      <td data-label="Total" class="estoque-total">${total}</td>
      <td data-label="Ação"><button class="secundario" id="salvar-produto-${p.id}" onclick="salvarProduto(${p.id})">Salvar</button></td>
    `;
    corpo.appendChild(tr);
  });
}

async function salvarProduto(produtoId) {
  const produto = estoqueCache.find(p => p.id === produtoId);
  const preco = document.getElementById(`preco-input-${produtoId}`).value.trim();
  const estoque = document.getElementById(`estoque-input-${produtoId}`).value.trim();
  const precoNovo = Math.round(Number(preco.replace(',', '.')) * 100) / 100;

  if (produto && preco && precoNovo !== produto.preco) {
    const confirmar = confirm(
      `Mudar o preço de "${produto.nome}" de R$ ${formatarPrecoInput(produto.preco)} para R$ ${formatarPrecoInput(precoNovo)}?\n\n` +
      'Vale para os próximos pedidos. Quem já gerou o Pix paga o valor antigo.'
    );
    if (!confirmar) return;
  }

  const botao = document.getElementById(`salvar-produto-${produtoId}`);
  if (botao) { botao.disabled = true; botao.textContent = 'Salvando...'; }
  const res = await apiAdmin(`/produtos/${produtoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preco, estoque })
  });
  const dados = await res.json();
  if (botao) { botao.disabled = false; botao.textContent = 'Salvar'; }
  if (!res.ok) { alert(dados.erro || 'Erro ao salvar produto.'); return; }
  // Atualiza no cache e re-renderiza pra recomputar Total.
  delete rascunhoEstoque[produtoId];
  const idx = estoqueCache.findIndex(p => p.id === produtoId);
  if (idx >= 0) estoqueCache[idx] = dados;
  if (document.activeElement) document.activeElement.blur();
  renderEstoque();
  if (botao) {
    const novoBotao = document.getElementById(`salvar-produto-${produtoId}`);
    if (novoBotao) {
      novoBotao.textContent = 'Salvo ✓';
      setTimeout(() => { novoBotao.textContent = 'Salvar'; }, 1500);
    }
  }
}

// ---------- Abas do painel ----------
function configurarAbas() {
  document.querySelectorAll('.abas-admin .aba').forEach(btn => {
    btn.onclick = () => trocarAba(btn.dataset.aba);
  });
  // Restaura ultima aba usada; default = todos
  const salva = localStorage.getItem('abaAdminAtiva') || 'todos';
  const abaBtn = document.querySelector(`.abas-admin .aba[data-aba="${salva}"]`);
  const valida = abaBtn && !abaBtn.classList.contains('oculto') ? salva : 'todos';
  trocarAba(valida);
}

function centralizarAbaAdmin(btn) {
  const trilho = btn?.closest('.abas-admin');
  if (!trilho) return;
  const left = btn.offsetLeft - ((trilho.clientWidth - btn.offsetWidth) / 2);
  trilho.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
}

function trocarAba(nome) {
  document.querySelectorAll('.abas-admin .aba').forEach(a => {
    a.classList.toggle('ativa', a.dataset.aba === nome);
  });
  const abaAtiva = document.querySelector(`.abas-admin .aba[data-aba="${nome}"]`);
  requestAnimationFrame(() => centralizarAbaAdmin(abaAtiva));
  document.querySelectorAll('.tab-conteudo').forEach(s => {
    s.classList.toggle('oculto', s.id !== 'tab-' + nome);
  });
  localStorage.setItem('abaAdminAtiva', nome);
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

// ---------- Relatório de valores compensados ----------
// "Compensado" = pedido com pagamento confirmado (pago, a entregar ou
// entregue). "Origem" distingue confirmacao real da Efi (via webhook,
// com endToEndId) de uma marcacao manual do admin (sem garantia de que o
// dinheiro caiu de verdade).
function horarioConfirmacaoPedido(p) {
  return (p.pagamento && p.pagamento.horario) || p.atualizadoEm;
}

function gerarRelatorioCompensados() {
  const corpo = document.getElementById('corpo-relatorio');
  const resumoBox = document.getElementById('relatorio-resumo');
  if (!corpo || !resumoBox) return;

  const compensados = pedidosCache
    .filter(p => p.status !== 'pendente_pagamento' && p.status !== 'cancelado')
    .sort((a, b) => new Date(horarioConfirmacaoPedido(b)) - new Date(horarioConfirmacaoPedido(a)));

  const total = compensados.reduce((soma, p) => soma + Number(p.valor || 0), 0);
  const viaWebhook = compensados.filter(p => p.pagamento && p.pagamento.origem === 'webhook').length;
  const viaManual = compensados.filter(p => p.pagamento && p.pagamento.origem === 'manual').length;

  resumoBox.classList.remove('oculto');
  resumoBox.innerHTML = `
    <div class="caixa azul">
      <div class="label">Pedidos compensados</div>
      <div class="valor">${compensados.length}</div>
    </div>
    <div class="caixa verde">
      <div class="label">Total confirmado</div>
      <div class="valor">${formatarBRL(total)}</div>
    </div>
    <div class="caixa">
      <div class="label">Via Efí (webhook)</div>
      <div class="valor">${viaWebhook}</div>
    </div>
    <div class="caixa">
      <div class="label">Marcado manual</div>
      <div class="valor">${viaManual}</div>
    </div>
  `;

  corpo.innerHTML = '';
  if (compensados.length === 0) {
    corpo.innerHTML = `<tr class="linha-vazia"><td colspan="7" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhum pedido compensado ainda.</td></tr>`;
    return;
  }

  compensados.forEach(p => {
    const pagamento = p.pagamento || null;
    const origemHTML = !pagamento
      ? '<span style="color:var(--texto-fraco);">— (anterior ao relatório)</span>'
      : pagamento.origem === 'webhook'
        ? '<span class="pill-info">✅ Efí (webhook)</span>'
        : '<span class="pill-info" style="background:#eee; color:#555;">✋ Manual (admin)</span>';
    const valorExibido = pagamento && pagamento.valorConfirmado != null ? pagamento.valorConfirmado : p.valor;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Ticket"><strong>${p.codigo || '#' + p.id}</strong></td>
      <td data-label="Produto">${p.produtoNome}</td>
      <td data-label="Valor">${formatarBRL(valorExibido)}</td>
      <td data-label="Confirmado em">${formatarDataHora(horarioConfirmacaoPedido(p))}</td>
      <td data-label="Origem">${origemHTML}</td>
      <td data-label="End-to-End ID (Efi)"><small>${(pagamento && pagamento.endToEndId) || '—'}</small></td>
      <td data-label="Status atual">${statusPedido(p.status)}</td>
    `;
    corpo.appendChild(tr);
  });
}

// ---------- Filtros e ordenação ----------
function filtroTexto(p, termo) {
  if (!termo) return true;
  const alvo = [
    p.codigo,
    p.status,
    p.produtoNome,
    p.nomeComprador,
    p.nomeDestinatario,
    p.equipeDestinatario,
    p.contato
  ].join(' ').toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

function estadoReserva(p) {
  if (!p.claimedBy || !reservaAtiva(p)) return 'livre';
  if (p.claimedBy === nomeEquipeAtual()) return 'minha';
  return 'outra';
}

// ---------- Todos ----------
function renderTodos() {
  const corpo = document.getElementById('corpo-todos');
  const busca = document.getElementById('filtro-busca-todos')?.value.trim() || '';
  if (!corpo) return;

  const lista = pedidosCache
    .filter(p => filtroTexto(p, busca))
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  document.getElementById('contador-todos').textContent = `(${lista.length})`;
  const badgeTodos = document.getElementById('aba-contador-todos');
  if (badgeTodos) badgeTodos.innerHTML = lista.length ? `<span class="contador">${lista.length}</span>` : '';
  corpo.innerHTML = '';

  if (lista.length === 0) {
    corpo.innerHTML = `<tr class="linha-vazia"><td colspan="11" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  const ehAdmin = sessao && sessao.papel === 'admin';

  lista.forEach(p => {
    const tr = document.createElement('tr');
    const compradorHTML = p.anonimo
      ? `<span style="color:var(--texto-fraco); font-weight:600;">Anônimo</span><br><small>${p.contato || ''}</small>`
      : `${p.nomeComprador || '-'}<br><small>${p.contato || ''}</small>`;
    const acaoHTML = (ehAdmin && p.status === 'pendente_pagamento')
      ? `<button class="secundario pequeno" onclick="simularPagamentoAdmin(${p.id})">Marcar como pago</button>`
      : '<span style="color:var(--texto-fraco);">—</span>';

    tr.innerHTML = `
      <td data-label="Ticket"><strong>${p.codigo || '#' + p.id}</strong></td>
      <td data-label="Status">${statusPedido(p.status)}</td>
      <td data-label="Hora">${formatarHora(p.criadoEm)}</td>
      <td data-label="Categoria">${nomeCategoria(p.categoria)}</td>
      <td data-label="Produto">${p.produtoNome}</td>
      <td data-label="Destinatário"><strong>${p.nomeDestinatario}</strong></td>
      <td data-label="Equipe">${p.equipeDestinatario || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td data-label="Comprador">${compradorHTML}</td>
      <td data-label="Mensagem">${mensagemCurta(p.mensagemEspecial)}</td>
      <td data-label="Valor">${formatarBRL(p.valor)}</td>
      <td data-label="Ação">${acaoHTML}</td>
    `;
    corpo.appendChild(tr);
  });
}

// Marca manualmente um pedido como pago (admin), sem depender do webhook da
// Efi — usar so pra corrigir um pedido cujo pagamento caiu mas o aviso nao
// chegou, ou pra teste.
async function simularPagamentoAdmin(pedidoId) {
  if (!confirm('Marcar este pedido como pago manualmente, sem confirmação da Efí?')) return;
  const res = await apiAdmin(`/pedidos/${pedidoId}/simular-pagamento`, { method: 'POST' });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao marcar como pago.'); return; }
  carregarPedidos();
}

// ---------- Pendentes ----------
// Quadro kanban: Disponiveis -> Com a minha equipe -> Com outras equipes.
// No computador as 3 colunas ficam lado a lado; no celular viram um
// carrossel (scroll-snap) com a borda da proxima coluna aparecendo.
const COLUNAS_KANBAN = [
  { chave: 'livre', curto: '📥 Livres', vazio: 'Nenhum pedido livre agora. 🎉' },
  { chave: 'minha', curto: '🚚 Comigo', vazio: 'Nada com a sua equipe. Deslize para “Livres” e pegue um pedido.' },
  { chave: 'outra', curto: '🔒 Outras', vazio: 'Nenhum pedido com outras equipes.' }
];
let colunaKanbanAtual = 0;

function cardPedidoKanban(p, estado, ehProximo) {
  const comprador = p.anonimo ? 'Anônimo' : (p.nomeComprador || '');
  const mensagem = String(p.mensagemEspecial || '').trim();
  let selo = '';
  let acoes = '';
  if (estado === 'livre') {
    if (ehProximo) selo = '<span class="kanban-selo selo-proximo">PRÓXIMO</span>';
    acoes = nomeEquipeAtual()
      ? `<button onclick="pegar(${p.id})">Peguei este</button>`
      : '<button disabled>Escolha a equipe acima</button>';
  } else if (estado === 'minha') {
    selo = `<span class="kanban-selo selo-minha">com vocês há ${minutosDesde(p.claimedAt)} min</span>`;
    acoes = `
      <button class="botao-entregue" onclick="entregar(${p.id})">✓ Entregue</button>
      <button class="secundario" onclick="liberar(${p.id}, false)">Liberar</button>`;
  } else {
    selo = `<span class="kanban-selo">🔒 ${p.claimedBy} · ${minutosDesde(p.claimedAt)} min</span>`;
    acoes = `<button class="secundario" onclick="liberar(${p.id}, true)" title="Só use se souber que a equipe desistiu">Forçar liberação</button>`;
  }
  return `
    <article class="kanban-card card-${estado}" data-pedido-id="${p.id}">
      <div class="kanban-card-topo">
        <span><strong>${p.codigo || '#' + p.id}</strong> · ${formatarHora(p.criadoEm)}</span>
        <span>${p.produtoNome}</span>
      </div>
      ${selo}
      <div class="kanban-destino">
        <span class="kanban-destinatario">${p.nomeDestinatario}</span>
        <span class="kanban-equipe">${p.equipeDestinatario || '—'}</span>
      </div>
      ${mensagem ? `<div class="kanban-mensagem">💬 ${mensagemCurta(mensagem)}</div>` : ''}
      <div class="kanban-detalhe">${nomeCategoria(p.categoria)} · de ${comprador} · ${formatarBRL(p.valor)}</div>
      <div class="kanban-acoes">${acoes}</div>
    </article>`;
}

function renderPendentes() {
  const categoria = document.getElementById('filtro-categoria-pendentes').value;
  const busca = document.getElementById('filtro-busca-pendentes').value.trim();

  const lista = pedidosCache
    .filter(p => p.status === 'pago' || p.status === 'aguardando')
    .filter(p => categoria === 'todos' || p.categoria === categoria)
    .filter(p => filtroTexto(p, busca))
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm)); // mais antigo primeiro

  const grupos = { livre: [], minha: [], outra: [] };
  lista.forEach(p => grupos[estadoReserva(p)].push(p));

  document.getElementById('contador-pendentes').textContent = `(${lista.length})`;
  const badgePend = document.getElementById('aba-contador-pendentes');
  if (badgePend) badgePend.innerHTML = lista.length ? `<span class="contador">${lista.length}</span>` : '';

  COLUNAS_KANBAN.forEach(col => {
    const pedidos = grupos[col.chave];
    document.getElementById(`kanban-n-${col.chave}`).textContent = pedidos.length;
    document.getElementById(`kanban-${col.chave}`).innerHTML = pedidos.length
      ? pedidos.map((p, i) => cardPedidoKanban(p, col.chave, i === 0)).join('')
      : `<div class="kanban-vazio">${col.vazio}</div>`;
  });

  document.getElementById('kanban-pilulas').innerHTML = COLUNAS_KANBAN.map((col, i) => `
    <button type="button" role="tab" class="kanban-pilula pilula-${col.chave}${i === colunaKanbanAtual ? ' ativa' : ''}"
      aria-selected="${i === colunaKanbanAtual}" onclick="irParaColunaKanban(${i})">
      <b>${grupos[col.chave].length}</b>${col.curto}
    </button>`).join('');
  marcarColunaKanban(colunaKanbanAtual);
}

function marcarColunaKanban(indice) {
  colunaKanbanAtual = indice;
  document.querySelectorAll('.kanban-pilula').forEach((el, i) => {
    el.classList.toggle('ativa', i === indice);
    el.setAttribute('aria-selected', i === indice);
  });
  document.querySelectorAll('#kanban-pontos i').forEach((el, i) => el.classList.toggle('on', i === indice));
}

function irParaColunaKanban(indice) {
  const trilho = document.getElementById('kanban-trilho');
  const coluna = trilho.children[indice];
  if (!coluna) return;
  esconderAvisoKanban();
  trilho.scrollTo({ left: coluna.offsetLeft - trilho.offsetLeft, behavior: 'smooth' });
  marcarColunaKanban(indice);
}

// Descobre qual coluna esta visivel depois que a pessoa desliza o dedo.
function configurarCarrosselKanban() {
  const trilho = document.getElementById('kanban-trilho');
  if (!trilho) return;
  let timer;
  trilho.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const colunas = [...trilho.children];
      const posicao = trilho.scrollLeft + trilho.offsetLeft;
      let maisPerto = 0;
      colunas.forEach((c, i) => {
        if (Math.abs(c.offsetLeft - posicao) < Math.abs(colunas[maisPerto].offsetLeft - posicao)) maisPerto = i;
      });
      if (maisPerto !== colunaKanbanAtual) marcarColunaKanban(maisPerto);
    }, 80);
  }, { passive: true });
}

let timerAvisoKanban;
function mostrarAvisoKanban(texto) {
  const aviso = document.getElementById('kanban-aviso');
  aviso.innerHTML = `<span>${texto}</span><button type="button" onclick="irParaColunaKanban(1)">Ver →</button>`;
  aviso.classList.remove('oculto');
  clearTimeout(timerAvisoKanban);
  timerAvisoKanban = setTimeout(esconderAvisoKanban, 4000);
  const pilula = document.querySelector('.kanban-pilula.pilula-minha');
  if (pilula) {
    pilula.classList.remove('pisca');
    void pilula.offsetWidth; // reinicia a animacao
    pilula.classList.add('pisca');
  }
}

function esconderAvisoKanban() {
  clearTimeout(timerAvisoKanban);
  document.getElementById('kanban-aviso')?.classList.add('oculto');
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
  const badgeEntr = document.getElementById('aba-contador-entregues');
  if (badgeEntr) badgeEntr.innerHTML = lista.length ? `<span class="contador">${lista.length}</span>` : '';
  corpo.innerHTML = '';

  if (lista.length === 0) {
    corpo.innerHTML = `<tr class="linha-vazia"><td colspan="10" style="text-align:center; color:var(--texto-fraco); padding:20px;">Nenhuma entrega concluída ainda.</td></tr>`;
    return;
  }

  lista.forEach(p => {
    const tr = document.createElement('tr');
    const compradorHTML = p.anonimo
      ? '<span style="color:var(--texto-fraco); font-weight:600;">Anônimo</span>'
      : p.nomeComprador;

    tr.innerHTML = `
      <td data-label="Ticket"><strong>${p.codigo || '#' + p.id}</strong></td>
      <td data-label="Entregue em">${formatarDataHora(p.atualizadoEm)}</td>
      <td data-label="Por">${p.equipeEntregou || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td data-label="Categoria">${nomeCategoria(p.categoria)}</td>
      <td data-label="Produto">${p.produtoNome}</td>
      <td data-label="Destinatário">${p.nomeDestinatario}</td>
      <td data-label="Equipe">${p.equipeDestinatario || '<span style="color:var(--texto-fraco);">—</span>'}</td>
      <td data-label="Comprador">${compradorHTML}</td>
      <td data-label="Mensagem">${mensagemCurta(p.mensagemEspecial)}</td>
      <td data-label="Valor">${formatarBRL(p.valor)}</td>
    `;
    corpo.appendChild(tr);
  });
}

async function carregarPedidos() {
  const res = await apiAdmin('/pedidos');
  pedidosCache = await res.json();
  renderResumo(pedidosCache);
  renderTodos();
  renderPendentes();
  renderEntregues();
  // A tabela de estoque mostra a contagem de vendidos por produto (derivada
  // dos pedidos), entao precisa re-renderizar quando pedidos mudam.
  renderEstoque();
}

// ---------- Confirmação (Sim verde / Não vermelho) ----------
// Na correria do evento um toque errado pega/entrega/libera o pedido errado,
// entao toda acao do quadro pede confirmacao mostrando para quem e o pedido.
let resolverConfirmacao = null;
let confirmacaoAbertaEm = 0;

function confirmarAcao({ icone, titulo, pedidoId, texto, sim }) {
  const p = pedidosCache.find(x => x.id === pedidoId);
  document.getElementById('confirmacao-icone').textContent = icone;
  document.getElementById('confirmacao-titulo').textContent = titulo;
  document.getElementById('confirmacao-texto').textContent = texto || '';
  const boxPedido = document.getElementById('confirmacao-pedido');
  boxPedido.innerHTML = '';
  if (p) {
    const nome = document.createElement('strong');
    nome.textContent = p.nomeDestinatario;
    const detalhe = document.createElement('span');
    detalhe.textContent = `${p.equipeDestinatario || 'sem equipe'} · ${p.produtoNome} · ${p.codigo || '#' + p.id}`;
    boxPedido.append(nome, detalhe);
  }
  document.getElementById('confirmacao-sim').textContent = sim;
  document.getElementById('confirmacao').classList.remove('oculto');
  confirmacaoAbertaEm = Date.now();
  document.getElementById('confirmacao-nao').focus();
  return new Promise(resolve => { resolverConfirmacao = resolve; });
}

function fecharConfirmacao(resposta) {
  // Ignora toques nos primeiros 400ms: evita que um toque duplo no botao do
  // card ja confirme sem a pessoa ler.
  if (resposta && Date.now() - confirmacaoAbertaEm < 400) return;
  document.getElementById('confirmacao').classList.add('oculto');
  if (resolverConfirmacao) resolverConfirmacao(resposta);
  resolverConfirmacao = null;
}

function configurarConfirmacao() {
  document.getElementById('confirmacao-sim').onclick = () => fecharConfirmacao(true);
  document.getElementById('confirmacao-nao').onclick = () => fecharConfirmacao(false);
  document.getElementById('confirmacao').addEventListener('click', e => {
    if (e.target.id === 'confirmacao') fecharConfirmacao(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && resolverConfirmacao) fecharConfirmacao(false);
  });
}

// ---------- Ações ----------
async function pegar(pedidoId) {
  if (!nomeEquipeAtual()) {
    alert('Escolha a equipe de entrega antes de pegar um pedido.');
    return;
  }
  const confirmou = await confirmarAcao({
    icone: '📥', titulo: 'Deseja realmente assumir este pedido?', pedidoId,
    texto: `Ele vai para a coluna “Comigo” da ${nomeEquipeAtual()}.`, sim: 'Sim, assumir'
  });
  if (!confirmou) return;
  const res = await apiAdmin(`/pedidos/${pedidoId}/pegar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipeOperacao: nomeEquipeAtual() })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao pegar.'); carregarPedidos(); return; }
  await carregarPedidos();
  mostrarAvisoKanban(`<strong>${dados.nomeDestinatario || 'Pedido'}</strong> foi para “Comigo”`);
}

async function liberar(pedidoId, forcado) {
  const confirmou = await confirmarAcao(forcado
    ? { icone: '⚠️', titulo: 'Forçar a liberação deste pedido?', pedidoId,
        texto: 'Ele está com outra equipe. Só faça isso se ela realmente desistiu.', sim: 'Sim, forçar' }
    : { icone: '↩️', titulo: 'Deseja realmente liberar este pedido?', pedidoId,
        texto: 'Ele volta para “Disponíveis” e outra equipe pode pegar.', sim: 'Sim, liberar' });
  if (!confirmou) return;
  const res = await apiAdmin(`/pedidos/${pedidoId}/liberar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forcado, equipeOperacao: nomeEquipeAtual() })
  });
  const dados = await res.json();
  if (!res.ok) { alert(dados.erro || 'Erro ao liberar.'); carregarPedidos(); return; }
  carregarPedidos();
}

async function entregar(pedidoId) {
  if (!nomeEquipeAtual()) {
    alert('Escolha a equipe de entrega antes de marcar como entregue.');
    return;
  }
  const confirmou = await confirmarAcao({
    icone: '✅', titulo: 'Realmente foi entregue?', pedidoId,
    texto: 'Confirme só depois de entregar na mão da pessoa.', sim: 'Sim, foi entregue'
  });
  if (!confirmou) return;
  const res = await apiAdmin(`/pedidos/${pedidoId}/entregar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipeOperacao: nomeEquipeAtual() })
  });
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
renderEquipeLogin();

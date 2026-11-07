// @spec 002-consulta-pedido@2
// Escapa texto antes de colocar em innerHTML (nomes e equipes sao digitados
// por quem compra).
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function legendaStatus(status) {
  const legendas = {
    pendente_pagamento: 'aguardando pagamento',
    pago: 'pago, aguardando ser atribuído',
    aguardando: 'a caminho — nossa equipe já pegou seu trote!',
    entregue: 'entregue — missão cumprida!',
    cancelado: 'cancelado'
  };
  return legendas[status] || status;
}

// #resultado-consulta e uma regiao role="status": o resultado e anunciado por
// leitores de tela sem que o participante precise procura-lo (FR-007). Limpa
// antes de escrever para que um resultado repetido seja anunciado de novo.
let temporizadorResultado = null;
function mostrarResultado(html) {
  const resultadoEl = document.getElementById('resultado-consulta');
  clearTimeout(temporizadorResultado);
  resultadoEl.innerHTML = '';
  temporizadorResultado = setTimeout(() => { resultadoEl.innerHTML = html; }, 50);
}

function marcarCampoInvalido(input, invalido) {
  if (invalido) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'resultado-consulta');
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

async function consultarTicket() {
  const input = document.getElementById('ticketConsulta');
  const ticket = input.value.trim().toUpperCase();
  if (!ticket) {
    // Foco previsivel: no proprio campo a preencher (FR-003, FR-007).
    marcarCampoInvalido(input, true);
    mostrarResultado(`<div class="aviso erro">Digite o código do pedido.</div>`);
    input.focus();
    return;
  }
  marcarCampoInvalido(input, false);

  mostrarResultado(`<div class="aviso info">Consultando...</div>`);

  let res;
  try {
    res = await fetch(`/api/pedidos/${encodeURIComponent(ticket)}`);
  } catch (err) {
    mostrarResultado(`<div class="aviso erro">Falha de conexão. Verifique sua internet e tente novamente.</div>`);
    return;
  }
  if (!res.ok) {
    mostrarResultado(`<div class="aviso erro">Pedido não encontrado. Confira o código.</div>`);
    return;
  }
  const dados = await res.json();
  const unico = Array.isArray(dados.itens) && dados.itens.length === 1 ? dados.itens[0] : null;
  const itens = Array.isArray(dados.itens) && dados.itens.length > 1
    ? `
      <div style="margin-top:8px;">
        ${dados.itens.map((item, i) => `
          <div style="padding:7px 0; border-top:1px solid rgba(255,255,255,0.45);">
            ${i + 1}. ${esc(item.produto)} para <strong>${esc(item.destinatario)}</strong>
            <br><small>${esc(item.equipe || '')} · <span class="status-${esc(item.status)}">${esc(legendaStatus(item.status))}</span></small>
          </div>
        `).join('')}
      </div>
    `
    : `<div>${esc(dados.produto)} para <strong>${esc(dados.destinatario)}</strong>${unico && unico.equipe ? `<br><small>Equipe: ${esc(unico.equipe)}</small>` : ''}</div>`;

  mostrarResultado(`
    <div class="aviso sucesso">
      <div style="font-size:1.1rem; margin-bottom:6px;">
        <strong>${esc(dados.ticket)}</strong>
      </div>
      ${itens}
      <div style="margin-top:8px;">
        Status: <span class="status-${esc(dados.status)}">${esc(legendaStatus(dados.status))}</span>
      </div>
    </div>
  `);
}

// Ao digitar, o campo deixa de ser marcado como invalido.
document.getElementById('ticketConsulta').addEventListener('input', evento => {
  if (evento.target.value.trim()) marcarCampoInvalido(evento.target, false);
});

// Se o usuário chegou com ?codigo=EAC-XXXX na URL, já consulta.
(function autoConsulta() {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('codigo');
  if (codigo) {
    document.getElementById('ticketConsulta').value = codigo.toUpperCase();
    consultarTicket();
  }
})();

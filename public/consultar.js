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

async function consultarTicket() {
  const input = document.getElementById('ticketConsulta');
  const ticket = input.value.trim().toUpperCase();
  const resultadoEl = document.getElementById('resultado-consulta');
  if (!ticket) {
    resultadoEl.innerHTML = `<div class="aviso erro">Digite o código do pedido.</div>`;
    return;
  }

  resultadoEl.innerHTML = `<div class="aviso info">Consultando...</div>`;

  const res = await fetch(`/api/pedidos/${encodeURIComponent(ticket)}`);
  if (!res.ok) {
    resultadoEl.innerHTML = `<div class="aviso erro">Pedido não encontrado. Confira o código.</div>`;
    return;
  }
  const dados = await res.json();
  resultadoEl.innerHTML = `
    <div class="aviso sucesso">
      <div style="font-size:1.1rem; margin-bottom:6px;">
        <strong>${dados.ticket}</strong>
      </div>
      <div>${dados.produto} para <strong>${dados.destinatario}</strong></div>
      <div style="margin-top:8px;">
        Status: <span class="status-${dados.status}">${legendaStatus(dados.status)}</span>
      </div>
    </div>
  `;
}

// Se o usuário chegou com ?codigo=EAC-XXXX na URL, já consulta.
(function autoConsulta() {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('codigo');
  if (codigo) {
    document.getElementById('ticketConsulta').value = codigo.toUpperCase();
    consultarTicket();
  }
})();

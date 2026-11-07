"""Testes de aceitação do site, um ou mais por requisito do Spec Kit (@criterion("<feature>/FR-NNN")).

Escritos pelo verificador a partir de specs/*/spec.md, antes da implementação das propostas
CR-001 a CR-004. Os critérios novos (001/FR-012 a FR-017, 002/FR-006 e FR-007) verificam o EFEITO
para quem usa tecnologia assistiva, aceitando qualquer solução que o produza (por exemplo, uma
mensagem é "anunciada" se estiver numa região viva OU for a descrição acessível do campo focado).

Rodam contra a demonstração local (npm run demo: Pix simulado, banco local), nunca contra produção.
    EVOSPEC_ROOT=<repo> EVOSPEC_BASE_URL=http://localhost:3000 python evospec.py verify
"""
import json
import os
import re
import time
import urllib.request

from playwright.sync_api import expect

BASE = os.environ.get("EVOSPEC_BASE_URL", "http://localhost:3000").rstrip("/")
START_URL = BASE + "/"
WEBHOOK_TOKEN = os.environ.get("EVOSPEC_WEBHOOK_TOKEN", "demo")
PRODUTO_ROSA, PRODUTO_PRISAO = 1, 20

CRITERIA = {}


def criterion(ac_id):
    def wrap(fn):
        CRITERIA.setdefault(ac_id, []).append(fn)
        return fn
    return wrap


# ------------------------------------------------------------------ utilidades
def api(caminho, corpo=None):
    req = urllib.request.Request(BASE + caminho, method="POST" if corpo is not None else "GET",
                                 data=json.dumps(corpo).encode() if corpo is not None else None,
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read() or b"{}")


def equipe_valida():
    return api("/api/equipes")[0]


def criar_pedido(destinatario="Destinatário Teste", produto=PRODUTO_ROSA):
    return api("/api/pedidos", {"produtoId": produto, "nomeComprador": "Comprador Teste",
                                "contato": "83900000000",
                                "destinatarios": [{"nomeDestinatario": destinatario,
                                                   "equipeDestinatario": equipe_valida(),
                                                   "mensagemEspecial": ""}]})


def pagar(pedido):
    api("/webhook/pix?token=" + WEBHOOK_TOKEN, {"pix": [{
        "txid": pedido["pix"]["txid"], "valor": str(pedido["pix"]["valor"]),
        "endToEndId": "E00000000TESTE" + pedido["pix"]["txid"][:14],
        "horario": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}]})


def abrir_formulario(page, produto=PRODUTO_ROSA):
    page.goto(f"{BASE}/?produto={produto}")
    expect(page.locator("#secao-formulario")).to_be_visible(timeout=10000)


def preencher(page, nome="Maria da Silva", contato="(83) 90000-0000", destinatario="João Pereira"):
    page.fill("#nomeComprador", nome)
    page.fill("#contato", contato)
    page.fill("#nomeDestinatario", destinatario)
    page.select_option("#equipeDestinatario", index=1)


def esperar_cardapio(page):
    expect(page.locator("#lista-produtos .produto-card").first).to_be_visible(timeout=10000)


REGIOES_VIVAS = "[role=alert],[role=status],[aria-live=polite],[aria-live=assertive]"


def anunciado(page, padrao):
    """True se o texto estiver numa região viva ou na descrição/nome acessível do elemento focado."""
    vivas = page.evaluate(f"[...document.querySelectorAll('{REGIOES_VIVAS}')].map(e => e.textContent)")
    if any(re.search(padrao, t or "", re.I) for t in vivas):
        return True
    focado = page.locator(":focus")
    if focado.count():
        try:
            expect(focado).to_have_accessible_description(re.compile(padrao, re.I), timeout=500)
            return True
        except AssertionError:
            pass
        try:
            expect(focado).to_have_accessible_name(re.compile(padrao, re.I), timeout=500)
            return True
        except AssertionError:
            pass
    return False


def axe_setup(page):
    """Cardápio com um produto esgotado (resposta da API simulada) para a varredura do axe-core."""
    def rota(route):
        resp = route.fetch()
        dados = resp.json()
        dados[0]["estoque"] = 0
        route.fulfill(response=resp, json=dados)
    page.route("**/api/produtos", rota)
    page.goto(START_URL)
    esperar_cardapio(page)


# ------------------------------------------------------------------ 001 — linha de base (v1)
@criterion("001/FR-001")
def cardapio_mostra_produtos_e_filtra(page):
    esperar_cardapio(page)
    card = page.locator(".produto-card").first
    for parte in (".preco", "h3", "img"):
        expect(card.locator(parte)).to_have_count(1)
    page.locator(".aba", has_text="Botons").click()
    nomes = page.locator(".produto-card h3").all_inner_texts()
    assert nomes and all("Boton" in n for n in nomes), nomes


@criterion("001/FR-002")
def esgotado_nao_pode_ser_escolhido(page):
    axe_setup(page)
    botao = page.locator(".produto-card").first.locator("button")
    expect(botao).to_be_disabled()


@criterion("001/FR-003")
def cardapio_atualiza_sem_perder_o_foco(page):
    esperar_cardapio(page)
    botao = page.locator(".produto-card:not(.esgotado) button").first
    botao.focus()
    nome_antes = page.evaluate("document.activeElement.closest('.produto-card')?.querySelector('h3')?.textContent")
    page.wait_for_timeout(6500)  # o cardápio é atualizado a cada 5 s
    nome_depois = page.evaluate("document.activeElement.closest('.produto-card')?.querySelector('h3')?.textContent || document.activeElement.tagName")
    assert nome_depois == nome_antes, f"foco antes em '{nome_antes}', depois em '{nome_depois}'"


@criterion("001/FR-004")
def escolher_produto_abre_formulario_sem_nova_aba_inesperada(page):
    esperar_cardapio(page)
    botao = page.locator(".produto-card:not(.esgotado) button").first
    paginas_antes = len(page.context.pages)
    botao.click()
    page.wait_for_timeout(1500)
    if len(page.context.pages) > paginas_antes:
        aviso = (botao.get_attribute("aria-label") or "") + " " + botao.inner_text() + " " + \
                (page.evaluate("b => b.getAttribute('aria-describedby') && document.getElementById(b.getAttribute('aria-describedby'))?.textContent", botao.element_handle()) or "")
        assert re.search(r"nova aba|nova janela", aviso, re.I), "abriu nova aba sem avisar"
        nova = page.context.pages[-1]
        expect(nova.locator("#secao-formulario")).to_be_visible(timeout=10000)
    else:
        expect(page.locator("#secao-formulario")).to_be_visible()


@criterion("001/FR-005")
def formulario_tem_os_campos_exigidos(page):
    abrir_formulario(page)
    for campo in ("#nomeComprador", "#contato", "#nomeDestinatario", "#equipeDestinatario", "#anonimo", "#mensagemEspecial"):
        expect(page.locator(campo)).to_have_count(1)
    assert page.locator("#equipeDestinatario option").count() > 1
    assert page.get_attribute("#mensagemEspecial", "maxlength") == "50"


@criterion("001/FR-006")
def dado_invalido_nao_cria_pedido_e_explica(page):
    abrir_formulario(page)
    envios = []
    page.on("request", lambda r: envios.append(r) if r.method == "POST" and "/api/pedidos" in r.url else None)
    preencher(page, nome="Ana")
    page.locator("#btn-gerar-pix").click()
    page.wait_for_timeout(800)
    assert not envios, "pedido enviado com nome inválido"
    expect(page.get_by_text(re.compile("4 caracteres"))).to_be_visible()


@criterion("001/FR-007")
def varias_pessoas_num_pedido(page):
    abrir_formulario(page)
    preencher(page, destinatario="Pessoa Um")
    page.locator("#btn-adicionar-destinatario").click()
    page.fill("#nomeDestinatario", "Pessoa Dois")
    page.select_option("#equipeDestinatario", index=2)
    page.locator("#btn-gerar-pix").click()
    expect(page.locator("#pix-itens")).to_contain_text("2 entregas", timeout=15000)


@criterion("001/FR-008")
def pix_mostra_codigo_valor_copiaecola_e_expiracao(page):
    abrir_formulario(page)
    preencher(page)
    page.locator("#btn-gerar-pix").click()
    expect(page.locator("#pix-ticket")).to_have_text(re.compile(r"EAC-\w+"), timeout=15000)
    expect(page.locator("#pix-valor")).to_contain_text("R$")
    assert page.input_value("#pix-copiacola")
    expect(page.locator("#pix-expira")).to_contain_text("expira")


@criterion("001/FR-009")
def acionamentos_repetidos_criam_um_pedido(page):
    abrir_formulario(page)
    envios = []
    page.on("request", lambda r: envios.append(r) if r.method == "POST" and "/api/pedidos" in r.url else None)
    preencher(page)
    page.locator("#btn-gerar-pix").dblclick()
    page.wait_for_timeout(3000)
    assert len(envios) == 1, f"{len(envios)} pedidos enviados"


def gerar_pix_na_pagina(page, produto=PRODUTO_ROSA):
    abrir_formulario(page, produto)
    preencher(page)
    with page.expect_response(lambda r: "/api/pedidos" in r.url and r.request.method == "POST") as resp:
        page.locator("#btn-gerar-pix").click()
    return resp.value.json()


POPUPS = "#popup-pagamento:not(.oculto), #popup-obrigado:not(.oculto), #popup-policia:not(.oculto)"


@criterion("001/FR-010")
def confirmacao_do_pagamento_aparece_sem_recarregar(page):
    pedido = gerar_pix_na_pagina(page)
    pagar(pedido)
    expect(page.locator(POPUPS)).to_be_visible(timeout=10000)
    expect(page.locator(POPUPS)).to_contain_text(pedido["ticket"], timeout=6000)


@criterion("001/FR-011")
def prisao_vira_denuncia(page):
    abrir_formulario(page, PRODUTO_PRISAO)
    expect(page.locator("#secao-formulario")).to_contain_text(re.compile("suspeito", re.I))


# ------------------------------------------------------------------ 001 — novos requisitos (CR-001 a CR-003)
@criterion("001/FR-012")
def erro_foca_campo_invalido_e_e_anunciado(page):
    abrir_formulario(page)
    preencher(page, nome="Ana")
    page.locator("#btn-gerar-pix").click()
    page.wait_for_timeout(500)
    foco = page.evaluate("document.activeElement.id")
    assert foco == "nomeComprador", f"foco em '{foco}', esperado o campo do nome"
    assert page.get_attribute("#nomeComprador", "aria-invalid") == "true", "campo não marcado como inválido"
    assert anunciado(page, "4 caracteres"), "mensagem de erro não é anunciada"


@criterion("001/FR-013")
def confirmacao_e_dialogo_com_foco_e_anunciada(page):
    pedido = gerar_pix_na_pagina(page)
    pagar(pedido)
    popup = page.locator(POPUPS)
    expect(popup).to_be_visible(timeout=10000)
    page.wait_for_timeout(4000)  # temas com animação liberam o botão depois de alguns segundos
    papel = popup.evaluate("e => e.getAttribute('role') || e.querySelector('[role=dialog],[role=alertdialog]')?.getAttribute('role')")
    assert papel in ("dialog", "alertdialog"), f"janela sem papel de diálogo ({papel})"
    assert popup.evaluate("e => e.contains(document.activeElement)"), "foco não está na janela de confirmação"
    assert anunciado(page, r"confirmado") or popup.evaluate(
        "e => !!(e.getAttribute('aria-labelledby') || e.getAttribute('aria-label') || e.querySelector('[role=dialog],[role=alertdialog]')?.getAttribute('aria-labelledby'))"), \
        "confirmação sem anúncio nem rótulo do diálogo"
    popup.get_by_role("button", name=re.compile("Entendi")).click()
    tag = page.evaluate("document.activeElement.tagName")
    assert tag != "BODY", "foco perdido ao fechar a janela"


@criterion("001/FR-014")
def botao_do_produto_identifica_o_produto(page):
    esperar_cardapio(page)
    nome = page.locator(".produto-card h3").first.inner_text().strip()
    botao = page.locator(".produto-card").first.locator("button")
    expect(botao).to_have_accessible_name(re.compile(re.escape(nome), re.I))


@criterion("001/FR-015")
def opcao_anonima_tem_nome_que_descreve_a_funcao(page):
    abrir_formulario(page)
    expect(page.locator("#anonimo")).to_have_accessible_name(re.compile("anônim", re.I))
    abrir_formulario(page, PRODUTO_PRISAO)
    expect(page.locator("#anonimo")).to_have_accessible_name(re.compile("anônim", re.I))


EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]")


@criterion("001/FR-016")
def categoria_ativa_informada_sem_emojis_no_nome(page):
    esperar_cardapio(page)
    page.locator(".aba", has_text="Rosas").click()
    ativa = page.locator(".aba.ativa")
    estado = ativa.evaluate("e => e.getAttribute('aria-pressed') || e.getAttribute('aria-selected') || e.getAttribute('aria-current')")
    assert estado in ("true", "page", "location"), f"categoria ativa não informada ({estado})"
    for aba in page.locator(".aba").all():
        nome = aba.evaluate("e => e.getAttribute('aria-label') || [...e.childNodes].filter(n => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map(n => n.textContent).join('')")
        assert not EMOJI.search(nome), f"emoji no nome lido: {nome!r}"


@criterion("001/FR-017")
def contraste_no_cardapio_inclusive_esgotados(page):
    axe_setup(page)
    page.add_script_tag(path=os.path.join(os.path.dirname(__file__), "axe.min.js"))
    v = page.evaluate("async () => (await axe.run('#lista-produtos', {runOnly: ['color-contrast']})).violations.length")
    assert v == 0, f"{v} problema(s) de contraste no cardápio"


# ------------------------------------------------------------------ 002 — consulta
def consultar(page, codigo):
    page.goto(f"{BASE}/consultar.html")
    page.fill("#ticketConsulta", codigo)
    page.locator("form button").click()
    page.wait_for_timeout(1500)


@criterion("002/FR-001")
def consulta_mostra_pedido(page):
    pedido = criar_pedido("Pessoa Consulta")
    consultar(page, pedido["ticket"])
    resultado = page.locator("#resultado-consulta")
    expect(resultado).to_contain_text(pedido["ticket"])
    expect(resultado).to_contain_text("Pessoa Consulta")
    expect(resultado).to_contain_text("Status")


@criterion("002/FR-002")
def codigo_inexistente(page):
    consultar(page, "EAC-ZZZZ")
    expect(page.locator("#resultado-consulta")).to_contain_text("não encontrado")


@criterion("002/FR-003")
def campo_vazio(page):
    consultar(page, "")
    expect(page.locator("#resultado-consulta")).to_contain_text("Digite o código")


@criterion("002/FR-004")
def consulta_automatica_pelo_endereco(page):
    pedido = criar_pedido("Pessoa Endereço")
    page.goto(f"{BASE}/consultar.html?codigo={pedido['ticket'].lower()}")
    expect(page.locator("#resultado-consulta")).to_contain_text("Pessoa Endereço", timeout=8000)


@criterion("002/FR-005")
def dados_do_comprador_exibidos_como_texto(page):
    pedido = criar_pedido('<img src=x id="injetado">')
    consultar(page, pedido["ticket"])
    assert page.locator("#injetado").count() == 0, "nome do destinatário interpretado como HTML"
    expect(page.locator("#resultado-consulta")).to_contain_text("<img")


@criterion("002/FR-006")
def campo_de_codigo_rotulado(page):
    page.goto(f"{BASE}/consultar.html")
    campo = page.locator("#ticketConsulta")
    expect(campo).to_have_accessible_name(re.compile("código do pedido", re.I))


@criterion("002/FR-007")
def resultado_da_consulta_anunciado(page):
    consultar(page, "EAC-ZZZZ")
    assert anunciado(page, "não encontrado"), "resultado 'não encontrado' não é anunciado"
    assert page.evaluate("document.activeElement.tagName") != "BODY" or \
        page.evaluate(f"!!document.querySelector('#resultado-consulta').closest('{REGIOES_VIVAS}') || !!document.querySelector('#resultado-consulta [role=status],#resultado-consulta [role=alert]')"), \
        "foco perdido sem região viva"

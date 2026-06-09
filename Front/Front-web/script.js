  /*CONFIGURAÇÃO DA API*/
  const API_BASE = 'http://localhost:3000/api/v1';
 
  /* ESTADO DA APLICAÇÃO */
  let pecas        = [];
  let marcas       = [];
  let veiculos     = [];
  let paginaAtual  = 1;
  let totalPaginas = 1;
  let totalItens   = 0;
  let filtroMarca  = null;
  let termoBusca   = '';
  let timerDebounce = null;
 
  /* HELPERS DE API */
 
  /** Faz uma requisição à API e retorna o JSON ou lança erro */
  async function apiFetch(path, opcoes = {}) {
    const url = API_BASE + path;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opcoes.headers },
      ...opcoes
    });
 
    let data;
    try { data = await res.json(); } catch { data = {}; }
 
    if (!res.ok) {
      const msg = data?.message || data?.error || `Erro ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }
 
  /*STATUS DA API */
 
  async function verificarApiStatus() {
    const dot = document.getElementById('api-dot');
    const txt = document.getElementById('api-status-txt');
    dot.className = 'api-dot loading';
    txt.textContent = 'Conectando à API…';
    try {
      await apiFetch('/health');
      dot.className = 'api-dot ok';
      txt.textContent = 'API conectada · localhost:3000';
    } catch {
      dot.className = 'api-dot erro';
      txt.textContent = 'API offline · verifique se o servidor está rodando (npm run dev)';
    }
  }
 
  /*CARREGAR MARCAS (para filtros e modal) */
 
  async function carregarMarcas() {
    try {
      const data = await apiFetch('/brands');
      marcas = Array.isArray(data) ? data : (data.data || []);
 
      // Preenche select do modal
      const sel = document.getElementById('m-brandId');
      sel.innerHTML = '<option value="">Selecione a marca…</option>';
      marcas.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        sel.appendChild(opt);
      });
 
      // Preenche botões de filtro
      const wrap = document.getElementById('filtros-marca');
      // Remove botões antigos (exceto "Todas")
      wrap.querySelectorAll('.filter-btn:not(:first-child)').forEach(b => b.remove());
      marcas.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = m.name;
        btn.onclick = () => filtrarMarca(m.id, btn);
        wrap.appendChild(btn);
      });
 
      // Atualiza stat de marcas
      document.getElementById('stat-marcas').textContent = marcas.length;
 
    } catch (e) {
      console.warn('Não foi possível carregar marcas:', e.message);
    }
  }
 
  /*CARREGAR VEÍCULOS (para modal)*/
 
  async function carregarVeiculos() {
    try {
      const data = await apiFetch('/vehicles');
      veiculos = Array.isArray(data) ? data : (data.data || []);
 
      const sel = document.getElementById('m-vehicles');
      sel.innerHTML = '';
      if (veiculos.length === 0) {
        sel.innerHTML = '<option value="" disabled>Nenhum veículo cadastrado</option>';
        return;
      }
      veiculos.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.brand?.name || ''} ${v.model} (${v.year})`.trim();
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn('Não foi possível carregar veículos:', e.message);
      document.getElementById('m-vehicles').innerHTML = '<option value="" disabled>Erro ao carregar veículos</option>';
    }
  }
 
  /* CARREGAR E RENDERIZAR PEÇAS*/
 
  async function carregarPecas() {
    const grid = document.getElementById('products-grid');
 
    // Mostra skeletons enquanto carrega
    grid.innerHTML = `
      <div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line med"></div></div></div>
      <div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line med"></div></div></div>
      <div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line med"></div></div></div>
      <div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line med"></div></div></div>
    `;
 
    try {
      // Monta query string
      const params = new URLSearchParams({
        page:  paginaAtual,
        limit: 12,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (termoBusca) params.set('search', termoBusca);
      if (filtroMarca) params.set('brandId', filtroMarca);
 
      const data = await apiFetch(`/parts/search?${params}`);
 
      // A API retorna { data: [...], pagination: { total, page, limit, totalPages } }
      pecas        = data.data  || data.parts || (Array.isArray(data) ? data : []);
      const pag    = data.pagination || {};
      totalItens   = pag.total      || pecas.length;
      totalPaginas = pag.totalPages || 1;
      paginaAtual  = pag.page       || 1;
 
      renderPecas();
      renderPaginacao();
      atualizarStats();
 
    } catch (e) {
      grid.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Não foi possível carregar as peças</h3>
          <p>${e.message || 'Verifique se a API está rodando em localhost:3000'}</p>
          <button class="btn-retry" onclick="carregarPecas()">↺ Tentar novamente</button>
        </div>`;
      document.getElementById('paginacao').style.display = 'none';
    }
  }
 
  function renderPecas() {
    const grid = document.getElementById('products-grid');
 
    if (pecas.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔩</div>
          <h3>Nenhuma peça encontrada</h3>
          <p>${termoBusca ? `Nenhum resultado para "<strong>${termoBusca}</strong>"` : 'Cadastre a primeira peça usando o botão abaixo!'}</p>
        </div>`;
      return;
    }
 
    grid.innerHTML = pecas.map(p => {
      const qtd         = p.stock ?? p.qtd ?? 0;
      const nome        = p.name  || p.nome  || '—';
      const codigo      = p.code  || p.oem   || '—';
      const preco       = parseFloat(p.price || p.venda || 0);
      const marcaNome   = p.brand?.name || p.marca || '—';
 
      const estoqueClass = qtd === 0 ? 'estoque-out' : qtd < 3 ? 'estoque-low' : 'estoque-ok';
      const estoqueLabel = qtd === 0 ? '⛔ Sem estoque' : qtd < 3 ? `⚠ ${qtd} restantes` : `✓ ${qtd} em estoque`;
 
      return `
        <div class="product-card">
          <div class="card-img">
            <div class="no-img">🔩</div>
            <span class="estoque-tag ${estoqueClass}">${estoqueLabel}</span>
          </div>
          <div class="card-body">
            <div class="card-familia">${marcaNome}</div>
            <div class="card-nome">${nome}</div>
            <div class="card-oem">Cód: ${codigo}</div>
            <div class="card-footer">
              <div class="card-preco"><small>R$</small> ${preco.toFixed(2).replace('.', ',')}</div>
              <div class="card-marca">${marcaNome}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }
 
  /* ESTATÍSTICAS DO BANNER*/
 
  async function atualizarStats() {
    document.getElementById('stat-total').textContent = totalItens;
 
    try {
      // Conta quantas peças têm estoque
      const data = await apiFetch('/parts/search?inStock=true&limit=1');
      const comEstoque = data.pagination?.total ?? (data.data?.length ?? 0);
      document.getElementById('stat-estoque').textContent = comEstoque;
    } catch {
      document.getElementById('stat-estoque').textContent = '–';
    }
  }
 
  /*PAGINAÇÃO*/
 
  function renderPaginacao() {
    const wrap = document.getElementById('paginacao');
    if (totalPaginas <= 1) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
 
    const anterior = paginaAtual > 1;
    const proximo  = paginaAtual < totalPaginas;
 
    let html = `
      <button class="page-btn" ${!anterior ? 'disabled' : ''} onclick="irPagina(${paginaAtual - 1})">←</button>`;
 
    // Exibe no máximo 5 páginas ao redor da atual
    const inicio = Math.max(1, paginaAtual - 2);
    const fim    = Math.min(totalPaginas, paginaAtual + 2);
 
    if (inicio > 1) html += `<button class="page-btn" onclick="irPagina(1)">1</button>${inicio > 2 ? '<span class="page-info">…</span>' : ''}`;
 
    for (let i = inicio; i <= fim; i++) {
      html += `<button class="page-btn ${i === paginaAtual ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>`;
    }
 
    if (fim < totalPaginas) html += `${fim < totalPaginas - 1 ? '<span class="page-info">…</span>' : ''}<button class="page-btn" onclick="irPagina(${totalPaginas})">${totalPaginas}</button>`;
 
    html += `
      <button class="page-btn" ${!proximo ? 'disabled' : ''} onclick="irPagina(${paginaAtual + 1})">→</button>
      <span class="page-info">${paginaAtual} de ${totalPaginas}</span>`;
 
    wrap.innerHTML = html;
  }
 
  function irPagina(n) {
    paginaAtual = n;
    carregarPecas();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
 
  /*FILTROS*/
 
  function filtrarMarca(marcaId, btn) {
    filtroMarca = marcaId;
    paginaAtual = 1;
    document.querySelectorAll('#filtros-marca .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    carregarPecas();
  }
 
  function debounceSearch(valor) {
    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(() => {
      termoBusca  = valor.trim();
      paginaAtual = 1;
      carregarPecas();
    }, 400);
  }
 
  /*MODAL */
 
  function abrirModal() {
    document.getElementById('overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
 
  function fecharModal() {
    document.getElementById('overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
 
  function fecharModalOverlay(e) {
    if (e.target === document.getElementById('overlay')) fecharModal();
  }
 
  /*FOTO*/
 
  function previewModalPhoto(input) {
    const img = document.getElementById('modal-preview-img');
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; img.style.display = 'block'; };
      reader.readAsDataURL(input.files[0]);
    }
  }
 
  const modalDrop = document.getElementById('modal-drop');
  modalDrop.addEventListener('dragover', e => { e.preventDefault(); modalDrop.classList.add('dragover'); });
  modalDrop.addEventListener('dragleave', () => modalDrop.classList.remove('dragover'));
  modalDrop.addEventListener('drop', e => {
    e.preventDefault();
    modalDrop.classList.remove('dragover');
    const fi = document.getElementById('m-foto');
    fi.files = e.dataTransfer.files;
    previewModalPhoto(fi);
  });
 
  /* VALIDAÇÃO DO FORMULÁRIO*/
 
  function validarCampo(id, condicao) {
    const el = document.getElementById(id);
    const msgId = id + '-erro';
    let msg = document.getElementById(msgId);
 
    if (!condicao) {
      el.classList.add('erro');
      if (!msg) {
        msg = document.createElement('span');
        msg.id = msgId;
        msg.className = 'erro-msg';
        msg.textContent = 'Campo obrigatório';
        el.parentElement.appendChild(msg);
      }
      return false;
    }
 
    el.classList.remove('erro');
    if (msg) msg.remove();
    return true;
  }
 
  /*SALVAR PEÇA → POST /api/v1/parts*/
 
  async function salvarPeca() {
    const nome    = document.getElementById('m-nome').value.trim();
    const codigo  = document.getElementById('m-oem').value.trim();
    const brandId = document.getElementById('m-brandId').value;
    const qtd     = document.getElementById('m-qtd').value.trim();
    const venda   = document.getElementById('m-venda').value.trim();
 
    // Validação visual
    let valido = true;
    valido = validarCampo('m-nome',    nome    !== '')  && valido;
    valido = validarCampo('m-oem',     codigo  !== '')  && valido;
    valido = validarCampo('m-brandId', brandId !== '')  && valido;
    valido = validarCampo('m-qtd',     qtd     !== '' && parseInt(qtd) >= 0) && valido;
    valido = validarCampo('m-venda',   venda   !== '' && parseFloat(venda) >= 0) && valido;
 
    if (!valido) {
      mostrarToast('⚠️ Preencha todos os campos obrigatórios.', 'aviso');
      return;
    }
 
    // Veículos compatíveis selecionados
    const vehiclesSel = document.getElementById('m-vehicles');
    const compatibleVehicleIds = Array.from(vehiclesSel.selectedOptions)
      .map(o => o.value)
      .filter(v => v !== '');
 
    // Descrição — inclui foto base64 se houver
    const fotoSrc   = document.getElementById('modal-preview-img').src || '';
    const descricao = document.getElementById('m-descricao').value.trim();
    const descFinal = fotoSrc.startsWith('data:')
      ? (descricao ? descricao + '\n[foto_base64]:' + fotoSrc : '[foto_base64]:' + fotoSrc)
      : descricao;
 
    const minStock = parseInt(document.getElementById('m-minstock').value) || 5;
 
    const payload = {
      name:                 nome,
      code:                 codigo,
      brandId:              brandId,
      price:                parseFloat(venda),
      stock:                parseInt(qtd),
      description:          descFinal || undefined,
      minStock:             minStock,
      compatibleVehicleIds: compatibleVehicleIds.length ? compatibleVehicleIds : undefined
    };
 
    // UI de loading
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.classList.add('salvando');
    btnSalvar.disabled = true;
 
    try {
      await apiFetch('/parts', {
        method: 'POST',
        body:   JSON.stringify(payload)
      });
 
      limparModal();
      fecharModal();
      mostrarToast('✅ Peça cadastrada com sucesso!', 'sucesso');
      paginaAtual = 1;
      await carregarPecas();
 
    } catch (e) {
      mostrarToast('❌ Erro ao salvar: ' + e.message, 'erro');
    } finally {
      btnSalvar.classList.remove('salvando');
      btnSalvar.disabled = false;
    }
  }
 
  /*LIMPAR MODAL*/
 
  function limparModal() {
    ['m-nome', 'm-oem', 'm-descricao', 'm-qtd', 'm-venda', 'm-minstock']
      .forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.classList.remove('erro');
        const msg = document.getElementById(id + '-erro');
        if (msg) msg.remove();
      });
    document.getElementById('m-brandId').value = '';
    Array.from(document.getElementById('m-vehicles').options).forEach(o => o.selected = false);
    const img = document.getElementById('modal-preview-img');
    img.src = ''; img.style.display = 'none';
  }
 
  /* TOAST*/
 
  function mostrarToast(msg, tipo = 'sucesso') {
    const t    = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    document.getElementById('toast-msg').textContent = msg.replace(/^[✅❌⚠️]\s*/, '');
 
    const icones = { sucesso: '✅', erro: '❌', aviso: '⚠️' };
    icon.textContent = icones[tipo] || '✅';
 
    t.className = `toast ${tipo}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3800);
  }
 
  /*INICIALIZAÇÃO*/
 
  async function init() {
    await verificarApiStatus();
    await Promise.all([carregarMarcas(), carregarVeiculos()]);
    await carregarPecas();
  }
 
  init();
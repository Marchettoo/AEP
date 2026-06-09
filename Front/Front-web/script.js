  // ===== ESTADO LOCAL =====
  let pecas = JSON.parse(localStorage.getItem('loja_pecas') || '[]');
  let filtroAtivo = 'Todos';

  // ===== RENDER =====
  function renderPecas() {
    const grid = document.getElementById('products-grid');
    const lista = filtroAtivo === 'Todos'
      ? pecas
      : pecas.filter(p => p.familia === filtroAtivo);

    // Atualiza stats
    document.getElementById('stat-total').textContent = pecas.length;
    document.getElementById('stat-promo').textContent = pecas.filter(p => p.promo).length;
    document.getElementById('stat-estoque').textContent = pecas.filter(p => p.qtd > 0).length;

    if (lista.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔩</div>
          <h3>Nenhuma peça encontrada</h3>
          <p>${filtroAtivo !== 'Todos' ? 'Nenhuma peça nessa categoria.' : 'Cadastre a primeira peça usando o botão abaixo!'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = lista.map((p, i) => {
      const idx = pecas.indexOf(p);
      const estoqueClass = p.qtd === 0 ? 'estoque-out' : p.qtd < 3 ? 'estoque-low' : 'estoque-ok';
      const estoqueLabel = p.qtd === 0 ? '⛔ Sem estoque' : p.qtd < 3 ? `⚠ ${p.qtd} restantes` : `✓ ${p.qtd} em estoque`;
      const imgHtml = p.foto
        ? `<img src="${p.foto}" alt="${p.nome}" />`
        : `<div class="no-img">🔩</div>`;

      return `
        <div class="product-card">
          <div class="card-img">
            ${imgHtml}
            ${p.promo ? '<span class="promo-tag">🏷 Promoção</span>' : ''}
            <span class="estoque-tag ${estoqueClass}">${estoqueLabel}</span>
          </div>
          <div class="card-body">
            <div class="card-familia">${p.familia}</div>
            <div class="card-nome">${p.nome}</div>
            <div class="card-oem">OEM: ${p.oem}</div>
            <div class="card-footer">
              <div class="card-preco"><small>R$</small> ${parseFloat(p.venda).toFixed(2).replace('.',',')}</div>
              <div class="card-marca">${p.marca}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ===== FILTRO =====
  function filtrar(familia, btn) {
    filtroAtivo = familia;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPecas();
  }

  // ===== MODAL =====
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

  // ===== FOTO =====
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

  // ===== SALVAR =====
  function salvarPeca() {
    const nome    = document.getElementById('m-nome').value.trim();
    const oem     = document.getElementById('m-oem').value.trim();
    const familia = document.getElementById('m-familia').value;
    const qtd     = document.getElementById('m-qtd').value.trim();
    const marca   = document.getElementById('m-marca').value.trim();
    const venda   = document.getElementById('m-venda').value.trim();

    if (!nome || !oem || !familia || !qtd || !marca || !venda) {
      mostrarToast('⚠️ Preencha todos os campos obrigatórios (*).');
      return;
    }

    const fotoInput = document.getElementById('m-foto');
    const fotoSrc   = document.getElementById('modal-preview-img').src || '';

    const novaPeca = {
      id:         Date.now(),
      nome,
      oem,
      familia,
      descricao:  document.getElementById('m-descricao').value.trim(),
      qtd:        parseInt(qtd),
      marca,
      fornecedor: document.getElementById('m-fornecedor').value.trim(),
      custo:      document.getElementById('m-custo').value || '0',
      venda,
      promo:      document.getElementById('m-promo').checked,
      foto:       fotoSrc.startsWith('data:') ? fotoSrc : ''
    };

    // Salva localmente (depois conecta na API)
    pecas.push(novaPeca);
    localStorage.setItem('loja_pecas', JSON.stringify(pecas));

    renderPecas();
    limparModal();
    fecharModal();
    mostrarToast('✅ Peça cadastrada com sucesso!');
  }

  // ===== LIMPAR MODAL =====
  function limparModal() {
    ['m-nome','m-oem','m-descricao','m-qtd','m-marca','m-fornecedor','m-custo','m-venda']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-familia').value = '';
    document.getElementById('m-promo').checked = false;
    const img = document.getElementById('modal-preview-img');
    img.src = ''; img.style.display = 'none';
  }

  // ===== TOAST =====
  function mostrarToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ===== INIT =====
  renderPecas();
/* ==========================================
   CONFIGURAÇÃO E ESTADO DA APLICAÇÃO
   ========================================== */
const API_BASE = 'http://localhost:3000/api/v1';

let pecas = [];
let marcas = [];
let veiculos = [];
let paginaAtual = 1;
let totalPaginas = 1;
let totalItens = 0;
let filtroMarca = null;
let termoBusca = '';
let timerDebounce = null;

/* ==========================================
   COMUNICAÇÃO COM A API (FETCH)
   ========================================== */
async function apiFetch(path, opcoes = {}) {
  const url = API_BASE + path;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opcoes.headers },
      ...opcoes
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      // Extrai o erro do Zod (se houver) ou a mensagem padrão
      const erroValidacao = data.issues ? data.issues.map(i => i.message).join(', ') : null;
      const msg = erroValidacao || data?.message || data?.error || `Erro ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (erro) {
    console.error(`Falha ao conectar em ${url}:`, erro);
    throw erro;
  }
}

async function verificarApiStatus() {
  const dot = document.getElementById('api-dot');
  const txt = document.getElementById('api-status-txt');
  if (!dot || !txt) return;

  dot.className = 'api-dot loading';
  txt.textContent = 'Conectando à API…';
  
  try {
    await apiFetch('/health');
    dot.className = 'api-dot ok';
    txt.textContent = `API conectada · ${API_BASE}`;
  } catch {
    dot.className = 'api-dot erro';
    txt.textContent = `API offline · O servidor não respondeu`;
  }
}

/* ==========================================
   CARREGAMENTO DE DADOS (GET)
   ========================================== */
async function carregarMarcas() {
  try {
    // Tenta procurar na API (mude para a rota correta se necessário, ex: '/vehicles/brands')
    const respostaAPI = await apiFetch('/brands');
    
    if (Array.isArray(respostaAPI)) {
      marcas = respostaAPI;
    } else if (respostaAPI && Array.isArray(respostaAPI.data)) {
      marcas = respostaAPI.data;
    } else if (respostaAPI && Array.isArray(respostaAPI.brands)) {
      marcas = respostaAPI.brands;
    } else {
      marcas = [];
    }
  } catch (e) {
    console.warn('Rota /brands não encontrada ou vazia. Ativando marcas locais para testes.', e.message);
    marcas = [];
  }

  // SE A API NÃO RETORNAR NADA, GERAMOS MARCAS AUTOMÁTICAS PARA CONSEGUIR TRABALHAR:
  if (marcas.length === 0) {
    marcas = [
      { id: "marca-mock-1", name: "Toyota" },
      { id: "marca-mock-2", name: "Honda" },
      { id: "marca-mock-3", name: "Volkswagen" },
      { id: "marca-mock-4", name: "Fiat" },
      { id: "marca-mock-5", name: "Chevrolet" }
    ];
  }

  // Preenche o Select do Modal de Cadastro
  const sel = document.getElementById('m-brandId');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione a marca…</option>';
    marcas.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
  }

  // Preenche a barra de filtros na página principal
  const wrap = document.getElementById('filtros-marca');
  if (wrap) {
    wrap.querySelectorAll('.filter-btn:not(:first-child)').forEach(b => b.remove());
    marcas.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = m.name;
      btn.onclick = () => filtrarMarca(m.id, btn);
      wrap.appendChild(btn);
    });
  }
  
  const statMarcas = document.getElementById('stat-marcas');
  if (statMarcas) statMarcas.textContent = marcas.length;
}

async function carregarVeiculos() {
  try {
    // 1. Faz a requisição para a rota de veículos do seu back-end
    const respostaAPI = await apiFetch('/vehicles');
    
    // 2. Extrai com segurança a lista de veículos, não importa como o back-end enviou
    if (Array.isArray(respostaAPI)) {
      veiculos = respostaAPI;
    } else if (respostaAPI && Array.isArray(respostaAPI.data)) {
      veiculos = respostaAPI.data; // Se o express usar padrão { data: [...] }
    } else if (respostaAPI && Array.isArray(respostaAPI.vehicles)) {
      veiculos = respostaAPI.vehicles; // Se o express usar padrão { vehicles: [...] }
    } else {
      veiculos = [];
    }
  } catch (e) {
    console.warn('Rota /vehicles falhou ou está vazia. Ativando veículos locais para testes.', e.message);
    veiculos = [];
  }

  // 3. SE O BANCO ESTIVER VAZIO OU A ROTA FALHAR, GERAMOS VEÍCULOS DE TESTE AUTOMATICAMENTE:
  if (veiculos.length === 0) {
    veiculos = [
      { id: "veiculo-mock-1", model: "Corolla", year: 2022, brand: { name: "Toyota" } },
      { id: "veiculo-mock-2", model: "Civic", year: 2021, brand: { name: "Honda" } },
      { id: "veiculo-mock-3", model: "Gol", year: 2020, brand: { name: "Volkswagen" } },
      { id: "veiculo-mock-4", model: "Uno", year: 2019, brand: { name: "Fiat" } },
      { id: "veiculo-mock-5", model: "Onix", year: 2023, brand: { name: "Chevrolet" } }
    ];
  }

  // 4. Preenche a caixa de seleção múltipla (Select) no formulário
  const sel = document.getElementById('m-vehicles');
  if (!sel) return;

  sel.innerHTML = ''; // Limpa antes de preencher
  veiculos.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    
    // Pega o nome da marca caso exista no objeto, senão deixa em branco
    const brandName = v.brand?.name || '';
    opt.textContent = `${brandName} ${v.model} (${v.year})`.trim();
    
    sel.appendChild(opt);
  });
}

async function carregarPecas() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  try {
    const params = new URLSearchParams({
      page: paginaAtual,
      limit: 12
    });
    
    if (termoBusca) params.append('search', termoBusca);
    if (filtroMarca) params.append('brandId', filtroMarca);

    const respostaAPI = await apiFetch(`/parts/search?${params}`);
    
    // --- CORREÇÃO DO MAPEAMENTO DO BACK-END ---
    // Seu controller envelopa em: { status: 'success', data: { parts: [...] } }
    if (respostaAPI && respostaAPI.data && Array.isArray(respostaAPI.data.parts)) {
      pecas = respostaAPI.data.parts;
    } else if (Array.isArray(respostaAPI)) {
      pecas = respostaAPI;
    } else if (respostaAPI && Array.isArray(respostaAPI.data)) {
      pecas = respostaAPI.data; 
    } else if (respostaAPI && Array.isArray(respostaAPI.parts)) {
      pecas = respostaAPI.parts; 
    } else {
      pecas = []; 
    }

    // Tratamento seguro da paginação vinda do seu back-end data
    if (respostaAPI && respostaAPI.data && respostaAPI.data.pagination) {
      totalPaginas = respostaAPI.data.pagination.totalPages || 1;
      totalItens = respostaAPI.data.pagination.totalItems || pecas.length;
    } else if (respostaAPI && respostaAPI.pagination) {
      totalPaginas = respostaAPI.pagination.totalPages || 1;
      totalItens = respostaAPI.pagination.totalItems || pecas.length;
    } else {
      totalPaginas = 1;
      totalItens = pecas.length;
    }
    
    renderPecas();
    renderPaginacao();
    atualizarStats();
  } catch (e) {
    grid.innerHTML = `
      <div class="error-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <h3 style="color: #d9534f;">Erro ao carregar as peças</h3>
        <p>${e.message}</p>
        <button onclick="carregarPecas()" class="btn-tentar" style="margin-top:15px; padding:8px 16px; background:#d9534f; color:#fff; border:none; border-radius:4px; cursor:pointer;">🔄 Tentar novamente</button>
      </div>`;
  }
}

function atualizarStats() {
  const statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.textContent = totalItens;
}

/* ==========================================
   RENDERIZAÇÃO (UI)
   ========================================== */
function renderPecas() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (pecas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <div style="font-size: 3rem;">🔩</div>
        <h3>Nenhuma peça encontrada</h3>
        <p>${termoBusca ? `Nenhum resultado para "<strong>${termoBusca}</strong>"` : 'Cadastre a primeira peça usando o botão abaixo!'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = pecas.map(p => {
    const qtd = p.stock ?? 0;
    const nome = p.name || 'Sem nome';
    const codigo = p.code || 'S/N';
    const preco = parseFloat(p.price || 0);
    const marcaNome = p.brand?.name || 'Sem marca';

    const estoqueClass = qtd === 0 ? 'estoque-out' : qtd < 3 ? 'estoque-low' : 'estoque-ok';
    const estoqueLabel = qtd === 0 ? '⛔ Sem estoque' : qtd < 3 ? `⚠ ${qtd} restantes` : `✓ ${qtd} em estoque`;

    return `
      <div class="product-card">
        <div class="card-img" style="background:#eee; height:150px; display:flex; align-items:center; justify-content:center; position:relative;">
          <div style="font-size: 2.5rem;">🔩</div>
          <span class="estoque-tag ${estoqueClass}" style="position:absolute; top:10px; right:10px; font-size:0.7rem; padding:4px 8px; border-radius:4px; background:#fff; font-weight:bold;">${estoqueLabel}</span>
        </div>
        <div class="card-body" style="padding:15px;">
          <div style="font-size:0.75rem; color:#888; text-transform:uppercase;">${marcaNome}</div>
          <div style="font-weight:bold; font-size:1.1rem; margin:5px 0;">${nome}</div>
          <div style="font-size:0.8rem; color:#666;">Cód: ${codigo}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
            <div style="font-weight:bold; color:var(--primaria); font-size:1.2rem;"><small style="font-size:0.8rem;">R$</small> ${preco.toFixed(2).replace('.', ',')}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ==========================================
   PAGINAÇÃO E FILTROS
   ========================================== */
function renderPaginacao() {
  const wrap = document.getElementById('paginacao');
  if (!wrap) return;
  if (totalPaginas <= 1) { wrap.style.display = 'none'; return; }
  
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <button ${paginaAtual === 1 ? 'disabled' : ''} onclick="irPagina(${paginaAtual - 1})">Anterior</button>
    <span style="padding: 0 15px;">Página ${paginaAtual} de ${totalPaginas}</span>
    <button ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="irPagina(${paginaAtual + 1})">Próxima</button>
  `;
}

function irPagina(n) {
  paginaAtual = n;
  carregarPecas();
}

function filtrarMarca(marcaId, btn) {
  filtroMarca = marcaId;
  paginaAtual = 1;
  document.querySelectorAll('#filtros-marca .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  carregarPecas();
}

function debounceSearch(valor) {
  clearTimeout(timerDebounce);
  timerDebounce = setTimeout(() => {
    termoBusca = valor.trim();
    paginaAtual = 1;
    carregarPecas();
  }, 400);
}

/* ==========================================
   MODAL E FOTO
   ========================================== */
function abrirModal() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function fecharModal() {
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function fecharModalOverlay(e) {
  if (e.target === document.getElementById('overlay')) fecharModal();
}

function previewModalPhoto(input) {
  const img = document.getElementById('modal-preview-img');
  if (input.files && input.files[0] && img) {
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; img.style.display = 'block'; };
    reader.readAsDataURL(input.files[0]);
  }
}

function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  if (!t || !icon || !msgEl) return;

  msgEl.textContent = msg;
  icon.textContent = tipo === 'erro' ? '❌' : (tipo === 'aviso' ? '⚠️' : '✅');
  t.className = `toast ${tipo} show`;
  setTimeout(() => t.classList.remove('show'), 3800);
}

/* ==========================================
   CADASTRO DE PEÇA (POST)
   ========================================== */
// Localize a função responsável por salvar a peça no seu script.js
async function salvarPeca(event) {
  if (event) event.preventDefault();

  // 1. CAPTURA O TOKEN DE LOGIN (ajuste a chave se o seu sistema salvou com outro nome, ex: 'auth_token')
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');

  // Captura dos dados dos campos do formulário
  const name = document.getElementById('m-name')?.value || document.getElementById('name')?.value;
  const code = document.getElementById('m-code')?.value || document.getElementById('code')?.value;
  const brandId = document.getElementById('m-brandId')?.value;
  const description = document.getElementById('m-description')?.value;
  const stock = parseInt(document.getElementById('m-stock')?.value || 0);
  const price = parseFloat(document.getElementById('m-price')?.value || 0);
  
  // Pega os IDs dos veículos selecionados na listagem múltipla
  const selectVeiculos = document.getElementById('m-vehicles');
  const vehicleIds = selectVeiculos 
    ? Array.from(selectVeiculos.selectedOptions).map(opt => opt.value)
    : [];

  const dadosPeca = { name, code, brandId, description, stock, price, vehicleIds };

  try {
    // 2. ENVIO COM OS HEADERS DE AUTENTICAÇÃO
    const resposta = await fetch('http://localhost:3000/api/v1/parts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Se houver um token no localStorage, ele é enviado aqui:
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(dadosPeca)
    });

    // Se o back-end ainda disser que não está autorizado
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Authentication required');
    }

    if (!resposta.ok) {
      const erroDados = await resposta.json().catch(() => ({}));
      throw new Error(erroDados.message || 'Erro ao salvar a peça');
    }

    // Sucesso!
    alert('Peça cadastrada com sucesso!');
    
    // Fecha o modal (ajuste o nome da sua função se for diferente)
    if (typeof fecharModal === 'function') fecharModal(); 
    
    // Recarrega a listagem da página principal
    if (typeof carregarPecas === 'function') carregarPecas();

  } catch (erro) {
    console.error('Erro no cadastro:', erro);
    // Aqui o seu código atual já dispara aquele Toast/Aviso vermelho na tela
    mostrarToast(erro.message, 'erro'); 
  }
}

function limparModal() {
  ['m-nome', 'm-oem', 'm-descricao', 'm-qtd', 'm-venda', 'm-minstock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const brandSel = document.getElementById('m-brandId');
  if (brandSel) brandSel.value = '';
  
  const vehicleSel = document.getElementById('m-vehicles');
  if (vehicleSel) {
    Array.from(vehicleSel.options).forEach(o => o.selected = false);
  }
  
  const img = document.getElementById('modal-preview-img');
  if (img) { img.src = ''; img.style.display = 'none'; }
}

/* ==========================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================== */
document.addEventListener('DOMContentLoaded', async () => {
  await verificarApiStatus();
  await Promise.all([
    carregarMarcas(),
    carregarVeiculos()
  ]);
  await carregarPecas();
});
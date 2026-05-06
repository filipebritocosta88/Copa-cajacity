/**
 * SISTEMA LOGISTICA - CORE ENGINE
 * Controle de Fluxo e Persistência
 */

// Banco de Dados Simulado / Base
const BASE_DATA = {
    setores: ["Logística", "Loja Virtual", "Call Center", "DT", "ADM", "Estoque", "Marketing"],
    pdvs: [
        { nome: "PDV Salvador Shopping", cidade: "Salvador", cep: "41820-020" },
        { nome: "PDV Maceió Centro", cidade: "Maceió", cep: "57020-000" },
        { nome: "PDV Rio Barra", cidade: "Rio de Janeiro", cep: "22631-000" }
    ]
};

// Estado da Aplicação
let responsaveis = JSON.parse(localStorage.getItem('log_resps')) || [
    { nome: "Iago Silva", cidade: "Salvador", end: "Sede Metasboard - Sala 102" },
    { nome: "João Maceió", cidade: "Maceió", end: "Rua do Comércio, 45" }
];

let solicitacoes = JSON.parse(localStorage.getItem('log_data')) || [];

/**
 * INICIALIZAÇÃO
 */
window.onload = () => {
    updateDatalists();
    refreshUI();
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('pt-br', { dateStyle: 'full' });
};

/**
 * NAVEGAÇÃO ENTRE TELAS
 */
function switchPage(pageId, element) {
    // Atualiza Menu
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    // Atualiza Tela
    document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // Atualiza dados da tela específica
    refreshUI();
}

/**
 * LÓGICA DE FORMULÁRIOS
 */

// Auto-preenchimento por Responsável
document.getElementById('f-resp-busca').addEventListener('change', (e) => {
    const found = responsaveis.find(r => r.nome === e.target.value);
    if (found) {
        document.getElementById('f-origem-cidade').value = found.cidade;
        document.getElementById('f-origem-end').value = found.end;
    }
});

// Auto-preenchimento por Destino (PDV)
document.getElementById('f-destino-busca').addEventListener('change', (e) => {
    const found = BASE_DATA.pdvs.find(p => p.nome === e.target.value);
    if (found) {
        document.getElementById('f-dest-nome').value = found.nome;
        document.getElementById('f-dest-cep').value = found.cep;
    }
});

// Registro de Nova Solicitação
document.getElementById('main-log-form').onsubmit = (e) => {
    e.preventDefault();

    const nova = {
        id: "LOG" + Math.floor(100000 + Math.random() * 900000),
        data: new Date().toLocaleDateString('pt-br'),
        tipo: document.getElementById('f-tipo').value,
        prioridade: document.getElementById('f-prioridade').value,
        setor: document.getElementById('f-setor').value,
        responsavel: document.getElementById('f-resp-busca').value,
        origem: document.getElementById('f-origem-cidade').value,
        destino: document.getElementById('f-dest-nome').value,
        status: "Pendente",
        custo: 0,
        modalidade: "-",
        rastreio: "-",
        timestamp: new Date().getTime()
    };

    solicitacoes.unshift(nova);
    saveData();
    showNotify("Solicitação " + nova.id + " criada com sucesso!", "success");
    e.target.reset();
    switchPage('minhas-solicitacoes', document.querySelectorAll('.nav-item')[2]);
};

// Cadastro de Responsável
document.getElementById('form-cad-resp').onsubmit = (e) => {
    e.preventDefault();
    responsaveis.push({
        nome: document.getElementById('c-nome').value,
        cidade: document.getElementById('c-cidade').value,
        end: document.getElementById('c-end').value
    });
    localStorage.setItem('log_resps', JSON.stringify(responsaveis));
    updateDatalists();
    refreshUI();
    e.target.reset();
    showNotify("Responsável cadastrado!", "success");
};

/**
 * GESTÃO DE ATENDIMENTO (MODAL)
 */
function openAtendimento(id) {
    const item = solicitacoes.find(s => s.id === id);
    document.getElementById('m-id').value = id;
    document.getElementById('m-title').innerText = "Tratar " + id;
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal-atendimento-box').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-atendimento-box').style.display = 'none';
}

function salvarAtendimento() {
    const id = document.getElementById('m-id').value;
    const idx = solicitacoes.findIndex(s => s.id === id);

    solicitacoes[idx].status = "Finalizado";
    solicitacoes[idx].modalidade = document.getElementById('m-modalidade').value;
    solicitacoes[idx].rastreio = document.getElementById('m-rastreio').value;
    solicitacoes[idx].custo = parseFloat(document.getElementById('m-custo').value) || 0;

    saveData();
    closeModal();
    showNotify("Protocolo finalizado!", "success");
}

/**
 * SINCRONIZAÇÃO DE UI
 */
function refreshUI() {
    renderDashboard();
    renderTables();
    updateDashboardStats();
}

function renderTables() {
    // Tabela Recentes (Dashboard)
    const recentBody = document.querySelector('#table-recent tbody');
    recentBody.innerHTML = solicitacoes.slice(0, 5).map(s => `
        <tr><td>#${s.id}</td><td>${s.data}</td><td>${s.responsavel}</td><td><span class="status-badge prio-normal">${s.status}</span></td></tr>
    `).join('');

    // Tabela Minhas Solicitações
    document.querySelector('#table-my-logs tbody').innerHTML = solicitacoes.map(s => `
        <tr>
            <td><strong>#${s.id}</strong></td>
            <td>${s.data}</td>
            <td>${s.tipo}</td>
            <td>${s.origem} > ${s.destino}</td>
            <td><span class="status-badge ${s.status === 'Pendente' ? 'prio-urgente' : 'prio-normal'}">${s.status}</span></td>
            <td><i class="fas fa-eye" style="cursor:pointer"></i></td>
        </tr>
    `).join('');

    // Tabela Atendimento (Logística)
    document.querySelector('#table-atendimento tbody').innerHTML = solicitacoes.filter(s => s.status === "Pendente").map(s => `
        <tr>
            <td><span class="status-badge prio-${s.prioridade.toLowerCase()}">${s.prioridade}</span></td>
            <td>#${s.id}</td>
            <td>${s.responsavel}</td>
            <td>${s.tipo}</td>
            <td>${s.status}</td>
            <td><button class="btn btn-primary" onclick="openAtendimento('${s.id}')" style="padding: 5px 12px; font-size: 0.7rem;">Tratar</button></td>
        </tr>
    `).join('');

    // Tabela Relatórios
    document.querySelector('#table-reports tbody').innerHTML = solicitacoes.filter(s => s.status === "Finalizado").map(s => `
        <tr><td>#${s.id}</td><td>${s.setor}</td><td>${s.modalidade}</td><td>R$ ${s.custo.toFixed(2)}</td><td>${s.data}</td></tr>
    `).join('');

    // Tabela Cadastro Responsáveis
    document.querySelector('#table-cad-resp tbody').innerHTML = responsaveis.map(r => `
        <tr><td>${r.nome}</td><td>${r.cidade}</td><td>${r.end}</td></tr>
    `).join('');
}

function updateDashboardStats() {
    const pendentes = solicitacoes.filter(s => s.status === "Pendente").length;
    const entregues = solicitacoes.filter(s => s.status === "Finalizado").length;
    const custo = solicitacoes.reduce((acc, s) => acc + s.custo, 0);

    document.getElementById('dash-total').innerText = solicitacoes.length;
    document.getElementById('dash-pendentes').innerText = pendentes;
    document.getElementById('dash-entregues').innerText = entregues;
    document.getElementById('dash-custo').innerText = custo.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
}

function updateDatalists() {
    document.getElementById('list-setores').innerHTML = BASE_DATA.setores.map(s => `<option value="${s}">`).join('');
    document.getElementById('list-responsaveis').innerHTML = responsaveis.map(r => `<option value="${r.nome}">`).join('');
    document.getElementById('list-pdvs').innerHTML = BASE_DATA.pdvs.map(p => `<option value="${p.nome}">`).join('');
}

function saveData() {
    localStorage.setItem('log_data', JSON.stringify(solicitacoes));
    refreshUI();
}

function showNotify(msg, type) {
    const n = document.getElementById('notification');
    n.innerText = msg;
    n.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
    n.style.transform = "translateX(0)";
    setTimeout(() => n.style.transform = "translateX(200%)", 3000);
}

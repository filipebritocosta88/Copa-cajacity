// SIMULAÇÃO DE BANCO DE DADOS (Substituir por Firestore depois)
let db_requests = [
    { id: "LOG-001", solicitante: "João (Maceió)", tipo: "Reversa", destino: "Salvador", status: "Aguardando", prioridade: "Urgente", criado_em: new Date(Date.now() - 5 * 60 * 60 * 1000) }, // 5h atrás
    { id: "LOG-002", solicitante: "Filipe (Salvador)", tipo: "Envio", destino: "Manaus", status: "Em Transporte", prioridade: "Normal", criado_em: new Date() }
];

const db_users = {
    "João (Maceió)": { cidade: "Maceió", cpf: "123.***.***-00", email: "joao@empresa.com", tel: "(82) 9999-0000" },
    "Filipe (Salvador)": { cidade: "Salvador", cpf: "456.***.***-11", email: "filipe@empresa.com", tel: "(71) 9888-1111" }
};

const budgets = { "Marketing": 4000, "Vendas": 8000, "Logística": 10000 };
let spent = { "Marketing": 3800, "Vendas": 1200 };

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString();
    renderStats();
    renderTable();
});

// TROCA DE ABAS
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tab}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

// AUTO-PREENCHIMENTO
function autoFillUser(val) {
    const infoDiv = document.getElementById('auto-fields');
    if (db_users[val]) {
        const user = db_users[val];
        infoDiv.innerHTML = `
            <div class="badge-info">
                <strong>📍 Origem:</strong> ${user.cidade} | <strong>📧:</strong> ${user.email} <br>
                <strong>ID:</strong> ${user.cpf} | <strong>📞:</strong> ${user.tel}
            </div>
        `;
        checkBudget(document.getElementById('req-sector').value);
    } else {
        infoDiv.innerHTML = "";
    }
}

// ALERTA DE ORÇAMENTO
function checkBudget(sector) {
    if (spent[sector] >= budgets[sector] * 0.9) {
        alert(`⚠️ ATENÇÃO: O setor ${sector} atingiu 90% do orçamento mensal de fretes!`);
    }
}

// LOGICA DE SLA (CORES)
function getSLAClass(criado_em, prioridade) {
    const diffHours = (new Date() - criado_em) / (1000 * 60 * 60);
    
    if (prioridade === 'Critica') return 'sla-critical';
    if (prioridade === 'Urgente' && diffHours >= 4) return 'sla-critical';
    if (prioridade === 'Urgente' && diffHours >= 2) return 'sla-warning';
    if (diffHours >= 24) return 'sla-critical';
    return 'sla-normal';
}

// RENDERIZAR TABELA
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";

    db_requests.forEach(req => {
        const slaClass = getSLAClass(req.criado_em, req.prioridade);
        const row = `
            <tr>
                <td><span class="sla-dot ${slaClass}"></span></td>
                <td><strong>#${req.id}</strong></td>
                <td>${req.solicitante}</td>
                <td>${req.tipo}</td>
                <td>${req.destino}</td>
                <td><span class="status-pill">${req.status}</span></td>
                <td><button onclick="openAtendimento('${req.id}')" class="btn-table">Atender</button></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// RENDERIZAR STATS
function renderStats() {
    document.getElementById('count-open').innerText = db_requests.filter(r => r.status === 'Aguardando').length;
    document.getElementById('count-urgent').innerText = db_requests.filter(r => r.prioridade !== 'Normal').length;
    document.getElementById('total-cost').innerText = "R$ 5.120,00"; // Mock
}

// TOGGLE DESTINO
function toggleDest(isManual) {
    document.getElementById('dest-pdv-field').style.display = isManual ? 'none' : 'block';
    document.getElementById('dest-manual-fields').style.display = isManual ? 'block' : 'none';
}

// MODAL
function openAtendimento(id) {
    document.getElementById('modal-protocolo').innerText = `#${id}`;
    document.getElementById('modal-atendimento').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-atendimento').style.display = 'none';
}

// SUBMIT FORM
document.getElementById('request-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Solicitação enviada! Protocolo: LOG-" + Math.floor(Math.random()*1000));
    switchTab('dash');
});

// Banco de dados simulado
const DATA_USERS = {
    "João (Maceió)": { cidade: "Maceió", cpf: "123.***.***-00", email: "joao.maceio@empresa.com", tel: "(82) 9999-0000", cargo: "Gerente Regional" },
    "Filipe (Salvador)": { cidade: "Salvador", cpf: "456.***.***-11", email: "filipe.log@empresa.com", tel: "(71) 9888-1111", cargo: "Líder de Logística" },
    "Maria (Recife)": { cidade: "Recife", cpf: "789.***.***-22", email: "maria.rec@empresa.com", tel: "(81) 9777-2222", cargo: "Coordenadora PDV" }
};

let db_solicitacoes = [
    { id: "LOG-5521", solicitante: "João (Maceió)", tipo: "Reversa", status: "Pendente", prioridade: "Urgente", criado_em: new Date() }
];

// Troca de Abas
function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // UI Update
    document.querySelectorAll('.nav-item, .mobile-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');

    if(tabId === 'fila') renderFila();
    
    // Título dinâmico
    const titles = { 'dash': 'Resumo Operacional', 'novo': 'Nova Solicitação', 'fila': 'Fila de Trabalho' };
    document.getElementById('page-title').innerText = titles[tabId] || "LOGÍSTICA";
}

// Preenchimento Inteligente (Smart Fill)
function smartFill(val) {
    const area = document.getElementById('auto-fill-area');
    const user = DATA_USERS[val];

    if(user) {
        area.innerHTML = `
            <div class="user-card-auto">
                <div class="user-info-text">
                    <strong>${val}</strong> <br>
                    <span>${user.cargo}</span> • 📍 ${user.cidade}
                </div>
                <div class="user-details-grid">
                    <small><b>CPF:</b> ${user.cpf}</small>
                    <small><b>Email:</b> ${user.email}</small>
                </div>
            </div>
        `;
        area.style.display = "block";
    } else {
        area.style.display = "none";
    }
}

// Alternar entre PDV e Manual
function toggleDest(manual) {
    document.getElementById('btn-pdv').classList.toggle('active', !manual);
    document.getElementById('btn-manual').classList.toggle('active', manual);
    document.getElementById('campo-pdv').style.display = manual ? 'none' : 'block';
    document.getElementById('campo-manual').style.display = manual ? 'block' : 'none';
}

// Renderizar Fila Logística
function renderFila() {
    const lista = document.getElementById('lista-fila');
    lista.innerHTML = db_solicitacoes.map(sol => `
        <tr>
            <td><strong>#${sol.id}</strong></td>
            <td>${sol.solicitante}</td>
            <td><span class="sla-timer ${sol.prioridade.toLowerCase()}">4h restantes</span></td>
            <td><span class="status-pill ${sol.status.toLowerCase()}">${sol.status}</span></td>
            <td><button class="btn-action" onclick="openModal('${sol.id}')"><i class="fas fa-play"></i></button></td>
        </tr>
    `).join('');
}

// Controle de Modal
function openModal(id) {
    document.getElementById('modal-protocolo').innerText = `#${id}`;
    document.getElementById('modal-atendimento').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-atendimento').style.display = 'none';
}

// Cadastro de nova solicitação
document.getElementById('main-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = "LOG-" + Math.floor(1000 + Math.random() * 9000);
    const solicitante = document.getElementById('busca-user').value;
    const tipo = document.getElementById('tipo-sol').value;
    const prioridade = document.getElementById('prioridade').value;

    db_solicitacoes.push({ id, solicitante, tipo, status: "Pendente", prioridade, criado_em: new Date() });
    
    alert(`Solicitação ${id} registrada com sucesso!`);
    e.target.reset();
    document.getElementById('auto-fill-area').style.display = "none";
    showTab('dash', document.querySelector('.nav-item'));
});

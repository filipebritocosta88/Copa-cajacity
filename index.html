/**
 * SISTEMA LOGISTICA V2.0 - CORE ENGINE
 * Totalmente funcional e integrado ao Metasboard
 */

// 1. GESTÃO DE ESTADO (BANCO DE DADOS LOCAL)
let storage = JSON.parse(localStorage.getItem('metas_log_db')) || {
    solicitacoes: [],
    responsaveis: [
        { nome: "Equipe Suporte", email: "suporte@metasboard.com", cpf: "00.000.000/0001-00" }
    ],
    pdvs: [
        { nome: "Sede Salvador", cep: "40000-000", rua: "Av. Tancredo Neves", num: "123", bairro: "Caminho das Árvores", cidade: "Salvador", uf: "BA" }
    ]
};

// 2. INICIALIZAÇÃO
window.onload = () => {
    updateUI();
    updateClock();
    setInterval(updateClock, 1000);
};

// 3. NAVEGAÇÃO ENTRE TELAS (SPA)
function switchTab(targetId, element) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(targetId).classList.add('active');
    element.classList.add('active');
    
    updateUI(); // Sincroniza dados sempre que trocar de tela
}

// 4. REGISTRO DE SOLICITAÇÃO (O CORAÇÃO DO SISTEMA)
document.getElementById('form-registro').addEventListener('submit', function(e) {
    e.preventDefault();

    // Criação do objeto de dados
    const novaSolicitacao = {
        id: "LOG-" + Math.floor(100000 + Math.random() * 900000),
        data: new Date().toLocaleDateString('pt-br') + " " + new Date().toLocaleTimeString('pt-br', {hour: '2-digit', minute:'2-digit'}),
        tipo: document.getElementById('f-tipo').value,
        prio: document.getElementById('f-prio').value,
        setor: document.getElementById('f-setor').value,
        resp: document.getElementById('f-resp-busca').value,
        email: document.getElementById('f-email').value,
        cpf: document.getElementById('f-cpf').value,
        destinatario: document.getElementById('f-dest-nome').value,
        cep: document.getElementById('f-dest-cep').value,
        rua: document.getElementById('f-dest-rua').value,
        num: document.getElementById('f-dest-num').value,
        comp: document.getElementById('f-dest-comp').value,
        bairro: document.getElementById('f-dest-bairro').value,
        cidade: document.getElementById('f-dest-cid').value,
        uf: document.getElementById('f-dest-uf').value,
        status: "Pendente",
        custo: 0
    };

    // Salvar e Notificar
    storage.solicitacoes.unshift(novaSolicitacao);
    saveData();
    showToast("Solicitação gerada com sucesso! Protocolo: " + novaSolicitacao.id, "success");
    
    this.reset();
    switchTab('lista', document.querySelectorAll('.nav-item')[2]);
});

// 5. PREENCHIMENTO AUTOMÁTICO (RESPONSÁVEL E PDV)
document.getElementById('f-resp-busca').addEventListener('input', function() {
    const res = storage.responsaveis.find(r => r.nome === this.value);
    if(res) {
        document.getElementById('f-email').value = res.email;
        document.getElementById('f-cpf').value = res.cpf || "";
    }
});

document.getElementById('f-pdv-busca').addEventListener('input', function() {
    const pdv = storage.pdvs.find(p => p.nome === this.value);
    if(pdv) {
        document.getElementById('f-dest-nome').value = pdv.nome;
        document.getElementById('f-dest-cep').value = pdv.cep;
        document.getElementById('f-dest-rua').value = pdv.rua;
        document.getElementById('f-dest-num').value = pdv.num;
        document.getElementById('f-dest-bairro').value = pdv.bairro;
        document.getElementById('f-dest-cid').value = pdv.cidade;
        document.getElementById('f-dest-uf').value = pdv.uf;
    }
});

// 6. CADASTRO DE BASE
document.getElementById('form-cad-base').onsubmit = function(e) {
    e.preventDefault();
    const tipo = document.getElementById('c-tipo').value;
    const item = {
        nome: document.getElementById('c-nome').value,
        email: document.getElementById('c-email').value,
        cidade: document.getElementById('c-cid').value
    };

    if(tipo === 'resp') storage.responsaveis.push(item);
    else storage.pdvs.push(item);

    saveData();
    showToast("Cadastro realizado!", "success");
    this.reset();
};

// 7. ATUALIZAÇÃO DA INTERFACE (UI)
function updateUI() {
    // Stats
    const pendentes = storage.solicitacoes.filter(s => s.status === 'Pendente').length;
    const finalizados = storage.solicitacoes.filter(s => s.status === 'Finalizado').length;
    const totalCusto = storage.solicitacoes.reduce((acc, s) => acc + s.custo, 0);

    document.getElementById('st-total').innerText = storage.solicitacoes.length;
    document.getElementById('st-pend').innerText = pendentes;
    document.getElementById('st-fin').innerText = finalizados;
    document.getElementById('st-custo').innerText = totalCusto.toLocaleString('pt-br', {style: 'currency', currency: 'BRL'});

    // Tabela Recentes (Dash)
    renderTable('table-recent', storage.solicitacoes.slice(0, 5), (s) => `
        <tr><td>${s.id}</td><td>${s.resp}</td><td>${s.cidade}</td><td><span class="badge bg-pending">${s.status}</span></td></tr>
    `);

    // Tabela Histórico Completo
    renderTable('table-history', storage.solicitacoes, (s) => `
        <tr><td><strong>#${s.id}</strong></td><td>${s.data}</td><td>${s.resp}</td><td>${s.cidade}/${s.uf}</td>
        <td><span class="badge ${s.status === 'Pendente' ? 'bg-pending' : 'bg-success'}">${s.status}</span></td></tr>
    `);

    // Tabela Atendimento (Administrativo)
    renderTable('table-adm', storage.solicitacoes.filter(s => s.status === 'Pendente'), (s) => `
        <tr>
            <td><button class="btn btn-action" onclick="finishTask('${s.id}')">Tratar</button></td>
            <td>${s.id}</td><td>${s.resp}</td><td>${s.cidade}</td>
            <td><strong style="color:${s.prio === 'Emergencial' ? 'red' : 'inherit'}">${s.prio}</strong></td>
        </tr>
    `);

    // Atualizar Datalists
    document.getElementById('dl-resps').innerHTML = storage.responsaveis.map(r => `<option value="${r.nome}">`).join('');
    document.getElementById('dl-pdvs').innerHTML = storage.pdvs.map(p => `<option value="${p.nome}">`).join('');
}

function renderTable(id, data, template) {
    const tableBody = document.querySelector(`#${id} tbody`);
    if(tableBody) tableBody.innerHTML = data.map(template).join('');
}

function finishTask(id) {
    const idx = storage.solicitacoes.findIndex(s => s.id === id);
    if(idx !== -1) {
        storage.solicitacoes[idx].status = "Finalizado";
        saveData();
        showToast("Solicitação " + id + " finalizada!", "success");
    }
}

// 8. UTILITÁRIOS
function saveData() {
    localStorage.setItem('metas_log_db', JSON.stringify(storage));
    updateUI();
}

function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
    t.style.transform = "translateX(0)";
    setTimeout(() => t.style.transform = "translateX(150%)", 4000);
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleDateString('pt-br') + " - " + now.toLocaleTimeString('pt-br');
}

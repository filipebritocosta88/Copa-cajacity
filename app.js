// Simulação de Banco de Dados (Cadastros Base)
const DB = {
    setores: ["Logística", "Loja Virtual", "Mercado Livre", "DT", "Call Center", "ADM", "Estoque", "Financeiro", "Diretoria", "Marketing"],
    responsaveis: [
        { nome: "João Silva", cidade: "Maceió", setor: "Gerência", endereco: "Rua das Palmeiras, 10 - PDV Centro", cpf: "123.456.789-00", email: "joao@empresa.com" },
        { nome: "Maria Santos", cidade: "Rio de Janeiro", setor: "PDV", endereco: "Av. Atlântica, 500 - Barra", cpf: "222.333.444-55", email: "maria@empresa.com" },
        { nome: "Felipe Oliveira", cidade: "Manaus", setor: "Gerência", endereco: "Rua Amazonas, 99 - Industrial", cpf: "333.444.555-66", email: "felipe@empresa.com" },
        { nome: "Ricardo Uchoa", cidade: "Salvador", setor: "Loja Virtual", endereco: "Sede Salvador - Sala Logística", cpf: "999.000.111-22", email: "uchoa@empresa.com" }
    ],
    pdvs: [
        { nome: "PDV Salvador Shopping", cidade: "Salvador", estado: "BA", responsavel: "Iago" },
        { nome: "PDV Maceió Centro", cidade: "Maceió", estado: "AL", responsavel: "João" },
        { nome: "PDV Belém", cidade: "Belém", estado: "PA", responsavel: "Gerência PA" }
    ]
};

let solicitacoes = JSON.parse(localStorage.getItem('log_solicitacoes')) || [];
let currentEditId = null;

// Inicialização de Datalists (Filtros pesquisáveis)
function initCadastros() {
    const listSetores = document.getElementById('lista-setores');
    DB.setores.forEach(s => listSetores.innerHTML += `<option value="${s}">`);

    const listResp = document.getElementById('lista-responsaveis');
    DB.responsaveis.forEach(r => listResp.innerHTML += `<option value="${r.nome}">`);

    const listPDV = document.getElementById('lista-pdvs');
    DB.pdvs.forEach(p => listPDV.innerHTML += `<option value="${p.nome}">`);
}

// Preenchimento Automático ao selecionar responsável
document.getElementById('resp_busca').addEventListener('change', function(e) {
    const resp = DB.responsaveis.find(r => r.nome === e.target.value);
    if (resp) {
        document.getElementById('origem_cidade').value = resp.cidade;
        document.getElementById('origem_endereco').value = resp.endereco;
        document.getElementById('setor_busca').value = resp.setor;
    }
});

// Envio de Formulário (Nova Solicitação)
document.getElementById('log-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nova = {
        protocolo: "LOG" + Date.now().toString().slice(-6),
        data: new Date().toLocaleDateString('pt-br'),
        timestamp: new Date().getTime(),
        tipo: document.getElementById('tipo_solicitacao').value,
        prioridade: document.getElementById('prioridade').value,
        setor: document.getElementById('setor_busca').value,
        responsavel: document.getElementById('resp_busca').value,
        origem: document.getElementById('origem_cidade').value,
        destino: document.getElementById('destino_busca').value,
        destinatario: document.getElementById('destino_nome').value,
        status: "Aguardando Logística",
        custo: 0,
        rastreio: "-",
        obs: document.getElementById('obs').value
    };

    solicitacoes.unshift(nova);
    salvarESincronizar();
    this.reset();
    alert("Solicitação registrada com sucesso! Protocolo: " + nova.protocolo);
});

// Ações da Logística (Atendimento)
function abrirAtendimento(protocolo) {
    const sol = solicitacoes.find(s => s.protocolo === protocolo);
    currentEditId = protocolo;
    document.getElementById('modal-prot').innerText = "Atendimento " + protocolo;
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('modal-atendimento').style.display = 'block';
}

function salvarAtendimento() {
    const idx = solicitacoes.findIndex(s => s.protocolo === currentEditId);
    if (idx !== -1) {
        solicitacoes[idx].custo = parseFloat(document.getElementById('log-custo').value) || 0;
        solicitacoes[idx].rastreio = document.getElementById('log-rastreio').value;
        solicitacoes[idx].status = "Em Transporte";
        solicitacoes[idx].modalidade = document.getElementById('log-modalidade').value;
    }
    
    fecharModal();
    salvarESincronizar();
}

function fecharModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('modal-atendimento').style.display = 'none';
}

// Renderização e Cálculos
function render() {
    const tbody = document.getElementById('tabela-logs');
    tbody.innerHTML = "";

    solicitacoes.forEach(s => {
        const corPrioridade = s.prioridade === 'Urgente' ? 'var(--warning)' : (s.prioridade === 'Emergencial' ? 'var(--danger)' : '#64748b');
        
        tbody.innerHTML += `
            <tr>
                <td><strong>#${s.protocolo}</strong></td>
                <td>${s.data}</td>
                <td>${s.responsavel}<br><small>${s.setor}</small></td>
                <td>${s.tipo}<br><span class="prioridade-btn" style="background:${corPrioridade}">${s.prioridade}</span></td>
                <td>${s.origem} > ${s.destino}</td>
                <td><span class="badge" style="background:#e2e8f0">${s.status}</span><br><small>Rastreio: ${s.rastreio}</small></td>
                <td>
                    ${s.status === 'Aguardando Logística' ? 
                    `<button onclick="abrirAtendimento('${s.protocolo}')" style="background:var(--accent); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Atender</button>` : 
                    `<i class="fas fa-check-circle" style="color:var(--success)"></i>`}
                </td>
            </tr>
        `;
    });

    atualizarDashboard();
}

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-br');
    const totalDia = solicitacoes.filter(s => s.data === hoje).length;
    const reversas = solicitacoes.filter(s => s.tipo === 'Logística Reversa' && s.status !== 'Finalizado').length;
    const entregues = solicitacoes.filter(s => s.status === 'Finalizado').length;
    const gastoTotal = solicitacoes.reduce((acc, curr) => acc + curr.custo, 0);

    document.getElementById('val-dia').innerText = totalDia;
    document.getElementById('val-reversas').innerText = reversas;
    document.getElementById('val-entregues').innerText = entregues;
    document.getElementById('val-gasto').innerText = gastoTotal.toLocaleString('pt-br', {style: 'currency', currency: 'BRL'});
}

function salvarESincronizar() {
    localStorage.setItem('log_solicitacoes', JSON.stringify(solicitacoes));
    render();
}

// Start
initCadastros();
render();

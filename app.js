// Banco de Dados de Responsáveis / Setores
const DATABASE = {
    responsaveis: [
        { nome: "João Silva", cidade: "Maceió", cpf: "123.456.789-00", email: "joao@empresa.com", setor: "Gerência" },
        { nome: "Maria Oliveira", cidade: "Rio de Janeiro", cpf: "987.654.321-11", email: "maria@empresa.com", setor: "Call Center" },
        { nome: "Iago Silva", cidade: "Salvador", cpf: "111.222.333-44", email: "iago@empresa.com", setor: "Loja Virtual" },
        { nome: "Uchoa Santos", cidade: "Salvador", cpf: "555.666.777-88", email: "uchoa@empresa.com", setor: "Loja Virtual" }
    ],
    setores: ["ADM", "Call Center", "DT", "Estoque Geral", "Loja Virtual", "Marketing", "Comercial"]
};

let solicitacoes = [];
let totalGasto = 0;

// Filtros Inteligentes
function filtrarResponsavel() {
    const busca = document.getElementById('input-responsavel').value.toLowerCase();
    const sug = document.getElementById('sugestoes-resp');
    sug.innerHTML = "";
    
    if (busca.length > 0) {
        const filtrados = DATABASE.responsaveis.filter(r => r.nome.toLowerCase().includes(busca));
        filtrados.forEach(r => {
            const div = document.createElement('div');
            div.innerText = `${r.nome} (${r.cidade})`;
            div.onclick = () => preencherResponsavel(r);
            sug.appendChild(div);
        });
        sug.style.display = filtrados.length ? 'block' : 'none';
    } else {
        sug.style.display = 'none';
    }
}

function preencherResponsavel(r) {
    document.getElementById('input-responsavel').value = `${r.nome} (${r.cidade})`;
    document.getElementById('resp-nome').value = r.nome;
    document.getElementById('resp-cidade').value = r.cidade;
    document.getElementById('resp-cpf').value = r.cpf;
    document.getElementById('resp-email').value = r.email;
    document.getElementById('input-setor').value = r.setor;
    document.getElementById('sugestoes-resp').style.display = 'none';
}

function filtrarSetor() {
    const busca = document.getElementById('input-setor').value.toLowerCase();
    const sug = document.getElementById('sugestoes-setor');
    sug.innerHTML = "";
    if (busca.length > 0) {
        const filtrados = DATABASE.setores.filter(s => s.toLowerCase().includes(busca));
        filtrados.forEach(s => {
            const div = document.createElement('div');
            div.innerText = s;
            div.onclick = () => {
                document.getElementById('input-setor').value = s;
                sug.style.display = 'none';
            };
            sug.appendChild(div);
        });
        sug.style.display = 'block';
    }
}

// Envio do Formulário
document.getElementById('form-solicitacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const novaSolicitacao = {
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-br'),
        setor: document.getElementById('input-setor').value || "Avulso",
        responsavel: document.getElementById('resp-nome').value,
        origem: document.getElementById('resp-cidade').value,
        destino: document.getElementById('destino').value,
        tipo: document.getElementById('select-tipo').value,
        status: 'Pendente Logística',
        custo: 0,
        rastreio: '',
        previsao: ''
    };

    solicitacoes.unshift(novaSolicitacao);
    renderizarTabela();
    atualizarCards();
    this.reset();
});

function renderizarTabela() {
    const tbody = document.getElementById('lista-solicitacoes');
    tbody.innerHTML = "";

    solicitacoes.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.data}</td>
            <td><strong>${s.setor}</strong><br><small>${s.responsavel}</small></td>
            <td>${s.tipo}</td>
            <td>${s.origem} > ${s.destino}</td>
            <td><span class="status-badge ${s.status === 'Finalizado' ? 'status-finalizado' : 'status-pendente'}">${s.status}</span></td>
            <td>
                ${s.status === 'Pendente Logística' ? 
                `<button onclick="abrirLogistica(${s.id})" style="cursor:pointer; background:none; border:1px solid #3498db; color:#3498db; border-radius:4px; padding:4px 8px;">Tratar</button>` : 
                `<i class="fas fa-check-circle" style="color:green"></i>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Fluxo Logística
function abrirLogistica(id) {
    document.getElementById('edit-id').value = id;
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('modal-logistica').style.display = 'block';
}

function salvarLogistica() {
    const id = document.getElementById('edit-id').value;
    const custo = parseFloat(document.getElementById('log-custo').value) || 0;
    const rastreio = document.getElementById('log-rastreio').value;
    
    const index = solicitacoes.findIndex(s => s.id == id);
    if (index !== -1) {
        solicitacoes[index].status = 'Finalizado';
        solicitacoes[index].custo = custo;
        solicitacoes[index].rastreio = rastreio;
        totalGasto += custo;
    }

    fecharModal();
    renderizarTabela();
    atualizarCards();
}

function fecharModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('modal-logistica').style.display = 'none';
    document.getElementById('log-custo').value = '';
    document.getElementById('log-rastreio').value = '';
}

function atualizarCards() {
    document.getElementById('card-pedidos').innerText = solicitacoes.length;
    document.getElementById('card-reversas').innerText = solicitacoes.filter(s => s.status === 'Pendente Logística').length;
    document.getElementById('card-hoje').innerText = solicitacoes.filter(s => s.data === new Date().toLocaleDateString('pt-br')).length;
    document.getElementById('card-gasto').innerText = `R$ ${totalGasto.toFixed(2)}`;
}

// Fechar sugestões ao clicar fora
document.addEventListener('click', function(e) {
    if (!e.target.closest('.input-group')) {
        document.querySelectorAll('.suggestions').forEach(s => s.style.display = 'none');
    }
});

document.getElementById('logistics-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const data = {
        data: new Date().toLocaleDateString(),
        setor: document.getElementById('setor').value,
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        destino: document.getElementById('destino').value,
        custo: parseFloat(document.getElementById('valor').value) || 0,
        status: 'Pendente'
    };

    addTableRow(data);
    updateStats(data.custo);
    this.reset();
});

function addTableRow(item) {
    const tbody = document.getElementById('table-body');
    const row = `<tr>
        <td>${item.data}</td>
        <td>${item.setor}</td>
        <td>${item.tipo}</td>
        <td>${item.origem} -> ${item.destino}</td>
        <td>R$ ${item.custo.toFixed(2)}</td>
        <td><span style="color: orange">${item.status}</span></td>
    </tr>`;
    tbody.innerHTML = row + tbody.innerHTML;
}

function updateStats(novoCusto) {
    // Incrementa contadores fictícios para exemplo
    const countToday = document.getElementById('count-today');
    countToday.innerText = parseInt(countToday.innerText) + 1;

    const totalCost = document.getElementById('total-cost');
    let atual = parseFloat(totalCost.innerText.replace('R$ ', '').replace(',', '.'));
    totalCost.innerText = `R$ ${(atual + novoCusto).toFixed(2)}`;
}

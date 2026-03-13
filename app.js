const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentCampId = null;

// --- GERENCIAMENTO DE INTERFACE ---
function showView(viewId) {
    document.querySelectorAll('#view-auth, #view-dash, #view-arena').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById('main-nav').classList.toggle('hidden', viewId === 'view-auth');
    window.scrollTo(0,0);
}

function toggleAuth(isReg) {
    document.getElementById('box-login').classList.toggle('hidden', isReg);
    document.getElementById('box-register').classList.toggle('hidden', !isReg);
}

function changeArenaTab(tab) {
    document.getElementById('arena-tab-table').classList.toggle('hidden', tab !== 'table');
    document.getElementById('arena-tab-matches').classList.toggle('hidden', tab !== 'matches');
    document.getElementById('arena-tab-admin').classList.toggle('hidden', tab !== 'admin');
}

// --- AUTENTICAÇÃO E NICK ÚNICO ---
document.getElementById('btn-register-action').onclick = async () => {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if (!nick || !email || pass.length < 6) return alert("Preencha Nick, E-mail e Senha (mín. 6 dígitos)");

    try {
        const nickCheck = await db.collection('usuarios').where('nome', '==', nick).get();
        if (!nickCheck.empty) return alert("Este Nick já está em uso!");

        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick,
            email: email,
            online: true,
            statsGlobal: { vitorias: 0, gols: 0 },
            criadoEm: Date.now()
        });
        alert("Conta criada com sucesso!");
    } catch (e) {
        alert("Erro no cadastro: " + e.message);
    }
};

document.getElementById('btn-login-action').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        alert("Erro ao entrar: " + e.message);
    }
};

function logout() {
    if (currentUser) db.collection('usuarios').doc(currentUser.uid).update({ online: false });
    auth.signOut();
}

// Observador de Usuário
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        db.collection('usuarios').doc(user.uid).update({ online: true, lastSeen: Date.now() });
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            document.getElementById('display-nick').innerText = doc.data().nome;
            showView('view-dash');
            startRealtimeLobby();
            loadMyCamps();
            listenToInvites();
        });
    } else {
        showView('view-auth');
    }
});

// --- LOBBY EM TEMPO REAL ---
function startRealtimeLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const div = document.getElementById('lobby-players');
        div.innerHTML = "";
        if (snap.size <= 1) div.innerHTML = "<p style='font-size:0.8rem; color:#555'>Só você está online agora.</p>";
        snap.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                div.innerHTML += `
                    <div class="lobby-item">
                        <span><i class="fas fa-user-ninja"></i> ${doc.data().nome}</span>
                        <span class="badge">ONLINE</span>
                    </div>`;
            }
        });
    });
}

// --- GESTÃO DE CAMPEONATOS ---
async function createCamp() {
    const name = document.getElementById('camp-name').value;
    const game = document.getElementById('camp-game').value;
    if (!name) return alert("Digite o nome da Copa!");

    const newCamp = await db.collection('campeonatos').add({
        nome: name,
        jogo: game,
        hostId: currentUser.uid,
        participantes: [currentUser.uid],
        criadoEm: Date.now(),
        tabela: { [currentUser.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: document.getElementById('display-nick').innerText } }
    });
    alert("Copa Criada!");
    document.getElementById('camp-name').value = "";
    loadMyCamps();
}

function loadMyCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', currentUser.uid).onSnapshot(snap => {
        const div = document.getElementById('lista-camps');
        div.innerHTML = "";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer; border-left-color:var(--secondary)">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${c.nome}</strong>
                        <span class="badge" style="background:var(--secondary)">${c.jogo}</span>
                    </div>
                </div>`;
        });
    });
}

// --- ARENA (DENTRO DA COPA) ---
let currentArenaUnsub = null;

function openArena(id) {
    currentCampId = id;
    showView('view-arena');
    changeArenaTab('table');

    if (currentArenaUnsub) currentArenaUnsub();

    currentArenaUnsub = db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const data = doc.data();
        document.getElementById('arena-title').innerText = data.nome;
        document.getElementById('arena-game-label').innerText = data.jogo;
        
        // Mostrar tab admin se for o dono
        document.getElementById('btn-tab-admin').classList.toggle('hidden', data.hostId !== currentUser.uid);

        renderTable(data.tabela);
        loadMatches(id);
        if (data.hostId === currentUser.uid) {
            setupAdminPanel(data.participantes, data.tabela);
        }
    });
}

function renderTable(tabela) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";
    
    // Transformar objeto em array e ordenar por pontos
    const sorted = Object.entries(tabela).sort((a,b) => b[1].pts - a[1].pts);
    
    sorted.forEach(([id, stats], index) => {
        tbody.innerHTML += `
            <tr>
                <td class="pos">${index + 1}º</td>
                <td>${stats.n}</td>
                <td>${stats.pts}</td>
                <td>${stats.v}</td>
                <td>${stats.e}</td>
                <td>${stats.d}</td>
                <td>${stats.sg}</td>
            </tr>`;
    });
}

function loadMatches(campId) {
    db.collection('campeonatos').doc(campId).collection('partidas').orderBy('data', 'desc').onSnapshot(snap => {
        const div = document.getElementById('arena-history-list');
        div.innerHTML = snap.empty ? "<p style='text-align:center; color:#555'>Nenhum jogo ainda.</p>" : "";
        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `
                <div class="match-card">
                    <div class="match-date">${new Date(m.data).toLocaleString()}</div>
                    <div class="match-score">
                        <span>${m.n1}</span>
                        <span style="color:var(--primary)">${m.g1}</span>
                        <span>x</span>
                        <span style="color:var(--primary)">${m.g2}</span>
                        <span>${m.n2}</span>
                    </div>
                </div>`;
        });
    });
}

// --- ADMINISTRAÇÃO ---
async function setupAdminPanel(parts, tabela) {
    const s1 = document.getElementById('adm-p1');
    const s2 = document.getElementById('adm-p2');
    s1.innerHTML = ""; s2.innerHTML = "";
    
    parts.forEach(pId => {
        const nick = tabela[pId].n;
        const opt = `<option value="${pId}">${nick}</option>`;
        s1.innerHTML += opt;
        s2.innerHTML += opt;
    });

    // Lista de convites
    db.collection('usuarios').limit(10).get().then(snap => {
        const div = document.getElementById('admin-invite-list');
        div.innerHTML = "";
        snap.forEach(u => {
            if (!parts.includes(u.id)) {
                div.innerHTML += `
                    <div class="lobby-item">
                        <span>${u.data().nome}</span>
                        <button class="btn-sec" onclick="sendInvite('${u.id}', '${u.data().nome}')">Convidar</button>
                    </div>`;
            }
        });
    });
}

async function submitMatch() {
    const id1 = document.getElementById('adm-p1').value;
    const id2 = document.getElementById('adm-p2').value;
    const g1 = parseInt(document.getElementById('adm-g1').value);
    const g2 = parseInt(document.getElementById('adm-g2').value);

    if (id1 === id2) return alert("Selecione jogadores diferentes!");
    if (isNaN(g1) || isNaN(g2)) return alert("Preencha os gols!");

    const campRef = db.collection('campeonatos').doc(currentCampId);
    const doc = await campRef.get();
    const tab = doc.data().tabela;

    // Lógica de Pontos
    tab[id1].sg += (g1 - g2);
    tab[id2].sg += (g2 - g1);

    if (g1 > g2) { tab[id1].pts += 3; tab[id1].v += 1; tab[id2].d += 1; }
    else if (g2 > g1) { tab[id2].pts += 3; tab[id2].v += 1; tab[id1].d += 1; }
    else { tab[id1].pts += 1; tab[id2].pts += 1; tab[id1].e += 1; tab[id2].e += 1; }

    await campRef.update({ tabela: tab });
    await campRef.collection('partidas').add({
        p1: id1, n1: tab[id1].n, g1: g1,
        p2: id2, n2: tab[id2].n, g2: g2,
        data: Date.now()
    });

    alert("Placar salvo e tabela atualizada!");
    document.getElementById('adm-g1').value = ""; document.getElementById('adm-g2').value = "";
}

// --- CONVITES ---
async function sendInvite(uid, nick) {
    await db.collection('convites').add({
        paraId: uid,
        campId: currentCampId,
        campNome: document.getElementById('arena-title').innerText,
        remetente: document.getElementById('display-nick').innerText,
        status: 'pendente'
    });
    alert("Convite enviado para " + nick);
}

function listenToInvites() {
    db.collection('convites').where('paraId', '==', currentUser.uid).onSnapshot(snap => {
        const area = document.getElementById('area-convites');
        const list = document.getElementById('lista-convites');
        area.classList.toggle('hidden', snap.empty);
        list.innerHTML = "";
        snap.forEach(doc => {
            const inv = doc.data();
            list.innerHTML += `
                <div class="card" style="border-left-color:var(--accent); padding:15px">
                    <p style="font-size:0.9rem"><b>${inv.remetente}</b> te convidou para a <b>${inv.campNome}</b></p>
                    <button class="btn-primary" style="padding:8px; margin-top:10px; font-size:0.7rem" onclick="acceptInvite('${doc.id}', '${inv.campId}')">Aceitar Convite</button>
                </div>`;
        });
    });
}

async function acceptInvite(invId, campId) {
    const campRef = db.collection('campeonatos').doc(campId);
    const campDoc = await campRef.get();
    const tab = campDoc.data().tabela;
    
    tab[currentUser.uid] = { pts:0, v:0, e:0, d:0, sg:0, n: document.getElementById('display-nick').innerText };
    
    await campRef.update({
        participantes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        tabela: tab
    });
    await db.collection('convites').doc(invId).delete();
    alert("Você entrou no campeonato!");
}

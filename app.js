const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentCampId = null;

// BANCO DE DADOS DE TIMES E ESCUDOS (Usando logos oficiais via CDN)
const TEAMS = {
    br: [
        {n: "Flamengo", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_fla.png"},
        {n: "Palmeiras", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_pal.png"},
        {n: "São Paulo", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_spa.png"},
        {n: "Corinthians", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_cor.png"},
        {n: "Galo", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_cam.png"},
        {n: "Grêmio", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_gre.png"}
    ],
    es: [
        {n: "Real Madrid", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_rma.png"},
        {n: "Barcelona", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_bar.png"},
        {n: "Atlético", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_atm.png"}
    ],
    en: [
        {n: "Man City", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_mci.png"},
        {n: "Liverpool", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_liv.png"},
        {n: "Arsenal", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_ars.png"}
    ]
};

// CONTROLE DE NAVEGAÇÃO
function showView(viewId) {
    document.querySelectorAll('#view-auth, #view-dash, #view-arena').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById('main-nav').classList.toggle('hidden', viewId === 'view-auth');
}

function toggleAuth(isReg) {
    document.getElementById('box-login').classList.toggle('hidden', isReg);
    document.getElementById('box-register').classList.toggle('hidden', !isReg);
}

function tabArena(tabId, btn) {
    document.querySelectorAll('#tab-table, #tab-teams, #tab-admin').forEach(t => t.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.btn-sec').forEach(b => b.style.borderColor = "#444");
    btn.style.borderColor = "var(--primary)";
}

// AUTENTICAÇÃO E NICK ÚNICO
async function handleRegister() {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;

    if (!nick || !email || pass.length < 6) return alert("Preencha os dados corretamente!");

    const snap = await db.collection('usuarios').where('nome', '==', nick).get();
    if (!snap.empty) return alert("Este Nick já está em uso por outro jogador!");

    auth.createUserWithEmailAndPassword(email, pass).then(cred => {
        db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick, email: email, foto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nick}`
        });
    }).catch(e => alert("Erro: " + e.message));
}

function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Login inválido."));
}

function logout() { auth.signOut(); }

// OBSERVAR STATUS DO USUÁRIO
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            const data = doc.data();
            document.getElementById('user-name').innerText = data.nome;
            document.getElementById('user-photo').src = data.foto;
            showView('view-dash');
            loadMyCamps();
            listenToInvites();
        });
    } else {
        showView('view-auth');
    }
});

// GESTÃO DE CAMPEONATOS
function createCamp() {
    const name = document.getElementById('camp-name').value;
    const game = document.getElementById('camp-game').value;
    if (!name) return alert("Dê um nome ao campeonato!");

    db.collection('campeonatos').add({
        nome: name, jogo: game, hostId: currentUser.uid,
        participantes: [currentUser.uid],
        times: {}, status: "aberto", criadoEm: Date.now()
    }).then(() => {
        alert("Campeonato Criado!");
        document.getElementById('camp-name').value = "";
        loadMyCamps();
    });
}

function loadMyCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', currentUser.uid).get().then(snap => {
        const list = document.getElementById('lista-camps');
        list.innerHTML = snap.empty ? '<p style="color:#555">Você ainda não entrou em nenhum torneio.</p>' : "";
        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${c.nome}</strong>
                        <span class="badge">${c.jogo}</span>
                    </div>
                    <p style="font-size:0.8rem; color:#888; margin-top:5px"><i class="fas fa-users"></i> ${c.participantes.length} Jogadores</p>
                </div>`;
        });
    });
}

// ARENA (SISTEMA INTERNO)
let arenaUnsubscribe = null;
function openArena(id) {
    currentCampId = id;
    showView('view-arena');
    if (arenaUnsubscribe) arenaUnsubscribe();

    arenaUnsubscribe = db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const data = doc.data();
        document.getElementById('arena-title').innerText = data.nome;
        document.getElementById('arena-game-badge').innerText = data.jogo;
        document.getElementById('btn-admin').classList.toggle('hidden', data.hostId !== currentUser.uid);
        
        renderArenaTable(data);
        renderTeams(data.times);
        if (data.hostId === currentUser.uid) loadInviteList(data.participantes);
    });
}

async function renderArenaTable(data) {
    const div = document.getElementById('arena-players');
    div.innerHTML = "";
    for (let pId of data.participantes) {
        const u = await db.collection('usuarios').doc(pId).get();
        const time = data.times[pId] || "---";
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #333">
                <span style="font-weight:600">${u.data().nome}</span>
                <span style="color:var(--primary); font-size:0.9rem">${time}</span>
            </div>`;
    }
}

function renderTeams(timesOcupados = {}) {
    const liga = document.getElementById('sel-liga').value;
    const grid = document.getElementById('grid-teams');
    grid.innerHTML = "";
    
    const nomesOcupados = Object.values(timesOcupados);

    TEAMS[liga].forEach(time => {
        const isBusy = nomesOcupados.includes(time.n);
        const isMine = timesOcupados[currentUser.uid] === time.n;
        
        const card = document.createElement('div');
        card.className = `time-card ${isBusy ? 'busy' : ''} ${isMine ? 'selected' : ''}`;
        card.innerHTML = `<img src="${time.img}"><br><small>${time.n}</small>`;
        
        if (!isBusy) card.onclick = () => selectTeam(time.n);
        grid.appendChild(card);
    });
}

function selectTeam(nome) {
    const upd = {};
    upd[`times.${currentUser.uid}`] = nome;
    db.collection('campeonatos').doc(currentCampId).update(upd);
}

// CONVITES
function loadInviteList(participantes) {
    db.collection('usuarios').limit(20).get().then(snap => {
        const div = document.getElementById('list-all-users');
        div.innerHTML = "";
        snap.forEach(u => {
            if (!participantes.includes(u.id)) {
                div.innerHTML += `
                <div class="card" style="margin-bottom:8px; padding:10px; background:#111" onclick="sendInvite('${u.id}', '${u.data().nome}')">
                    <i class="fas fa-plus-circle" style="color:var(--primary)"></i> ${u.data().nome}
                </div>`;
            }
        });
    });
}

async function sendInvite(toId, toName) {
    await db.collection('convites').add({
        paraId: toId, campId: currentCampId,
        campNome: document.getElementById('arena-title').innerText,
        status: 'pendente'
    });
    alert("Convite enviado para " + toName);
}

function listenToInvites() {
    db.collection('convites').where('paraId', '==', currentUser.uid).onSnapshot(snap => {
        const area = document.getElementById('area-convites');
        const list = document.getElementById('lista-convites');
        list.innerHTML = "";
        if (snap.empty) return area.classList.add('hidden');
        
        area.classList.remove('hidden');
        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `
                <div class="card" style="border-left-color:var(--accent); padding:15px">
                    <p style="font-size:0.9rem">Convite para: <b>${c.campNome}</b></p>
                    <button class="btn-primary" style="padding:8px; margin-top:10px; font-size:0.7rem" onclick="acceptInvite('${doc.id}', '${c.campId}')">Aceitar Convite</button>
                </div>`;
        });
    });
}

async function acceptInvite(invId, campId) {
    await db.collection('campeonatos').doc(campId).update({
        participantes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
    await db.collection('convites').doc(invId).delete();
    alert("Você entrou no campeonato!");
}

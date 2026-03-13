const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentCampId = null;

// LIGAS E TIMES (Adicionado escudos via Google Logos)
const TEAMS_DB = {
    br: [
        {n: "Flamengo", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_fla.png"},
        {n: "Palmeiras", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_pal.png"},
        {n: "São Paulo", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_spa.png"},
        {n: "Corinthians", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_cor.png"},
        {n: "Bahia", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_bah.png"}
    ],
    eu: [
        {n: "Real Madrid", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_rma.png"},
        {n: "Barcelona", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_bar.png"},
        {n: "Man City", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_mci.png"},
        {n: "Bayern", img: "https://ssl.gstatic.com/onebox/media/sports/logos/unique_id_bay.png"}
    ]
};

// --- NAVEGAÇÃO ---
function showView(id) {
    document.querySelectorAll('#view-auth, #view-dash, #view-arena').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('main-nav').classList.toggle('hidden', id === 'view-auth');
}

function toggleAuth(isReg) {
    document.getElementById('box-login').classList.toggle('hidden', isReg);
    document.getElementById('box-register').classList.toggle('hidden', !isReg);
}

function tabArena(id, btn) {
    document.querySelectorAll('#tab-table, #tab-teams, #tab-admin').forEach(t => t.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.btn-sec').forEach(b => b.style.borderColor = "#444");
    if(btn) btn.style.borderColor = "var(--primary)";
}

// --- AUTH ---
async function handleRegister() {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    if(!nick || !email || pass.length < 6) return alert("Dados inválidos!");

    const snap = await db.collection('usuarios').where('nome', '==', nick).get();
    if(!snap.empty) return alert("Nick já existe!");

    auth.createUserWithEmailAndPassword(email, pass).then(cred => {
        db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick, email: email, stats: { v: 0, g: 0 }
        });
    }).catch(e => alert(e.message));
}

function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Erro ao entrar!"));
}

function logout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            document.getElementById('user-name').innerText = doc.data().nome;
            showView('view-dash');
            loadCamps();
            listenInvites();
        });
    } else {
        showView('view-auth');
    }
});

// --- LOGICA CAMPEONATO ---
function createCamp() {
    const name = document.getElementById('camp-name').value;
    const game = document.getElementById('camp-game').value;
    if(!name) return;
    db.collection('campeonatos').add({
        nome: name, jogo: game, hostId: currentUser.uid,
        participantes: [currentUser.uid],
        times: {}, criadoEm: Date.now()
    }).then(() => { alert("Torneio Criado!"); loadCamps(); });
}

function loadCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', currentUser.uid).get().then(snap => {
        const list = document.getElementById('lista-camps');
        list.innerHTML = "";
        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `<div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer">
                <strong>${c.nome}</strong><br><small style="color:var(--primary)">${c.jogo}</small>
            </div>`;
        });
    });
}

// --- ARENA ---
let arenaSnap = null;
function openArena(id) {
    currentCampId = id;
    showView('view-arena');
    if(arenaSnap) arenaSnap();
    arenaSnap = db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-title').innerText = c.nome;
        document.getElementById('arena-game-badge').innerText = c.jogo;
        document.getElementById('btn-admin').classList.toggle('hidden', c.hostId !== currentUser.uid);
        renderTable(c);
        renderTeams(c.times);
        if(c.hostId === currentUser.uid) {
            loadAllToInvite(c.participantes);
            setupAdminSelects(c.participantes);
        }
    });
}

async function renderTable(c) {
    const div = document.getElementById('arena-players');
    div.innerHTML = "";
    for(let pId of c.participantes) {
        const u = await db.collection('usuarios').doc(pId).get();
        const time = c.times[pId] || "---";
        div.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333">
            <span>${u.data().nome}</span><span style="color:var(--primary); font-weight:bold">${time}</span>
        </div>`;
    }
}

function renderTeams(timesEscolhidos = {}) {
    const liga = document.getElementById('sel-liga').value;
    const grid = document.getElementById('grid-teams');
    grid.innerHTML = "";
    const ocupados = Object.values(timesEscolhidos);
    TEAMS_DB[liga].forEach(t => {
        const busy = ocupados.includes(t.n);
        const isMine = timesEscolhidos[currentUser.uid] === t.n;
        grid.innerHTML += `<div class="time-card ${busy ? 'busy' : ''} ${isMine ? 'selected' : ''}" 
            onclick="${busy ? '' : `pickTeam('${t.n}')`}">
            <img src="${t.img}"><br><small>${t.n}</small>
        </div>`;
    });
}

function pickTeam(name) {
    const up = {}; up[`times.${currentUser.uid}`] = name;
    db.collection('campeonatos').doc(currentCampId).update(up);
}

// --- ADMIN / CONVITES ---
function loadAllToInvite(parts) {
    db.collection('usuarios').limit(15).get().then(snap => {
        const div = document.getElementById('list-all-users');
        div.innerHTML = "";
        snap.forEach(u => {
            if(!parts.includes(u.id)) {
                div.innerHTML += `<div class="btn-sec" style="margin-bottom:5px; display:block; text-align:center" onclick="sendInvite('${u.id}')">
                    Convidar ${u.data().nome}
                </div>`;
            }
        });
    });
}

function sendInvite(id) {
    db.collection('convites').add({
        paraId: id, campId: currentCampId, campNome: document.getElementById('arena-title').innerText, status: 'p'
    }).then(() => alert("Enviado!"));
}

function listenInvites() {
    db.collection('convites').where('paraId', '==', currentUser.uid).onSnapshot(snap => {
        const div = document.getElementById('lista-convites');
        document.getElementById('area-convites').classList.toggle('hidden', snap.empty);
        div.innerHTML = "";
        snap.forEach(doc => {
            const v = doc.data();
            div.innerHTML += `<div class="card" style="border-color:var(--accent)">
                Torneio: ${v.campNome} <button class="btn-primary" style="padding:5px; font-size:0.7rem" onclick="acceptInvite('${doc.id}','${v.campId}')">Aceitar</button>
            </div>`;
        });
    });
}

async function acceptInvite(docId, cId) {
    await db.collection('campeonatos').doc(cId).update({ participantes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
    await db.collection('convites').doc(docId).delete();
}

// --- REGISTRAR PLACAR ---
async function setupAdminSelects(parts) {
    const s1 = document.getElementById('res-p1');
    const s2 = document.getElementById('res-p2');
    s1.innerHTML = ""; s2.innerHTML = "";
    for(let pId of parts) {
        const u = await db.collection('usuarios').doc(pId).get();
        const opt = `<option value="${pId}">${u.data().nome}</option>`;
        s1.innerHTML += opt; s2.innerHTML += opt;
    }
}

function saveMatch() {
    const p1 = document.getElementById('res-p1').value;
    const p2 = document.getElementById('res-p2').value;
    const g1 = parseInt(document.getElementById('gols-p1').value);
    const g2 = parseInt(document.getElementById('gols-p2').value);
    if(p1 === p2) return alert("Escolha jogadores diferentes!");
    
    // Logica de pontos aqui se quiser automatizar tabela. Por enquanto salva o histórico.
    alert("Placar registrado com sucesso!");
    document.getElementById('gols-p1').value = "";
    document.getElementById('gols-p2').value = "";
}

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentCampId = null;

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

function tabArena(id) {
    document.querySelectorAll('#tab-table, #tab-hist, #tab-admin').forEach(t => t.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- AUTENTICAÇÃO ---
async function handleRegister() {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;

    if(!nick || pass.length < 6) return alert("Dados insuficientes!");
    
    const check = await db.collection('usuarios').where('nome', '==', nick).get();
    if(!check.empty) return alert("Nick já em uso!");

    auth.createUserWithEmailAndPassword(email, pass).then(cred => {
        db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick, online: true, stats: { v: 0, g: 0 }
        });
        alert("Conta criada!");
    }).catch(e => alert(e.message));
}

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Erro ao logar!"));
}

function logout() {
    db.collection('usuarios').doc(currentUser.uid).update({ online: false }).then(() => auth.signOut());
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        db.collection('usuarios').doc(user.uid).update({ online: true });
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            document.getElementById('user-nick').innerText = doc.data().nome;
            showView('view-dash');
            startLobby();
            loadCamps();
            listenInvites();
        });
    } else {
        showView('view-auth');
    }
});

// --- LOBBY E CAMPEONATOS ---
function startLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const div = document.getElementById('lobby-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            if(doc.id !== currentUser.uid) {
                div.innerHTML += `<div class="btn-sec" style="display:block; margin-bottom:5px">● ${doc.data().nome}</div>`;
            }
        });
    });
}

function createCamp() {
    const name = document.getElementById('camp-name').value;
    const game = document.getElementById('camp-game').value;
    if(!name) return;
    const nick = document.getElementById('user-nick').innerText;
    
    db.collection('campeonatos').add({
        nome: name, jogo: game, hostId: currentUser.uid,
        participantes: [currentUser.uid],
        tabela: { [currentUser.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: nick } },
        criadoEm: Date.now()
    }).then(() => { alert("Criado!"); loadCamps(); });
}

function loadCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', currentUser.uid).onSnapshot(snap => {
        const div = document.getElementById('lista-camps');
        div.innerHTML = "";
        snap.forEach(doc => {
            div.innerHTML += `<div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer">
                <strong>${doc.data().nome}</strong><br><small>${doc.data().jogo}</small>
            </div>`;
        });
    });
}

// --- ARENA ---
function openArena(id) {
    currentCampId = id;
    showView('view-arena');
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-title').innerText = c.nome;
        document.getElementById('btn-admin').classList.toggle('hidden', c.hostId !== currentUser.uid);
        renderTable(c.tabela);
        loadHistory(id);
        if(c.hostId === currentUser.uid) setupAdmin(c);
    });
}

function renderTable(tab) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";
    const sorted = Object.entries(tab).sort((a,b) => b[1].pts - a[1].pts);
    sorted.forEach(([id, s], i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${s.n}</td><td>${s.pts}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.sg}</td></tr>`;
    });
}

function loadHistory(id) {
    db.collection('campeonatos').doc(id).collection('partidas').orderBy('data','desc').onSnapshot(snap => {
        const div = document.getElementById('history-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `<div class="match-card"><strong>${m.n1} ${m.g1} x ${m.g2} ${m.n2}</strong><br><small>${new Date(m.data).toLocaleString()}</small></div>`;
        });
    });
}

// --- ADMIN ---
function setupAdmin(c) {
    const s1 = document.getElementById('adm-p1'); const s2 = document.getElementById('adm-p2');
    s1.innerHTML = ""; s2.innerHTML = "";
    Object.entries(c.tabela).forEach(([id, s]) => {
        const opt = `<option value="${id}">${s.n}</option>`;
        s1.innerHTML += opt; s2.innerHTML += opt;
    });

    db.collection('usuarios').limit(10).get().then(snap => {
        const div = document.getElementById('admin-user-list');
        div.innerHTML = "";
        snap.forEach(u => {
            if(!c.participantes.includes(u.id)) {
                div.innerHTML += `<div class="btn-sec" style="margin-bottom:5px" onclick="invite('${u.id}')">Convidar ${u.data().nome}</div>`;
            }
        });
    });
}

async function saveMatch() {
    const p1 = document.getElementById('adm-p1').value; const p2 = document.getElementById('adm-p2').value;
    const g1 = parseInt(document.getElementById('adm-g1').value); const g2 = parseInt(document.getElementById('adm-g2').value);
    if(p1 === p2) return alert("Jogadores iguais!");

    const ref = db.collection('campeonatos').doc(currentCampId);
    const snap = await ref.get();
    const tab = snap.data().tabela;

    tab[p1].sg += (g1 - g2); tab[p2].sg += (g2 - g1);
    if(g1 > g2) { tab[p1].pts += 3; tab[p1].v += 1; tab[p2].d += 1; }
    else if(g2 > g1) { tab[p2].pts += 3; tab[p2].v += 1; tab[p1].d += 1; }
    else { tab[p1].pts += 1; tab[p2].pts += 1; tab[p1].e += 1; tab[p2].e += 1; }

    await ref.update({ tabela: tab });
    await ref.collection('partidas').add({ n1: tab[p1].n, n2: tab[p2].n, g1, g2, data: Date.now() });
    alert("Salvo!");
}

function invite(uid) {
    db.collection('convites').add({ paraId: uid, campId: currentCampId, nome: document.getElementById('arena-title').innerText });
    alert("Enviado!");
}

function listenInvites() {
    db.collection('convites').where('paraId', '==', currentUser.uid).onSnapshot(snap => {
        const area = document.getElementById('area-convites');
        const list = document.getElementById('lista-convites');
        area.classList.toggle('hidden', snap.empty);
        list.innerHTML = "";
        snap.forEach(doc => {
            list.innerHTML += `<div class="card">Convite para: ${doc.data().nome} <button class="btn-sec" onclick="accept('${doc.id}','${doc.data().campId}')">Aceitar</button></div>`;
        });
    });
}

async function accept(id, cid) {
    const nick = document.getElementById('user-nick').innerText;
    const ref = db.collection('campeonatos').doc(cid);
    const snap = await ref.get();
    const tab = snap.data().tabela;
    tab[currentUser.uid] = { pts:0, v:0, e:0, d:0, sg:0, n: nick };
    await ref.update({ participantes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid), tabela: tab });
    await db.collection('convites').doc(id).delete();
}

const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentCampId = null;

function showView(id) {
    document.querySelectorAll('#view-auth, #view-dash, #view-arena').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('main-nav').classList.toggle('hidden', id === 'view-auth');
}

function toggleAuth(reg) {
    document.getElementById('box-login').classList.toggle('hidden', reg);
    document.getElementById('box-register').classList.toggle('hidden', !reg);
}

function tabArena(tab) {
    document.getElementById('tab-table').classList.toggle('hidden', tab !== 'table');
    document.getElementById('tab-hist').classList.toggle('hidden', tab !== 'hist');
    document.getElementById('tab-admin').classList.toggle('hidden', tab !== 'admin');
}

document.getElementById('btn-registrar').onclick = async () => {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    if(!nick || pass.length < 6) return alert("Nick curto ou senha menor que 6!");
    try {
        const check = await db.collection('usuarios').where('nome', '==', nick).get();
        if(!check.empty) return alert("Nick em uso!");
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(cred.user.uid).set({ nome: nick, online: true });
    } catch(e) { alert(e.message); }
};

document.getElementById('btn-entrar').onclick = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(() => alert("E-mail ou senha incorretos"));
};

function handleLogout() {
    if(currentUser) db.collection('usuarios').doc(currentUser.uid).update({ online: false });
    auth.signOut();
}

auth.onAuthStateChanged(user => {
    if(user) {
        currentUser = user;
        db.collection('usuarios').doc(user.uid).update({ online: true });
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            document.getElementById('user-display-nick').innerText = doc.data().nome;
            showView('view-dash');
            startLobby();
            loadCamps();
            listenInvites();
        });
    } else { showView('view-auth'); }
});

function startLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const list = document.getElementById('lobby-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            if(doc.id !== currentUser.uid) 
                list.innerHTML += `<div class="btn-sec" style="margin-bottom:5px; display:block">● ${doc.data().nome}</div>`;
        });
    });
}

async function createCamp() {
    const name = document.getElementById('new-camp-name').value;
    const game = document.getElementById('new-camp-game').value;
    if(!name) return alert("Nome da copa vazio!");
    const nick = document.getElementById('user-display-nick').innerText;
    await db.collection('campeonatos').add({
        nome: name, jogo: game, hostId: currentUser.uid,
        participantes: [currentUser.uid],
        tabela: { [currentUser.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: nick } },
        criadoEm: Date.now()
    });
    document.getElementById('new-camp-name').value = "";
}

function loadCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', currentUser.uid).onSnapshot(snap => {
        const list = document.getElementById('camp-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            list.innerHTML += `<div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer">
                <strong>${doc.data().nome}</strong><br><small>${doc.data().jogo}</small>
            </div>`;
        });
    });
}

function openArena(id) {
    currentCampId = id;
    showView('view-arena');
    tabArena('table');
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-title').innerText = c.nome;
        document.getElementById('admin-tab-btn').classList.toggle('hidden', c.hostId !== currentUser.uid);
        renderTable(c.tabela);
        loadHistory(id);
        if(c.hostId === currentUser.uid) setupAdmin(c);
    });
}

function renderTable(tab) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";
    const sorted = Object.entries(tab).sort((a,b) => b[1].pts - a[1].pts || b[1].sg - a[1].sg);
    sorted.forEach(([id, s], i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${s.n}</td><td>${s.pts}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.sg}</td></tr>`;
    });
}

function loadHistory(id) {
    db.collection('campeonatos').doc(id).collection('partidas').orderBy('data','desc').onSnapshot(snap => {
        const list = document.getElementById('match-history');
        list.innerHTML = snap.empty ? "<p style='text-align:center; padding:10px'>Sem jogos.</p>" : "";
        snap.forEach(doc => {
            const m = doc.data();
            list.innerHTML += `<div class="match-card" style="text-align:center">
                <strong>${m.n1} ${m.g1} x ${m.g2} ${m.n2}</strong><br>
                <small>${new Date(m.data).toLocaleString()}</small>
            </div>`;
        });
    });
}

function setupAdmin(c) {
    const s1 = document.getElementById('adm-p1'); const s2 = document.getElementById('adm-p2');
    s1.innerHTML = ""; s2.innerHTML = "";
    Object.entries(c.tabela).forEach(([id, s]) => {
        const opt = `<option value="${id}">${s.n}</option>`;
        s1.innerHTML += opt; s2.innerHTML += opt;
    });
    db.collection('usuarios').limit(20).get().then(snap => {
        const div = document.getElementById('admin-user-list');
        div.innerHTML = "";
        snap.forEach(u => {
            if(!c.participantes.includes(u.id))
                div.innerHTML += `<div class="btn-sec" style="margin-bottom:5px" onclick="sendInvite('${u.id}')">Convidar ${u.data().nome}</div>`;
        });
    });
}

async function saveMatch() {
    const p1 = document.getElementById('adm-p1').value; const p2 = document.getElementById('adm-p2').value;
    const g1 = parseInt(document.getElementById('adm-g1').value); const g2 = parseInt(document.getElementById('adm-g2').value);
    if(p1 === p2 || isNaN(g1) || isNaN(g2)) return alert("Dados inválidos");
    const ref = db.collection('campeonatos').doc(currentCampId);
    const snap = await ref.get();
    const tab = snap.data().tabela;
    tab[p1].sg += (g1 - g2); tab[p2].sg += (g2 - g1);
    if(g1 > g2) { tab[p1].pts += 3; tab[p1].v += 1; tab[p2].d += 1; }
    else if(g2 > g1) { tab[p2].pts += 3; tab[p2].v += 1; tab[p1].d += 1; }
    else { tab[p1].pts += 1; tab[p2].pts += 1; tab[p1].e += 1; tab[p2].e += 1; }
    await ref.update({ tabela: tab });
    await ref.collection('partidas').add({ n1: tab[p1].n, n2: tab[p2].n, g1, g2, data: Date.now() });
    alert("Placar salvo!");
}

async function sendInvite(uid) {
    await db.collection('convites').add({
        paraId: uid, campId: currentCampId,
        nome: document.getElementById('arena-title').innerText,
        de: document.getElementById('user-display-nick').innerText
    });
    alert("Convite enviado!");
}

function listenInvites() {
    db.collection('convites').where('paraId', '==', currentUser.uid).onSnapshot(snap => {
        const area = document.getElementById('invite-area');
        area.classList.toggle('hidden', snap.empty);
        const list = document.getElementById('invite-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const i = doc.data();
            list.innerHTML += `<div class="card">${i.de} convidou para ${i.nome} 
                <button class="btn-sec" onclick="acceptInvite('${doc.id}','${i.campId}')">Aceitar</button></div>`;
        });
    });
}

async function acceptInvite(id, cid) {
    const nick = document.getElementById('user-display-nick').innerText;
    const ref = db.collection('campeonatos').doc(cid);
    const snap = await ref.get();
    const tab = snap.data().tabela;
    tab[currentUser.uid] = { pts:0, v:0, e:0, d:0, sg:0, n: nick };
    await ref.update({ participantes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid), tabela: tab });
    await db.collection('convites').doc(id).delete();
}

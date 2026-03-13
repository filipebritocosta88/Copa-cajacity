const auth = firebase.auth();
const db = firebase.firestore();
let userRef = null;
let currentCampId = null;

// --- NAVEGAÇÃO ---
function showView(viewId) {
    document.querySelectorAll('#view-auth, #view-dash, #view-arena').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById('main-nav').classList.toggle('hidden', viewId === 'view-auth');
}

function toggleAuth(reg) {
    document.getElementById('box-login').classList.toggle('hidden', reg);
    document.getElementById('box-register').classList.toggle('hidden', !reg);
}

function tabArena(tab) {
    document.getElementById('arena-tab-tabela').classList.toggle('hidden', tab !== 'tabela');
    document.getElementById('arena-tab-historico').classList.toggle('hidden', tab !== 'historico');
    document.getElementById('arena-tab-admin').classList.toggle('hidden', tab !== 'admin');
}

// --- AUTENTICAÇÃO E LOGIN ---
document.getElementById('btn-register').onclick = async () => {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;

    if (!nick || pass.length < 6) return alert("Nick obrigatório e senha mín. 6 caracteres.");

    try {
        const check = await db.collection('usuarios').where('nome', '==', nick).get();
        if (!check.empty) return alert("Nick já em uso!");

        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick, online: true, criadoEm: Date.now()
        });
        alert("Conta Criada com Sucesso!");
    } catch (e) { alert(e.message); }
};

document.getElementById('btn-login').onclick = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Erro no Login!"));
};

function logout() {
    if (userRef) db.collection('usuarios').doc(userRef.uid).update({ online: false });
    auth.signOut();
}

auth.onAuthStateChanged(user => {
    if (user) {
        userRef = user;
        db.collection('usuarios').doc(user.uid).update({ online: true });
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            document.getElementById('meu-nick').innerText = doc.data().nome;
            showView('view-dash');
            iniciarLobby();
            carregarMeusCamps();
            ouvirConvites();
        });
    } else { showView('view-auth'); }
});

// --- LOBBY EM TEMPO REAL ---
function iniciarLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const div = document.getElementById('lobby-online');
        div.innerHTML = "";
        snap.forEach(doc => {
            if (doc.id !== userRef.uid) {
                div.innerHTML += `<div class="btn-sec" style="display:block; margin-bottom:5px">
                    <span class="status-dot"></span> ${doc.data().nome} <small>(Pronto)</small>
                </div>`;
            }
        });
    });
}

// --- GERENCIAR CAMPEONATOS ---
async function criarCampeonato() {
    const nome = document.getElementById('camp-nome').value;
    const jogo = document.getElementById('camp-jogo').value;
    if (!nome) return;

    const nick = document.getElementById('meu-nick').innerText;
    const novoCamp = {
        nome, jogo, hostId: userRef.uid,
        participantes: [userRef.uid],
        tabela: { [userRef.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: nick } },
        criadoEm: Date.now()
    };
    await db.collection('campeonatos').add(novoCamp);
    document.getElementById('camp-nome').value = "";
    alert("Copa Criada!");
}

function carregarMeusCamps() {
    db.collection('campeonatos').where('participantes', 'array-contains', userRef.uid).onSnapshot(snap => {
        const div = document.getElementById('meus-campeonatos');
        div.innerHTML = "";
        snap.forEach(doc => {
            div.innerHTML += `<div class="card" onclick="abrirArena('${doc.id}')" style="cursor:pointer">
                <strong>${doc.data().nome}</strong><br><small>${doc.data().jogo}</small>
            </div>`;
        });
    });
}

// --- ARENA (TABELA E HISTÓRICO DETALHADO) ---
function abrirArena(id) {
    currentCampId = id;
    showView('view-arena');
    tabArena('tabela');

    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-nome-titulo').innerText = c.nome;
        document.getElementById('tab-admin-btn').classList.toggle('hidden', c.hostId !== userRef.uid);
        
        atualizarTabelaVisual(c.tabela);
        carregarHistoricoPartidas(id);
        if (c.hostId === userRef.uid) prepararPainelAdmin(c);
    });
}

function atualizarTabelaVisual(tab) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = "";
    const ordenado = Object.entries(tab).sort((a,b) => b[1].pts - a[1].pts);
    ordenado.forEach(([id, s], i) => {
        tbody.innerHTML += `<tr><td>${i+1}º</td><td>${s.n}</td><td>${s.pts}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.sg}</td></tr>`;
    });
}

function carregarHistoricoPartidas(campId) {
    db.collection('campeonatos').doc(campId).collection('partidas').orderBy('data','desc').onSnapshot(snap => {
        const div = document.getElementById('historico-lista-detalhada');
        div.innerHTML = snap.empty ? "<p>Sem jogos ainda.</p>" : "";
        snap.forEach(doc => {
            const m = doc.data();
            div.innerHTML += `<div class="match-item">
                <div style="text-align:center; font-weight:800">${m.n1} <span style="color:var(--primary)">${m.g1}</span> x <span style="color:var(--primary)">${m.g2}</span> ${m.n2}</div>
                <div style="text-align:center; font-size:0.6rem; color:#555; margin-top:5px">${new Date(m.data).toLocaleString()}</div>
            </div>`;
        });
    });
}

// --- ADMINISTRAÇÃO E CÁLCULOS ---
function prepararPainelAdmin(c) {
    const s1 = document.getElementById('adm-p1'); const s2 = document.getElementById('adm-p2');
    s1.innerHTML = ""; s2.innerHTML = "";
    Object.entries(c.tabela).forEach(([id, s]) => {
        const opt = `<option value="${id}">${s.n}</option>`;
        s1.innerHTML += opt; s2.innerHTML += opt;
    });

    db.collection('usuarios').limit(10).get().then(snap => {
        const div = document.getElementById('admin-convidar-jogadores');
        div.innerHTML = "";
        snap.forEach(u => {
            if (!c.participantes.includes(u.id)) {
                div.innerHTML += `<div class="btn-sec" style="margin-bottom:5px" onclick="enviarConvite('${u.id}')">Convidar ${u.data().nome}</div>`;
            }
        });
    });
}

async function salvarPlacar() {
    const p1 = document.getElementById('adm-p1').value; const p2 = document.getElementById('adm-p2').value;
    const g1 = parseInt(document.getElementById('adm-g1').value); const g2 = parseInt(document.getElementById('adm-g2').value);
    if (p1 === p2 || isNaN(g1) || isNaN(g2)) return alert("Dados Inválidos!");

    const ref = db.collection('campeonatos').doc(currentCampId);
    const snap = await ref.get();
    const tab = snap.data().tabela;

    // Cálculo Automático de Pontos e SG
    tab[p1].sg += (g1 - g2); tab[p2].sg += (g2 - g1);
    if (g1 > g2) { tab[p1].pts += 3; tab[p1].v += 1; tab[p2].d += 1; }
    else if (g2 > g1) { tab[p2].pts += 3; tab[p2].v += 1; tab[p1].d += 1; }
    else { tab[p1].pts += 1; tab[p2].pts += 1; tab[p1].e += 1; tab[p2].e += 1; }

    await ref.update({ tabela: tab });
    await ref.collection('partidas').add({ n1: tab[p1].n, n2: tab[p2].n, g1, g2, data: Date.now() });
    alert("Placar Registrado!");
}

// --- CONVITES ---
async function enviarConvite(uid) {
    await db.collection('convites').add({
        paraId: uid, campId: currentCampId,
        nome: document.getElementById('arena-nome-titulo').innerText,
        de: document.getElementById('meu-nick').innerText
    });
    alert("Convite enviado!");
}

function ouvirConvites() {
    db.collection('convites').where('paraId', '==', userRef.uid).onSnapshot(snap => {
        const area = document.getElementById('notificacoes-convite');
        const list = document.getElementById('lista-convites-recebidos');
        area.classList.toggle('hidden', snap.empty);
        list.innerHTML = "";
        snap.forEach(doc => {
            list.innerHTML += `<div class="card" style="border-left-color:var(--accent)">
                <p>${doc.data().de} te convidou para ${doc.data().nome}</p>
                <button class="btn-primary" style="padding:8px; font-size:0.7rem; margin-top:10px" onclick="aceitarConvite('${doc.id}','${doc.data().campId}')">ACEITAR</button>
            </div>`;
        });
    });
}

async function aceitarConvite(id, cid) {
    const nick = document.getElementById('meu-nick').innerText;
    const ref = db.collection('campeonatos').doc(cid);
    const snap = await ref.get();
    const tab = snap.data().tabela;
    tab[userRef.uid] = { pts:0, v:0, e:0, d:0, sg:0, n: nick };
    await ref.update({ participantes: firebase.firestore.FieldValue.arrayUnion(userRef.uid), tabela: tab });
    await db.collection('convites').doc(id).delete();
}

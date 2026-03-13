const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;
let pendingInvite = null;
let selectedTeam = null;

const TEAMS = [
    {n: 'Real Madrid', img: 'https://cdn-icons-png.flaticon.com/512/824/824740.png'},
    {n: 'Barcelona', img: 'https://cdn-icons-png.flaticon.com/512/824/824727.png'},
    {n: 'Flamengo', img: 'https://cdn-icons-png.flaticon.com/512/824/824716.png'},
    {n: 'Manchester City', img: 'https://cdn-icons-png.flaticon.com/512/824/824733.png'},
    {n: 'Liverpool', img: 'https://cdn-icons-png.flaticon.com/512/824/824730.png'},
    {n: 'PSG', img: 'https://cdn-icons-png.flaticon.com/512/824/824738.png'},
    {n: 'Bayern', img: 'https://cdn-icons-png.flaticon.com/512/824/824729.png'},
    {n: 'Brasil', img: 'https://cdn-icons-png.flaticon.com/512/197/197386.png'}
];

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
            document.getElementById('user-nick-display').innerText = me.nome;
            if(me.foto) document.getElementById('user-avatar-display').style.backgroundImage = `url(${me.foto})`;
            document.getElementById('auth-area').classList.add('hidden');
            document.getElementById('app-area').classList.remove('hidden');
            initApp();
        });
    } else {
        document.getElementById('auth-area').classList.remove('hidden');
        document.getElementById('app-area').classList.add('hidden');
    }
});

function toggleAuth(t) {
    document.getElementById('screen-login').classList.toggle('hidden', t === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', t === 'login');
}

function doLogin() {
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value);
}

async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const res = await auth.createUserWithEmailAndPassword(document.getElementById('r-email').value, document.getElementById('r-pass').value);
    await db.collection('usuarios').doc(res.user.uid).set({ nome: n, online: true, stats: {vit:0, der:0}, foto: '' });
}

function initApp() {
    loadLobby();
    loadCopas();
    listenInvites();
}

function changeTab(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    el.classList.add('active');
}

// --- LOBBY ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        const list = document.getElementById('lobby-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            list.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center">
                    <div style="display:flex; align-items:center; gap:10px">
                        <div style="width:30px; height:30px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover"></div>
                        <div style="font-size:0.8rem; font-weight:800">${p.nome} ${p.online ? '🟢' : '⚪'}</div>
                    </div>
                    ${doc.id !== me.uid ? `<button class="btn-glow" style="width:auto; padding:5px 12px; font-size:0.6rem" onclick="sendInvite('${doc.id}')">CONVIDAR</button>` : ''}
                </div>`;
        });
    });
}

// --- CONVITES INTELIGENTES ---
async function sendInvite(pid) {
    if(!currentCid) return alert("Abra uma Copa na Arena primeiro!");
    // Evita acumular convites: apenas atualiza o status se já existir um pendente
    await db.collection('convites').doc(`${me.uid}_${pid}`).set({
        para: pid, deNick: me.nome, deFoto: me.foto, cid: currentCid, status: 'p', t: Date.now()
    });
    alert("Convite enviado!");
}

function listenInvites() {
    db.collection('convites').where('para', '==', me.uid).where('status', '==', 'p').onSnapshot(snap => {
        if(!snap.empty) {
            const invite = snap.docs[0].data();
            pendingInvite = { id: snap.docs[0].id, ...invite };
            document.getElementById('inv-nick').innerText = invite.deNick;
            document.getElementById('inv-img').style.backgroundImage = `url(${invite.deFoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'})`;
            document.getElementById('invite-popup').classList.add('show');
        }
    });
}

function acceptInvite() {
    document.getElementById('invite-popup').classList.remove('show');
    db.collection('convites').doc(pendingInvite.id).update({ status: 'a' });
    openTeamSelector(pendingInvite.cid);
}

function refuseInvite() {
    document.getElementById('invite-popup').classList.remove('show');
    db.collection('convites').doc(pendingInvite.id).update({ status: 'r' });
}

// --- ESCOLHA DE TIME ---
function openTeamSelector(cid) {
    currentCid = cid;
    document.getElementById('modal-team').classList.remove('hidden');
    const list = document.getElementById('teams-list');
    list.innerHTML = TEAMS.map((t, i) => `
        <div class="team-opt" onclick="selectTeam(${i}, this)">
            <img src="${t.img}" alt="${t.n}">
        </div>
    `).join('');
}

function selectTeam(i, el) {
    selectedTeam = TEAMS[i];
    document.querySelectorAll('.team-opt').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
}

async function confirmTeamSelection() {
    if(!selectedTeam) return alert("Escolha um time!");
    await db.collection('campeonatos').doc(currentCid).update({
        p: firebase.firestore.FieldValue.arrayUnion(me.uid),
        [`tabela.${me.uid}`]: { pts:0, v:0, e:0, d:0, n:me.nome, time: selectedTeam.n, escudo: selectedTeam.img }
    });
    document.getElementById('modal-team').classList.add('hidden');
    openArena(currentCid);
}

// --- COPAS E ARENA ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, n:me.nome, time: '---', escudo: '' } },
        jogos: [], data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        const div = document.getElementById('copas-list');
        div.innerHTML = "";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `<div class="card" onclick="openArena('${doc.id}')">${c.nome} <small>(${c.p.length} jogadores)</small></div>`;
        });
    });
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        if(!doc.exists) return;
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2>${c.nome}</h2><small>${c.p.length} Players</small>`;
        switchArena('tabela');
    });
}

function switchArena(mode) {
    const content = document.getElementById('arena-content');
    db.collection('campeonatos').doc(currentCid).get().then(doc => {
        const c = doc.data();
        if(mode === 'tabela') {
            let h = `<table style="width:100%; text-align:center; font-size:0.75rem">
                <tr><th>#</th><th>ESCUDO</th><th>PLAY</th><th>P</th></tr>`;
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts);
            sorted.forEach(([uid, s], i) => {
                h += `<tr><td>${i+1}</td><td><img src="${s.escudo}" style="width:20px"></td><td>${s.n}</td><td style="color:var(--primary)">${s.pts}</td></tr>`;
            });
            content.innerHTML = h + `</table>`;
        } else if(mode === 'jogos') {
            if(c.jogos.length === 0) {
                content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="startTournament()">GERAR CONFRONTOS</button>` : `<p>Aguardando sorteio...</p>`;
            } else {
                content.innerHTML = c.jogos.map((j, idx) => `
                    <div class="match-row">
                        <div class="match-team"><img src="${c.tabela[j.p1].escudo}"> ${j.n1}</div>
                        <div class="match-score" onclick="editMatch(${idx})">${j.g1 ?? 'V'} x ${j.g2 ?? 'S'}</div>
                        <div class="match-team"><img src="${c.tabela[j.p2].escudo}"> ${j.n2}</div>
                    </div>`).join('');
            }
        } else {
            content.innerHTML = `<button class="btn-glow" style="background:var(--danger); color:#000" onclick="deleteCopa()">EXCLUIR COPA</button>`;
        }
    });
}

async function startTournament() {
    document.getElementById('sorteio-overlay').classList.remove('hidden');
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const p = c.p;
    let jogos = [];
    for(let i=0; i<p.length; i++){
        for(let j=i+1; j<p.length; j++){
            jogos.push({p1: p[i], p2: p[j], n1: c.tabela[p[i]].n, n2: c.tabela[p[j]].n, g1: null, g2: null});
        }
    }
    setTimeout(() => {
        db.collection('campeonatos').doc(currentCid).update({ jogos, status: 'ativo' });
        document.getElementById('sorteio-overlay').classList.add('hidden');
    }, 2000);
}

async function editMatch(idx) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    if(c.host !== me.uid) return alert("Apenas o host edita o placar!");

    const g1 = prompt(`Gols de ${c.jogos[idx].n1}:`);
    const g2 = prompt(`Gols de ${c.jogos[idx].n2}:`);
    if(g1 === null || g2 === null) return;

    c.jogos[idx].g1 = parseInt(g1);
    c.jogos[idx].g2 = parseInt(g2);
    
    // Atualiza tabela
    const p1 = c.tabela[c.jogos[idx].p1];
    const p2 = c.tabela[c.jogos[idx].p2];
    if(g1 > g2) p1.pts += 3; else if(g2 > g1) p2.pts += 3; else { p1.pts++; p2.pts++; }

    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos, tabela: c.tabela });
}

const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;
let selectedTeam = null;
let pendingInvite = null;

const TEAMS = [
    {n: 'Real Madrid', img: 'https://cdn-icons-png.flaticon.com/512/824/824740.png'},
    {n: 'Barcelona', img: 'https://cdn-icons-png.flaticon.com/512/824/824727.png'},
    {n: 'Man. City', img: 'https://cdn-icons-png.flaticon.com/512/824/824733.png'},
    {n: 'Liverpool', img: 'https://cdn-icons-png.flaticon.com/512/824/824730.png'},
    {n: 'Bayern', img: 'https://cdn-icons-png.flaticon.com/512/824/824729.png'},
    {n: 'PSG', img: 'https://cdn-icons-png.flaticon.com/512/824/824738.png'},
    {n: 'Flamengo', img: 'https://cdn-icons-png.flaticon.com/512/824/824716.png'},
    {n: 'Brasil', img: 'https://cdn-icons-png.flaticon.com/512/197/197386.png'}
];

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
            document.getElementById('u-name').innerText = me.nome;
            document.getElementById('u-avatar').style.backgroundImage = `url(${me.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'})`;
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
    const nick = document.getElementById('r-nick').value;
    const res = await auth.createUserWithEmailAndPassword(document.getElementById('r-email').value, document.getElementById('r-pass').value);
    await db.collection('usuarios').doc(res.user.uid).set({ nome: nick, online: true, stats: {vit: 0, der:0}, foto: '' });
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

// --- LOBBY & CONVITES ---
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
                        <span style="font-size:0.8rem; font-weight:700">${p.nome} ${p.online ? '🟢' : '⚪'}</span>
                    </div>
                    ${doc.id !== me.uid ? `<button class="btn-glow" style="width:auto; padding:5px 12px; font-size:0.6rem" onclick="sendInvite('${doc.id}')">CONVIDAR</button>` : ''}
                </div>`;
        });
    });
}

async function sendInvite(pid) {
    if(!currentCid) return alert("Selecione uma Copa na Arena!");
    await db.collection('convites').doc(`${me.uid}_${pid}`).set({
        para: pid, deNick: me.nome, deFoto: me.foto, cid: currentCid, status: 'p', t: Date.now()
    });
    alert("Convite enviado!");
}

function listenInvites() {
    db.collection('convites').where('para', '==', me.uid).where('status', '==', 'p').onSnapshot(snap => {
        if(!snap.empty) {
            pendingInvite = { id: snap.docs[0].id, ...snap.docs[0].data() };
            document.getElementById('inv-nick').innerText = pendingInvite.deNick;
            document.getElementById('inv-img').style.backgroundImage = `url(${pendingInvite.deFoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'})`;
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

// --- TIME ---
function openTeamSelector(cid) {
    currentCid = cid;
    document.getElementById('modal-team').classList.remove('hidden');
    const list = document.getElementById('teams-list');
    list.innerHTML = TEAMS.map((t, i) => `<div class="team-opt" onclick="selectTeam(${i}, this)"><img src="${t.img}"></div>`).join('');
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
        [`tabela.${me.uid}`]: { pts:0, v:0, e:0, d:0, gp:0, gc:0, sg:0, n:me.nome, time: selectedTeam.n, escudo: selectedTeam.img }
    });
    document.getElementById('modal-team').classList.add('hidden');
    openArena(currentCid);
}

// --- ARENA & TABELA ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    if(!n) return alert("Nome vazio!");
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, gp:0, gc:0, sg:0, n:me.nome, time: '---', escudo: '' } },
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
            div.innerHTML += `<div class="card" onclick="openArena('${doc.id}')" style="display:flex; justify-content:space-between">
                <span>${c.nome}</span> <small>${c.p.length} Players</small>
            </div>`;
        });
    });
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        if(!doc.exists) return;
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2 style="color:var(--primary)">${c.nome}</h2>`;
        switchArena('tabela');
    });
}

function switchArena(mode) {
    const content = document.getElementById('arena-content');
    db.collection('campeonatos').doc(currentCid).get().then(doc => {
        const c = doc.data();
        if(mode === 'tabela') {
            let h = `<table><tr><th>#</th><th>TIME</th><th>P</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>`;
            // Ordenação: Pontos > Vitórias > Saldo de Gols
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].v - a[1].v || b[1].sg - a[1].sg);
            sorted.forEach(([uid, s], i) => {
                h += `<tr>
                    <td>${i+1}</td>
                    <td style="text-align:left"><img src="${s.escudo}" style="width:18px; vertical-align:middle"> ${s.n}</td>
                    <td style="font-weight:800; color:var(--primary)">${s.pts}</td>
                    <td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.sg}</td>
                </tr>`;
            });
            content.innerHTML = h + `</table>`;
        } else if(mode === 'jogos') {
            if(c.jogos.length === 0) {
                content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="generateFixtures()">GERAR ORDEM DE JOGOS</button>` : `<p>Aguardando o Host...</p>`;
            } else {
                content.innerHTML = c.jogos.map((j, idx) => `
                    <div class="match-card">
                        <span class="game-num">PARTIDA #${idx+1}</span>
                        <div style="display:flex; justify-content:space-around; align-items:center">
                            <div style="width:35%"><img src="${c.tabela[j.p1].escudo}" style="width:20px"><br>${j.n1}</div>
                            <div style="background:#000; padding:10px; border-radius:10px; font-weight:800; cursor:pointer" onclick="editMatch(${idx})">
                                ${j.g1 ?? '-'} x ${j.g2 ?? '-'}
                            </div>
                            <div style="width:35%"><img src="${c.tabela[j.p2].escudo}" style="width:20px"><br>${j.n2}</div>
                        </div>
                    </div>`).join('');
            }
        } else if(mode === 'chave') {
            content.innerHTML = `<div class="bracket-container">
                <div style="font-size:0.6rem; color:var(--text-dim)">ROAD TO FINAL</div>
                <div class="bracket-match"><div class="bracket-team"><span>TBD</span><span>-</span></div><div class="bracket-team"><span>TBD</span><span>-</span></div></div>
                <div style="height:20px; border-left:2px solid #333"></div>
                <div class="bracket-match" style="border-color:gold"><div class="bracket-team"><span>FINALISTA 1</span></div><div class="bracket-team"><span>FINALISTA 2</span></div></div>
            </div><p style="text-align:center; font-size:0.7rem; margin-top:10px">Em desenvolvimento automático baseado nos resultados</p>`;
        }
    });
}

async function generateFixtures() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const p = c.p;
    let jogos = [];
    for(let i=0; i<p.length; i++){
        for(let j=i+1; j<p.length; j++){
            jogos.push({p1: p[i], p2: p[j], n1: c.tabela[p[i]].n, n2: c.tabela[p[j]].n, g1: null, g2: null});
        }
    }
    await db.collection('campeonatos').doc(currentCid).update({ jogos, status: 'ativo' });
}

async function editMatch(idx) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    if(c.host !== me.uid) return alert("Apenas o Host edita!");

    const g1 = parseInt(prompt(`Gols de ${c.jogos[idx].n1}:`));
    const g2 = parseInt(prompt(`Gols de ${c.jogos[idx].n2}:`));
    if(isNaN(g1) || isNaN(g2)) return;

    c.jogos[idx].g1 = g1;
    c.jogos[idx].g2 = g2;

    // Resetar e Re-calcular tabela para evitar erros de soma dupla
    Object.keys(c.tabela).forEach(k => {
        c.tabela[k].pts = 0; c.tabela[k].v = 0; c.tabela[k].e = 0; c.tabela[k].d = 0;
        c.tabela[k].gp = 0; c.tabela[k].gc = 0; c.tabela[k].sg = 0;
    });

    c.jogos.forEach(j => {
        if(j.g1 === null) return;
        const t1 = c.tabela[j.p1];
        const t2 = c.tabela[j.p2];
        t1.gp += j.g1; t1.gc += j.g2; t1.sg = t1.gp - t1.gc;
        t2.gp += j.g2; t2.gc += j.g1; t2.sg = t2.gp - t2.gc;

        if(j.g1 > j.g2) { t1.pts += 3; t1.v++; t2.d++; }
        else if(j.g2 > j.g1) { t2.pts += 3; t2.v++; t1.d++; }
        else { t1.pts++; t2.pts++; t1.e++; t2.e++; }
    });

    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos, tabela: c.tabela });
}

function takePrint() {
    html2canvas(document.querySelector("#print-area")).then(canvas => {
        const link = document.createElement('a');
        link.download = 'campeao-metasboard.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

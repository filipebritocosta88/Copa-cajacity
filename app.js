const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

// --- CLOCK DINÂMICO ---
setInterval(() => {
    const now = new Date();
    const d = now.toLocaleDateString('pt-BR');
    const t = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('live-clock');
    if(el) el.innerText = `${d} | ${t}`;
}, 1000);

// --- ENTER NO CHAT ---
document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMsg();
});

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
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

function initApp() {
    loadLobby();
    loadCopas();
    listenChat();
    db.collection('usuarios').doc(me.uid).update({ online: true });
}

function doLogin() {
    const e = document.getElementById('l-email').value;
    const p = document.getElementById('l-pass').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("Erro ao entrar: " + err.message));
}

async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const e = document.getElementById('r-email').value;
    const p = document.getElementById('r-pass').value;
    try {
        const res = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: n, online: true, foto: '', stats: { participacoes:0, titulos:0, v:0, e:0, d:0, gp:0, gs:0 }
        });
    } catch(err) { alert(err.message); }
}

// --- LOBBY & HISTÓRICO ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let players = [];
        snap.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        players.sort((a,b) => b.online - a.online);
        document.getElementById('lobby-list').innerHTML = players.map(p => `
            <div class="card" onclick="viewProfile('${p.id}')" style="display:flex; align-items:center; gap:15px; border-left: 4px solid ${p.online?'var(--divine-green)':'#333'}">
                <div style="width:45px; height:45px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover; border:2px solid #222;"></div>
                <div style="flex:1">
                    <div style="font-weight:800; font-size:1rem;">${p.nome}</div>
                    <div style="font-size:0.65rem; color:var(--neon-blue)">${p.stats.titulos} TÍTULOS | ${p.stats.v} VITÓRIAS</div>
                </div>
                <i class="fas fa-shield-halved" style="color:var(--primary); opacity:0.5"></i>
            </div>
        `).join('');
    });
}

async function viewProfile(id) {
    const doc = await db.collection('usuarios').doc(id).get();
    const p = doc.data();
    document.getElementById('prof-nick').innerText = p.nome;
    document.getElementById('prof-avatar').style.backgroundImage = `url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'})`;
    document.getElementById('prof-stats').innerHTML = `
        <div class="card" style="margin:0"><b>${p.stats.participacoes}</b><br><small>COPAS</small></div>
        <div class="card" style="margin:0; border-color:var(--primary)"><b>${p.stats.titulos}</b><br><small>TÍTULOS</small></div>
        <div class="card" style="margin:0"><b>${p.stats.v}</b><br><small>VITÓRIAS</small></div>
        <div class="card" style="margin:0"><b>${p.stats.gp}</b><br><small>GOLS PRÓ</small></div>
    `;
    document.getElementById('modal-profile').classList.remove('hidden');
}

// --- CORE CAMPEONATOS ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    if(!n) return alert("Dê um nome à Copa!");
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0, n:me.nome } },
        jogos: [], fase: 'inicial', data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card" onclick="openArena('${doc.id}')" style="background: linear-gradient(to right, #0a0c10, #111);">
                <b style="color:var(--primary); font-size:1.1rem">${doc.data().nome}</b>
                <div style="font-size:0.7rem; color:var(--neon-blue); margin-top:5px;">
                    <i class="fas fa-trophy"></i> ${doc.data().tipo.toUpperCase()} | <i class="fas fa-users"></i> ${doc.data().p.length} ATLETAS
                </div>
            </div>
        `).join('');
    });
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        if(!doc.exists) return;
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2 style="text-align:center; color:var(--primary); font-weight:900;">${c.nome}</h2>`;
        document.getElementById('btn-manage').classList.toggle('hidden', c.host !== me.uid);
        switchArena('tabela');
    });
}

async function switchArena(mode) {
    const content = document.getElementById('arena-content');
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();

    if(mode === 'tabela') {
        if(c.tipo === 'mata') {
            content.innerHTML = `<div class="phase-title">${c.fase.toUpperCase()}</div><div class="bracket-container" id="bracket-view"></div>`;
            renderBracket(c);
        } else {
            let h = `<table style="width:100%; text-align:left;"><tr><th>PLAYER</th><th>P</th><th>V</th><th>SG</th></tr>`;
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].v - a[1].v || b[1].sg - a[1].sg);
            sorted.forEach(([id, s]) => {
                h += `<tr style="border-bottom:1px solid #111;"><td style="padding:12px 0">${s.n}</td><td style="color:var(--primary); font-weight:800">${s.pts}</td><td>${s.v}</td><td>${s.sg}</td></tr>`;
            });
            content.innerHTML = h + `</table>`;
        }
    } 
    else if(mode === 'jogos') {
        if(c.jogos.length === 0) {
            content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="initMataMata()">GERAR CHAVEAMENTO INTELIGENTE</button>` : `<p style="text-align:center">O Host ainda não sorteou os jogos.</p>`;
        } else {
            let html = c.jogos.map((j, i) => `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center; border: 1px solid #1a1a1a;">
                    <div style="width:35%; font-weight:700">${j.n1}</div>
                    <div class="score-box">
                        ${c.host === me.uid ? `<button class="score-btn" onclick="upScore(${i}, 1, -1)"><i class="fas fa-minus"></i></button>` : ''}
                        <div class="score-val">${j.g1??0} : ${j.g2??0}</div>
                        ${c.host === me.uid ? `<button class="score-btn" onclick="upScore(${i}, 1, 1)"><i class="fas fa-plus"></i></button>` : ''}
                    </div>
                    <div style="width:35%; text-align:right; font-weight:700">${j.n2}</div>
                </div>
            `).join('');
            if(c.host === me.uid && c.jogos.every(j => j.g1 !== null && j.g1 !== j.g2)) {
                html += `<button class="btn-glow" style="margin-top:20px; background:var(--neon-blue);" onclick="nextPhase()">AVANÇAR PARA PRÓXIMA FASE</button>`;
            }
            content.innerHTML = html;
        }
    }
    else if(mode === 'manage') {
        content.innerHTML = `
            <button class="btn-glow" style="margin-bottom:12px;" onclick="inviteAll()">CONVIDAR JOGADORES DO LOBBY</button>
            <button class="btn-glow" style="background:#500; color:#fff" onclick="deleteCopa()">EXCLUIR CAMPEONATO</button>
        `;
    }
}

// --- LOGICA MATA-MATA INTELIGENTE ---
async function initMataMata() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    let players = [...c.p];
    players.sort(() => Math.random() - 0.5); // Sorteio inicial

    const n = players.length;
    let fase = 'Oitavas';
    if(n <= 4) fase = 'Semi-Final';
    else if(n <= 8) fase = 'Quartas';

    let jogos = [];
    for(let i=0; i < players.length; i+=2) {
        if(players[i+1]) {
            jogos.push({ p1: players[i], p2: players[i+1], n1: c.tabela[players[i]].n, n2: c.tabela[players[i+1]].n, g1:0, g2:0 });
        } else {
            // Jogador que passou na sorte (Folga)
            jogos.push({ p1: players[i], p2: 'BYE', n1: c.tabela[players[i]].n, n2: '--- (SORTE)', g1:1, g2:0 });
        }
    }
    await db.collection('campeonatos').doc(currentCid).update({ jogos, fase });
}

async function nextPhase() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    let vencedores = c.jogos.map(j => j.g1 > j.g2 ? {id: j.p1, n: j.n1} : {id: j.p2, n: j.n2});
    
    if(vencedores.length === 1) return alert("Campeonato Encerrado!");

    let novaFase = 'Final';
    if(vencedores.length > 2) novaFase = 'Semi-Final';

    let novosJogos = [];
    for(let i=0; i < vencedores.length; i+=2) {
        if(vencedores[i+1]) {
            novosJogos.push({ p1: vencedores[i].id, p2: vencedores[i+1].id, n1: vencedores[i].n, n2: vencedores[i+1].n, g1:0, g2:0 });
        } else {
            novosJogos.push({ p1: vencedores[i].id, p2: 'BYE', n1: vencedores[i].n, n2: 'SORTE', g1:1, g2:0 });
        }
    }
    await db.collection('campeonatos').doc(currentCid).update({ jogos: novosJogos, fase: novaFase });
}

async function upScore(idx, team, val) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const j = c.jogos[idx];
    if(team === 1) j.g1 = Math.max(0, (j.g1||0) + val);
    else j.g2 = Math.max(0, (j.g2||0) + val);
    
    // Atualizar stats no banco (Gols e Vitorias) para o perfil
    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos });
    updateGlobalStats(j, val, team);
}

function renderBracket(c) {
    const div = document.getElementById('bracket-view');
    div.innerHTML = c.jogos.map(j => `
        <div class="match-card">
            <div class="match-team ${j.g1 > j.g2 ? 'winner':''}"><span>${j.n1}</span><span>${j.g1??0}</span></div>
            <div class="match-team ${j.g2 > j.g1 ? 'winner':''}"><span>${j.n2}</span><span>${j.g2??0}</span></div>
        </div>
    `).join('');
}

// --- UTIL ---
async function inviteAll() {
    const snap = await db.collection('usuarios').get();
    let pIds = [];
    let tab = {};
    snap.forEach(doc => {
        pIds.push(doc.id);
        tab[doc.id] = { pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0, n:doc.data().nome };
    });
    await db.collection('campeonatos').doc(currentCid).update({ p: pIds, tabela: tab });
    alert("Todos os atletas do lobby foram convocados!");
}

async function deleteCopa() {
    if(confirm("Deseja deletar este torneio?")) {
        await db.collection('campeonatos').doc(currentCid).delete();
        changeTab('copas', document.querySelectorAll('.nav-link')[1]);
    }
}

async function updateGlobalStats(jogo, val, team) {
    if(val < 0) return; 
    const uid = team === 1 ? jogo.p1 : jogo.p2;
    if(uid === 'BYE') return;
    const ref = db.collection('usuarios').doc(uid);
    const u = (await ref.get()).data();
    ref.update({ "stats.gp": u.stats.gp + 1 });
}

// --- CHAT & PERFIL ---
function toggleChat() { document.getElementById('chat-window').classList.toggle('open'); }
function sendMsg() {
    const input = document.getElementById('chat-input');
    if(!input.value) return;
    db.collection('chat').add({ u: me.nome, m: input.value, t: Date.now() });
    input.value = "";
}
function listenChat() {
    db.collection('chat').orderBy('t', 'desc').limit(25).onSnapshot(snap => {
        document.getElementById('chat-msgs').innerHTML = snap.docs.reverse().map(doc => `
            <div style="margin-bottom:8px;"><b style="color:var(--neon-blue)">${doc.data().u}:</b> ${doc.data().m}</div>
        `).join('');
        const box = document.getElementById('chat-msgs');
        box.scrollTop = box.scrollHeight;
    });
}
function openSettings() {
    document.getElementById('set-nick').value = me.nome;
    document.getElementById('set-foto').value = me.foto;
    document.getElementById('modal-settings').classList.remove('hidden');
}
function closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); }
async function saveSettings() {
    await db.collection('usuarios').doc(me.uid).update({
        nome: document.getElementById('set-nick').value,
        foto: document.getElementById('set-foto').value
    });
    closeSettings();
}
function doLogout() { auth.signOut().then(() => location.reload()); }
function changeTab(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    el.classList.add('active');
}

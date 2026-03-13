const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

// --- CLOCK & DATE ---
setInterval(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('live-clock');
    if(el) el.innerText = `${dateStr} | ${timeStr}`;
}, 1000);

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

function toggleAuth(t) {
    document.getElementById('screen-login').classList.toggle('hidden', t === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', t === 'login');
}

function doLogin() {
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value).catch(e => alert(e.message));
}

async function doRegister() {
    const nick = document.getElementById('r-nick').value;
    const res = await auth.createUserWithEmailAndPassword(document.getElementById('r-email').value, document.getElementById('r-pass').value);
    await db.collection('usuarios').doc(res.user.uid).set({
        nome: nick, online: true, foto: '', stats: { participacoes:0, titulos:0, v:0, e:0, d:0, gp:0, gs:0 }
    });
}

// --- LOBBY & PROFILE ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let players = [];
        snap.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        players.sort((a,b) => b.online - a.online);
        document.getElementById('lobby-list').innerHTML = players.map(p => `
            <div class="card" onclick="viewProfile('${p.id}')" style="display:flex; align-items:center; gap:12px;">
                <div style="width:10px; height:10px; border-radius:50%; background:${p.online?'#00ff88':'#555'}"></div>
                <div style="width:40px; height:40px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover;"></div>
                <div style="flex:1"><div style="font-weight:800">${p.nome}</div><small style="color:var(--neon-blue)">RANK ELITE</small></div>
                <i class="fas fa-chevron-right" style="color:#222"></i>
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
        <div><small>VITORIAS</small><br><b style="color:var(--primary)">${p.stats.v}</b></div>
        <div><small>TITULOS</small><br><b style="color:var(--primary)">${p.stats.titulos}</b></div>
        <div><small>GOLS PRÓ</small><br><b>${p.stats.gp}</b></div>
        <div><small>GOLS CONTRA</small><br><b>${p.stats.gs}</b></div>
    `;
    document.getElementById('modal-profile').classList.remove('hidden');
}

// --- ARENA ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    if(!n) return;
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0, n:me.nome } },
        jogos: [], data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card" onclick="openArena('${doc.id}')">
                <b style="color:var(--primary)">${doc.data().nome}</b>
                <div style="font-size:0.7rem; color:var(--neon-blue)">MODO: ${doc.data().tipo.toUpperCase()}</div>
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
        document.getElementById('arena-header').innerHTML = `<h2 style="text-align:center; color:var(--primary)">${c.nome}</h2>`;
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
            content.innerHTML = `
                <div class="bracket">
                    <div class="brand-top" style="font-size:0.5rem">SEMI-FINAL</div>
                    <div class="bracket-match"><div class="bracket-team"><span>A DEFINIR</span><span>-</span></div><div class="bracket-team"><span>A DEFINIR</span><span>-</span></div></div>
                    <div class="brand-top" style="font-size:0.5rem">FINAL</div>
                    <div class="bracket-match" style="border-color:var(--primary);"><div class="bracket-team"><span>FINALISTA 1</span><span>-</span></div><div class="bracket-team"><span>FINALISTA 2</span><span>-</span></div></div>
                </div>`;
        } else {
            let h = `<table style="width:100%; border-collapse:collapse;"><tr><th>#</th><th>PLAYER</th><th>P</th><th>V</th><th>SG</th></tr>`;
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].v - a[1].v || b[1].sg - a[1].sg);
            sorted.forEach(([id, s], i) => {
                h += `<tr style="border-bottom:1px solid #111;"><td style="padding:12px">${i+1}</td><td>${s.n}</td><td style="color:var(--primary); font-weight:800">${s.pts}</td><td>${s.v}</td><td>${s.sg}</td></tr>`;
            });
            content.innerHTML = h + `</table>`;
        }
    } 
    else if(mode === 'jogos') {
        if(c.jogos.length === 0) {
            content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="generateGames()">GERAR CONFRONTOS</button>` : `<p>Aguardando...</p>`;
        } else {
            content.innerHTML = c.jogos.map((j, i) => `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="width:30%; font-size:0.8rem">${j.n1}</div>
                    <div class="score-control">
                        ${c.host === me.uid ? `<button class="score-btn" onclick="updatePlacar(${i}, 1, -1)"><i class="fas fa-chevron-down"></i></button>` : ''}
                        <div class="score-val">${j.g1??0} x ${j.g2??0}</div>
                        ${c.host === me.uid ? `<button class="score-btn" onclick="updatePlacar(${i}, 1, 1)"><i class="fas fa-chevron-up"></i></button>` : ''}
                    </div>
                    <div style="width:30%; text-align:right; font-size:0.8rem">${j.n2}</div>
                </div>
            `).join('');
        }
    }
    else if(mode === 'manage') {
        content.innerHTML = `
            <button class="btn-glow" style="margin-bottom:10px" onclick="inviteAll()">CONVIDAR TODOS DO LOBBY</button>
            <button class="btn-glow" style="background:#400; color:#fff" onclick="deleteCopa()">EXCLUIR CAMPEONATO</button>
        `;
    }
}

async function updatePlacar(gameIdx, team, val) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const jogo = c.jogos[gameIdx];
    
    if(team === 1) jogo.g1 = Math.max(0, (jogo.g1 || 0) + val);
    else jogo.g2 = Math.max(0, (jogo.g2 || 0) + val);

    // Recalcular Tabela...
    Object.keys(c.tabela).forEach(k => {
        c.tabela[k] = { ...c.tabela[k], pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0 };
    });
    c.jogos.forEach(j => {
        const t1 = c.tabela[j.p1]; const t2 = c.tabela[j.p2];
        t1.gp += j.g1; t1.gs += j.g2; t2.gp += j.g2; t2.gs += j.g1;
        if(j.g1 > j.g2) { t1.pts += 3; t1.v++; }
        else if(j.g2 > j.g1) { t2.pts += 3; t2.v++; }
        else { t1.pts++; t2.pts++; }
        t1.sg = t1.gp - t1.gs; t2.sg = t2.gp - t2.gs;
    });

    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos, tabela: c.tabela });
    switchArena('jogos');
}

async function deleteCopa() {
    if(confirm("Deseja apagar permanentemente?")) {
        await db.collection('campeonatos').doc(currentCid).delete();
        changeTab('copas', document.querySelectorAll('.nav-link')[1]);
    }
}

async function generateGames() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const p = c.p;
    let jogos = [];
    for(let i=0; i<p.length; i++) {
        for(let j=i+1; j<p.length; j++) {
            jogos.push({ p1: p[i], p2: p[j], n1: c.tabela[p[i]].n, n2: c.tabela[p[j]].n, g1:0, g2:0 });
        }
    }
    await db.collection('campeonatos').doc(currentCid).update({ jogos });
    switchArena('jogos');
}

// --- CORE ---
function openSettings() { document.getElementById('modal-settings').classList.remove('hidden'); }
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
function listenChat() {
    db.collection('chat').orderBy('t', 'desc').limit(20).onSnapshot(snap => {
        document.getElementById('chat-msgs').innerHTML = snap.docs.reverse().map(doc => `<div><b style="color:var(--neon-blue)">${doc.data().u}:</b> ${doc.data().m}</div>`).join('');
    });
}
function sendMsg() {
    const val = document.getElementById('chat-input').value;
    if(!val) return;
    db.collection('chat').add({ u: me.nome, m: val, t: Date.now() });
    document.getElementById('chat-input').value = "";
}

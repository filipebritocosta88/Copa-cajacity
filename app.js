const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

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
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value)
        .catch(e => alert("Erro: " + e.message));
}

async function doRegister() {
    const nick = document.getElementById('r-nick').value;
    const email = document.getElementById('r-email').value;
    const pass = document.getElementById('r-pass').value;
    try {
        const res = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: nick, online: true, foto: '',
            stats: { participacoes:0, titulos:0, v:0, e:0, d:0, gp:0, gs:0 }
        });
    } catch(e) { alert(e.message); }
}

// --- LOBBY & PERFIL ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let players = [];
        snap.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        players.sort((a,b) => b.online - a.online);
        
        const div = document.getElementById('lobby-list');
        div.innerHTML = players.map(p => `
            <div class="card" style="display:flex; align-items:center; gap:15px;" onclick="viewProfile('${p.id}')">
                <div style="width:12px; height:12px; border-radius:50%; background:${p.online?'#00ff88':'#444'}"></div>
                <div style="width:40px; height:40px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover;"></div>
                <div style="flex:1">
                    <div style="font-weight:800">${p.nome}</div>
                    <div style="font-size:0.6rem; color:var(--text-dim)">${p.stats?.titulos || 0} Títulos | ${p.stats?.v || 0} Vitórias</div>
                </div>
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
        <div><small>Copas</small><br><b>${p.stats.participacoes}</b></div>
        <div><small>Títulos</small><br><b>${p.stats.titulos}</b></div>
        <div><small>Gols Pró</small><br><b>${p.stats.gp}</b></div>
        <div><small>Gols Sofridos</small><br><b>${p.stats.gs}</b></div>
        <div><small>V/E/D</small><br><b>${p.stats.v}/${p.stats.e}/${p.stats.d}</b></div>
    `;
    document.getElementById('modal-profile').classList.remove('hidden');
}

function closeProfile() { document.getElementById('modal-profile').classList.add('hidden'); }

// --- CHAT ---
function toggleChat() { document.getElementById('chat-box').classList.toggle('open'); }
function sendMsg() {
    const val = document.getElementById('chat-input').value;
    if(!val) return;
    db.collection('chat').add({ u: me.nome, m: val, t: Date.now() });
    document.getElementById('chat-input').value = "";
}
function listenChat() {
    db.collection('chat').orderBy('t', 'desc').limit(20).onSnapshot(snap => {
        document.getElementById('chat-msgs').innerHTML = snap.docs.reverse().map(doc => {
            const d = doc.data();
            return `<div><b style="color:var(--primary)">${d.u}:</b> ${d.m}</div>`;
        }).join('');
    });
}

// --- ARENA & GESTÃO ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0, n:me.nome, escudo: '' } },
        jogos: [], data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card" onclick="openArena('${doc.id}')">
                <b style="color:var(--primary)">${doc.data().nome}</b>
                <div style="font-size:0.7rem">${doc.data().p.length} Atletas</div>
            </div>
        `).join('');
    });
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2 class="logo-main" style="font-size:1.5rem">${c.nome}</h2>`;
        document.getElementById('btn-manage').classList.toggle('hidden', c.host !== me.uid);
        switchArena('tabela');
    });
}

async function switchArena(mode) {
    const content = document.getElementById('arena-content');
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();

    if(mode === 'tabela') {
        let h = `<table><tr><th>#</th><th>PLAYER</th><th>P</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>`;
        const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].v - a[1].v || b[1].sg - a[1].sg);
        sorted.forEach(([id, s], i) => {
            h += `<tr><td>${i+1}</td><td>${s.n}</td><td style="color:var(--primary); font-weight:800">${s.pts}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td><td>${s.sg}</td></tr>`;
        });
        content.innerHTML = h + `</table>`;
    } 
    else if(mode === 'jogos') {
        if(c.jogos.length === 0) {
            content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="startSorteio()">SORTEAR CONFRONTOS</button>` : `<p>Aguardando sorteio...</p>`;
        } else {
            content.innerHTML = c.jogos.map((j, i) => `
                <div class="match-row">
                    <div style="font-size:0.6rem; position:absolute; top:5px; left:15px; color:var(--primary)">JOGO #${i+1}</div>
                    <div style="width:35%; text-align:center">${j.n1}</div>
                    <div class="score-box" onclick="${c.host === me.uid ? `setScore(${i})` : ''}">${j.g1??'0'} x ${j.g2??'0'}</div>
                    <div style="width:35%; text-align:center">${j.n2}</div>
                </div>
            `).join('');
        }
    }
    else if(mode === 'manage') {
        content.innerHTML = `
            <button class="btn-glow" onclick="inviteAllPlayers()">CONVIDAR TODOS ONLINE</button>
            <button class="btn-glow" style="background:var(--danger); color:#fff; margin-top:20px;" onclick="deleteCopa()">EXCLUIR CAMPEONATO</button>
        `;
    }
}

async function startSorteio() {
    document.getElementById('overlay-sorteio').classList.remove('hidden');
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const p = c.p;
    let jogos = [];
    for(let i=0; i<p.length; i++) {
        for(let j=i+1; j<p.length; j++) {
            jogos.push({ p1: p[i], p2: p[j], n1: c.tabela[p[i]].n, n2: c.tabela[p[j]].n, g1:null, g2:null });
        }
    }
    setTimeout(async () => {
        await db.collection('campeonatos').doc(currentCid).update({ jogos });
        document.getElementById('overlay-sorteio').classList.add('hidden');
        switchArena('jogos');
    }, 2000);
}

async function setScore(idx) {
    const g1 = prompt("Gols do Time 1:");
    const g2 = prompt("Gols do Time 2:");
    if(g1 === null || g2 === null) return;
    
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    c.jogos[idx].g1 = parseInt(g1);
    c.jogos[idx].g2 = parseInt(g2);
    
    // Recalcula Tabela
    Object.keys(c.tabela).forEach(k => {
        c.tabela[k] = { ...c.tabela[k], pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0 };
    });
    
    c.jogos.forEach(j => {
        if(j.g1 === null) return;
        const t1 = c.tabela[j.p1]; const t2 = c.tabela[j.p2];
        t1.gp += j.g1; t1.gs += j.g2; t2.gp += j.g2; t2.gs += j.g1;
        if(j.g1 > j.g2) { t1.pts += 3; t1.v++; t2.d++; }
        else if(j.g2 > j.g1) { t2.pts += 3; t2.v++; t1.d++; }
        else { t1.pts++; t2.pts++; t1.e++; t2.e++; }
        t1.sg = t1.gp - t1.gs; t2.sg = t2.gp - t2.gs;
    });
    
    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos, tabela: c.tabela });
}

// --- SETTINGS ---
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

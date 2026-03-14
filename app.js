const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

// --- CLOCK ---
setInterval(() => {
    const now = new Date();
    document.getElementById('live-clock').innerText = `${now.toLocaleDateString('pt-BR')} | ${now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
}, 1000);

// --- ENTER CHAT ---
document.getElementById('chat-input')?.addEventListener('keypress', e => { if(e.key === 'Enter') sendMsg(); });

// --- AUTH SYSTEM ---
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
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value).catch(e => alert(e.message));
}

async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const res = await auth.createUserWithEmailAndPassword(document.getElementById('r-email').value, document.getElementById('r-pass').value);
    await db.collection('usuarios').doc(res.user.uid).set({
        nome: n, online: true, foto: '', stats: { participacoes:0, titulos:0, v:0, e:0, d:0, gp:0, gs:0 }
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
                <div class="status-dot" style="background:${p.online ? 'var(--divine-green)' : '#444'}; color:${p.online ? 'var(--divine-green)' : '#444'}"></div>
                <div style="width:45px; height:45px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover; border:2px solid var(--glass);"></div>
                <div style="flex:1">
                    <div style="font-weight:800">${p.nome}</div>
                    <div style="font-size:0.6rem; color:var(--neon-blue)">${p.stats.titulos} TROFÉUS | ${p.stats.v} VITÓRIAS</div>
                </div>
                <i class="fas fa-medal" style="color:var(--primary)"></i>
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
        <div class="card" style="margin:0"><b>${p.stats.v}</b><br><small>VITÓRIAS</small></div>
        <div class="card" style="margin:0"><b>${p.stats.titulos}</b><br><small>TÍTULOS</small></div>
        <div class="card" style="margin:0"><b>${p.stats.gp}</b><br><small>GOLS PRÓ</small></div>
        <div class="card" style="margin:0"><b>${p.stats.gs}</b><br><small>SOFRIDOS</small></div>
    `;
    document.getElementById('modal-profile').classList.remove('hidden');
}

// --- ARENA LOGIC ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    if(!n) return;
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'aberto',
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, gp:0, gs:0, sg:0, n:me.nome, time: 'Agente Livre', escudo: '' } },
        jogos: [], fase: 'Inscrições', data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card" onclick="openArena('${doc.id}')" style="background: linear-gradient(to right, #0d0f14, #1a1e26);">
                <b style="color:var(--primary); font-size:1.1rem">${doc.data().nome}</b>
                <div style="font-size:0.65rem; color:var(--neon-blue); margin-top:5px;">MODO: ${doc.data().tipo.toUpperCase()} | ${doc.data().p.length} PLAYERS</div>
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
            content.innerHTML = `<div style="color:var(--neon-blue); text-align:center; font-size:0.7rem; margin-bottom:15px;">CHAVEAMENTO ${c.fase.toUpperCase()}</div><div id="bracket-draw"></div>`;
            renderBracket(c);
        } else {
            let h = `<table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <tr style="color:var(--neon-blue); text-align:left;"><th>POS</th><th>TIME</th><th>P</th><th>V</th><th>SG</th></tr>`;
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].v - a[1].v || b[1].sg - a[1].sg);
            sorted.forEach(([id, s], i) => {
                h += `<tr style="border-bottom:1px solid #111;">
                    <td style="padding:12px 0">${i+1}</td>
                    <td><div style="display:flex; align-items:center; gap:5px;">${s.time} <small>(${s.n})</small></div></td>
                    <td style="color:var(--primary); font-weight:800">${s.pts}</td><td>${s.v}</td><td>${s.sg}</td>
                </tr>`;
            });
            content.innerHTML = h + `</table>`;
        }
    } 
    else if(mode === 'jogos') {
        if(c.jogos.length === 0) {
            content.innerHTML = c.host === me.uid ? `<button class="btn-glow" onclick="startTournament()">GERAR CONFRONTOS E SORTEAR</button>` : `<p>Aguardando início...</p>`;
        } else {
            content.innerHTML = c.jogos.map((j, i) => `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="width:35%; font-weight:700; font-size:0.75rem">${c.tabela[j.p1].time}</div>
                    <div class="score-ui">
                        ${c.host === me.uid ? `<button onclick="upScore(${i}, 1, -1)">-</button>` : ''}
                        <span>${j.g1??0} : ${j.g2??0}</span>
                        ${c.host === me.uid ? `<button onclick="upScore(${i}, 1, 1)">+</button>` : ''}
                    </div>
                    <div style="width:35%; text-align:right; font-weight:700; font-size:0.75rem">${c.tabela[j.p2]?.time || 'SORTE'}</div>
                </div>
            `).join('');
            if(c.host === me.uid && c.tipo === 'mata') {
                content.innerHTML += `<button class="btn-glow" style="margin-top:15px;" onclick="nextMataPhase()">AVANÇAR FASE</button>`;
            }
        }
    }
    else if(mode === 'manage') {
        content.innerHTML = `
            <div class="card">
                <h4 style="margin-bottom:10px">CONFIGURAR TIMES</h4>
                ${c.p.map(pid => `
                    <div style="margin-bottom:10px">
                        <small>${c.tabela[pid].n}:</small>
                        <input type="text" placeholder="Nome do Time" onchange="updatePlayerTime('${pid}', this.value)" value="${c.tabela[pid].time}">
                    </div>
                `).join('')}
            </div>
            <button class="btn-glow" onclick="inviteLobby()">CONVOCAR TODOS</button>
            <button class="btn-glow" style="background:#500; color:#fff; margin-top:15px;" onclick="deleteCopa()">EXCLUIR COPA</button>
        `;
    }
}

// --- MATA-MATA & LIGA CORE ---
async function startTournament() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    let players = [...c.p].sort(() => Math.random() - 0.5);
    let jogos = [];
    
    if(c.tipo === 'liga') {
        for(let i=0; i<players.length; i++) {
            for(let j=i+1; j<players.length; j++) {
                jogos.push({ p1: players[i], p2: players[j], g1:0, g2:0 });
            }
        }
        await db.collection('campeonatos').doc(currentCid).update({ jogos, fase: 'Pontos Corridos' });
    } else {
        // Mata-Mata Inteligente
        for(let i=0; i<players.length; i+=2) {
            jogos.push({ p1: players[i], p2: players[i+1] || 'BYE', g1:0, g2: players[i+1] ? 0 : -1 });
        }
        await db.collection('campeonatos').doc(currentCid).update({ jogos, fase: players.length > 4 ? 'Quartas' : 'Semi' });
    }
}

async function upScore(idx, team, val) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const j = c.jogos[idx];
    if(team === 1) j.g1 = Math.max(0, (j.g1||0) + val);
    else j.g2 = Math.max(0, (j.g2||0) + val);

    if(c.tipo === 'liga') {
        // Recalcular Tabela Pontos Corridos
        Object.keys(c.tabela).forEach(k => { c.tabela[k] = {...c.tabela[k], pts:0, v:0, sg:0, gp:0, gs:0}; });
        c.jogos.forEach(m => {
            const t1 = c.tabela[m.p1]; const t2 = c.tabela[m.p2];
            t1.gp += m.g1; t1.gs += m.g2; t2.gp += m.g2; t2.gs += m.g1;
            if(m.g1 > m.g2) { t1.pts += 3; t1.v++; }
            else if(m.g2 > m.g1) { t2.pts += 3; t2.v++; }
            else { t1.pts++; t2.pts++; }
            t1.sg = t1.gp - t1.gs; t2.sg = t2.gp - t2.gs;
        });
    }
    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos, tabela: c.tabela });
}

function renderBracket(c) {
    const draw = document.getElementById('bracket-draw');
    draw.innerHTML = c.jogos.map(j => `
        <div class="bracket-match">
            <div class="team-line ${j.g1 > j.g2 ? 'winner':''}"><span>${c.tabela[j.p1].time}</span><span>${j.g1}</span></div>
            <div class="team-line ${j.g2 > j.g1 ? 'winner':''}"><span>${c.tabela[j.p2]?.time || 'FOLGA'}</span><span>${j.g2 === -1 ? '-' : j.g2}</span></div>
        </div>
    `).join('');
}

// --- UTILS ---
async function updatePlayerTime(pid, time) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    c.tabela[pid].time = time;
    await db.collection('campeonatos').doc(currentCid).update({ tabela: c.tabela });
}

async function inviteLobby() {
    const snap = await db.collection('usuarios').get();
    let p = []; let tab = {};
    snap.forEach(doc => {
        p.push(doc.id);
        tab[doc.id] = { pts:0, v:0, sg:0, n:doc.data().nome, time: 'Time ' + doc.data().nome[0] };
    });
    await db.collection('campeonatos').doc(currentCid).update({ p, tabela: tab });
}

async function deleteCopa() { if(confirm("Apagar campeonato?")) await db.collection('campeonatos').doc(currentCid).delete(); }

// --- CHAT & PERFIL ---
function toggleChat() { document.getElementById('chat-window').classList.toggle('open'); }
function sendMsg() {
    const i = document.getElementById('chat-input');
    if(!i.value) return;
    db.collection('chat').add({ u: me.nome, m: i.value, t: Date.now() });
    i.value = "";
}
function listenChat() {
    db.collection('chat').orderBy('t', 'desc').limit(20).onSnapshot(snap => {
        document.getElementById('chat-msgs').innerHTML = snap.docs.reverse().map(d => `<div class="msg-bubble"><b>${d.data().u}:</b> ${d.data().m}</div>`).join('');
        document.getElementById('chat-msgs').scrollTop = 9999;
    });
}
function openSettings() {
    document.getElementById('set-nick').value = me.nome;
    document.getElementById('set-foto').value = me.foto;
    document.getElementById('modal-settings').classList.remove('hidden');
}
function closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); }
async function saveSettings() {
    await db.collection('usuarios').doc(me.uid).update({ nome: document.getElementById('set-nick').value, foto: document.getElementById('set-foto').value });
    closeSettings();
}
function doLogout() { auth.signOut().then(() => location.reload()); }
function changeTab(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    el.classList.add('active');
}

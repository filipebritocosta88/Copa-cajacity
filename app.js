const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;
let unreadCount = 0;
let lastMsgTime = 0;

// --- CONFIG AVATARES ---
const AVATARS = [
    { n: 'Messi', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163063.png' },
    { n: 'CR7', u: 'https://cdn-icons-png.flaticon.com/512/3220/3220138.png' },
    { n: 'Neymar', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163068.png' },
    { n: 'Vini Jr', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163069.png' },
    { n: 'Mbappe', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163071.png' },
    { n: 'Pele', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163073.png' },
    { n: 'Caveira', u: 'https://cdn-icons-png.flaticon.com/512/428/428172.png' },
    { n: 'Bola', u: 'https://cdn-icons-png.flaticon.com/512/33/33736.png' },
    { n: 'Leao', u: 'https://cdn-icons-png.flaticon.com/512/616/616412.png' },
    { n: 'Macaco', u: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' },
    { n: 'Cachorro', u: 'https://cdn-icons-png.flaticon.com/512/616/616408.png' },
    { n: 'Gato', u: 'https://cdn-icons-png.flaticon.com/512/616/616432.png' },
    { n: 'Meme1', u: 'https://cdn-icons-png.flaticon.com/512/2613/2613143.png' },
    { n: 'Meme2', u: 'https://cdn-icons-png.flaticon.com/512/3551/3551061.png' }
];

// --- CORE UTILS ---
setInterval(() => {
    const d = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if(document.getElementById('header-clock')) document.getElementById('header-clock').innerText = timeStr;
    if(document.getElementById('auth-time')) document.getElementById('auth-time').innerText = d.toLocaleDateString() + ' ' + timeStr;
}, 1000);

function toggleAuth(t) {
    document.getElementById('screen-login').classList.toggle('hidden', t === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', t === 'login');
}

function changeTab(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    el.classList.add('active');
}

// --- AUTH LOGIC ---
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

function doLogin() {
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value)
    .catch(() => alert("Credenciais incorretas"));
}

async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const e = document.getElementById('r-email').value;
    const p = document.getElementById('r-pass').value;
    if(!n || p.length < 6) return alert("Nick curto ou senha fraca");
    const res = await auth.createUserWithEmailAndPassword(e, p);
    await db.collection('usuarios').doc(res.user.uid).set({
        nome: n, online: true, lastSeen: Date.now(), foto: AVATARS[0].u, 
        stats: { vit: 0, der: 0, emp: 0 }, favs: [], convites_recebidos: 0
    });
}

function doLogout() {
    db.collection('usuarios').doc(me.uid).update({ online: false }).then(() => auth.signOut().then(() => location.reload()));
}

// --- INIT ---
function initApp() {
    loadLobby();
    loadCopas();
    listenChat();
    listenInvites();
}

// --- LOBBY & HALL OF FAME ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let players = [];
        snap.forEach(d => players.push({ id: d.id, ...d.data() }));

        // Hall of Fame
        const hall = [...players].sort((a,b) => b.stats.vit - a.stats.vit).slice(0, 3);
        document.getElementById('hall-fame-list').innerHTML = hall.map((p, i) => `
            <div style="text-align:center">
                <i class="fas fa-medal" style="color:${i==0?'#ffd700':i==1?'#c0c0c0':'#cd7f32'}"></i><br>
                <small style="font-weight:800">${p.nome}</small><br><span style="font-size:0.6rem">${p.stats.vit}V</span>
            </div>
        `).join('');

        // Lobby List
        players.sort((a, b) => (b.online - a.online) || (me.favs?.includes(b.id) - me.favs?.includes(a.id)));
        const list = document.getElementById('lobby-list');
        list.innerHTML = players.map(p => `
            <div class="rank-item">
                <div style="display:flex; align-items:center; gap:10px" onclick="showPlayerStats('${p.id}')">
                    <div style="width:35px; height:35px; border-radius:50%; background:url(${p.foto}); background-size:cover"></div>
                    <div>
                        <div style="font-size:0.8rem; font-weight:800"><span class="status-dot" style="background:${p.online?'#0f8':'#555'}"></span>${p.nome}</div>
                        <small style="color:var(--text-dim)">${p.stats.vit} Vitórias</small>
                    </div>
                </div>
                <div style="display:flex; gap:12px; align-items:center">
                    <i class="${me.favs?.includes(p.id)?'fas':'far'} fa-star" style="color:${me.favs?.includes(p.id)?'#ffbc00':'#444'}" onclick="toggleFav('${p.id}')"></i>
                    ${p.id !== me.uid ? `<button class="btn-glow" style="width:auto; padding:5px 10px; font-size:0.5rem" onclick="inviteFromLobby('${p.id}')">CONVIDAR</button>` : ''}
                </div>
            </div>
        `).join('');
    });
}

function toggleFav(id) {
    let f = me.favs || [];
    if(f.includes(id)) f = f.filter(x => x !== id);
    else f.push(id);
    db.collection('usuarios').doc(me.uid).update({ favs: f });
}

// --- COPAS ---
async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    if(!n) return alert("Dê um nome à copa!");
    const ref = await db.collection('campeonatos').add({
        nome: n, tipo: t, host: me.uid, p: [me.uid], status: 'inscricao',
        tabela: { [me.uid]: { pts: 0, v: 0, e: 0, d: 0, n: me.nome, time: '---' } },
        jogos: [], data: Date.now()
    });
    alert("Copa criada! Convide seus amigos.");
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        const div = document.getElementById('copas-list');
        div.innerHTML = "<h4 style='margin:15px 0'>Ativas</h4>";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="display:flex; justify-content:space-between; align-items:center">
                    <div><strong>${c.nome}</strong><br><small style="color:var(--primary)">${c.tipo}</small></div>
                    <div style="display:flex; gap:10px">
                        ${c.host === me.uid ? `<i class="fas fa-trash" style="color:var(--danger)" onclick="deleteCopa(event, '${doc.id}')"></i>` : ''}
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>`;
        });
    });
}

function deleteCopa(e, id) {
    e.stopPropagation();
    if(confirm("Deseja apagar este campeonato?")) db.collection('campeonatos').doc(id).delete();
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        if(!doc.exists) return;
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2 style="color:var(--primary)">${c.nome}</h2><p style="font-size:0.7rem">${c.p.length} Jogadores Inscritos</p>`;
        
        // Atualiza seletor de chat para incluir chat da copa
        const sel = document.getElementById('chat-selector');
        if(!sel.querySelector(`option[value="${id}"]`)) {
            sel.innerHTML += `<option value="${id}">Copa: ${c.nome}</option>`;
        }
        
        switchArena('tabela');
    });
}

function switchArena(mode) {
    const content = document.getElementById('arena-content');
    db.collection('campeonatos').doc(currentCid).get().then(doc => {
        const c = doc.data();
        if(mode === 'tabela') {
            let h = `<table style="width:100%; text-align:center; font-size:0.8rem">
                <tr style="color:var(--text-dim)"><th>#</th><th>PLAYER</th><th>PTS</th><th>V</th></tr>`;
            const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts);
            sorted.forEach(([id, s], i) => {
                h += `<tr><td>${i+1}</td><td>${s.n}</td><td style="color:var(--primary); font-weight:800">${s.pts}</td><td>${s.v}</td></tr>`;
            });
            content.innerHTML = h + `</table>`;
        } else if(mode === 'convidar') {
            content.innerHTML = `
                <div class="card" style="text-align:center">
                    <p style="font-size:0.8rem; margin-bottom:10px">Convide jogadores cadastrados:</p>
                    <button class="btn-glow" style="margin-bottom:10px" onclick="inviteAll()">CONVIDAR TODOS DO LOBBY</button>
                    <small>Ou use o botão "Convidar" na aba Lobby.</small>
                </div>
                ${c.host === me.uid && c.status === 'inscricao' ? `<button class="btn-glow" onclick="startDraw()">INICIAR SORTEIO E CAMPEONATO</button>` : ''}
            `;
        }
    });
}

// --- SORTEIO ANIMADO ---
async function startDraw() {
    document.getElementById('sorteio-overlay').classList.remove('hidden');
    setTimeout(async () => {
        const snap = await db.collection('campeonatos').doc(currentCid).get();
        const c = snap.data();
        const players = c.p;
        let jogos = [];
        
        // Algoritmo de Sorteio (Pontos Corridos)
        for(let i=0; i<players.length; i++) {
            for(let j=i+1; j<players.length; j++) {
                jogos.push({ p1: players[i], p2: players[j], n1: c.tabela[players[i]].n, n2: c.tabela[players[j]].n, g1: null, g2: null });
            }
        }

        await db.collection('campeonatos').doc(currentCid).update({ status: 'ativo', jogos });
        document.getElementById('sorteio-overlay').classList.add('hidden');
        alert("Campeonato Iniciado!");
    }, 3000);
}

// --- CONVITES ---
async function inviteFromLobby(pid) {
    if(!currentCid) return alert("Selecione uma copa na Arena primeiro!");
    const target = await db.collection('usuarios').doc(pid).get();
    if(target.data().convites_recebidos >= 5) return alert("Limite de convites para este usuário atingido!");

    db.collection('convites').add({
        para: pid, deNick: me.nome, cid: currentCid, copaNome: "Torneio", status: 'p', data: Date.now()
    });
    db.collection('usuarios').doc(pid).update({ convites_recebidos: firebase.firestore.FieldValue.increment(1) });
    alert("Convite enviado!");
}

async function inviteAll() {
    const snap = await db.collection('usuarios').get();
    snap.forEach(d => { if(d.id !== me.uid) inviteFromLobby(d.id); });
}

function listenInvites() {
    db.collection('convites').where('para', '==', me.uid).where('status', '==', 'p').onSnapshot(snap => {
        snap.forEach(doc => {
            const c = doc.data();
            if(confirm(`${c.deNick} te convidou para participar da copa ${c.copaNome}. Aceitar?`)) {
                db.collection('campeonatos').doc(c.cid).update({
                    p: firebase.firestore.FieldValue.arrayUnion(me.uid),
                    [`tabela.${me.uid}`]: { pts: 0, v: 0, e: 0, d: 0, n: me.nome, time: '---' }
                });
                db.collection('convites').doc(doc.id).update({ status: 'a' });
            } else {
                db.collection('convites').doc(doc.id).update({ status: 'r' });
            }
        });
    });
}

// --- CHAT CORRIGIDO ---
function toggleChat() {
    const box = document.getElementById('chat-box');
    const isV = box.style.display === 'flex';
    box.style.display = isV ? 'none' : 'flex';
    if(!isV) { unreadCount = 0; document.getElementById('chat-badge').classList.add('hidden'); }
}

function listenChat() {
    db.collection('chat_global').orderBy('t', 'desc').limit(20).onSnapshot(snap => {
        const box = document.getElementById('chat-msgs');
        // Filtra para evitar o loop infinito
        const newMsgs = snap.docs.filter(d => d.data().t > lastMsgTime).reverse();
        if(newMsgs.length > 0) {
            newMsgs.forEach(d => {
                const m = d.data();
                box.innerHTML += `<div class="msg-line"><strong>${m.u}:</strong> ${m.txt}</div>`;
                lastMsgTime = m.t;
            });
            box.scrollTop = box.scrollHeight;
            if(document.getElementById('chat-box').style.display !== 'flex') {
                unreadCount += newMsgs.length;
                document.getElementById('chat-badge').innerText = unreadCount;
                document.getElementById('chat-badge').classList.remove('hidden');
            }
        }
    });
}

function sendMsg() {
    const txt = document.getElementById('chat-input').value;
    if(!txt) return;
    db.collection('chat_global').add({ u: me.nome, txt, t: Date.now() });
    document.getElementById('chat-input').value = "";
}

// --- PERFIL ---
function openProfile() {
    document.getElementById('modal-profile').classList.remove('hidden');
    document.getElementById('new-nick').value = me.nome;
    document.getElementById('profile-preview').style.backgroundImage = `url(${me.foto})`;
    const list = document.getElementById('avatar-list');
    list.innerHTML = AVATARS.map(a => `
        <div class="av-item" style="background-image:url(${a.u})" onclick="selectAvatar('${a.u}', this)"></div>
    `).join('');
}

function selectAvatar(u, el) {
    document.querySelectorAll('.av-item').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('profile-preview').style.backgroundImage = `url(${u})`;
    me.foto_temp = u;
}

async function saveProfile() {
    const nick = document.getElementById('new-nick').value;
    const update = { nome: nick };
    if(me.foto_temp) update.foto = me.foto_temp;
    await db.collection('usuarios').doc(me.uid).update(update);
    closeProfile();
}

function closeProfile() { document.getElementById('modal-profile').classList.add('hidden'); }

function takePrint() {
    html2canvas(document.querySelector("#print-area")).then(canvas => {
        const link = document.createElement('a');
        link.download = 'resultado-copa.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

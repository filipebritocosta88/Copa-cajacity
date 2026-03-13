const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCopaId = null;
let chatMode = 'global'; 
let unreadCount = 0;
let selectedCopaType = 'liga';
let tempAvatar = '';

// --- AVATARES ---
const AVATARS = [
    {n: 'Messi', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163063.png'},
    {n: 'CR7', u: 'https://cdn-icons-png.flaticon.com/512/3220/3220138.png'},
    {n: 'Neymar', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163068.png'},
    {n: 'Pele', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163073.png'},
    {n: 'Mbappe', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163071.png'},
    {n: 'Vini', u: 'https://cdn-icons-png.flaticon.com/512/1163/1163069.png'},
    {n: 'Leao', u: 'https://cdn-icons-png.flaticon.com/512/616/616412.png'},
    {n: 'Macaco', u: 'https://cdn-icons-png.flaticon.com/512/616/616430.png'},
    {n: 'Cachorro', u: 'https://cdn-icons-png.flaticon.com/512/616/616408.png'},
    {n: 'Gato', u: 'https://cdn-icons-png.flaticon.com/512/616/616432.png'},
    {n: 'Meme1', u: 'https://cdn-icons-png.flaticon.com/512/2613/2613143.png'},
    {n: 'Meme2', u: 'https://cdn-icons-png.flaticon.com/512/3551/3551061.png'}
];

// --- CORE ---
setInterval(() => {
    document.getElementById('live-clock').innerText = new Date().toLocaleTimeString();
}, 1000);

function toggleAuth(t) {
    document.getElementById('screen-login').classList.toggle('hidden', t === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', t === 'login');
}

function navTo(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    el.classList.add('active');
}

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
            document.getElementById('top-nick').innerText = me.nome;
            if(me.foto) document.getElementById('top-avatar').style.backgroundImage = `url(${me.foto})`;
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
        .catch(e => alert("Erro ao entrar"));
}

async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const e = document.getElementById('r-email').value;
    const p = document.getElementById('r-pass').value;
    if(!n || p.length < 6) return alert("Nick curto ou senha fraca");
    const res = await auth.createUserWithEmailAndPassword(e, p);
    await db.collection('usuarios').doc(res.user.uid).set({
        nome: n, online: true, lastSeen: Date.now(), foto: '', stats: {vit:0, der:0, emp:0}, favs: []
    });
}

function doLogout() {
    db.collection('usuarios').doc(me.uid).update({online:false}).then(() => auth.signOut().then(()=>location.reload()));
}

// --- APP INIT ---
function initApp() {
    loadLobby();
    loadCopas();
    listenGlobalChat();
    listenInvites();
}

// --- LOBBY & RANKING ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let players = [];
        snap.forEach(d => players.push({id: d.id, ...d.data()}));
        
        // Sorting: Online > Favs > Nick
        players.sort((a,b) => (b.online - a.online) || (me.favs?.includes(b.id) - me.favs?.includes(a.id)));

        // Hall of Fame (Top 3)
        const sortedRank = [...players].sort((a,b) => b.stats.vit - a.stats.vit);
        document.getElementById('hall-fame').innerHTML = sortedRank.slice(0,3).map((p, i) => `
            <div style="display:inline-block; text-align:center; width:30%; font-size:0.6rem">
                <i class="fas fa-trophy ${i==0?'trophy-gold':i==1?'trophy-silver':'trophy-bronze'}" style="font-size:1.2rem"></i><br>
                <strong>${p.nome}</strong><br>${p.stats.vit} Vit
            </div>
        `).join('');

        // List
        const list = document.getElementById('lobby-list');
        list.innerHTML = players.map(p => `
            <div class="player-row">
                <div style="display:flex; align-items:center; gap:10px" onclick="showPlayerInfo('${p.id}')">
                    <div style="width:35px; height:35px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover"></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem">${p.nome} ${p.online?'<span style="color:#0f8">●</span>':''}</div>
                        <small style="color:var(--text-dim)">${p.stats.vit}V - ${p.stats.der}D</small>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px">
                    <i class="fa-star ${me.favs?.includes(p.id)?'fas active':'far'}" style="color:${me.favs?.includes(p.id)?'#ffbc00':'#444'}" onclick="toggleFav('${p.id}')"></i>
                    ${p.id !== me.uid ? `<button class="btn-glow" style="width:auto; padding:5px 10px; font-size:0.6rem" onclick="inviteFromLobby('${p.id}')">CONVIDAR</button>` : ''}
                </div>
            </div>
        `).join('');
    });
}

function toggleFav(id) {
    let newFavs = me.favs || [];
    if(newFavs.includes(id)) newFavs = newFavs.filter(x => x !== id);
    else newFavs.push(id);
    db.collection('usuarios').doc(me.uid).update({favs: newFavs});
}

// --- COPAS ---
function selectType(t) {
    selectedCopaType = t;
    document.getElementById('type-amistoso').style.borderColor = (t === 'amistoso' ? 'var(--primary)' : '#333');
    document.getElementById('type-liga').style.borderColor = (t === 'liga' ? 'var(--primary)' : '#333');
}

async function createCopa() {
    const n = document.getElementById('c-nome').value;
    if(!n) return alert("Nome da copa?");
    const res = await db.collection('campeonatos').add({
        nome: n, tipo: selectedCopaType, host: me.uid, 
        p: [me.uid], status: 'aberto', 
        tabela: { [me.uid]: {pts:0, v:0, e:0, d:0, sg:0, n:me.nome} },
        data: Date.now()
    });
    alert("Copa Criada!");
    openArena(res.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        const div = document.getElementById('copas-list');
        div.innerHTML = "<h4 style='margin:15px 0'>Competições</h4>";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="display:flex; justify-content:space-between">
                    <div><strong>${c.nome}</strong><br><small>${c.tipo}</small></div>
                    <div style="display:flex; gap:10px; align-items:center">
                        <i class="fas fa-trash" style="color:#ff4757" onclick="deleteCopa(event, '${doc.id}')"></i>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>`;
        });
    });
}

function deleteCopa(e, id) {
    e.stopPropagation();
    if(confirm("Excluir campeonato?")) db.collection('campeonatos').doc(id).delete();
}

function openArena(id) {
    currentCopaId = id;
    navTo('arena', document.querySelectorAll('.nav-item')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        if(!doc.exists) return;
        const c = doc.data();
        document.getElementById('arena-header').innerHTML = `<h2 style="color:var(--primary)">${c.nome}</h2><p style="font-size:0.7rem">${c.p.length} Participantes</p>`;
        switchArena('class');
    });
}

function switchArena(tab) {
    const body = document.getElementById('arena-body');
    db.collection('campeonatos').doc(currentCopaId).get().then(doc => {
        const c = doc.data();
        document.querySelectorAll('.arena-nav button').forEach(b => b.classList.remove('active'));
        if(tab === 'class') {
            document.getElementById('btn-tab-class').classList.add('active');
            let rows = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts);
            body.innerHTML = `<table style="width:100%; text-align:center; margin-top:10px">
                <tr style="color:var(--text-dim); font-size:0.7rem"><th>#</th><th>PLAYER</th><th>P</th><th>V</th><th>SG</th></tr>
                ${rows.map(([id, s], i) => `<tr><td>${i+1}</td><td>${s.n}</td><td style="color:var(--primary)">${s.pts}</td><td>${s.v}</td><td>${s.sg}</td></tr>`).join('')}
            </table>`;
        } else if(tab === 'info') {
            document.getElementById('btn-tab-info').classList.add('active');
            body.innerHTML = `
                <div class="card" style="margin-top:10px">
                    <h4>Convidar Jogador</h4>
                    <p style="font-size:0.6rem; color:var(--text-dim)">Envie um convite direto pelo Lobby.</p>
                    <div style="margin-top:10px">
                        ${c.p.map(pid => `<div style="font-size:0.8rem">✅ ${c.tabela[pid]?.n || 'Membro'}</div>`).join('')}
                    </div>
                </div>`;
        }
    });
}

// --- CHAT LOGIC (CORRIGIDA) ---
function toggleChatWindow() {
    const box = document.getElementById('chat-box');
    const isVisible = box.style.display === 'flex';
    box.style.display = isVisible ? 'none' : 'flex';
    if(!isVisible) {
        unreadCount = 0;
        document.getElementById('chat-badge').classList.add('hidden');
    }
}

function setChatMode(m) {
    chatMode = m;
    document.getElementById('btn-chat-global').classList.toggle('active', m === 'global');
    document.getElementById('btn-chat-copa').classList.toggle('active', m === 'copa');
    renderMessages();
}

function listenGlobalChat() {
    db.collection('chats').doc('global').collection('msgs').orderBy('t', 'desc').limit(30).onSnapshot(snap => {
        if(chatMode === 'global') renderMessages();
        if(document.getElementById('chat-box').style.display !== 'flex') {
            unreadCount += snap.docChanges().filter(change => change.type === 'added').length;
            if(unreadCount > 0) {
                document.getElementById('chat-badge').innerText = unreadCount;
                document.getElementById('chat-badge').classList.remove('hidden');
            }
        }
    });
}

async function renderMessages() {
    const box = document.getElementById('chat-msgs');
    const path = chatMode === 'global' ? db.collection('chats').doc('global').collection('msgs') : db.collection('campeonatos').doc(currentCopaId).collection('msgs');
    
    path.orderBy('t', 'asc').limitToLast(30).get().then(snap => {
        box.innerHTML = snap.docs.map(d => {
            const m = d.data();
            return `<div style="margin-bottom:8px"><strong>${m.u}:</strong> ${m.txt}</div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

function sendChatMsg() {
    const txt = document.getElementById('chat-input').value;
    if(!txt) return;
    const path = chatMode === 'global' ? db.collection('chats').doc('global').collection('msgs') : db.collection('campeonatos').doc(currentCopaId).collection('msgs');
    path.add({ u: me.nome, txt, t: Date.now() });
    document.getElementById('chat-input').value = "";
    setTimeout(renderMessages, 200);
}

// --- SETTINGS ---
function openSettings() {
    document.getElementById('modal-settings').classList.remove('hidden');
    document.getElementById('set-nick').value = me.nome;
    const grid = document.getElementById('avatar-selector');
    grid.innerHTML = AVATARS.map(a => `
        <div class="avatar-opt" style="background-image:url(${a.u})" onclick="selectAvatar('${a.u}', this)"></div>
    `).join('');
}

function selectAvatar(u, el) {
    tempAvatar = u;
    document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('set-avatar-preview').style.backgroundImage = `url(${u})`;
}

async function saveSettings() {
    const newNick = document.getElementById('set-nick').value;
    const update = { nome: newNick };
    if(tempAvatar) update.foto = tempAvatar;
    await db.collection('usuarios').doc(me.uid).update(update);
    closeSettings();
}

function closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); }

// --- PRINT ---
function saveAsImage() {
    html2canvas(document.querySelector("#print-zone")).then(canvas => {
        const link = document.createElement('a');
        link.download = 'copa-cajacity-result.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

function inviteFromLobby(pid) {
    if(!currentCopaId) return alert("Selecione uma copa na aba Arena antes de convidar!");
    db.collection('convites').add({ para: pid, deNick: me.nome, deUid: me.uid, copaId: currentCopaId, copaNome: "Torneio", status: 'p' });
    alert("Convite Enviado!");
}

function listenInvites() {
    db.collection('convites').where('para', '==', me.uid).where('status', '==', 'p').onSnapshot(snap => {
        snap.forEach(doc => {
            if(confirm(`Desafio de ${doc.data().deNick}. Aceitar?`)) {
                db.collection('campeonatos').doc(doc.data().copaId).update({
                    p: firebase.firestore.FieldValue.arrayUnion(me.uid),
                    [`tabela.${me.uid}`]: {pts:0, v:0, e:0, d:0, sg:0, n:me.nome}
                });
                db.collection('convites').doc(doc.id).update({status: 'a'});
            }
        });
    });
}

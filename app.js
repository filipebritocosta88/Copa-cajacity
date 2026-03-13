const auth = firebase.auth();
const db = firebase.firestore();
let userMe = null;
let lastChatCount = 0;
let favorites = JSON.parse(localStorage.getItem('fav_cajacity') || '[]');

// --- RELÓGIO ---
setInterval(() => {
    const now = new Date();
    const str = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if(document.getElementById('login-date')) document.getElementById('login-date').innerText = str;
    if(document.getElementById('header-time')) document.getElementById('header-time').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}, 1000);

// --- NAVEGAÇÃO ---
function toggleAuth(type) {
    document.getElementById('screen-login').classList.toggle('hidden', type === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', type === 'login');
}

function changeTab(tab, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    el.classList.add('active');
}

function toggleSidebar(s) { document.getElementById('sidebar').classList.toggle('active', s); }

function toggleChat() {
    const chat = document.getElementById('chat-container');
    const isVisible = chat.style.display === 'flex';
    chat.style.display = isVisible ? 'none' : 'flex';
    if(!isVisible) {
        document.getElementById('chat-badge').classList.add('hidden');
        lastChatCount = 0;
    }
}

// --- AUTH ---
async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const e = document.getElementById('r-email').value;
    const p = document.getElementById('r-pass').value;
    if(!n) return alert("Nick obrigatório");
    try {
        const res = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: n, online: true, foto: '', lastSeen: Date.now(), 
            stats: { vit:0, emp:0, der:0, gols:0, copas:0 },
            historico: [] 
        });
    } catch(err) { alert(err.message); }
}

function doLogin() {
    const e = document.getElementById('l-email').value;
    const p = document.getElementById('l-pass').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("Erro no login"));
}

function doLogout() {
    db.collection('usuarios').doc(userMe.uid).update({ online: false, lastSeen: Date.now() }).then(() => {
        auth.signOut().then(() => location.reload());
    });
}

auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            userMe = { uid: user.uid, ...doc.data() };
            document.getElementById('user-nick-top').innerText = userMe.nome;
            if(userMe.foto) document.getElementById('user-img-top').style.backgroundImage = `url(${userMe.foto})`;
            document.getElementById('auth-area').classList.add('hidden');
            document.getElementById('app-area').classList.remove('hidden');
            db.collection('usuarios').doc(user.uid).update({ online: true, lastSeen: Date.now() });
            initApp();
        });
    } else {
        document.getElementById('auth-area').classList.remove('hidden');
        document.getElementById('app-area').classList.add('hidden');
    }
});

// --- LOBBY INTELIGENTE ---
function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        const list = document.getElementById('lobby-list');
        let players = [];
        snap.forEach(doc => players.push({id: doc.id, ...doc.data()}));

        // Ordenação: Online -> Favoritos -> Recentes
        players.sort((a,b) => {
            if(a.online !== b.online) return b.online - a.online;
            const favA = favorites.includes(a.id);
            const favB = favorites.includes(b.id);
            if(favA !== favB) return favB - favA;
            return b.lastSeen - a.lastSeen;
        });

        list.innerHTML = players.map(p => `
            <div class="player-item ${p.online ? 'online' : ''}">
                <div style="display:flex; align-items:center; gap:10px; cursor:pointer" onclick="showPlayerStats('${p.id}')">
                    <div class="status-dot" style="background:${p.online ? '#0f8' : '#555'}"></div>
                    <div>
                        <div style="font-weight:700; font-size:0.9rem">${p.nome}</div>
                        <div style="font-size:0.6rem; color:var(--text-dim)">${p.online ? 'Disponível' : 'Visto por último ' + formatTime(p.lastSeen)}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px">
                    <i class="fas fa-star fav-star ${favorites.includes(p.id) ? 'active' : ''}" onclick="toggleFav('${p.id}')"></i>
                    ${p.id !== userMe.uid ? `<button class="tab-btn" style="background:var(--primary); color:#000" onclick="invitePlayer('${p.id}', '${p.nome}')">CONVIDAR</button>` : ''}
                </div>
            </div>
        `).join('');
    });
}

function formatTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if(diff < 1) return 'agora';
    if(diff < 60) return diff + 'm atrás';
    return Math.floor(diff/60) + 'h atrás';
}

function toggleFav(id) {
    if(favorites.includes(id)) favorites = favorites.filter(f => f !== id);
    else favorites.push(id);
    localStorage.setItem('fav_cajacity', JSON.stringify(favorites));
    loadLobby();
}

// --- CAMPEONATOS & CONVITES ---
async function createCompetition() {
    const nome = document.getElementById('c-nome').value;
    const tipo = document.getElementById('c-tipo').value;
    const matchlive = document.getElementById('c-matchlive').checked;
    const timesUnicos = document.getElementById('c-times-unicos').checked;
    const regras = document.getElementById('c-regras').value;

    if(!nome) return alert("Dê um nome!");

    const copRef = await db.collection('campeonatos').add({
        nome, tipo, matchlive, timesUnicos, regras,
        hostId: userMe.uid, hostNick: userMe.nome,
        status: 'inscricao', participantes: [userMe.uid],
        times: { [userMe.uid]: 'A definir' },
        tabela: { [userMe.uid]: { pts:0, j:0, v:0, e:0, d:0, gp:0, gc:0, sg:0 } },
        jogos: [], dataCriacao: Date.now()
    });
    alert("Copa Criada! Convide jogadores no Lobby.");
    changeTab('copas', document.querySelectorAll('.nav-link')[1]);
}

async function invitePlayer(pid, pnome) {
    const copas = await db.collection('campeonatos').where('hostId', '==', userMe.uid).get();
    if(copas.empty) return alert("Crie um campeonato primeiro!");
    
    // Pega a copa mais recente
    const cid = copas.docs[0].id;
    await db.collection('convites').add({
        para: pid, de: userMe.uid, deNick: userMe.nome,
        copaId: cid, copaNome: copas.docs[0].data().nome,
        status: 'pendente', data: Date.now()
    });
    alert("Convite enviado para " + pnome);
}

// Ouvir convites para mim
function listenInvites() {
    db.collection('convites').where('para', '==', userMe.uid).where('status', '==', 'pendente').onSnapshot(snap => {
        snap.forEach(doc => {
            const c = doc.data();
            if(confirm(`Desafio de ${c.deNick} para a copa: ${c.copaNome}. Aceitar?`)) {
                acceptInvite(doc.id, c.copaId);
            } else {
                db.collection('convites').doc(doc.id).update({ status: 'recusado' });
            }
        });
    });
}

async function acceptInvite(invId, cid) {
    const time = prompt("Escolha seu time para esta Copa:");
    if(!time) return;

    await db.collection('campeonatos').doc(cid).update({
        participantes: firebase.firestore.FieldValue.arrayUnion(userMe.uid),
        [`times.${userMe.uid}`]: time,
        [`tabela.${userMe.uid}`]: { pts:0, j:0, v:0, e:0, d:0, gp:0, gc:0, sg:0 }
    });
    await db.collection('convites').doc(invId).update({ status: 'aceito' });
    alert("Inscrito com sucesso!");
}

// --- ESTATÍSTICAS DETALHADAS ---
async function showPlayerStats(id) {
    const doc = await db.collection('usuarios').doc(id).get();
    const u = doc.data();
    const modal = document.getElementById('modal-stats');
    const content = document.getElementById('stats-content');

    // Lógica para achar o maior rival (exemplo simplificado)
    let rival = "Nenhum ainda";
    
    content.innerHTML = `
        <h2 style="color:var(--primary)">${u.nome}</h2>
        <div class="card" style="margin-top:20px">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:center">
                <div><small>Vitórias</small><br><strong>${u.stats.vit}</strong></div>
                <div><small>Empates</small><br><strong>${u.stats.emp}</strong></div>
                <div><small>Derrotas</small><br><strong>${u.stats.der}</strong></div>
                <div><small>Copas</small><br><strong>${u.stats.copas}</strong></div>
            </div>
        </div>
        <div class="card">
            <h4>Análise de Rival</h4>
            <p style="font-size:0.8rem">Usuário que mais venceu dele: <span style="color:#ff4757">${rival}</span></p>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeStats() { document.getElementById('modal-stats').classList.add('hidden'); }

// --- CHAT ---
function sendChat() {
    const input = document.getElementById('chat-input');
    if(!input.value) return;
    db.collection('chat_global').add({
        u: userMe.nome, t: input.value, time: Date.now(), uid: userMe.uid
    });
    input.value = "";
}

function listenChat() {
    db.collection('chat_global').orderBy('time', 'desc').limit(30).onSnapshot(snap => {
        const box = document.getElementById('chat-messages');
        const badge = document.getElementById('chat-badge');
        
        if(document.getElementById('chat-container').style.display !== 'flex') {
            lastChatCount += snap.docChanges().length;
            if(lastChatCount > 0) {
                badge.innerText = lastChatCount;
                badge.classList.remove('hidden');
            }
        }

        box.innerHTML = snap.docs.reverse().map(doc => {
            const m = doc.data();
            const isMe = m.uid === userMe.uid;
            return `<div style="align-self: ${isMe?'flex-end':'flex-start'}; max-width:80%">
                <small style="font-size:0.5rem; color:var(--text-dim)">${m.u}</small>
                <div style="background:${isMe? 'var(--grad)':'#222'}; color:${isMe?'#000':'#fff'}; padding:8px 12px; border-radius:12px; font-size:0.8rem">${m.t}</div>
            </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

// --- COPAS LIST ---
function loadCopas() {
    db.collection('campeonatos').orderBy('dataCriacao', 'desc').onSnapshot(snap => {
        const div = document.getElementById('copas-list');
        div.innerHTML = "<h4 style='margin:15px 0'>Campeonatos Ativos</h4>";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer; border-left:4px solid var(--primary)">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${c.nome}</strong>
                        <span style="font-size:0.6rem; color:var(--primary)">${c.tipo.toUpperCase()}</span>
                    </div>
                    <small style="color:var(--text-dim)">${c.participantes.length} Inscritos | MatchLive: ${c.matchlive ? 'ON' : 'OFF'}</small>
                </div>`;
        });
    });
}

function openArena(id) {
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    const area = document.getElementById('arena-content');
    
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        area.innerHTML = `
            <div class="card" style="text-align:center">
                <h2 style="color:var(--primary)">${c.nome}</h2>
                <small>${c.regras}</small>
            </div>
            <div class="nav-tabs-arena">
                <div class="tab-btn active">CLASSIFICAÇÃO</div>
                <div class="tab-btn">JOGOS</div>
                <div class="tab-btn">CHAVEAMENTO</div>
            </div>
            <div class="card">
                <table style="width:100%; font-size:0.8rem">
                    <tr style="color:var(--text-dim)"><th>POS</th><th>JOGADOR</th><th>P</th><th>V</th><th>SG</th></tr>
                    ${Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts).map(([uid, s], i) => `
                        <tr style="text-align:center">
                            <td style="padding:10px">${i+1}º</td>
                            <td style="text-align:left">${s.n || c.times[uid]}</td>
                            <td style="font-weight:800; color:var(--primary)">${s.pts}</td>
                            <td>${s.v}</td>
                            <td>${s.sg}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
    });
}

// Inicialização
function initApp() {
    loadLobby();
    listenChat();
    listenInvites();
    loadCopas();
}

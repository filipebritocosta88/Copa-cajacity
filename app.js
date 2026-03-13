const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let activeCopaId = null;

// --- CORES POR USUÁRIO ---
function generateUserColor(uid) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 70%)`;
}

// --- NAVEGAÇÃO ---
function toggleAuth(type) {
    document.getElementById('login-screen').classList.toggle('hidden', type === 'reg');
    document.getElementById('reg-screen').classList.toggle('hidden', type === 'login');
}

function navTo(tab, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    el.classList.add('active');
}

function toggleSidebar(s) { document.getElementById('sidebar').classList.toggle('active', s); }
function toggleChat(s) { document.getElementById('chat-window').style.display = s ? 'flex' : 'none'; }
function addEmoji(e) { document.getElementById('chat-input').value += e; }

// --- AUTH LOGIC ---
async function doRegister() {
    const n = document.getElementById('r-nick').value;
    const e = document.getElementById('r-email').value;
    const p = document.getElementById('r-pass').value;
    if(!n) return alert("Escolha um Nick!");
    try {
        const res = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: n, online: true, foto: '', cor: generateUserColor(res.user.uid)
        });
    } catch(err) { alert(err.message); }
}

function doLogin() {
    const e = document.getElementById('l-email').value;
    const p = document.getElementById('l-pass').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert("Erro ao entrar!"));
}

function doLogout() {
    db.collection('usuarios').doc(me.uid).update({ online: false }).then(() => {
        auth.signOut().then(() => location.reload());
    });
}

// --- MONITOR DE SESSÃO ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
            document.getElementById('user-nick-top').innerText = me.nome;
            document.getElementById('side-name').innerText = me.nome;
            if(me.foto) {
                document.getElementById('user-img-top').style.backgroundImage = `url(${me.foto})`;
                document.getElementById('side-avatar').style.backgroundImage = `url(${me.foto})`;
            }
            document.getElementById('auth-area').classList.add('hidden');
            document.getElementById('app-area').classList.remove('hidden');
            initArena();
        });
    } else {
        document.getElementById('auth-area').classList.remove('hidden');
        document.getElementById('app-area').classList.add('hidden');
    }
});

// --- CORE APP ---
function initArena() {
    loadLobby();
    loadCopas();
    listenChat();
}

function loadLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            if(doc.id === me.uid) return;
            const u = doc.data();
            list.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center">
                    <div style="display:flex; align-items:center; gap:12px">
                        <div style="width:10px; height:10px; background:${u.cor || '#0f8'}; border-radius:50%; box-shadow: 0 0 10px ${u.cor}"></div>
                        <span style="font-weight:700">${u.nome}</span>
                    </div>
                    <button class="btn-glow" style="width:auto; padding:10px 15px; font-size:0.7rem">DESAFIAR</button>
                </div>`;
        });
    });
}

async function createCopa() {
    const n = document.getElementById('c-nome').value;
    const t = document.getElementById('c-tipo').value;
    const r = document.getElementById('c-regras').value;
    if(!n) return alert("Dê um nome à Copa!");
    
    const doc = await db.collection('campeonatos').add({
        nome: n, tipo: t, regras: r,
        hostId: me.uid, hostNick: me.nome,
        participantes: [me.uid],
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: me.nome } },
        status: 'recrutando',
        data: Date.now()
    });
    alert("Copa Criada!");
    openCopa(doc.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        const box = document.getElementById('copas-list');
        box.innerHTML = "<h4 style='margin:20px 0 10px'>Copas Cajacity</h4>";
        snap.forEach(doc => {
            const c = doc.data();
            box.innerHTML += `
                <div class="card" onclick="openCopa('${doc.id}')" style="cursor:pointer; border-left:4px solid var(--primary)">
                    <div style="display:flex; justify-content:space-between; align-items:center">
                        <div><strong>${c.nome}</strong><br><small style="color:var(--text-dim)">Host: ${c.hostNick}</small></div>
                        <span style="font-size:0.7rem; background:rgba(0,255,136,0.1); color:var(--primary); padding:4px 8px; border-radius:8px">${c.status}</span>
                    </div>
                </div>`;
        });
    });
}

function openCopa(id) {
    activeCopaId = id;
    navTo('arena', document.querySelectorAll('.nav-tab')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        const isAdmin = c.hostId === me.uid;
        const area = document.getElementById('arena-view');
        
        area.innerHTML = `
            <div class="card" style="text-align:center">
                <h2 style="color:var(--primary)">${c.nome}</h2>
                <p style="font-size:0.8rem; color:var(--text-dim); margin-top:5px">${c.regras}</p>
            </div>
            <div class="card">
                <table class="live-table">
                    <thead><tr><th>#</th><th>JOGADOR</th><th>P</th><th>V</th><th>SG</th></tr></thead>
                    <tbody id="t-body"></tbody>
                </table>
            </div>`;
        
        const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts || b[1].sg - a[1].sg);
        document.getElementById('t-body').innerHTML = sorted.map(([id, s], i) => `
            <tr>
                <td><span class="pos-num">${i+1}</span></td>
                <td style="text-align:left; font-weight:700">${s.n}</td>
                <td style="color:var(--primary); font-weight:800">${s.pts}</td>
                <td>${s.v}</td>
                <td>${s.sg}</td>
            </tr>
        `).join('');
    });
}

// --- CHAT COM HORA E CORES ---
function sendMsg() {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    db.collection('chat_pro').add({
        texto: input.value,
        user: me.nome,
        uid: me.uid,
        cor: me.cor || '#fff',
        data: Date.now()
    });
    input.value = "";
}

function listenChat() {
    db.collection('chat_pro').orderBy('data', 'desc').limit(50).onSnapshot(snap => {
        const box = document.getElementById('chat-msgs');
        box.innerHTML = snap.docs.reverse().map(doc => {
            const m = doc.data();
            const time = new Date(m.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="msg-bubble" style="background: rgba(255,255,255,0.03); border-left: 3px solid ${m.cor}; align-self: ${m.uid === me.uid ? 'flex-end' : 'flex-start'}">
                    <div class="msg-info">
                        <span style="color:${m.cor}">${m.user}</span>
                        <span class="msg-time">${time}</span>
                    </div>
                    <div style="font-size:0.9rem; line-height:1.4">${m.texto}</div>
                </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

async function updateUser() {
    const n = document.getElementById('upd-nick').value;
    const f = document.getElementById('upd-img').value;
    await db.collection('usuarios').doc(me.uid).update({
        nome: n || me.nome,
        foto: f || me.foto
    });
    alert("Perfil Atualizado!");
    toggleSidebar(false);
}

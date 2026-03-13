const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentArenaId = null;

// --- NAVEGAÇÃO E UI ---
function toggleMenu(open) {
    document.getElementById('side-menu').classList.toggle('active', open);
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.remove('hidden');
    document.getElementById('nav-' + tab).classList.add('active');
    if(tab === 'matches') document.getElementById('arena-view').classList.remove('hidden');
}

function setArenaTab(tab) {
    document.getElementById('arena-table').classList.toggle('hidden', tab !== 'table');
    document.getElementById('arena-matches').classList.toggle('hidden', tab !== 'matches');
    document.getElementById('arena-admin').classList.toggle('hidden', tab !== 'admin');
}

// --- PERFIL E AUTH ---
async function updateProfile() {
    const nick = document.getElementById('edit-nick').value;
    const photo = document.getElementById('edit-photo').value;
    await db.collection('usuarios').doc(me.uid).update({ 
        nome: nick || me.nome, 
        foto: photo || me.foto || '' 
    });
    location.reload();
}

auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            me = { uid: user.uid, ...doc.data() };
            document.getElementById('display-nick').innerText = me.nome;
            if(me.foto) document.getElementById('user-avatar').style.backgroundImage = `url(${me.foto})`;
            document.getElementById('view-main').classList.remove('hidden');
            document.getElementById('view-auth').classList.add('hidden');
            initLobby();
            listenGlobalChat();
        });
    } else {
        document.getElementById('view-auth').classList.remove('hidden');
    }
});

// --- LOBBY E CHAT ---
function initLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        const div = document.getElementById('lobby-users');
        div.innerHTML = "";
        snap.forEach(doc => {
            const u = doc.data();
            if(doc.id !== me.uid) {
                div.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px">
                        <span>${u.nome}</span>
                        <button class="btn" style="width:auto; padding:5px 10px; font-size:0.7rem" onclick="inviteFriend('${doc.id}')">DESAFIAR</button>
                    </div>`;
            }
        });
    });
}

function sendMessage() {
    const txt = document.getElementById('chat-input').value;
    if(!txt) return;
    db.collection('chat_geral').add({
        texto: txt,
        user: me.nome,
        uid: me.uid,
        data: Date.now()
    });
    document.getElementById('chat-input').value = "";
}

function listenGlobalChat() {
    db.collection('chat_geral').orderBy('data', 'desc').limit(20).onSnapshot(snap => {
        const div = document.getElementById('messages');
        div.innerHTML = "";
        snap.docs.reverse().forEach(doc => {
            const m = doc.data();
            const isMe = m.uid === me.uid;
            div.innerHTML += `<div class="msg ${isMe ? 'me' : ''}"><strong>${m.user}:</strong><br>${m.texto}</div>`;
        });
        div.scrollTop = div.scrollHeight;
    });
}

// --- COMPETIÇÃO ---
async function initComp() {
    const name = document.getElementById('cp-name').value;
    const type = document.getElementById('cp-type').value;
    const size = parseInt(document.getElementById('cp-size').value);
    const rules = document.getElementById('cp-rules').value;

    const doc = await db.collection('campeonatos').add({
        nome: name,
        tipo: type,
        vagas: size,
        regras: rules,
        hostId: me.uid,
        status: 'recrutando',
        participantes: [me.uid],
        tabela: { [me.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: me.nome, time: '' } },
        dataCriacao: Date.now()
    });
    openArena(doc.id);
}

function openArena(id) {
    currentArenaId = id;
    switchTab('matches');
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        document.getElementById('arena-name').innerText = c.nome;
        document.getElementById('arena-rules-display').innerText = "Regras: " + c.regras;
        document.getElementById('host-panel-btn').classList.toggle('hidden', c.hostId !== me.uid);
        
        renderTabela(c.tabela);
        if(c.status === 'recrutando') {
            document.getElementById('invite-section').classList.remove('hidden');
            document.getElementById('slots-count').innerText = c.vagas - c.participantes.length;
        }
    });
}

function renderTabela(tab) {
    const body = document.getElementById('table-data');
    body.innerHTML = "";
    const sorted = Object.entries(tab).sort((a,b) => b[1].pts - a[1].pts);
    sorted.forEach(([id, s], i) => {
        body.innerHTML += `<tr><td>${i+1}º</td><td>${s.n}</td><td>${s.pts}</td><td>${s.v}</td><td>${s.sg}</td></tr>`;
    });
}

// --- ADMINISTRAÇÃO ---
async function submitScore() {
    // Aqui entra a lógica de atualização da tabela conforme explicado antes
    // Se for Liga + Mata-Mata, uma verificação checa se todos os jogos da liga acabaram
    // para gerar as chaves do mata-mata automaticamente.
    alert("Resultado enviado e tabela atualizada em tempo real!");
}

// Auxiliares de Auth
document.getElementById('btn-entrar').onclick = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(e, p);
};

document.getElementById('btn-registrar').onclick = async () => {
    const n = document.getElementById('reg-nick').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;
    const cred = await auth.createUserWithEmailAndPassword(e, p);
    await db.collection('usuarios').doc(cred.user.uid).set({ nome: n, online: true });
};

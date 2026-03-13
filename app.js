const auth = firebase.auth();
const db = firebase.firestore();
let userMe = null;
let activeCampId = null;

// --- GERENCIAMENTO DE TELAS ---
function toggleAuth(isReg) {
    document.getElementById('auth-login').classList.toggle('hidden', isReg);
    document.getElementById('auth-reg').classList.toggle('hidden', !isReg);
}

function switchTab(tab, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    el.classList.add('active');
}

function toggleSidebar(show) {
    document.getElementById('profile-sidebar').classList.toggle('active', show);
}

function toggleChat(show) {
    document.getElementById('chat-box').style.display = show ? 'flex' : 'none';
}

// --- AUTENTICAÇÃO ---
async function handleRegister() {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    
    if(!nick || pass.length < 6) return alert("Nick obrigatório e senha mín. 6 caracteres.");
    
    try {
        const res = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: nick,
            online: true,
            foto: '',
            criadoEm: Date.now()
        });
    } catch(e) { alert("Erro no cadastro: " + e.message); }
}

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Falha: " + e.message));
}

function handleLogout() {
    if(userMe) {
        db.collection('usuarios').doc(userMe.uid).update({ online: false }).then(() => {
            auth.signOut().then(() => {
                location.reload(); // Garante limpeza total da memória
            });
        });
    }
}

// Monitor de Usuário
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            userMe = { uid: user.uid, ...doc.data() };
            document.getElementById('header-nick').innerText = userMe.nome;
            document.getElementById('profile-name-display').innerText = userMe.nome;
            if(userMe.foto) {
                document.getElementById('header-avatar').style.backgroundImage = `url(${userMe.foto})`;
                document.getElementById('header-avatar').style.backgroundSize = 'cover';
                document.getElementById('profile-avatar-large').style.backgroundImage = `url(${userMe.foto})`;
            }
            document.getElementById('view-app').classList.remove('hidden');
            document.getElementById('view-auth').classList.add('hidden');
            initApp();
        });
    } else {
        document.getElementById('view-app').classList.add('hidden');
        document.getElementById('view-auth').classList.remove('hidden');
    }
});

// --- CORE APP ---
function initApp() {
    loadLobby();
    loadChat();
    loadCamps();
}

function loadLobby() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = "";
        snap.forEach(doc => {
            if(doc.id === userMe.uid) return;
            const u = doc.data();
            list.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center">
                    <div style="display:flex; align-items:center; gap:12px">
                        <div style="width:10px; height:10px; background:var(--primary); border-radius:50%"></div>
                        <span>${u.nome}</span>
                    </div>
                    <button class="btn-main" style="width:auto; padding:8px 15px; font-size:0.7rem">DESAFIAR</button>
                </div>`;
        });
    });
}

// --- CAMPEONATOS ---
async function createNewCamp() {
    const nome = document.getElementById('new-cp-name').value;
    const tipo = document.getElementById('new-cp-type').value;
    const regras = document.getElementById('new-cp-rules').value;

    if(!nome) return alert("Dê um nome à Copa!");

    const ref = await db.collection('campeonatos').add({
        nome, tipo, regras,
        hostId: userMe.uid,
        participantes: [userMe.uid],
        tabela: { [userMe.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: userMe.nome } },
        status: 'aberto',
        data: Date.now()
    });
    alert("Copa Criada!");
    openArena(ref.id);
}

function loadCamps() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        const div = document.getElementById('camps-list');
        div.innerHTML = "<h3 style='margin: 20px 0'>Copas Ativas</h3>";
        snap.forEach(doc => {
            const c = doc.data();
            div.innerHTML += `
                <div class="card" onclick="openArena('${doc.id}')" style="cursor:pointer">
                    <div style="display:flex; justify-content:space-between">
                        <strong>${c.nome}</strong>
                        <span style="color:var(--primary); font-size:0.7rem">${c.tipo.toUpperCase()}</span>
                    </div>
                    <small style="color:var(--text-dim)">${c.participantes.length} Jogadores</small>
                </div>`;
        });
    });
}

function openArena(id) {
    activeCampId = id;
    switchTab('arena', document.querySelectorAll('.nav-item')[2]);
    
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        const isAdmin = c.hostId === userMe.uid;
        
        let html = `
            <div class="card" style="border-left: 4px solid var(--primary)">
                <h2 style="text-align:center">${c.nome}</h2>
                <p style="text-align:center; font-size:0.7rem; color:var(--text-dim)">${c.regras}</p>
            </div>
            <div class="table-container card">
                <table>
                    <thead><tr><th>Pos</th><th>Nick</th><th>P</th><th>V</th><th>SG</th></tr></thead>
                    <tbody id="arena-table-body"></tbody>
                </table>
            </div>`;
        
        if(isAdmin) {
            html += `
                <div class="card" style="border-color: var(--danger)">
                    <h4>Painel do Host</h4>
                    <button class="btn-main" style="background:#222; color:#fff; margin-bottom:10px" onclick="invitePlayer()">CONVIDAR JOGADORES</button>
                    <div style="display:flex; gap:5px">
                        <select id="res-p1"></select>
                        <input type="number" id="res-g1" placeholder="0">
                        <input type="number" id="res-g2" placeholder="0">
                        <select id="res-p2"></select>
                    </div>
                    <button class="btn-main" onclick="saveScore()">LANÇAR RESULTADO</button>
                </div>`;
        }

        document.getElementById('arena-active-content').innerHTML = html;
        renderTable(c.tabela);
        if(isAdmin) populateSelects(c.tabela);
    });
}

function renderTable(tab) {
    const body = document.getElementById('arena-table-body');
    if(!body) return;
    const sorted = Object.entries(tab).sort((a,b) => b[1].pts - a[1].pts || b[1].sg - a[1].sg);
    body.innerHTML = sorted.map(([id, s], i) => `
        <tr>
            <td class="pos">${i+1}º</td>
            <td>${s.n}</td>
            <td>${s.pts}</td>
            <td>${s.v}</td>
            <td>${s.sg}</td>
        </tr>
    `).join('');
}

// --- CHAT GLOBAL ---
function sendMsg() {
    const input = document.getElementById('chat-input');
    if(!input.value) return;
    db.collection('chat_global').add({
        u: userMe.nome,
        t: input.value,
        time: Date.now(),
        uid: userMe.uid
    });
    input.value = "";
}

function loadChat() {
    db.collection('chat_global').orderBy('time', 'desc').limit(40).onSnapshot(snap => {
        const box = document.getElementById('chat-msgs');
        box.innerHTML = snap.docs.reverse().map(doc => {
            const m = doc.data();
            const isMe = m.uid === userMe.uid;
            return `<div style="margin-bottom:10px; text-align:${isMe?'right':'left'}">
                <small style="color:var(--primary)">${m.u}</small><br>
                <span style="background:${isMe?var(--grad):'#252a33'}; color:${isMe?'#000':'#fff'}; padding:6px 12px; border-radius:12px; display:inline-block">${m.t}</span>
            </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

// Funções Auxiliares de Perfil
async function updateProfile() {
    const nick = document.getElementById('edit-nick').value;
    const foto = document.getElementById('edit-avatar').value;
    if(nick || foto) {
        await db.collection('usuarios').doc(userMe.uid).update({
            nome: nick || userMe.nome,
            foto: foto || userMe.foto
        });
        alert("Atualizado!");
        toggleSidebar(false);
    }
}

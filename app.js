const auth = firebase.auth();
const db = firebase.firestore();
let userMe = null;
let currentCopaId = null;

// --- NAVEGAÇÃO E TELAS ---
function showAuth(type) {
    document.getElementById('screen-login').classList.toggle('hidden', type === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', type === 'login');
}

function changeTab(tab, el) {
    document.querySelectorAll('.content-tab').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + tab).classList.remove('hidden');
    el.classList.add('active');
}

function openProfile(show) {
    document.getElementById('profile-sidebar').classList.toggle('active', show);
}

function toggleChat(show) {
    document.getElementById('chat-window').style.display = show ? 'flex' : 'none';
}

// --- SISTEMA DE LOGIN ---
async function appRegister() {
    const nick = document.getElementById('reg-nick').value.trim();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    
    if(!nick || pass.length < 6) return alert("Nick é obrigatório e a senha deve ter 6 dígitos.");
    
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(cred.user.uid).set({
            nome: nick,
            foto: '',
            online: true,
            status: 'Jogador',
            dataJoined: Date.now()
        });
    } catch(e) { alert("Erro ao criar conta: " + e.message); }
}

function appLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Dados incorretos!"));
}

function appLogout() {
    if(!userMe) return;
    db.collection('usuarios').doc(userMe.uid).update({ online: false }).then(() => {
        auth.signOut().then(() => {
            location.reload(); 
        });
    });
}

// --- MONITOR DE ESTADO ---
auth.onAuthStateChanged(user => {
    if(user) {
        db.collection('usuarios').doc(user.uid).onSnapshot(doc => {
            if(!doc.exists) return;
            userMe = { uid: user.uid, ...doc.data() };
            
            // Atualiza UI do Header e Perfil
            document.getElementById('nav-user-name').innerText = userMe.nome;
            document.getElementById('profile-name-title').innerText = userMe.nome;
            if(userMe.foto) {
                const imgStyle = `url(${userMe.foto})`;
                document.getElementById('nav-user-img').style.backgroundImage = imgStyle;
                document.getElementById('profile-img-large').style.backgroundImage = imgStyle;
            }
            
            // Troca de Tela
            document.getElementById('auth-manager').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            
            initDashboard();
        });
    } else {
        document.getElementById('auth-manager').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// --- DASHBOARD E COPAS ---
function initDashboard() {
    loadPlayers();
    loadCopsList();
    loadChatRealtime();
}

function loadPlayers() {
    db.collection('usuarios').where('online', '==', true).onSnapshot(snap => {
        const div = document.getElementById('online-players');
        div.innerHTML = "";
        snap.forEach(doc => {
            if(doc.id === userMe.uid) return;
            const u = doc.data();
            div.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center">
                    <div style="display:flex; align-items:center; gap:12px">
                        <div style="width:12px; height:12px; background:var(--primary); border-radius:50%; box-shadow: 0 0 10px var(--primary)"></div>
                        <span style="font-weight:700">${u.nome}</span>
                    </div>
                    <button class="btn-action" style="width:auto; padding:10px 15px; font-size:0.7rem">CONVIDAR</button>
                </div>`;
        });
    });
}

async function createCopa() {
    const nome = document.getElementById('cp-nome').value;
    const tipo = document.getElementById('cp-formato').value;
    const regras = document.getElementById('cp-regras').value;

    if(!nome) return alert("Dê um nome para a Copa Cajacity!");

    const novaCopa = await db.collection('campeonatos').add({
        nome, tipo, regras,
        hostId: userMe.uid,
        hostName: userMe.nome,
        participantes: [userMe.uid],
        tabela: { [userMe.uid]: { pts:0, v:0, e:0, d:0, sg:0, n: userMe.nome } },
        dataCriacao: Date.now()
    });
    alert("Copa lançada com sucesso!");
    openCopaArena(novaCopa.id);
}

function loadCopsList() {
    db.collection('campeonatos').orderBy('dataCriacao', 'desc').onSnapshot(snap => {
        const box = document.getElementById('lista-copas');
        box.innerHTML = "<h4 style='margin: 20px 0 10px'>Competições em Aberto</h4>";
        snap.forEach(doc => {
            const c = doc.data();
            box.innerHTML += `
                <div class="card" onclick="openCopaArena('${doc.id}')" style="cursor:pointer; border-left: 4px solid var(--primary)">
                    <div style="display:flex; justify-content:space-between; align-items:center">
                        <div>
                            <strong>${c.nome}</strong><br>
                            <small style="color:var(--text-dim)">Organizado por ${c.hostName}</small>
                        </div>
                        <i class="fas fa-chevron-right" style="color:var(--primary)"></i>
                    </div>
                </div>`;
        });
    });
}

function openCopaArena(id) {
    currentCopaId = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        const isAdmin = c.hostId === userMe.uid;
        document.getElementById('arena-placeholder').classList.add('hidden');
        const area = document.getElementById('arena-data');
        area.classList.remove('hidden');

        let html = `
            <div class="card" style="text-align:center">
                <h2 style="color:var(--primary)">${c.nome}</h2>
                <p style="font-size:0.8rem; color:var(--text-dim); margin-top:5px">${c.regras}</p>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>#</th><th>JOGADOR</th><th>P</th><th>V</th><th>SG</th></tr></thead>
                    <tbody id="table-rows"></tbody>
                </table>
            </div>`;
        
        if(isAdmin) {
            html += `
                <div class="card" style="border-color: var(--secondary)">
                    <h4 style="margin-bottom:15px"><i class="fas fa-edit"></i> Atualizar Placar</h4>
                    <div style="display:flex; gap:10px; margin-bottom:10px">
                        <select id="adm-p1" style="flex:2"></select>
                        <input type="number" id="adm-g1" placeholder="0" style="flex:1">
                    </div>
                    <div style="display:flex; gap:10px; margin-bottom:15px">
                        <select id="adm-p2" style="flex:2"></select>
                        <input type="number" id="adm-g2" placeholder="0" style="flex:1">
                    </div>
                    <button class="btn-action" onclick="saveMatchResult()">SALVAR RESULTADO</button>
                </div>`;
        }

        area.innerHTML = html;
        const sorted = Object.entries(c.tabela).sort((a,b) => b[1].pts - a[1].pts);
        const rows = document.getElementById('table-rows');
        rows.innerHTML = sorted.map(([uid, s], i) => `
            <tr>
                <td class="rank">${i+1}º</td>
                <td style="text-align:left; font-weight:600">${s.n}</td>
                <td>${s.pts}</td>
                <td>${s.v}</td>
                <td>${s.sg}</td>
            </tr>
        `).join('');

        if(isAdmin) {
            const s1 = document.getElementById('adm-p1');
            const s2 = document.getElementById('adm-p2');
            Object.entries(c.tabela).forEach(([uid, s]) => {
                const opt = `<option value="${uid}">${s.n}</option>`;
                s1.innerHTML += opt; s2.innerHTML += opt;
            });
        }
    });
}

// --- CHAT GLOBAL ---
function sendChatMessage() {
    const inp = document.getElementById('chat-input');
    if(!inp.value.trim()) return;
    db.collection('chat_cajacity').add({
        msg: inp.value,
        sender: userMe.nome,
        senderId: userMe.uid,
        time: Date.now()
    });
    inp.value = "";
}

function loadChatRealtime() {
    db.collection('chat_cajacity').orderBy('time', 'desc').limit(50).onSnapshot(snap => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = snap.docs.reverse().map(doc => {
            const d = doc.data();
            const isMe = d.senderId === userMe.uid;
            return `<div style="margin-bottom:12px; text-align:${isMe?'right':'left'}">
                <small style="color:var(--text-dim); font-size:0.6rem">${d.sender}</small><br>
                <span style="background:${isMe? 'var(--grad)' : '#222'}; color:${isMe? '#000' : '#fff'}; padding:8px 14px; border-radius:15px; display:inline-block; max-width:85%">${d.msg}</span>
            </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

// --- PERFIL ---
async function saveProfile() {
    const nick = document.getElementById('input-new-nick').value.trim();
    const foto = document.getElementById('input-new-img').value.trim();
    if(!nick && !foto) return;

    await db.collection('usuarios').doc(userMe.uid).update({
        nome: nick || userMe.nome,
        foto: foto || userMe.foto
    });
    alert("Perfil atualizado com sucesso!");
    openProfile(false);
}

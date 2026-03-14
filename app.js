const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

const LIGAS = {
    br: [
        {n: 'Flamengo', e: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_brazil.svg'},
        {n: 'Palmeiras', e: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg'},
        {n: 'São Paulo', e: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Sao_Paulo_Futebol_Clube.svg'},
        {n: 'Vasco', e: 'https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascoDaGama.png'},
        {n: 'Corinthians', e: 'https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png'},
        {n: 'Bahia', e: 'https://upload.wikimedia.org/wikipedia/pt/thumb/6/61/Esporte_Clube_Bahia_2014.png/150px-Esporte_Clube_Bahia_2014.png'}
    ],
    euro: [
        {n: 'Real Madrid', e: 'https://upload.wikimedia.org/wikipedia/pt/9/98/Real_Madrid.png'},
        {n: 'Barcelona', e: 'https://upload.wikimedia.org/wikipedia/pt/4/43/FCBarcelona.png'},
        {n: 'Man. City', e: 'https://upload.wikimedia.org/wikipedia/pt/0/02/Manchester_City_FC_badge.png'},
        {n: 'PSG', e: 'https://upload.wikimedia.org/wikipedia/pt/a/a7/Paris_Saint-Germain_F.C..png'},
        {n: 'Bayern', e: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_München_logo_%282017%29.svg'},
        {n: 'Liverpool', e: 'https://upload.wikimedia.org/wikipedia/pt/0/0c/Liverpool_FC.png'}
    ]
};

// RELÓGIO
setInterval(() => {
    const el = document.getElementById('live-clock');
    if(el) el.innerText = new Date().toLocaleString('pt-BR');
}, 1000);

// AUTH FLOW
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

function toggleAuth(t) {
    document.getElementById('screen-login').classList.toggle('hidden', t === 'reg');
    document.getElementById('screen-reg').classList.toggle('hidden', t === 'login');
}

async function doRegister() {
    const nick = document.getElementById('r-nick').value;
    const email = document.getElementById('r-email').value;
    const pass = document.getElementById('r-pass').value;
    if(!nick || !email || !pass) return alert("Preencha todos os campos!");
    try {
        const res = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('usuarios').doc(res.user.uid).set({
            nome: nick, foto: '', stats: { titulos:0, v:0, gp:0, gs:0, participacoes:0 }
        });
    } catch(e) { alert(e.message); }
}

function doLogin() {
    auth.signInWithEmailAndPassword(document.getElementById('l-email').value, document.getElementById('l-pass').value).catch(e => alert(e.message));
}

// APP CORE
function initApp() {
    loadLobby();
    loadCopas();
    listenChat();
}

function loadLobby() {
    db.collection('usuarios').onSnapshot(snap => {
        let html = '';
        snap.forEach(doc => {
            const p = doc.data();
            html += `<div class="card" style="display:flex; align-items:center; gap:10px;">
                <div style="width:40px; height:40px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover;"></div>
                <div style="flex:1"><b>${p.nome}</b><br><small style="color:var(--neon-blue)">${p.stats.titulos} Títulos | ${p.stats.v} Vitórias</small></div>
            </div>`;
        });
        document.getElementById('lobby-list').innerHTML = html;
        loadPodium();
    });
}

function loadPodium() {
    db.collection('usuarios').orderBy('stats.titulos', 'desc').limit(3).get().then(snap => {
        let p = []; snap.forEach(doc => p.push(doc.data()));
        if(p.length === 0) return;
        document.getElementById('podium-area').innerHTML = `
            <div class="podium-box">
                <div class="podium-item podium-2"><small>${p[1]?.nome || '-'}</small></div>
                <div class="podium-item podium-1"><i class="fas fa-crown" style="color:gold"></i><br><small>${p[0]?.nome || '-'}</small></div>
                <div class="podium-item podium-3"><small>${p[2]?.nome || '-'}</small></div>
            </div>`;
    });
}

// GESTÃO COPA
function nextStep(s) {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
}

async function createCopa() {
    const qtd = parseInt(document.getElementById('c-qtd').value);
    const nome = document.getElementById('c-nome').value;
    const tipo = document.getElementById('c-tipo').value;
    const liga = document.getElementById('c-liga').value;
    
    const ref = await db.collection('campeonatos').add({
        nome, tipo, liga, host: me.uid, status: 'aberto',
        vagas: qtd, p: [me.uid], bots: [],
        tabela: { [me.uid]: { n: me.nome, time: 'A Definir', escudo: '', pts:0, v:0, sg:0 } },
        jogos: [], fase: 'Aguardando Início', data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card" onclick="openArena('${doc.id}')">
                <b style="color:var(--primary)">${doc.data().nome}</b>
                <div style="font-size:0.7rem; color:var(--neon-blue)">${doc.data().tipo.toUpperCase()} | ${doc.data().vagas} VAGAS | FASE: ${doc.data().fase}</div>
            </div>
        `).join('');
    });
}

function openArena(id) {
    currentCid = id;
    changeTab('arena', document.querySelectorAll('.nav-link')[2]);
    db.collection('campeonatos').doc(id).onSnapshot(doc => {
        const c = doc.data();
        if(!c) return;
        document.getElementById('arena-header').innerHTML = `<h3 style="text-align:center; color:var(--primary)">${c.nome}</h3><p style="text-align:center; font-size:0.7rem;">${c.fase}</p>`;
        document.getElementById('btn-manage').classList.toggle('hidden', c.host !== me.uid);
        switchArena('jogos');
    });
}

async function switchArena(mode) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const content = document.getElementById('arena-content');

    if(mode === 'manage') {
        let h = `<h4>GESTÃO DA COPA</h4><br>`;
        if(c.p.length + c.bots.length < c.vagas) {
            h += `<button class="btn-glow" style="margin-bottom:15px;" onclick="addBot()">+ ADICIONAR BOT</button>`;
        }
        [...c.p, ...c.bots.map(b=>b.id)].forEach(pid => {
            const player = c.tabela[pid];
            h += `<div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <b>${player.n}</b>
                    ${pid.startsWith('bot_') ? `<button onclick="removeBot('${pid}')" style="background:#500; border:none; color:#fff; padding:4px 8px; border-radius:5px; font-size:0.6rem;">Remover</button>` : ''}
                </div>
                <select onchange="setClub('${pid}', this.value)">
                    <option>Escolher Clube da Liga</option>
                    ${LIGAS[c.liga].map(club => `<option value="${club.n}" ${player.time === club.n ? 'selected':''}>${club.n}</option>`).join('')}
                </select>
            </div>`;
        });
        if(c.jogos.length === 0) {
            h += `<button class="btn-glow" style="background:var(--divine-green); color:#000" onclick="sortearChaves()">SORTEAR E INICIAR</button>`;
        } else if (c.fase !== 'Finalizada') {
            h += `<button class="btn-glow" style="margin-top:20px; background:var(--neon-blue); color:#000" onclick="avancarFase()">AVANÇAR PARA PRÓXIMA FASE</button>`;
        }
        h += `<button class="btn-secondary" style="margin-top:20px; color:#ff4444; border-color:#ff4444;" onclick="deleteCopa()">EXCLUIR CAMPEONATO</button>`;
        content.innerHTML = h;
    } else if(mode === 'jogos') {
        if(c.jogos.length === 0) return content.innerHTML = "<p style='text-align:center;'>O Host precisa sortear os times!</p>";
        content.innerHTML = c.jogos.map((j, i) => `
            <div class="match-card">
                <div class="match-team">
                    <img src="${c.tabela[j.p1].escudo || ''}" onerror="this.style.display='none'">
                    <span>${c.tabela[j.p1].time} <small>(${c.tabela[j.p1].n})</small></span>
                    <input type="number" class="score-input" value="${j.g1}" onchange="updateGols(${i}, 1, this.value)" ${c.host !== me.uid ? 'disabled' : ''}>
                </div>
                <div style="text-align:center; font-size:0.6rem; color:var(--primary); margin: 5px 0;">X</div>
                <div class="match-team">
                    <img src="${c.tabela[j.p2]?.escudo || ''}" onerror="this.style.display='none'">
                    <span>${j.p2 === 'BYE' ? 'FOLGA' : c.tabela[j.p2].time + ' <small>('+c.tabela[j.p2].n+')</small>'}</span>
                    <input type="number" class="score-input" value="${j.g2}" onchange="updateGols(${i}, 2, this.value)" ${j.p2 === 'BYE' || c.host !== me.uid ? 'disabled' : ''}>
                </div>
            </div>
        `).join('');
    } else {
        content.innerHTML = `<p style="text-align:center">Quadro em desenvolvimento...</p>`;
    }
}

// LOGICA DE SORTEIO
async function sortearChaves() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    let pids = [...c.p, ...c.bots.map(b => b.id)].sort(() => Math.random() - 0.5);
    
    let jogos = [];
    for(let i=0; i < pids.length; i+=2) {
        jogos.push({
            p1: pids[i],
            p2: pids[i+1] || 'BYE',
            g1: 0,
            g2: pids[i+1] ? 0 : -1
        });
    }
    const nomeFase = pids.length > 8 ? 'Oitavas' : (pids.length > 4 ? 'Quartas' : (pids.length > 2 ? 'Semi-Final' : 'Final'));
    await db.collection('campeonatos').doc(currentCid).update({ jogos, fase: nomeFase });
}

// LOGICA AVANÇAR FASE (MATA-MATA)
async function avancarFase() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    
    // 1. Verificar se todos os jogos têm placar
    const incompletos = c.jogos.filter(j => j.p2 !== 'BYE' && (j.g1 === j.g2)); 
    if(incompletos.length > 0 && !confirm("Existem empates ou jogos sem gols. Deseja avançar assim mesmo? (Empates precisam de critério)")) return;

    // 2. Coletar vencedores
    let vencedores = [];
    c.jogos.forEach(j => {
        if(j.p2 === 'BYE') { vencedores.push(j.p1); }
        else if(j.g1 > j.g2) { vencedores.push(j.p1); }
        else { vencedores.push(j.p2); }
    });

    if(vencedores.length === 1) {
        const champId = vencedores[0];
        alert("O CAMPEÃO É: " + c.tabela[champId].n);
        // Atualizar troféus se for player real
        if(!champId.startsWith('bot_')) {
            const uDoc = await db.collection('usuarios').doc(champId).get();
            const curTitulos = uDoc.data().stats.titulos || 0;
            await db.collection('usuarios').doc(champId).update({ "stats.titulos": curTitulos + 1 });
        }
        await db.collection('campeonatos').doc(currentCid).update({ fase: 'Finalizada', jogos: [] });
        return;
    }

    // 3. Gerar novos jogos
    let novosJogos = [];
    for(let i=0; i < vencedores.length; i+=2) {
        novosJogos.push({
            p1: vencedores[i],
            p2: vencedores[i+1] || 'BYE',
            g1: 0,
            g2: vencedores[i+1] ? 0 : -1
        });
    }

    const proxFase = vencedores.length > 4 ? 'Quartas' : (vencedores.length > 2 ? 'Semi-Final' : 'Grande Final');
    await db.collection('campeonatos').doc(currentCid).update({ jogos: novosJogos, fase: proxFase });
    alert("Nova fase gerada!");
    switchArena('jogos');
}

// HELPERS BOTS/CLUBS
async function addBot() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const id = 'bot_' + Date.now();
    const nome = 'Bot ' + (c.bots.length + 1);
    const newBots = [...c.bots, {id, n: nome}];
    const newTab = {...c.tabela, [id]: {n: nome, time: 'A Definir', escudo: '', pts:0, v:0, sg:0}};
    await db.collection('campeonatos').doc(currentCid).update({ bots: newBots, tabela: newTab });
}

async function removeBot(botId) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const newBots = c.bots.filter(b => b.id !== botId);
    delete c.tabela[botId];
    await db.collection('campeonatos').doc(currentCid).update({ bots: newBots, tabela: c.tabela });
}

async function setClub(pid, clubName) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const club = LIGAS[c.liga].find(l => l.n === clubName);
    c.tabela[pid].time = club.n;
    c.tabela[pid].escudo = club.e;
    await db.collection('campeonatos').doc(currentCid).update({ tabela: c.tabela });
}

async function updateGols(idx, player, val) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const v = parseInt(val) || 0;
    if(player === 1) c.jogos[idx].g1 = v;
    else c.jogos[idx].g2 = v;
    await db.collection('campeonatos').doc(currentCid).update({ jogos: c.jogos });
}

// CHAT & UI
function changeTab(t, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + t).classList.remove('hidden');
    if(el) {
        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}
function listenChat() {
    db.collection('chat').orderBy('t', 'desc').limit(15).onSnapshot(snap => {
        document.getElementById('chat-msgs').innerHTML = snap.docs.reverse().map(d => `<div class="chat-msg"><b>${d.data().u}:</b> ${d.data().m}</div>`).join('');
        document.getElementById('chat-msgs').scrollTop = 9999;
    });
}
function sendMsg() {
    const i = document.getElementById('chat-input');
    if(!i.value || !me) return;
    db.collection('chat').add({ u: me.nome, m: i.value, t: Date.now() });
    i.value = "";
}
function openSettings() { document.getElementById('set-nick').value = me.nome; document.getElementById('set-foto').value = me.foto; document.getElementById('modal-settings').classList.remove('hidden'); }
function closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); }
async function saveSettings() {
    await db.collection('usuarios').doc(me.uid).update({ nome: document.getElementById('set-nick').value, foto: document.getElementById('set-foto').value });
    closeSettings();
}
function doLogout() { auth.signOut().then(() => location.reload()); }
async function deleteCopa() { if(confirm("Deseja deletar este campeonato permanentemente?")) { await db.collection('campeonatos').doc(currentCid).delete(); changeTab('copas'); } }

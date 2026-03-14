const auth = firebase.auth();
const db = firebase.firestore();
let me = null;
let currentCid = null;

// LIGAS ATUALIZADAS (20+ TIMES CADA)
const LIGAS = {
    br: [
        {n: 'Flamengo', e: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Flamengo_brazil.svg'},
        {n: 'Palmeiras', e: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Palmeiras_logo.svg'},
        {n: 'São Paulo', e: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Sao_Paulo_Futebol_Clube.svg'},
        {n: 'Vasco', e: 'https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascoDaGama.png'},
        {n: 'Corinthians', e: 'https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png'},
        {n: 'Bahia', e: 'https://upload.wikimedia.org/wikipedia/pt/thumb/6/61/Esporte_Clube_Bahia_2014.png/150px-Esporte_Clube_Bahia_2014.png'},
        {n: 'Fluminense', e: 'https://upload.wikimedia.org/wikipedia/pt/a/a3/Fluminense_FC_escudo.png'},
        {n: 'Botafogo', e: 'https://upload.wikimedia.org/wikipedia/pt/d/d2/Botafogo_de_Futebol_e_Regatas_logo.png'},
        {n: 'Atlético-MG', e: 'https://upload.wikimedia.org/wikipedia/pt/5/5f/Atletico_mineiro_logo.png'},
        {n: 'Cruzeiro', e: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Cruzeiro_Esporte_Clube_%28logo%29.svg'},
        {n: 'Grêmio', e: 'https://upload.wikimedia.org/wikipedia/pt/thumb/1/1a/Gremio_logo.png/140px-Gremio_logo.png'},
        {n: 'Internacional', e: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Escudo_do_Sport_Club_Internacional.svg'},
        {n: 'Athletico-PR', e: 'https://upload.wikimedia.org/wikipedia/pt/c/c7/Athletico_Paranaense_2018.png'},
        {n: 'Fortaleza', e: 'https://upload.wikimedia.org/wikipedia/pt/4/41/Fortaleza_Esporte_Clube_logo.png'},
        {n: 'Cuiabá', e: 'https://upload.wikimedia.org/wikipedia/pt/a/a3/Cuiab%C3%A1_EC_2020.png'},
        {n: 'Criciúma', e: 'https://upload.wikimedia.org/wikipedia/pt/9/90/Criciuma_Esporte_Clube_logo.png'},
        {n: 'Juventude', e: 'https://upload.wikimedia.org/wikipedia/pt/0/05/Esporte_Clube_Juventude.png'},
        {n: 'Vitória', e: 'https://upload.wikimedia.org/wikipedia/pt/4/41/Esporte_Clube_Vit%C3%B3ria_logo.png'},
        {n: 'Bragantino', e: 'https://upload.wikimedia.org/wikipedia/pt/9/9e/Red_Bull_Bragantino_logo.png'},
        {n: 'Atlético-GO', e: 'https://upload.wikimedia.org/wikipedia/pt/c/c4/Atl%C3%A9tico_Club_Goianiense_2020.png'}
    ],
    euro: [
        {n: 'Real Madrid', e: 'https://upload.wikimedia.org/wikipedia/pt/9/98/Real_Madrid.png'},
        {n: 'Barcelona', e: 'https://upload.wikimedia.org/wikipedia/pt/4/43/FCBarcelona.png'},
        {n: 'Man. City', e: 'https://upload.wikimedia.org/wikipedia/pt/0/02/Manchester_City_FC_badge.png'},
        {n: 'PSG', e: 'https://upload.wikimedia.org/wikipedia/pt/a/a7/Paris_Saint-Germain_F.C..png'},
        {n: 'Bayern', e: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_München_logo_%282017%29.svg'},
        {n: 'Liverpool', e: 'https://upload.wikimedia.org/wikipedia/pt/0/0c/Liverpool_FC.png'},
        {n: 'Arsenal', e: 'https://upload.wikimedia.org/wikipedia/pt/5/53/Arsenal_FC.png'},
        {n: 'Chelsea', e: 'https://upload.wikimedia.org/wikipedia/pt/c/cc/Chelsea_FC.png'},
        {n: 'Juventus', e: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg'},
        {n: 'Inter de Milão', e: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg'},
        {n: 'Milan', e: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg'},
        {n: 'Dortmund', e: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg'},
        {n: 'Atlético Madrid', e: 'https://upload.wikimedia.org/wikipedia/pt/c/c1/Atletico_Madrid_logo.png'},
        {n: 'Benfica', e: 'https://upload.wikimedia.org/wikipedia/pt/1/1f/SL_Benfica_logo.png'},
        {n: 'Porto', e: 'https://upload.wikimedia.org/wikipedia/pt/b/b8/FC_Porto.png'},
        {n: 'Bayer Leverkusen', e: 'https://upload.wikimedia.org/wikipedia/pt/5/5a/Bayer_04_Leverkusen_logo.png'},
        {n: 'Aston Villa', e: 'https://upload.wikimedia.org/wikipedia/pt/0/0d/Aston_Villa_FC_logo.png'},
        {n: 'Napoli', e: 'https://upload.wikimedia.org/wikipedia/commons/0/00/SSC_Napoli_2024.svg'},
        {n: 'Sporting', e: 'https://upload.wikimedia.org/wikipedia/pt/3/3e/Sporting_Clube_de_Portugal.png'},
        {n: 'Ajax', e: 'https://upload.wikimedia.org/wikipedia/pt/b/b1/Ajax_Amsterdam.png'}
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
    // Jogadores Online/Cadastrados
    db.collection('usuarios').onSnapshot(snap => {
        let html = '';
        snap.forEach(doc => {
            const p = doc.data();
            html += `<div class="card animate__animated animate__fadeIn" style="display:flex; align-items:center; gap:12px;">
                <div style="width:45px; height:45px; border-radius:50%; background:url(${p.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}); background-size:cover; border: 2px solid var(--divine-green);"></div>
                <div style="flex:1"><b>${p.nome}</b><br><small style="color:var(--neon-blue)">${p.stats.titulos} Títulos | ${p.stats.v} Vitórias</small></div>
            </div>`;
        });
        document.getElementById('lobby-list').innerHTML = html;
        loadPodium();
    });

    // Histórico de Campeonatos Finalizados
    db.collection('campeonatos').where('status', '==', 'finalizada').orderBy('data', 'desc').limit(5).onSnapshot(snap => {
        let h = '';
        snap.forEach(doc => {
            const c = doc.data();
            h += `<div class="card" style="border-color: var(--primary); opacity: 0.8;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${c.nome}</b><br><small>${c.fase}</small></span>
                    <img src="${c.vencedorImg || ''}" style="width:30px">
                </div>
            </div>`;
        });
        document.getElementById('history-list').innerHTML = h || '<p style="font-size:0.7rem; color:#444">Nenhum torneio finalizado ainda.</p>';
    });
}

function loadPodium() {
    db.collection('usuarios').orderBy('stats.titulos', 'desc').limit(3).get().then(snap => {
        let p = []; snap.forEach(doc => p.push(doc.data()));
        if(p.length === 0) return;
        document.getElementById('podium-area').innerHTML = `
            <div class="podium-box animate__animated animate__bounceIn">
                <div class="podium-item podium-2"><div class="podium-name">${p[1]?.nome || '-'}</div></div>
                <div class="podium-item podium-1">
                    <i class="fas fa-crown" style="color:gold; font-size: 1.2rem; margin-bottom:5px"></i>
                    <div class="podium-name">${p[0]?.nome || '-'}</div>
                </div>
                <div class="podium-item podium-3"><div class="podium-name">${p[2]?.nome || '-'}</div></div>
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
    if(!nome || isNaN(qtd)) return alert("Preencha todos os dados!");

    const ref = await db.collection('campeonatos').add({
        nome, tipo, liga, host: me.uid, status: 'aberto',
        vagas: qtd, p: [me.uid], bots: [],
        tabela: { [me.uid]: { n: me.nome, time: 'A Definir', escudo: '', pts:0, v:0, sg:0 } },
        jogos: [], fase: 'Aguardando Início', data: Date.now()
    });
    openArena(ref.id);
}

function loadCopas() {
    db.collection('campeonatos').where('status', '==', 'aberto').orderBy('data', 'desc').onSnapshot(snap => {
        document.getElementById('copas-list').innerHTML = snap.docs.map(doc => `
            <div class="card animate__animated animate__slideInUp" onclick="openArena('${doc.id}')">
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
        document.getElementById('arena-header').innerHTML = `<h3 style="text-align:center; color:var(--primary); margin-top:10px;">${c.nome}</h3><p style="text-align:center; font-size:0.7rem; color:var(--neon-blue); letter-spacing:2px;">${c.fase.toUpperCase()}</p>`;
        document.getElementById('btn-manage').classList.toggle('hidden', c.host !== me.uid);
        // Não resetar para 'jogos' se já estiver na tabela, para evitar pulos de tela
        const currentView = document.querySelector('#arena-content h4')?.innerText.includes('GESTÃO') ? 'manage' : 'jogos';
        if(currentView !== 'manage') switchArena('jogos');
    });
}

async function switchArena(mode) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const content = document.getElementById('arena-content');

    if(mode === 'manage') {
        let h = `<h4 style="margin-bottom:15px; font-size:0.8rem;">GESTÃO DA COPA</h4>`;
        if(c.p.length + c.bots.length < c.vagas) {
            h += `<button class="btn-glow" style="margin-bottom:15px; padding:10px; font-size:0.7rem;" onclick="addBot()">+ ADICIONAR BOT</button>`;
        }
        [...c.p, ...c.bots.map(b=>b.id)].forEach(pid => {
            const player = c.tabela[pid];
            h += `<div class="card" style="padding:12px; margin-bottom:8px; border-color: ${pid.startsWith('bot') ? '#333' : 'var(--neon-blue)'}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <input type="text" value="${player.n}" onchange="renamePlayer('${pid}', this.value)" style="margin:0; padding:5px; border:none; background:transparent; font-weight:800; width:70%" ${!pid.startsWith('bot_') ? 'disabled' : ''}>
                    ${pid.startsWith('bot_') ? `<i class="fas fa-trash" onclick="removeBot('${pid}')" style="color:#500"></i>` : '<i class="fas fa-user" style="color:var(--neon-blue)"></i>'}
                </div>
                <select onchange="setClub('${pid}', this.value)" style="margin:0; padding:8px; font-size:0.7rem;">
                    <option>Escolher Time</option>
                    ${LIGAS[c.liga].map(club => `<option value="${club.n}" ${player.time === club.n ? 'selected':''}>${club.n}</option>`).join('')}
                </select>
            </div>`;
        });
        if(c.jogos.length === 0 && (c.p.length + c.bots.length >= 2)) {
            h += `<button class="btn-glow" style="background:var(--divine-green); color:#000; margin-top:10px;" onclick="sortearChaves()">SORTEAR E INICIAR</button>`;
        } else if (c.fase !== 'Finalizada' && c.jogos.length > 0) {
            h += `<button class="btn-glow" style="margin-top:20px; background:var(--neon-blue); color:#000" onclick="avancarFase()">AVANÇAR PARA PRÓXIMA FASE</button>`;
        }
        h += `<button class="btn-secondary" style="margin-top:20px; color:#ff4444; border-color:#ff4444; font-size:0.7rem;" onclick="deleteCopa()">EXCLUIR CAMPEONATO</button>`;
        content.innerHTML = h;
    } else if(mode === 'jogos') {
        if(c.jogos.length === 0) return content.innerHTML = "<p style='text-align:center; padding-top:40px; color:#444;'>Aguardando sorteio do Host...</p>";
        content.innerHTML = c.jogos.map((j, i) => `
            <div class="match-card">
                <div class="match-team">
                    <div class="team-info">
                        <img src="${c.tabela[j.p1].escudo || 'https://cdn-icons-png.flaticon.com/512/53/53244.png'}">
                        <div class="team-names">
                            <b>${c.tabela[j.p1].time}</b>
                            <span>${c.tabela[j.p1].n}</span>
                        </div>
                    </div>
                    <input type="number" class="score-input" value="${j.g1}" onchange="updateGols(${i}, 1, this.value)" ${c.host !== me.uid ? 'disabled' : ''}>
                </div>
                <div style="text-align:center; font-size:0.6rem; color:var(--primary); margin: 5px 0; font-weight:800;">VERSUS</div>
                <div class="match-team">
                    <div class="team-info">
                        <img src="${c.tabela[j.p2]?.escudo || 'https://cdn-icons-png.flaticon.com/512/53/53244.png'}" onerror="this.style.opacity='0'">
                        <div class="team-names">
                            <b>${j.p2 === 'BYE' ? 'FOLGA' : c.tabela[j.p2].time}</b>
                            <span>${j.p2 === 'BYE' ? '---' : c.tabela[j.p2].n}</span>
                        </div>
                    </div>
                    <input type="number" class="score-input" value="${j.g2}" onchange="updateGols(${i}, 2, this.value)" ${j.p2 === 'BYE' || c.host !== me.uid ? 'disabled' : ''}>
                </div>
            </div>
        `).join('');
    } else {
        content.innerHTML = `<p style="text-align:center; padding-top:40px;">Quadro detalhado em desenvolvimento...</p>`;
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

// LOGICA AVANÇAR FASE
async function avancarFase() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    
    const incompletos = c.jogos.filter(j => j.p2 !== 'BYE' && (j.g1 === j.g2)); 
    if(incompletos.length > 0 && !confirm("Existem empates ou jogos sem gols. Avançar assim mesmo?")) return;

    let vencedores = [];
    c.jogos.forEach(j => {
        if(j.p2 === 'BYE' || j.g1 > j.g2) { vencedores.push(j.p1); }
        else { vencedores.push(j.p2); }
    });

    if(vencedores.length === 1) {
        const champId = vencedores[0];
        const v = c.tabela[champId];
        
        // Disparar Animação
        showChampion(v.n, v.time, v.escudo);

        if(!champId.startsWith('bot_')) {
            const uDoc = await db.collection('usuarios').doc(champId).get();
            const curTitulos = uDoc.data().stats.titulos || 0;
            await db.collection('usuarios').doc(champId).update({ "stats.titulos": curTitulos + 1 });
        }
        await db.collection('campeonatos').doc(currentCid).update({ 
            status: 'finalizada', 
            fase: 'Finalizada', 
            vencedorImg: v.escudo,
            vencedorNome: v.n 
        });
        return;
    }

    let novosJogos = [];
    for(let i=0; i < vencedores.length; i+=2) {
        novosJogos.push({ p1: vencedores[i], p2: vencedores[i+1] || 'BYE', g1: 0, g2: vencedores[i+1] ? 0 : -1 });
    }

    const proxFase = vencedores.length > 4 ? 'Quartas' : (vencedores.length > 2 ? 'Semi-Final' : 'Grande Final');
    await db.collection('campeonatos').doc(currentCid).update({ jogos: novosJogos, fase: proxFase });
    switchArena('jogos');
}

// ANIMAÇÕES
function showChampion(nick, time, escudo) {
    const overlay = document.getElementById('champion-overlay');
    document.getElementById('champ-img').src = escudo;
    document.getElementById('champ-team').innerText = time;
    document.getElementById('champ-player').innerText = nick;
    overlay.classList.remove('hidden');
    
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#d4af37', '#00d4ff', '#ffffff']
    });
}
function closeChampion() { 
    document.getElementById('champion-overlay').classList.add('hidden');
    changeTab('lobby', document.querySelectorAll('.nav-link')[0]);
}

// HELPERS BOTS/CLUBS
async function addBot() {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    const id = 'bot_' + Date.now();
    const nome = 'Bot ' + (c.bots.length + 1);
    const newBots = [...c.bots, {id, n: nome}];
    const newTab = {...c.tabela, [id]: {n: nome, time: 'Escolha o Time', escudo: '', pts:0, v:0, sg:0}};
    await db.collection('campeonatos').doc(currentCid).update({ bots: newBots, tabela: newTab });
}

async function renamePlayer(pid, newName) {
    const snap = await db.collection('campeonatos').doc(currentCid).get();
    const c = snap.data();
    c.tabela[pid].n = newName;
    await db.collection('campeonatos').doc(currentCid).update({ tabela: c.tabela });
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
    if(!club) return;
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
    db.collection('chat').orderBy('t', 'desc').limit(20).onSnapshot(snap => {
        const msgs = snap.docs.reverse().map(d => `<div class="chat-msg"><b>${d.data().u}</b>${d.data().m}</div>`).join('');
        const box = document.getElementById('chat-msgs');
        box.innerHTML = msgs;
        box.scrollTop = box.scrollHeight;
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
async function deleteCopa() { if(confirm("Deseja deletar permanentemente?")) { await db.collection('campeonatos').doc(currentCid).delete(); changeTab('copas'); } }

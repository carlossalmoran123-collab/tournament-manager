import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const APP_LOGO_URL = "https://i.ibb.co/fzzhsgsG/Whats-App-Image-2026-06-17-at-3-25-11-PM-removebg-preview.png";

const firebaseConfig = {
  apiKey: "AIzaSyCxBA6w3Ia4OwYrJidhpXVtR7-2SKnMWXw",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.appspot.com",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:b1d8305c48b2d6a59b646c",
  databaseURL: "https://torneos-basquetbol-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentTournamentId = null;
let currentTournamentData = null;
let isAdmin = false;
let globalTournaments = {};
let globalTeams = {};
let globalVenues = {};
let globalMatches = {};
let globalFormats = {};

const categoriesConfig = {
  "chupon": { label: "🍼 Chupon", desc: "Iniciación y psicomotricidad básica (4-6 años)" },
  "micro": { label: "👶 Micro", desc: "Años 2017 - 2018" },
  "infantil-femenil": { label: "🧒 Infantil Femenil", desc: "Años 2015 - 2016" },
  "infantil-varonil": { label: "🧒 Infantil Varonil", desc: "Años 2015 - 2016" },
  "pasarela-femenil": { label: "🏀 Pasarela Femenil", desc: "Años 2013 - 2014" },
  "pasarela-varonil": { label: "🏀 Pasarela Varonil", desc: "Años 2013 - 2014" },
  "cadetes-femenil": { label: "👦 Cadetes Femenil", desc: "Años 2011 - 2012" },
  "cadetes-varonil": { label: "👦 Cadetes Varonil", desc: "Años 2011 - 2012" },
  "juvenil-femenil": { label: "👨 Juvenil Femenil", desc: "Años 2009 - 2010" },
  "juvenil-varonil": { label: "👨 Juvenil Varonil", desc: "Años 2009 - 2010" },
  "juvenil-superior-femenil": { label: "👨 Juvenil Superior Femenil", desc: "Años 2007 - 2008" },
  "juvenil-superior-varonil": { label: "👨 Juvenil Superior Varonil", desc: "Años 2007 - 2008" },
  "sub21-femenil": { label: "👨‍🎓 Sub 21 Femenil", desc: "Categoría Universitaria Desarrollo" },
  "sub21-varonil": { label: "👨‍🎓 Sub 21 Varonil", desc: "Categoría Universitaria Desarrollo" },
  "sub23-femenil": { label: "👨‍🎓 Sub 23 Femenil", desc: "Categoría Universitaria Avanzada" },
  "sub23-varonil": { label: "👨‍🎓 Sub 23 Varonil", desc: "Categoría Universitaria Avanzada" }
};

// ============================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('btnDeleteMatch')?.addEventListener('click', handleDeleteMatchButton);
  document.getElementById('btnEnterApp')?.addEventListener('click', loadSelectedTournamentContext);
  document.getElementById('btnGoToAdminPrep')?.addEventListener('click', () => switchSection('admin', true));
  document.getElementById('btnBackToSelector')?.addEventListener('click', () => {
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
  });

  document.getElementById('teamForm')?.addEventListener('submit', handleTeamSubmit);
  document.getElementById('venueForm')?.addEventListener('submit', handleVenueSubmit);
  document.getElementById('matchForm')?.addEventListener('submit', handleMatchSubmit);
  document.getElementById('eventForm')?.addEventListener('submit', handleEventSubmit);
  document.getElementById('categoryFormatForm')?.addEventListener('submit', handleFormatSubmit);
  document.getElementById('scoreForm')?.addEventListener('submit', handleScoreSubmit);

  document.getElementById('matchCategory')?.addEventListener('change', updateFilteredTeamsDropdowns);
  document.getElementById('classCategoryFilter')?.addEventListener('change', renderClassificationTables);

  document.getElementById('editTeamForm')?.addEventListener('submit', handleEditTeamSubmit);
  document.getElementById('selectEditTeam')?.addEventListener('change', handleSelectEditTeamChange);
  document.getElementById('btnDeleteTeam')?.addEventListener('click', handleDeleteTeamButton);

  document.getElementById('editMatchForm')?.addEventListener('submit', handleEditMatchSubmit);
  document.getElementById('selectEditMatch')?.addEventListener('change', handleSelectEditMatchChange);
  document.getElementById('editMatchCategory')?.addEventListener('change', updateEditMatchTeamsDropdowns);

  initGlobalTournamentsObserver();
});

// ============================================
// FIREBASE: OBSERVADORES
// ============================================
function initGlobalTournamentsObserver() {
  onValue(ref(db, 'tournaments'), (snapshot) => {
    globalTournaments = snapshot.val() || {};
    renderCompetitionsSelector();
  });
}

function attachTournamentRealtimeListeners(tournamentId) {
  onValue(ref(db, `tournaments/${tournamentId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    currentTournamentData = data;
    globalTeams   = data.teams   || {};
    globalVenues  = data.venues  || {};
    globalMatches = data.matches || {};
    globalFormats = data.formats || {};

    document.getElementById('appTournamentTitle').innerText =
      (data.name || "Torneo Activo") + " | DRIBLA, PASA Y ENCESTA STATS";
    document.getElementById('appTournamentVenue').innerText =
      data.location || "Sede General";

    populateStaticAdminDropdowns();
    updateFilteredTeamsDropdowns();
    populateScoreMatchesDropdown();
    populateEditTeamDropdown();
    populateEditMatchDropdown();
    renderDashboard();
    renderCategories();
    renderMatchesByVenue();
    renderClassificationTables();
  });
}

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (user) {
    document.body.classList.add('is-admin');
    document.getElementById('admin-login-box')?.style && (document.getElementById('admin-login-box').style.display = 'none');
    document.getElementById('btnGoToAdminPrep')?.style && (document.getElementById('btnGoToAdminPrep').style.display = 'block');
    document.getElementById('admin-dashboard-panels')?.style && (document.getElementById('admin-dashboard-panels').style.display = 'grid');
  } else {
    document.body.classList.remove('is-admin');
    document.getElementById('admin-login-box')?.style && (document.getElementById('admin-login-box').style.display = 'flex');
    document.getElementById('btnGoToAdminPrep')?.style && (document.getElementById('btnGoToAdminPrep').style.display = 'none');
    document.getElementById('admin-dashboard-panels')?.style && (document.getElementById('admin-dashboard-panels').style.display = 'none');
  }
  renderCompetitionsSelector();
  if (currentTournamentId) {
    renderCategories();
    renderMatchesByVenue();
  }
});

async function handleLoginSubmit(e) {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginPassword').value
    );
    alert("🔐 Autenticado.");
  } catch (error) {
    alert("Acceso denegado");
  }
}

async function handleLogout() {
  await signOut(auth);
  location.reload();
}

// ============================================
// NAVEGACIÓN
// ============================================
function renderCompetitionsSelector() {
  const select = document.getElementById('globalCompetitionSelect');
  if (!select) return;
  select.innerHTML = '';
  const keys = Object.keys(globalTournaments);
  if (keys.length === 0) {
    select.innerHTML = '<option value="">No hay eventos maestros activos...</option>';
    return;
  }
  keys.forEach(key => {
    const t = globalTournaments[key];
    select.innerHTML += `<option value="${key}">🏆 ${t.name} — 📍 Sede: ${t.location}</option>`;
  });
}

function loadSelectedTournamentContext() {
  const id = document.getElementById('globalCompetitionSelect')?.value;
  if (!id) return alert("Selecciona un evento válido.");
  currentTournamentId = id;
  attachTournamentRealtimeListeners(id);
  document.getElementById('competition-selector-screen').style.display = 'none';
  document.getElementById('main-app-content').style.display = 'block';
  switchSection('dashboard');
}

function switchSection(sectionId, fromGlobalSelector = false) {
  if (fromGlobalSelector) {
    document.getElementById('competition-selector-screen').style.display = 'none';
    document.getElementById('main-app-content').style.display = 'block';
    sectionId = 'admin';
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
}
window.switchSection = switchSection;

// ============================================
// DROPDOWNS
// ============================================
function populateStaticAdminDropdowns() {
  const venueSel      = document.getElementById('selectMatchVenue');
  const teamCatSel    = document.getElementById('regTeamCategory');
  const formatCatSel  = document.getElementById('formatSelectCategory');
  const filterCatSel  = document.getElementById('classCategoryFilter');
  const editTeamCatSel = document.getElementById('editTeamCategory');
  const editMatchCatSel = document.getElementById('editMatchCategory');
  const matchCatSel   = document.getElementById('matchCategory');

  if (venueSel) {
    venueSel.innerHTML = '<option value="">-- Selecciona Cancha --</option>';
    Object.entries(globalVenues).forEach(([id, v]) => {
      if (v?.name) venueSel.innerHTML += `<option value="${id}">${v.name}</option>`;
    });
  }

  const editMatchVenueSel = document.getElementById('editMatchVenue');
  if (editMatchVenueSel) {
    editMatchVenueSel.innerHTML = '<option value="">-- Selecciona Cancha --</option>';
    Object.entries(globalVenues).forEach(([id, v]) => {
      if (v?.name) editMatchVenueSel.innerHTML += `<option value="${id}">${v.name}</option>`;
    });
  }

  const catOptions = Object.entries(categoriesConfig)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  if (teamCatSel)    teamCatSel.innerHTML    = catOptions;
  if (formatCatSel)  formatCatSel.innerHTML  = catOptions;
  if (filterCatSel && filterCatSel.children.length === 0) filterCatSel.innerHTML = catOptions;
  if (editTeamCatSel)  editTeamCatSel.innerHTML  = catOptions;
  if (editMatchCatSel) editMatchCatSel.innerHTML = catOptions;
  if (matchCatSel)   matchCatSel.innerHTML   = catOptions;

  updateFilteredTeamsDropdowns();
}

function updateFilteredTeamsDropdowns() {
  const matchCatSel = document.getElementById('matchCategory');
  const selectedCategory = matchCatSel?.value;
  const localSel   = document.getElementById('selectLocal');
  const visitorSel = document.getElementById('selectVisitor');
  if (!localSel || !visitorSel || !selectedCategory) return;

  localSel.innerHTML = visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';

  const teamsInCategory = Object.entries(globalTeams).filter(
    ([_, t]) => t && t.categoryRegistered === selectedCategory
  );

  if (teamsInCategory.length === 0) {
    localSel.innerHTML   += '<option value="" disabled>No hay equipos en esta categoría</option>';
    visitorSel.innerHTML += '<option value="" disabled>No hay equipos en esta categoría</option>';
    return;
  }

  teamsInCategory.forEach(([id, t]) => {
    const groupLabel = t.groupAssigned ? ` (${t.groupAssigned.toUpperCase()})` : '';
    const opt = `<option value="${id}">${t.name}${groupLabel}</option>`;
    localSel.innerHTML   += opt;
    visitorSel.innerHTML += opt;
  });
}

function populateScoreMatchesDropdown() {
  const select = document.getElementById('scoreSelectMatch');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona un Partido Programado --</option>';
  Object.entries(globalMatches).forEach(([id, m]) => {
    if (!m) return;
    const statusText = (m.localScore !== undefined)
      ? ` (Jugado: ${m.localScore}-${m.visitorScore})`
      : '';
    select.innerHTML += `<option value="${id}">${categoriesConfig[m.category]?.label || m.category} | ${m.localName} VS ${m.visitorName} - ${m.date}${statusText}</option>`;
  });
}

// ============================================
// RENDER: DASHBOARD
// ============================================
function renderDashboard() {
  const teamsArr = Object.values(globalTeams).filter(t => t?.name);
  document.getElementById('dashTeamsCount').innerText  = teamsArr.length;
  document.getElementById('dashMatchesCount').innerText = Object.values(globalMatches).length;

  const container = document.getElementById('dashboardTeamsContainer');
  if (!container) return;
  container.innerHTML = '';
  teamsArr.forEach(team => {
    const pill = document.createElement('div');
    pill.className = 'team-pill';
    pill.innerHTML = `<strong>${team.name}</strong>`;
    container.appendChild(pill);
  });
}

// ============================================
// RENDER: CATEGORÍAS
// ============================================
function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  container.innerHTML = '';
  const teamsArr = Object.entries(globalTeams).filter(([_, t]) => t?.name);
  Object.keys(categoriesConfig).forEach(catKey => {
    const filteredTeams = teamsArr.filter(([_, t]) => t.categoryRegistered === catKey);
    if (filteredTeams.length === 0) return;
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `<h4>${categoriesConfig[catKey].label}</h4>`;
    filteredTeams.forEach(([_, t]) => {
      card.innerHTML += `<div>🛡️ ${t.name}</div>`;
    });
    container.appendChild(card);
  });
}

// ============================================
// RENDER: ROL DE JUEGOS + PLAYOFFS
// ============================================
function renderPlayoffs(container) {
  const playoffs = Object.values(globalMatches).filter(
    m => m && (m.stage === 'semifinal' || m.stage === 'final')
  );
  if (playoffs.length === 0) return;

  const playoffBlock = document.createElement('div');
  playoffBlock.style.cssText = 'border:2px solid #ff6b00; padding:15px; border-radius:10px; margin-bottom:30px; background:rgba(255,107,0,0.05);';
  playoffBlock.innerHTML = `<h2 style="color:#ff6b00; text-align:center; margin:0 0 15px 0;">🔥 FASE FINAL</h2>`;

  playoffs.forEach(m => {
    const score = m.localScore !== undefined
      ? `${m.localScore} - ${m.visitorScore}`
      : 'VS';
    playoffBlock.innerHTML += `
      <div style="text-align:center; padding:10px; border-bottom:1px solid #444;">
        <small style="text-transform:uppercase; color:#aaa;">${m.stage}</small><br>
        <strong>${m.localName}</strong>
        <span style="color:#ff6b00; font-size:1.2rem; margin:0 15px;">${score}</span>
        <strong>${m.visitorName}</strong>
      </div>`;
  });

  container.prepend(playoffBlock);
}

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';

  const venuesArr  = Object.entries(globalVenues).filter(([_, v]) => v?.name);
  const matchesArr = Object.entries(globalMatches).filter(([_, m]) => m?.date);

  venuesArr.forEach(([venueId, venue]) => {
    const block = document.createElement('div');
    block.className = 'venue-role-block';
    block.style.marginBottom = '30px';

    const mapsLink = venue.mapsUrl
       ? `<a href="${venue.mapsUrl}" target="_blank" style="margin-left:15px; font-size:0.85rem; color:#ff6b00; text-decoration:underline;">📍 Ver Ubicación</a>`
      : '';

    block.innerHTML = `
      <div style="display:flex; align-items:center; border-bottom:2px solid var(--accent-orange); margin-bottom:15px;">
        <h3 style="margin:0; padding-bottom:5px;">🏢 Sede: ${venue.name}</h3>
        ${mapsLink}
      </div>`;

    const vMatches = matchesArr.filter(([_, m]) => m.venueId === venueId);

    if (vMatches.length === 0) {
      block.innerHTML += `<p style="color:#888; font-style:italic;">No hay partidos programados en esta sede.</p>`;
    } else {
      vMatches.sort((a, b) => (a[1].startTime || '').localeCompare(b[1].startTime || ''));
      
      // ✅ CORRECCIÓN AQUÍ: Usamos matchesHtml consistentemente
      let matchesHtml = ''; 

      vMatches.forEach(([mId, match]) => {
        const scoreText = (match.localScore !== undefined)
            ? `<strong>${match.localScore}-${match.visitorScore}</strong>`
            : 'vs';

        let adminButtons = '';
        if (isAdmin) {
            adminButtons = `
                <div style="display:flex; gap:5px; margin-left:10px;">
                    <button onclick="printScoresheet('${mId}')" title="Imprimir" style="background:#334155; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">📄</button>
                    <button onclick="deleteMatchEvent('${mId}')" title="Eliminar" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                </div>`;
        }

        matchesHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px;">
                <span style="font-size:0.9rem; color:#ccc; min-width:50px;">⏰ ${match.startTime}</span>
                <span style="flex:1; text-align:center;">
                    <strong>${match.localName}</strong> ${scoreText} <strong>${match.visitorName}</strong>
                </span>
                <span style="font-size:0.8rem; background:#334155; padding:2px 8px; border-radius:4px; margin-left:10px;">
                  ${categoriesConfig[match.category]?.label || ''}
                </span>
                ${adminButtons}
            </div>`;
      });
       block.innerHTML += matchesHtml;
      
    }
    container.appendChild(block);
  });

  // Renderizar playoffs al inicio
  renderPlayoffs(container);
}


// ============================================
// RENDER: CLASIFICACIÓN (CON PROMEDIOS)
// ============================================
function renderClassificationTables() {
  const container = document.getElementById('classificationTablesContainer');
  const selectedCat = document.getElementById('classCategoryFilter')?.value;
  if (!container || !selectedCat) return;
  container.innerHTML = '';

  const formatConfig = globalFormats[selectedCat] || { type: 'todos-contra-todos' };
  const stats = {};

  // 1. Inicializar estadísticas
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCat) {
      stats[id] = { 
        id: id,
        name: t.name, 
        group: (t.groupAssigned || 'sin grupo').toLowerCase(), 
        jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, pts: 0, dif: 0 
      };
    }
  });

  // 2. Procesar partidos (Solo etapa REGULAR)
  Object.values(globalMatches).forEach(m => {
    if (m && m.category === selectedCat && m.stage === 'regular' && m.localScore !== undefined) {
      const locS = parseInt(m.localScore) || 0;
      const visS = parseInt(m.visitorScore) || 0;
      if(stats[m.localId] && stats[m.visitorId]) {
        stats[m.localId].jj++; stats[m.visitorId].jj++;
        stats[m.localId].pf += locS; stats[m.localId].pc += visS;
        stats[m.visitorId].pf += visS; stats[m.visitorId].pc += locS;
        
        if (locS > visS) { 
          stats[m.localId].jg++; stats[m.localId].pts += 2; 
          stats[m.visitorId].jp++; stats[m.visitorId].pts += 1; 
        } else { 
          stats[m.visitorId].jg++; stats[m.visitorId].pts += 2; 
          stats[m.localId].jp++; stats[m.localId].pts += 1; 
        }
      }
    }
  });

  // 3. CALCULO CRITICO: Diferencia y Promedios (UNA SOLA VEZ PARA TODOS)
  Object.keys(stats).forEach(id => {
    const t = stats[id];
    t.dif = t.pf - t.pc; // <--- Cálculo de la diferencia
    t.avgPts = t.jj > 0 ? (t.pts / t.jj) : 0;
    t.avgDif = t.jj > 0 ? (t.dif / t.jj) : 0;
    t.avgPF  = t.jj > 0 ? (t.pf / t.jj) : 0;
  });

  const sortTeams = (arr) => arr.sort((a, b) => b.avgPts - a.avgPts || b.avgDif - a.avgDif || b.avgPF - a.avgPF);
  
  if (formatConfig.type === 'grupos') {
    const groupsMap = {};
    Object.values(stats).forEach(t => { 
        if (!groupsMap[t.group]) groupsMap[t.group] = []; 
        groupsMap[t.group].push(t); 
    });
    
    let segundosLugares = [];
    let primerosLugares = [];

    Object.keys(groupsMap).sort().forEach(groupName => {
      const sorted = sortTeams(groupsMap[groupName]);
      container.innerHTML += `<h3>Grupo: ${groupName.toUpperCase()}</h3>` + generateTableHtml(sorted);
      
      if (sorted.length > 0) primerosLugares.push(sorted[0]);
      if (sorted.length > 1) segundosLugares.push(sorted[1]);
    });

    // Lógica Mejor Segundo y Semifinales
    if (Object.keys(groupsMap).length === 3) {
      const mejorSegundo = sortTeams([...segundosLugares])[0];
      const clasificadosFinales = sortTeams([...primerosLugares, mejorSegundo]);

      let s1 = clasificadosFinales[0], s2 = clasificadosFinales[1], s3 = clasificadosFinales[2], s4 = clasificadosFinales[3];
      let avisoReglaOro = "";
      if (s1.group === s4.group) {
        let temp = s4; s4 = s3; s3 = temp;
        avisoReglaOro = `<div style="font-size:0.7rem; color:#ff6b00; margin-top:5px;">🛡️ <em>Regla de Oro: Rivales ajustados para no repetir grupo.</em></div>`;
      }

      container.innerHTML += `
        <div style="background:rgba(255, 107, 0, 0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:30px;">
          <h3 style="margin:0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
            <div style="background:#1e2530; padding:10px; border-radius:8px;">
              <small>SEMIFINAL 1</small><br><strong>${s1.name} vs ${s4.name}</strong>
            </div>
            <div style="background:#1e2530; padding:10px; border-radius:8px;">
              <small>SEMIFINAL 2</small><br><strong>${s2.name} vs ${s3.name}</strong>
            </div>
          </div>
          ${avisoReglaOro}
        </div>`;
    }
  } else {
    container.innerHTML += `<h3>Liga General: ${categoriesConfig[selectedCat].label}</h3>` + generateTableHtml(sortTeams(Object.values(stats)));
  }
}

function generateTableHtml(teamsArray) {
  if (teamsArray.length === 0) return '<p style="color:#aaa; font-style:italic; padding:10px;">No hay escuadras.</p>';

  let html = `
    <div style="overflow-x:auto; margin-bottom:25px;">
      <table class="classification-table" style="width:100%; border-collapse:collapse; background:var(--bg-card); border:1px solid var(--border-color); text-align:center;">
        <thead>
          <tr style="background:#1e2530; color:#fff; border-bottom:2px solid var(--accent-orange);">
            <th style="padding:10px; text-align:left;">Pos / Club</th>
            <th>JJ</th><th>JG</th><th>JP</th><th>PF</th><th>PC</th><th>DIF</th><th style="color:var(--accent-orange)">PTS</th>
          </tr>
        </thead>
        <tbody>`;

  teamsArray.forEach((t, index) => {
    // Cálculo visual de la diferencia
    const diff = t.pf - t.pc;
    const colorDif = diff > 0 ? '#10b981' : (diff < 0 ? '#ef4444' : '#aaa');

    html += `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:10px; text-align:left;"><strong>${index + 1}.</strong> ${t.name}</td>
        <td>${t.jj}</td><td>${t.jg}</td><td>${t.jp}</td><td>${t.pf}</td><td>${t.pc}</td>
        <td style="color:${colorDif}; font-weight:bold;">${diff > 0 ? '+' : ''}${diff}</td>
        <td style="font-weight:bold; color:var(--accent-orange);">${t.pts}</td>
      </tr>`;
  });

  return html + `</tbody></table></div>`;
}

// ============================================
// HANDLERS: FORMS
// ============================================
function handleFormatSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  const category = document.getElementById('formatSelectCategory').value;
  const type     = document.getElementById('systemTypeSelect').value;
  set(ref(db, `tournaments/${currentTournamentId}/formats/${category}`), { type })
    .then(() => alert("⚙️ Formato configurado."));
}

function handleScoreSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  const matchId      = document.getElementById('scoreSelectMatch').value;
  const localScore   = parseInt(document.getElementById('scoreLocal').value);
  const visitorScore = parseInt(document.getElementById('scoreVisitor').value);
  if (!matchId) return;
  update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), { localScore, visitorScore })
    .then(() => {
      alert("🏀 Marcador guardado.");
      document.getElementById('scoreForm').reset();
    });
}

function handleTeamSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  const name               = document.getElementById('regTeamName').value.trim();
  const logoUrl            = document.getElementById('regTeamLogo').value.trim();
  const categoryRegistered = document.getElementById('regTeamCategory').value;
  const groupInput         = prompt("Asigna un Grupo (Ej: A, B o vacío):", "");
  const groupAssigned      = groupInput ? groupInput.trim().toLowerCase() : "";
  push(ref(db, `tournaments/${currentTournamentId}/teams`), { name, logoUrl, categoryRegistered, groupAssigned })
    .then(() => {
      alert("Equipo registrado.");
      document.getElementById('teamForm').reset();
    });
}

function handleVenueSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  push(ref(db, `tournaments/${currentTournamentId}/venues`), {
    name:    document.getElementById('venueName').value.trim(),
    address: document.getElementById('venueAddress').value.trim(),
    mapsUrl: document.getElementById('venueMapsUrl').value.trim()
  }).then(() => {
    alert("Cancha guardada.");
    document.getElementById('venueForm').reset();
  });
}

function handleMatchSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  const cat   = document.getElementById('matchCategory').value;
  const lId   = document.getElementById('selectLocal').value;
  const vId   = document.getElementById('selectVisitor').value;
  const stage = document.getElementById('matchStage').value;

  if (!lId || !vId || lId === vId) return alert("Selecciona equipos diferentes");

  push(ref(db, `tournaments/${currentTournamentId}/matches`), {
    category:    cat,
    stage:       stage,
    localId:     lId,
    localName:   globalTeams[lId].name,
    visitorId:   vId,
    visitorName: globalTeams[vId].name,
    date:        document.getElementById('matchDate').value,
    startTime:   document.getElementById('matchStartTime').value,
    venueId:     document.getElementById('selectMatchVenue').value
  }).then(() => {
    alert("Partido programado.");
    document.getElementById('matchForm').reset();
  });
}

function handleEventSubmit(e) {
  e.preventDefault();
  push(ref(db, 'tournaments'), {
    name:     document.getElementById('eventName').value.trim(),
    location: document.getElementById('eventLocation').value.trim() || "Por definir",
    status:   "active"
  }).then(() => {
    alert("¡Torneo maestro creado!");
    document.getElementById('eventForm').reset();
  });
}

function deleteMatchEvent(matchId) {
  if (confirm("¿Borrar este partido?")) {
    remove(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`));
  }
}
// Hacerla global para que el onclick del HTML la encuentre
window.deleteMatchEvent = deleteMatchEvent;

function deleteTeamFromApp(teamId, teamName) {
  const hasMatches = Object.values(globalMatches).some(
    m => m && (m.localId === teamId || m.visitorId === teamId)
  );
  if (hasMatches) return alert("El equipo ya tiene juegos. Elimina los juegos primero.");
  if (confirm(`¿Eliminar ${teamName}?`))
    remove(ref(db, `tournaments/${currentTournamentId}/teams/${teamId}`));
}
window.deleteMatchEvent  = deleteMatchEvent;
window.deleteTeamFromApp = deleteTeamFromApp;

// ============================================
// EDITAR / ELIMINAR EQUIPO
// ============================================
function populateEditTeamDropdown() {
  const select = document.getElementById('selectEditTeam');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona un Equipo --</option>';
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.name) {
      select.innerHTML += `<option value="${id}">${t.name} — ${categoriesConfig[t.categoryRegistered]?.label || t.categoryRegistered}</option>`;
    }
  });
}

function handleSelectEditTeamChange(e) {
  const teamId = e.target.value;
  if (!teamId || !globalTeams[teamId]) return;
  const team = globalTeams[teamId];
  document.getElementById('editTeamName').value     = team.name              || '';
  document.getElementById('editTeamLogo').value     = team.logoUrl           || '';
  document.getElementById('editTeamCategory').value = team.categoryRegistered || '';
  document.getElementById('editTeamGroup').value    = team.groupAssigned     || '';
}

function handleEditTeamSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('selectEditTeam').value;
  if (!id) return alert("Selecciona un equipo.");
  
  // ✅ FORZAMOS MINÚSCULAS AL GUARDAR
  const groupInput = document.getElementById('editTeamGroup').value.trim().toLowerCase();
  
  update(ref(db, `tournaments/${currentTournamentId}/teams/${id}`), {
    name:              document.getElementById('editTeamName').value.trim(),
    categoryRegistered: document.getElementById('editTeamCategory').value,
    groupAssigned:     groupInput
  }).then(() => {
    alert("¡Equipo actualizado correctamente!");
    document.getElementById('editTeamForm').reset();
  });
}

function handleDeleteTeamButton() {
  const teamId = document.getElementById('selectEditTeam').value;
  if (!teamId) return alert("Selecciona un equipo.");
  deleteTeamFromApp(teamId, globalTeams[teamId].name);
}

// ============================================
// EDITAR PARTIDO
// ============================================
function populateEditMatchDropdown() {
  const select = document.getElementById('selectEditMatch');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona Partido para Corregir --</option>';
  Object.entries(globalMatches).forEach(([id, m]) => {
    if (!m) return;
    select.innerHTML += `<option value="${id}">${m.date || '?'} | ${m.localName} VS ${m.visitorName}</option>`;
  });
}

function handleSelectEditMatchChange(e) {
  const matchId = e.target.value;
  if (!matchId || !globalMatches[matchId]) return;
  const m = globalMatches[matchId];

  document.getElementById('editMatchDate').value      = m.date      || '';
  document.getElementById('editMatchStartTime').value = m.startTime || '';
  document.getElementById('editMatchVenue').value     = m.venueId   || '';
  document.getElementById('editMatchCategory').value  = m.category  || '';
  document.getElementById('editMatchStage').value     = m.stage     || 'regular';

  updateEditMatchTeamsDropdowns();

  setTimeout(() => {
    document.getElementById('editSelectLocal').value   = m.localId;
    document.getElementById('editSelectVisitor').value = m.visitorId;
  }, 100);
}

function updateEditMatchTeamsDropdowns() {
  const selectedCategory = document.getElementById('editMatchCategory')?.value;
  const localSel   = document.getElementById('editSelectLocal');
  const visitorSel = document.getElementById('editSelectVisitor');
  if (!localSel || !visitorSel) return;

  localSel.innerHTML = visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCategory) {
      const opt = `<option value="${id}">${t.name}</option>`;
      localSel.innerHTML   += opt;
      visitorSel.innerHTML += opt;
    }
  });
}

function handleEditMatchSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;

  const matchId = document.getElementById('selectEditMatch').value;
  if (!matchId) return alert("Selecciona un partido para editar.");

  const cat   = document.getElementById('editMatchCategory').value;
  const lId   = document.getElementById('editSelectLocal').value;
  const vId   = document.getElementById('editSelectVisitor').value;
  const stage = document.getElementById('editMatchStage').value;

  if (!lId || !vId || lId === vId) return alert("Selecciona equipos diferentes");

  const updatedData = {
    category:    cat,
    stage:       stage,
    localId:     lId,
    localName:   globalTeams[lId].name,
    visitorId:   vId,
    visitorName: globalTeams[vId].name,
    date:        document.getElementById('editMatchDate').value,
    startTime:   document.getElementById('matchStartTime').value,
    venueId:     document.getElementById('editMatchVenue').value
  };

   update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), updatedData)
    .then(() => {
      alert("✅ Partido actualizado correctamente.");
      document.getElementById('editMatchForm').reset();
    })
    .catch(err => {
      console.error(err);
      alert("Error al actualizar el partido.");
    });
}

function handleDeleteMatchButton() {
  const matchId = document.getElementById('selectEditMatch').value;
  if (!matchId) return alert("Primero selecciona el partido que deseas eliminar.");

  if (confirm("⚠️ ¿Estás seguro de eliminar este partido? Los puntos y estadísticas se borrarán permanentemente.")) {
    remove(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`))
      .then(() => {
        alert("Partido eliminado con éxito.");
        document.getElementById('editMatchForm').reset();
        // Las tablas y roles se actualizarán automáticamente por el onValue
      })
      .catch(err => {
        console.error("Error al eliminar partido:", err);
        alert("No se pudo eliminar el partido.");
      });
    }
}


function printScoresheet(matchId) {
    const m = globalMatches[matchId];
    if (!m) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cédula - ${m.localName} vs ${m.visitorName}</title>
            <style>
                body { font-family: 'Helvetica', Arial, sans-serif; padding: 20px; color: #000; }
                .header-container { display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header-logo { height: 100px; width: auto; margin-right: 20px; }
                .header-text { flex: 1; text-align: center; }
                .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .info-table td { padding: 8px; border: 1px solid #000; font-size: 14px; }
                .teams-container { display: flex; justify-content: space-between; gap: 15px; }
                .team-box { width: 49%; }
                .player-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .player-table th, .player-table td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 12px; }
                .footer { margin-top: 40px; display: flex; justify-content: space-around; }
                .sign-line { border-top: 1px solid #000; width: 140px; text-align: center; font-size: 12px; padding-top: 5px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print"><button onclick="window.print()" style="padding:10px; margin-bottom:20px; cursor:pointer;">🖨️ IMPRIMIR CÉDULA</button></div>
            
            <div class="header-container">
                <img src="${APP_LOGO_URL}" class="header-logo">
                <div class="header-text">
                    <h1 style="margin:0; font-size: 24px;">HOJA DE ANOTACIÓN OFICIAL</h1>
                    <h2 style="margin:5px 0; color: #444;">DRIBLA, PASA Y ENCESTA</h2>
                </div>
                <div style="width:100px;"></div> <!-- balance visual -->
            </div>

            <table class="info-table">
                <tr>
                    <td><strong>RAMA / CAT:</strong> ${categoriesConfig[m.category]?.label || m.category}</td>
                    <td><strong>FECHA:</strong> ${m.date}</td>
                    <td><strong>HORA:</strong> ${m.startTime}</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>CANCHA:</strong> ${globalVenues[m.venueId]?.name || '---'}</td>
                    <td><strong>ETAPA:</strong> ${m.stage ? m.stage.toUpperCase() : 'LIGA'}</td>
                </tr>
            </table>

            <div class="teams-container">
                <div class="team-box">
                    <h4 style="margin:0; padding:5px; background:#000; color:#fff; text-align:center;">LOCAL: ${m.localName}</h4>
                    <table class="player-table">
                        <thead><tr><th>#</th><th>Nombre Jugador</th><th>F1</th><th>F2</th><th>F3</th><th>F4</th><th>F5</th></tr></thead>
                        <tbody>${Array(12).fill('<tr><td style="height:22px;"></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody>
                    </table>
                </div>
                <div class="team-box">
                    <h4 style="margin:0; padding:5px; background:#000; color:#fff; text-align:center;">VISITA: ${m.visitorName}</h4>
                    <table class="player-table">
                        <thead><tr><th>#</th><th>Nombre Jugador</th><th>F1</th><th>F2</th><th>F3</th><th>F4</th><th>F5</th></tr></thead>
                        <tbody>${Array(12).fill('<tr><td style="height:22px;"></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody>
                    </table>
                </div>
            </div>

            <table class="player-table" style="width: 300px; margin-top: 20px;">
                <thead><tr><th colspan="6">PUNTUACIÓN POR PERIODOS</th></tr></thead>
                <tr><td>1°</td><td>2°</td><td>3°</td><td>4°</td><td>EX</td><td>Total</td></tr>
                <tr><td style="height:30px;"></td><td></td><td></td><td></td><td></td><td></td></tr>
            </table>

            <div class="footer">
                <div class="sign-line">Capitán Local</div>
                <div class="sign-line">Capitán Visita</div>
                <div class="sign-line">Árbitro</div>
                <div class="sign-line">Anotador</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}
    window.printScoresheet = printScoresheet;
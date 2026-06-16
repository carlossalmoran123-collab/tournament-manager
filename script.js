import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Configuración de Firebase
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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
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

  document.getElementById('scoreSelectMatch')?.addEventListener('change', (e) => {
    const matchId = e.target.value;
    if (matchId && globalMatches[matchId]) {
      const match = globalMatches[matchId];
      document.getElementById('labelLocalTeam').innerText = `Puntos ${match.localName}:`;
      document.getElementById('labelVisitorTeam').innerText = `Puntos ${match.visitorName}:`;
    }
  });

  initGlobalTournamentsObserver();
});

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (user) {
    document.body.classList.add('is-admin');
    document.getElementById('admin-login-box').style.display = 'none';
    document.getElementById('btnGoToAdminPrep').style.display = 'block';
    document.getElementById('admin-dashboard-panels').style.display = 'grid';
  } else {
    document.body.classList.remove('is-admin');
    document.getElementById('admin-login-box').style.display = 'flex';
    document.getElementById('btnGoToAdminPrep').style.display = 'none';
    document.getElementById('admin-dashboard-panels').style.display = 'none';
  }
  renderCompetitionsSelector(); 
  if (currentTournamentId) {
    renderCategories();
    renderMatchesByVenue();
  }
});

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
    globalTeams = data.teams || {};
    globalVenues = data.venues || {};
    globalMatches = data.matches || {};
    globalFormats = data.formats || {};

    document.getElementById('appTournamentTitle').innerText = data.name || "Torneo Activo";
    document.getElementById('appTournamentVenue').innerText = data.location || "Sede General";
    document.getElementById('appTournamentFormat').innerText = data.format || "Formato Regular";

    populateStaticAdminDropdowns();
    updateFilteredTeamsDropdowns();
    populateScoreMatchesDropdown();
    renderDashboard();
    renderCategories();
    renderMatchesByVenue();
    renderClassificationTables();
  });
}

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

function populateStaticAdminDropdowns() {
  const venueSel = document.getElementById('selectMatchVenue');
  const teamCatSel = document.getElementById('regTeamCategory');
  const formatCatSel = document.getElementById('formatSelectCategory');
  const filterCatSel = document.getElementById('classCategoryFilter');

  if (venueSel) {
    venueSel.innerHTML = '<option value="">-- Selecciona Cancha --</option>';
    Object.entries(globalVenues).forEach(([id, v]) => {
      if(v?.name) venueSel.innerHTML += `<option value="${id}">${v.name}</option>`;
    });
  }

  const catOptions = Object.entries(categoriesConfig).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  if (teamCatSel) teamCatSel.innerHTML = catOptions;
  if (formatCatSel) formatCatSel.innerHTML = catOptions;
  if (filterCatSel && filterCatSel.children.length === 0) filterCatSel.innerHTML = catOptions;
}

function updateFilteredTeamsDropdowns() {
  const selectedCategory = document.getElementById('matchCategory')?.value;
  const localSel = document.getElementById('selectLocal');
  const visitorSel = document.getElementById('selectVisitor');
  if (!localSel || !visitorSel) return;

  localSel.innerHTML = visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCategory) {
      const groupLabel = t.groupAssigned ? ` (${t.groupAssigned.toUpperCase()})` : '';
      const opt = `<option value="${id}">${t.name}${groupLabel}</option>`;
      localSel.innerHTML += opt;
      visitorSel.innerHTML += opt;
    }
  });
}

function populateScoreMatchesDropdown() {
  const select = document.getElementById('scoreSelectMatch');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona un Partido Programado --</option>';
  
  Object.entries(globalMatches).forEach(([id, m]) => {
    if (!m) return;
    const statusText = (m.localScore !== undefined) ? ` 🕒 (Jugado: ${m.localScore}-${m.visitorScore})` : '';
    select.innerHTML += `<option value="${id}">${categoriesConfig[m.category]?.label || m.category} | ${m.localName} VS ${m.visitorName} - ${m.date}${statusText}</option>`;
  });
}

function renderClassificationTables() {
  const container = document.getElementById('classificationTablesContainer');
  const selectedCat = document.getElementById('classCategoryFilter')?.value;
  if (!container || !selectedCat) return;
  container.innerHTML = '';

  const formatConfig = globalFormats[selectedCat] || { type: 'todos-contra-todos' };
  
  const stats = {};
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCat) {
      stats[id] = { name: t.name, group: t.groupAssigned || 'sin grupo', jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, dif: 0, pts: 0 };
    }
  });

  Object.values(globalMatches).forEach(m => {
    if (m && m.category === selectedCat && m.localScore !== undefined && m.visitorScore !== undefined) {
      const locS = parseInt(m.localScore);
      const visS = parseInt(m.visitorScore);
      if(stats[m.localId] && stats[m.visitorId]) {
        stats[m.localId].jj++; stats[m.visitorId].jj++;
        stats[m.localId].pf += locS; stats[m.localId].pc += visS;
        stats[m.visitorId].pf += visS; stats[m.visitorId].pc += locS;
        if (locS > visS) { stats[m.localId].jg++; stats[m.localId].pts += 2; stats[m.visitorId].jp++; stats[m.visitorId].pts += 1; }
        else { stats[m.visitorId].jg++; stats[m.visitorId].pts += 2; stats[m.localId].jp++; stats[m.localId].pts += 1; }
      }
    }
  });
  Object.keys(stats).forEach(id => { stats[id].dif = stats[id].pf - stats[id].pc; });

  const sortTeams = (arr) => arr.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.pf - a.pf);
  if (formatConfig.type === 'grupos') {
    const groupsMap = {};
    Object.values(stats).forEach(t => { if (!groupsMap[t.group]) groupsMap[t.group] = []; groupsMap[t.group].push(t); });
    Object.keys(groupsMap).sort().forEach(groupName => {
      container.innerHTML += `<h3>Grupo: ${groupName.toUpperCase()}</h3>` + generateTableHtml(sortTeams(groupsMap[groupName]));
    });
  } else {
    container.innerHTML += `<h3>Liga General: ${categoriesConfig[selectedCat].label}</h3>` + generateTableHtml(sortTeams(Object.values(stats)));
  }
}

function generateTableHtml(teamsArray) {
  if (teamsArray.length === 0) return '<p style="color:#aaa; font-style:italic; padding:10px;">No hay escuadras en este sector.</p>';
  let html = `<div style="overflow-x:auto; margin-bottom:25px;"><table class="classification-table" style="width:100%; border-collapse:collapse; background:var(--bg-card); border:1px solid var(--border-color); text-align:center;"><thead><tr style="background:#1e2530; color:#fff; border-bottom:2px solid var(--accent-orange);"><th style="padding:10px; text-align:left;">Pos / Club</th><th>JJ</th><th>JG</th><th>JP</th><th>PF</th><th>PC</th><th>DIF</th><th style="color:var(--accent-orange)">PTS</th></tr></thead><tbody>`;
  teamsArray.forEach((t, index) => {
    html += `<tr style="border-bottom:1px solid var(--border-color)"><td style="padding:10px; text-align:left;"><strong>${index + 1}.</strong> ${t.name}</td><td>${t.jj}</td><td>${t.jg}</td><td>${t.jp}</td><td>${t.pf}</td><td>${t.pc}</td><td style="color:${t.dif >= 0 ? '#10b981' : '#ef4444'}">${t.dif > 0 ? '+' : ''}${t.dif}</td><td style="font-weight:bold; color:var(--accent-orange);">${t.pts}</td></tr>`;
  });
  return html + `</tbody></table></div>`;
}

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';
  const venuesArr = Object.entries(globalVenues).filter(([_, v]) => v?.name);
  const matchesArr = Object.entries(globalMatches).filter(([_, m]) => m?.date);

  venuesArr.forEach(([venueId, venue]) => {
    const block = document.createElement('div');
    block.className = 'venue-role-block';
    const mapsLink = venue.mapsUrl ? `<a href="${venue.mapsUrl}" target="_blank" style="color:var(--accent-orange); font-size:0.8rem; text-decoration:underline;">📍 Ver en Google Maps</a>` : '';
    
    block.innerHTML = `
      <div class="venue-title-header">
        <h3>🏢 Sede: ${venue.name}</h3>
        <p>${venue.address || ''} ${mapsLink}</p>
      </div>`;
    
    const vMatches = matchesArr.filter(([_, m]) => m.venueId === venueId);
    const dates = [...new Set(vMatches.map(([_, m]) => m.date))].sort();
    
    dates.forEach(date => {
      const dbBlock = document.createElement('div');
      dbBlock.className = 'date-role-block';
      dbBlock.innerHTML = `<h4 class="date-divider">📅 ${date}</h4>`;
      const grid = document.createElement('div');
      grid.className = 'matches-table-grid';

      vMatches.filter(([_, m]) => m.date === date).forEach(([mId, match]) => {
        const scoreText = (match.localScore !== undefined) ? `<div style="font-size:1.1rem; font-weight:bold; color:#fff; background:#111; border:1px solid #ff6b00; padding:6px; border-radius:6px; margin:8px 0; text-align:center; letter-spacing:1px;">🏀 SCORE: ${match.localScore} - ${match.visitorScore}</div>` : '';
        grid.innerHTML += `
          <div class="match-schedule-card">
            <div class="match-time-badge">⏰ ${match.startTime}</div>
            <div class="match-category-tag">${categoriesConfig[match.category]?.label || match.category}</div>
            <div class="match-teams-vs"><div><strong>${match.localName}</strong></div><div class="vs-divider">VS</div><div><strong>${match.visitorName}</strong></div></div>
            ${scoreText}
            ${isAdmin ? `<button class="btn-delete-match" onclick="deleteMatchEvent('${mId}')">🗑️ Eliminar Juego</button>` : ''}
          </div>`;
      });
      dbBlock.appendChild(grid);
      block.appendChild(dbBlock);
    });
    container.appendChild(block);
  });
}

function handleFormatSubmit(e) { e.preventDefault(); if(!currentTournamentId) return; const category = document.getElementById('formatSelectCategory').value; const type = document.getElementById('systemTypeSelect').value; set(ref(db, `tournaments/${currentTournamentId}/formats/${category}`), { type }).then(() => alert("⚙️ Formato configurado.") ); }
function handleScoreSubmit(e) { e.preventDefault(); if(!currentTournamentId) return; const matchId = document.getElementById('scoreSelectMatch').value; const localScore = parseInt(document.getElementById('scoreLocal').value); const visitorScore = parseInt(document.getElementById('scoreVisitor').value); if (!matchId) return; update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), { localScore, visitorScore }).then(() => { alert("🏀 Marcador guardado."); document.getElementById('scoreForm').reset(); }); }
function handleTeamSubmit(e) { e.preventDefault(); if (!currentTournamentId) return; const name = document.getElementById('regTeamName').value.trim(); const logoUrl = document.getElementById('regTeamLogo').value.trim(); const categoryRegistered = document.getElementById('regTeamCategory').value; const groupInput = prompt("Asigna un Grupo (Ej: A, B o vacío):", ""); const groupAssigned = groupInput ? groupInput.trim().toLowerCase() : ""; push(ref(db, `tournaments/${currentTournamentId}/teams`), { name, logoUrl, categoryRegistered, groupAssigned }).then(() => { alert("Equipo registrado."); document.getElementById('teamForm').reset(); }); }
function handleVenueSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/venues`), { name: document.getElementById('venueName').value.trim(), address: document.getElementById('venueAddress').value.trim(), mapsUrl: document.getElementById('venueMapsUrl').value.trim() }).then(() => { alert("Cancha guardada."); document.getElementById('venueForm').reset(); }); }
function handleMatchSubmit(e) { e.preventDefault(); const cat = document.getElementById('matchCategory').value; const lId = document.getElementById('selectLocal').value; const vId = document.getElementById('selectVisitor').value; if(lId === vId) return; push(ref(db, `tournaments/${currentTournamentId}/matches`), { category: cat, localId: lId, localName: globalTeams[lId].name, visitorId: vId, visitorName: globalTeams[vId].name, date: document.getElementById('matchDate').value, startTime: document.getElementById('matchStartTime').value, endTime: document.getElementById('matchEndTime').value, venueId: document.getElementById('selectMatchVenue').value }).then(() => { alert("Partido programado."); document.getElementById('matchForm').reset(); }); }
function handleEventSubmit(e) { e.preventDefault(); push(ref(db, 'tournaments'), { name: document.getElementById('eventName').value.trim(), location: document.getElementById('eventLocation').value.trim() || "Por definir", maxTeams: parseInt(document.getElementById('eventTeams').value) || 20, format: document.getElementById('competitionFormat').value, description: document.getElementById('eventDescription').value.trim(), status: "active" }).then(() => { alert("¡Torneo creado!"); document.getElementById('eventForm').reset(); document.getElementById('btnBackToSelector')?.click(); }); }
async function handleLoginSubmit(e) { e.preventDefault(); try { await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value); alert("🔐 Modo Coach Autenticado."); } catch (error) { alert("Acceso denegado"); } }
async function handleLogout() { await signOut(auth); document.getElementById('btnBackToSelector').click(); }

function deleteMatchEvent(matchId) { if (confirm("¿Borrar este partido?")) remove(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`)); }
function deleteTeamFromApp(teamId, teamName) { if (Object.values(globalMatches).some(m => m && (m.localId === teamId || m.visitorId === teamId))) return alert("El equipo ya tiene juegos."); if (confirm(`¿Eliminar ${teamName}?`)) remove(ref(db, `tournaments/${currentTournamentId}/teams/${teamId}`)); }
window.deleteMatchEvent = deleteMatchEvent; window.deleteTeamFromApp = deleteTeamFromApp;

function renderDashboard() { const teamsArr = Object.values(globalTeams).filter(t => t?.name); document.getElementById('dashTeamsCount').innerText = teamsArr.length; document.getElementById('dashMatchesCount').innerText = Object.values(globalMatches).filter(m => m?.date).length; const container = document.getElementById('dashboardTeamsContainer'); if (!container) return; container.innerHTML = ''; teamsArr.forEach(team => { const pill = document.createElement('div'); pill.className = 'team-pill'; pill.innerHTML = `<img src="${team.logoUrl || 'https://placehold.co/40x40/007bff/ffffff?text=🏀'}" onerror="this.src='https://placehold.co/40x40/007bff/ffffff?text=🏀'"><div><strong>${team.name}</strong><br><small style="color: #ff6b00;">${categoriesConfig[team.categoryRegistered]?.label || 'Sin Cat.'}</small></div>`; container.appendChild(pill); }); }
function renderCategories() { const container = document.getElementById('categoriesContainer'); if (!container) return; container.innerHTML = ''; const teamsArr = Object.entries(globalTeams).filter(([_, t]) => t?.name); Object.keys(categoriesConfig).forEach(catKey => { const filteredTeams = teamsArr.filter(([_, t]) => t.categoryRegistered === catKey); const card = document.createElement('div'); card.className = 'category-card'; let list = '<ul style="list-style:none; padding:0;">'; filteredTeams.forEach(([teamId, t]) => { list += `<li style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #333;"><span>🛡️ ${t.name}${t.groupAssigned ? ` <span style="background:#ff6b00; font-size:10px; color:#fff; padding:2px 5px; border-radius:3px;">Grup: ${t.groupAssigned.toUpperCase()}</span>` : ''}</span>${isAdmin ? `<button onclick="deleteTeamFromApp('${teamId}', '${t.name}')" style="background:none; border:none; cursor:pointer;">🗑️</button>` : ''}</li>`; }); list += '</ul>'; card.innerHTML = `<div class="category-card-header"><h4>${categoriesConfig[catKey].label}</h4><p>${categoriesConfig[catKey].desc}</p></div><div class="category-card-body"><h5>Clubes:</h5>${list}</div>`; container.appendChild(card); }); }
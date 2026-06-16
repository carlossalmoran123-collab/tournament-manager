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
  "chupon": { label: "🍼 Chupon (Mixto)", desc: "Iniciación (4-6 años)" },
  "micro": { label: "👶 Micro (Mixto)", desc: "Años 2017 - 2018" },
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
  "sub21-femenil": { label: "👨‍🎓 Sub 21 Femenil", desc: "Universitaria Desarrollo" },
  "sub21-varonil": { label: "👨‍🎓 Sub 21 Varonil", desc: "Universitaria Desarrollo" },
  "sub23-femenil": { label: "👨‍🎓 Sub 23 Femenil", desc: "Universitaria Avanzada" },
  "sub23-varonil": { label: "👨‍🎓 Sub 23 Varonil", desc: "Universitaria Avanzada" }
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
  if (filterCatSel) filterCatSel.innerHTML = catOptions;
}

function updateFilteredTeamsDropdowns() {
  const selectedCategory = document.getElementById('matchCategory')?.value;
  const localSel = document.getElementById('selectLocal');
  const visitorSel = document.getElementById('selectVisitor');
  if (!localSel || !visitorSel) return;

  localSel.innerHTML = visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCategory) {
      const opt = `<option value="${id}">${t.name}</option>`;
      localSel.innerHTML += opt;
      visitorSel.innerHTML += opt;
    }
  });
}

function populateScoreMatchesDropdown() {
  const select = document.getElementById('scoreSelectMatch');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona un Partido --</option>';
  Object.entries(globalMatches).forEach(([id, m]) => {
    if (!m) return;
    select.innerHTML += `<option value="${id}">${m.localName} VS ${m.visitorName} (${m.date})</option>`;
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
      stats[id] = { name: t.name, jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, dif: 0, pts: 0 };
    }
  });

  Object.values(globalMatches).forEach(m => {
    if (m && m.category === selectedCat && m.localScore !== undefined) {
      const locS = parseInt(m.localScore), visS = parseInt(m.visitorScore);
      if(stats[m.localId] && stats[m.visitorId]) {
        stats[m.localId].jj++; stats[m.visitorId].jj++;
        stats[m.localId].pf += locS; stats[m.localId].pc += visS;
        stats[m.visitorId].pf += visS; stats[m.visitorId].pc += locS;
        if (locS > visS) { stats[m.localId].jg++; stats[m.localId].pts += 2; stats[m.visitorId].jp++; }
        else { stats[m.visitorId].jg++; stats[m.visitorId].pts += 2; stats[m.localId].jp++; }
      }
    }
  });
  Object.keys(stats).forEach(id => { stats[id].dif = stats[id].pf - stats[id].pc; });

  const sorted = Object.values(stats).sort((a, b) => b.pts - a.pts || b.dif - a.dif);
  container.innerHTML = generateTableHtml(sorted);
}

function generateTableHtml(teamsArray) {
  if (teamsArray.length === 0) return '<p>No hay equipos en esta categoría.</p>';
  let html = `<table class="classification-table"><thead><tr><th>Club</th><th>JJ</th><th>PTS</th></tr></thead><tbody>`;
  teamsArray.forEach(t => { html += `<tr><td>${t.name}</td><td>${t.jj}</td><td>${t.pts}</td></tr>`; });
  return html + `</tbody></table>`;
}

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';
  
  Object.entries(globalVenues).forEach(([venueId, venue]) => {
    const mapsLink = venue.mapsUrl ? `<a href="${venue.mapsUrl}" target="_blank">📍 Ver en Google Maps</a>` : '';
    const block = document.createElement('div');
    block.className = 'venue-role-block';
    block.innerHTML = `<h3>🏢 ${venue.name}</h3><p>${venue.address || ''} ${mapsLink}</p>`;
    
    Object.entries(globalMatches).forEach(([mId, match]) => {
      if (match.venueId === venueId) {
        block.innerHTML += `<div class="match-card">${match.localName} VS ${match.visitorName} - ${match.date}</div>`;
      }
    });
    container.appendChild(block);
  });
}

// Handlers
function handleTeamSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/teams`), { name: document.getElementById('regTeamName').value, categoryRegistered: document.getElementById('regTeamCategory').value }).then(() => alert("Equipo guardado.")); }
function handleVenueSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/venues`), { name: document.getElementById('venueName').value, address: document.getElementById('venueAddress').value, mapsUrl: document.getElementById('venueMapsUrl').value }).then(() => alert("Cancha guardada.")); }
function handleMatchSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/matches`), { category: document.getElementById('matchCategory').value, localId: document.getElementById('selectLocal').value, localName: document.getElementById('selectLocal').options[document.getElementById('selectLocal').selectedIndex].text, visitorId: document.getElementById('selectVisitor').value, visitorName: document.getElementById('selectVisitor').options[document.getElementById('selectVisitor').selectedIndex].text, date: document.getElementById('matchDate').value, venueId: document.getElementById('selectMatchVenue').value }).then(() => alert("Partido programado.")); }
function handleFormatSubmit(e) { e.preventDefault(); set(ref(db, `tournaments/${currentTournamentId}/formats/${document.getElementById('formatSelectCategory').value}`), { type: document.getElementById('systemTypeSelect').value }); }
function handleScoreSubmit(e) { e.preventDefault(); update(ref(db, `tournaments/${currentTournamentId}/matches/${document.getElementById('scoreSelectMatch').value}`), { localScore: document.getElementById('scoreLocal').value, visitorScore: document.getElementById('scoreVisitor').value }); }
function handleEventSubmit(e) { e.preventDefault(); push(ref(db, 'tournaments'), { name: document.getElementById('eventName').value, location: document.getElementById('eventLocation').value }).then(() => alert("Torneo creado.")); }
async function handleLoginSubmit(e) { e.preventDefault(); await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); }
async function handleLogout() { await signOut(auth); location.reload(); }

function renderDashboard() { document.getElementById('dashTeamsCount').innerText = Object.keys(globalTeams).length; }
function renderCategories() { /* Lógica de renderizado de categorías */ }
window.deleteMatchEvent = (mId) => remove(ref(db, `tournaments/${currentTournamentId}/matches/${mId}`));
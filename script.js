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

let currentTournamentId = null, isAdmin = false;
let globalTournaments = {}, globalTeams = {}, globalVenues = {}, globalMatches = {}, globalFormats = {};

const categoriesConfig = {
  "chupon": { label: "🍼 Chupon (Mixto)", desc: "Iniciación y psicomotricidad básica (4-6 años)" },
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

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('btnEnterApp')?.addEventListener('click', loadSelectedTournamentContext);
  document.getElementById('teamForm')?.addEventListener('submit', handleTeamSubmit);
  document.getElementById('matchForm')?.addEventListener('submit', handleMatchSubmit);
  document.getElementById('scoreForm')?.addEventListener('submit', handleScoreSubmit);
  document.getElementById('classCategoryFilter')?.addEventListener('change', renderClassificationTables);
  
  initGlobalTournamentsObserver();
});

// --- LÓGICA DE DATOS Y RENDERIZADO ---
function attachTournamentRealtimeListeners(tournamentId) {
  onValue(ref(db, `tournaments/${tournamentId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    globalTeams = data.teams || {};
    globalVenues = data.venues || {};
    globalMatches = data.matches || {};
    globalFormats = data.formats || {};

    populateStaticAdminDropdowns();
    renderDashboard();
    renderCategories();
    renderMatchesByVenue();
    renderClassificationTables();
  });
}

function renderClassificationTables() {
  const container = document.getElementById('classificationTablesContainer');
  const cat = document.getElementById('classCategoryFilter')?.value;
  if (!container || !cat) return;
  
  const stats = {};
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t.categoryRegistered === cat) {
      stats[id] = { name: t.name, jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, dif: 0, pts: 0 };
    }
  });

  Object.values(globalMatches).forEach(m => {
    if (m.category === cat && m.localScore !== undefined) {
      const lS = parseInt(m.localScore), vS = parseInt(m.visitorScore);
      if(stats[m.localId] && stats[m.visitorId]) {
        stats[m.localId].jj++; stats[m.visitorId].jj++;
        stats[m.localId].pf += lS; stats[m.localId].pc += vS;
        stats[m.visitorId].pf += vS; stats[m.visitorId].pc += lS;
        if (lS > vS) { stats[m.localId].jg++; stats[m.localId].pts += 2; stats[m.visitorId].jp++; stats[m.visitorId].pts += 1; }
        else { stats[m.visitorId].jg++; stats[m.visitorId].pts += 2; stats[m.localId].jp++; stats[m.localId].pts += 1; }
      }
    }
  });

  // Generación de tabla (HTML profesional)
  let html = `<table class="classification-table"><thead><tr><th>Pos / Club</th><th>JJ</th><th>JG</th><th>JP</th><th>PTS</th></tr></thead><tbody>`;
  Object.values(stats).sort((a, b) => b.pts - a.pts).forEach((t, i) => {
    html += `<tr><td>${i+1}. ${t.name}</td><td>${t.jj}</td><td>${t.jg}</td><td>${t.jp}</td><td style="font-weight:bold">${t.pts}</td></tr>`;
  });
  container.innerHTML = html + `</tbody></table>`;
}

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';
  
  Object.entries(globalVenues).forEach(([vId, v]) => {
    const maps = v.mapsUrl ? `<a href="${v.mapsUrl}" target="_blank">📍 Ver en Maps</a>` : '';
    let block = `<h3>🏢 ${v.name}</h3><p>${v.address || ''} ${maps}</p>`;
    
    Object.entries(globalMatches).forEach(([mId, m]) => {
      if (m.venueId === vId) {
        block += `<div class="match-card"><strong>${m.localName} VS ${m.visitorName}</strong><br>
                  ${m.date} - ${m.startTime} ${isAdmin ? `<button onclick="deleteMatchEvent('${mId}')">🗑️</button>` : ''}</div>`;
      }
    });
    container.appendChild(document.createElement('div')).className = 'venue-role-block';
    container.lastChild.innerHTML = block;
  });
}

// --- HANDLERS ---
function handleTeamSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/teams`), { name: document.getElementById('regTeamName').value, categoryRegistered: document.getElementById('regTeamCategory').value }); }
function handleMatchSubmit(e) { e.preventDefault(); push(ref(db, `tournaments/${currentTournamentId}/matches`), { category: document.getElementById('matchCategory').value, localId: document.getElementById('selectLocal').value, localName: globalTeams[document.getElementById('selectLocal').value].name, visitorId: document.getElementById('selectVisitor').value, visitorName: globalTeams[document.getElementById('selectVisitor').value].name, date: document.getElementById('matchDate').value, venueId: document.getElementById('selectMatchVenue').value }); }
function handleScoreSubmit(e) { e.preventDefault(); update(ref(db, `tournaments/${currentTournamentId}/matches/${document.getElementById('scoreSelectMatch').value}`), { localScore: document.getElementById('scoreLocal').value, visitorScore: document.getElementById('scoreVisitor').value }); }
async function handleLoginSubmit(e) { e.preventDefault(); await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); }
async function handleLogout() { await signOut(auth); location.reload(); }
function switchSection(sectionId) { document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.getElementById(sectionId)?.classList.add('active'); }
window.switchSection = switchSection;
window.deleteMatchEvent = (mId) => remove(ref(db, `tournaments/${currentTournamentId}/matches/${mId}`));

function populateStaticAdminDropdowns() {
  const catOptions = Object.entries(categoriesConfig).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  ['regTeamCategory', 'matchCategory', 'classCategoryFilter'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = catOptions; });
}

function initGlobalTournamentsObserver() { onValue(ref(db, 'tournaments'), (snapshot) => { globalTournaments = snapshot.val() || {}; }); }
function loadSelectedTournamentContext() { /* Lógica de carga */ currentTournamentId = document.getElementById('globalCompetitionSelect').value; attachTournamentRealtimeListeners(currentTournamentId); switchSection('dashboard'); }
function renderDashboard() { /* Lógica de conteo de equipos */ }
function renderCategories() { /* Lógica de listado de categorías */ }
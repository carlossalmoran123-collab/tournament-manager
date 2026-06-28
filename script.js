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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('btnDeleteMatch')?.addEventListener('click', handleDeleteMatchButton);
  document.getElementById('btnEnterApp')?.addEventListener('click', loadSelectedTournamentContext);
  document.getElementById('sponsorForm')?.addEventListener('submit', handleSponsorSubmit);
  document.getElementById('btnGoToAdminPrep')?.addEventListener('click', () => switchSection('admin', true));

  document.getElementById('btnBackToSelector')?.addEventListener('click', () => {
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
  });

  document.getElementById('editVenueForm')?.addEventListener('submit', handleEditVenueSubmit);
  document.getElementById('selectEditVenue')?.addEventListener('change', handleSelectEditVenueChange);
  document.getElementById('btnDeleteVenue')?.addEventListener('click', handleDeleteVenueButton);
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
    populateEditVenueDropdown();
  });

  // Patrocinadores: listener separado para no re-registrar en cada update del torneo
  // Listener de sponsors: actualiza carrusel público y lista admin
  onValue(ref(db, `tournaments/${tournamentId}/sponsors`), (snap) => {
    const data = snap.val();
    startSponsorRotation(data);
    renderAdminSponsorList(data);
  });
}

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (user) {
    document.body.classList.add('is-admin');
    if (document.getElementById('admin-login-box'))    document.getElementById('admin-login-box').style.display = 'none';
    if (document.getElementById('btnGoToAdminPrep'))   document.getElementById('btnGoToAdminPrep').style.display = 'block';
    if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'grid';
  } else {
    document.body.classList.remove('is-admin');
    if (document.getElementById('admin-login-box'))    document.getElementById('admin-login-box').style.display = 'flex';
    if (document.getElementById('btnGoToAdminPrep'))   document.getElementById('btnGoToAdminPrep').style.display = 'none';
    if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'none';
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
  const venueSel        = document.getElementById('selectMatchVenue');
  const teamCatSel      = document.getElementById('regTeamCategory');
  const formatCatSel    = document.getElementById('formatSelectCategory');
  const filterCatSel    = document.getElementById('classCategoryFilter');
  const editTeamCatSel  = document.getElementById('editTeamCategory');
  const editMatchCatSel = document.getElementById('editMatchCategory');
  const matchCatSel     = document.getElementById('matchCategory');

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

  if (teamCatSel)     teamCatSel.innerHTML     = catOptions;
  if (formatCatSel)   formatCatSel.innerHTML   = catOptions;
  // FIX: siempre actualizar el filtro de categoría
  if (filterCatSel) {
    const prevVal = filterCatSel.value;
    filterCatSel.innerHTML = catOptions;
    if (prevVal) filterCatSel.value = prevVal;
  }
  if (editTeamCatSel)  editTeamCatSel.innerHTML  = catOptions;
  if (editMatchCatSel) editMatchCatSel.innerHTML = catOptions;
  if (matchCatSel)    matchCatSel.innerHTML    = catOptions;

  updateFilteredTeamsDropdowns();
}

function updateFilteredTeamsDropdowns() {
  const matchCatSel      = document.getElementById('matchCategory');
  const selectedCategory = matchCatSel?.value;
  const localSel         = document.getElementById('selectLocal');
  const visitorSel       = document.getElementById('selectVisitor');
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
  document.getElementById('dashTeamsCount').innerText   = teamsArr.length;
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
// RENDER: PLAYOFFS
// ============================================
function renderPlayoffs(container) {
  const playoffs = Object.values(globalMatches).filter(m => m && (m.stage === 'semifinal' || m.stage === 'final'));
  
  if (playoffs.length > 0) {
    let html = `<div style="border:2px solid #ff6b00; padding:15px; border-radius:10px; margin-bottom:30px; background:rgba(255,107,0,0.05);">
      <h2 style="color:#ff6b00; text-align:center; margin:0 0 15px 0; font-size:1.5rem; text-transform:uppercase;">🔥 FASE FINAL</h2>`;
    
    playoffs.forEach(m => {
      const score = m.localScore !== undefined ? `${m.localScore} - ${m.visitorScore}` : 'VS';
      const venueName = globalVenues[m.venueId]?.name || 'Sede por definir';
      // Dentro del playoffs.forEach en renderPlayoffs, añade este bloque de botones al Admin
let adminBtns = '';
if (isAdmin) {
    adminBtns = `
      <div style="margin-top:10px; display:flex; justify-content:center; gap:10px;">
        <button onclick="setQuickScore('${Object.keys(globalMatches).find(k => globalMatches[k] === m)}')" style="background:#10b981; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">⏱️ Cargar Marcador</button>
        <button onclick="printScoresheet('${Object.keys(globalMatches).find(k => globalMatches[k] === m)}')" style="background:#334155; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">📄</button>
      </div>`;
      {adminBtns}
}

// Y lo agregas al final del bloque HTML del partido
      
      html += `
        <div style="text-align:center; padding:15px; border-bottom:1px solid #444; margin-bottom:10px;">
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:5px;">
            <span style="background:#ff6b00; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${m.stage.toUpperCase()}</span>
            <span style="background:#334155; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${categoriesConfig[m.category]?.label || m.category}</span>
          </div>
          
          <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin:10px 0;">
            <strong style="font-size:1.2rem; flex:1; text-align:right;">${m.localName}</strong>
            <span style="background:#ff6b00; color:#fff; padding:5px 15px; border-radius:5px; font-size:1.3rem; font-weight:black; min-width:80px;">${score}</span>
            <strong style="font-size:1.2rem; flex:1; text-align:left;">${m.visitorName}</strong>
          </div>

          <div style="font-size:0.85rem; color:#aaa; display:flex; justify-content:center; gap:15px;">
            <span>📅 ${m.date}</span>
            <span>⏰ <strong>${m.startTime} hrs</strong></span>
            <span>📍 <strong>${venueName}</strong></span>
          </div>
        </div>`;
    });
    container.innerHTML += html + `</div>`;
  }
}

// ============================================
// RENDER: ROL DE JUEGOS
// ============================================
function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';

  const venuesArr  = Object.entries(globalVenues).filter(([_, v]) => v?.name);
  const matchesArr = Object.entries(globalMatches).filter(([_, m]) => m?.date);

  venuesArr.forEach(([venueId, venue]) => {
    const block = document.createElement('div');
    block.className = 'venue-role-block';
    block.style.marginBottom = '40px';

    const mapsLink = venue.mapsUrl
      ? `<a href="${venue.mapsUrl}" target="_blank" style="margin-left:15px; font-size:0.85rem; color:#ff6b00; text-decoration:underline;">📍 Ver Ubicación</a>`
      : '';

    block.innerHTML = `
      <div style="display:flex; align-items:center; border-bottom:3px solid var(--accent-orange); margin-bottom:15px; background: rgba(255,107,0,0.05); padding: 10px; border-radius: 8px 8px 0 0;">
        <h3 style="margin:0;">🏢 SEDE: ${venue.name}</h3>
        ${mapsLink}
      </div>`;

    const vMatches = matchesArr.filter(([_, m]) => m.venueId === venueId);

    if (vMatches.length === 0) {
      block.innerHTML += `<p style="color:#888; font-style:italic; padding:10px;">No hay partidos programados en esta sede.</p>`;
    } else {
      const uniqueDates = [...new Set(vMatches.map(([_, m]) => m.date))].sort();

      uniqueDates.forEach(dateString => {
        // ✅ FIX: parsear la fecha sin conversión de zona horaria
        if (!dateString) return;
        const parts = dateString.split('-');
        if (parts.length !== 3) return;
        const year  = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day   = parseInt(parts[2], 10);

        // Usar UTC para evitar que el día se desplace por zona horaria
        const fechaObj = new Date(Date.UTC(year, month, day));
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
        let fechaBonita = fechaObj.toLocaleDateString('es-MX', opciones);
        fechaBonita = fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

        let dateHtml = `
          <div style="background: #1e2530; color: #ff6b00; padding: 8px 15px; font-weight: bold; font-size: 0.95rem; margin: 20px 0 10px 0; border-radius: 4px; display: flex; align-items: center; border-left: 5px solid #ff6b00;">
            📅 ${fechaBonita}
          </div>`;

        const gamesOfDay = vMatches
          .filter(([_, m]) => m.date === dateString)
          .sort((a, b) => (a[1].startTime || '').localeCompare(b[1].startTime || ''));

        gamesOfDay.forEach(([mId, match]) => {
          const scoreText = (match.localScore !== undefined)
            ? `<strong style="color:#ff6b00; font-size: 1.1rem;">${match.localScore} - ${match.visitorScore}</strong>`
            : '<span style="color:#888; font-weight: bold;">vs</span>';

          let adminButtons = '';
if (isAdmin) {
  adminButtons = `
    <div style="display:flex; gap:5px; margin-left:10px;">
      <button onclick="setQuickScore('${mId}')" title="Cargar Marcador" style="background:#10b981; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">⏱️</button>
      <button onclick="printScoresheet('${mId}')" title="Imprimir Cédula" style="background:#334155; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">📄</button>
      <button onclick="deleteMatchEvent('${mId}')" title="Eliminar" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
    </div>`;
}

          dateHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); margin-bottom:6px; border-radius:8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div style="min-width:70px;">
                <span style="font-size:0.85rem; color:#ff6b00; display:block; font-weight:bold;">⏰ ${match.startTime}</span>
              </div>
              <div style="flex:1; text-align:center; padding: 0 10px;">
                <span style="font-size:1rem;"><strong>${match.localName}</strong> ${scoreText} <strong>${match.visitorName}</strong></span>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:0.65rem; background:#334155; padding:3px 8px; border-radius:4px; color:#aaa; text-transform: uppercase;">
                  ${categoriesConfig[match.category]?.label || match.category}
                </span>
                ${adminButtons}
              </div>
            </div>`;
        });

        block.innerHTML += dateHtml;
      });
    }
    container.appendChild(block);
  });

  if (typeof renderPlayoffs === 'function') renderPlayoffs(container);
}

// ============================================
// RENDER: CLASIFICACIÓN
// ============================================
function renderClassificationTables() {
  const container = document.getElementById('classificationTablesContainer');
  const filterEl  = document.getElementById('classCategoryFilter');
  if (!container || !filterEl) return;

  const selectedCat = filterEl.value;
  if (!selectedCat) return;
  container.innerHTML = '';

  const stats = {};

  // 1. Inicializar datos base
  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCat) {
      stats[id] = {
        id, name: t.name,
        group: (t.groupAssigned || 'sin grupo').toLowerCase().trim(),
        jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, pts: 0, dif: 0
      };
    }
  });

  // 2. Cargar resultados de Fase Regular
  Object.values(globalMatches).forEach(m => {
    if (m && m.category === selectedCat && m.stage === 'regular' && m.localScore !== undefined) {
      const locS = parseInt(m.localScore) || 0;
      const visS = parseInt(m.visitorScore) || 0;
      if (stats[m.localId] && stats[m.visitorId]) {
        stats[m.localId].jj++;   stats[m.visitorId].jj++;
        stats[m.localId].pf  += locS; stats[m.localId].pc  += visS;
        stats[m.visitorId].pf += visS; stats[m.visitorId].pc += locS;
        if (locS > visS) {
          stats[m.localId].jg++;   stats[m.localId].pts   += 2;
          stats[m.visitorId].jp++; stats[m.visitorId].pts += 1;
        } else {
          stats[m.visitorId].jg++; stats[m.visitorId].pts += 2;
          stats[m.localId].jp++;   stats[m.localId].pts   += 1;
        }
      }
    }
  });

  // --- FUNCIÓN DE MINI-LIGA H2H (REGLA FIBA TRIPLE EMPATE) ---
  const getH2HStats = (ids) => {
    const h2h = {};
    ids.forEach(id => h2h[id] = { pts: 0, pf: 0, pc: 0 });
    Object.values(globalMatches).forEach(m => {
      if (m.stage === 'regular' && ids.includes(m.localId) && ids.includes(m.visitorId) && m.localScore !== undefined) {
        const lS = parseInt(m.localScore); const vS = parseInt(m.visitorScore);
        h2h[m.localId].pts += (lS > vS ? 2 : 1);
        h2h[m.visitorId].pts += (vS > lS ? 2 : 1);
        h2h[m.localId].pf += lS; h2h[m.localId].pc += vS;
        h2h[m.visitorId].pf += vS; h2h[m.visitorId].pc += lS;
      }
    });
    return h2h;
  };

  // --- FUNCIÓN PARA ORDENAR UN GRUPO (FIBA STYLE) ---
  const sortFibaGroup = (teamList) => {
    // Primero ordenamos por Puntos de Clasificación
    teamList.sort((a, b) => b.pts - a.pts);

    // Buscamos empates de puntos para aplicar H2H
    for (let i = 0; i < teamList.length; i++) {
      let tieGroup = [teamList[i]];
      for (let j = i + 1; j < teamList.length; j++) {
        if (teamList[j].pts === teamList[i].pts) tieGroup.push(teamList[j]);
      }

      if (tieGroup.length > 1) {
        const h2h = getH2HStats(tieGroup.map(t => t.id));
        tieGroup.sort((a, b) => {
          const sA = h2h[a.id], sB = h2h[b.id];
          // 1° Puntos entre ellos
          if (sB.pts !== sA.pts) return sB.pts - sA.pts;
          // 2° Diferencia entre ellos
          if ((sB.pf - sB.pc) !== (sA.pf - sA.pc)) return (sB.pf - sB.pc) - (sA.pf - sA.pc);
          // 3° Puntos a favor entre ellos
          return sB.pf - sA.pf;
        });
        // Re-insertar en la lista principal
        teamList.splice(i, tieGroup.length, ...tieGroup);
        i += tieGroup.length - 1;
      }
    }
    return teamList;
  };

  // 3. Procesar Grupos
  const groupsMap = {};
  Object.values(stats).forEach(t => { if (!groupsMap[t.group]) groupsMap[t.group] = []; groupsMap[t.group].push(t); });
  
  const primerosLugares = [];
  const segundosLugares = [];

  Object.keys(groupsMap).sort().forEach(gName => {
    const sorted = sortFibaGroup(groupsMap[gName]);
    // Calculamos DIF general para la tabla visual
    sorted.forEach(t => t.dif = t.pf - t.pc);
    
    container.innerHTML += `<h3>GRUPO ${gName.toUpperCase()}</h3>` + generateTableHtml(sorted);
    
    if (sorted.length > 0) primerosLugares.push({ ...sorted[0], groupOrigin: gName });
    if (sorted.length > 1) segundosLugares.push({ ...sorted[1], groupOrigin: gName });
  });

  // 4. LÓGICA DE SEMIFINALES (REGLA DE ORO + JUSTICIA MATEMÁTICA)
  if (Object.keys(groupsMap).length === 3) {
    // Calculamos promedios para comparar equipos de diferentes grupos
    const calcAvg = (t) => ({
      ...t,
      avgPts: t.jj > 0 ? t.pts / t.jj : 0,
      avgDif: t.jj > 0 ? t.dif / t.jj : 0,
      avgPF:  t.jj > 0 ? t.pf / t.jj : 0
    }
  );
   container.innerHTML += `
      <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:20px;">
        <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
        ${ruleApplied ? '<p style="font-size:0.75rem; color:#ff6b00; text-align:center;">🛡️ <em>Regla de Oro aplicada: rivales ajustados para evitar mismo grupo en semis.</em></p>' : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
            <div style="text-align:center;"><strong>${s1?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s4?.name||'---'}</strong></div>
          </div>
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
            <div style="text-align:center;"><strong>${s2?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s3?.name||'---'}</strong></div>
          </div>
        </div>
      </div>`;

    const sortSeeds = (arr) => arr.map(calcAvg).sort((a,b) => b.avgPts - a.avgPts || b.avgDif - a.avgDif || b.avgPF - a.avgPF);

    const mejorSegundo = sortSeeds(segundosLugares)[0];
    const clasificados = sortSeeds([...primerosLugares, mejorSegundo]);

    // Asignación de llaves (1 vs 4, 2 vs 3)
    let [s1, s2, s3, s4] = clasificados;
    let ruleApplied = false;

    // ✅ REGLA DE ORO: Si el 1 y el 4 vienen del mismo grupo
    if (s1.groupOrigin === s4.groupOrigin) {
      [s3, s4] = [s4, s3]; // Cambiamos al rival
      ruleApplied = true;
    }

    
  }
}

function generateTableHtml(teamsArray) {
  if (teamsArray.length === 0)
    return '<p style="color:#aaa; font-style:italic; padding:10px;">No hay escuadras.</p>';

  let html = `
    <div style="overflow-x:auto; margin-bottom:25px;">
      <table class="classification-table" style="width:100%; border-collapse:collapse; background:var(--bg-card); border:1px solid var(--border-color); text-align:center;">
        <thead>
          <tr style="background:#1e2530; color:#fff; border-bottom:2px solid var(--accent-orange);">
            <th style="padding:10px; text-align:left;">Pos / Club</th>
            <th>JJ</th><th>JG</th><th>JP</th><th>PF</th><th>PC</th><th>DIF</th>
            <th style="color:var(--accent-orange)">PTS</th>
          </tr>
        </thead>
        <tbody>`;

  teamsArray.forEach((t, index) => {
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
  if (!currentTournamentId) return alert("Selecciona un torneo primero.");
  const name    = document.getElementById('venueName').value.trim();
  const address = document.getElementById('venueAddress').value.trim();
  const mapsUrl = document.getElementById('venueMapsUrl').value.trim();
  push(ref(db, `tournaments/${currentTournamentId}/venues`), { name, address, mapsUrl })
    .then(() => {
      alert("✅ Sede guardada correctamente.");
      document.getElementById('venueForm').reset();
    }).catch(error => {
      console.error("Error al guardar sede:", error);
      alert("Hubo un error al guardar la sede.");
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

// ============================================
// PATROCINADORES
// ============================================
let sponsorInterval      = null;
let currentSponsorIndex  = 0;
let activeSponsors       = [];

function handleSponsorSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("Selecciona un torneo.");
  const data = {
    name: document.getElementById('sponsorName').value.trim(),
    logo: document.getElementById('sponsorLogo').value.trim(),
    link: document.getElementById('sponsorLink').value.trim()
  };
  push(ref(db, `tournaments/${currentTournamentId}/sponsors`), data).then(() => {
    alert("✅ Patrocinador añadido.");
    e.target.reset();
  });
}

function startSponsorRotation(sponsorsData) {
  activeSponsors = Object.entries(sponsorsData || {}).map(([id, s]) => ({ ...s, id }));
  if (sponsorInterval) clearInterval(sponsorInterval);

  const display = document.getElementById('sponsor-display');
  if (!display) return;

  if (activeSponsors.length === 0) {
    display.innerHTML = "<p style='color:#555;'>Espacio disponible para publicidad</p>";
    return;
  }

  currentSponsorIndex = 0;

  const updateDisplay = () => {
    const s = activeSponsors[currentSponsorIndex];
    display.style.opacity = '0';
    setTimeout(() => {
      display.innerHTML = `
        <a href="${s.link || '#'}" target="_blank">
          <img src="${s.logo}" alt="${s.name}" title="${s.name}" style="max-height:80px; max-width:200px; object-fit:contain;">
        </a>`;
      display.style.opacity = '1';
    }, 500);
    currentSponsorIndex = (currentSponsorIndex + 1) % activeSponsors.length;
  };

  updateDisplay();
  sponsorInterval = setInterval(updateDisplay, 5000);
}

// ============================================
// ELIMINAR PARTIDO / EQUIPO
// ============================================
function deleteMatchEvent(matchId) {
  if (confirm("¿Borrar este partido?"))
    remove(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`));
}
window.deleteMatchEvent = deleteMatchEvent;

function deleteTeamFromApp(teamId, teamName) {
  const hasMatches = Object.values(globalMatches).some(
    m => m && (m.localId === teamId || m.visitorId === teamId)
  );
  if (hasMatches) return alert("El equipo ya tiene juegos. Elimina los juegos primero.");
  if (confirm(`¿Eliminar ${teamName}?`))
    remove(ref(db, `tournaments/${currentTournamentId}/teams/${teamId}`));
}
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
  document.getElementById('editTeamName').value     = team.name               || '';
  document.getElementById('editTeamLogo').value     = team.logoUrl            || '';
  document.getElementById('editTeamCategory').value = team.categoryRegistered || '';
  document.getElementById('editTeamGroup').value    = team.groupAssigned      || '';
}

function handleEditTeamSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('selectEditTeam').value;
  if (!id) return alert("Selecciona un equipo.");
  const groupInput = document.getElementById('editTeamGroup').value.trim().toLowerCase();
  update(ref(db, `tournaments/${currentTournamentId}/teams/${id}`), {
    name:               document.getElementById('editTeamName').value.trim(),
    categoryRegistered: document.getElementById('editTeamCategory').value,
    groupAssigned:      groupInput
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
  update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), {
    category:    cat,
    stage:       stage,
    localId:     lId,
    localName:   globalTeams[lId].name,
    visitorId:   vId,
    visitorName: globalTeams[vId].name,
    date:        document.getElementById('editMatchDate').value,
    startTime:   document.getElementById('editMatchStartTime').value,
    venueId:     document.getElementById('editMatchVenue').value
  }).then(() => {
    alert("✅ Partido actualizado correctamente.");
    document.getElementById('editMatchForm').reset();
  }).catch(err => {
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
      })
      .catch(err => {
        console.error("Error al eliminar partido:", err);
        alert("No se pudo eliminar el partido.");
      });
  }
}

// ============================================
// 📄 GENERADOR DE CÉDULA PROFESIONAL
// ============================================
function printScoresheet(matchId) {
  const m = globalMatches[matchId];
  if (!m) return;
  const printWindow = window.open('', '_blank');
  let runningScoreHTML = '';
  for (let i = 1; i <= 80; i++) {
    runningScoreHTML += `<tr><td>${i}</td><td></td><td></td><td>${i + 80}</td><td></td><td></td></tr>`;
  }
  printWindow.document.write(`
    <html><head>
      <title>Hoja Oficial - ${m.localName} vs ${m.visitorName}</title>
      <style>
        @page { size: letter; margin: 10mm; }
        body { font-family: 'Arial Narrow', sans-serif; font-size: 11px; color: #000; line-height: 1.2; }
        .no-print { background: #eee; padding: 10px; text-align: center; border-bottom: 1px solid #ccc; }
        .header-table { width: 100%; border-bottom: 2px solid #000; margin-bottom: 10px; }
        .logo { height: 75px; }
        .title-box { text-align: center; }
        .title-box h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 10px; border: 1px solid #000; padding: 5px; }
        .main-layout { display: flex; gap: 10px; }
        .team-column { flex: 1.2; }
        .score-column { flex: 0.8; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 3px; text-align: center; }
        .team-header { background: #000; color: #fff; font-weight: bold; padding: 4px; }
        .running-score th { font-size: 9px; background: #eee; }
        .running-score td { height: 14px; font-size: 10px; font-weight: bold; }
        .running-score td:nth-child(1), .running-score td:nth-child(4) { background: #f0f0f0; width: 25px; }
        .footer-table { width: 100%; margin-top: 15px; }
        .sign-box { height: 40px; border-bottom: 1px solid #000; vertical-align: bottom; font-size: 9px; }
        @media print { .no-print { display: none; } }
      </style>
    </head><body>
      <div class="no-print">
        <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR HOJA DE ANOTACIÓN</button>
      </div>
      <table class="header-table"><tr>
        <td style="border:none; text-align:left;"><img src="${APP_LOGO_URL}" class="logo"></td>
        <td style="border:none;" class="title-box">
          <h1>Hoja de Anotación de Baloncesto</h1>
          <p style="margin:2px 0; font-weight:bold;">DRIBLA, PASA Y ENCESTA</p>
        </td>
        <td style="border:none; text-align:right; font-weight:bold;">PARTIDO No. ____</td>
      </tr></table>
      <div class="info-grid">
        <div><strong>EQUIPO A:</strong> ${m.localName}</div>
        <div><strong>FECHA:</strong> ${m.date}</div>
        <div><strong>LUGAR:</strong> ${globalVenues[m.venueId]?.name || '---'}</div>
        <div><strong>ETAPA:</strong> ${m.stage ? m.stage.toUpperCase() : 'LIGA'}</div>
        <div><strong>EQUIPO B:</strong> ${m.visitorName}</div>
        <div><strong>HORA:</strong> ${m.startTime}</div>
        <div><strong>RAMA/CAT:</strong> ${categoriesConfig[m.category]?.label || m.category}</div>
        <div><strong>ÁRBITRO:</strong> ________________</div>
      </div>
      <div class="main-layout">
        <div class="team-column">
          <div class="team-header">EQUIPO A: ${m.localName}</div>
          <table>
            <thead><tr><th width="10%">#</th><th>NOMBRE DEL JUGADOR</th><th width="30%" colspan="5">FALTAS</th></tr></thead>
            <tbody>${Array(12).fill('<tr><td style="height:18px;"></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody>
            <tr><td colspan="2">FALTAS DE EQUIPO</td><td colspan="5">1P [ ] 2P [ ] 3P [ ] 4P [ ]</td></tr>
          </table>
          <div class="team-header" style="margin-top:10px;">EQUIPO B: ${m.visitorName}</div>
          <table>
            <thead><tr><th width="10%">#</th><th>NOMBRE DEL JUGADOR</th><th width="30%" colspan="5">FALTAS</th></tr></thead>
            <tbody>${Array(12).fill('<tr><td style="height:18px;"></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody>
            <tr><td colspan="2">FALTAS DE EQUIPO</td><td colspan="5">1P [ ] 2P [ ] 3P [ ] 4P [ ]</td></tr>
          </table>
        </div>
        <div class="score-column">
          <div style="text-align:center; font-weight:bold; border:1px solid #000; border-bottom:none; background:#eee;">PUNTUACIÓN CORRIDA</div>
          <table class="running-score">
            <thead><tr><th>Pts</th><th>A</th><th>B</th><th>Pts</th><th>A</th><th>B</th></tr></thead>
            <tbody>${runningScoreHTML}</tbody>
          </table>
        </div>
      </div>
      <table style="width:400px; margin-top:15px; float:left;">
        <tr style="background:#eee;"><td>PERIODOS</td><td>1°</td><td>2°</td><td>3°</td><td>4°</td><td>EX</td><td>TOTAL</td></tr>
        <tr><td>EQUIPO A</td><td style="height:20px;"></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td>EQUIPO B</td><td style="height:20px;"></td><td></td><td></td><td></td><td></td><td></td></tr>
      </table>
      <table class="footer-table"><tr>
        <td class="sign-box" width="25%">Capitán Equipo A</td>
        <td class="sign-box" width="25%">Capitán Equipo B</td>
        <td class="sign-box" width="25%">Anotador / Mesa</td>
        <td class="sign-box" width="25%">Árbitro Principal</td>
      </tr></table>
    </body></html>`);
  printWindow.document.close();
}
window.printScoresheet = printScoresheet;

// ============================================
// LÓGICA DE SEDES (EDITAR / ELIMINAR)
// ============================================
function populateEditVenueDropdown() {
  const select = document.getElementById('selectEditVenue');
  if (!select) return;
  select.innerHTML = '<option value="">-- Selecciona una cancha --</option>';
  Object.entries(globalVenues).forEach(([id, v]) => {
    if (v && v.name) {
      select.innerHTML += `<option value="${id}">${v.name}</option>`;
    }
  });
}

function handleSelectEditVenueChange(e) {
  const venueId = e.target.value;
  if (!venueId || !globalVenues[venueId]) return;
  const v = globalVenues[venueId];
  document.getElementById('editVenueName').value    = v.name    || '';
  document.getElementById('editVenueAddress').value = v.address || '';
  document.getElementById('editVenueMapsUrl').value = v.mapsUrl || '';
}

function handleEditVenueSubmit(e) {
  e.preventDefault();
  const venueId = document.getElementById('selectEditVenue').value;
  if (!venueId) return alert("Selecciona una sede.");
  update(ref(db, `tournaments/${currentTournamentId}/venues/${venueId}`), {
    name:    document.getElementById('editVenueName').value.trim(),
    address: document.getElementById('editVenueAddress').value.trim(),
    mapsUrl: document.getElementById('editVenueMapsUrl').value.trim()
  }).then(() => {
    alert("✅ Sede actualizada correctamente.");
    document.getElementById('editVenueForm').reset();
  });
}

function handleDeleteVenueButton() {
  const venueId = document.getElementById('selectEditVenue').value;
  if (!venueId) return alert("Selecciona una sede para eliminar.");
  const hasMatches = Object.values(globalMatches).some(m => m && m.venueId === venueId);
  if (hasMatches) {
    return alert("❌ No puedes eliminar esta sede porque tiene partidos programados. Mueve o borra los partidos primero.");
  }
  if (confirm("⚠️ ¿Estás seguro de eliminar esta cancha? Esta acción no se puede deshacer.")) {
    remove(ref(db, `tournaments/${currentTournamentId}/venues/${venueId}`))
      .then(() => {
        alert("Sede eliminada.");
        document.getElementById('editVenueForm').reset();
      });
  }
}

// ============================================
// PATROCINADORES: LISTA ADMIN + ELIMINAR
// ============================================
function renderAdminSponsorList(sponsorsData) {
  const container = document.getElementById('admin-sponsor-list');
  if (!container) return;

  if (!sponsorsData || Object.keys(sponsorsData).length === 0) {
    container.innerHTML = "<p style='color:gray; padding:10px;'>No hay patrocinadores registrados.</p>";
    return;
  }

  let html = '<ul style="list-style:none; padding:0; margin-top:15px; border-top:1px solid #444;">';
  Object.entries(sponsorsData).forEach(([id, s]) => {
    html += `
      <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #333;">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${s.logo}" alt="${s.name}" style="height:30px; width:auto; border-radius:3px; background:#fff; object-fit:contain;">
          <span>${s.name}</span>
        </div>
        <button onclick="deleteSponsor('${id}')" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.7rem;">🗑️ Quitar</button>
      </li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
}

function deleteSponsor(sponsorId) {
  if (!currentTournamentId) return;
  if (confirm("¿Estás seguro de quitar a este patrocinador del banner?")) {
    remove(ref(db, `tournaments/${currentTournamentId}/sponsors/${sponsorId}`))
      .then(() => alert("✅ Patrocinador eliminado."))
      .catch(err => {
        console.error("Error al borrar:", err);
        alert("No se pudo eliminar el patrocinador.");
      });
  }
}
window.deleteSponsor = deleteSponsor;
function setQuickScore(matchId) {
    const m = globalMatches[matchId];
    if (!m) return;

    // Pedimos el score del local
    const scoreL = prompt(`Puntos para LOCAL: ${m.localName}`, m.localScore !== undefined ? m.localScore : "");
    if (scoreL === null) return; // Si cancela, no hace nada

    // Pedimos el score del visitante
    const scoreV = prompt(`Puntos para VISITA: ${m.visitorName}`, m.visitorScore !== undefined ? m.visitorScore : "");
    if (scoreV === null) return; // Si cancela, no hace nada

    // Actualizamos en Firebase
    const updates = {
        localScore: parseInt(scoreL),
        visitorScore: parseInt(scoreV)
    };

    update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), updates)
        .then(() => {
            // No hace falta alert, se actualizará solo en tiempo real
            console.log("Score actualizado");
        })
        .catch(err => alert("Error al guardar: " + err));
}

// Hacerla global para que el botón del HTML la encuentre
window.setQuickScore = setQuickScore;
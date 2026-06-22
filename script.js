import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const APP_LOGO_URL = "https://i.ibb.co/fzzhsgsG/Whats-App-Image-2026-06-17-at-3-25-11-PM-removebg-preview.png";

const firebaseConfig = {
  apiKey: "AIzaSyCxBA6w3Ia4OwYrJidhpXVtR7-2SKnMWXw", // ⚠️ Coloca tu API Key real aquí
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

  // FIX #1 y #2: btnBackToSelector sin el listener duplicado de venueForm
  document.getElementById('btnBackToSelector')?.addEventListener('click', () => {
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
  });

  document.getElementById('editVenueForm')?.addEventListener('submit', handleEditVenueSubmit);
  document.getElementById('selectEditVenue')?.addEventListener('change', handleSelectEditVenueChange);
  document.getElementById('btnDeleteVenue')?.addEventListener('click', handleDeleteVenueButton);
  document.getElementById('teamForm')?.addEventListener('submit', handleTeamSubmit);

  // FIX #2: venueForm registrado una sola vez aquí
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
  // FIX: siempre actualizar el filtro de categoría (no solo la primera vez)
  if (filterCatSel) {
    const prevVal = filterCatSel.value; // guardar selección actual
    filterCatSel.innerHTML = catOptions;
    // restaurar la selección si sigue siendo válida
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
  const playoffs = Object.values(globalMatches).filter(
    m => m && (m.stage === 'semifinal' || m.stage === 'final')
  );
  if (playoffs.length === 0) return;

  const playoffBlock = document.createElement('div');
  playoffBlock.style.cssText = 'border:2px solid #ff6b00; padding:15px; border-radius:10px; margin-bottom:30px; background:rgba(255,107,0,0.05);';
  playoffBlock.innerHTML = `<h2 style="color:#ff6b00; text-align:center; margin:0 0 15px 0;">🔥 FASE FINAL</h2>`;

  playoffs.forEach(m => {
    const score = m.localScore !== undefined ? `${m.localScore} - ${m.visitorScore}` : 'VS';
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
      // 1. Obtener fechas únicas
      const uniqueDates = [...new Set(vMatches.map(([_, m]) => m.date))].sort();

      uniqueDates.forEach(dateString => {
        // ✅ LÓGICA PARA EL FORMATO DE FECHA (Lunes, 22 de Junio de 2026)
        const [year, month, day] = dateString.split('-').map(Number);
        const fechaObj = new Date(year, month - 1, day);
        
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        let fechaBonita = fechaObj.toLocaleDateString('es-MX', opciones);
        
        // Ponemos la primera letra en mayúscula (ej: lunes -> Lunes)
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
  const container      = document.getElementById('classificationTablesContainer');
  const filterEl       = document.getElementById('classCategoryFilter');
  if (!container || !filterEl) return;

  // FIX: si no hay categoría seleccionada, seleccionar la primera disponible automáticamente
  if (!filterEl.value && filterEl.options.length > 0) {
    filterEl.value = filterEl.options[0].value;
  }

  const selectedCat = filterEl.value;
  if (!selectedCat) return;
  container.innerHTML = '';

  // FIX: auto-detectar formato por grupos si algún equipo tiene groupAssigned
  //      en lugar de depender solo de globalFormats (que puede no estar configurado)
  const teamsInCat = Object.values(globalTeams).filter(t => t && t.categoryRegistered === selectedCat);
  const hasGroups  = teamsInCat.some(t => t.groupAssigned && t.groupAssigned.trim() !== '');
  const savedFormat = globalFormats[selectedCat]?.type;
  // Prioridad: 1) formato guardado en admin, 2) auto-detectar por grupos asignados
  const formatType = savedFormat || (hasGroups ? 'grupos' : 'todos-contra-todos');
  const formatConfig = { type: formatType };
  const stats = {};

  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCat) {
      stats[id] = {
        id, name: t.name,
        group: (t.groupAssigned || 'sin grupo').toLowerCase(),
        jj: 0, jg: 0, jp: 0, pf: 0, pc: 0, pts: 0, dif: 0
      };
    }
  });

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

  Object.keys(stats).forEach(id => {
    const t = stats[id];
    t.dif    = t.pf - t.pc;
    t.avgPts = t.jj > 0 ? (t.pts / t.jj) : 0;
    t.avgDif = t.jj > 0 ? (t.dif / t.jj) : 0;
    t.avgPF  = t.jj > 0 ? (t.pf  / t.jj) : 0;
  });

  const sortTeams = (arr) => arr.sort((a, b) =>
    b.avgPts - a.avgPts || b.avgDif - a.avgDif || b.avgPF - a.avgPF
  );

  if (formatConfig.type === 'grupos') {
    // ── Construir mapa de grupos ──────────────────────────────────────────────
    const groupsMap = {};
    Object.values(stats).forEach(t => {
      if (!groupsMap[t.group]) groupsMap[t.group] = [];
      groupsMap[t.group].push(t);
    });

    const groupNames      = Object.keys(groupsMap).sort();
    const numGroups       = groupNames.length;
    const primerosLugares = [];
    const segundosLugares = [];

    // Criterios de desempate (usados en toda la lógica de cruces):
    // 1° Promedio de puntos (pts / JJ)
    // 2° Diferencia de puntos (pf - pc) / JJ
    // 3° Promedio de puntos anotados (pf / JJ)
    // 4° Resultado del enfrentamiento directo (se aplica en tabla si aplica)

    // Renderizar tabla de cada grupo con leyenda de criterios
    groupNames.forEach(groupName => {
      const sorted = sortTeams(groupsMap[groupName]);
      container.innerHTML +=
        `<h3 style="color:var(--accent-orange); margin-top:20px;">
           Grupo: ${groupName.toUpperCase()}
           <span style="font-size:0.7rem; color:#aaa; font-weight:normal; margin-left:10px;">
             Desempate: 1°Prom.Pts · 2°Dif.Puntos · 3°Prom.Anotados
           </span>
         </h3>` + generateTableHtml(sorted);
      if (sorted.length > 0) primerosLugares.push({ ...sorted[0], groupOrigin: groupName });
      if (sorted.length > 1) segundosLugares.push({ ...sorted[1], groupOrigin: groupName });
    });

    // ── 2 GRUPOS → Semis: 1°A vs 2°B  y  1°B vs 2°A ──────────────────────────
    if (numGroups === 2) {
      const [p1, p2] = primerosLugares;  // 1° de cada grupo
      const [seg1, seg2] = segundosLugares;  // 2° de cada grupo

      // Cruce clásico: 1° de un grupo vs 2° del otro
      const semi1Local   = p1;   // 1° Grupo A
      const semi1Visitor = seg2; // 2° Grupo B
      const semi2Local   = p2;   // 1° Grupo B
      const semi2Visitor = seg1; // 2° Grupo A

      const crit2dos = segundosLugares.map(t => `
        <tr>
          <td style="padding:4px 8px; text-align:left;"><strong>${t.name}</strong> <span style="color:#aaa; font-size:0.75rem;">(${t.groupOrigin?.toUpperCase()})</span></td>
          <td style="padding:4px 8px;">${t.jj}</td>
          <td style="padding:4px 8px;">${t.pts}</td>
          <td style="padding:4px 8px; color:${(t.pf-t.pc)>=0?'#10b981':'#ef4444'}; font-weight:bold;">
            ${(t.pf-t.pc)>0?'+':''}${t.pf-t.pc}
          </td>
          <td style="padding:4px 8px;">${t.pf}</td>
        </tr>`).join('');

      container.innerHTML += `
        <!-- Comparativa 2° lugares -->
        <div style="background:rgba(30,37,48,0.9); padding:15px; border:1px solid #334155; border-radius:10px; margin-top:20px;">
          <h4 style="color:#aaa; margin:0 0 10px 0; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">
            🥈 Segundos Lugares
          </h4>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:center;">
              <thead>
                <tr style="background:#0f172a; color:#aaa; border-bottom:1px solid #334155;">
                  <th style="padding:6px 8px; text-align:left;">Equipo</th>
                  <th>JJ</th><th>PTS</th><th>DIF</th><th>PF</th>
                </tr>
              </thead>
              <tbody>${crit2dos}</tbody>
            </table>
          </div>
          <p style="color:#888; font-size:0.72rem; margin:8px 0 0 0;">
            Cruce: 1° de cada grupo enfrenta al 2° del grupo contrario
          </p>
        </div>

        <!-- Cruces de semifinales -->
        <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:20px;">
          <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
          <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">
            Criterio: 1° de cada grupo vs 2° del grupo contrario
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
              <div style="text-align:center;">
                <strong>${semi1Local?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${semi1Visitor?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>1° Gpo ${semi1Local?.groupOrigin?.toUpperCase() || ''} · ${semi1Local?.pts || 0} pts</span>
                <span>2° Gpo ${semi1Visitor?.groupOrigin?.toUpperCase() || ''} · ${semi1Visitor?.pts || 0} pts</span>
              </div>
            </div>
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
              <div style="text-align:center;">
                <strong>${semi2Local?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${semi2Visitor?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>1° Gpo ${semi2Local?.groupOrigin?.toUpperCase() || ''} · ${semi2Local?.pts || 0} pts</span>
                <span>2° Gpo ${semi2Visitor?.groupOrigin?.toUpperCase() || ''} · ${semi2Visitor?.pts || 0} pts</span>
              </div>
            </div>
          </div>
          <p style="text-align:center; color:#888; font-size:0.72rem; margin-top:12px;">
            🏅 Los ganadores de cada semifinal se enfrentan en la <strong>Gran Final</strong>
          </p>
        </div>`;

    // ── 3 GRUPOS → El mejor 2° pasa a semis (4 equipos) ──────────────────────
    } else if (numGroups === 3) {
      const mejorSegundo      = sortTeams([...segundosLugares])[0];
      const clasificados      = sortTeams([...primerosLugares, mejorSegundo]);
      let [s1, s2, s3, s4]   = clasificados;

      // Regla de Oro: el 1° no puede enfrentar al equipo de su mismo grupo en semis
      let avisoReglaOro = "";
      if (s1 && s4 && s1.groupOrigin === s4.groupOrigin) {
        [s3, s4] = [s4, s3];
        avisoReglaOro = `<div style="font-size:0.75rem; color:#ff6b00; margin-top:8px; text-align:center;">
          🛡️ <em>Regla de Oro aplicada: rivales ajustados para evitar enfrentar al mismo grupo en semis.</em>
        </div>`;
      }

      // Criterios de clasificación del mejor 2°
      const criteriosMejorSegundo = segundosLugares.map(t =>
        `<tr>
          <td style="padding:4px 8px; text-align:left;"><strong>${t.name}</strong> <span style="color:#aaa; font-size:0.75rem;">(${t.groupOrigin?.toUpperCase()})</span></td>
          <td style="padding:4px 8px;">${t.jj}</td>
          <td style="padding:4px 8px;">${t.pts}</td>
          <td style="padding:4px 8px; color:${(t.pf-t.pc)>=0?'#10b981':'#ef4444'}; font-weight:bold;">
            ${(t.pf-t.pc)>0?'+':''}${t.pf-t.pc}
          </td>
          <td style="padding:4px 8px;">${t.pf}</td>
          <td style="padding:4px 8px; ${t.name === mejorSegundo.name ? 'color:#ff6b00; font-weight:bold;' : ''}">
            ${t.name === mejorSegundo.name ? '✅ CLASIFICA' : '❌'}
          </td>
        </tr>`
      ).join('');

      container.innerHTML += `
        <!-- Comparativa mejor 2° -->
        <div style="background:rgba(30,37,48,0.9); padding:15px; border:1px solid #334155; border-radius:10px; margin-top:20px;">
          <h4 style="color:#aaa; margin:0 0 10px 0; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">
            🥈 Comparativa de 2° lugares — El mejor avanza
          </h4>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:center;">
              <thead>
                <tr style="background:#0f172a; color:#aaa; border-bottom:1px solid #334155;">
                  <th style="padding:6px 8px; text-align:left;">Equipo</th>
                  <th>JJ</th><th>PTS</th><th>DIF</th><th>PF</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>${criteriosMejorSegundo}</tbody>
            </table>
          </div>
          <p style="color:#888; font-size:0.72rem; margin:8px 0 0 0;">
            Criterios de desempate entre 2° lugares: 1°Puntos acumulados · 2°Diferencia de puntos · 3°Puntos anotados
          </p>
        </div>

        <!-- Cruces de semifinales -->
        <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:20px;">
          <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
          <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">
            Criterio de cruce: 1° vs 4° · 2° vs 3° (por rendimiento general)
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
              <div style="text-align:center;">
                <strong>${s1?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${s4?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>1° general · ${s1?.pts || 0} pts</span>
                <span>4° general · ${s4?.pts || 0} pts</span>
              </div>
            </div>
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
              <div style="text-align:center;">
                <strong>${s2?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${s3?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>2° general · ${s2?.pts || 0} pts</span>
                <span>3° general · ${s3?.pts || 0} pts</span>
              </div>
            </div>
          </div>
          ${avisoReglaOro}
        </div>`;

    // ── 4+ GRUPOS → Semis con los 4 primeros lugares ──────────────────────────
    } else if (numGroups >= 4) {
      const clasificados    = sortTeams([...primerosLugares]);
      let [s1, s2, s3, s4]  = clasificados;

      // Regla de Oro: s1 no puede ir con s4 si son del mismo grupo
      let avisoReglaOro = "";
      if (s1 && s4 && s1.groupOrigin === s4.groupOrigin) {
        [s3, s4] = [s4, s3];
        avisoReglaOro = `<div style="font-size:0.75rem; color:#ff6b00; margin-top:8px; text-align:center;">
          🛡️ <em>Regla de Oro aplicada: rivales ajustados para evitar mismo grupo en semis.</em>
        </div>`;
      }

      container.innerHTML += `
        <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:30px;">
          <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
          <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">
            Clasifican los 4 primeros lugares (uno por grupo). Cruce: 1° vs 4° · 2° vs 3°
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
              <div style="text-align:center;">
                <strong>${s1?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${s4?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>1° Gpo ${s1?.groupOrigin?.toUpperCase() || ''} · ${s1?.pts || 0} pts</span>
                <span>1° Gpo ${s4?.groupOrigin?.toUpperCase() || ''} · ${s4?.pts || 0} pts</span>
              </div>
            </div>
            <div style="background:#1e2530; padding:12px; border-radius:8px;">
              <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
              <div style="text-align:center;">
                <strong>${s2?.name || '---'}</strong>
                <span style="color:#aaa; margin:0 8px;">vs</span>
                <strong>${s3?.name || '---'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
                <span>1° Gpo ${s2?.groupOrigin?.toUpperCase() || ''} · ${s2?.pts || 0} pts</span>
                <span>1° Gpo ${s3?.groupOrigin?.toUpperCase() || ''} · ${s3?.pts || 0} pts</span>
              </div>
            </div>
          </div>
          ${avisoReglaOro}
        </div>`;
    }

  } else {
    container.innerHTML += `<h3>Liga General: ${categoriesConfig[selectedCat].label}</h3>` +
      generateTableHtml(sortTeams(Object.values(stats)));
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

// FIX #1: handleVenueSubmit definida UNA SOLA VEZ (versión completa con .catch)
function handleVenueSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("Selecciona un torneo primero.");

  const name    = document.getElementById('venueName').value.trim();
  const address = document.getElementById('venueAddress').value.trim();
  const mapsUrl = document.getElementById('venueMapsUrl').value.trim();

  push(ref(db, `tournaments/${currentTournamentId}/venues`), {
    name,
    address,
    mapsUrl
  }).then(() => {
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

  const updatedData = {
    category:    cat,
    stage:       stage,
    localId:     lId,
    localName:   globalTeams[lId].name,
    visitorId:   vId,
    visitorName: globalTeams[vId].name,
    date:        document.getElementById('editMatchDate').value,
    startTime:   document.getElementById('editMatchStartTime').value,
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

    // Generar Conteo Corrido exacto de la imagen (4 columnas de 40 = 160 puntos)
    let runningScoreHTML = '';
    for (let i = 1; i <= 40; i++) {
        runningScoreHTML += `
            <tr>
                <td class="num">${i}</td><td></td><td></td>
                <td class="num">${i + 40}</td><td></td><td></td>
                <td class="num">${i + 80}</td><td></td><td></td>
                <td class="num">${i + 120}</td><td></td><td></td>
            </tr>`;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Planilla Oficial - ${m.localName} vs ${m.visitorName}</title>
            <style>
                @page { size: letter; margin: 8mm; }
                body { font-family: 'Arial Narrow', sans-serif; font-size: 10px; color: #000; margin: 0; }
                
                /* Encabezado */
                .header-table { width: 100%; border: none; margin-bottom: 10px; }
                .logo { height: 70px; width: auto; }
                .title { font-size: 22px; font-weight: bold; text-align: center; text-transform: uppercase; }
                
                .info-bar { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 10px; border: 1.5px solid #000; padding: 5px; margin-bottom: 10px; }
                
                /* Layout Principal */
                .main-layout { display: flex; gap: 10px; }
                .teams-side { flex: 1.3; }
                .score-side { flex: 0.7; }

                /* Tablas */
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 2px; text-align: center; }
                .team-box-header { background: #000; color: #fff; font-weight: bold; padding: 5px; text-align: left; font-size: 11px; }
                
                /* UI de Tiempos y Faltas */
                .sub-header-row { display: flex; justify-content: space-between; align-items: center; padding: 4px; border: 1px solid #000; border-top: none; }
                .timeout-container { display: flex; align-items: center; gap: 3px; }
                .to-box { width: 14px; height: 14px; border: 1px solid #000; }
                .team-fouls { font-weight: bold; display: flex; align-items: center; gap: 5px; }
                .f-num { border: 1px solid #000; padding: 0 4px; font-size: 9px; }

                /* Tabla de Jugadores */
                .player-table th { font-size: 8px; background: #eee; }
                .player-table td { height: 18px; }

                /* Conteo Corrido */
                .running-score th { background: #eee; font-size: 9px; }
                .running-score td { height: 15px; font-size: 10px; }
                .running-score .num { background: #f0f0f0; font-weight: bold; width: 22px; }

                /* Totales y Firmas */
                .bottom-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 10px; margin-top: 10px; }
                .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .sign-line { border-bottom: 1px solid #000; height: 25px; margin-top: 10px; font-size: 9px; text-align: center; }
                
                .period-table td { height: 20px; font-weight: bold; }

                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="background:#000; color:#fff; padding:10px; text-align:center;">
                <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer; background:#ff6b00; color:#fff; border:none; border-radius:5px;">🖨️ IMPRIMIR PLANILLA</button>
            </div>

            <!-- ENCABEZADO CON TU LOGO -->
            <table class="header-table">
                <tr>
                    <td style="border:none; text-align:left; width:15%;"><img src="${APP_LOGO_URL}" class="logo"></td>
                    <td style="border:none;" class="title">Planilla de Anotación de Baloncesto</td>
                    <td style="border:none; text-align:right; width:15%; font-weight:bold;">Juego N°: ____</td>
                </tr>
            </table>

            <div class="info-bar">
                <div><strong>Competencia:</strong> ${categoriesConfig[m.category]?.label || m.category}</div>
                <div><strong>Fecha:</strong> ${m.date}</div>
                <div><strong>Hora:</strong> ${m.startTime}</div>
                <div><strong>Lugar:</strong> ${globalVenues[m.venueId]?.name || '---'}</div>
            </div>

            <div class="main-layout">
                <div class="teams-side">
                    <!-- EQUIPO A -->
                    <div class="team-box-header">EQUIPO A: ${m.localName}</div>
                    <div class="sub-header-row">
                        <div class="timeout-container">
                            Desc. Tiempo: <div class="to-box"></div><div class="to-box"></div> | <div class="to-box"></div><div class="to-box"></div><div class="to-box"></div>
                        </div>
                        <div class="team-fouls">
                            Faltas Colectivas: 
                            1P <span class="f-num">1</span><span class="f-num">2</span><span class="f-num">3</span><span class="f-num">4</span>
                            2P <span class="f-num">1</span><span class="f-num">2</span><span class="f-num">3</span><span class="f-num">4</span>
                        </div>
                    </div>
                    <table class="player-table">
                        <thead>
                            <tr><th width="40">Ficha</th><th>Atletas</th><th width="25">N°</th><th width="25">Ent</th><th colspan="5">Faltas</th></tr>
                        </thead>
                        <tbody>
                            ${Array(12).fill('<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}
                        </tbody>
                        <tr style="background:#eee; font-weight:bold;">
                            <td colspan="2" style="text-align:left;">Coach:</td><td colspan="7"></td>
                        </tr>
                    </table>

                    <!-- EQUIPO B -->
                    <div class="team-box-header" style="margin-top:10px;">EQUIPO B: ${m.visitorName}</div>
                    <div class="sub-header-row">
                        <div class="timeout-container">
                            Desc. Tiempo: <div class="to-box"></div><div class="to-box"></div> | <div class="to-box"></div><div class="to-box"></div><div class="to-box"></div>
                        </div>
                        <div class="team-fouls">
                            Faltas Colectivas: 
                            1P <span class="f-num">1</span><span class="f-num">2</span><span class="f-num">3</span><span class="f-num">4</span>
                            2P <span class="f-num">1</span><span class="f-num">2</span><span class="f-num">3</span><span class="f-num">4</span>
                        </div>
                    </div>
                    <table class="player-table">
                        <thead>
                            <tr><th width="40">Ficha</th><th>Atletas</th><th width="25">N°</th><th width="25">Ent</th><th colspan="5">Faltas</th></tr>
                        </thead>
                        <tbody>
                            ${Array(12).fill('<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}
                        </tbody>
                        <tr style="background:#eee; font-weight:bold;">
                            <td colspan="2" style="text-align:left;">Coach:</td><td colspan="7"></td>
                        </tr>
                    </table>
                </div>

                <!-- CONTEO CORRIDO -->
                <div class="score-side">
                    <div style="text-align:center; font-weight:bold; background:#000; color:#fff; border:1px solid #000;">CONTEO CORRIDO</div>
                    <table class="running-score">
                        <thead>
                            <tr><th>A</th><th>B</th><th>A</th><th>B</th><th>A</th><th>B</th><th>A</th><th>B</th></tr>
                        </thead>
                        <tbody>
                            ${runningScoreHTML}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- PIE DE PAGINA: PARCIALES Y FIRMAS -->
            <div class="bottom-grid">
                <div class="signatures">
                    <div>
                        <div class="sign-line"></div>Anotador
                        <div class="sign-line"></div>Cronometrista
                    </div>
                    <div>
                        <div class="sign-line"></div>Árbitro 1
                        <div class="sign-line"></div>Árbitro 2
                    </div>
                    <div style="grid-column: span 2;">
                        <div class="sign-line" style="width:100%"></div>
                        Firma Capitán en caso de protesta
                    </div>
                </div>

                <div>
                    <table class="period-table">
                        <tr style="background:#eee;"><td>Parciales</td><td>A</td><td>B</td></tr>
                        <tr><td>Periodo 1</td><td></td><td></td></tr>
                        <tr><td>Periodo 2</td><td></td><td></td></tr>
                        <tr><td>Periodo 3</td><td></td><td></td></tr>
                        <tr><td>Periodo 4</td><td></td><td></td></tr>
                        <tr style="background:#f0f0f0;"><td>FINAL</td><td>${m.localScore || ''}</td><td>${m.visitorScore || ''}</td></tr>
                    </table>
                    <div style="margin-top:5px; border:2px solid #000; padding:5px; text-align:center; font-weight:bold;">
                        GANADOR: ____________________
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

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

// FIX #4: null check en hasMatches
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

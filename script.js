import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
// ✅ NUEVO: sistema de roles — 'admin' (acceso total) vs 'coach' (solo su propio registro de atletas)
let currentUserRole = 'public'; // arranca sin rol hasta que Firebase confirme
let currentUserUid   = null;
let currentUserName  = '';
let globalRoles      = {};
let globalTournaments = {};
let globalTeams = {};
let globalVenues = {};
let globalMatches = {};
let globalFormats = {};
let globalAllTeams = {}; // Todos los equipos de todos los torneos (para Padrón Global)

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
  document.getElementById('btnGoToAdminPrep')?.addEventListener('click', openMasterPanel);
  document.getElementById('playerForm')?.addEventListener('submit', handlePlayerSubmit);
  document.getElementById('selectTeamForPlayer')?.addEventListener('change', (e) => renderAdminPlayerList(e.target.value));
  document.getElementById('btnBackToSelector')?.addEventListener('click', () => {
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
  });

  // ✅ NUEVO: registro independiente de atletas (sin necesidad de competencia activa)
  document.getElementById('btnGoToStandaloneAthletes')?.addEventListener('click', goToStandaloneAthletes);
  document.getElementById('btnBackFromStandaloneAthletes')?.addEventListener('click', backToSelectorFromAthletes);
  document.getElementById('standalonePlayerForm')?.addEventListener('submit', handleStandalonePlayerSubmit);
  document.getElementById('editStandaloneAthleteForm')?.addEventListener('submit', handleEditStandaloneAthleteSubmit);
  document.getElementById('btnCancelEditStandaloneAthlete')?.addEventListener('click', cancelEditStandaloneAthlete);

  // ✅ NUEVO: editor unificado (admin edita cualquier jugador, de equipo o independiente)
  document.getElementById('editUnifiedPlayerForm')?.addEventListener('submit', handleUnifiedPlayerEditSubmit);
  document.getElementById('btnCancelEditUnifiedPlayer')?.addEventListener('click', cancelUnifiedPlayerEdit);

  // ✅ NUEVO: gestión de entrenadores (solo visible/usable por el administrador)
  document.getElementById('coachForm')?.addEventListener('submit', handleCreateCoachSubmit);

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
  initRolesObserver();
  // initGlobalAthletesObserver() se llama desde onAuthStateChanged
  // después de conocer el rol del usuario
  populateStandaloneCategoryDropdown(); // categoriesConfig es estático, no depende de datos de Firebase
});

// ============================================
// FIREBASE: OBSERVADORES
// ============================================
function initGlobalTournamentsObserver() {
  onValue(ref(db, 'tournaments'), (snapshot) => {
    globalTournaments = snapshot.val() || {};
    // Construir globalAllTeams con todos los equipos de todos los torneos
    globalAllTeams = {};
    Object.entries(globalTournaments).forEach(([tid, t]) => {
      if (t && t.teams) {
        Object.entries(t.teams).forEach(([teamId, team]) => {
          globalAllTeams[teamId] = { ...team, _tournamentId: tid, _tournamentName: t.name || tid };
        });
      }
    });
    renderCompetitionsSelector();
    renderPlayerRegistry(); // re-render padrón con datos actualizados
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
    renderPlayerRegistry();
  });

  // Patrocinadores globales — se leen de /sponsors (ruta global)
  onValue(ref(db, 'sponsors'), (snap) => {
    const data = snap.val();
    startSponsorRotation(data);
  });
}

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, async (user) => {
  isAdmin = !!user;

  if (user) {
    currentUserUid = user.uid;
    console.log("✅ Usuario autenticado:", user.email, "| UID:", user.uid);

    // ✅ NUEVO: buscamos si este usuario tiene un rol restringido de "coach"
    let roleData = null;
    try {
      const roleSnap = await get(ref(db, `roles/${user.uid}`));
      roleData = roleSnap.val();
      console.log("📋 Datos de rol obtenidos:", roleData);
    } catch (err) {
      // Si las reglas de DB bloquean la lectura, se asume admin (no coach)
      console.warn("⚠️ No se pudo leer el rol — se asume 'admin':", err.code || err.message);
    }

    if (roleData && roleData.role === 'coach') {
      // Cuenta de entrenador desactivada por el administrador: se le cierra la sesión
      if (roleData.active === false) {
        alert('🚫 Tu cuenta de entrenador ha sido desactivada. Contacta al administrador.');
        await signOut(auth);
        return;
      }
      currentUserRole = 'coach';
      currentUserName = roleData.name || user.email;
    } else {
      currentUserRole = 'admin';
      currentUserName = roleData?.name || 'Administrador';
    }

    document.body.classList.add('is-admin');
    if (document.getElementById('admin-login-box')) document.getElementById('admin-login-box').style.display = 'none';

    if (currentUserRole === 'coach') {
      // ✅ Un entrenador NUNCA ve el panel completo de competencias (torneos, sedes, partidos, marcadores)
      if (document.getElementById('btnGoToAdminPrep')) document.getElementById('btnGoToAdminPrep').style.display = 'none';
      if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'none';
      if (document.getElementById('btnGoToStandaloneAthletes')) {
        document.getElementById('btnGoToStandaloneAthletes').style.display = 'block';
        document.getElementById('btnGoToStandaloneAthletes').innerText = `🪪 Registrar mis Jugadores (${currentUserName})`;
      }
    } else {
      // Administrador: acceso total
      if (document.getElementById('btnGoToAdminPrep')) document.getElementById('btnGoToAdminPrep').style.display = 'block';
      if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'grid';
      if (document.getElementById('btnGoToStandaloneAthletes')) {
        document.getElementById('btnGoToStandaloneAthletes').style.display = 'block';
        document.getElementById('btnGoToStandaloneAthletes').innerText = '🪪 Registro y Credenciales de Atletas';
      }
    }
    applyRoleBasedNavVisibility();
    syncFloatingAdminBtn(currentUserRole);
    initGlobalAthletesObserver(); // inicializar AHORA que ya sabemos el rol
  } else {
    currentUserRole = 'public';
    currentUserUid  = null;
    currentUserName = '';
    document.body.classList.remove('is-admin');
    syncFloatingAdminBtn('public');
    if (document.getElementById('admin-login-box'))    document.getElementById('admin-login-box').style.display = 'flex';
    if (document.getElementById('btnGoToAdminPrep'))   document.getElementById('btnGoToAdminPrep').style.display = 'none';
    if (document.getElementById('btnGoToStandaloneAthletes')) document.getElementById('btnGoToStandaloneAthletes').style.display = 'none';
    if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'none';
    applyRoleBasedNavVisibility();
  }

  renderCompetitionsSelector();
  renderStandaloneAthleteList();
  if (currentTournamentId) {
    renderCategories();
    renderMatchesByVenue();
  }
});

// ── BOTÓN FLOTANTE DE ADMIN ─────────────────────────────────────────────────
function toggleFloatingLogin() {
  const panel = document.getElementById('floating-login-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
window.toggleFloatingLogin = toggleFloatingLogin;

async function handleFloatingLogin() {
  const emailVal = document.getElementById('floatLoginEmail')?.value.trim();
  const passVal  = document.getElementById('floatLoginPassword')?.value;
  const errEl    = document.getElementById('floatLoginError');
  if (!emailVal || !passVal) return;
  try {
    await signInWithEmailAndPassword(auth, emailVal, passVal);
    // El onAuthStateChanged se encarga del resto
    const panel = document.getElementById('floating-login-panel');
    if (panel) panel.style.display = 'none';
  } catch (err) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Credenciales incorrectas';
    }
  }
}
window.handleFloatingLogin = handleFloatingLogin;

// Ocultar el botón flotante cuando el usuario ya está logueado
function syncFloatingAdminBtn(role) {
  const wrapper = document.getElementById('floating-admin-btn-wrapper');
  if (!wrapper) return;
  // Si está logueado ocultar el botón (ya tiene acceso al panel)
  wrapper.style.display = (role === 'public') ? 'block' : 'none';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const emailVal = document.getElementById('loginEmail').value.trim();
  const passVal  = document.getElementById('loginPassword').value;

  if (!emailVal || !passVal) {
    alert("⚠️ Por favor ingresa email y contraseña.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, emailVal, passVal);
    // El onAuthStateChanged se encarga del resto
  } catch (error) {
    console.error("Error de login:", error.code, error.message);
    const msgs = {
      'auth/user-not-found':    '❌ No existe una cuenta con ese correo.',
      'auth/wrong-password':    '❌ Contraseña incorrecta. Verifica e inténtalo de nuevo.',
      'auth/invalid-credential':'❌ Email o contraseña incorrectos.',
      'auth/invalid-email':     '❌ El formato del correo no es válido.',
      'auth/too-many-requests': '⏳ Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
      'auth/network-request-failed': '🌐 Sin conexión a internet. Revisa tu red.'
    };
    alert(msgs[error.code] || `❌ Error al iniciar sesión: ${error.message}`);
  }
}

async function handleLogout() {
  await signOut(auth);
  location.reload();
}

// ✅ CORRECCIÓN: signOutAdmin — usada en el botón del Panel Master
async function signOutAdmin() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("Error al cerrar sesión: " + error.message);
  }
}
window.signOutAdmin = signOutAdmin;

// ============================================
// NAVEGACIÓN
// ============================================
function renderCompetitionsSelector() {
  const select = document.getElementById('globalCompetitionSelect');
  if (!select) return;
  select.innerHTML = '';
  const keys = Object.keys(globalTournaments);
  const isAdmin = document.body.classList.contains('is-admin');
  const isCoach = (currentUserRole === 'coach');
  // Admin ve todas; coach y público solo ven las marcadas isPublic
  const visible = keys.filter(k => isAdmin || globalTournaments[k].isPublic === true);
  if (visible.length === 0) {
    select.innerHTML = isAdmin
      ? '<option value="">Sin competencias — crea una abajo</option>'
      : isCoach
        ? '<option value="">No hay competencias disponibles actualmente</option>'
        : '<option value="">No hay competencias públicas disponibles</option>';
  } else {
    visible.forEach(key => {
      const t = globalTournaments[key];
      const badge = t.isPublic ? '' : ' [BLOQUEADA]';
      select.innerHTML += `<option value="${key}">🏆 ${t.name}${badge} — 📍 ${t.location || 'Sin sede'}</option>`;
    });
  }
  // Actualizar panel de gestión si está visible
  renderCompetitionsManagerPanel();
}

// ── Panel de gestión de competencias (solo admin) ─────────────────────────────
function renderCompetitionsManagerPanel() {
  const container = document.getElementById('competitions-manager-list');
  if (!container) return;
  const keys = Object.keys(globalTournaments);
  if (keys.length === 0) {
    container.innerHTML = '<p style="color:#aaa;font-size:0.85rem;font-style:italic;">Aún no hay competencias creadas.</p>';
    return;
  }
  container.innerHTML = keys.map(key => {
    const t = globalTournaments[key];
    const pub = t.isPublic === true;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
                  background:#0f172a;border:1px solid ${pub ? '#10b981' : '#475569'};
                  border-radius:8px;padding:12px 16px;margin-bottom:10px;">
        <div>
          <div style="font-weight:bold;color:#fff;font-size:0.95rem;">${t.name}</div>
          <div style="font-size:0.78rem;color:#aaa;margin-top:2px;">📍 ${t.location || 'Sin sede'}</div>
          <div style="margin-top:6px;">
            <span style="font-size:0.75rem;font-weight:bold;padding:3px 10px;border-radius:10px;
              background:${pub ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'};
              color:${pub ? '#10b981' : '#ef4444'};">
              ${pub ? '🟢 PÚBLICA — visible al público' : '🔒 BLOQUEADA — solo visible para ti'}
            </span>
          </div>
        </div>
        <button onclick="toggleCompetitionPublic('${key}', ${pub})"
          style="min-width:130px;padding:10px 14px;border:none;border-radius:6px;
                 font-weight:bold;cursor:pointer;font-size:0.83rem;white-space:nowrap;
                 background:${pub ? '#7f1d1d' : '#065f46'};color:#fff;">
          ${pub ? '🔒 Bloquear' : '🟢 Publicar'}
        </button>
      </div>`;
  }).join('');
}

function toggleCompetitionPublic(id, currentlyPublic) {
  const accion = currentlyPublic ? 'bloquear' : 'publicar';
  if (!confirm(`¿Deseas ${accion} esta competencia?`)) return;
  update(ref(db, `tournaments/${id}`), { isPublic: !currentlyPublic })
    .catch(err => alert('Error al actualizar: ' + err.message));
}
window.toggleCompetitionPublic = toggleCompetitionPublic;

function loadSelectedTournamentContext() {
  const id = document.getElementById('globalCompetitionSelect')?.value;
  if (!id) return alert("Selecciona un evento válido.");

  // Doble seguridad: coach no puede entrar a competencias bloqueadas
  const isAdmin = document.body.classList.contains('is-admin');
  if (!isAdmin && globalTournaments[id] && globalTournaments[id].isPublic !== true) {
    return alert("⛔ Esta competencia no está disponible actualmente.");
  }

  currentTournamentId = id;
  attachTournamentRealtimeListeners(id);
  document.getElementById('competition-selector-screen').style.display = 'none';
  document.getElementById('main-app-content').style.display = 'block';
  switchSection('dashboard');
}

// ✅ NUEVO: cierra el hueco donde un entrenador que entra a "ver" un torneo (modo espectador)
// podía llegar a ver botones/pestañas exclusivos de administración solo por estar autenticado.
// Estos elementos deben ocultarse SIEMPRE que el rol no sea 'admin', sin importar is-admin.
function applyRoleBasedNavVisibility() {
  const showAdminOnly = currentUserRole === 'admin';
  // Usar clase en body para controlar visibilidad con CSS — más seguro que manipular display uno a uno
  if (showAdminOnly) {
    document.body.classList.add('is-admin-confirmed');
  } else {
    document.body.classList.remove('is-admin-confirmed');
  }
}
window.applyRoleBasedNavVisibility = applyRoleBasedNavVisibility;

function switchSection(sectionId, fromGlobalSelector = false) {
  if (fromGlobalSelector) {
    // Admin entró directo al panel sin pasar por "Entrar a la Aplicación"
    // → cargar la competencia que tenga seleccionada en el dropdown (o la primera disponible)
    if (!currentTournamentId) {
      const select = document.getElementById('globalCompetitionSelect');
      const id = select?.value || Object.keys(globalTournaments)[0] || null;
      if (id) {
        currentTournamentId = id;
        attachTournamentRealtimeListeners(id);
      }
    }
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
  if (filterCatSel) {
    const prevVal = filterCatSel.value;
    filterCatSel.innerHTML = catOptions;
    if (prevVal) filterCatSel.value = prevVal;
  }
  if (editTeamCatSel)  editTeamCatSel.innerHTML  = catOptions;
  if (editMatchCatSel) editMatchCatSel.innerHTML = catOptions;
  if (matchCatSel)    matchCatSel.innerHTML    = catOptions;

  updateFilteredTeamsDropdowns();
  populateTeamForPlayerDropdown();
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

  Object.entries(globalMatches)
    .filter(([_, m]) => m)
    .sort(([_, a], [__, b]) => {
      const aPending = a.localScore === undefined ? 0 : 1;
      const bPending = b.localScore === undefined ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (a.date || '').localeCompare(b.date || '');
    })
    .forEach(([id, m]) => {
      const statusText = (m.localScore !== undefined)
        ? ` ✅ (Jugado: ${m.localScore}-${m.visitorScore})`
        : ' ⏳ (Pendiente)';
      select.innerHTML += `<option value="${id}">${categoriesConfig[m.category]?.label || m.category} | ${m.localName} VS ${m.visitorName} - ${m.date}${statusText}</option>`;
    });
}

// ============================================
// RENDER: DASHBOARD
// ============================================
let dashboardSearchTerm = '';
let dashboardSortMode   = 'name';

function renderDashboard() {
  const teamsArr = Object.values(globalTeams).filter(t => t?.name);
  document.getElementById('dashTeamsCount').innerText   = teamsArr.length;
  document.getElementById('dashMatchesCount').innerText = Object.values(globalMatches).length;

  const container = document.getElementById('dashboardTeamsContainer');
  if (!container) return;

  ensureDashboardSearchBar(container);
  renderDashboardTeamsList();
}

function ensureDashboardSearchBar(container) {
  if (document.getElementById('dashTeamSearchBar')) return;
  const bar = document.createElement('div');
  bar.id = 'dashTeamSearchBar';
  bar.style.cssText = 'display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;';
  bar.innerHTML = `
    <input type="text" id="dashTeamSearchInput" placeholder="🔍 Buscar equipo..."
      oninput="filterDashboardTeams(this.value)"
      style="flex:1; min-width:180px; padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#1e2530; color:#fff;">
    <select id="dashTeamSortSelect" onchange="sortDashboardTeams(this.value)"
      style="padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#1e2530; color:#fff;">
      <option value="name">Ordenar: A-Z</option>
      <option value="category">Ordenar: Categoría</option>
    </select>`;
  container.parentNode.insertBefore(bar, container);
}

function filterDashboardTeams(term) {
  dashboardSearchTerm = (term || '').toLowerCase();
  renderDashboardTeamsList();
}
window.filterDashboardTeams = filterDashboardTeams;

function sortDashboardTeams(mode) {
  dashboardSortMode = mode;
  renderDashboardTeamsList();
}
window.sortDashboardTeams = sortDashboardTeams;

function renderDashboardTeamsList() {
  const container = document.getElementById('dashboardTeamsContainer');
  if (!container) return;

  let teamsArr = Object.values(globalTeams).filter(t => t?.name);

  if (dashboardSearchTerm) {
    teamsArr = teamsArr.filter(t => t.name.toLowerCase().includes(dashboardSearchTerm));
  }

  if (dashboardSortMode === 'category') {
    teamsArr.sort((a, b) =>
      (a.categoryRegistered || '').localeCompare(b.categoryRegistered || '') ||
      a.name.localeCompare(b.name)
    );
  } else {
    teamsArr.sort((a, b) => a.name.localeCompare(b.name));
  }

  container.innerHTML = '';
  if (teamsArr.length === 0) {
    container.innerHTML = '<p style="color:#888; font-style:italic;">No se encontraron equipos.</p>';
    return;
  }

  teamsArr.forEach(team => {
    const pill = document.createElement('div');
    pill.className = 'team-pill';
    pill.innerHTML = `<strong>${team.name}</strong> <span style="font-size:0.7rem; color:#aaa; margin-left:6px;">${categoriesConfig[team.categoryRegistered]?.label || ''}</span>`;
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
    const filteredTeams = teamsArr
      .filter(([_, t]) => t.categoryRegistered === catKey)
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
    if (filteredTeams.length === 0) return;
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `<h4>${categoriesConfig[catKey].label} <span style="font-size:0.7rem; color:#aaa; font-weight:normal;">(${filteredTeams.length})</span></h4>`;
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
  const playoffs = Object.entries(globalMatches).filter(([_, m]) => m && (m.stage === 'semifinal' || m.stage === 'final'));

  if (playoffs.length > 0) {
    let html = `<div style="border:2px solid #ff6b00; padding:15px; border-radius:10px; margin-bottom:30px; background:rgba(255,107,0,0.05);">
      <h2 style="color:#ff6b00; text-align:center; margin:0 0 15px 0; font-size:1.5rem; text-transform:uppercase;">🔥 FASE FINAL</h2>`;

    playoffs.forEach(([mId, m]) => {
      const score = m.localScore !== undefined ? `${m.localScore} - ${m.visitorScore}` : 'VS';
      const venueName = globalVenues[m.venueId]?.name || 'Sede por definir';

      let adminBtns = '';
      if (isAdmin) {
        adminBtns = `
          <div style="margin-top:10px; display:flex; justify-content:center; gap:10px;">
            <button onclick="setQuickScore('${mId}')" style="background:#10b981; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">⏱️ Cargar Marcador</button>
            <button onclick="printScoresheet('${mId}')" style="background:#334155; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">📄</button>
          </div>`;
      }

      html += `
        <div style="text-align:center; padding:15px; border-bottom:1px solid #444; margin-bottom:10px;">
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:5px;">
            <span style="background:#ff6b00; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${m.stage.toUpperCase()}</span>
            <span style="background:#334155; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${categoriesConfig[m.category]?.label || m.category}</span>
          </div>
          
          <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin:10px 0;">
            <strong style="font-size:1.2rem; flex:1; text-align:right;">${m.localName}</strong>
            <span style="background:#ff6b00; color:#fff; padding:5px 15px; border-radius:5px; font-size:1.3rem; font-weight:bold; min-width:80px;">${score}</span>
            <strong style="font-size:1.2rem; flex:1; text-align:left;">${m.visitorName}</strong>
          </div>

          <div style="font-size:0.85rem; color:#aaa; display:flex; justify-content:center; gap:15px;">
            <span>📅 ${m.date}</span>
            <span>⏰ <strong>${m.startTime} hrs</strong></span>
            <span>📍 <strong>${venueName}</strong></span>
          </div>
          ${adminBtns}
        </div>`;
    });
    container.innerHTML += html + `</div>`;
  }
}

// ============================================
// RENDER: ROL DE JUEGOS
// ============================================
let venueFilterSearch = '';

function ensureVenueFilterBar(container) {
  if (document.getElementById('venueFilterBar')) return;

  const catOptions = '<option value="all">Todas las categorías</option>' +
    Object.entries(categoriesConfig).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  const bar = document.createElement('div');
  bar.id = 'venueFilterBar';
  bar.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; background:#1e2530; padding:12px; border-radius:8px;';
  bar.innerHTML = `
    <input type="text" id="venueSearchInput" placeholder="🔍 Buscar equipo..."
      oninput="renderMatchesByVenue()"
      style="flex:1; min-width:160px; padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff;">
    <select id="venueCatFilter" onchange="renderMatchesByVenue()"
      style="padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff;">${catOptions}</select>
    <select id="venueStageFilter" onchange="renderMatchesByVenue()"
      style="padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff;">
      <option value="all">Todas las etapas</option>
      <option value="regular">Fase Regular</option>
      <option value="semifinal">Semifinal</option>
      <option value="final">Final</option>
    </select>`;
  container.parentNode.insertBefore(bar, container);
}
window.renderMatchesByVenue = renderMatchesByVenue;

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;

  ensureVenueFilterBar(container);

  const searchTerm  = (document.getElementById('venueSearchInput')?.value || '').toLowerCase();
  const catFilter   = document.getElementById('venueCatFilter')?.value   || 'all';
  const stageFilter = document.getElementById('venueStageFilter')?.value || 'all';

  container.innerHTML = '';

  const venuesArr  = Object.entries(globalVenues).filter(([_, v]) => v?.name);
  let matchesArr = Object.entries(globalMatches).filter(([_, m]) => m?.date);

  if (catFilter !== 'all')   matchesArr = matchesArr.filter(([_, m]) => m.category === catFilter);
  if (stageFilter !== 'all') matchesArr = matchesArr.filter(([_, m]) => (m.stage || 'regular') === stageFilter);
  if (searchTerm) {
    matchesArr = matchesArr.filter(([_, m]) =>
      (m.localName || '').toLowerCase().includes(searchTerm) ||
      (m.visitorName || '').toLowerCase().includes(searchTerm)
    );
  }

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
        if (!dateString) return;
        const parts = dateString.split('-');
        if (parts.length !== 3) return;
        const year  = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day   = parseInt(parts[2], 10);

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
// ============================================
// ✅ NUEVO: PADRÓN GENERAL DE JUGADORES (solo admin)
// ============================================
// Combina los jugadores registrados por equipo (torneo activo) con los del
// registro independiente de entrenadores, para tener una vista unificada
// agrupada por año de nacimiento, en orden alfabético, y con detección de
// posibles duplicados (mismo nombre repetido sin importar el equipo).
let playerRegistrySearchTerm = '';

function normalizePlayerName(name) {
  return (name || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getUnifiedPlayersList() {
  const list = [];

  // 1) Jugadores registrados por equipo
  // Si hay un torneo activo usa globalTeams (del torneo), si no usa globalAllTeams (todos los torneos)
  const teamsSource = Object.keys(globalTeams).length > 0 ? globalTeams : globalAllTeams;
  Object.entries(teamsSource).forEach(([teamId, team]) => {
    if (!team || !team.players) return;
    Object.entries(team.players).forEach(([playerId, p]) => {
      if (!p || !p.name) return;
      list.push({
        source: 'team',
        teamId, playerId,
        name: p.name,
        club: team.name || '---',
        category: team.categoryRegistered,
        birth: p.birth || '',
        curp: p.curp || '',
        photo: p.photo || 'https://via.placeholder.com/150',
        number: p.number,
        bloodType: p.bloodType,
        playerID: p.playerID,
        timestamp: p.timestamp,
        responsibleName: p.responsibleName,
        responsiblePhone: p.responsiblePhone
      });
    });
  });

  // 2) Atletas del registro independiente de entrenadores
  Object.entries(globalAthletes).forEach(([athleteId, p]) => {
    if (!p || !p.name) return;
    list.push({
      source: 'standalone',
      athleteId,
      name: p.name,
      club: p.club || '---',
      category: p.category,
      birth: p.birth || '',
      curp: p.curp || '',
      photo: p.photo || 'https://via.placeholder.com/150',
      number: p.number,
      bloodType: p.bloodType,
      playerID: p.playerID,
      timestamp: p.timestamp,
      responsibleName: p.responsibleName,
      responsiblePhone: p.responsiblePhone
    });
  });

  return list;
}

function filterPlayerRegistry(term) {
  playerRegistrySearchTerm = term;
  renderPlayerRegistry();
}
window.filterPlayerRegistry = filterPlayerRegistry;

// ============================================
// ✅ NUEVO: EXPORTAR TODAS LAS CREDENCIALES EN UN SOLO ZIP (solo admin)
// ============================================
function ensureCredentialStylesInjected() {
  if (document.getElementById('credential-card-css-global')) return;
  const style = document.createElement('style');
  style.id = 'credential-card-css-global';
  style.innerHTML = CREDENTIAL_CARD_CSS;
  document.head.appendChild(style);
}

const CREDENTIAL_CARD_CSS = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  .card { width: 340px; height: 214px; border: 2px solid #000; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.2); background: #fff; box-sizing: border-box; font-family: 'Helvetica', Arial, sans-serif; }

  .front { background: linear-gradient(135deg, #fff 65%, #ff6b00 100%); }
  .header { background: #000; color: #fff; padding: 5px 8px; display: flex; align-items: center; gap: 8px; height: 22px; box-sizing: border-box; }
  .header img { height: 18px; }
  .header span { font-size: 8.5px; font-weight: bold; text-transform: uppercase; }

  .photo-box { position: absolute; top: 28px; left: 10px; width: 78px; height: 112px; border: 1.5px solid #000; background: #eee; }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; }

  .main-data { position: absolute; top: 28px; left: 94px; right: 98px; }
  .label { font-size: 7px; color: #666; text-transform: uppercase; margin: 0; }
  .value { font-size: 9px; font-weight: bold; margin: 0 0 3px 0; text-transform: uppercase; line-height: 1.15; }

  .front-logo-band { position: absolute; top: 26px; bottom: 22px; right: 6px; width: 86px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .front-logo-band img { height: 84px; width: auto; max-width: 86px; object-fit: contain; }
  .front-logo-band .player-num { font-size: 24px; font-weight: 900; color: #000; line-height: 1; }

  .id-footer { position: absolute; bottom: 0; width: 100%; background: #000; color: #fff; font-size: 8px; text-align: center; padding: 3px 0; box-sizing: border-box; }

  .back { background: #f9f9f9; padding: 10px 14px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
  .back-top { display: flex; justify-content: center; align-items: center; height: 74px; }
  .back-top img { height: 66px; width: auto; max-width: 200px; object-fit: contain; }
  .back-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .back-grid .label { font-size: 7px; }
  .back-grid .value { font-size: 9px; }
  .resp-box { border-top: 1px solid #ccc; padding-top: 5px; margin-top: 4px; }
  .signature-area { margin-top: 4px; text-align: center; }
  .signature-line { border-top: 1px solid #000; width: 120px; margin: 8px auto 0 auto; font-size: 8px; }

  #credWrapper { display: flex; flex-direction: column; gap: 20px; align-items: center; }
  @media print { .no-print { display: none; } body { padding: 0; } .card { box-shadow: none; page-break-inside: avoid; } }
`;

// ✅ REFACTOR: markup de las 2 tarjetas (frente/reverso), reutilizable en
// impresión individual y en la exportación masiva en ZIP.
function buildCoachCredentialCardMarkup(data) {
  const { name, club, categoryLabel, photo, playerID, curp, birth, phone, email } = data;
  return `
      <div class="card front">
        <div class="header">
          <img src="${APP_LOGO_URL}">
          <span>Entrenador Oficial - Dribla, Pasa y Encesta</span>
        </div>
        <div class="photo-box">
          <img src="${photo}" crossorigin="anonymous">
        </div>
        <div class="main-data">
          <p class="label">Nombre del Entrenador</p>
          <p class="value">${name}</p>
          <p class="label">Club / Equipo</p>
          <p class="value">${club || '---'}</p>
          <p class="label">Categoría</p>
          <p class="value">${categoryLabel || '---'}</p>
          <p class="label" style="color:#10b981;">ROL</p>
          <p class="value" style="color:#10b981; font-size:13px; font-weight:bold;">👨‍🏫 ENTRENADOR</p>
        </div>
        <div class="front-logo-band">
          <img src="${LOGO_FRENTE_URL}" crossorigin="anonymous">
          <div class="player-num" style="background:#10b981;"></div>
        </div>
        <div class="id-footer">ID ENTRENADOR: ${playerID}</div>
      </div>

      <div class="card back">
        <div class="back-top">
          <img src="${LOGO_REVERSO_URL}" crossorigin="anonymous">
        </div>
        <div class="back-grid">
          <div>
            <p class="label">CURP</p>
            <p class="value">${curp || '---'}</p>
          </div>
          <div>
            <p class="label">Fecha Nacimiento</p>
            <p class="value">${birth || '---'}</p>
          </div>
          <div>
            <p class="label">Teléfono</p>
            <p class="value">${phone || '---'}</p>
          </div>
          <div>
            <p class="label">ID Credencial</p>
            <p class="value">${playerID}</p>
          </div>
        </div>

        <div class="resp-box">
          <p class="label">Correo Electrónico</p>
          <p class="value" style="font-size:9px;">${email || '---'}</p>
          <p class="value" style="font-size:9px; color:#10b981; font-weight:bold; margin-top:6px;">ENTRENADOR CERTIFICADO</p>
        </div>

        <div class="signature-area">
          <div class="signature-line">Firma del Delegado / Administrador</div>
        </div>
      </div>`;
}

function buildCredentialCardMarkup(data) {
  const { name, club, categoryLabel, photo, playerID, vigenciaTexto, curp, birth, bloodType, responsibleName, responsiblePhone, number } = data;
  return `
      <div class="card front">
        <div class="header">
          <img src="${APP_LOGO_URL}">
          <span>Atleta Oficial - Dribla, Pasa y Encesta</span>
        </div>
        <div class="photo-box">
          <img src="${photo}" crossorigin="anonymous">
        </div>
        <div class="main-data">
          <p class="label">Nombre del Jugador</p>
          <p class="value">${name}</p>
          <p class="label">Club / Equipo</p>
          <p class="value">${club}</p>
          <p class="label">Categoria</p>
          <p class="value">${categoryLabel}</p>
          <p class="label">Vigencia</p>
          <p class="value" style="color:#ff6b00;">${vigenciaTexto}</p>
        </div>
        <div class="front-logo-band">
          <img src="${LOGO_FRENTE_URL}" crossorigin="anonymous">
          <div class="player-num">${number || ''}</div>
        </div>
        <div class="id-footer">ID AFILIACION: ${playerID}</div>
      </div>

      <div class="card back">
        <div class="back-top">
          <img src="${LOGO_REVERSO_URL}" crossorigin="anonymous">
        </div>
        <div class="back-grid">
          <div>
            <p class="label">CURP</p>
            <p class="value">${curp}</p>
          </div>
          <div>
            <p class="label">Fecha Nacimiento</p>
            <p class="value">${birth}</p>
          </div>
          <div>
            <p class="label">Tipo de Sangre</p>
            <p class="value" style="color:#c0392b;">${bloodType}</p>
          </div>
          <div>
            <p class="label">ID Afiliacion</p>
            <p class="value">${playerID}</p>
          </div>
        </div>

        <div class="resp-box">
          <p class="label">Contacto de Emergencia (Responsable)</p>
          <p class="value" style="font-size:9px;">${responsibleName}</p>
          <p class="value" style="font-size:9px;">Tel: ${responsiblePhone}</p>
        </div>

        <div class="signature-area">
          <div class="signature-line">Firma del Delegado / Coach</div>
        </div>
      </div>`;
}

function openCredentialWindow(data) {
  const { name, playerID } = data;
  const cardMarkup = buildCredentialCardMarkup(data);

  // Usar modal interno en lugar de window.open (evita bloqueo de popups)
  const existing = document.getElementById('credentialModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'credentialModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:20px;box-sizing:border-box;';

  modal.innerHTML = `
    <div style="width:100%;max-width:700px;">
      <!-- Controles -->
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;">
        <button onclick="printCredentialModal()" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#2563eb;color:white;border:none;border-radius:8px;font-size:0.95rem;">🖨️ Imprimir</button>
        <button onclick="downloadCredentialAsImage('${(name||'').replace(/'/g,"\'")}','${playerID||''}')" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#10b981;color:white;border:none;border-radius:8px;font-size:0.95rem;">⬇️ Descargar PNG</button>
        <button onclick="document.getElementById('credentialModal').remove()" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#64748b;color:white;border:none;border-radius:8px;font-size:0.95rem;">✕ Cerrar</button>
      </div>
      <p style="color:#94a3b8;text-align:center;font-size:0.78rem;margin-bottom:16px;">Impresión: activa "Gráficos de fondo" en el diálogo para conservar los colores.</p>
      <!-- Credencial -->
      <div id="credWrapper" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <style>${CREDENTIAL_CARD_CSS}</style>
        ${cardMarkup}
      </div>
    </div>
  `;

  // Cerrar panel maestro temporalmente si está abierto (evita z-index conflicts)
  const masterPanel = document.getElementById('admin-master-panel');
  const masterWasOpen = masterPanel && masterPanel.style.display !== 'none';
  if (masterWasOpen) {
    masterPanel.style.zIndex = '9000'; // bajar para que el modal quede encima
  }

  // Cerrar modal restaura el panel maestro
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
      if (masterWasOpen && masterPanel) masterPanel.style.zIndex = '9999';
    }
  });

  // Parchear el botón cerrar para restaurar z-index
  const closeBtn = modal.querySelector('button:last-child');
  if (closeBtn) {
    const orig = closeBtn.getAttribute('onclick');
    closeBtn.onclick = () => {
      modal.remove();
      if (masterWasOpen && masterPanel) masterPanel.style.zIndex = '9999';
    };
  }

  document.body.appendChild(modal);
}

function printCredentialModal() {
  const wrapper = document.getElementById('credWrapper');
  if (!wrapper) return;

  // Extraer solo las tarjetas (sin el <style> que ya va aparte)
  const cardsHTML = Array.from(wrapper.querySelectorAll('.card'))
    .map(el => el.outerHTML).join('\n');

  const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 20px; display: flex; flex-direction: column;
             align-items: center; gap: 20px; background: #f4f4f4;
             font-family: Helvetica, Arial, sans-serif; }
      ${CREDENTIAL_CARD_CSS}
      @media print { body { padding: 10px; } .card { page-break-inside: avoid; } }
    </style>
  </head><body>${cardsHTML}</body></html>`;

  // Abrir ventana de impresión (método más confiable cross-browser)
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) {
    // Si el popup fue bloqueado, usar iframe como fallback
    const oldFrame = document.getElementById('_printFrame');
    if (oldFrame) oldFrame.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '_printFrame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(fullHTML); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 600);
    return;
  }
  w.document.write(fullHTML);
  w.document.close();
  w.focus();
  // Esperar a que carguen las imágenes antes de imprimir
  const imgs = w.document.images;
  if (imgs.length === 0) {
    setTimeout(() => w.print(), 300);
  } else {
    let loaded = 0;
    const tryPrint = () => { if (++loaded >= imgs.length) setTimeout(() => w.print(), 200); };
    Array.from(imgs).forEach(img => {
      if (img.complete) tryPrint();
      else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
  }
}

function downloadCredentialAsImage(name, playerID) {
  const wrapper = document.getElementById('credWrapper');
  if (!wrapper) return;
  if (typeof html2canvas === 'undefined') {
    return alert('Cargando librerías, intenta en unos segundos.');
  }
  html2canvas(wrapper, { scale: 3, backgroundColor: '#f4f4f4' }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Credencial_${playerID}_${(name || '').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => alert('No se pudo generar la imagen: ' + err));
}

async function exportAllCredentialsPDF() {
  if (currentUserRole !== 'admin') return alert("🔒 Solo el administrador puede generar credenciales.");
  if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
    return alert("❌ No se pudieron cargar las librerías necesarias (jsPDF / html2canvas). Revisa tu conexión a internet y vuelve a intentar.");
  }

  const players = getUnifiedPlayersList();
  if (players.length === 0) return alert("No hay jugadores registrados todavía.");

  if (!confirm(`Se generará un PDF con las ${players.length} credenciales (frente y reverso, una por página), listo para imprimir. Puede tardar varios minutos según la cantidad. ¿Continuar?`)) return;

  ensureCredentialStylesInjected();

  const btn = document.getElementById('btnExportAllCredentials');
  const progressEl = document.getElementById('exportCredentialsProgress');
  if (btn) btn.disabled = true;

  const hiddenArea = document.createElement('div');
  hiddenArea.id = 'bulk-credential-render-area';
  hiddenArea.style.cssText = 'position:fixed; left:-9999px; top:0; background:#f4f4f4; padding:20px; z-index:-1;';
  document.body.appendChild(hiddenArea);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let done = 0;
  let failed = 0;

  for (const p of players) {
    if (progressEl) progressEl.innerText = `Generando ${done + 1}/${players.length}: ${p.name}...`;

    try {
      const categoryLabel = categoriesConfig[p.category]?.label
        ?.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || p.category || '---';

      const cardData = {
        name: p.name,
        club: p.club,
        categoryLabel,
        photo: p.photo,
        playerID: p.playerID || '---',
        vigenciaTexto: calcularVigencia(p.timestamp),
        curp: p.curp,
        birth: p.birth,
        bloodType: p.bloodType,
        responsibleName: p.responsibleName,
        responsiblePhone: p.responsiblePhone,
        number: p.number
      };

      hiddenArea.innerHTML = `<div id="bulk-cred-wrapper" style="display:flex; flex-direction:column; gap:20px; align-items:center;">${buildCredentialCardMarkup(cardData)}</div>`;

      // pequeña espera para que las imágenes (foto/logos) terminen de cargar
      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(document.getElementById('bulk-cred-wrapper'), {
        scale: 3, backgroundColor: '#f4f4f4', useCORS: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      // Escalar la imagen (frente + reverso apiladas) para que quepa centrada en la página,
      // dejando margen arriba para el nombre del jugador como referencia.
      const marginTop = 15;
      const marginSides = 15;
      const maxW = pageWidth - marginSides * 2;
      const maxH = pageHeight - marginTop - 15;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (pageWidth - imgW) / 2;
      const y = marginTop;

      if (done > 0) pdf.addPage();

      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${p.name} — ${cardData.categoryLabel} — ID: ${cardData.playerID}`, pageWidth / 2, 10, { align: 'center' });
      pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);

      done++;
    } catch (err) {
      console.error('Error generando credencial para', p.name, err);
      failed++;
    }
  }

  hiddenArea.remove();

  if (done === 0) {
    if (progressEl) progressEl.innerText = '❌ No se pudo generar ninguna credencial.';
    if (btn) btn.disabled = false;
    return;
  }

  if (progressEl) progressEl.innerText = `Guardando PDF (${done} credenciales)...`;

  pdf.save(`Credenciales_${new Date().toISOString().slice(0, 10)}.pdf`);

  if (progressEl) {
    progressEl.innerText = failed > 0
      ? `✅ Listo — ${done} credenciales en el PDF (⚠️ ${failed} fallaron, revisa la consola).`
      : `✅ Listo — ${done} credenciales generadas correctamente en el PDF.`;
  }
  if (btn) btn.disabled = false;
}
window.exportAllCredentialsPDF = exportAllCredentialsPDF;

function renderPlayerRegistry() {
  const container      = document.getElementById('playerRegistryContainer');
  const dupContainer    = document.getElementById('playerRegistryDuplicatesBox');
  if (!container) return; // sección no está en el DOM todavía / no aplica

  let players = getUnifiedPlayersList();

  // Detectar duplicados sobre el universo COMPLETO (antes de filtrar por búsqueda),
  // así el aviso siempre refleja la realidad total, no solo lo que se está buscando.
  const nameCount = {};
  players.forEach(p => {
    const key = normalizePlayerName(p.name);
    if (!key) return;
    nameCount[key] = (nameCount[key] || 0) + 1;
  });
  const duplicateKeys = Object.keys(nameCount).filter(k => nameCount[k] > 1);

  if (dupContainer) {
    if (duplicateKeys.length === 0) {
      dupContainer.innerHTML = `<div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:10px 15px; border-radius:8px; color:#10b981; font-size:0.85rem;">✅ No se detectaron nombres duplicados en todo el padrón.</div>`;
    } else {
      let dupHtml = `<div style="background:rgba(239,68,68,0.1); border:2px solid #ef4444; padding:15px; border-radius:8px;">
        <h4 style="color:#ef4444; margin:0 0 10px 0;">⚠️ Posibles Jugadores Duplicados (${duplicateKeys.length})</h4>`;
      duplicateKeys.forEach(key => {
        const matches = players.filter(p => normalizePlayerName(p.name) === key);
        dupHtml += `<div style="margin-bottom:6px; font-size:0.8rem;">
          <strong>${matches[0].name}</strong> aparece ${matches.length} veces:
          <span style="color:#aaa;"> ${matches.map(m => `${m.club} (${categoriesConfig[m.category]?.label?.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || m.category || '---'})`).join(' · ')}</span>
        </div>`;
      });
      dupHtml += `<p style="color:#888; font-size:0.7rem; margin-top:8px;">La comparación es por nombre (ignora mayúsculas y acentos) sin importar el equipo o club — revisa manualmente si en verdad es la misma persona.</p></div>`;
      dupContainer.innerHTML = dupHtml;
    }
  }

  // Filtro de búsqueda (nombre, club o CURP)
  if (playerRegistrySearchTerm) {
    const term = playerRegistrySearchTerm.toLowerCase();
    players = players.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.club || '').toLowerCase().includes(term) ||
      (p.curp || '').toLowerCase().includes(term)
    );
  }

  if (players.length === 0) {
    container.innerHTML = `<p style="color:#888; font-style:italic; padding:15px;">No hay jugadores registrados que coincidan.</p>`;
    return;
  }

  // Agrupar por año de nacimiento (extraído de la fecha "YYYY-MM-DD")
  const groups = {};
  players.forEach(p => {
    let year = 'Sin Fecha de Nacimiento';
    if (p.birth) {
      const y = p.birth.split('-')[0];
      if (y && !isNaN(parseInt(y, 10))) year = y;
    }
    if (!groups[year]) groups[year] = [];
    groups[year].push(p);
  });

  // Años más recientes primero (igual que el orden de categoriesConfig: chupon/micro arriba)
  const years = Object.keys(groups).sort((a, b) => {
    if (a === 'Sin Fecha de Nacimiento') return 1;
    if (b === 'Sin Fecha de Nacimiento') return -1;
    return parseInt(b, 10) - parseInt(a, 10);
  });

  let html = '';
  years.forEach(year => {
    const playersInYear = groups[year].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    html += `<h3 style="color:#ff6b00; margin-top:25px; border-bottom:2px solid #ff6b00; padding-bottom:5px;">
      📅 Generación ${year} <span style="font-size:0.75rem; color:#aaa; font-weight:normal;">(${playersInYear.length} jugador${playersInYear.length === 1 ? '' : 'es'})</span>
    </h3>`;

    html += `<div style="overflow-x:auto;"><table style="width:100%; font-size:0.8rem; border-collapse:collapse; background:#111; color:white; margin-bottom:10px;">
      <thead><tr style="background:#222; color:#ff6b00;">
        <th>Foto</th><th style="text-align:left;">Nombre</th><th style="text-align:left;">Club</th><th>Categoría</th><th>Nacimiento</th><th>Origen</th><th>Acciones</th>
      </tr></thead><tbody>`;

    playersInYear.forEach(p => {
      const isDup    = duplicateKeys.includes(normalizePlayerName(p.name));
      const catLabel = categoriesConfig[p.category]?.label || p.category || '---';
      const printAction = p.source === 'team'
        ? `printPlayerID('${p.teamId}', '${p.playerId}')`
        : `printStandaloneAthleteID('${p.athleteId}')`;
      const editAction = p.source === 'team'
        ? `loadPlayerForUnifiedEdit('team', '${p.teamId}', '${p.playerId}')`
        : `loadPlayerForUnifiedEdit('standalone', '${p.athleteId}')`;
      const deleteAction = p.source === 'team'
        ? `deleteUnifiedPlayer('team', '${p.teamId}', '${p.playerId}')`
        : `deleteUnifiedPlayer('standalone', '${p.athleteId}')`;

      html += `<tr style="border-bottom:1px solid #333; ${isDup ? 'background:rgba(239,68,68,0.1);' : ''}">
        <td style="padding:5px;"><img src="${p.photo}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;"></td>
        <td style="padding:5px;">${p.name} ${isDup ? '<span title="Posible jugador duplicado" style="color:#ef4444; font-weight:bold;">⚠️</span>' : ''}</td>
        <td style="padding:5px;">${p.club}</td>
        <td style="text-align:center; font-size:0.7rem;">${catLabel}</td>
        <td style="text-align:center;">${p.birth || '---'}</td>
        <td style="text-align:center; font-size:0.7rem; color:#aaa;">${p.source === 'team' ? '🏆 Torneo' : '🪪 Independiente'}</td>
        <td style="text-align:center; white-space:nowrap;">
          ${currentUserRole === 'admin' ? `<button onclick="${printAction}" title="Generar Credencial" style="background:#10b981; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">🪪</button>` : ''}
          <button onclick="${editAction}" title="Editar" style="background:#334155; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">✏️</button>
          <button onclick="${deleteAction}" title="Borrar" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
        </td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
  });

  container.innerHTML = html;
}

function renderClassificationTables() {
  const container = document.getElementById('classificationTablesContainer');
  const filterEl  = document.getElementById('classCategoryFilter');
  if (!container || !filterEl) return;

  const selectedCat = filterEl.value;
  if (!selectedCat) return;
  container.innerHTML = '';

  ensureTeamHistoryBar(container);
  populateTeamHistorySelect(selectedCat);

  const stats = {};

  Object.entries(globalTeams).forEach(([id, t]) => {
    if (t && t.categoryRegistered === selectedCat) {
      stats[id] = {
        id, name: t.name,
        group: (t.groupAssigned || 'sin grupo').toLowerCase().trim(),
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

  const sortFibaGroup = (teamList) => {
    teamList.sort((a, b) => b.pts - a.pts);

    let i = 0;
    while (i < teamList.length) {
      let j = i + 1;
      while (j < teamList.length && teamList[j].pts === teamList[i].pts) j++;

      if (j - i > 1) {
        const tieGroup = teamList.slice(i, j);
        const h2h = getH2HStats(tieGroup.map(t => t.id));
        tieGroup.sort((a, b) => {
          const sA = h2h[a.id], sB = h2h[b.id];
          if (sB.pts !== sA.pts) return sB.pts - sA.pts;
          if ((sB.pf - sB.pc) !== (sA.pf - sA.pc)) return (sB.pf - sB.pc) - (sA.pf - sA.pc);
          return sB.pf - sA.pf;
        });
        teamList.splice(i, tieGroup.length, ...tieGroup);
      }
      i = j;
    }
    return teamList;
  };

  const groupsMap = {};
  Object.values(stats).forEach(t => { if (!groupsMap[t.group]) groupsMap[t.group] = []; groupsMap[t.group].push(t); });
  
  const primerosLugares = [];
  const segundosLugares = [];

  Object.keys(groupsMap).sort().forEach(gName => {
    const sorted = sortFibaGroup(groupsMap[gName]);
    sorted.forEach(t => t.dif = t.pf - t.pc);
    
    container.innerHTML += `<h3>GRUPO ${gName.toUpperCase()}</h3>` + generateTableHtml(sorted);
    
    if (sorted.length > 0) primerosLugares.push({ ...sorted[0], groupOrigin: gName });
    if (sorted.length > 1) segundosLugares.push({ ...sorted[1], groupOrigin: gName });
  });

  const numGroups = Object.keys(groupsMap).length;

  if (numGroups === 2) {
    const [p1, p2]     = primerosLugares;
    const [seg1, seg2] = segundosLugares;

    container.innerHTML += `
      <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:20px;">
        <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
        <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">1° de cada grupo vs 2° del grupo contrario</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
            <div style="text-align:center;"><strong>${p1?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${seg2?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>1° Gpo ${p1?.groupOrigin?.toUpperCase()||''} · ${p1?.pts||0} pts</span>
              <span>2° Gpo ${seg2?.groupOrigin?.toUpperCase()||''} · ${seg2?.pts||0} pts</span>
            </div>
          </div>
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
            <div style="text-align:center;"><strong>${p2?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${seg1?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>1° Gpo ${p2?.groupOrigin?.toUpperCase()||''} · ${p2?.pts||0} pts</span>
              <span>2° Gpo ${seg1?.groupOrigin?.toUpperCase()||''} · ${seg1?.pts||0} pts</span>
            </div>
          </div>
        </div>
        <p style="text-align:center; color:#888; font-size:0.72rem; margin-top:12px;">🏅 Los ganadores avanzan a la <strong>Gran Final</strong></p>
      </div>`;

  } else if (numGroups === 3) {
    const calcAvg = (t) => ({
      ...t,
      avgPts: t.jj > 0 ? t.pts / t.jj : 0,
      avgDif: t.jj > 0 ? t.dif / t.jj : 0,
      avgPF:  t.jj > 0 ? t.pf / t.jj : 0
    });

    const sortSeeds = (arr) => arr.map(calcAvg).sort((a, b) =>
      b.avgPts - a.avgPts || b.avgDif - a.avgDif || b.avgPF - a.avgPF
    );

    const mejorSegundo = sortSeeds([...segundosLugares])[0];
    const clasificados = sortSeeds([...primerosLugares, mejorSegundo]);

    let [s1, s2, s3, s4] = clasificados;
    let ruleApplied = false;

    for (let tries = 0; tries < 10; tries++) {
      const c1 = s1 && s4 && s1.groupOrigin === s4.groupOrigin;
      const c2 = s2 && s3 && s2.groupOrigin === s3.groupOrigin;
      if (!c1 && !c2) break;
      if (c1 && !c2) { [s3, s4] = [s4, s3]; ruleApplied = true; }
      else if (!c1 && c2) { [s3, s4] = [s4, s3]; ruleApplied = true; }
      else { [s2, s3] = [s3, s2]; ruleApplied = true; }
    }

    const criteriosMejorSegundo = segundosLugares.map(t =>
      `<tr>
        <td style="padding:4px 8px; text-align:left;"><strong>${t.name}</strong>
          <span style="color:#aaa; font-size:0.75rem;"> (${t.groupOrigin?.toUpperCase()})</span></td>
        <td style="padding:4px 8px;">${t.jj}</td>
        <td style="padding:4px 8px;">${t.pts}</td>
        <td style="padding:4px 8px; color:${(t.pf-t.pc)>=0?'#10b981':'#ef4444'}; font-weight:bold;">
          ${(t.pf-t.pc)>0?'+':''}${t.pf-t.pc}</td>
        <td style="padding:4px 8px;">${t.pf}</td>
        <td style="padding:4px 8px; ${t.name === mejorSegundo.name ? 'color:#ff6b00; font-weight:bold;' : ''}">
          ${t.name === mejorSegundo.name ? '✅ CLASIFICA' : '❌'}</td>
      </tr>`
    ).join('');

    container.innerHTML += `
      <div style="background:rgba(30,37,48,0.9); padding:15px; border:1px solid #334155; border-radius:10px; margin-top:20px;">
        <h4 style="color:#aaa; margin:0 0 10px 0; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">🥈 Comparativa de 2° lugares — El mejor avanza</h4>
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
        <p style="color:#888; font-size:0.72rem; margin:8px 0 0 0;">Criterios: 1°Puntos · 2°Diferencia · 3°Puntos anotados</p>
      </div>
      <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:20px;">
        <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
        <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">Cruce: 1° vs 4° · 2° vs 3° (por rendimiento general)</p>
        ${ruleApplied ? '<p style="font-size:0.75rem; color:#ff6b00; text-align:center;">🛡️ <em>Regla de Oro aplicada: rivales ajustados para evitar mismo grupo en semis.</em></p>' : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
            <div style="text-align:center;"><strong>${s1?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s4?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>1° general · Gpo ${s1?.groupOrigin?.toUpperCase()||''} · ${s1?.pts||0} pts</span>
              <span>4° general · Gpo ${s4?.groupOrigin?.toUpperCase()||''} · ${s4?.pts||0} pts</span>
            </div>
          </div>
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
            <div style="text-align:center;"><strong>${s2?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s3?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>2° general · Gpo ${s2?.groupOrigin?.toUpperCase()||''} · ${s2?.pts||0} pts</span>
              <span>3° general · Gpo ${s3?.groupOrigin?.toUpperCase()||''} · ${s3?.pts||0} pts</span>
            </div>
          </div>
        </div>
        <p style="text-align:center; color:#888; font-size:0.72rem; margin-top:12px;">🏅 Los ganadores avanzan a la <strong>Gran Final</strong></p>
      </div>`;

  } else if (numGroups >= 4) {
    const calcAvg = (t) => ({
      ...t,
      avgPts: t.jj > 0 ? t.pts / t.jj : 0,
      avgDif: t.jj > 0 ? t.dif / t.jj : 0,
      avgPF:  t.jj > 0 ? t.pf / t.jj : 0
    });

    const sortSeeds = (arr) => arr.map(calcAvg).sort((a, b) =>
      b.avgPts - a.avgPts || b.avgDif - a.avgDif || b.avgPF - a.avgPF
    );

    const clasificados = sortSeeds([...primerosLugares]);
    let [s1, s2, s3, s4] = clasificados;
    let ruleApplied = false;

    for (let tries = 0; tries < 10; tries++) {
      const c1 = s1 && s4 && s1.groupOrigin === s4.groupOrigin;
      const c2 = s2 && s3 && s2.groupOrigin === s3.groupOrigin;
      if (!c1 && !c2) break;
      if (c1 && !c2) { [s3, s4] = [s4, s3]; ruleApplied = true; }
      else if (!c1 && c2) { [s3, s4] = [s4, s3]; ruleApplied = true; }
      else { [s2, s3] = [s3, s2]; ruleApplied = true; }
    }

    container.innerHTML += `
      <div style="background:rgba(255,107,0,0.1); padding:20px; border:2px solid #ff6b00; border-radius:10px; margin-top:30px;">
        <h3 style="margin:0 0 5px 0; color:#ff6b00; text-align:center;">🏆 CRUCES DE SEMIFINALES</h3>
        <p style="text-align:center; color:#aaa; font-size:0.8rem; margin:0 0 15px 0;">Clasifican los 4 primeros lugares · Cruce: 1° vs 4° · 2° vs 3°</p>
        ${ruleApplied ? '<p style="font-size:0.75rem; color:#ff6b00; text-align:center;">🛡️ <em>Regla de Oro aplicada: rivales ajustados para evitar mismo grupo en semis.</em></p>' : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 1</div>
            <div style="text-align:center;"><strong>${s1?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s4?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>1° Gpo ${s1?.groupOrigin?.toUpperCase()||''} · ${s1?.pts||0} pts</span>
              <span>1° Gpo ${s4?.groupOrigin?.toUpperCase()||''} · ${s4?.pts||0} pts</span>
            </div>
          </div>
          <div style="background:#1e2530; padding:12px; border-radius:8px;">
            <div style="font-size:0.7rem; color:#ff6b00; text-transform:uppercase; margin-bottom:6px;">⚔️ Semifinal 2</div>
            <div style="text-align:center;"><strong>${s2?.name||'---'}</strong> <span style="color:#aaa; margin:0 8px;">vs</span> <strong>${s3?.name||'---'}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.72rem; color:#aaa;">
              <span>1° Gpo ${s2?.groupOrigin?.toUpperCase()||''} · ${s2?.pts||0} pts</span>
              <span>1° Gpo ${s3?.groupOrigin?.toUpperCase()||''} · ${s3?.pts||0} pts</span>
            </div>
          </div>
        </div>
        <p style="text-align:center; color:#888; font-size:0.72rem; margin-top:12px;">🏅 Los ganadores avanzan a la <strong>Gran Final</strong></p>
      </div>`;

  } else {
    const allTeams = Object.values(stats);
    allTeams.forEach(t => t.dif = t.pf - t.pc);
    const sorted = sortFibaGroup(allTeams);
    container.innerHTML += `<h3>Liga General: ${categoriesConfig[selectedCat].label}</h3>` + generateTableHtml(sorted);
  }
}

function ensureTeamHistoryBar(container) {
  let bar = document.getElementById('teamHistoryBar');
  if (bar) return bar;

  bar = document.createElement('div');
  bar.id = 'teamHistoryBar';
  bar.style.cssText = 'margin-top:25px; padding:15px; background:#1e2530; border-radius:8px;';
  bar.innerHTML = `
    <label style="font-size:0.8rem; color:#aaa; display:block; margin-bottom:6px;">Ver historial de partidos de un equipo:</label>
    <select id="teamHistorySelect" onchange="renderTeamMatchHistory(this.value)"
      style="width:100%; padding:8px 12px; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff; box-sizing:border-box;">
      <option value="">-- Selecciona un equipo --</option>
    </select>
    <div id="teamHistoryResult" style="margin-top:15px;"></div>`;

  container.parentNode.insertBefore(bar, container.nextSibling);
  return bar;
}

function populateTeamHistorySelect(selectedCat) {
  const select = document.getElementById('teamHistorySelect');
  if (!select) return;

  const prevVal = select.value;

  const teams = Object.entries(globalTeams)
    .filter(([_, t]) => t && t.categoryRegistered === selectedCat)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  select.innerHTML = '<option value="">-- Selecciona un equipo --</option>';
  teams.forEach(([id, t]) => {
    select.innerHTML += `<option value="${id}">${t.name}</option>`;
  });

  if (prevVal && globalTeams[prevVal] && globalTeams[prevVal].categoryRegistered === selectedCat) {
    select.value = prevVal;
  }

  renderTeamMatchHistory(select.value);
}
window.populateTeamHistorySelect = populateTeamHistorySelect;

function renderTeamMatchHistory(teamId) {
  const resultDiv = document.getElementById('teamHistoryResult');
  if (!resultDiv) return;

  if (!teamId || !globalTeams[teamId]) {
    resultDiv.innerHTML = '';
    return;
  }

  const team = globalTeams[teamId];
  const teamMatches = Object.entries(globalMatches)
    .filter(([_, m]) => m && (m.localId === teamId || m.visitorId === teamId))
    .sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));

  if (teamMatches.length === 0) {
    resultDiv.innerHTML = `<p style="color:#888; font-style:italic; padding:10px;">${team.name} no tiene partidos registrados todavía.</p>`;
    return;
  }

  let wins = 0, losses = 0, played = 0;

  const rows = teamMatches.map(([mId, m]) => {
    const isLocal     = m.localId === teamId;
    const rivalName   = isLocal ? m.visitorName : m.localName;
    const ownScore    = isLocal ? m.localScore   : m.visitorScore;
    const rivalScore  = isLocal ? m.visitorScore : m.localScore;

    let resultBadge = 'Pendiente';
    let resultColor = '#888';
    let scoreText   = 'vs';

    if (ownScore !== undefined) {
      played++;
      scoreText = `${ownScore} - ${rivalScore}`;
      if (ownScore > rivalScore) { wins++;   resultBadge = 'Ganado';  resultColor = '#10b981'; }
      else                       { losses++; resultBadge = 'Perdido'; resultColor = '#ef4444'; }
    }

    const stageLabel = m.stage ? m.stage.toUpperCase() : 'REGULAR';
    const venueName  = globalVenues[m.venueId]?.name || '---';

    return `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:8px; text-align:left;">${m.date || '?'}</td>
        <td style="padding:8px; text-align:left;">${isLocal ? 'Local' : 'Visita'} vs <strong>${rivalName}</strong></td>
        <td style="padding:8px; text-align:center;">${scoreText}</td>
        <td style="padding:8px; text-align:center;"><span style="color:${resultColor}; font-weight:bold;">${resultBadge}</span></td>
        <td style="padding:8px; text-align:center; font-size:0.7rem; color:#aaa;">${stageLabel}</td>
        <td style="padding:8px; text-align:center; font-size:0.7rem; color:#aaa;">${venueName}</td>
      </tr>`;
  }).join('');

  resultDiv.innerHTML = `
    <h4 style="margin:0 0 10px 0; color:#ff6b00;">Historial de ${team.name}
      <span style="font-size:0.75rem; color:#aaa; font-weight:normal;">(${played} jugados · ${wins}G - ${losses}P)</span>
    </h4>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; background:#111; color:#fff;">
        <thead>
          <tr style="background:#222; color:#ff6b00;">
            <th style="padding:8px; text-align:left;">Fecha</th>
            <th style="padding:8px; text-align:left;">Partido</th>
            <th style="padding:8px;">Marcador</th>
            <th style="padding:8px;">Resultado</th>
            <th style="padding:8px;">Etapa</th>
            <th style="padding:8px;">Sede</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
window.renderTeamMatchHistory = renderTeamMatchHistory;

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

// ✅ NUEVO: muestra el nombre del archivo y vista previa del logo del equipo al seleccionarlo
function previewTeamLogo(input) {
  const fileNameSpan = document.getElementById('regTeamLogoFileName');
  const previewBox   = document.getElementById('regTeamLogoPreviewBox');
  const previewImg   = document.getElementById('regTeamLogoPreview');
  const file = input.files?.[0];

  if (!file) {
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    alert('❌ Solo se permite JPG o PNG.');
    input.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewTeamLogo = previewTeamLogo;

// ✅ ACTUALIZADO: ahora es async y sube el logo como archivo (PNG/JPG) en vez de leer una URL de texto
async function handleTeamSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return;
  const name               = document.getElementById('regTeamName').value.trim();
  const categoryRegistered = document.getElementById('regTeamCategory').value;

  const logoInput = document.getElementById('regTeamLogo');
  const logoFile  = logoInput?.files?.[0];

  let logoUrl = "";
  if (logoFile) {
    try {
      logoUrl = await resizeAndEncodeImage(logoFile, 300, 0.8);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  const groupInput         = prompt("Asigna un Grupo (Ej: A, B o vacío):", "");
  const groupAssigned      = groupInput ? groupInput.trim().toLowerCase() : "";
  push(ref(db, `tournaments/${currentTournamentId}/teams`), { name, logoUrl, categoryRegistered, groupAssigned })
    .then(() => {
      alert("Equipo registrado.");
      document.getElementById('teamForm').reset();
      const previewBox = document.getElementById('regTeamLogoPreviewBox');
      const fileNameSpan = document.getElementById('regTeamLogoFileName');
      if (previewBox) previewBox.style.display = 'none';
      if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
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
    status:   "active",
    isPublic: false   // nace bloqueada; el admin la publica cuando esté lista
  }).then(() => {
    alert("¡Competencia creada! Está BLOQUEADA por defecto.\nPublícala desde 'Mis Competencias' cuando esté lista.");
    document.getElementById('eventForm').reset();
    // Refrescar la lista en el Panel Master
    if (typeof renderMasterScreenCompetencias === 'function') renderMasterScreenCompetencias();
  });
}

// ============================================
// PATROCINADORES
// ============================================
let sponsorInterval      = null;
let currentSponsorIndex  = 0;
let activeSponsors       = [];

// ✅ NUEVO: vista previa del logo del patrocinador al seleccionarlo
function previewSponsorLogo(input) {
  const fileNameSpan = document.getElementById('sponsorLogoFileName');
  const previewBox   = document.getElementById('sponsorLogoPreviewBox');
  const previewImg   = document.getElementById('sponsorLogoPreview');
  const file = input.files?.[0];

  if (!file) {
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    alert('❌ Solo se permite JPG o PNG.');
    input.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewSponsorLogo = previewSponsorLogo;

// ✅ ACTUALIZADO: ahora sube el logo como archivo (PNG/JPG) en vez de leer una URL de texto
async function handleSponsorSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("Selecciona un torneo.");

  const logoInput = document.getElementById('sponsorLogo');
  const logoFile  = logoInput?.files?.[0];
  if (!logoFile) return alert("Selecciona un logo para el patrocinador.");

  let logoUrl;
  try {
    logoUrl = await resizeAndEncodeImage(logoFile, 300, 0.8);
  } catch (err) {
    return alert("❌ " + err.message);
  }

  const data = {
    name: document.getElementById('sponsorName').value.trim(),
    logo: logoUrl,
    link: document.getElementById('sponsorLink').value.trim()
  };
  push(ref(db, `tournaments/${currentTournamentId}/sponsors`), data).then(() => {
    alert("✅ Patrocinador añadido.");
    e.target.reset();
    const previewBox = document.getElementById('sponsorLogoPreviewBox');
    const fileNameSpan = document.getElementById('sponsorLogoFileName');
    if (previewBox) previewBox.style.display = 'none';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
  });
}

function startSponsorRotation(sponsorsData) {
  activeSponsors = Object.entries(sponsorsData || {}).map(([id, s]) => ({ ...s, id }));
  if (sponsorInterval) clearInterval(sponsorInterval); // ya no se usa pero se limpia por si acaso

  const track = document.getElementById('sponsor-display');
  if (!track) return;

  if (activeSponsors.length === 0) {
    track.innerHTML = '';
    track.classList.add('single-sponsor');
    track.style.animation = 'none';
    return;
  }

  // Construir las tarjetas
  const buildCard = (s) => `
    <a class="sponsor-card" href="${s.link || '#'}" target="_blank" rel="noopener">
      <img src="${s.logo}" alt="${s.name}" loading="lazy">
      <span class="sponsor-name">${s.name || ''}</span>
    </a>`;

  if (activeSponsors.length === 1) {
    // Solo 1 patrocinador: centrado, sin animación
    track.classList.add('single-sponsor');
    track.innerHTML = buildCard(activeSponsors[0]);
  } else {
    // Varios: duplicar para loop infinito sin salto
    track.classList.remove('single-sponsor');
    const cardsHTML = activeSponsors.map(buildCard).join('<div class="sponsor-divider"></div>');
    // Duplicar el contenido para que el scroll sea seamless
    track.innerHTML = cardsHTML + '<div class="sponsor-divider"></div>' + cardsHTML;

    // Ajustar velocidad según cantidad de sponsors (más sponsors = más lento)
    const duration = Math.max(18, activeSponsors.length * 6);
    track.style.animationDuration = duration + 's';
  }
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
  Object.entries(globalTeams)
    .filter(([_, t]) => t && t.name)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([id, t]) => {
      select.innerHTML += `<option value="${id}">${t.name} — ${categoriesConfig[t.categoryRegistered]?.label || t.categoryRegistered}</option>`;
    });
}

// ✅ NUEVO: vista previa del nuevo logo elegido en el formulario de edición
function previewEditTeamLogo(input) {
  const fileNameSpan = document.getElementById('editTeamLogoFileName');
  const previewBox   = document.getElementById('editTeamLogoPreviewBox');
  const previewImg   = document.getElementById('editTeamLogoPreview');
  const file = input.files?.[0];

  if (!file) return; // conserva la vista previa del logo actual

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    alert('❌ Solo se permite JPG o PNG.');
    input.value = '';
    return;
  }

  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewEditTeamLogo = previewEditTeamLogo;

function handleSelectEditTeamChange(e) {
  const teamId = e.target.value;
  if (!teamId || !globalTeams[teamId]) return;
  const team = globalTeams[teamId];
  document.getElementById('editTeamName').value     = team.name               || '';
  document.getElementById('editTeamCategory').value = team.categoryRegistered || '';
  document.getElementById('editTeamGroup').value    = team.groupAssigned      || '';

  const fileInput         = document.getElementById('editTeamLogo');
  const currentLogoInput  = document.getElementById('editTeamLogoCurrent');
  const previewImg        = document.getElementById('editTeamLogoPreview');
  const previewBox        = document.getElementById('editTeamLogoPreviewBox');
  const fileNameSpan      = document.getElementById('editTeamLogoFileName');

  if (fileInput) fileInput.value = '';
  if (currentLogoInput) currentLogoInput.value = team.logoUrl || '';

  if (team.logoUrl && previewImg && previewBox) {
    previewImg.src = team.logoUrl;
    previewBox.style.display = 'block';
    if (fileNameSpan) fileNameSpan.textContent = 'Logo actual (sube uno nuevo para reemplazar)';
  } else {
    if (previewBox) previewBox.style.display = 'none';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
  }
}

// ✅ ACTUALIZADO: ahora sube el logo como archivo (PNG/JPG); si no se elige uno nuevo, conserva el actual
async function handleEditTeamSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('selectEditTeam').value;
  if (!id) return alert("Selecciona un equipo.");
  const groupInput = document.getElementById('editTeamGroup').value.trim().toLowerCase();

  const logoInput        = document.getElementById('editTeamLogo');
  const logoFile         = logoInput?.files?.[0];
  const currentLogoInput = document.getElementById('editTeamLogoCurrent');
  let logoUrl = currentLogoInput ? currentLogoInput.value : '';

  if (logoFile) {
    try {
      logoUrl = await resizeAndEncodeImage(logoFile, 300, 0.8);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  update(ref(db, `tournaments/${currentTournamentId}/teams/${id}`), {
    name:               document.getElementById('editTeamName').value.trim(),
    categoryRegistered: document.getElementById('editTeamCategory').value,
    groupAssigned:      groupInput,
    logoUrl:            logoUrl
  }).then(() => {
    alert("¡Equipo actualizado correctamente!");
    document.getElementById('editTeamForm').reset();
    const previewBox = document.getElementById('editTeamLogoPreviewBox');
    if (previewBox) previewBox.style.display = 'none';
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

  Object.entries(globalMatches)
    .filter(([_, m]) => m)
    .sort(([_, a], [__, b]) => (b.date || '').localeCompare(a.date || ''))
    .forEach(([id, m]) => {
      const statusIcon = m.localScore !== undefined ? '✅' : '⏳';
      select.innerHTML += `<option value="${id}">${statusIcon} ${m.date || '?'} | ${m.localName} VS ${m.visitorName}</option>`;
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

// ============================================
// CARGA RÁPIDA DE MARCADOR
// ============================================
function setQuickScore(matchId) {
  const m = globalMatches[matchId];
  if (!m) return;

  const scoreL = prompt(`Puntos para LOCAL: ${m.localName}`, m.localScore !== undefined ? m.localScore : "");
  if (scoreL === null) return;

  const scoreV = prompt(`Puntos para VISITA: ${m.visitorName}`, m.visitorScore !== undefined ? m.visitorScore : "");
  if (scoreV === null) return;

  update(ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`), {
    localScore: parseInt(scoreL),
    visitorScore: parseInt(scoreV)
  }).then(() => {
    console.log("Score actualizado");
  }).catch(err => alert("Error al guardar: " + err));
}
window.setQuickScore = setQuickScore;

// ============================================
// GESTIÓN DE JUGADORES
// ============================================

function populateTeamForPlayerDropdown() {
  const select = document.getElementById('selectTeamForPlayer');
  if (!select) return;

  const prevVal = select.value;

  const teamsSorted = Object.entries(globalTeams)
    .filter(([_, t]) => t && t.name)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  select.innerHTML = '<option value="">-- Selecciona un Equipo --</option>';
  teamsSorted.forEach(([id, t]) => {
    const catLabel = categoriesConfig[t.categoryRegistered]?.label || t.categoryRegistered || '';
    const playerCount = t.players ? Object.keys(t.players).length : 0;
    select.innerHTML += `<option value="${id}">${t.name} — ${catLabel} (${playerCount} jugadores)</option>`;
  });

  if (prevVal && globalTeams[prevVal]) {
    select.value = prevVal;
    renderAdminPlayerList(prevVal);
  }
}
window.populateTeamForPlayerDropdown = populateTeamForPlayerDropdown;

function generateUniquePlayerID() {
  const existingIDs = new Set();
  Object.values(globalTeams).forEach(t => {
    if (t && t.players) {
      Object.values(t.players).forEach(p => { if (p?.playerID) existingIDs.add(p.playerID); });
    }
  });

  let candidate;
  let attempts = 0;
  do {
    candidate = "DBE-" + Math.floor(1000 + Math.random() * 9000);
    attempts++;
  } while (existingIDs.has(candidate) && attempts < 50);

  if (existingIDs.has(candidate)) {
    candidate = "DBE-" + Date.now().toString().slice(-6);
  }
  return candidate;
}

// ✅ NUEVO: convierte y comprime la foto del jugador (PNG o JPG) a base64,
// lista para guardar directo en Firebase sin necesidad de servicios externos
function resizeAndEncodeImage(file, maxWidth = 400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      return reject(new Error('Formato no válido. Solo se permite PNG o JPG.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// ✅ NUEVO: muestra el nombre del archivo y una vista previa de la foto al seleccionarla
function previewPlayerPhoto(input) {
  const fileNameSpan = document.getElementById('playerPhotoFileName');
  const previewBox   = document.getElementById('playerPhotoPreviewBox');
  const previewImg   = document.getElementById('playerPhotoPreview');
  const file = input.files?.[0];

  if (!file) {
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    alert('❌ Solo se permite JPG o PNG.');
    input.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewPlayerPhoto = previewPlayerPhoto;

// ✅ ACTUALIZADO: ahora es async y sube el archivo (PNG/JPG) en vez de leer una URL de texto
async function handlePlayerSubmit(e) {
  e.preventDefault();
  const teamId = document.getElementById('selectTeamForPlayer').value;
  if (!teamId) return alert("Selecciona un equipo.");

  const uniqueID = generateUniquePlayerID();

  const photoInput = document.getElementById('playerPhoto');
  const photoFile  = photoInput?.files?.[0];

  let photoDataUrl = "https://via.placeholder.com/150";
  if (photoFile) {
    try {
      photoDataUrl = await resizeAndEncodeImage(photoFile, 400, 0.75);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  const playerData = {
    playerID: uniqueID,
    name: document.getElementById('playerName').value.trim(),
    photo: photoDataUrl,
    curp: document.getElementById('playerCurp').value.toUpperCase(),
    birth: document.getElementById('playerBirth').value,
    number: document.getElementById('playerNumber').value,
    bloodType: document.getElementById('playerBlood').value,
    responsibleName: document.getElementById('playerRespName').value.trim(),
    responsiblePhone: document.getElementById('playerRespPhone').value.trim(),
    timestamp: new Date().toISOString()
  };

  const playerRef = ref(db, `tournaments/${currentTournamentId}/teams/${teamId}/players`);
  
  push(playerRef, playerData).then(() => {
    alert(`✅ Atleta registrado con éxito.\nID Generado: ${uniqueID}`);
    e.target.reset();

    const teamSelect = document.getElementById('selectTeamForPlayer');
    if (teamSelect) teamSelect.value = teamId;

    populateTeamForPlayerDropdown();
    renderAdminPlayerList(teamId);
  });
}

let playerSearchTerms = {};

function filterPlayerList(teamId, term) {
  playerSearchTerms[teamId] = term;
  renderAdminPlayerList(teamId);
}
window.filterPlayerList = filterPlayerList;

function renderAdminPlayerList(teamId) {
  const container = document.getElementById('admin-player-list');
  if (!container || !teamId) return;

  const team = globalTeams[teamId];
  if (!team || !team.players) {
    container.innerHTML = `<h4>Roster de ${team?.name || ''}</h4><p>Sin jugadores.</p>`;
    return;
  }

  const activeEl   = document.activeElement;
  const wasFocused = activeEl && activeEl.id === 'playerSearchInput';
  const cursorPos  = wasFocused ? activeEl.selectionStart : null;

  const searchVal = playerSearchTerms[teamId] || '';
  const totalCount = Object.keys(team.players).length;

  let players = Object.entries(team.players)
    .sort((a, b) => (parseInt(a[1].number) || 0) - (parseInt(b[1].number) || 0));

  if (searchVal) {
    const term = searchVal.toLowerCase();
    players = players.filter(([_, p]) =>
      (p.name || '').toLowerCase().includes(term) || String(p.number || '').includes(term)
    );
  }

  let html = `<h4>Roster de ${team.name} <span style="font-size:0.75rem; color:#aaa; font-weight:normal;">(${players.length}/${totalCount})</span></h4>
    <input type="text" id="playerSearchInput" placeholder="🔍 Buscar por nombre o número..." value="${searchVal}"
      oninput="filterPlayerList('${teamId}', this.value)"
      style="width:100%; padding:8px 12px; margin:8px 0 12px 0; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff; box-sizing:border-box;">
    <div style="overflow-x:auto;">
    <table style="width:100%; font-size:0.75rem; border-collapse:collapse; background:#111; color:white;">
      <thead>
        <tr style="background:#222; color:#ff6b00;">
          <th>Foto</th><th>ID / #</th><th>Nombre / CURP</th><th>Médico</th><th>Responsable</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>`;

  if (players.length === 0) {
    html += `<tr><td colspan="6" style="text-align:center; padding:15px; color:#888; font-style:italic;">No se encontraron jugadores.</td></tr>`;
  }

  players.forEach(([playerId, p]) => {
    html += `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:5px;"><img src="${p.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
        <td style="text-align:center;"><strong>${p.playerID}</strong><br>#${p.number}</td>
        <td style="padding:5px;">${p.name}<br><small style="color:gray;">${p.curp}</small></td>
        <td style="text-align:center;">🩸 ${p.bloodType}<br>${p.birth}</td>
        <td style="padding:5px;">${p.responsibleName}<br>📞 ${p.responsiblePhone}</td>
        <td style="text-align:center; white-space:nowrap;">
          ${currentUserRole === 'admin' ? `<button onclick="printPlayerID('${teamId}', '${playerId}')" title="Imprimir Credencial" style="background:#10b981; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer; margin-right:5px;">🪪</button>` : ''}
          <button onclick="loadPlayerForUnifiedEdit('team', '${teamId}', '${playerId}')" title="Editar" style="background:#334155; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer; margin-right:5px;">✏️</button>
          <button onclick="deletePlayer('${teamId}', '${playerId}')" title="Borrar" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  if (wasFocused) {
    const input = document.getElementById('playerSearchInput');
    if (input) { input.focus(); input.setSelectionRange(cursorPos, cursorPos); }
  }
}

function deletePlayer(teamId, playerId) {
  if (confirm("¿Eliminar a este jugador del equipo?")) {
    remove(ref(db, `tournaments/${currentTournamentId}/teams/${teamId}/players/${playerId}`))
      .then(() => renderAdminPlayerList(teamId));
  }
}
window.deletePlayer = deletePlayer;

// ============================================
// GENERADOR DE CREDENCIAL DE JUGADOR
// ============================================
const LOGO_FRENTE_URL = "https://i.ibb.co/HfNNZLQC/image-removebg-preview-2.png";
const LOGO_REVERSO_URL = "https://i.ibb.co/sdLhmNCC/image-removebg-preview-1.png";

function calcularVigencia(timestampISO) {
  const emision = timestampISO ? new Date(timestampISO) : new Date();
  const vigencia = new Date(emision);
  vigencia.setFullYear(vigencia.getFullYear() + 1);
  const dd = String(vigencia.getDate()).padStart(2, '0');
  const mm = String(vigencia.getMonth() + 1).padStart(2, '0');
  const yyyy = vigencia.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ✅ REFACTOR: la plantilla visual de la credencial ahora vive en una sola función
// compartida, así sirve tanto para jugadores ligados a un equipo/torneo como para
// atletas del registro independiente (sin competencia).
// ✅ REFACTOR: CSS de la credencial extraído a una constante compartida,
// así se puede inyectar tanto en la ventana de impresión individual como
// en el área oculta usada para la exportación masiva en ZIP.


// Credencial para jugadores ligados a un equipo dentro de un torneo (flujo original)
function printPlayerID(teamId, playerId) {
  const team = globalTeams[teamId];
  const p = team.players[playerId];
  if (!p) return;

  const rawCat2 = categoriesConfig[team.categoryRegistered]?.label || team.categoryRegistered || '---';
  const categoryLabel = rawCat2.replace(/[^\u0000-\u00FF ]/g, '').trim() || rawCat2;

  openCredentialWindow({
    name: p.name,
    club: team.name,
    categoryLabel,
    photo: p.photo,
    playerID: p.playerID,
    vigenciaTexto: calcularVigencia(p.timestamp),
    curp: p.curp,
    birth: p.birth,
    bloodType: p.bloodType,
    responsibleName: p.responsibleName,
    responsiblePhone: p.responsiblePhone,
    number: p.number
  });
}
window.printPlayerID = printPlayerID;

// ============================================
// REGISTRO INDEPENDIENTE DE ATLETAS (SIN COMPETENCIA)
// ============================================
// Estos atletas viven en la raíz de Firebase bajo "athletes", totalmente
// desligados de cualquier torneo/equipo — sirve para expedir credenciales
// aunque todavía no exista una competencia activa.
let globalAthletes = {};
// globalAllTeams ya se declara al inicio del archivo (movido para evitar hoisting issues)
let standaloneSearchTerm = '';

function initGlobalAthletesObserver() {
  if (currentUserRole === 'coach' && currentUserUid) {
    // Coach: solo lee SUS propios atletas (filtra por createdBy en Firebase)
    const coachQuery = query(
      ref(db, 'athletes'),
      orderByChild('createdBy'),
      equalTo(currentUserUid)
    );
    onValue(coachQuery, (snapshot) => {
      globalAthletes = snapshot.val() || {};
      renderStandaloneAthleteList();
      renderPlayerRegistry();
    }, (err) => {
      console.warn('Coach: error leyendo atletas filtrados:', err.message);
      // Fallback: leer todos y filtrar en cliente
      onValue(ref(db, 'athletes'), (snapshot) => {
        const all = snapshot.val() || {};
        globalAthletes = {};
        Object.entries(all).forEach(([k, v]) => {
          if (v && v.createdBy === currentUserUid) globalAthletes[k] = v;
        });
        renderStandaloneAthleteList();
        renderPlayerRegistry();
      });
    });
  } else {
    // Admin: lee todos
    onValue(ref(db, 'athletes'), (snapshot) => {
      globalAthletes = snapshot.val() || {};
      renderStandaloneAthleteList();
      renderPlayerRegistry();
    });
  }
}

// ============================================
// GESTIÓN DE ENTRENADORES (ROL "coach")
// ============================================
// Solo el administrador ve/usa esto. Un entrenador creado aquí:
//  - Puede iniciar sesión y llegar únicamente al registro de atletas.
//  - Solo puede registrar/editar/borrar los atletas que él mismo dio de alta.
//  - Nunca ve ni toca torneos, sedes, equipos, partidos o marcadores.
function initRolesObserver() {
  onValue(ref(db, 'roles'), (snapshot) => {
    globalRoles = snapshot.val() || {};
    renderCoachesList();
  });
}

// Crea la cuenta de acceso (Firebase Auth) usando una app secundaria temporal,
// así el administrador que está creando al entrenador NO pierde su propia sesión.
async function createCoachAuthAccount(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, 'CoachCreator_' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

async function handleCreateCoachSubmit(e) {
  e.preventDefault();
  const name     = document.getElementById('coachName').value.trim();
  const email    = document.getElementById('coachEmail').value.trim();
  const password = document.getElementById('coachPassword').value;

  if (password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");

  try {
    const uid = await createCoachAuthAccount(email, password);
    await set(ref(db, `roles/${uid}`), { role: 'coach', name, email, active: true });
    alert(`✅ Entrenador "${name}" creado. Ya puede iniciar sesión con su correo y contraseña.`);
    document.getElementById('coachForm').reset();
  } catch (err) {
    console.error(err);
    alert("❌ No se pudo crear el entrenador: " + err.message);
  }
}
window.handleCreateCoachSubmit = handleCreateCoachSubmit;

function renderCoachesList() {
  const container = document.getElementById('admin-coach-list');
  if (!container) return;

  const coaches = Object.entries(globalRoles).filter(([_, r]) => r?.role === 'coach');

  if (coaches.length === 0) {
    container.innerHTML = `<p style="color:#888; font-style:italic;">Aún no has registrado entrenadores.</p>`;
    return;
  }

  let html = `<table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
    <thead><tr style="color:#ff6b00;"><th style="text-align:left;">Nombre</th><th style="text-align:left;">Correo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;

  coaches.forEach(([uid, r]) => {
    const isActive = r.active !== false;
    html += `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:5px;">${r.name || '---'}</td>
        <td style="padding:5px;">${r.email || '---'}</td>
        <td style="text-align:center;">${isActive ? '<span style="color:#10b981;">🟢 Activo</span>' : '<span style="color:#ef4444;">🔴 Desactivado</span>'}</td>
        <td style="text-align:center;">
          <button onclick="toggleCoachActive('${uid}', ${!isActive})" style="background:${isActive ? '#ef4444' : '#10b981'}; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
            ${isActive ? 'Desactivar' : 'Reactivar'}
          </button>
        </td>
      </tr>`;
  });

  html += `</tbody></table>
    <p style="color:#888; font-size:0.7rem; margin-top:8px;">
      ℹ️ Desactivar bloquea su acceso a la app de inmediato. No borra los atletas que ya haya registrado.
    </p>`;
  container.innerHTML = html;
}

function toggleCoachActive(uid, newState) {
  update(ref(db, `roles/${uid}`), { active: newState }).then(() => {
    alert(newState ? "✅ Entrenador reactivado." : "🚫 Entrenador desactivado.");
  });
}
window.toggleCoachActive = toggleCoachActive;

function goToStandaloneAthletes() {
  document.getElementById('competition-selector-screen').style.display = 'none';
  document.getElementById('athletes-standalone-screen').style.display = 'block';
  const titleEl = document.getElementById('standaloneScreenTitle');
  if (titleEl) titleEl.innerText = currentUserRole === 'admin' ? '🪪 Registro y Credenciales de Atletas' : '📋 Registro de Mis Jugadores';
  populateStandaloneCategoryDropdown();
  renderStandaloneAthleteList();
}
window.goToStandaloneAthletes = goToStandaloneAthletes;

function backToSelectorFromAthletes() {
  document.getElementById('athletes-standalone-screen').style.display = 'none';
  document.getElementById('competition-selector-screen').style.display = 'flex';
}
window.backToSelectorFromAthletes = backToSelectorFromAthletes;

function populateStandaloneCategoryDropdown() {
  const catOptions = Object.entries(categoriesConfig)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  const sel = document.getElementById('standalonePlayerCategory');
  if (sel) sel.innerHTML = catOptions;

  // ✅ el mismo listado de categorías alimenta también el formulario de edición
  const editSel = document.getElementById('editStandaloneCategory');
  if (editSel) editSel.innerHTML = catOptions;

  // ✅ y también el editor unificado del administrador
  const editUnifiedSel = document.getElementById('editUnifiedCategory');
  if (editUnifiedSel) editUnifiedSel.innerHTML = catOptions;
}

function generateUniqueAthleteID() {
  const existingIDs = new Set();
  Object.values(globalAthletes).forEach(p => { if (p?.playerID) existingIDs.add(p.playerID); });
  Object.values(globalTeams).forEach(t => {
    if (t && t.players) Object.values(t.players).forEach(p => { if (p?.playerID) existingIDs.add(p.playerID); });
  });

  let candidate;
  let attempts = 0;
  do {
    candidate = "DBE-" + Math.floor(1000 + Math.random() * 9000);
    attempts++;
  } while (existingIDs.has(candidate) && attempts < 50);

  if (existingIDs.has(candidate)) candidate = "DBE-" + Date.now().toString().slice(-6);
  return candidate;
}

// ✅ Vista previa de foto para el formulario independiente (IDs propios, no choca con el de equipos)
function previewStandalonePlayerPhoto(input) {
  const fileNameSpan = document.getElementById('standalonePlayerPhotoFileName');
  const previewBox   = document.getElementById('standalonePlayerPhotoPreviewBox');
  const previewImg   = document.getElementById('standalonePlayerPhotoPreview');
  const file = input.files?.[0];

  if (!file) {
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    alert('❌ Solo se permite JPG o PNG.');
    input.value = '';
    if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
    if (previewBox) previewBox.style.display = 'none';
    return;
  }

  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewStandalonePlayerPhoto = previewStandalonePlayerPhoto;

function toggleStandaloneTipo(tipo) {
  document.getElementById('standalonePersonType').value = tipo;

  const btnAtleta      = document.getElementById('btnTipoAtleta');
  const btnEntrenador  = document.getElementById('btnTipoEntrenador');
  const atletaFields   = document.getElementById('standaloneAtletaFields');
  const entrenadorFields = document.getElementById('standaloneEntrenadorFields');
  const title          = document.getElementById('standaloneFormTitle');
  const submitBtn      = document.getElementById('standaloneSubmitBtn');
  const nameLabel      = document.getElementById('standaloneNameLabel');

  if (tipo === 'entrenador') {
    // Activar tab entrenador
    btnEntrenador.style.border     = '2px solid #10b981';
    btnEntrenador.style.background = '#10b981';
    btnEntrenador.style.color      = '#fff';
    btnAtleta.style.border         = '2px solid #334155';
    btnAtleta.style.background     = 'transparent';
    btnAtleta.style.color          = '#94a3b8';
    atletaFields.style.display     = 'none';
    entrenadorFields.style.display = 'block';
    title.textContent              = '👨‍🏫 Registrar Entrenador';
    submitBtn.textContent          = '💾 Registrar Entrenador y Generar ID';
    nameLabel.textContent          = 'Nombre Completo del Entrenador:';
    document.getElementById('standalonePlayerName').placeholder = 'Nombre del entrenador';
    // Poblar dropdown de categorías para entrenador
    const sel = document.getElementById('standaloneCoachCategory');
    if (sel && sel.options.length === 0) {
      sel.innerHTML = '<option value="">— Todas —</option>';
      Object.entries(categoriesConfig).forEach(([k,v]) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = v.label;
        sel.appendChild(o);
      });
    }
  } else {
    // Activar tab atleta
    btnAtleta.style.border         = '2px solid #ff6b00';
    btnAtleta.style.background     = '#ff6b00';
    btnAtleta.style.color          = '#fff';
    btnEntrenador.style.border     = '2px solid #334155';
    btnEntrenador.style.background = 'transparent';
    btnEntrenador.style.color      = '#94a3b8';
    atletaFields.style.display     = 'block';
    entrenadorFields.style.display = 'none';
    title.textContent              = '🏃 Registrar Nuevo Atleta';
    submitBtn.textContent          = '💾 Registrar Atleta y Generar ID';
    nameLabel.textContent          = 'Nombre Completo:';
    document.getElementById('standalonePlayerName').placeholder = 'Nombre del niño/joven';
  }
}
window.toggleStandaloneTipo = toggleStandaloneTipo;

async function handleStandalonePlayerSubmit(e) {
  e.preventDefault();

  const tipo = document.getElementById('standalonePersonType').value || 'atleta';
  const uniqueID = generateUniqueAthleteID();

  const photoInput = document.getElementById('standalonePlayerPhoto');
  const photoFile  = photoInput?.files?.[0];

  let photoDataUrl = "https://via.placeholder.com/150";
  if (photoFile) {
    try {
      photoDataUrl = await resizeAndEncodeImage(photoFile, 400, 0.75);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  let personData = {
    playerID: uniqueID,
    personType: tipo,
    name: document.getElementById('standalonePlayerName').value.trim(),
    photo: photoDataUrl,
    curp: (document.getElementById('standalonePlayerCurp').value || '').toUpperCase(),
    birth: document.getElementById('standalonePlayerBirth').value || '',
    phone: document.getElementById('standalonePlayerRespPhone').value.trim(),
    email: document.getElementById('standalonePlayerEmail').value.trim(),
    timestamp: new Date().toISOString(),
    createdBy: currentUserUid,
    createdByName: currentUserName
  };

  if (tipo === 'atleta') {
    personData.club            = document.getElementById('standalonePlayerClub').value.trim();
    personData.category        = document.getElementById('standalonePlayerCategory').value;
    personData.number          = document.getElementById('standalonePlayerNumber').value;
    personData.bloodType       = document.getElementById('standalonePlayerBlood').value;
    personData.responsibleName = document.getElementById('standalonePlayerRespName').value.trim();
    personData.responsiblePhone = document.getElementById('standalonePlayerRespPhone').value.trim();
  } else {
    // entrenador
    personData.club     = document.getElementById('standaloneCoachClub').value.trim();
    personData.category = document.getElementById('standaloneCoachCategory').value;
  }

  // Verificar que hay sesión activa antes de intentar escribir
  if (!currentUserUid) {
    return alert('❌ No hay sesión activa. Por favor inicia sesión primero.');
  }

  console.log('📤 Intentando guardar en /athletes — UID:', currentUserUid, '| Rol:', currentUserRole);

  push(ref(db, 'athletes'), personData)
    .then(() => {
      const label = tipo === 'entrenador' ? 'Entrenador' : 'Atleta';
      alert(`✅ ${label} registrado con éxito.\nID Generado: ${uniqueID}`);
      e.target.reset();
      // Reset foto preview
      const previewBox = document.getElementById('standalonePlayerPhotoPreviewBox');
      const fileNameSpan = document.getElementById('standalonePlayerPhotoFileName');
      if (previewBox) previewBox.style.display = 'none';
      if (fileNameSpan) fileNameSpan.textContent = 'Ningún archivo seleccionado';
      // Volver al tab atleta por defecto
      toggleStandaloneTipo('atleta');
    })
    .catch((err) => {
      console.error('❌ Firebase rechazó la escritura:', err.code, err.message);
      if (err.code === 'PERMISSION_DENIED') {
        alert('❌ Sin permiso para guardar.\n\nRevisa las reglas de Firebase:\n- El admin debe tener acceso total\n- El coach debe estar activo\n\nError: ' + err.message);
      } else {
        alert('❌ Error al guardar: ' + err.message);
      }
    });
}
window.handleStandalonePlayerSubmit = handleStandalonePlayerSubmit;

function filterStandaloneAthletes(term) {
  standaloneSearchTerm = term;
  renderStandaloneAthleteList();
}
window.filterStandaloneAthletes = filterStandaloneAthletes;

// ✅ NUEVO: un entrenador solo puede modificar/borrar los atletas que él mismo registró
function canModifyAthlete(athleteId) {
  if (currentUserRole !== 'coach') return true; // el admin puede con todo
  const p = globalAthletes[athleteId];
  return !!p && p.createdBy === currentUserUid;
}

function renderStandaloneAthleteList() {
  const container = document.getElementById('standalone-athlete-list');
  if (!container) return;

  const activeEl   = document.activeElement;
  const wasFocused = activeEl && activeEl.id === 'standaloneSearchInput';
  const cursorPos  = wasFocused ? activeEl.selectionStart : null;

  let allEntries = Object.entries(globalAthletes)
    .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));

  // Coach solo ve los suyos
  if (currentUserRole === 'coach') {
    allEntries = allEntries.filter(([_, p]) => p.createdBy === currentUserUid);
  }

  // Separar atletas y entrenadores
  let athletes  = allEntries.filter(([_, p]) => p.personType !== 'entrenador');
  let coaches   = allEntries.filter(([_, p]) => p.personType === 'entrenador');

  const totalAthletes = athletes.length;
  const totalCoaches  = coaches.length;

  // Aplicar búsqueda a ambos grupos
  if (standaloneSearchTerm) {
    const term = standaloneSearchTerm.toLowerCase();
    const match = ([_, p]) =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.club || '').toLowerCase().includes(term) ||
      String(p.playerID || '').toLowerCase().includes(term);
    athletes = athletes.filter(match);
    coaches  = coaches.filter(match);
  }

  const showOwnerCol = currentUserRole !== 'coach';

  // ── Helper: fila de atleta ──────────────────────────────────────────────────
  const buildAthleteRow = ([athleteId, p]) => {
    const catLabel = categoriesConfig[p.category]?.label || p.category || '---';
    const editable = canModifyAthlete(athleteId);
    return `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:5px;"><img src="${p.photo || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
        <td style="text-align:center;"><strong>${p.playerID}</strong><br>#${p.number || ''}</td>
        <td style="padding:5px;">${p.name}<br><small style="color:gray;">${p.club || ''}</small></td>
        <td style="text-align:center;font-size:0.7rem;">${catLabel}</td>
        <td style="text-align:center;">🩸 ${p.bloodType || '--'}<br>${p.birth || '--'}</td>
        <td style="padding:5px;">${p.responsibleName || '--'}<br>📞 ${p.responsiblePhone || '--'}</td>
        ${showOwnerCol ? `<td style="text-align:center;font-size:0.7rem;color:#aaa;">${p.createdByName || '---'}</td>` : ''}
        <td style="padding:4px;">
          <div style="display:flex;flex-wrap:nowrap;gap:4px;justify-content:center;align-items:center;">
            ${currentUserRole === 'admin' ? `<button onclick="printStandaloneAthleteID('${athleteId}')" title="Imprimir Credencial" style="background:#10b981;color:white;border:none;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">🪪</button>` : ''}
            ${editable ? `<button onclick="loadStandaloneAthleteForEdit('${athleteId}')" title="Editar" style="background:#334155;color:white;border:none;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">✏️</button>
            <button onclick="deleteStandaloneAthlete('${athleteId}')" title="Borrar" style="background:#7f1d1d;border:none;color:#fca5a5;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">🗑️</button>` : `<span style="color:#555;font-size:0.7rem;" title="Solo el entrenador que lo registró puede editarlo">🔒</span>`}
          </div>
        </td>
      </tr>`;
  };

  // ── Helper: fila de entrenador ──────────────────────────────────────────────
  const buildCoachRow = ([athleteId, p]) => {
    const catLabel = categoriesConfig[p.category]?.label || p.category || '---';
    const editable = canModifyAthlete(athleteId);
    return `
      <tr style="border-bottom:1px solid #1e3a2f;">
        <td style="padding:5px;"><img src="${p.photo || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #10b981;"></td>
        <td style="text-align:center;"><strong style="color:#10b981;">${p.playerID}</strong></td>
        <td style="padding:5px;font-weight:bold;">${p.name}<br><small style="color:#10b981;font-weight:normal;">Club: ${p.club || '--'}</small></td>
        <td style="text-align:center;font-size:0.7rem;">${catLabel}</td>
        <td style="padding:5px;">${p.phone ? '📞 ' + p.phone : '--'}<br><small style="color:#aaa;">${p.email || ''}</small></td>
        <td style="padding:5px;font-size:0.7rem;">${p.birth || '--'}<br><small style="color:#555;">${p.curp || ''}</small></td>
        ${showOwnerCol ? `<td style="text-align:center;font-size:0.7rem;color:#aaa;">${p.createdByName || '---'}</td>` : ''}
        <td style="padding:4px;">
          <div style="display:flex;flex-wrap:nowrap;gap:4px;justify-content:center;align-items:center;">
            ${currentUserRole === 'admin' ? `<button onclick="printStandaloneCoachID('${athleteId}')" title="Credencial Entrenador" style="background:#10b981;color:white;border:none;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">🪪</button>` : ''}
            ${editable ? `<button onclick="loadStandaloneAthleteForEdit('${athleteId}')" title="Editar" style="background:#334155;color:white;border:none;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">✏️</button>
            <button onclick="deleteStandaloneAthlete('${athleteId}')" title="Borrar" style="background:#7f1d1d;border:none;color:#fca5a5;padding:5px 7px;border-radius:4px;cursor:pointer;font-size:0.85rem;">🗑️</button>` : `<span style="color:#555;font-size:0.7rem;">🔒</span>`}
          </div>
        </td>
      </tr>`;
  };

  // ── Construir HTML completo ─────────────────────────────────────────────────
  let html = `
    <input type="text" id="standaloneSearchInput" placeholder="🔍 Buscar por nombre, club o ID..." value="${standaloneSearchTerm}"
      oninput="filterStandaloneAthletes(this.value)"
      style="width:100%; padding:8px 12px; margin:8px 0 16px 0; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff; box-sizing:border-box;">

    <!-- SECCIÓN ATLETAS -->
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
      <h4 style="margin:0; color:#ff6b00;">🏃 Atletas Registrados</h4>
      <span style="background:#ff6b00; color:#fff; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${athletes.length}/${totalAthletes}</span>
    </div>
    <div style="overflow-x:auto; margin-bottom:30px;">
      <table style="width:100%; font-size:0.75rem; border-collapse:collapse; background:#111; color:white;">
        <thead>
          <tr style="background:#222; color:#ff6b00;">
            <th>Foto</th><th>ID / #</th><th>Nombre / Club</th><th>Categoría</th><th>Médico</th><th>Responsable</th>${showOwnerCol ? '<th>Registrado por</th>' : ''}<th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${athletes.length === 0
            ? `<tr><td colspan="${showOwnerCol ? 8 : 7}" style="text-align:center;padding:15px;color:#888;font-style:italic;">No se encontraron atletas.</td></tr>`
            : athletes.map(buildAthleteRow).join('')}
        </tbody>
      </table>
    </div>

    <!-- SECCIÓN ENTRENADORES -->
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
      <h4 style="margin:0; color:#10b981;">👨‍🏫 Entrenadores con Credencial</h4>
      <span style="background:#10b981; color:#fff; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${coaches.length}/${totalCoaches}</span>
      ${coaches.length === 0 ? '<span style="font-size:0.75rem; color:#555; font-style:italic;">Ningún entrenador ha completado su registro aún.</span>' : ''}
    </div>
    ${coaches.length > 0 ? `
    <div style="overflow-x:auto;">
      <table style="width:100%; font-size:0.75rem; border-collapse:collapse; background:#0a1a12; color:white; border:1px solid #1e3a2f;">
        <thead>
          <tr style="background:#0f2d1f; color:#10b981;">
            <th>Foto</th><th>ID</th><th>Nombre / Club</th><th>Categoría</th><th>Contacto</th><th>Nacimiento / CURP</th>${showOwnerCol ? '<th>Registrado por</th>' : ''}<th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${coaches.map(buildCoachRow).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;

  container.innerHTML = html;

  if (wasFocused) {
    const input = document.getElementById('standaloneSearchInput');
    if (input) { input.focus(); input.setSelectionRange(cursorPos, cursorPos); }
  }
}

function deleteStandaloneAthlete(athleteId) {
  if (!canModifyAthlete(athleteId)) {
    return alert("🔒 Solo puedes eliminar los atletas que tú mismo registraste.");
  }
  if (confirm("¿Eliminar a este atleta del registro independiente?")) {
    remove(ref(db, `athletes/${athleteId}`));
  }
}
window.deleteStandaloneAthlete = deleteStandaloneAthlete;

// ============================================
// ✅ NUEVO: EDITOR/BORRADO UNIFICADO PARA ADMIN
// El administrador puede editar y borrar CUALQUIER jugador dado de alta,
// sea de un equipo del torneo activo o del registro independiente de un entrenador.
// ============================================
let editingUnifiedPlayer = null; // { source:'team', teamId, playerId } o { source:'standalone', athleteId }

function loadPlayerForUnifiedEdit(source, idA, idB) {
  if (currentUserRole !== 'admin') return alert("🔒 Solo el administrador puede editar cualquier jugador.");

  let p;
  if (source === 'team') {
    const team = globalTeams[idA];
    p = team?.players?.[idB];
    if (!p) return;
    editingUnifiedPlayer = { source: 'team', teamId: idA, playerId: idB };
    document.getElementById('editUnifiedContextLine').innerText =
      `🏆 Jugador de equipo — Club: ${team.name} · Categoría: ${categoriesConfig[team.categoryRegistered]?.label || team.categoryRegistered}`;
    document.getElementById('editUnifiedTeamContext').style.display = 'block';
    document.getElementById('editUnifiedStandaloneFields').style.display = 'none';
  } else {
    p = globalAthletes[idA];
    if (!p) return;
    editingUnifiedPlayer = { source: 'standalone', athleteId: idA };
    document.getElementById('editUnifiedTeamContext').style.display = 'none';
    document.getElementById('editUnifiedStandaloneFields').style.display = 'block';
    document.getElementById('editUnifiedClub').value = p.club || '';
    document.getElementById('editUnifiedCategory').value = p.category || '';
  }

  document.getElementById('editUnifiedName').value      = p.name             || '';
  document.getElementById('editUnifiedCurp').value      = p.curp             || '';
  document.getElementById('editUnifiedBirth').value     = p.birth            || '';
  document.getElementById('editUnifiedNumber').value    = p.number           || '';
  document.getElementById('editUnifiedBlood').value     = p.bloodType        || '';
  document.getElementById('editUnifiedRespName').value  = p.responsibleName  || '';
  document.getElementById('editUnifiedRespPhone').value = p.responsiblePhone || '';

  const card = document.getElementById('editUnifiedPlayerCard');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
window.loadPlayerForUnifiedEdit = loadPlayerForUnifiedEdit;

function cancelUnifiedPlayerEdit() {
  editingUnifiedPlayer = null;
  const card = document.getElementById('editUnifiedPlayerCard');
  if (card) card.style.display = 'none';
  document.getElementById('editUnifiedPlayerForm')?.reset();
}
window.cancelUnifiedPlayerEdit = cancelUnifiedPlayerEdit;

async function handleUnifiedPlayerEditSubmit(e) {
  e.preventDefault();
  if (!editingUnifiedPlayer) return alert("Selecciona un jugador desde la lista (botón ✏️) primero.");
  if (currentUserRole !== 'admin') return alert("🔒 Solo el administrador puede editar cualquier jugador.");

  const updatedData = {
    name: document.getElementById('editUnifiedName').value.trim(),
    curp: document.getElementById('editUnifiedCurp').value.toUpperCase(),
    birth: document.getElementById('editUnifiedBirth').value,
    number: document.getElementById('editUnifiedNumber').value,
    bloodType: document.getElementById('editUnifiedBlood').value,
    responsibleName: document.getElementById('editUnifiedRespName').value.trim(),
    responsiblePhone: document.getElementById('editUnifiedRespPhone').value.trim()
  };

  if (editingUnifiedPlayer.source === 'standalone') {
    updatedData.club     = document.getElementById('editUnifiedClub').value.trim();
    updatedData.category = document.getElementById('editUnifiedCategory').value;
  }

  const photoInput = document.getElementById('editUnifiedPhoto');
  const photoFile   = photoInput?.files?.[0];
  if (photoFile) {
    try {
      updatedData.photo = await resizeAndEncodeImage(photoFile, 400, 0.75);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  const path = editingUnifiedPlayer.source === 'team'
    ? `tournaments/${currentTournamentId}/teams/${editingUnifiedPlayer.teamId}/players/${editingUnifiedPlayer.playerId}`
    : `athletes/${editingUnifiedPlayer.athleteId}`;

  update(ref(db, path), updatedData).then(() => {
    alert("✅ Jugador actualizado correctamente.");
    cancelUnifiedPlayerEdit();
  }).catch(err => {
    console.error(err);
    alert("❌ No se pudo actualizar el jugador.");
  });
}
window.handleUnifiedPlayerEditSubmit = handleUnifiedPlayerEditSubmit;

function deleteUnifiedPlayer(source, idA, idB) {
  if (currentUserRole !== 'admin') return alert("🔒 Solo el administrador puede borrar cualquier jugador.");
  if (source === 'team') {
    deletePlayer(idA, idB);
  } else {
    deleteStandaloneAthlete(idA);
  }
}
window.deleteUnifiedPlayer = deleteUnifiedPlayer;

// ============================================
// EDITAR ATLETA INDEPENDIENTE (respeta la propiedad: solo su dueño o el admin)
// ============================================
let editingStandaloneAthleteId = null;

function loadStandaloneAthleteForEdit(athleteId) {
  if (!canModifyAthlete(athleteId)) {
    return alert("🔒 Solo puedes editar los atletas que tú mismo registraste.");
  }
  const p = globalAthletes[athleteId];
  if (!p) return;

  editingStandaloneAthleteId = athleteId;

  document.getElementById('editStandaloneName').value      = p.name             || '';
  document.getElementById('editStandaloneClub').value      = p.club             || '';
  document.getElementById('editStandaloneCategory').value  = p.category         || '';
  document.getElementById('editStandaloneCurp').value      = p.curp             || '';
  document.getElementById('editStandaloneBirth').value     = p.birth            || '';
  document.getElementById('editStandaloneNumber').value    = p.number           || '';
  document.getElementById('editStandaloneBlood').value     = p.bloodType        || '';
  document.getElementById('editStandaloneRespName').value  = p.responsibleName  || '';
  document.getElementById('editStandaloneRespPhone').value = p.responsiblePhone || '';

  const editCard = document.getElementById('editStandaloneAthleteCard');
  if (editCard) {
    editCard.style.display = 'block';
    editCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
window.loadStandaloneAthleteForEdit = loadStandaloneAthleteForEdit;

function cancelEditStandaloneAthlete() {
  editingStandaloneAthleteId = null;
  const editCard = document.getElementById('editStandaloneAthleteCard');
  if (editCard) editCard.style.display = 'none';
  document.getElementById('editStandaloneAthleteForm')?.reset();
}
window.cancelEditStandaloneAthlete = cancelEditStandaloneAthlete;

async function handleEditStandaloneAthleteSubmit(e) {
  e.preventDefault();
  if (!editingStandaloneAthleteId) return alert("Selecciona un atleta desde la lista (botón ✏️) primero.");
  if (!canModifyAthlete(editingStandaloneAthleteId)) {
    return alert("🔒 Solo puedes editar los atletas que tú mismo registraste.");
  }

  const updatedData = {
    name: document.getElementById('editStandaloneName').value.trim(),
    club: document.getElementById('editStandaloneClub').value.trim(),
    category: document.getElementById('editStandaloneCategory').value,
    curp: document.getElementById('editStandaloneCurp').value.toUpperCase(),
    birth: document.getElementById('editStandaloneBirth').value,
    number: document.getElementById('editStandaloneNumber').value,
    bloodType: document.getElementById('editStandaloneBlood').value,
    responsibleName: document.getElementById('editStandaloneRespName').value.trim(),
    responsiblePhone: document.getElementById('editStandaloneRespPhone').value.trim()
  };

  const photoInput = document.getElementById('editStandalonePhoto');
  const photoFile   = photoInput?.files?.[0];
  if (photoFile) {
    try {
      updatedData.photo = await resizeAndEncodeImage(photoFile, 400, 0.75);
    } catch (err) {
      return alert("❌ " + err.message);
    }
  }

  update(ref(db, `athletes/${editingStandaloneAthleteId}`), updatedData).then(() => {
    alert("✅ Atleta actualizado correctamente.");
    cancelEditStandaloneAthlete();
  });
}
window.handleEditStandaloneAthleteSubmit = handleEditStandaloneAthleteSubmit;

// Credencial para atletas del registro independiente (sin equipo/torneo)
function printStandaloneCoachID(athleteId) {
  const p = globalAthletes[athleteId];
  if (!p) return alert('No se encontró el registro del entrenador.');
  openCoachCredentialWindow({
    name: p.name || '',
    club: p.club || '',
    categoryLabel: categoriesConfig[p.category]?.label || p.category || '',
    photo: p.photo || 'https://via.placeholder.com/150',
    playerID: p.playerID || athleteId,
    curp: p.curp || '',
    birth: p.birth || '',
    phone: p.phone || '',
    email: p.email || ''
  });
}
window.printStandaloneCoachID = printStandaloneCoachID;

function openCoachCredentialWindow(data) {
  const { name, playerID } = data;
  const cardMarkup = buildCoachCredentialCardMarkup(data);

  const existing = document.getElementById('credentialModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'credentialModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:20px;box-sizing:border-box;';

  modal.innerHTML = `
    <div style="width:100%;max-width:700px;">
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;">
        <button onclick="printCredentialModal()" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#10b981;color:white;border:none;border-radius:8px;font-size:0.95rem;">🖨️ Imprimir</button>
        <button onclick="downloadCredentialAsImage('${(name||'').replace(/'/g,"\'")}','${playerID||''}')" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#2563eb;color:white;border:none;border-radius:8px;font-size:0.95rem;">⬇️ Descargar PNG</button>
        <button onclick="document.getElementById('credentialModal').remove()" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#64748b;color:white;border:none;border-radius:8px;font-size:0.95rem;">✕ Cerrar</button>
      </div>
      <p style="color:#94a3b8;text-align:center;font-size:0.78rem;margin-bottom:16px;">Activa "Gráficos de fondo" en el diálogo de impresión para conservar los colores.</p>
      <div id="credWrapper" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <style>${CREDENTIAL_CARD_CSS}</style>
        ${cardMarkup}
      </div>
    </div>
  `;

  const masterPanel = document.getElementById('admin-master-panel');
  const masterWasOpen = masterPanel && masterPanel.style.display !== 'none';
  if (masterWasOpen) masterPanel.style.zIndex = '9000';

  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
      if (masterWasOpen && masterPanel) masterPanel.style.zIndex = '9999';
    }
  });

  document.body.appendChild(modal);
}
window.openCoachCredentialWindow = openCoachCredentialWindow;

function printStandaloneAthleteID(athleteId) {
  const p = globalAthletes[athleteId];
  if (!p) return;

  const rawCatLabel = categoriesConfig[p.category]?.label || p.category || '---';
  const categoryLabel = rawCatLabel.replace(/[^\x00-\x7E\xC0-\xFF ]/g, '').trim() || rawCatLabel;

  openCredentialWindow({
    name: p.name,
    club: p.club || '---',
    categoryLabel,
    photo: p.photo,
    playerID: p.playerID,
    vigenciaTexto: calcularVigencia(p.timestamp),
    curp: p.curp,
    birth: p.birth,
    bloodType: p.bloodType,
    responsibleName: p.responsibleName,
    responsiblePhone: p.responsiblePhone,
    number: p.number
  });
}
window.printStandaloneAthleteID = printStandaloneAthleteID;

// ============================================
// PANEL MAESTRO DE ADMINISTRADOR
// ============================================

function openMasterPanel() {
  if (currentUserRole !== 'admin') return;

  // Asegurarse de que el panel maestro con tabs exista
  let panel = document.getElementById('admin-master-panel');

  if (!panel) {
    // Crear el panel dinámicamente si no existe en el HTML
    panel = document.createElement('div');
    panel.id = 'admin-master-panel';
    panel.style.cssText = `
      position:fixed; inset:0; z-index:99998;
      background:#0a0f1a; overflow-y:auto; padding:0;
    `;
    panel.innerHTML = `
      <div style="max-width:1000px; margin:0 auto; padding:24px 16px;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <img src="https://i.ibb.co/fzzhsgsG/Whats-App-Image-2026-06-17-at-3-25-11-PM-removebg-preview.png" style="height:50px; width:auto;">
            <div>
              <h1 style="margin:0; color:#fff; font-size:1.3rem;">⚙️ Panel Maestro</h1>
              <p style="margin:0; color:#64748b; font-size:0.8rem;">Gestión centralizada del sistema</p>
            </div>
          </div>
          <button onclick="closeMasterPanel()" style="background:#334155; color:#fff; border:none; border-radius:8px; padding:9px 18px; cursor:pointer; font-size:0.9rem;">✕ Cerrar Panel</button>
        </div>

        <!-- Tabs -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:24px; border-bottom:1px solid #1e293b; padding-bottom:12px;">
          <button id="tab-resumen"      class="master-tab active" onclick="showMasterTab('resumen')"      style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#ff6b00; color:#fff;">📊 Resumen</button>
          <button id="tab-competencias" class="master-tab"        onclick="showMasterTab('competencias')" style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#1e293b; color:#94a3b8;">🏆 Competencias</button>
          <button id="tab-entrenadores" class="master-tab"        onclick="showMasterTab('entrenadores')" style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#1e293b; color:#94a3b8;">👨‍🏫 Entrenadores</button>
          <button id="tab-padron"       class="master-tab"        onclick="showMasterTab('padron')"       style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#1e293b; color:#94a3b8;">📋 Padrón General</button>
          <button id="tab-accesos"      class="master-tab"        onclick="showMasterTab('accesos')"      style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#1e293b; color:#94a3b8;">🔑 Accesos</button>
          <button id="tab-patrocinadores" class="master-tab"      onclick="showMasterTab('patrocinadores')" style="padding:8px 16px; border-radius:8px 8px 0 0; border:none; cursor:pointer; font-size:0.85rem; font-weight:600; background:#1e293b; color:#94a3b8;">🤝 Patrocinadores</button>
        </div>

        <!-- Tab Contents -->
        <div id="master-tab-resumen"      class="master-tab-content" style="display:block;"><p style="color:#94a3b8;">Cargando...</p></div>
        <div id="master-tab-competencias" class="master-tab-content" style="display:none;"><p style="color:#94a3b8;">Cargando...</p></div>
        <div id="master-tab-entrenadores" class="master-tab-content" style="display:none;"><p style="color:#94a3b8;">Cargando...</p></div>
        <div id="master-tab-padron"       class="master-tab-content" style="display:none;"><p style="color:#94a3b8;">Cargando...</p></div>
        <div id="master-tab-accesos"      class="master-tab-content" style="display:none;"><p style="color:#94a3b8;">Cargando...</p></div>
        <div id="master-tab-patrocinadores" class="master-tab-content" style="display:none;"><p style="color:#94a3b8;">Cargando...</p></div>
      </div>

      <style>
        .master-tab.active { background:#ff6b00 !important; color:#fff !important; }
        .master-tab:not(.active) { background:#1e293b !important; color:#94a3b8 !important; }
        .master-tab:hover:not(.active) { background:#334155 !important; color:#e2e8f0 !important; }
        .master-table { width:100%; border-collapse:collapse; font-size:0.88rem; }
        .master-table th { background:#1e293b; color:#94a3b8; padding:10px 12px; text-align:left; border-bottom:1px solid #334155; }
        .master-table td { padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0; vertical-align:middle; }
        .master-table tr:hover td { background:#1e293b44; }
      </style>
    `;
    document.body.appendChild(panel);
  }

  // Ocultar otras pantallas
  ['competition-selector-screen','athletes-standalone-screen','main-app-content','admin-master-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  panel.style.display = 'block';
  document.body.style.overflow = 'auto';
  renderMasterResumen();
}

function closeMasterPanel() {
  const oldPanel = document.getElementById('admin-master-panel');
  const newScreen = document.getElementById('admin-master-screen');
  if (oldPanel) { oldPanel.style.display = 'none'; document.body.style.overflow = ''; }
  if (newScreen) newScreen.style.display = 'none';
  // Volver a la pantalla selector
  const sel = document.getElementById('competition-selector-screen');
  if (sel) sel.style.display = 'flex';
}

// Carga competencias en el listado de admin-master-screen
async function renderMasterScreenCompetencias() {
  const container = document.getElementById('master-competitions-list');
  if (!container) return renderMasterResumen(); // fallback al panel viejo
  container.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;">Cargando...</p>';

  const snap = await get(ref(db, 'tournaments'));
  const tournaments = snap.val() || {};
  const entries = Object.entries(tournaments);

  if (entries.length === 0) {
    container.innerHTML = '<p style="color:#aaa; text-align:center; padding:40px;">No hay competencias registradas aún.</p>';
    return;
  }

  container.innerHTML = entries.map(([tid, t]) => `
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:18px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <p style="margin:0; font-size:1rem; font-weight:700; color:#fff;">${t.name || '—'}</p>
        <p style="margin:4px 0 0 0; font-size:0.78rem; color:#64748b;">ID: ${tid}</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <span style="background:${t.isPublic ? '#10b981' : '#ef4444'}; color:white; padding:3px 12px; border-radius:20px; font-size:0.75rem; font-weight:bold;">
          ${t.isPublic ? '🌐 Público' : '🔒 Privado'}
        </span>
        <button onclick="masterToggleTournament('${tid}', ${!!t.isPublic})"
          style="background:#334155; color:white; border:none; border-radius:6px; padding:5px 12px; cursor:pointer; font-size:0.8rem;">
          ${t.isPublic ? 'Bloquear' : 'Publicar'}
        </button>
        <button onclick="enterTournamentFromMaster('${tid}')"
          style="background:#ff6b00; color:white; border:none; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:0.85rem; font-weight:bold;">
          ▶ Entrar
        </button>
        <button onclick="masterDeleteTournamentConfirm('${tid}', '${(t.name||'').replace(/'/g,"\'")}') "
          style="background:#ef4444; color:white; border:none; border-radius:6px; padding:5px 12px; cursor:pointer; font-size:0.8rem;">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}
window.renderMasterScreenCompetencias = renderMasterScreenCompetencias;

function enterTournamentFromMaster(tid) {
  const newScreen = document.getElementById('admin-master-screen');
  if (newScreen) newScreen.style.display = 'none';
  currentTournamentId = tid;
  attachTournamentRealtimeListeners(tid);
  document.getElementById('main-app-content').style.display = 'block';
  switchSection('dashboard');
}
window.enterTournamentFromMaster = enterTournamentFromMaster;

function backToMasterFromEvent() {
  document.getElementById('main-app-content').style.display = 'none';
  openMasterPanel();
}
window.backToMasterFromEvent = backToMasterFromEvent;

function showMasterTab(tab) {
  document.querySelectorAll('.master-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.master-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('master-tab-' + tab).style.display = 'block';
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'resumen') renderMasterResumen();
  if (tab === 'competencias') renderMasterCompetencias();
  if (tab === 'entrenadores') renderMasterEntrenadores();
  if (tab === 'padron') renderMasterPadron();
  if (tab === 'accesos') renderMasterAccesos();
  if (tab === 'patrocinadores') renderMasterPatrocinadores();
}

// TAB 1: RESUMEN GLOBAL
async function renderMasterResumen() {
  const container = document.getElementById('master-tab-resumen');
  container.innerHTML = '<p style="color:#94a3b8;">Cargando estadísticas...</p>';

  // Contar datos reales de Firebase
  const tourneysSnap = await get(ref(db, 'tournaments'));
  const rolesSnap = await get(ref(db, 'roles'));
  const athletesSnap = await get(ref(db, 'athletes'));
  const sponsorsSnap = await get(ref(db, 'sponsors'));

  const tournaments = tourneysSnap.val() || {};
  const roles = rolesSnap.val() || {};
  const athletes = athletesSnap.val() || {};
  const sponsors = sponsorsSnap.val() || {};

  let totalTeams = 0, totalTeamPlayers = 0;
  Object.values(tournaments).forEach(t => {
    const teams = t.teams || {};
    totalTeams += Object.keys(teams).length;
    Object.values(teams).forEach(team => {
      totalTeamPlayers += Object.keys(team.players || {}).length;
    });
  });

  const totalCoaches = Object.values(roles).filter(r => r.role === 'coach').length;
  const totalAdmins = Object.values(roles).filter(r => r.role === 'admin').length;
  const totalIndependent = Object.keys(athletes).length;
  const totalAthletes = totalTeamPlayers + totalIndependent;
  const totalTourneys = Object.keys(tournaments).length;
  const totalSponsors = Object.keys(sponsors).length;

  container.innerHTML = `
    <h3 style="color:#ff6b00; margin-bottom:20px;">📊 Resumen Global del Sistema</h3>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; margin-bottom:32px;">
      <div class="master-stat-card">
        <div class="master-stat-number">${totalTourneys}</div>
        <div class="master-stat-label">🏆 Competencias</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalTeams}</div>
        <div class="master-stat-label">🛡️ Equipos</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalAthletes}</div>
        <div class="master-stat-label">🏃 Atletas Totales</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalTeamPlayers}</div>
        <div class="master-stat-label">👕 En Equipos</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalIndependent}</div>
        <div class="master-stat-label">🆓 Independientes</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalCoaches}</div>
        <div class="master-stat-label">👨‍🏫 Entrenadores</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalAdmins}</div>
        <div class="master-stat-label">👑 Admins</div>
      </div>
      <div class="master-stat-card">
        <div class="master-stat-number">${totalSponsors}</div>
        <div class="master-stat-label">🤝 Patrocinadores</div>
      </div>
    </div>

    <h4 style="color:#94a3b8; margin-bottom:12px;">🏆 Estado de Competencias</h4>
    <table class="master-table">
      <thead><tr><th>Competencia</th><th>Equipos</th><th>Estado</th></tr></thead>
      <tbody>
        ${Object.entries(tournaments).map(([id, t]) => `
          <tr>
            <td>${t.name || id}</td>
            <td>${Object.keys(t.teams || {}).length}</td>
            <td><span style="background:${t.isPublic ? '#10b981' : '#ef4444'}; color:white; padding:2px 10px; border-radius:20px; font-size:0.75rem;">${t.isPublic ? '🟢 Público' : '🔴 Privado'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// TAB 2: GESTIÓN DE COMPETENCIAS
async function renderMasterCompetencias() {
  const container = document.getElementById('master-tab-competencias');
  container.innerHTML = '<p style="color:#94a3b8;">Cargando...</p>';

  const snap = await get(ref(db, 'tournaments'));
  const tournaments = snap.val() || {};

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3 style="color:#ff6b00;">🏆 Gestión de Competencias</h3>
      <button onclick="masterCreateTournament()" style="background:#ff6b00; color:white; border:none; border-radius:8px; padding:10px 18px; cursor:pointer; font-weight:bold;">+ Nueva Competencia</button>
    </div>
    <table class="master-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Equipos</th>
          <th>Partidos</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(tournaments).map(([id, t]) => `
          <tr>
            <td style="font-weight:600;">${t.name || id}</td>
            <td>${Object.keys(t.teams || {}).length}</td>
            <td>${Object.keys(t.matches || {}).length}</td>
            <td>
              <span style="background:${t.isPublic ? '#10b981' : '#64748b'}; color:white; padding:3px 12px; border-radius:20px; font-size:0.75rem;">
                \s*${t.isPublic ? '🟢 Público' : '⚫ Privado'}
              </span>
            </td>
            <td style="display:flex; gap:6px; flex-wrap:wrap;">
              <button onclick="masterToggleTournament('${id}', ${t.isPublic})" style="background:${t.isPublic ? '#64748b' : '#10b981'}; color:white; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.8rem;">
                ${t.isPublic ? '⚫ Privatizar' : '🟢 Publicar'}
              </button>
              <button onclick="if(confirm('¿Eliminar esta competencia?')) masterDeleteTournament('${id}')" style="background:#ef4444; color:white; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.8rem;">🗑️ Eliminar</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function masterToggleTournament(id, isPublic) {
  update(ref(db, `tournaments/${id}`), { isPublic: !isPublic })
    .then(() => renderMasterCompetencias());
}

function masterDeleteTournament(id) {
  remove(ref(db, `tournaments/${id}`))
    .then(() => renderMasterCompetencias());
}

function masterDeleteTournamentConfirm(tid, name) {
  if (!confirm(`¿Eliminar la competencia "${name}"? Esta acción no se puede deshacer.`)) return;
  remove(ref(db, `tournaments/${tid}`))
    .then(() => { renderMasterScreenCompetencias(); renderMasterCompetencias(); });
}
window.masterDeleteTournamentConfirm = masterDeleteTournamentConfirm;

function masterCreateTournament() {
  const name = prompt('Nombre de la nueva competencia:');
  if (!name) return;
  const newRef = push(ref(db, 'tournaments'));
  set(newRef, { name, isPublic: false, createdAt: new Date().toISOString() })
    .then(() => renderMasterCompetencias());
}

// TAB 3: GESTIÓN DE ENTRENADORES
async function renderMasterEntrenadores() {
  const container = document.getElementById('master-tab-entrenadores');
  container.innerHTML = '<p style="color:#94a3b8;">Cargando...</p>';

  const snap = await get(ref(db, 'roles'));
  const roles = snap.val() || {};
  const coaches = Object.entries(roles).filter(([, r]) => r.role === 'coach');

  container.innerHTML = `
    <h3 style="color:#ff6b00; margin-bottom:20px;">👨‍🏫 Gestión de Entrenadores</h3>

    <!-- Formulario crear coach -->
    <div style="background:#1e293b; border-radius:12px; padding:20px; margin-bottom:24px; border:1px solid #334155;">
      <h4 style="color:#e2e8f0; margin-bottom:12px;">➕ Crear Cuenta de Entrenador</h4>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; align-items:end;">
        <div>
          <label style="color:#94a3b8; font-size:0.8rem;">Nombre</label>
          <input id="masterCoachName" type="text" placeholder="Nombre completo" style="width:100%; padding:8px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white; margin-top:4px;">
        </div>
        <div>
          <label style="color:#94a3b8; font-size:0.8rem;">Correo</label>
          <input id="masterCoachEmail" type="email" placeholder="correo@ejemplo.com" style="width:100%; padding:8px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white; margin-top:4px;">
        </div>
        <div>
          <label style="color:#94a3b8; font-size:0.8rem;">Contraseña</label>
          <input id="masterCoachPass" type="password" placeholder="Mínimo 6 caracteres" style="width:100%; padding:8px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white; margin-top:4px;">
        </div>
        <button onclick="masterCreateCoach()" style="background:#ff6b00; color:white; border:none; border-radius:8px; padding:9px 16px; cursor:pointer; font-weight:bold; white-space:nowrap;">Crear Coach</button>
      </div>
    </div>

    <!-- Lista de coaches -->
    <table class="master-table">
      <thead>
        <tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${coaches.length === 0 ? '<tr><td colspan="4" style="color:#64748b; text-align:center;">No hay entrenadores registrados</td></tr>' : 
          coaches.map(([uid, r]) => `
            <tr>
              <td>${r.name || 'Sin nombre'}</td>
              <td>\s*${r.email || uid}</td>
              <td><span style="background:${r.active !== false ? '#10b981' : '#ef4444'}; color:white; padding:2px 10px; border-radius:20px; font-size:0.75rem;">${r.active !== false ? '✅ Activo' : '🚫 Inactivo'}</span></td>
              <td style="display:flex; gap:6px;">
                <button onclick="masterToggleCoach('${uid}', ${r.active !== false})" style="background:${r.active !== false ? '#64748b' : '#10b981'}; color:white; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.8rem;">${r.active !== false ? 'Desactivar' : 'Activar'}</button>
              </td>
            </tr>
          `).join('')
        }
      </tbody>
    </table>
  `;
}

async function masterCreateCoach() {
  const name = document.getElementById('masterCoachName').value.trim();
  const email = document.getElementById('masterCoachEmail').value.trim();
  const password = document.getElementById('masterCoachPass').value;
  if (!name || !email || !password) { alert('Completa todos los campos'); return; }
  if (password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
  try {
    const uid = await createCoachAuthAccount(email, password);
    if (uid) {
      await set(ref(db, `roles/${uid}`), { role: 'coach', active: true, name, email, createdAt: new Date().toISOString() });
      document.getElementById('masterCoachName').value = '';
      document.getElementById('masterCoachEmail').value = '';
      document.getElementById('masterCoachPass').value = '';
      alert(`✅ Entrenador ${name} creado exitosamente`);
      renderMasterEntrenadores();
    }
  } catch(e) { alert('Error: ' + e.message); }
}

function masterToggleCoach(uid, isActive) {
  update(ref(db, `roles/${uid}`), { active: !isActive })
    .then(() => renderMasterEntrenadores());
}

// TAB 4: PADRÓN GENERAL
async function renderMasterPadron() {
  const container = document.getElementById('master-tab-padron');
  container.innerHTML = '<p style="color:#94a3b8;">Cargando padrón...</p>';

  const [tourneysSnap, athletesSnap] = await Promise.all([
    get(ref(db, 'tournaments')),
    get(ref(db, 'athletes'))
  ]);

  const tournaments = tourneysSnap.val() || {};
  const independentAthletes = athletesSnap.val() || {};

  const allAthletes = [];

  // Atletas de equipos
  Object.entries(tournaments).forEach(([tid, t]) => {
    Object.entries(t.teams || {}).forEach(([teamId, team]) => {
      Object.entries(team.players || {}).forEach(([pid, player]) => {
        allAthletes.push({ ...player, _source: 'team', _teamId: teamId, _tournamentId: tid, _playerId: pid, _teamName: team.name, _tournamentName: t.name });
      });
    });
  });

  // Atletas independientes
  Object.entries(independentAthletes).forEach(([id, a]) => {
    allAthletes.push({ ...a, _source: 'standalone', _athleteId: id, _teamName: a.club || 'Independiente', _tournamentName: '—' });
  });

  // Ordenar por nombre
  allAthletes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es-MX'));

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <h3 style="color:#ff6b00;">📋 Padrón General (${allAthletes.length} atletas)</h3>
      <div style="display:flex; gap:10px;">
        <input id="masterPadronSearch" type="text" placeholder="🔍 Buscar nombre, CURP, club..." oninput="filterMasterPadron(this.value)" style="padding:8px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:white; width:240px;">
        <button onclick="exportMasterPadronPDF()" style="background:#7c3aed; color:white; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-weight:bold;">📄 Exportar PDF</button>
      </div>
    </div>
    <div id="master-padron-table-container">
      ${buildMasterPadronTable(allAthletes)}
    </div>
  `;

  // Guardar lista para búsqueda + mapa por ID para acceso seguro
  window._masterAllAthletes = allAthletes;
  window._masterAthletesMap = {};
  allAthletes.forEach(a => {
    const key = a._athleteId || a._playerId;
    if (key) window._masterAthletesMap[key] = a;
  });
}

function buildMasterPadronTable(athletes) {
  if (athletes.length === 0) return '<p style="color:#64748b; text-align:center;">No hay atletas registrados</p>';
  return `
    <table class="master-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre</th>
          <th>Club / Equipo</th>
          <th>Competencia</th>
          <th>CURP</th>
          <th>F. Nacimiento</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${athletes.map((a, i) => `
          <tr>
            <td style="color:#64748b;">${i + 1}</td>
            <td style="font-weight:600;">
              ${a.photo ? `<img src="${a.photo}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:6px;">` : ''}
              ${a.name || '—'}
            </td>
            <td>${a._teamName || '—'}</td>
            <td><span style="font-size:0.75rem; color:#94a3b8;">${a._tournamentName || '—'}</span></td>
            <td style="font-family:monospace; font-size:0.8rem;">${a.curp || '—'}</td>
            <td style="font-size:0.8rem;">${a.birthDate || a.birth || '—'}</td>
            <td style="padding:4px;">
              <div style="display:flex; flex-wrap:nowrap; gap:4px; align-items:center; justify-content:center;">
                <button onclick="masterGenerateCredentialById('${a._athleteId || a._playerId || ''}')" title="Generar Credencial" style="background:#10b981; color:white; border:none; border-radius:6px; padding:5px 8px; cursor:pointer; font-size:0.85rem;">🪪</button>
                ${a._source === 'standalone'
                  ? `<button onclick="masterEditAthlete('${a._athleteId || ''}')" title="Editar" style="background:#334155; color:white; border:none; border-radius:6px; padding:5px 8px; cursor:pointer; font-size:0.85rem;">✏️</button>
                     <button onclick="masterDeleteAthlete('${a._source}','${a._athleteId || ''}','${a._tournamentId || ''}','${a._teamId || ''}','${a._playerId || ''}','${(a.name||'').replace(/'/g,'')}')" title="Eliminar" style="background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:5px 8px; cursor:pointer; font-size:0.85rem;">🗑️</button>`
                  : `<button onclick="masterDeleteAthlete('${a._source}','${a._athleteId || ''}','${a._tournamentId || ''}','${a._teamId || ''}','${a._playerId || ''}','${(a.name||'').replace(/'/g,'')}')" title="Eliminar" style="background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:5px 8px; cursor:pointer; font-size:0.85rem;">🗑️</button>`}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterMasterPadron(term) {
  const filtered = (window._masterAllAthletes || []).filter(a => {
    const t = term.toLowerCase();
    return (a.name || '').toLowerCase().includes(t) ||
           (a.curp || '').toLowerCase().includes(t) ||
           (a._teamName || '').toLowerCase().includes(t) ||
           (a.club || '').toLowerCase().includes(t);
  });
  document.getElementById('master-padron-table-container').innerHTML = buildMasterPadronTable(filtered);
}

function masterGenerateCredential(index) {
  const a = window._masterAllAthletes?.[index];
  if (!a) return;
  masterGenerateCredentialById(a._athleteId || a._playerId || '');
}

function masterGenerateCredentialById(id) {
  const a = (window._masterAthletesMap || {})[id] ||
            (window._masterAllAthletes || []).find(x => (x._athleteId || x._playerId) === id);
  if (!a) return alert('No se encontró el atleta.');
  const rawLabel = (categoriesConfig?.[a.category]?.label) || a.category || '---';
  const categoryLabel = rawLabel.replace(/[^\x00-\x7E\xC0-\xFF ]/g, '').trim() || rawLabel;

  openCredentialWindow({
    name:             a.name,
    club:             a._teamName || a.club || '---',
    categoryLabel,
    photo:            a.photo,
    playerID:         a.playerID || a.athleteID || '---',
    vigenciaTexto:    calcularVigencia(a.timestamp),
    curp:             a.curp,
    birth:            a.birthDate || a.birth,
    bloodType:        a.blood || a.bloodType,
    responsibleName:  a.responsibleName || a.respName,
    responsiblePhone: a.responsiblePhone || a.respPhone,
    number:           a.number
  });
}

async function exportMasterPadronPDF() {
  const athletes = window._masterAllAthletes || [];
  if (athletes.length === 0) { alert('No hay atletas para exportar'); return; }
  alert(`Generando PDF con ${athletes.length} credenciales... Espera un momento.`);
  // Reutilizar función existente de exportAllCredentialsPDF si existe, si no, llamar openCredentialWindow para cada uno
  if (typeof exportAllCredentialsPDF === 'function') {
    exportAllCredentialsPDF();
  } else {
    alert('Función de exportación masiva no disponible. Genera credenciales individualmente con 🪪');
  }
}

// EDICIÓN DE ATLETA DESDE EL PADRÓN GENERAL
function masterEditAthlete(athleteId) {
  if (!athleteId) return alert('Solo se pueden editar atletas independientes desde aquí.');
  const a = (window._masterAthletesMap || {})[athleteId] || globalAthletes?.[athleteId];
  if (!a) return alert('No se encontró el atleta.');

  // Crear modal de edición inline
  const existing = document.getElementById('masterEditModal');
  if (existing) existing.remove();

  const categoriesOptions = Object.entries(categoriesConfig)
    .map(([k,v]) => `<option value="${k}" ${a.category === k ? 'selected' : ''}>${v.label}</option>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'masterEditModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;border:1px solid #334155;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="color:#ff6b00;margin:0;">✏️ Editar Atleta</h3>
        <button onclick="document.getElementById('masterEditModal').remove()" style="background:#334155;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;">✕ Cerrar</button>
      </div>

      <div style="display:grid;gap:12px;">
        <div>
          <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Nombre Completo</label>
          <input id="meNombre" value="${a.name || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Club / Equipo</label>
            <input id="meClub" value="${a.club || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
          </div>
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Categoría</label>
            <select id="meCategoria" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
              ${categoriesOptions}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">CURP</label>
            <input id="meCurp" value="${a.curp || ''}" maxlength="18" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;text-transform:uppercase;box-sizing:border-box;">
          </div>
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">F. Nacimiento</label>
            <input id="meNacimiento" type="date" value="${a.birth || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Número (#)</label>
            <input id="meNumero" value="${a.number || ''}" type="number" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
          </div>
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Tipo de Sangre</label>
            <select id="meSangre" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
              ${['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(t => `<option ${(a.bloodType||a.blood)===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Responsable (Padre/Tutor)</label>
          <input id="meResponsable" value="${a.responsibleName || a.respName || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Teléfono</label>
            <input id="meTelefono" value="${a.phone || a.responsiblePhone || a.respPhone || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
          </div>
          <div>
            <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">Correo</label>
            <input id="meEmail" type="email" value="${a.email || ''}" style="width:100%;padding:9px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:white;box-sizing:border-box;">
          </div>
        </div>

        <!-- Foto -->
        <div>
          <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:4px;">📷 Cambiar Foto (opcional)</label>
          <label style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#ff6b00;color:white;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:bold;">
            📤 Subir nueva foto
            <input type="file" id="meFoto" accept="image/png,image/jpeg" style="display:none;" onchange="previewMasterEditPhoto(this)">
          </label>
          <div id="meFotoPreview" style="margin-top:8px;">
            ${a.photo ? `<img src="${a.photo}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid #ff6b00;">` : ''}
          </div>
        </div>

        <button onclick="saveMasterEditAthlete('${athleteId}')" style="background:#10b981;color:white;border:none;border-radius:8px;padding:12px;font-size:0.95rem;font-weight:bold;cursor:pointer;width:100%;margin-top:8px;">
          💾 Guardar Cambios
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.masterEditAthlete = masterEditAthlete;

// ── ELIMINAR JUGADOR DESDE EL PADRÓN MAESTRO ──────────────────────────────────
async function masterDeleteAthlete(source, athleteId, tournamentId, teamId, playerId, name) {
  if (!confirm(`¿Eliminar a "${name}" del padrón?\n\nEsta acción no se puede deshacer.`)) return;

  try {
    if (source === 'standalone') {
      // Atleta / entrenador del registro independiente
      if (!athleteId) return alert('ID de atleta no disponible.');
      await remove(ref(db, `athletes/${athleteId}`));
      // Actualizar la lista local
      if (window._masterAllAthletes) {
        window._masterAllAthletes = window._masterAllAthletes.filter(a => a._athleteId !== athleteId);
      }
      if (window._masterAthletesMap) delete window._masterAthletesMap[athleteId];
    } else {
      // Jugador de equipo dentro de un torneo
      if (!tournamentId || !teamId || !playerId) return alert('No se encontró la ruta del jugador.');
      await remove(ref(db, `tournaments/${tournamentId}/teams/${teamId}/players/${playerId}`));
      // Actualizar la lista local
      if (window._masterAllAthletes) {
        window._masterAllAthletes = window._masterAllAthletes.filter(a => a._playerId !== playerId);
      }
      if (window._masterAthletesMap) delete window._masterAthletesMap[playerId];
    }

    // Re-renderizar la tabla con los datos ya actualizados
    const searchVal = document.getElementById('masterPadronSearch')?.value || '';
    const filtered = searchVal
      ? (window._masterAllAthletes || []).filter(a => {
          const t = searchVal.toLowerCase();
          return (a.name || '').toLowerCase().includes(t) ||
                 (a.curp || '').toLowerCase().includes(t) ||
                 (a._teamName || '').toLowerCase().includes(t);
        })
      : (window._masterAllAthletes || []);

    // Actualizar contador en el título
    const titleEl = document.querySelector('#master-tab-padron h3');
    if (titleEl) titleEl.textContent = `📋 Padrón General (${(window._masterAllAthletes || []).length} atletas)`;

    document.getElementById('master-padron-table-container').innerHTML = buildMasterPadronTable(filtered);

  } catch (err) {
    alert('❌ Error al eliminar: ' + err.message);
  }
}
window.masterDeleteAthlete = masterDeleteAthlete;

function previewMasterEditPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('meFotoPreview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid #ff6b00;">`;
  };
  reader.readAsDataURL(file);
}
window.previewMasterEditPhoto = previewMasterEditPhoto;

async function saveMasterEditAthlete(athleteId) {
  const updatedData = {
    name:            document.getElementById('meNombre').value.trim(),
    club:            document.getElementById('meClub').value.trim(),
    category:        document.getElementById('meCategoria').value,
    curp:            document.getElementById('meCurp').value.toUpperCase(),
    birth:           document.getElementById('meNacimiento').value,
    number:          document.getElementById('meNumero').value,
    bloodType:       document.getElementById('meSangre').value,
    responsibleName: document.getElementById('meResponsable').value.trim(),
    phone:           document.getElementById('meTelefono').value.trim(),
    email:           document.getElementById('meEmail').value.trim(),
  };

  const photoFile = document.getElementById('meFoto')?.files?.[0];
  if (photoFile) {
    try {
      updatedData.photo = await resizeAndEncodeImage(photoFile, 400, 0.75);
    } catch(err) {
      return alert('❌ Error con la foto: ' + err.message);
    }
  }

  update(ref(db, `athletes/${athleteId}`), updatedData).then(() => {
    alert('✅ Atleta actualizado correctamente.');
    document.getElementById('masterEditModal')?.remove();
    renderMasterPadron(); // refrescar la tabla
  }).catch(err => alert('❌ Error: ' + err.message));
}
window.saveMasterEditAthlete = saveMasterEditAthlete;

// TAB 5: GESTIÓN DE ACCESOS
async function renderMasterAccesos() {
  const container = document.getElementById('master-tab-accesos');
  container.innerHTML = '<p style="color:#94a3b8;">Cargando accesos...</p>';

  const snap = await get(ref(db, 'roles'));
  const roles = snap.val() || {};

  container.innerHTML = `
    <h3 style="color:#ff6b00; margin-bottom:20px;">🔑 Gestión de Accesos</h3>
    <table class="master-table">
      <thead>
        <tr><th>Nombre</th><th>Correo / UID</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${Object.keys(roles).length === 0 ? '<tr><td colspan="5" style="color:#64748b; text-align:center;">No hay usuarios registrados</td></tr>' :
          Object.entries(roles).map(([uid, r]) => `
            <tr>
              <td>${r.name || 'Sin nombre'}</td>
              <td style="font-size:0.75rem; color:#94a3b8;">\s*${r.email || uid}</td>
              <td>
                <span style="background:${r.role === 'admin' ? '#7c3aed' : '#0284c7'}; color:white; padding:2px 10px; border-radius:20px; font-size:0.75rem;">
                  ${r.role === 'admin' ? '👑 Admin' : '👨‍🏫 Coach'}
                </span>
              </td>
              <td><span style="background:${r.active !== false ? '#10b981' : '#ef4444'}; color:white; padding:2px 10px; border-radius:20px; font-size:0.75rem;">${r.active !== false ? '✅ Activo' : '🚫 Inactivo'}</span></td>
              <td style="display:flex; gap:6px; flex-wrap:wrap;">
                <button onclick="masterToggleUserRole('${uid}', '${r.role}')" style="background:#7c3aed; color:white; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.75rem;">
                  ${r.role === 'admin' ? '→ Coach' : '→ Admin'}
                </button>
                <button onclick="masterToggleUserActive('${uid}', ${r.active !== false})" style="background:${r.active !== false ? '#ef4444' : '#10b981'}; color:white; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.75rem;">
                  ${r.active !== false ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          `).join('')
        }
      </tbody>
    </table>
  `;
}

function masterToggleUserRole(uid, currentRole) {
  const newRole = currentRole === 'admin' ? 'coach' : 'admin';
  if (!confirm(`¿Cambiar rol a ${newRole}?`)) return;
  update(ref(db, `roles/${uid}`), { role: newRole })
    .then(() => renderMasterAccesos());
}

function masterToggleUserActive(uid, isActive) {
  update(ref(db, `roles/${uid}`), { active: !isActive })
    .then(() => renderMasterAccesos());
}

window.openMasterPanel = openMasterPanel;
window.closeMasterPanel = closeMasterPanel;
// TAB: PATROCINADORES
async function renderMasterPatrocinadores() {
  const container = document.getElementById('master-tab-patrocinadores');
  if (!container) return;
  container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">Cargando...</p>';

  const snap = await get(ref(db, 'sponsors'));
  const sponsors = snap.val() || {};
  const entries = Object.entries(sponsors);

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div>
        <h3 style="color:#fff; font-size:1rem; margin:0 0 4px 0;">🤝 Patrocinadores Globales</h3>
        <p style="color:#64748b; font-size:0.8rem; margin:0;">${entries.length} patrocinador${entries.length !== 1 ? 'es' : ''} registrado${entries.length !== 1 ? 's' : ''}</p>
      </div>
      <button onclick="openMasterSponsorForm()"
        style="background:#ff6b00; color:#fff; border:none; border-radius:8px; padding:9px 18px; cursor:pointer; font-size:0.88rem; font-weight:600;">
        ➕ Agregar Patrocinador
      </button>
    </div>

    <!-- Formulario (oculto por defecto) -->
    <div id="master-sponsor-form-box" style="display:none; background:#0f172a; border:1px solid #334155; border-radius:12px; padding:20px; margin-bottom:24px;">
      <h4 id="master-sponsor-form-title" style="color:#fff; margin:0 0 16px 0; font-size:0.95rem;">➕ Nuevo Patrocinador</h4>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">Nombre *</label>
          <input id="ms-sponsor-name" placeholder="Nombre del patrocinador"
            style="width:100%; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.88rem; box-sizing:border-box;">
        </div>
        <div>
          <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">Link (opcional)</label>
          <input id="ms-sponsor-link" placeholder="https://..."
            style="width:100%; padding:9px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#fff; font-size:0.88rem; box-sizing:border-box;">
        </div>
        <div style="grid-column:1/-1;">
          <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">Logo *</label>
          <div style="display:flex; align-items:center; gap:12px;">
            <label for="ms-sponsor-logo" style="background:#1e293b; border:1px dashed #334155; border-radius:8px; padding:10px 16px; cursor:pointer; color:#94a3b8; font-size:0.85rem; white-space:nowrap;">📁 Seleccionar imagen</label>
            <input id="ms-sponsor-logo" type="file" accept="image/*" style="display:none;" onchange="previewMasterSponsorLogo(this)">
            <span id="ms-sponsor-logo-name" style="color:#64748b; font-size:0.8rem;">Ningún archivo</span>
          </div>
          <div id="ms-sponsor-logo-preview" style="margin-top:10px; display:none;">
            <img id="ms-sponsor-logo-img" style="max-height:70px; border-radius:6px; background:#1e293b; padding:4px;">
          </div>
        </div>
      </div>
      <input id="ms-sponsor-edit-id" type="hidden" value="">
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button onclick="saveMasterSponsor()"
          style="background:#ff6b00; color:#fff; border:none; border-radius:8px; padding:9px 20px; cursor:pointer; font-size:0.88rem; font-weight:600;">💾 Guardar</button>
        <button onclick="closeMasterSponsorForm()"
          style="background:#334155; color:#fff; border:none; border-radius:8px; padding:9px 16px; cursor:pointer; font-size:0.88rem;">Cancelar</button>
      </div>
    </div>

    <!-- Lista de patrocinadores -->
    <div id="master-sponsor-list">
      ${entries.length === 0
        ? `<p style="color:#64748b; text-align:center; padding:40px;">Aún no hay patrocinadores. Presiona "Agregar Patrocinador" para comenzar.</p>`
        : `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px;">
            ${entries.map(([id, s]) => `
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center;">
                ${s.logo
                  ? `<img src="${s.logo}" alt="${s.name}" style="max-height:65px; max-width:130px; object-fit:contain; border-radius:6px; background:#1e293b; padding:4px;">`
                  : `<div style="width:100px; height:65px; background:#1e293b; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:0.75rem;">Sin logo</div>`}
                <p style="margin:0; color:#e2e8f0; font-size:0.9rem; font-weight:600;">${s.name || '—'}</p>
                ${s.link ? `<a href="${s.link}" target="_blank" rel="noopener" style="color:#ff6b00; font-size:0.72rem; word-break:break-all; max-width:100%;">${s.link}</a>` : '<p style="color:#64748b; font-size:0.75rem; margin:0;">Sin link</p>'}
                <div style="display:flex; gap:8px; width:100%; margin-top:4px;">
                  <button onclick="masterEditSponsor('${id}')"
                    style="flex:1; background:#1e3a5f; color:#93c5fd; border:none; border-radius:6px; padding:6px; cursor:pointer; font-size:0.78rem;">✏️ Editar</button>
                  <button onclick="masterDeleteSponsor('${id}','${(s.name||'').replace(/'/g,"\'")}')"
                    style="flex:1; background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:6px; cursor:pointer; font-size:0.78rem;">🗑️ Borrar</button>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;

  // Guardar datos para edición
  window._masterSponsorsData = sponsors;
}
window.renderMasterPatrocinadores = renderMasterPatrocinadores;

function openMasterSponsorForm() {
  const box = document.getElementById('master-sponsor-form-box');
  if (box) { box.style.display = 'block'; }
  document.getElementById('ms-sponsor-edit-id').value = '';
  document.getElementById('ms-sponsor-name').value = '';
  document.getElementById('ms-sponsor-link').value = '';
  document.getElementById('ms-sponsor-logo-name').textContent = 'Ningún archivo';
  const prev = document.getElementById('ms-sponsor-logo-preview');
  if (prev) prev.style.display = 'none';
  document.getElementById('master-sponsor-form-title').textContent = '➕ Nuevo Patrocinador';
}
window.openMasterSponsorForm = openMasterSponsorForm;

function closeMasterSponsorForm() {
  const box = document.getElementById('master-sponsor-form-box');
  if (box) box.style.display = 'none';
}
window.closeMasterSponsorForm = closeMasterSponsorForm;

function previewMasterSponsorLogo(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('ms-sponsor-logo-name').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('ms-sponsor-logo-img');
    const prev = document.getElementById('ms-sponsor-logo-preview');
    img.src = e.target.result;
    if (prev) prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
}
window.previewMasterSponsorLogo = previewMasterSponsorLogo;

async function saveMasterSponsor() {
  const name = document.getElementById('ms-sponsor-name').value.trim();
  const link = document.getElementById('ms-sponsor-link').value.trim();
  const editId = document.getElementById('ms-sponsor-edit-id').value;
  const logoInput = document.getElementById('ms-sponsor-logo');
  const logoFile = logoInput?.files?.[0];

  if (!name) return alert('⚠️ El nombre es obligatorio.');

  let logoData = null;
  if (logoFile) {
    try {
      logoData = await resizeAndEncodeImage(logoFile, 300, 0.8);
    } catch (err) {
      return alert('❌ Error al procesar la imagen: ' + err.message);
    }
  }

  if (editId) {
    // Edición — preservar logo si no se sube uno nuevo
    const existing = window._masterSponsorsData?.[editId] || {};
    const updated = { name, link, logo: logoData || existing.logo || '' };
    await update(ref(db, `sponsors/${editId}`), updated);
    alert('✅ Patrocinador actualizado.');
  } else {
    // Nuevo
    if (!logoFile) return alert('⚠️ Selecciona un logo para el patrocinador.');
    await push(ref(db, 'sponsors'), { name, link, logo: logoData });
    alert('✅ Patrocinador agregado.');
  }

  closeMasterSponsorForm();
  renderMasterPatrocinadores();
}
window.saveMasterSponsor = saveMasterSponsor;

function masterEditSponsor(id) {
  const s = window._masterSponsorsData?.[id];
  if (!s) return;
  openMasterSponsorForm();
  document.getElementById('ms-sponsor-edit-id').value = id;
  document.getElementById('ms-sponsor-name').value = s.name || '';
  document.getElementById('ms-sponsor-link').value = s.link || '';
  document.getElementById('master-sponsor-form-title').textContent = '✏️ Editar Patrocinador';
  if (s.logo) {
    const img = document.getElementById('ms-sponsor-logo-img');
    const prev = document.getElementById('ms-sponsor-logo-preview');
    img.src = s.logo;
    if (prev) prev.style.display = 'block';
    document.getElementById('ms-sponsor-logo-name').textContent = 'Logo actual (carga uno nuevo para cambiar)';
  }
}
window.masterEditSponsor = masterEditSponsor;

async function masterDeleteSponsor(id, name) {
  if (!confirm(`¿Eliminar al patrocinador "${name}"?`)) return;
  await remove(ref(db, `sponsors/${id}`));
  renderMasterPatrocinadores();
}
window.masterDeleteSponsor = masterDeleteSponsor;

window.showMasterTab = showMasterTab;
window.masterToggleTournament = masterToggleTournament;
window.masterDeleteTournament = masterDeleteTournament;
window.masterCreateTournament = masterCreateTournament;
window.masterCreateCoach = masterCreateCoach;
window.masterToggleCoach = masterToggleCoach;
window.filterMasterPadron = filterMasterPadron;
window.masterGenerateCredential = masterGenerateCredential;
window.masterGenerateCredentialById = masterGenerateCredentialById; // ✅ CORRECCIÓN: faltaba esta exposición
window.exportMasterPadronPDF = exportMasterPadronPDF;
window.masterToggleUserRole = masterToggleUserRole;
window.masterToggleUserActive = masterToggleUserActive;

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
  // initRolesObserver se llama solo para admin en onAuthStateChanged
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
      // Mostrar botones de cerrar sesión para el coach
      if (document.getElementById('btnCoachLogout')) document.getElementById('btnCoachLogout').style.display = 'block';
      if (document.getElementById('btnCoachLogoutSelector')) document.getElementById('btnCoachLogoutSelector').style.display = 'block';
    } else {
      // Administrador: acceso total
      if (document.getElementById('btnGoToAdminPrep')) document.getElementById('btnGoToAdminPrep').style.display = 'block';
      if (document.getElementById('admin-dashboard-panels')) document.getElementById('admin-dashboard-panels').style.display = 'grid';
      // El admin usa su propio botón de logout, ocultar el del coach
      if (document.getElementById('btnCoachLogout')) document.getElementById('btnCoachLogout').style.display = 'none';
      if (document.getElementById('btnCoachLogoutSelector')) document.getElementById('btnCoachLogoutSelector').style.display = 'none';
      if (document.getElementById('btnGoToStandaloneAthletes')) {
        document.getElementById('btnGoToStandaloneAthletes').style.display = 'block';
        document.getElementById('btnGoToStandaloneAthletes').innerText = '🪪 Registro y Credenciales de Atletas';
      }
      // Solo el admin necesita observar la lista de roles/coaches
      initRolesObserver();
    }
    applyRoleBasedNavVisibility();
    syncFloatingAdminBtn(currentUserRole);
    initGlobalAthletesObserver(); // inicializar AHORA que ya sabemos el rol
  } else {
    currentUserRole = 'public';
    currentUserUid  = null;
    currentUserName = '';
    document.body.classList.remove('is-admin');
    // Limpiar listener de atletas al cerrar sesión
    if (_athletesListenerCleanup) {
      _athletesListenerCleanup();
      _athletesListenerCleanup = null;
    }
    globalAthletes = {};
    syncFloatingAdminBtn('public');
    if (document.getElementById('admin-login-box'))    document.getElementById('admin-login-box').style.display = 'flex';
    if (document.getElementById('btnGoToAdminPrep'))   document.getElementById('btnGoToAdminPrep').style.display = 'none';
    if (document.getElementById('btnCoachLogout')) document.getElementById('btnCoachLogout').style.display = 'none';
    if (document.getElementById('btnCoachLogoutSelector')) document.getElementById('btnCoachLogoutSelector').style.display = 'none';
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
window.handleLogout = handleLogout;

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
  .signature-area { margin-top: 2px; text-align: center; }
  .signature-img { display: block; width: 52px; height: auto; opacity: 0.88; margin: 0 auto 1px auto; pointer-events: none; }
  .signature-line { border-top: 1px solid #000; width: 120px; margin: 0 auto; font-size: 7px; text-align: center; padding-top: 2px; }

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

                <div class="signature-area"><img class="signature-img" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqsAAAQACAYAAADGEBDmAAEAAElEQVR4nOzdd3ykV3X/8c+593lmRtrqde8YF8AV3AFjG4OpoYZmEiBAHHqH0EJIQgu9xnQSSuihdwjVYOPeK+69rLdLM89z7zm/P+4zktYYWOdnsLx73rzErrWr0WikHX11nnPPkenpaZxzzjnnnJuPwp19B5xzzjnnnPtDPKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw65zDAEGy913T/bzP/6Zxzzv3FeVh1blMWBETIFkhakwmAYZYwDImBnI1IBWaA8oeTq3Qvzjnn3B3Hw6pzmzBNkJIioeKSq67llDMvteWrE2o1WGQ0GtHrVaTU8qfLqx5WnXPO3fGqO/sOOOfuLIIQEAlccul1PP1Zr7crrr6ZI464j33kg/8mSwfQi0rOLdR39n11zjm3qZLp6ek7+z445+4kmgUNNU946ovslydfj9ZLwdax3z234ouffLNsuaQi1ooKBI2IV06dc879hXkbgHObMAmZ1ozzLr4OqReTpAeDzbnk+pb3fPRrZr0+akKUeGffVeecc5soD6vObbIURMlAb+HmJIT+IBCiMJUiX/jmrzj+1EvMZICODEEws5kX55xz7i/Bw6pzm7A2JZIKoa4gGP1+5pCD96Rp17FiCp73qndx3Y3TkCLSPV2oKnVdo6p38r13zjm3KfCw6twmK9DvTdCvje2325xMpm2meO2rnsFmCxNS11x7s/CtH5xgxB45Z0SEGCNN0yDi/avOOef+/DysOrcJS21LMNh3z3tQ1TVpah06vZyPv/u11M0UvYklfOqLP2ZKQGJNzoYZhHDrp47xDNY/NofVOeecu/08rDq3yVKCQE/g0AMPBCp0MMkVv7uU+++7hxx273vStiMuue4WPvDxb1qbM3VdY6bE6AeunHPO/WV4WHVuUyaKqLLX7jtJFWqSwSW/u4LF/YrHPPRgrF2F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" crossorigin="anonymous"><div class="signature-line">Firma del Delegado / Administrador</div></div>
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

                <div class="signature-area"><img class="signature-img" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqsAAAQACAYAAADGEBDmAAEAAElEQVR4nOzdd3ykV3X/8c+593lmRtrqde8YF8AV3AFjG4OpoYZmEiBAHHqH0EJIQgu9xnQSSuihdwjVYOPeK+69rLdLM89z7zm/P+4zktYYWOdnsLx73rzErrWr0WikHX11nnPPkenpaZxzzjnnnJuPwp19B5xzzjnnnPtDPKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw655xzzrl5y8Oqc84555ybtzysOuecc865ecvDqnPOOeecm7c8rDrnnHPOuXnLw6pzzjnnnJu3PKw65zDAEGy913T/bzP/6Zxzzv3FeVh1blMWBETIFkhakwmAYZYwDImBnI1IBWaA8oeTq3Qvzjnn3B3Hw6pzmzBNkJIioeKSq67llDMvteWrE2o1WGQ0GtHrVaTU8qfLqx5WnXPO3fGqO/sOOOfuLIIQEAlccul1PP1Zr7crrr6ZI464j33kg/8mSwfQi0rOLdR39n11zjm3qZLp6ek7+z445+4kmgUNNU946ovslydfj9ZLwdax3z234ouffLNsuaQi1ooKBI2IV06dc879hXkbgHObMAmZ1ozzLr4OqReTpAeDzbnk+pb3fPRrZr0+akKUeGffVeecc5soD6vObbIURMlAb+HmJIT+IBCiMJUiX/jmrzj+1EvMZICODEEws5kX55xz7i/Bw6pzm7A2JZIKoa4gGP1+5pCD96Rp17FiCp73qndx3Y3TkCLSPV2oKnVdo6p38r13zjm3KfCw6twmK9DvTdCvje2325xMpm2meO2rnsFmCxNS11x7s/CtH5xgxB45Z0SEGCNN0yDi/avOOef+/DysOrcJS21LMNh3z3tQ1TVpah06vZyPv/u11M0UvYklfOqLP2ZKQGJNzoYZhHDrp47xDNY/NofVOeecu/08rDq3yVKCQE/g0AMPBCp0MMkVv7uU+++7hxx273vStiMuue4WPvDxb1qbM3VdY6bE6AeunHPO/WV4WHVuUyaKqLLX7jtJFWqSwSW/u4LF/YrHPPRgrF2F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" crossorigin="anonymous"><div class="signature-line">Firma del Delegado / Coach</div></div>
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
        <button onclick="downloadCredentialAsPDF('${(name||'').replace(/'/g,"\'")}','${playerID||''}')" style="padding:10px 22px;cursor:pointer;font-weight:bold;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:0.95rem;">📄 Descargar PDF</button>
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

window.printCredentialModal = printCredentialModal;
window.downloadCredentialAsImage = downloadCredentialAsImage;

// ✅ NUEVA función: descargar credencial individual como PDF
async function downloadCredentialAsPDF(name, playerID) {
  const wrapper = document.getElementById('credWrapper');
  if (!wrapper) return;
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    return alert('Librerías no disponibles. Intenta con el botón PNG.');
  }
  try {
    const canvas = await html2canvas(wrapper, { scale: 3, backgroundColor: '#f4f4f4', useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pW = pdf.internal.pageSize.getWidth();
    const pH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxW = pW - margin * 2;
    const maxH = pH - margin * 2;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const x = (pW - imgW) / 2;
    const y = margin;
    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
    pdf.save(`Credencial_${playerID}_${(name || '').replace(/\s+/g, '_')}.pdf`);
  } catch(err) {
    alert('No se pudo generar el PDF: ' + err.message);
  }
}
window.downloadCredentialAsPDF = downloadCredentialAsPDF;

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



// ══════════════════════════════════════════════════════════
// DIAGNÓSTICO: Verificar acceso del coach a sus atletas
// ══════════════════════════════════════════════════════════
async function diagnosticCoachAccess() {
  if (!currentUserUid) {
    console.warn('🔍 DIAGNÓSTICO: No hay usuario autenticado');
    return;
  }
  
  console.log('═══════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DE ACCESO DEL COACH');
  console.log('═══════════════════════════════════════════');
  console.log('UID:', currentUserUid);
  console.log('Rol:', currentUserRole);
  console.log('Nombre:', currentUserName);
  console.log('globalAthletes actual:', Object.keys(globalAthletes).length, 'atletas');
  console.log('Listener activo:', !!_athletesListenerCleanup);
  
  // Prueba 1: Leer TODOS los atletas
  try {
    const allSnap = await get(ref(db, 'athletes'));
    const all = allSnap.val() || {};
    const allCount = Object.keys(all).length;
    const myCount = Object.values(all).filter(a => a && a.createdBy === currentUserUid).length;
    console.log('✅ Prueba 1 — Leer TODOS los atletas: ACCESO CONCEDIDO');
    console.log('   Total atletas en BD:', allCount);
    console.log('   Atletas de este coach:', myCount);
    if (myCount > 0) {
      console.log('   ✅ Los atletas SÍ existen y tienen createdBy correcto');
      // Forzar recarga
      globalAthletes = {};
      Object.entries(all).forEach(([k, v]) => {
        if (v && v.createdBy === currentUserUid) globalAthletes[k] = v;
      });
      renderStandaloneAthleteList();
      console.log('   ✅ globalAthletes recargado:', Object.keys(globalAthletes).length, 'atletas');
    } else {
      console.log('   ⚠️ No hay atletas con createdBy === UID del coach');
      console.log('   ¿Quizás los atletas se registraron antes de que existiera el campo createdBy?');
      // Mostrar algunos atletas para debug
      const sample = Object.entries(all).slice(0, 3);
      sample.forEach(([k, v]) => {
        console.log('   Ejemplo atleta:', v.name, '| createdBy:', v.createdBy, '| UID coach:', currentUserUid);
      });
    }
  } catch (err) {
    console.log('❌ Prueba 1 — Leer TODOS los atletas: ACCESO DENEGADO');
    console.log('   Error:', err.code || err.message);
    
    // Prueba 2: Query filtrado
    try {
      const q = query(ref(db, 'athletes'), orderByChild('createdBy'), equalTo(currentUserUid));
      const filteredSnap = await get(q);
      const filtered = filteredSnap.val() || {};
      console.log('✅ Prueba 2 — Query filtrado: ACCESO CONCEDIDO');
      console.log('   Atletas del coach:', Object.keys(filtered).length);
      globalAthletes = filtered;
      renderStandaloneAthleteList();
    } catch (err2) {
      console.log('❌ Prueba 2 — Query filtrado: ACCESO DENEGADO');
      console.log('   Error:', err2.code || err2.message);
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('🚨 DIAGNÓSTICO: Las reglas de Firebase NO permiten que');
      console.log('   el coach lea SUS atletas. Necesitas ajustar las reglas.');
      console.log('');
      console.log('   Reglas recomendadas en Firebase Console > Database > Rules:');
      console.log('   {');
      console.log('     "rules": {');
      console.log('       "athletes": {');
      console.log('         ".read": "auth != null",');
      console.log('         ".write": "auth != null",');
      console.log('         ".indexOn": ["createdBy"]');
      console.log('       },');
      console.log('       "roles": {');
      console.log('         ".read": "auth != null",');
      console.log('         ".write": "auth != null"');
      console.log('       }');
      console.log('     }');
      console.log('   }');
      console.log('═══════════════════════════════════════════');
    }
  }
  
  // Prueba 3: Verificar rol
  try {
    const roleSnap = await get(ref(db, `roles/${currentUserUid}`));
    const rd = roleSnap.val();
    console.log('📋 Rol en BD:', JSON.stringify(rd));
  } catch (err) {
    console.log('❌ No se pudo leer rol:', err.message);
  }
  
  console.log('═══════════════════════════════════════════');
}
window.diagnosticCoachAccess = diagnosticCoachAccess;

// Guardar referencia al listener activo para limpiarlo al reconectar
let _athletesListenerCleanup = null;

function initGlobalAthletesObserver() {
  // Limpiar listener anterior si existe (evita listeners duplicados)
  if (_athletesListenerCleanup) {
    _athletesListenerCleanup();
    _athletesListenerCleanup = null;
  }

  const athletesRef = ref(db, 'athletes');
  const uid = currentUserUid;

  if (currentUserRole === 'coach' && uid) {
    // Coach: leer todos los atletas (reglas permiten .read: "auth != null")
    // y filtrar en cliente por createdBy === uid
    console.log('🏃 Iniciando observer de atletas para coach UID:', uid);
    const unsub = onValue(athletesRef, (snapshot) => {
      const all = snapshot.val() || {};
      const totalCount = Object.keys(all).length;
      console.log('🏃 Coach: Firebase devolvió', totalCount, 'atletas totales');
      
      globalAthletes = {};
      let myCount = 0;
      Object.entries(all).forEach(([k, v]) => {
        if (v && v.createdBy === uid) {
          globalAthletes[k] = v;
          myCount++;
        }
      });
      
      console.log('🏃 Coach: de esos,', myCount, 'tienen createdBy ===', uid);
      
      if (myCount === 0 && totalCount > 0) {
        // Debug: mostrar algunos atletas para ver qué createdBy tienen
        const sample = Object.entries(all).slice(0, 3);
        sample.forEach(([k, v]) => {
          console.log('   📋 Atleta:', v.name, '| createdBy:', JSON.stringify(v.createdBy), '| personType:', v.personType);
        });
      }
      
      renderStandaloneAthleteList();
      renderPlayerRegistry();
    }, (err) => {
      console.error('❌ Coach: error leyendo /athletes:', err.code || err.message);
      // Intentar con query filtrado como fallback
      console.log('🔄 Intentando query filtrado...');
      const coachQuery = query(athletesRef, orderByChild('createdBy'), equalTo(uid));
      onValue(coachQuery, (snap) => {
        globalAthletes = snap.val() || {};
        console.log('🏃 Coach (query fallback):', Object.keys(globalAthletes).length, 'atletas');
        renderStandaloneAthleteList();
        renderPlayerRegistry();
      }, (e2) => {
        console.error('❌ Coach: ambos métodos fallaron:', e2.message);
        globalAthletes = {};
        renderStandaloneAthleteList();
      });
    });
    _athletesListenerCleanup = unsub;
  } else {
    // Admin: lee todos
    const unsub = onValue(athletesRef, (snapshot) => {
      globalAthletes = snapshot.val() || {};
      console.log('🏃 Admin ve', Object.keys(globalAthletes).length, 'atletas totales');
      renderStandaloneAthleteList();
      renderPlayerRegistry();
    }, (err) => {
      console.error('❌ Admin: error leyendo atletas:', err.message);
      globalAthletes = {};
      renderStandaloneAthleteList();
    });
    _athletesListenerCleanup = unsub;
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

  // ── Helper: fila de atleta (definido ANTES de usarse) ──────────────────────
  const buildAthleteRow = ([athleteId, p]) => {
    const catLabel = categoriesConfig[p.category]?.label || p.category || '---';
    const editable = canModifyAthlete(athleteId);
    return `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:5px;"><img src="${p.photo || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
        <td style="text-align:center;font-family:monospace;font-size:0.78rem;color:#ff6b00;font-weight:bold;">${p.playerID || '—'}</td>
        <td style="padding:5px;">${p.name}<br><small style="color:gray;">#${p.number || '--'} · ${p.club || ''}</small></td>
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

  // ── Helper: fila de entrenador (definido ANTES de usarse) ────────────────────
  const buildCoachRow = ([athleteId, p]) => {
    const catLabel = categoriesConfig[p.category]?.label || p.category || '---';
    const editable = canModifyAthlete(athleteId);
    return `
      <tr style="border-bottom:1px solid #1e3a2f;">
        <td style="padding:5px;"><img src="${p.photo || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #10b981;"></td>
        <td style="text-align:center;font-family:monospace;font-size:0.78rem;color:#10b981;font-weight:bold;">${p.playerID || '—'}</td>
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

  // ── Pre-construir sección de atletas agrupados por club ─────────────────────
  let athletesByClubHTML = '';
  if (athletes.length === 0) {
    athletesByClubHTML = '<p style="color:#888;font-style:italic;text-align:center;padding:15px;">No se encontraron atletas.</p>';
  } else {
    const byClub = {};
    athletes.forEach(entry => {
      const club = entry[1].club || '— Sin equipo —';
      if (!byClub[club]) byClub[club] = [];
      byClub[club].push(entry);
    });
    const clubNames = Object.keys(byClub).sort();
    athletesByClubHTML = clubNames.map(club => {
      const ownerTh = showOwnerCol ? '<th>Registrado por</th>' : '';
      const rows = byClub[club].map(buildAthleteRow).join('');
      const count = byClub[club].length;
      return '<div style="margin-bottom:22px;">' +
        '<div style="display:flex;align-items:center;gap:8px;background:#1a1a2e;padding:8px 12px;border-radius:8px 8px 0 0;border-left:4px solid #ff6b00;">' +
          '<span style="font-size:0.9rem;font-weight:bold;color:#ff6b00;">🛡️ ' + club + '</span>' +
          '<span style="background:#ff6b00;color:#fff;font-size:0.65rem;font-weight:bold;padding:1px 7px;border-radius:10px;">' + count + ' atleta' + (count !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;font-size:0.75rem;border-collapse:collapse;background:#111;color:white;">' +
            '<thead><tr style="background:#222;color:#ff6b00;">' +
              '<th>Foto</th><th>ID Afiliación</th><th>Nombre / #</th><th>Categoría</th><th>Médico</th><th>Responsable</th>' + ownerTh + '<th>Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div></div>';
    }).join('');
  }



  // ── Construir HTML completo ─────────────────────────────────────────────────
  let html = `
    <input type="text" id="standaloneSearchInput" placeholder="🔍 Buscar por nombre, club o ID..." value="${standaloneSearchTerm}"
      oninput="filterStandaloneAthletes(this.value)"
      style="width:100%; padding:8px 12px; margin:8px 0 16px 0; border-radius:6px; border:1px solid #334155; background:#0f172a; color:#fff; box-sizing:border-box;">

    <!-- SECCIÓN ATLETAS — agrupados por club/equipo -->
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
      <h4 style="margin:0; color:#ff6b00;">🏃 Atletas Registrados</h4>
      <span style="background:#ff6b00; color:#fff; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${athletes.length}/${totalAthletes}</span>
    </div>
    ${athletesByClubHTML}

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
          <th>ID Afiliación</th>
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
            <td style="font-family:monospace; font-size:0.8rem; color:#ff6b00; font-weight:bold;">${a.playerID || a.athleteID || '—'}</td>
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
           (a.club || '').toLowerCase().includes(t) ||
           String(a.playerID || a.athleteID || '').toLowerCase().includes(t);
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

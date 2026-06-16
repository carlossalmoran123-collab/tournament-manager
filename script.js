import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxBA6w3Ia4OwYrJidhpXVtR7-2SKnMWXw",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.appspot.com",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:b1d8305c48b2d6a59b646c"
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

const categoriesConfig = {
  "micro": { label: "👶 Micro", desc: "Años 2017 - 2018 y menores" },
  "infantil": { label: "🧒 Infantil", desc: "Años 2015 - 2016" },
  "pasarela": { label: "🏀 Pasarela", desc: "Años 2013 - 2014" },
  "cadetes": { label: "👦 Cadetes", desc: "Años 2011 - 2012" },
  "juvenil": { label: "👨 Juvenil", desc: "Años 2009 - 2010" },
  "juvenil-superior": { label: "👨 Juvenil Superior", desc: "Años 2007 - 2008" },
  "sub21": { label: "👨‍🎓 Sub 21", desc: "Categoría Universitaria Desarrollo" },
  "sub23": { label: "👨‍🎓 Sub 23", desc: "Categoría Universitaria Avanzada" }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('btnEnterApp')?.addEventListener('click', loadSelectedTournamentContext);
  
  document.getElementById('btnGoToAdminPrep')?.addEventListener('click', () => {
    switchSection('admin', true);
  });
  
  document.getElementById('btnBackToSelector')?.addEventListener('click', () => {
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
    const navMenu = document.querySelector('nav');
    if (navMenu) navMenu.style.display = 'block';
  });

  document.getElementById('teamForm')?.addEventListener('submit', handleTeamSubmit);
  document.getElementById('venueForm')?.addEventListener('submit', handleVenueSubmit);
  document.getElementById('matchForm')?.addEventListener('submit', handleMatchSubmit);
  document.getElementById('eventForm')?.addEventListener('submit', handleEventSubmit);

  initGlobalTournamentsObserver();
});

onAuthStateChanged(auth, (user) => {
  const loginBox = document.getElementById('admin-login-box');
  const adminPanels = document.getElementById('admin-dashboard-panels');

  if (user) {
    isAdmin = true;
    document.body.classList.add('is-admin');
    if (loginBox) loginBox.style.display = 'none';
    if (adminPanels) adminPanels.style.display = 'grid';
  } else {
    isAdmin = false;
    document.body.classList.remove('is-admin');
    if (loginBox) loginBox.style.display = 'flex';
    if (adminPanels) adminPanels.style.display = 'none';
  }
  renderCompetitionsSelector(); 
});

function initGlobalTournamentsObserver() {
  const tournamentsRef = ref(db, 'tournaments');
  onValue(tournamentsRef, (snapshot) => {
    globalTournaments = snapshot.val() || {};
    renderCompetitionsSelector();
  });
}

function attachTournamentRealtimeListeners(tournamentId) {
  const tRef = ref(db, `tournaments/${tournamentId}`);
  onValue(tRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    currentTournamentData = data;
    globalTeams = data.teams || {};
    globalVenues = data.venues || {};
    globalMatches = data.matches || {};

    document.getElementById('appTournamentTitle').innerText = data.name || "Torneo Sin Nombre";
    document.getElementById('appTournamentVenue').innerText = data.location || "Sede General";
    document.getElementById('appTournamentFormat').innerText = data.format || "Formato Regular";

    populateAdminDropdowns();
    renderDashboard();
    renderCategories();
    renderMatchesByVenue();
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
    const option = document.createElement('option');
    option.value = key;
    option.innerText = `🏆 ${t.name} — 📍 Sede: ${t.location || 'Por definir'}`;
    select.appendChild(option);
  });
}

function loadSelectedTournamentContext() {
  const select = document.getElementById('globalCompetitionSelect');
  const id = select?.value;
  if (!id || id === "") {
    alert("Por favor selecciona un evento válido antes de entrar.");
    return;
  }
  currentTournamentId = id;
  attachTournamentRealtimeListeners(id);

  const navMenu = document.querySelector('nav');
  if (navMenu) navMenu.style.display = 'block';

  document.getElementById('competition-selector-screen').style.display = 'none';
  document.getElementById('main-app-content').style.display = 'block';
  switchSection('dashboard');
}

export function switchSection(sectionId, fromGlobalSelector = false) {
  const navMenu = document.querySelector('nav');
  
  if (fromGlobalSelector) {
    document.getElementById('competition-selector-screen').style.display = 'none';
    document.getElementById('main-app-content').style.display = 'block';
    
    if (!currentTournamentId) {
      if (navMenu) navMenu.style.display = 'none';
      document.getElementById('appTournamentTitle').innerText = "Mesa de Control Global";
      document.getElementById('appTournamentVenue').innerText = "Configuración Inicial";
      document.getElementById('appTournamentFormat').innerText = "Ningún torneo cargado";
    }
    sectionId = 'admin';
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
}
window.switchSection = switchSection;

function renderDashboard() {
  const teamsArr = Object.values(globalTeams).filter(t => t.name);
  const matchesArr = Object.values(globalMatches).filter(m => m.date);

  document.getElementById('dashTeamsCount').innerText = teamsArr.length;
  document.getElementById('dashMatchesCount').innerText = matchesArr.length;

  const container = document.getElementById('dashboardTeamsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (teamsArr.length === 0) {
    container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color:#aaa;">Esperando registro de clubes...</p>';
    return;
  }

  teamsArr.forEach(team => {
    const catInfo = categoriesConfig[team.categoryRegistered];
    const catLabel = catInfo ? catInfo.label : "⏳ Lista de Espera";
    const pill = document.createElement('div');
    pill.className = 'team-pill';
    const logoUrl = team.logoUrl || 'https://placehold.co/40x40/007bff/ffffff?text=🏀';
    pill.innerHTML = `
      <img src="${logoUrl}" alt="Logo" onerror="this.src='https://placehold.co/40x40/007bff/ffffff?text=🏀'">
      <div>
        <strong>${team.name}</strong><br>
        <small style="color: #ff6b00;">${catLabel}</small>
      </div>
    `;
    container.appendChild(pill);
  });
}

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  container.innerHTML = '';

  const teamsArr = Object.entries(globalTeams).filter(([_, t]) => t.name);

  // 1. Renderizar Categorías Estándar con botón de eliminar para Admin
  Object.keys(categoriesConfig).forEach(catKey => {
    const catInfo = categoriesConfig[catKey];
    const filteredTeams = teamsArr.filter(([_, t]) => t.categoryRegistered === catKey);

    const card = document.createElement('div');
    card.className = 'category-card';
    
    let teamsListHtml = '<ul class="cat-teams-list" style="list-style: none; padding: 0;">';
    if (filteredTeams.length === 0) {
      teamsListHtml += '<li><span style="color:#aaa; font-style:italic;">Sin escuadras inscritas aún</span></li>';
    } else {
      filteredTeams.forEach(([teamId, t]) => {
        teamsListHtml += `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #333;">
            <span>🛡️ ${t.name}</span>
            ${isAdmin ? `<button onclick="deleteTeamFromApp('${teamId}', '${t.name}')" style="background: transparent; border: none; color: #ff4444; cursor: pointer; font-size: 14px; padding: 2px 6px;">🗑️</button>` : ''}
          </li>`;
      });
    }
    teamsListHtml += '</ul>';

    card.innerHTML = `
      <div class="category-card-header">
        <h4>${catInfo.label}</h4>
        <p>${catInfo.desc}</p>
      </div>
      <div class="category-card-body">
        <h5>Clubes Confirmados (${filteredTeams.length}):</h5>
        ${teamsListHtml}
      </div>
    `;
    container.appendChild(card);
  });

  // 2. Apartado de Equipos en Espera con opción de Asignar y Eliminar
  const waitingTeams = teamsArr.filter(([_, t]) => t.categoryRegistered === 'espera' || !t.categoryRegistered);
  
  const waitingCard = document.createElement('div');
  waitingCard.className = 'category-card';
  waitingCard.style.border = '2px dashed #ff6b00';
  waitingCard.style.background = '#1a1a24';

  let waitingListHtml = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">';
  
  if (waitingTeams.length === 0) {
    waitingListHtml += '<p style="color:#aaa; font-style:italic; padding: 5px;">No hay equipos en la banca de espera.</p>';
  } else {
    waitingTeams.forEach(([teamId, t]) => {
      let optionsHtml = '<option value="">-- Asignar Categ. --</option>';
      Object.entries(categoriesConfig).forEach(([key, val]) => {
        optionsHtml += `<option value="${key}">${val.label}</option>`;
      });

      waitingListHtml += `
        <div class="waiting-team-row" style="background:#252538; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <span style="font-weight:bold; color:#fff;">🛡️ ${t.name}</span>
          ${isAdmin ? `
            <div style="display:flex; gap:5px; align-items:center;">
              <select id="quickAssign-${teamId}" style="background:#111; color:#fff; border:1px solid #444; border-radius:4px; padding:3px; font-size:12px;">
                ${optionsHtml}
              </select>
              <button onclick="assignCategoryDirectly('${teamId}')" style="background:#ff6b00; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer;" title="Guardar Categoría">💾</button>
              <button onclick="deleteTeamFromApp('${teamId}', '${t.name}')" style="background:#ff4444; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer;" title="Eliminar del Torneo">🗑️</button>
            </div>
          ` : '<span style="font-size:11px; color:#ff6b00; font-style:italic;">Pendiente</span>'}
        </div>
      `;
    });
  }
  waitingListHtml += '</div>';

  waitingCard.innerHTML = `
    <div class="category-card-header" style="background: linear-gradient(135deg, #ff6b00, #b34a00);">
      <h4>📥 Lista de Espera</h4>
      <p>Equipos guardados sin una categoría definida aún.</p>
    </div>
    <div class="category-card-body">
      <h5>Equipos en la banca (${waitingTeams.length}):</h5>
      ${waitingListHtml}
    </div>
  `;
  container.appendChild(waitingCard);
}

function assignCategoryDirectly(teamId) {
  if (!currentTournamentId) return;
  const selectElement = document.getElementById(`quickAssign-${teamId}`);
  const selectedCat = selectElement?.value;

  if (!selectedCat || selectedCat === "") {
    alert("Por favor selecciona una categoría válida antes de guardar.");
    return;
  }

  const teamRef = ref(db, `tournaments/${currentTournamentId}/teams/${teamId}`);
  update(teamRef, { categoryRegistered: selectedCat })
    .then(() => {
      alert("✅ ¡Equipo incorporado a su categoría de manera exitosa!");
    })
    .catch(err => alert("Error al asignar: " + err.message));
}
window.assignCategoryDirectly = assignCategoryDirectly;

// NUEVA FUNCIÓN: Eliminar Equipo del Torneo Activo
function deleteTeamFromApp(teamId, teamName) {
  if (!currentTournamentId) return;
  if (confirm(`¿Estás seguro de que deseas eliminar por completo al equipo "${teamName}" de este torneo?`)) {
    const teamRef = ref(db, `tournaments/${currentTournamentId}/teams/${teamId}`);
    remove(teamRef)
      .then(() => alert(`🛡️ El equipo "${teamName}" fue removido exitosamente.`))
      .catch(err => alert("Error al eliminar equipo: " + err.message));
  }
}
window.deleteTeamFromApp = deleteTeamFromApp;

function renderMatchesByVenue() {
  const container = document.getElementById('venuesRolesContainer');
  if (!container) return;
  container.innerHTML = '';

  const venuesArr = Object.entries(globalVenues).filter(([_, v]) => v.name);
  const matchesArr = Object.entries(globalMatches).filter(([_, m]) => m.date);

  if (venuesArr.length === 0) {
    container.innerHTML = '<div class="welcome-card text-center"><p>No se han registrado canchas ni programación para este torneo.</p></div>';
    return;
  }

  venuesArr.forEach(([venueId, venue]) => {
    const venueSection = document.createElement('div');
    venueSection.className = 'venue-role-block';

    const mapsBtn = venue.mapsUrl ? `<a href="${venue.mapsUrl}" target="_blank" class="btn-maps-link">📍 Ver Ubicación en Maps</a>` : '';
    
    // MODIFICACIÓN: Inyección del botón "Eliminar Sede" si es Administrador
    const deleteVenueBtn = isAdmin ? `<button onclick="deleteVenueFromApp('${venueId}', '${venue.name}')" style="background:#ff4444; color:white; border:none; border-radius:4px; padding:6px 12px; font-size:12px; cursor:pointer; margin-top:8px; display:block;">🗑️ Eliminar Sede / Cancha</button>` : '';

    venueSection.innerHTML = `
      <div class="venue-title-header" style="position: relative;">
         <h3>🏢 Sede: ${venue.name}</h3>
         <p>📍 ${venue.address || 'Dirección no especificada'}</p>
         <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
           ${mapsBtn}
           ${deleteVenueBtn}
         </div>
      </div>
    `;

    const venueMatches = matchesArr.filter(([_, m]) => m.venueId === venueId);
    if (venueMatches.length === 0) {
      venueSection.innerHTML += '<p style="padding:20px; color:#999; font-style:italic;">No hay encuentros agendados en esta duela.</p>';
      container.appendChild(venueSection);
      return;
    }

    const matchesByDate = {};
    venueMatches.forEach(([mId, m]) => {
      if (!matchesByDate[m.date]) matchesByDate[m.date] = [];
      matchesByDate[m.date].push({ id: mId, ...m });
    });

    const sortedDates = Object.keys(matchesByDate).sort((a, b) => new Date(a) - new Date(b));

    sortedDates.forEach(date => {
      const dateBlock = document.createElement('div');
      dateBlock.className = 'date-role-block';

      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
      const formattedDate = new Date(date).toLocaleDateString('es-MX', options);
      
      dateBlock.innerHTML = `<h4 class="date-divider">📅 ${formattedDate.toUpperCase()}</h4>`;

      const matchesGrid = document.createElement('div');
      matchesGrid.className = 'matches-table-grid';

      matchesByDate[date].sort((a, b) => a.startTime.localeCompare(b.startTime));

      matchesByDate[date].forEach(match => {
        const catInfo = categoriesConfig[match.category];
        const catLabel = catInfo ? catInfo.label : "Libre";
        const matchCard = document.createElement('div');
        matchCard.className = 'match-schedule-card';
        
        matchCard.innerHTML = `
          <div class="match-time-badge">⏰ ${match.startTime} - ${match.endTime}</div>
          <div class="match-category-tag">${catLabel}</div>
          <div class="match-teams-vs">
             <div class="vs-team">🛡️ <strong>${match.localName}</strong> <small>(Local)</small></div>
             <div class="vs-divider">VS</div>
             <div class="vs-team">🛡️ <strong>${match.visitorName}</strong> <small>(Visitante)</small></div>
          </div>
          ${isAdmin ? `<button class="btn-delete-match" onclick="deleteMatchEvent('${match.id}')">🗑️ Eliminar Partido</button>` : ''}
        `;
        matchesGrid.appendChild(matchCard);
      });

      dateBlock.appendChild(matchesGrid);
      venueSection.appendChild(dateBlock);
    });

    container.appendChild(venueSection);
  });
}

// NUEVA FUNCIÓN: Eliminar Sede del Torneo Activo (Previene errores si hay partidos)
function deleteVenueFromApp(venueId, venueName) {
  if (!currentTournamentId) return;

  // Verificar si la sede tiene partidos asignados vigentes
  const matchesArr = Object.values(globalMatches);
  const totalMatchesInVenue = matchesArr.filter(m => m.venueId === venueId).length;

  if (totalMatchesInVenue > 0) {
    alert(`⚠️ No puedes eliminar la sede "${venueName}" porque tiene ${totalMatchesInVenue} partido(s) programado(s) en ella. Elimina primero los partidos desde la tabla de roles.`);
    return;
  }

  if (confirm(`¿Seguro que deseas eliminar la cancha/sede "${venueName}"? Esta acción no se puede deshacer.`)) {
    const venueRef = ref(db, `tournaments/${currentTournamentId}/venues/${venueId}`);
    remove(venueRef)
      .then(() => alert(`🏢 Sede "${venueName}" eliminada correctamente.`))
      .catch(err => alert("Error al eliminar la sede: " + err.message));
  }
}
window.deleteVenueFromApp = deleteVenueFromApp;

function populateAdminDropdowns() {
  const localSel = document.getElementById('selectLocal');
  const visitorSel = document.getElementById('selectVisitor');
  const venueSel = document.getElementById('selectMatchVenue');
  const teamCatSel = document.getElementById('regTeamCategory');

  if (!localSel || !visitorSel || !venueSel) return;

  localSel.innerHTML = '<option value="">-- Selecciona --</option>';
  visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';
  venueSel.innerHTML = '<option value="">-- Selecciona Cancha --</option>';

  Object.entries(globalTeams).forEach(([id, t]) => {
    if(!t.name || t.categoryRegistered === 'espera' || !t.categoryRegistered) return;
    const catInfo = categoriesConfig[t.categoryRegistered];
    const catBadge = catInfo ? catInfo.label : "S/C";
    localSel.innerHTML += `<option value="${id}">${t.name} (${catBadge})</option>`;
    visitorSel.innerHTML += `<option value="${id}">${t.name} (${catBadge})</option>`;
  });

  Object.entries(globalVenues).forEach(([id, v]) => {
    if(v.name) venueSel.innerHTML += `<option value="${id}">${v.name}</option>`;
  });

  if (teamCatSel) {
    teamCatSel.innerHTML = '<option value="espera">📥 Dejar en lista de espera (Sin categoría)</option>';
    Object.entries(categoriesConfig).forEach(([key, value]) => {
      teamCatSel.innerHTML += `<option value="${key}">${value.label}</option>`;
    });
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  try {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    
    await signInWithEmailAndPassword(auth, email, pass);
    alert("🔐 Acceso de Coach Concedido.");
    document.getElementById('loginForm').reset();
    switchSection('admin', !currentTournamentId);
  } catch (error) { 
    alert("Error de acceso: " + error.message); 
  }
}

async function handleLogout() {
  if (confirm("¿Seguro que deseas salir del modo administrador?")) {
    await signOut(auth);
    alert("Sesión protegida correctamente.");
    document.getElementById('btnBackToSelector').click();
  }
}

function handleTeamSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("⚠️ No has cargado ningún torneo.");

  const name = document.getElementById('regTeamName').value.trim();
  const logoUrl = document.getElementById('regTeamLogo').value.trim();
  const categoryRegistered = document.getElementById('regTeamCategory')?.value || "espera"; 

  const teamsRef = ref(db, `tournaments/${currentTournamentId}/teams`);
  const newTeamRef = push(teamsRef);

  set(newTeamRef, { name, logoUrl, categoryRegistered })
    .then(() => {
      alert(categoryRegistered === "espera" ? "📥 Guardado en la Lista de Espera temporal." : "🏆 Equipo guardado con éxito.");
      document.getElementById('teamForm').reset();
    }).catch(err => alert("Error: " + err.message));
}

function handleVenueSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("⚠️ No has cargado ningún torneo.");

  const name = document.getElementById('venueName').value.trim();
  const address = document.getElementById('venueAddress').value.trim();
  const mapsUrl = document.getElementById('venueMapsUrl').value.trim();

  const venuesRef = ref(db, `tournaments/${currentTournamentId}/venues`);
  const newVenueRef = push(venuesRef);

  set(newVenueRef, { name, address, mapsUrl })
    .then(() => {
      alert("📍 Sede añadida.");
      document.getElementById('venueForm').reset();
    }).catch(err => alert("Error: " + err.message));
}

function handleMatchSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("⚠️ No has cargado ningún torneo.");

  const category = document.getElementById('matchCategory').value;
  const localId = document.getElementById('selectLocal').value;
  const visitorId = document.getElementById('selectVisitor').value;
  const date = document.getElementById('matchDate').value;
  const startTime = document.getElementById('matchStartTime').value;
  const endTime = document.getElementById('matchEndTime').value;
  const venueId = document.getElementById('selectMatchVenue').value;

  if (!localId || !visitorId) {
    alert("⚠️ Debes elegir dos equipos asignados para programar.");
    return;
  }

  if (localId === visitorId) {
    alert("⚠️ Un equipo no puede jugar contra sí mismo.");
    return;
  }

  const localName = globalTeams[localId].name;
  const visitorName = globalTeams[visitorId].name;

  const matchesRef = ref(db, `tournaments/${currentTournamentId}/matches`);
  const newMatchRef = push(matchesRef);

  set(newMatchRef, {
    category, localId, localName, visitorId, visitorName,
    date, startTime, endTime, venueId
  }).then(() => {
    alert("📅 Partido indexado.");
    document.getElementById('matchForm').reset();
  }).catch(err => alert("Error: " + err.message));
}

function handleEventSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('eventName').value.trim();
  const location = document.getElementById('eventLocation').value.trim();
  const maxTeams = document.getElementById('eventTeams').value;
  const format = document.getElementById('competitionFormat').value;
  const description = document.getElementById('eventDescription').value.trim();

  const rootTournamentsRef = ref(db, 'tournaments');
  const newTournamentRef = push(rootTournamentsRef);

  set(newTournamentRef, {
    name, 
    location, 
    maxTeams: parseInt(maxTeams) || 20, 
    format, 
    description,
    teams: { placeholder: true }, 
    matches: { placeholder: true }, 
    venues: { placeholder: true }
  }).then(() => {
    alert("➕ ¡Nuevo Evento Maestro creado con éxito!");
    document.getElementById('eventForm').reset();
    document.getElementById('btnBackToSelector').click();
  }).catch(err => alert("Error al crear evento: " + err.message));
}

function deleteMatchEvent(matchId) {
  if (!currentTournamentId) return;
  if (confirm("¿Deseas eliminar este partido?")) {
    const matchRef = ref(db, `tournaments/${currentTournamentId}/matches/${matchId}`);
    remove(matchRef)
      .then(() => alert("Partido eliminado."))
      .catch(err => alert("Error: " + err.message));
  }
}
window.deleteMatchEvent = deleteMatchEvent;
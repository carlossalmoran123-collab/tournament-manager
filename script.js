import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Categorías Oficiales - Corrección en la descripción de Micro aplicada
const categoriesConfig = {
  "chupon": { label: "🍼 Chupon", desc: "Iniciación y psicomotricidad básica (4-6 años)" },
  "micro": { label: "👶 Micro", desc: "Años 2017 - 2018" },
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

  document.getElementById('matchCategory')?.addEventListener('change', updateFilteredTeamsDropdowns);

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
  // Forzar repintado de categorías para activar/desactivar botones de eliminación según el rol
  if (currentTournamentId) {
    renderCategories();
  }
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

    populateStaticAdminDropdowns();
    updateFilteredTeamsDropdowns();
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

function switchSection(sectionId, fromGlobalSelector = false) {
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
  const teamsArr = Object.values(globalTeams).filter(t => t && t.name);

  document.getElementById('dashTeamsCount').innerText = teamsArr.length;
  document.getElementById('dashMatchesCount').innerText = Object.values(globalMatches).filter(m => m && m.date).length;

  const container = document.getElementById('dashboardTeamsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (teamsArr.length === 0) {
    container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color:#aaa;">Esperando registro de clubes...</p>';
    return;
  }

  teamsArr.forEach(team => {
    const catInfo = categoriesConfig[team.categoryRegistered];
    const catLabel = catInfo ? catInfo.label : "⚠️ Sin Categoría";
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

  const teamsArr = Object.entries(globalTeams).filter(([_, t]) => t && t.name);

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
        // El botón 🗑️ se renderiza condicionalmente si isAdmin es true
        teamsListHtml += `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #333;">
            <span>🛡️ ${t.name}</span>
            ${isAdmin ? `<button onclick="deleteTeamFromApp('${teamId}', '${t.name}')" class="btn-inline-delete" title="Eliminar equipo">🗑️</button>` : ''}
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
}

function deleteTeamFromApp(teamId, teamName) {
  if (!currentTournamentId) return;
  
  // Validar si el equipo tiene partidos agendados antes de borrarlo para evitar romper los roles
  const matchesArr = Object.values(globalMatches).filter(m => m);
  const hasMatches = matchesArr.some(m => m.localId === teamId || m.visitorId === teamId);

  if (hasMatches) {
    alert(`⚠️ No se puede eliminar a "${teamName}" porque ya cuenta con partidos programados en el rol de juegos. Elimina primero sus partidos.`);
    return;
  }

  if (confirm(`¿Estás seguro de que deseas eliminar por completo al equipo "${teamName}" de esta categoría?`)) {
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

  const venuesArr = Object.entries(globalVenues).filter(([_, v]) => v && v.name);
  const matchesArr = Object.entries(globalMatches).filter(([_, m]) => m && m.date);

  if (venuesArr.length === 0) {
    container.innerHTML = '<div class="welcome-card text-center"><p>No se han registrado canchas ni programación para este torneo.</p></div>';
    return;
  }

  venuesArr.forEach(([venueId, venue]) => {
    const venueSection = document.createElement('div');
    venueSection.className = 'venue-role-block';

    const mapsBtn = venue.mapsUrl ? `<a href="${venue.mapsUrl}" target="_blank" class="btn-maps-link">📍 Ver Ubicación en Maps</a>` : '';
    const deleteVenueBtn = isAdmin ? `<button onclick="deleteVenueFromApp('${venueId}', '${venue.name}')" style="background:#ff4444; color:white; border:none; border-radius:4px; padding:6px 12px; font-size:12px; cursor:pointer; margin-top:8px; display:block;">🗑️ Eliminar Sede</button>` : '';

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

function deleteVenueFromApp(venueId, venueName) {
  if (!currentTournamentId) return;

  const matchesArr = Object.values(globalMatches).filter(m => m);
  const totalMatchesInVenue = matchesArr.filter(m => m.venueId === venueId).length;

  if (totalMatchesInVenue > 0) {
    alert(`⚠️ No puedes eliminar la sede "${venueName}" porque tiene ${totalMatchesInVenue} partido(s) programado(s).`);
    return;
  }

  if (confirm(`¿Seguro que deseas eliminar la sede "${venueName}"?`)) {
    const venueRef = ref(db, `tournaments/${currentTournamentId}/venues/${venueId}`);
    remove(venueRef)
      .then(() => alert(`🏢 Sede "${venueName}" eliminada correctamente.`))
      .catch(err => alert("Error al eliminar la sede: " + err.message));
  }
}
window.deleteVenueFromApp = deleteVenueFromApp;

function populateStaticAdminDropdowns() {
  const venueSel = document.getElementById('selectMatchVenue');
  const teamCatSel = document.getElementById('regTeamCategory');

  if (venueSel) {
    venueSel.innerHTML = '<option value="">-- Selecciona Cancha --</option>';
    Object.entries(globalVenues).forEach(([id, v]) => {
      if(v && v.name) venueSel.innerHTML += `<option value="${id}">${v.name}</option>`;
    });
  }

  if (teamCatSel) {
    teamCatSel.innerHTML = '';
    Object.entries(categoriesConfig).forEach(([key, value]) => {
      teamCatSel.innerHTML += `<option value="${key}">${value.label}</option>`;
    });
  }
}

function updateFilteredTeamsDropdowns() {
  const matchCategorySelect = document.getElementById('matchCategory');
  const localSel = document.getElementById('selectLocal');
  const visitorSel = document.getElementById('selectVisitor');

  if (!matchCategorySelect || !localSel || !visitorSel) return;

  const selectedCategory = matchCategorySelect.value; 

  localSel.innerHTML = '<option value="">-- Selecciona --</option>';
  visitorSel.innerHTML = '<option value="">-- Selecciona --</option>';

  Object.entries(globalTeams).forEach(([id, t]) => {
    if (!t || !t.name) return;
    
    if (t.categoryRegistered === selectedCategory) {
      localSel.innerHTML += `<option value="${id}">${t.name}</option>`;
      visitorSel.innerHTML += `<option value="${id}">${t.name}</option>`;
    }
  });
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
  const categoryRegistered = document.getElementById('regTeamCategory').value; 

  if (!categoryRegistered) {
    alert("⚠️ Debes seleccionar una categoría obligatoriamente.");
    return;
  }

  const teamsRef = ref(db, `tournaments/${currentTournamentId}/teams`);
  const newTeamRef = push(teamsRef);

  set(newTeamRef, { name, logoUrl, categoryRegistered })
    .then(() => {
      alert(`🏆 Equipo "${name}" registrado con éxito en la categoría ${categoriesConfig[categoryRegistered].label}.`);
      document.getElementById('teamForm').reset();
      populateStaticAdminDropdowns(); 
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
      populateStaticAdminDropdowns();
    }).catch(err => alert("Error: " + err.message));
}

function handleMatchSubmit(e) {
  e.preventDefault();
  if (!currentTournamentId) return alert("⚠️ No has cargado ningún torneo.");

  const matchCategorySelect = document.getElementById('matchCategory');
  const activeCategory = matchCategorySelect.value;

  const localId = document.getElementById('selectLocal').value;
  const visitorId = document.getElementById('selectVisitor').value;
  const date = document.getElementById('matchDate').value;
  const startTime = document.getElementById('matchStartTime').value;
  const endTime = document.getElementById('matchEndTime').value;
  const venueId = document.getElementById('selectMatchVenue').value;

  if (!localId || !visitorId) {
    alert("⚠️ Debes elegir dos equipos válidos para programar.");
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
    category: activeCategory, localId, localName, visitorId, visitorName,
    date, startTime, endTime, venueId
  }).then(() => {
    alert("📅 Partido indexado al rol.");
    document.getElementById('matchForm').reset();
    
    matchCategorySelect.value = activeCategory;
    updateFilteredTeamsDropdowns(); 
  }).catch(err => alert("Error: " + err.message));
}

function handleEventSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('eventName').value.trim();
  const location = document.getElementById('eventLocation').value.trim();
  const maxTeams = document.getElementById('eventTeams').value;
  const format = document.getElementById('competitionFormat').value;
  const description = document.getElementById('eventDescription').value.trim();

  if (!name) {
    alert("⚠️ El nombre del torneo es obligatorio.");
    return;
  }

  const rootTournamentsRef = ref(db, 'tournaments');
  const newTournamentRef = push(rootTournamentsRef);

  set(newTournamentRef, {
    name, 
    location: location || "Por definir", 
    maxTeams: parseInt(maxTeams) || 20, 
    format, 
    description,
    status: "active"
  }).then(() => {
    alert("🏆 ¡Nuevo Evento Maestro creado con éxito!");
    document.getElementById('eventForm').reset();
    if (document.getElementById('btnBackToSelector')) {
      document.getElementById('btnBackToSelector').click();
    }
  }).catch(err => {
    alert("Error al crear el torneo: " + err.message);
  });
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
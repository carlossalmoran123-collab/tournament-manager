import { initializeApp } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, getDoc, deleteDoc, updateDoc, onSnapshot } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBO9aONmgDYECQOwI-NDorIAP88FekJuU0",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.firebasestorage.app",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:c14326668c6c31631fe44f",
  measurementId: "G-3X518EN8K0"
};

// Inicialización de servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdmin = false;
let currentCompetitionId = null; 
let dashboardCache = null;
let unsubscribeMatches = null;   
let unsubscribeTeams = null; // Escucha de equipos en tiempo real

// Observador de sesión
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    document.body.classList.add('is-admin');
  } else {
    isAdmin = false;
    document.body.classList.remove('is-admin');
  }
  renderCompetitionsSelector(); 
});

// Categorías oficiales de básquetbol
const CATEGORIES = [
  { id: 'micro-infantil', name: 'Micro Infantil', icon: '👶' },
  { id: 'pasarela', name: 'Pasarela', icon: '🧒' },
  { id: 'cadetes', name: 'Cadetes', icon: '👦' },
  { id: 'juvenil', name: 'Juvenil', icon: '👨' },
  { id: 'juvenil-superior', name: 'Juvenil Superior', icon: '👨' },
  { id: 'sub21', name: 'Sub 21', icon: '👨‍🎓' },
  { id: 'sub23', name: 'Sub 23', icon: '👨‍🎓' }
];

// --- GESTIÓN DE CONSULTAS FIRESTORE ---
class TournamentManager {
  async createCompetition(name, season) {
    const docRef = await addDoc(collection(db, "competitions"), { name, season, createdAt: new Date().toISOString() });
    return docRef.id;
  }

  async getCompetitions() {
    const snap = await getDocs(collection(db, "competitions"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async createTeam(name, logoUrl) {
    await addDoc(collection(db, "teams"), { name, logoUrl, competitionId: currentCompetitionId });
  }

  async createEvent(eventData) {
    await addDoc(collection(db, "events"), { ...eventData, competitionId: currentCompetitionId, teams: [], matches: [] });
    dashboardCache = null; 
  }

  async getEventsByCategory(categoryId) {
    const q = query(collection(db, "events"), where("competitionId", "==", currentCompetitionId), where("category", "==", categoryId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createMatch(matchData) {
    await addDoc(collection(db, "matches"), { ...matchData, competitionId: currentCompetitionId, status: "pendiente", scoreLocal: 0, scoreVisitor: 0 });
  }

  async updateMatchScore(matchId, scoreLocal, scoreVisitor) {
    const docRef = doc(db, "matches", matchId);
    await updateDoc(docRef, { scoreLocal, scoreVisitor, status: "finalizado" });
  }

  async getEvent(eventId) {
    const docSnap = await getDoc(doc(db, "events", eventId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  async deleteEvent(eventId) {
    await deleteDoc(doc(db, "events", eventId));
    dashboardCache = null;
  }
}

const manager = new TournamentManager();

// --- INICIALIZADORES ---
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  renderCompetitionsSelector();
});

function initializeEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() { switchSection(this.dataset.section); });
  });

  document.getElementById('btn-back-to-selector')?.addEventListener('click', () => {
    if (unsubscribeMatches) { unsubscribeMatches(); unsubscribeMatches = null; } 
    if (unsubscribeTeams) { unsubscribeTeams(); unsubscribeTeams = null; }
    currentCompetitionId = null;
    dashboardCache = null;
    
    document.getElementById('activeCompTitle').parentNode.style.display = 'flex'; 
    document.querySelector('.nav-tabs').style.display = 'flex';
    
    document.getElementById('main-app-content').style.display = 'none';
    document.getElementById('competition-selector-screen').style.display = 'flex';
    renderCompetitionsSelector();
  });

  document.getElementById('btn-show-create-comp')?.addEventListener('click', () => {
    document.getElementById('compModal').classList.add('show');
  });
  document.querySelector('.close-comp')?.addEventListener('click', () => {
    document.getElementById('compModal').classList.remove('show');
  });

  document.getElementById('compForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('compName').value;
    const season = document.getElementById('compSeason').value;
    await manager.createCompetition(name, season);
    alert("🏆 Nueva competición añadida con éxito.");
    document.getElementById('compForm').reset();
    document.getElementById('compModal').classList.remove('show');
    renderCompetitionsSelector();
  });

  // NUEVO FORMULARIO: Registrar Equipo en la Base de Datos
  document.getElementById('teamForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regTeamName').value.trim();
    const defaultLogo = "https://cdn-icons-png.flaticon.com/512/5267/5267337.png";
    const logoUrl = document.getElementById('regTeamLogo').value.trim() || defaultLogo;

    try {
      await manager.createTeam(name, logoUrl);
      alert(`🛡️ Equipo "${name}" registrado con éxito en este torneo.`);
      document.getElementById('teamForm').reset();
    } catch (err) {
      alert("Error al guardar equipo: " + err.message);
    }
  });

  document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await manager.createEvent({
      category: document.getElementById('eventCategory').value,
      name: document.getElementById('eventName').value,
      location: document.getElementById('eventLocation').value,
      teamsCount: parseInt(document.getElementById('eventTeams').value) || 0,
      format: document.getElementById('competitionFormat').value,
      description: document.getElementById('eventDescription').value
    });
    alert('✅ Torneo publicado con éxito.');
    document.getElementById('eventForm').reset();
    switchSection('dashboard');
  });

  // MODIFICADO: Agendar partido recuperando info de los selectores desplegables
  document.getElementById('matchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const localSelect = document.getElementById('selectLocal');
    const visitorSelect = document.getElementById('selectVisitor');

    const localName = localSelect.options[localSelect.selectedIndex].text;
    const localLogo = localSelect.value;

    const visitorName = visitorSelect.options[visitorSelect.selectedIndex].text;
    const visitorLogo = visitorSelect.value;

    if (!localLogo || !visitorLogo) {
      alert("⚠️ Por favor selecciona ambos equipos.");
      return;
    }

    if (localLogo === visitorLogo) {
      alert("❌ Un equipo no puede jugar contra sí mismo.");
      return;
    }

    await manager.createMatch({
      category: document.getElementById('matchCategory').value,
      local: localName,
      localLogo: localLogo,
      visitor: visitorName,
      visitorLogo: visitorLogo,
      dateTime: document.getElementById('matchDateTime').value,
      court: document.getElementById('matchCourt').value
    });
    
    alert('📅 Encuentro enlazado y agendado con éxito.');
    document.getElementById('matchForm').reset();
    switchSection('roles');
  });

  document.getElementById('scoreForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scoreMatchId').value;
    const local = parseInt(document.getElementById('scoreLocal').value);
    const visitor = parseInt(document.getElementById('scoreVisitor').value);
    await manager.updateMatchScore(id, local, visitor);
    alert('🏀 Marcador actualizado en la nube.');
    document.getElementById('scoreModal').classList.remove('show');
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  document.querySelector('.close')?.addEventListener('click', () => document.getElementById('eventModal').classList.remove('show'));
  document.querySelector('.close-score')?.addEventListener('click', () => document.getElementById('scoreModal').classList.remove('show'));
}

async function renderCompetitionsSelector() {
  const list = document.getElementById('competitionsList');
  if (!list) return;
  const comps = await manager.getCompetitions();
  if(comps.length === 0) {
    list.innerHTML = '<p style="color:#aaa; grid-column: 1/-1;">No hay competiciones creadas aún.</p>';
    return;
  }
  list.innerHTML = comps.map(c => `
    <div class="comp-card" onclick="selectCompetition('${c.id}', '${c.name}')">
      <h4>🏆 ${c.name}</h4>
      <p>${c.season}</p>
    </div>
  `).join('');
}

window.selectCompetition = function(id, name) {
  currentCompetitionId = id;
  document.getElementById('activeCompTitle').textContent = name;
  document.getElementById('competition-selector-screen').style.display = 'none';
  document.getElementById('main-app-content').style.display = 'block';
  
  // Activar escucha en tiempo real de los equipos para los dropdowns
  listenToTeams();
  switchSection('dashboard');
};

// NUEVA FUNCIÓN: Escucha la lista de equipos y llena los inputs dinámicamente
function listenToTeams() {
  if (unsubscribeTeams) unsubscribeTeams();

  const q = query(collection(db, "teams"), where("competitionId", "==", currentCompetitionId));
  
  unsubscribeTeams = onSnapshot(q, (snapshot) => {
    const localDropdown = document.getElementById('selectLocal');
    const visitorDropdown = document.getElementById('selectVisitor');
    
    if(!localDropdown || !visitorDropdown) return;

    let optionsHtml = '<option value="">-- Selecciona Equipo --</option>';
    
    snapshot.docs.forEach(doc => {
      const team = doc.data();
      // Guardamos la URL del logo como el valor del option
      optionsHtml += `<option value="${team.logoUrl}">${team.name}</option>`;
    });

    localDropdown.innerHTML = optionsHtml;
    visitorDropdown.innerHTML = optionsHtml;
  });
}

function switchSection(sectionId, fromGlobalSelector = false) {
  if (sectionId === 'login' && fromGlobalSelector) {
    document.getElementById('competition-selector-screen').style.display = 'none';
    document.getElementById('main-app-content').style.display = 'block';
    document.getElementById('activeCompTitle').parentNode.style.display = 'none'; 
    document.querySelector('.nav-tabs').style.display = 'none';
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

  if (sectionId === 'dashboard') renderDashboard();
  else if (sectionId === 'categories') renderCategories();
  else if (sectionId === 'roles') renderMatches();
}

async function renderDashboard() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  if (dashboardCache) { grid.innerHTML = dashboardCache; return; }
  grid.innerHTML = '<div class="no-events">Procesando liga...</div>';
  
  try {
    const results = await Promise.all(CATEGORIES.map(c => manager.getEventsByCategory(c.id)));
    let html = '';
    CATEGORIES.forEach((cat, idx) => {
      html += `
        <div class="category-card" onclick="switchSection('categories')">
          <h3>${cat.icon} ${cat.name}</h3>
          <div class="stats">
            <div class="stat"><div class="stat-value">${results[idx].length}</div><div class="stat-label">Torneos</div></div>
          </div>
        </div>
      `;
    });
    dashboardCache = html;
    grid.innerHTML = html;
  } catch (error) { console.error(error); }
}

async function renderCategories() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  container.innerHTML = '<div class="no-events">Sincronizando categorías...</div>';

  try {
    const results = await Promise.all(CATEGORIES.map(c => manager.getEventsByCategory(c.id)));
    container.innerHTML = CATEGORIES.map((cat, idx) => {
      let li = results[idx].length > 0 
        ? results[idx].map(e => `<li onclick="viewEvent('${e.id}')">📅 ${e.name} <br><small>📍 ${e.location}</small></li>`).join('')
        : '<li class="no-events">Sin torneos activos</li>';
      return `<div class="category-detail"><h3>${cat.icon} ${cat.name}</h3><ul class="events-list">${li}</ul></div>`;
    }).join('');
  } catch (error) { console.error(error); }
}

async function renderMatches() {
  const container = document.getElementById('matchesListContainer');
  if (!container) return;
  container.innerHTML = '<div class="no-events">Conectando con la mesa de control en vivo...</div>';

  if (unsubscribeMatches) { unsubscribeMatches(); } 
  const q = query(collection(db, "matches"), where("competitionId", "==", currentCompetitionId));

  unsubscribeMatches = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = '<div class="no-events">No hay partidos programados todavía.</div>';
      return;
    }

    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    matches.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    container.innerHTML = matches.map(m => {
      const isFinal = m.status === 'finalizado';
      const scoreText = isFinal ? `${m.scoreLocal} - ${m.scoreVisitor}` : 'VS';
      const badgeClass = isFinal ? 'score-badge' : 'score-badge pending';
      const dateFormatted = new Date(m.dateTime).toLocaleString('es-MX', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const defShield = "https://cdn-icons-png.flaticon.com/512/5267/5267337.png";
      const imgLocal = m.localLogo || defShield;
      const imgVisitor = m.visitorLogo || defShield;
      
      return `
        <div class="match-card">
          <div class="match-info">
            <span class="tag">${m.category.toUpperCase()}</span>
            <p>📍 Cancha: <strong>${m.court}</strong></p>
            <p>⏰ ${dateFormatted} hrs</p>
          </div>
          <div class="match-vs-box">
            <div class="team-box local">
              <span>${m.local}</span>
              <img src="${imgLocal}" class="team-logo" alt="logo">
            </div>
            <span class="${badgeClass}">${scoreText}</span>
            <div class="team-box visitor">
              <img src="${imgVisitor}" class="team-logo" alt="logo">
              <span>${m.visitor}</span>
            </div>
          </div>
          <button class="btn-danger admin-only-block" onclick="openScoreModal('${m.id}', '${m.local}', '${m.visitor}')" style="padding:5px 10px; font-size:0.85em; margin-top:5px;">
            ✍️ Capturar Marcador
          </button>
        </div>
      `;
    }).join('');
  }, (error) => {
    container.innerHTML = '<div class="no-events">Error de enlace real.</div>';
    console.error(error);
  });
}

window.openScoreModal = function(id, local, visitor) {
  document.getElementById('scoreMatchId').value = id;
  document.getElementById('lblLocal').textContent = local;
  document.getElementById('lblVisitor').textContent = visitor;
  document.getElementById('scoreLocal').value = '';
  document.getElementById('scoreVisitor').value = '';
  document.getElementById('scoreModal').classList.add('show');
};

async function viewEvent(eventId) {
  const event = await manager.getEvent(eventId);
  if (!event) return;
  const modal = document.getElementById('eventModal');
  document.getElementById('modalTitle').textContent = event.name;
  document.getElementById('modalBody').innerHTML = `
    <p><strong>Categoría:</strong> ${event.category.toUpperCase()}</p>
    <p><strong>Sede:</strong> ${event.location}</p>
    <p><strong>Cupo:</strong> ${event.teamsCount} Equipos</p>
    <button class="btn-danger admin-only-block" onclick="deleteEvent('${eventId}')" style="margin-top:20px; width:100%;">Eliminar Torneo</button>
  `;
  modal.classList.add('show');
}

window.deleteEvent = async function(id) {
  if (confirm('¿Deseas eliminar este torneo?')) {
    await manager.deleteEvent(id);
    document.getElementById('eventModal').classList.remove('show');
    renderCategories();
  }
};

async function handleLoginSubmit(e) {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    alert("🔐 Acceso de Coach Concedido.");
    document.getElementById('loginForm').reset();
    document.getElementById('btn-back-to-selector').click();
  } catch (error) { alert("Error de acceso: " + error.message); }
}

async function handleLogout() {
  await signOut(auth);
  alert("Sesión cerrada.");
  document.getElementById('btn-back-to-selector').click();
}

window.switchSection = switchSection;
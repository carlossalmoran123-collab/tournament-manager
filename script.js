import { initializeApp } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, getDoc, deleteDoc, updateDoc } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBO9aONmgDYECQOwI-NDorIAP88FekJuU0",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.firebasestorage.app",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:c14326668c6c31631fe44f",
  measurementId: "G-3X518EN8K0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdmin = false;
let currentCompetitionId = null; // 🏆 Almacena la competición seleccionada activa
let dashboardCache = null;

// Observador de sesión
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    document.body.classList.add('is-admin');
  } else {
    isAdmin = false;
    document.body.classList.remove('is-admin');
  }
  renderCompetitionsSelector(); // Refrescar el selector para activar botones de admin
});

const CATEGORIES = [
  { id: 'micro-infantil', name: 'Micro Infantil', icon: '👶' },
  { id: 'pasarela', name: 'Pasarela', icon: '🧒' },
  { id: 'cadetes', name: 'Cadetes', icon: '👦' },
  { id: 'juvenil', name: 'Juvenil', icon: '👨' },
  { id: 'juvenil-superior', name: 'Juvenil Superior', icon: '👨' },
  { id: 'sub21', name: 'Sub 21', icon: '👨‍🎓' },
  { id: 'sub23', name: 'Sub 23', icon: '👨‍🎓' }
];

// --- APIS DE FIRESTORE MODIFICADAS ---
class TournamentManager {
  // Guardar ligas globales
  async createCompetition(name, season) {
    const docRef = await addDoc(collection(db, "competitions"), { name, season, createdAt: new Date().toISOString() });
    return docRef.id;
  }
  async getCompetitions() {
    const snap = await getDocs(collection(db, "competitions"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  // Filtrar torneos por liga y categoría
  async createEvent(eventData) {
    await addDoc(collection(db, "events"), { ...eventData, competitionId: currentCompetitionId, teams: [], matches: [] });
    dashboardCache = null;
  }
  async getEventsByCategory(categoryId) {
    const q = query(collection(db, "events"), where("competitionId", "==", currentCompetitionId), where("category", "==", categoryId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  // Gestión de Roles / Partidos
  async createMatch(matchData) {
    await addDoc(collection(db, "matches"), { ...matchData, competitionId: currentCompetitionId, status: "pendiente", scoreLocal: 0, scoreVisitor: 0 });
    dashboardCache = null;
  }
  async getMatches() {
    const q = query(collection(db, "matches"), where("competitionId", "==", currentCompetitionId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  renderCompetitionsSelector();
});

function initializeEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() { switchSection(this.dataset.section); });
  });

  document.getElementById('btn-back-to-selector')?.addEventListener('click', () => {
    currentCompetitionId = null;
    dashboardCache = null;
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
    alert("🏆 Nueva competición añadida con éxito");
    document.getElementById('compForm').reset();
    document.getElementById('compModal').classList.remove('show');
    renderCompetitionsSelector();
  });

  document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await manager.createEvent({
      category: document.getElementById('eventCategory').value,
      name: document.getElementById('eventName').value,
      date: document.getElementById('eventDate').value,
      location: document.getElementById('eventLocation').value,
      teamsCount: parseInt(document.getElementById('eventTeams').value) || 0,
      format: document.getElementById('competitionFormat').value,
      description: document.getElementById('eventDescription').value
    });
    alert('✅ Torneo publicado');
    document.getElementById('eventForm').reset();
    switchSection('dashboard');
  });

  document.getElementById('matchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await manager.createMatch({
      category: document.getElementById('matchCategory').value,
      local: document.getElementById('teamLocal').value,
      visitor: document.getElementById('teamVisitor').value,
      dateTime: document.getElementById('matchDateTime').value,
      court: document.getElementById('matchCourt').value
    });
    alert('📅 Encuentro agendado en el rol');
    document.getElementById('matchForm').reset();
    renderMatches();
  });

  document.getElementById('scoreForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('scoreMatchId').value;
    const local = parseInt(document.getElementById('scoreLocal').value);
    const visitor = parseInt(document.getElementById('scoreVisitor').value);
    await manager.updateMatchScore(id, local, visitor);
    alert('🏀 Marcador actualizado permanentemente');
    document.getElementById('scoreModal').classList.remove('remove');
    document.getElementById('scoreModal').classList.remove('show');
    renderMatches();
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.querySelector('.close')?.addEventListener('click', () => document.getElementById('eventModal').classList.remove('show'));
  document.querySelector('.close-score')?.addEventListener('click', () => document.getElementById('scoreModal').classList.remove('show'));
}

// --- SELECTOR DE COMPETICIONES ---
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
  switchSection('dashboard');
};

function switchSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

  if (sectionId === 'dashboard') renderDashboard();
  else if (sectionId === 'categories') renderCategories();
  else if (sectionId === 'roles') renderMatches();
}

// --- RENDER DE TABLEROS ---
async function renderDashboard() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid || dashboardCache) { if(dashboardCache) grid.innerHTML = dashboardCache; return; }
  grid.innerHTML = 'Procesando liga...';
  
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
}

async function renderCategories() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  const results = await Promise.all(CATEGORIES.map(c => manager.getEventsByCategory(c.id)));
  
  container.innerHTML = CATEGORIES.map((cat, idx) => {
    let li = results[idx].length > 0 
      ? results[idx].map(e => `<li onclick="viewEvent('${e.id}')">📅 ${e.name} <br><small>📍 ${e.location}</small></li>`).join('')
      : '<li class="no-events">Sin torneos activos</li>';
    return `<div class="category-detail"><h3>${cat.icon} ${cat.name}</h3><ul class="events-list">${li}</ul></div>`;
  }).join('');
}

// --- RENDER DE ROLES Y MARCADORES ---
async function renderMatches() {
  const container = document.getElementById('matchesListContainer');
  if (!container) return;
  container.innerHTML = 'Cargando rol de juegos...';
  
  const matches = await manager.getMatches();
  if(matches.length === 0) {
    container.innerHTML = '<div class="no-events">No hay partidos programados todavía en este torneo.</div>';
    return;
  }

  // Ordenar por fecha
  matches.sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));

  container.innerHTML = matches.map(m => {
    const isFinal = m.status === 'finalizado';
    const scoreText = isFinal ? `${m.scoreLocal} - ${m.scoreVisitor}` : 'VS';
    const badgeClass = isFinal ? 'score-badge' : 'score-badge pending';
    const dateFormatted = new Date(m.dateTime).toLocaleString('es-MX', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    
    return `
      <div class="match-card">
        <div class="match-info">
          <span class="tag">${m.category.toUpperCase()}</span>
          <p>📍 Cancha: <strong>${m.court}</strong></p>
          <p>⏰ ${dateFormatted} hrs</p>
        </div>
        <div class="match-vs-box">
          <span>${m.local}</span>
          <span class="${badgeClass}">${scoreText}</span>
          <span>${m.visitor}</span>
        </div>
        <button class="btn-danger admin-only-block" onclick="openScoreModal('${m.id}', '${m.local}', '${m.visitor}')" style="padding:5px 10px; font-size:0.85em;">
          ✍️ Capturar Marcador
        </button>
      </div>
    `;
  }).join('');
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
  if (confirm('¿Eliminar torneo?')) {
    await manager.deleteEvent(id);
    document.getElementById('eventModal').classList.remove('show');
    renderCategories();
  }
};

// Autenticación
async function handleLoginSubmit(e) {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    alert("🔐 Coach Autenticado.");
    document.getElementById('loginForm').reset();
    switchSection('dashboard');
  } catch (error) { alert("Error: " + error.message); }
}
async function handleLogout() {
  await signOut(auth);
  alert("Sesión cerrada.");
}
window.switchSection = switchSection;
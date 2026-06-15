// Importar librerías desde la CDN oficial de Firebase v10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Tu configuración real de Firebase en la nube
const firebaseConfig = {
  apiKey: "AIzaSyBO9aONmgDYECQOwI-NDorIAP88FekJuU0",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.firebasestorage.app",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:c14326668c6c31631fe44f",
  measurementId: "G-3X518EN8K0"
};

// Inicializar servicios de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdmin = false;

// 🔐 CONTROL DE ACCESO VISUAL: Observador de sesión
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    document.body.classList.add('is-admin'); // ✨ Activa visualmente los formularios y botones ocultos
    console.log("🏀 Sesión de Administrador activa:", user.email);
  } else {
    isAdmin = false;
    document.body.classList.remove('is-admin'); // ✨ Esconde todo para los usuarios públicos / espectadores
    console.log("👤 Modo espectador público.");
  }
});

// Categorías oficiales de básquetbol y esquemas de juego
const CATEGORIES = [
  { id: 'micro-infantil', name: 'Micro Infantil', icon: '👶' },
  { id: 'pasarela', name: 'Pasarela', icon: '🧒' },
  { id: 'cadetes', name: 'Cadetes', icon: '👦' },
  { id: 'juvenil', name: 'Juvenil', icon: '👨' },
  { id: 'juvenil-superior', name: 'Juvenil Superior', icon: '👨' },
  { id: 'sub21', name: 'Sub 21', icon: '👨‍🎓' },
  { id: 'sub23', name: 'Sub 23', icon: '👨‍🎓' }
];

const COMPETITION_FORMATS = {
  'todos-contra-todos': 'Todos Contra Todos (Round Robin)',
  'grupos': 'Por Grupos',
  'eliminacion': 'Eliminación Directa (Bracket)',
  'mixto': 'Mixto (Grupos + Eliminación)'
};

// --- Manejo de la Base de Datos Firestore ---
class TournamentManager {
  async createEvent(eventData) {
    const docRef = await addDoc(collection(db, "events"), {
      ...eventData,
      teams: [],
      matches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  }

  async getEventsByCategory(categoryId) {
    const q = query(collection(db, "events"), where("category", "==", categoryId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getEvent(eventId) {
    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  async deleteEvent(eventId) {
    await deleteDoc(doc(db, "events", eventId));
  }
}

const manager = new TournamentManager();

// --- Event Listeners de la Interfaz ---
document.addEventListener('DOMContentLoaded', function () {
  initializeEventListeners();
  renderDashboard();
});

function initializeEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      switchSection(this.dataset.section);
    });
  });

  const eventForm = document.getElementById('eventForm');
  if (eventForm) {
    eventForm.addEventListener('submit', handleEventFormSubmit);
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const modal = document.getElementById('eventModal');
  if (modal) {
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }
}

function switchSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetSection = document.getElementById(sectionId);
  const targetBtn = document.querySelector(`[data-section="${sectionId}"]`);

  if (targetSection) targetSection.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (sectionId === 'dashboard') renderDashboard();
  else if (sectionId === 'categories') renderCategories();
}

// --- Renderizado de Datos ---
async function renderDashboard() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = 'Cargando estadísticas...';

  let htmlBuffer = '';
  for (const category of CATEGORIES) {
    const events = await manager.getEventsByCategory(category.id);
    htmlBuffer += `
      <div class="category-card" onclick="switchSection('categories')">
        <h3>${category.icon} ${category.name}</h3>
        <div class="stats">
          <div class="stat"><div class="stat-value">${events.length}</div><div class="stat-label">Torneos</div></div>
          <div class="stat"><div class="stat-value">${events.reduce((sum, e) => sum + (e.teams ? e.teams.length : 0), 0)}</div><div class="stat-label">Equipos</div></div>
          <div class="stat"><div class="stat-value">${events.reduce((sum, e) => sum + (e.matches ? e.matches.length : 0), 0)}</div><div class="stat-label">Partidos</div></div>
        </div>
      </div>
    `;
  }
  grid.innerHTML = htmlBuffer;
}

async function renderCategories() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  container.innerHTML = 'Sincronizando torneos...';

  let totalHTML = '';
  for (const category of CATEGORIES) {
    const events = await manager.getEventsByCategory(category.id);
    
    let eventsHTML = events.length > 0
      ? events.map(e => `
          <li onclick="viewEvent('${e.id}')">
            📅 ${e.name} - ${e.date ? new Date(e.date).toLocaleDateString('es-ES') : 'Sin fecha'}
            <br><small>📍 ${e.location || 'Por definir'} | Límite: ${e.teamsCount || 0} escuadras</small>
          </li>
        `).join('')
      : '<li class="no-events">No hay torneos activos aquí</li>';

    totalHTML += `
      <div class="category-detail">
        <h3>${category.icon} ${category.name}</h3>
        <ul class="events-list">${eventsHTML}</ul>
      </div>
    `;
  }
  container.innerHTML = totalHTML;
}

// --- Visualización del Modal de Detalles ---
async function viewEvent(eventId) {
  const event = await manager.getEvent(eventId);
  if (!event) return;

  const modal = document.getElementById('eventModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');

  if (!modal || !modalBody || !modalTitle) return;

  modalTitle.textContent = event.name;
  modalBody.innerHTML = `
    <div class="event-details">
      <p><strong>Categoría:</strong> ${event.category.toUpperCase()}</p>
      <p><strong>Fecha de Arranque:</strong> ${event.date ? new Date(event.date).toLocaleDateString('es-ES') : 'Sin fecha'}</p>
      <p><strong>Cancha Sede:</strong> ${event.location}</p>
      <p><strong>Esquema de Juego:</strong> ${COMPETITION_FORMATS[event.format] || event.format}</p>
      <p><strong>Cupo Máximo:</strong> ${event.teamsCount} Equipos</p>
      ${event.description ? `<p><strong>Notas del Organizador:</strong> ${event.description}</p>` : ""}
      <button class="btn-danger" onclick="deleteEvent('${eventId}')" style="margin-top: 20px; width: 100%;">Eliminar este Torneo</button>
    </div>
  `;
  modal.classList.add('show');
}

// --- Procesamiento de Formularios ---
async function handleEventFormSubmit(e) {
  e.preventDefault();

  if (!isAdmin) {
    alert("⚠️ Permiso denegado: Inicia sesión en la pestaña Admin primero.");
    return;
  }

  const eventData = {
    category: document.getElementById('eventCategory').value,
    name: document.getElementById('eventName').value,
    date: document.getElementById('eventDate').value,
    location: document.getElementById('eventLocation').value,
    teamsCount: parseInt(document.getElementById('eventTeams').value) || 0,
    format: document.getElementById('competitionFormat').value,
    description: document.getElementById('eventDescription').value
  };

  try {
    await manager.createEvent(eventData);
    alert('✅ ¡Torneo publicado con éxito en la plataforma!');
    document.getElementById('eventForm').reset();
    switchSection('dashboard');
  } catch (error) {
    alert("Error de Firebase: " + error.message);
  }
}

async function deleteEvent(eventId) {
  if (!isAdmin) {
    alert("⚠️ Operación inválida: Solo el administrador puede borrar torneos del sistema.");
    return;
  }

  if (confirm('¿Confirmas que deseas eliminar permanentemente este torneo?')) {
    try {
      await manager.deleteEvent(eventId);
      document.getElementById('eventModal').classList.remove('show');
      renderCategories();
      alert('✅ Registro borrado de la base de datos.');
    } catch (error) {
      alert("Error al eliminar el archivo: " + error.message);
    }
  }
}

// --- Autenticación ---
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("🔐 Acceso concedido. Bienvenido Coach.");
    document.getElementById('loginForm').reset();
    switchSection('dashboard');
  } catch (error) {
    alert("Fallo en las credenciales: " + error.message);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    alert("🔒 Sesión finalizada de manera segura.");
  } catch (error) {
    console.error("Fallo al desconectar:", error);
  }
}

// Inyección al objeto window para mantener los clics dinámicos funcionales
window.viewEvent = viewEvent;
window.deleteEvent = deleteEvent;
window.switchSection = switchSection;
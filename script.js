// ⚡ IMPORTACIONES ULTRA RÁPIDAS (Usando las CDNs optimizadas de Cloudflare)
import { initializeApp } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, getDoc, deleteDoc } from "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.0/firebase-firestore.js";

// Configuración real de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBO9aONmgDYECQOwI-NDorIAP88FekJuU0",
  authDomain: "torneos-basquetbol.firebaseapp.com",
  projectId: "torneos-basquetbol",
  storageBucket: "torneos-basquetbol.firebasestorage.app",
  messagingSenderId: "758350808798",
  appId: "1:758350808798:web:c14326668c6c31631fe44f",
  measurementId: "G-3X518EN8K0"
};

// Inicialización veloz de servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdmin = false;
let dashboardCache = null; // 🧠 Memoria caché para evitar peticiones repetidas a Firebase

// Control de acceso visual inmediato
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    document.body.classList.add('is-admin');
    console.log("🏀 Sesión activa:", user.email);
  } else {
    isAdmin = false;
    document.body.classList.remove('is-admin');
    console.log("👤 Modo espectador público.");
  }
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

const COMPETITION_FORMATS = {
  'todos-contra-todos': 'Todos Contra Todos (Round Robin)',
  'grupos': 'Por Grupos',
  'eliminacion': 'Eliminación Directa (Bracket)',
  'mixto': 'Mixto (Grupos + Eliminación)'
};

// --- Manejo Asíncrono Eficiente de Firestore ---
class TournamentManager {
  async createEvent(eventData) {
    const docRef = await addDoc(collection(db, "events"), {
      ...eventData,
      teams: [],
      matches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    dashboardCache = null; // Romper caché para forzar actualización al crear
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
    dashboardCache = null; // Romper caché al eliminar
  }
}

const manager = new TournamentManager();

// --- Event Listeners Iniciales ---
document.addEventListener('DOMContentLoaded', function () {
  initializeEventListeners();
  renderDashboard(); // Carga el inicio rápido
});

function initializeEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      switchSection(this.dataset.section);
    });
  });

  document.getElementById('eventForm')?.addEventListener('submit', handleEventFormSubmit);
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.querySelector('.close')?.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
  }
}

function switchSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

  if (sectionId === 'dashboard') renderDashboard();
  else if (sectionId === 'categories') renderCategories();
}

// --- Renderizado Inteligente con Carga en Paralelo (Promise.all) ---
async function renderDashboard() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  // Si ya tenemos los datos guardados en la memoria del navegador, los muestra al instante
  if (dashboardCache) {
    grid.innerHTML = dashboardCache;
    return;
  }

  grid.innerHTML = '<div class="no-events">Sincronizando tablero en tiempo real...</div>';

  try {
    // 🔥 MEJORA CLAVE: Dispara las búsquedas de todas las categorías a la vez en paralelo
    const promises = CATEGORIES.map(category => manager.getEventsByCategory(category.id));
    const results = await Promise.all(promises);

    let htmlBuffer = '';
    CATEGORIES.forEach((category, index) => {
      const events = results[index];
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
    });

    dashboardCache = htmlBuffer; // Guardamos en caché
    grid.innerHTML = htmlBuffer;
  } catch (error) {
    grid.innerHTML = 'Error al cargar estadísticas rápidas.';
    console.error(error);
  }
}

async function renderCategories() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  container.innerHTML = '<div class="no-events">Actualizando torneos...</div>';

  try {
    // Carga en paralelo también aquí para máxima velocidad
    const promises = CATEGORIES.map(category => manager.getEventsByCategory(category.id));
    const results = await Promise.all(promises);

    let totalHTML = '';
    CATEGORIES.forEach((category, index) => {
      const events = results[index];
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
    });

    container.innerHTML = totalHTML;
  } catch (error) {
    container.innerHTML = 'Fallo en la sincronización.';
  }
}

// --- Ventana de Detalles ---
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

// --- Acciones de Formularios ---
async function handleEventFormSubmit(e) {
  e.preventDefault();
  if (!isAdmin) return alert("⚠️ Inicia sesión primero.");

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
    alert('✅ ¡Torneo publicado con éxito!');
    document.getElementById('eventForm').reset();
    switchSection('dashboard');
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function deleteEvent(eventId) {
  if (!isAdmin) return alert("⚠️ Operación denegada.");

  if (confirm('¿Confirmas que deseas eliminar permanentemente este torneo?')) {
    try {
      await manager.deleteEvent(eventId);
      document.getElementById('eventModal').classList.remove('show');
      renderCategories();
      alert('✅ Registro borrado.');
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  }
}

// --- Autenticación Rapida ---
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("🔐 Acceso concedido.");
    document.getElementById('loginForm').reset();
    switchSection('dashboard');
  } catch (error) {
    alert("Error de acceso: " + error.message);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    alert("🔒 Sesión cerrada.");
  } catch (error) {
    console.error(error);
  }
}

window.viewEvent = viewEvent;
window.deleteEvent = deleteEvent;
window.switchSection = switchSection;
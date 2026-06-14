// Tournament Manager - JavaScript

// Categorías disponibles
const CATEGORIES = [
    { id: 'micro-infantil', name: 'Micro Infantil', icon: '👶' },
    { id: 'pasarela', name: 'Pasarela', icon: '🧒' },
    { id: 'cadetes', name: 'Cadetes', icon: '👦' },
    { id: 'juvenil', name: 'Juvenil', icon: '👨' },
    { id: 'juvenil-superior', name: 'Juvenil Superior', icon: '👨' },
    { id: 'sub21', name: 'Sub 21', icon: '👨‍🎓' },
    { id: 'sub23', name: 'Sub 23', icon: '👨‍🎓' }
];

// Formatos de competencia
const COMPETITION_FORMATS = {
    'todos-contra-todos': 'Todos Contra Todos (Round Robin)',
    'grupos': 'Por Grupos',
    'eliminacion': 'Eliminación Directa (Bracket)',
    'mixto': 'Mixto (Grupos + Eliminación)'
};

// Almacenamiento de datos (localStorage)
class TournamentManager {
    constructor() {
        this.events = this.loadEvents();
    }

    loadEvents() {
        const stored = localStorage.getItem('tournaments');
        return stored ? JSON.parse(stored) : {};
    }

    saveEvents() {
        localStorage.setItem('tournaments', JSON.stringify(this.events));
    }

    createEvent(eventData) {
        const eventId = `event_${Date.now()}`;
        this.events[eventId] = {
            id: eventId,
            ...eventData,
            teams: [],
            matches: [],
            standings: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.saveEvents();
        return eventId;
    }

    getEventsByCategory(categoryId) {
        return Object.values(this.events).filter(e => e.category === categoryId);
    }

    getEvent(eventId) {
        return this.events[eventId];
    }

    updateEvent(eventId, updates) {
        if (this.events[eventId]) {
            this.events[eventId] = {
                ...this.events[eventId],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveEvents();
            return this.events[eventId];
        }
        return null;
    }

    addTeamToEvent(eventId, teamName) {
        const event = this.events[eventId];
        if (event) {
            event.teams = event.teams || [];
            event.teams.push({
                id: `team_${Date.now()}`,
                name: teamName,
                points: 0,
                wins: 0,
                losses: 0,
                gamesPlayed: 0
            });
            this.saveEvents();
            return event.teams[event.teams.length - 1];
        }
        return null;
    }

    addMatchResult(eventId, matchData) {
        const event = this.events[eventId];
        if (event) {
            event.matches = event.matches || [];
            event.matches.push({
                id: `match_${Date.now()}`,
                ...matchData,
                quarters: matchData.quarters || [],
                createdAt: new Date().toISOString()
            });
            this.saveEvents();
            return event.matches[event.matches.length - 1];
        }
        return null;
    }

    generateRoundRobinSchedule(eventId) {
        const event = this.events[eventId];
        if (!event || !event.teams) return [];

        const teams = event.teams;
        const matches = [];
        const n = teams.length;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                matches.push({
                    id: `match_${Date.now()}_${i}_${j}`,
                    team1Id: teams[i].id,
                    team1Name: teams[i].name,
                    team2Id: teams[j].id,
                    team2Name: teams[j].name,
                    team1Score: 0,
                    team2Score: 0,
                    quarters: [],
                    played: false
                });
            }
        }
        return matches;
    }

    generateEliminationBracket(eventId) {
        const event = this.events[eventId];
        if (!event || !event.teams) return [];

        const teams = event.teams;
        const n = teams.length;
        const rounds = Math.ceil(Math.log2(n));
        const brackets = [];

        let round1Teams = [...teams];
        // Shuffle for random bracket
        for (let i = round1Teams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [round1Teams[i], round1Teams[j]] = [round1Teams[j], round1Teams[i]];
        }

        let currentRound = round1Teams;
        for (let r = 0; r < rounds; r++) {
            const matches = [];
            for (let i = 0; i < currentRound.length; i += 2) {
                if (i + 1 < currentRound.length) {
                    matches.push({
                        id: `match_r${r}_${i / 2}`,
                        team1Id: currentRound[i].id || null,
                        team1Name: currentRound[i].name || 'TBD',
                        team2Id: currentRound[i + 1].id || null,
                        team2Name: currentRound[i + 1].name || 'TBD',
                        team1Score: 0,
                        team2Score: 0,
                        quarters: [],
                        played: false
                    });
                }
            }
            brackets.push({
                round: r + 1,
                roundName: r === rounds - 1 ? 'Final' : r === rounds - 2 ? 'Semifinal' : `Round ${r + 1}`,
                matches: matches
            });
            // Prepare next round (winners only)
            currentRound = matches.map(m => ({ id: null, name: 'TBD' }));
        }
        return brackets;
    }
}

// Instancia global
const manager = new TournamentManager();

// ============ DOM Management ============

document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    renderDashboard();
});

function initializeEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const section = this.dataset.section;
            switchSection(section);
        });
    });

    // Event form submission
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventFormSubmit);
    }

    // Modal close
    const modal = document.getElementById('eventModal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    // Render content based on section
    if (sectionId === 'dashboard') {
        renderDashboard();
    } else if (sectionId === 'categories') {
        renderCategories();
    }
}

function renderDashboard() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';

    CATEGORIES.forEach(category => {
        const events = manager.getEventsByCategory(category.id);
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <h3>${category.icon} ${category.name}</h3>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${events.length}</div>
                    <div class="stat-label">Eventos</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${events.reduce((sum, e) => sum + (e.teams ? e.teams.length : 0), 0)}</div>
                    <div class="stat-label">Equipos</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${events.reduce((sum, e) => sum + (e.matches ? e.matches.length : 0), 0)}</div>
                    <div class="stat-label">Partidos</div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            switchSection('categories');
            setTimeout(() => {
                document.getElementById('categoryContainer').scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });
        grid.appendChild(card);
    });
}

function renderCategories() {
    const container = document.getElementById('categoryContainer');
    container.innerHTML = '';

    CATEGORIES.forEach(category => {
        const events = manager.getEventsByCategory(category.id);
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-detail';

        let eventsHTML = events.length > 0
            ? events.map(e => `
                <li onclick="viewEvent('${e.id}')">
                    📅 ${e.name} - ${new Date(e.date).toLocaleDateString('es-ES')}
                    <br><small>${e.location} | ${e.teams.length} equipos</small>
                </li>
            `).join('')
            : '<li class="no-events">No hay eventos en esta categoría</li>';

        categoryDiv.innerHTML = `
            <h3>${category.icon} ${category.name}</h3>
            <ul class="events-list">
                ${eventsHTML}
            </ul>
        `;
        container.appendChild(categoryDiv);
    });
}

function viewEvent(eventId) {
    const event = manager.getEvent(eventId);
    if (!event) return;

    const modal = document.getElementById('eventModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');

    modalTitle.textContent = event.name;

    let contentHTML = `
        <div class="event-details">
            <p><strong>Categoría:</strong> ${event.category}</p>
            <p><strong>Fecha:</strong> ${new Date(event.date).toLocaleDateString('es-ES')}</p>
            <p><strong>Ubicación:</strong> ${event.location}</p>
            <p><strong>Formato:</strong> ${COMPETITION_FORMATS[event.format]}</p>
            <p><strong>Equipos:</strong> ${event.teams.length}</p>
            <p><strong>Partidos:</strong> ${event.matches ? event.matches.length : 0}</p>
    `;

    if (event.description) {
        contentHTML += `<p><strong>Descripción:</strong> ${event.description}</p>`;
    }

    contentHTML += `
            <h4>Equipos Registrados:</h4>
            <ul>
    `;

    if (event.teams && event.teams.length > 0) {
        event.teams.forEach(team => {
            contentHTML += `<li>${team.name}</li>`;
        });
    } else {
        contentHTML += '<li class="no-events">Sin equipos registrados aún</li>';
    }

    contentHTML += `</ul>`;
    contentHTML += `<button class="btn-secondary" onclick="editEvent('${eventId}')">Editar Evento</button>`;
    contentHTML += `<button class="btn-danger" onclick="deleteEvent('${eventId}')">Eliminar</button>`;
    contentHTML += `</div>`;

    modalBody.innerHTML = contentHTML;
    modal.classList.add('show');
}

function handleEventFormSubmit(e) {
    e.preventDefault();

    const formData = {
        category: document.getElementById('eventCategory').value,
        name: document.getElementById('eventName').value,
        date: document.getElementById('eventDate').value,
        location: document.getElementById('eventLocation').value,
        teamsCount: parseInt(document.getElementById('eventTeams').value),
        format: document.getElementById('competitionFormat').value,
        description: document.getElementById('eventDescription').value
    };

    const eventId = manager.createEvent(formData);

    // Generar equipos dummy (para demostración)
    for (let i = 1; i <= formData.teamsCount; i++) {
        manager.addTeamToEvent(eventId, `Equipo ${i}`);
    }

    // Generar schedule basado en formato
    if (formData.format === 'todos-contra-todos') {
        const schedule = manager.generateRoundRobinSchedule(eventId);
        manager.updateEvent(eventId, { matches: schedule });
    } else if (formData.format === 'eliminacion') {
        const bracket = manager.generateEliminationBracket(eventId);
        manager.updateEvent(eventId, { bracket: bracket });
    }

    alert('✅ Evento creado exitosamente!');
    document.getElementById('eventForm').reset();
    renderDashboard();
    switchSection('dashboard');
}

function editEvent(eventId) {
    alert('Funcionalidad de edición próximamente...');
}

function deleteEvent(eventId) {
    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
        delete manager.events[eventId];
        manager.saveEvents();
        document.getElementById('eventModal').classList.remove('show');
        renderDashboard();
        alert('✅ Evento eliminado');
    }
}

// Función para agregar equipos a un evento
function addTeamToEvent(eventId, teamName) {
    manager.addTeamToEvent(eventId, teamName);
    alert('✅ Equipo agregado exitosamente!');
}

// Función para agregar resultado de partido
function addMatchResult(eventId, matchData) {
    manager.addMatchResult(eventId, matchData);
    alert('✅ Resultado registrado exitosamente!');
}

console.log('🏀 Tournament Manager Initialized');
console.log('Available events:', manager.events);

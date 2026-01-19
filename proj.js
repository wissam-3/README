// ===== APPLICATION CINE-TECH DASHBOARD =====
// Main Module Pattern pour éviter les conflits de variables globales
const CineTechApp = (function() {
    
    // ===== DONNÉES DE L'APPLICATION =====
    // Stockage des films et réalisateurs avec persistence dans localStorage
    let films = JSON.parse(localStorage.getItem('cineTechFilms')) || [];
    let directors = JSON.parse(localStorage.getItem('cineTechDirectors')) || [];
    
    // Variables d'état pour gérer les opérations en cours
    let currentFilmId = null;          // ID du film en cours d'édition/visualisation
    let currentDirectorId = null;      // ID du réalisateur en cours d'édition
    let deleteCallback = null;         // Callback pour la suppression confirmée
    let currentView = 'table';         // Vue active pour les films ('table', 'cards', 'compact')
    let selectedFilms = new Set();     // Ensemble des IDs des films sélectionnés
    
    // Références aux graphiques Chart.js pour les mettre à jour dynamiquement
    let charts = {
        filmsChart: null,      // Graphique d'évolution des films
        directorsChart: null,  // Graphique des films par réalisateur
        yearChart: null,       // Graphique des films par année
        genreChart: null,      // Graphique de répartition par genre
        ratingChart: null      // Graphique de distribution des notes
    };
    
    // ===== CACHE DES ÉLÉMENTS DOM =====
    // Stockage des références aux éléments DOM fréquemment utilisés
    const elements = {
        sidebarLinks: null,            // Liens de navigation dans la sidebar
        contentSections: null,         // Sections de contenu principales
        navbarToggle: null,            // Bouton toggle pour la sidebar mobile
        currentSection: null,          // Titre de section courant dans la navbar
        breadcrumb: null,              // Élément du fil d'Ariane
        notificationBtn: null,         // Bouton des notifications
        notificationDropdown: null,    // Menu déroulant des notifications
        loadingOverlay: null,          // Overlay de chargement
        toastContainer: null           // Conteneur des notifications toast
    };
    
    // ===== FONCTION D'INITIALISATION =====
    // Point d'entrée principal, appelé au chargement du DOM
    function init() {
        // Récupération des éléments DOM dans le cache
        cacheElements();
        
        // Chargement des données d'exemple si la base est vide
        if (films.length === 0) {
            initializeSampleData();
        }
        
        // Configuration des événements utilisateur
        initEventListeners();
        
        // Initialisation des graphiques Chart.js
        initCharts();
        
        // Premier rendu de l'interface
        updateDashboard();
        renderFilms();
        renderDirectors();
        
        // Message de bienvenue avec délai pour meilleure UX
        setTimeout(() => {
            showToast('Tableau de bord CineTech chargé avec succès !', 'success');
        }, 1000);
    }
    
    // ===== CACHE DES ÉLÉMENTS DOM =====
    // Stocke les références aux éléments DOM pour éviter les requêtes répétées
    function cacheElements() {
        elements.sidebarLinks = document.querySelectorAll('#sidebar a');
        elements.contentSections = document.querySelectorAll('.content-section');
        elements.navbarToggle = document.getElementById('navbar-toggle');
        elements.currentSection = document.getElementById('current-section');
        elements.breadcrumb = document.querySelector('.breadcrumb');
        elements.notificationBtn = document.getElementById('notification-btn');
        elements.notificationDropdown = document.getElementById('notification-dropdown');
        elements.loadingOverlay = document.getElementById('loading-overlay');
        elements.toastContainer = document.getElementById('toast-container');
    }
    
    // ===== INITIALISATION DES ÉVÉNEMENTS =====
    // Attache tous les écouteurs d'événements aux éléments interactifs
    function initEventListeners() {
        // Navigation dans la sidebar
        elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', handleNavigation);
        });
        
        // Toggle de la sidebar sur mobile
        elements.navbarToggle.addEventListener('click', toggleSidebar);
        
        // Gestion des notifications
        if (elements.notificationBtn) {
            elements.notificationBtn.addEventListener('click', toggleNotifications);
        }
        
        // ÉVÉNEMENTS DES FILMS (Module 1 - CRUD Complet)
        document.getElementById('add-film-btn')?.addEventListener('click', () => openFilmModal());
        document.getElementById('film-search-btn')?.addEventListener('click', renderFilms);
        document.getElementById('film-search')?.addEventListener('input', renderFilms);
        document.getElementById('film-genre-filter')?.addEventListener('change', renderFilms);
        document.getElementById('film-sort')?.addEventListener('change', renderFilms);
        
        // Changement de vue (tableau/cartes/compact)
        document.getElementById('view-table-btn')?.addEventListener('click', () => switchView('table'));
        document.getElementById('view-cards-btn')?.addEventListener('click', () => switchView('cards'));
        document.getElementById('view-compact-btn')?.addEventListener('click', () => switchView('compact'));
        
        // ÉVÉNEMENTS DES RÉALISATEURS (Module 2 - CRUD Light)
        document.getElementById('add-director-btn')?.addEventListener('click', () => openDirectorModal());
        
        // ÉVÉNEMENTS API (Module 3 - Intégration externe)
        document.getElementById('api-search-btn')?.addEventListener('click', searchFilmsAPI);
        document.getElementById('api-search-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchFilmsAPI();
        });
        
        // ÉVÉNEMENTS DES MODALES
        document.getElementById('save-film-btn')?.addEventListener('click', saveFilm);
        document.getElementById('save-director-btn')?.addEventListener('click', saveDirector);
        document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
            if (deleteCallback) deleteCallback();
        });
        document.getElementById('confirm-clear-btn')?.addEventListener('click', clearAllData);
        document.getElementById('edit-film-from-detail')?.addEventListener('click', editFilmFromDetail);
        
        // GESTION DES DONNÉES (Import/Export)
        document.getElementById('export-data-btn')?.addEventListener('click', exportData);
        document.getElementById('import-data-btn')?.addEventListener('click', triggerImport);
        
        // Écouteur pour l'input fichier d'import
        const importInput = document.getElementById('import-data-file');
        if (importInput) {
            importInput.addEventListener('change', handleFileImport);
        }
        
        // RECHERCHE GLOBALE
        document.getElementById('global-search')?.addEventListener('input', handleGlobalSearch);
        
        // DASHBOARD
        document.getElementById('refresh-dashboard')?.addEventListener('click', refreshDashboard);
        
        // SÉLECTION MULTIPLE DE FILMS
        document.getElementById('select-all-films')?.addEventListener('change', toggleSelectAllFilms);
        document.getElementById('delete-selected-films')?.addEventListener('click', deleteSelectedFilms);
        
        // PARAMÈTRES D'APPARENCE
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', handleThemeChange);
        });
        
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', handleColorChange);
        });
    }
    
    // ===== FONCTIONS DE NAVIGATION =====
    
    // Gère le clic sur les liens de navigation de la sidebar
    function handleNavigation(e) {
        e.preventDefault();
        
        const link = e.currentTarget;
        const targetId = link.id.replace('-link', '-section');
        const sectionName = link.querySelector('span').textContent;
        
        // Met à jour l'élément actif dans la sidebar
        elements.sidebarLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Cache toutes les sections de contenu
        elements.contentSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Affiche la section cible avec animation
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
            elements.currentSection.textContent = sectionName;
            
            // Met à jour le fil d'Ariane
            updateBreadcrumb(sectionName);
            
            // Actions spécifiques selon la section
            switch(targetId) {
                case 'dashboard-section':
                    updateDashboard();      // Rafraîchit les KPI et graphiques
                    break;
                case 'stats-section':
                    updateStatsCharts();    // Met à jour les graphiques statistiques
                    break;
                case 'films-section':
                    renderFilms();          // Affiche la liste des films
                    break;
                case 'directors-section':
                    renderDirectors();      // Affiche la liste des réalisateurs
                    break;
            }
        }
        
        // Ferme la sidebar sur mobile après sélection
        if (window.innerWidth < 992) {
            document.getElementById('sidebar').classList.remove('active');
        }
    }
    
    // Bascule l'affichage de la sidebar sur mobile
    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('active');
    }
    
    // Bascule l'affichage du menu des notifications
    function toggleNotifications() {
        elements.notificationDropdown.classList.toggle('show');
    }
    
    // Met à jour le fil d'Ariane avec la section courante
    function updateBreadcrumb(sectionName) {
        const breadcrumbItem = document.querySelector('.breadcrumb-item.active');
        if (breadcrumbItem) {
            breadcrumbItem.textContent = sectionName;
        }
    }
    
    // ===== MODULE 1 : GESTION DES FILMS (CRUD COMPLET) =====
    
    // Fonction principale de rendu des films avec filtrage et tri
    function renderFilms() {
        // Récupère les critères de filtrage depuis l'interface
        const searchTerm = document.getElementById('film-search')?.value.toLowerCase() || '';
        const genreFilter = document.getElementById('film-genre-filter')?.value || '';
        const sortOption = document.getElementById('film-sort')?.value || 'title-asc';
        
        // Filtre les films selon les critères
        let filteredFilms = films.filter(film => {
            const filmTitle = film.title.toLowerCase();
            const filmDirector = getDirectorById(film.directorId)?.name.toLowerCase() || '';
            
            // Vérifie la correspondance avec la recherche
            const matchesSearch = !searchTerm || 
                filmTitle.includes(searchTerm) || 
                filmDirector.includes(searchTerm) ||
                film.year.toString().includes(searchTerm) ||
                film.genre.toLowerCase().includes(searchTerm);
            
            // Vérifie le filtre de genre
            const matchesGenre = !genreFilter || film.genre === genreFilter;
            
            return matchesSearch && matchesGenre;
        });
        
        // Trie les films selon l'option sélectionnée
        filteredFilms.sort((a, b) => {
            switch (sortOption) {
                case 'title-asc': return a.title.localeCompare(b.title);
                case 'title-desc': return b.title.localeCompare(a.title);
                case 'year-asc': return a.year - b.year;
                case 'year-desc': return b.year - a.year;
                case 'rating-desc': return b.rating - a.rating;
                case 'rating-asc': return a.rating - b.rating;
                default: return 0;
            }
        });
        
        // Met à jour le compteur de résultats
        const filmsCount = document.getElementById('films-count');
        if (filmsCount) {
            filmsCount.textContent = filteredFilms.length;
        }
        
        // Affiche selon la vue active
        switch(currentView) {
            case 'table':
                renderFilmsTableView(filteredFilms);
                break;
            case 'cards':
                renderFilmsCardsView(filteredFilms);
                break;
            case 'compact':
                renderFilmsCompactView(filteredFilms);
                break;
        }
    }
    
    // Affiche les films sous forme de tableau
    function renderFilmsTableView(filteredFilms) {
        const tableBody = document.getElementById('films-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Affiche un état vide si aucun film ne correspond
        if (filteredFilms.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-film fa-3x text-muted mb-3"></i>
                            <p class="text-muted">Aucun film trouvé</p>
                            <button class="btn btn-primary mt-3" id="add-film-empty">
                                <i class="fas fa-plus me-2"></i> Ajouter un film
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Ajoute l'événement au bouton d'ajout dans l'état vide
            document.getElementById('add-film-empty')?.addEventListener('click', () => openFilmModal());
            return;
        }
        
        // Génère une ligne de tableau pour chaque film
        filteredFilms.forEach(film => {
            const director = getDirectorById(film.directorId);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="table-checkbox">
                        <input type="checkbox" class="film-checkbox" data-id="${film.id}">
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${film.poster}" alt="${film.title}" class="rounded me-2" style="width: 40px; height: 60px; object-fit: cover;">
                        <strong>${film.title}</strong>
                    </div>
                </td>
                <td>${director?.name || 'Inconnu'}</td>
                <td>${film.year}</td>
                <td><span class="badge bg-secondary">${film.genre}</span></td>
                <td>${film.duration} min</td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-star text-warning me-1"></i>
                        <span>${film.rating.toFixed(1)}</span>
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary view-film-btn" data-id="${film.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning edit-film-btn" data-id="${film.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-film-btn" data-id="${film.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Attache les événements aux boutons nouvellement créés
        attachFilmEvents();
    }
    
    // Affiche les films sous forme de cartes
    function renderFilmsCardsView(filteredFilms) {
        const container = document.getElementById('films-cards-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (filteredFilms.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-film fa-3x text-muted mb-3"></i>
                        <p class="text-muted">Aucun film trouvé</p>
                        <button class="btn btn-primary mt-3" id="add-film-empty-cards">
                            <i class="fas fa-plus me-2"></i> Ajouter un film
                        </button>
                    </div>
                </div>
            `;
            
            document.getElementById('add-film-empty-cards')?.addEventListener('click', () => openFilmModal());
            return;
        }
        
        // Génère une carte pour chaque film
        filteredFilms.forEach(film => {
            const director = getDirectorById(film.directorId);
            const col = document.createElement('div');
            col.className = 'col-lg-4 col-md-6 mb-4';
            col.innerHTML = `
                <div class="film-card-item">
                    <img src="${film.poster}" class="film-card-poster" alt="${film.title}">
                    <div class="film-card-content">
                        <h5 class="film-card-title">${film.title}</h5>
                        <div class="film-card-meta">
                            <span class="film-card-director">
                                <i class="fas fa-user-tie me-1"></i> ${director?.name || 'Inconnu'}
                            </span>
                            <span class="film-card-rating">
                                <i class="fas fa-star me-1"></i> ${film.rating.toFixed(1)}
                            </span>
                        </div>
                        <div class="d-flex justify-content-between mb-3">
                            <span class="badge bg-secondary">${film.genre}</span>
                            <span class="text-muted">${film.year}</span>
                        </div>
                        <div class="film-card-footer">
                            <button class="btn btn-sm btn-outline-primary view-film-btn" data-id="${film.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning edit-film-btn" data-id="${film.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-film-btn" data-id="${film.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
        
        attachFilmEvents();
    }
    
    // Affiche les films sous forme de liste compacte
    function renderFilmsCompactView(filteredFilms) {
        const container = document.getElementById('films-compact-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (filteredFilms.length === 0) {
            container.innerHTML = `
                <div class="empty-state p-5">
                    <i class="fas fa-film fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Aucun film trouvé</p>
                    <button class="btn btn-primary mt-3" id="add-film-empty-compact">
                        <i class="fas fa-plus me-2"></i> Ajouter un film
                    </button>
                </div>
            `;
            
            document.getElementById('add-film-empty-compact')?.addEventListener('click', () => openFilmModal());
            return;
        }
        
        // Génère un élément de liste pour chaque film
        filteredFilms.forEach(film => {
            const director = getDirectorById(film.directorId);
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="${film.poster}" alt="${film.title}" class="rounded me-3" style="width: 50px; height: 75px; object-fit: cover;">
                        <div>
                            <h6 class="mb-0">${film.title}</h6>
                            <small class="text-muted">${director?.name || 'Inconnu'} • ${film.year} • ${film.genre}</small>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-warning text-dark">
                            <i class="fas fa-star me-1"></i> ${film.rating.toFixed(1)}
                        </span>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary view-film-btn" data-id="${film.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-warning edit-film-btn" data-id="${film.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
        
        attachFilmEvents();
    }
    
    // Attache les événements aux boutons d'action des films
    function attachFilmEvents() {
        // Boutons de visualisation des détails
        document.querySelectorAll('.view-film-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filmId = parseInt(e.currentTarget.getAttribute('data-id'));
                showFilmDetails(filmId);
            });
        });
        
        // Boutons d'édition
        document.querySelectorAll('.edit-film-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filmId = parseInt(e.currentTarget.getAttribute('data-id'));
                openFilmModal(filmId);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-film-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filmId = parseInt(e.currentTarget.getAttribute('data-id'));
                const film = films.find(f => f.id === filmId);
                if (film) {
                    confirmDelete('film', filmId, film.title, () => deleteFilm(filmId));
                }
            });
        });
        
        // Cases à cocher pour la sélection multiple
        document.querySelectorAll('.film-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const filmId = parseInt(e.target.getAttribute('data-id'));
                if (e.target.checked) {
                    selectedFilms.add(filmId);
                } else {
                    selectedFilms.delete(filmId);
                }
                updateSelectAllCheckbox();
            });
        });
    }
    
    // Change le mode d'affichage des films
    function switchView(view) {
        currentView = view;
        
        // Met à jour l'état des boutons de vue
        document.getElementById('view-table-btn')?.classList.toggle('active', view === 'table');
        document.getElementById('view-cards-btn')?.classList.toggle('active', view === 'cards');
        document.getElementById('view-compact-btn')?.classList.toggle('active', view === 'compact');
        
        // Affiche/masque les conteneurs de vue
        document.getElementById('films-table-view').style.display = view === 'table' ? 'block' : 'none';
        document.getElementById('films-cards-view').style.display = view === 'cards' ? 'block' : 'none';
        document.getElementById('films-compact-view').style.display = view === 'compact' ? 'block' : 'none';
        
        // Re-rend la vue si nécessaire (pas pour le tableau car déjà rendu)
        if (view !== 'table') {
            renderFilms();
        }
    }
    
    // Ouvre la modal d'ajout/édition de film
    function openFilmModal(filmId = null) {
        const modalTitle = document.getElementById('filmModalTitle');
        const form = document.getElementById('film-form');
        const directorSelect = document.getElementById('film-director');
        
        // Réinitialise le formulaire
        form.reset();
        form.classList.remove('was-validated');
        document.getElementById('film-id').value = '';
        
        // Remplit la liste déroulante des réalisateurs
        directorSelect.innerHTML = '<option value="">Sélectionner un réalisateur...</option>';
        directors.forEach(director => {
            const option = document.createElement('option');
            option.value = director.id;
            option.textContent = director.name;
            directorSelect.appendChild(option);
        });
        
        if (filmId) {
            // Mode édition - préremplit le formulaire
            modalTitle.textContent = 'Modifier le film';
            const film = films.find(f => f.id === filmId);
            
            if (film) {
                document.getElementById('film-id').value = film.id;
                document.getElementById('film-title').value = film.title;
                document.getElementById('film-director').value = film.directorId;
                document.getElementById('film-year').value = film.year;
                document.getElementById('film-genre').value = film.genre;
                document.getElementById('film-duration').value = film.duration;
                document.getElementById('film-rating').value = film.rating;
                document.getElementById('film-poster').value = film.poster !== 'https://via.placeholder.com/300x450?text=Poster+non+disponible' ? film.poster : '';
                document.getElementById('film-synopsis').value = film.synopsis || '';
            }
        } else {
            // Mode ajout - formulaire vide
            modalTitle.textContent = 'Ajouter un film';
        }
        
        // Affiche la modal avec Bootstrap
        const modal = new bootstrap.Modal(document.getElementById('filmModal'));
        modal.show();
    }
    
    // Sauvegarde un film (ajout ou mise à jour)
    function saveFilm() {
        const form = document.getElementById('film-form');
        
        // Validation du formulaire
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        
        // Récupération des données du formulaire
        const filmId = parseInt(document.getElementById('film-id').value);
        const posterUrl = document.getElementById('film-poster').value.trim();
        
        const filmData = {
            id: filmId || getNextId(films),
            title: document.getElementById('film-title').value.trim(),
            directorId: parseInt(document.getElementById('film-director').value),
            year: parseInt(document.getElementById('film-year').value),
            genre: document.getElementById('film-genre').value,
            duration: parseInt(document.getElementById('film-duration').value),
            rating: parseFloat(document.getElementById('film-rating').value),
            poster: posterUrl || 'https://via.placeholder.com/300x450?text=Poster+non+disponible',
            synopsis: document.getElementById('film-synopsis').value.trim(),
            createdAt: new Date().toISOString()
        };
        
        // Affiche l'indicateur de chargement
        const saveBtn = document.getElementById('save-film-btn');
        const spinner = document.getElementById('film-saving-spinner');
        const saveText = document.getElementById('save-film-text');
        
        saveBtn.disabled = true;
        spinner.classList.remove('d-none');
        saveText.textContent = 'Enregistrement...';
        
        // Simule un délai pour l'UX (simulation d'appel API)
        setTimeout(() => {
            if (filmId) {
                // Mise à jour d'un film existant
                const index = films.findIndex(f => f.id === filmId);
                if (index !== -1) {
                    filmData.createdAt = films[index].createdAt; // Garde la date de création originale
                    films[index] = filmData;
                }
            } else {
                // Ajout d'un nouveau film
                films.push(filmData);
            }
            
            // Persiste les données et met à jour l'interface
            saveDataToLocalStorage();
            renderFilms();
            updateDashboard();
            
            // Ferme la modal
            bootstrap.Modal.getInstance(document.getElementById('filmModal')).hide();
            
            // Réinitialise le formulaire
            form.reset();
            form.classList.remove('was-validated');
            
            // Réinitialise le bouton
            saveBtn.disabled = false;
            spinner.classList.add('d-none');
            saveText.textContent = 'Enregistrer';
            
            // Affiche une notification
            showToast(`Film "${filmData.title}" ${filmId ? 'modifié' : 'ajouté'} avec succès !`, 'success');
        }, 800);
    }
    
    // Supprime un film après confirmation
    function deleteFilm(filmId) {
        const filmIndex = films.findIndex(f => f.id === filmId);
        if (filmIndex !== -1) {
            const filmTitle = films[filmIndex].title;
            films.splice(filmIndex, 1);
            saveDataToLocalStorage();
            renderFilms();
            updateDashboard();
            showToast(`Film "${filmTitle}" supprimé avec succès !`, 'success');
        }
    }
    
    // Affiche les détails d'un film dans une modal
    function showFilmDetails(filmId) {
        const film = films.find(f => f.id === filmId);
        if (!film) return;
        
        const director = getDirectorById(film.directorId);
        
        // Met à jour le contenu de la modal
        document.getElementById('film-detail-title').textContent = film.title;
        document.getElementById('film-detail-title-text').textContent = film.title;
        document.getElementById('film-detail-director').textContent = director?.name || 'Inconnu';
        document.getElementById('film-detail-year').textContent = film.year;
        document.getElementById('film-detail-genre').textContent = film.genre;
        document.getElementById('film-detail-duration').textContent = `${film.duration} minutes`;
        document.getElementById('film-detail-synopsis').textContent = film.synopsis || 'Aucun synopsis disponible.';
        document.getElementById('film-detail-poster').src = film.poster;
        document.getElementById('film-detail-rating-value').textContent = film.rating.toFixed(1);
        
        // Stocke l'ID du film courant pour l'édition
        currentFilmId = filmId;
        
        // Affiche la modal
        const modal = new bootstrap.Modal(document.getElementById('filmDetailModal'));
        modal.show();
    }
    
    // Ouvre la modal d'édition depuis la modal de détails
    function editFilmFromDetail() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('filmDetailModal'));
        modal.hide();
        
        if (currentFilmId !== null) {
            setTimeout(() => openFilmModal(currentFilmId), 300);
        }
    }
    
    // Sélectionne/désélectionne tous les films
    function toggleSelectAllFilms(e) {
        const checkboxes = document.querySelectorAll('.film-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const filmId = parseInt(checkbox.getAttribute('data-id'));
            if (e.target.checked) {
                selectedFilms.add(filmId);
            } else {
                selectedFilms.delete(filmId);
            }
        });
    }
    
    // Met à jour l'état de la case "Tout sélectionner"
    function updateSelectAllCheckbox() {
        const selectAll = document.getElementById('select-all-films');
        if (!selectAll) return;
        
        const checkboxes = document.querySelectorAll('.film-checkbox');
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        selectAll.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
    
    // Supprime les films sélectionnés
    function deleteSelectedFilms() {
        if (selectedFilms.size === 0) {
            showToast('Aucun film sélectionné', 'warning');
            return;
        }
        
        confirmDelete('films', Array.from(selectedFilms), `${selectedFilms.size} films`, () => {
            films = films.filter(film => !selectedFilms.has(film.id));
            selectedFilms.clear();
            saveDataToLocalStorage();
            renderFilms();
            updateDashboard();
            showToast(`${selectedFilms.size} film(s) supprimé(s) avec succès !`, 'success');
        });
    }
    
    // ===== MODULE 2 : GESTION DES RÉALISATEURS (CRUD LIGHT) =====
    
    // Affiche la liste des réalisateurs
    function renderDirectors() {
        const tableBody = document.getElementById('directors-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Affiche un état vide si aucun réalisateur
        if (directors.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-user-tie fa-3x text-muted mb-3"></i>
                            <p class="text-muted">Aucun réalisateur trouvé</p>
                            <button class="btn btn-primary mt-3" id="add-director-empty">
                                <i class="fas fa-plus me-2"></i> Ajouter un réalisateur
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            document.getElementById('add-director-empty')?.addEventListener('click', () => openDirectorModal());
            return;
        }
        
        // Génère une ligne pour chaque réalisateur
        directors.forEach(director => {
            const directorFilms = films.filter(f => f.directorId === director.id);
            const avgRating = directorFilms.length > 0 
                ? (directorFilms.reduce((sum, film) => sum + film.rating, 0) / directorFilms.length).toFixed(1)
                : 'N/A';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="director-avatar me-3">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <strong>${director.name}</strong>
                            ${director.bio ? `<small class="d-block text-muted">${director.bio.substring(0, 50)}...</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>${director.nationality || 'Non spécifiée'}</td>
                <td>${director.birthdate ? new Date(director.birthdate).toLocaleDateString('fr-FR') : 'Non spécifiée'}</td>
                <td>
                    <span class="badge bg-primary">${directorFilms.length}</span>
                </td>
                <td>
                    ${avgRating !== 'N/A' ? `
                        <div class="d-flex align-items-center">
                            <i class="fas fa-star text-warning me-1"></i>
                            <span>${avgRating}</span>
                        </div>
                    ` : 'N/A'}
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-warning edit-director-btn" data-id="${director.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-director-btn" data-id="${director.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Attache les événements aux boutons
        document.querySelectorAll('.edit-director-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const directorId = parseInt(e.currentTarget.getAttribute('data-id'));
                openDirectorModal(directorId);
            });
        });
        
        document.querySelectorAll('.delete-director-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const directorId = parseInt(e.currentTarget.getAttribute('data-id'));
                const director = directors.find(d => d.id === directorId);
                if (director) {
                    confirmDelete('director', directorId, director.name, () => deleteDirector(directorId));
                }
            });
        });
    }
    
    // Ouvre la modal d'ajout/édition de réalisateur
    function openDirectorModal(directorId = null) {
        const modalTitle = document.getElementById('directorModalTitle');
        const form = document.getElementById('director-form');
        
        form.reset();
        form.classList.remove('was-validated');
        document.getElementById('director-id').value = '';
        
        if (directorId) {
            // Mode édition
            modalTitle.textContent = 'Modifier le réalisateur';
            const director = directors.find(d => d.id === directorId);
            
            if (director) {
                document.getElementById('director-id').value = director.id;
                document.getElementById('director-name').value = director.name;
                document.getElementById('director-nationality').value = director.nationality || '';
                document.getElementById('director-birthdate').value = director.birthdate || '';
                document.getElementById('director-bio').value = director.bio || '';
            }
        } else {
            // Mode ajout
            modalTitle.textContent = 'Ajouter un réalisateur';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('directorModal'));
        modal.show();
    }
    
    // Sauvegarde un réalisateur (ajout ou mise à jour)
    function saveDirector() {
        const form = document.getElementById('director-form');
        
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        
        const directorId = parseInt(document.getElementById('director-id').value);
        const directorData = {
            id: directorId || getNextId(directors),
            name: document.getElementById('director-name').value.trim(),
            nationality: document.getElementById('director-nationality').value.trim(),
            birthdate: document.getElementById('director-birthdate').value,
            bio: document.getElementById('director-bio').value.trim()
        };
        
        if (directorId) {
            // Mise à jour
            const index = directors.findIndex(d => d.id === directorId);
            if (index !== -1) {
                directors[index] = directorData;
            }
        } else {
            // Ajout
            directors.push(directorData);
        }
        
        saveDataToLocalStorage();
        renderDirectors();
        updateDashboard();
        
        bootstrap.Modal.getInstance(document.getElementById('directorModal')).hide();
        form.reset();
        form.classList.remove('was-validated');
        
        showToast(`Réalisateur "${directorData.name}" ${directorId ? 'modifié' : 'ajouté'} avec succès !`, 'success');
    }
    
    // Supprime un réalisateur après vérification
    function deleteDirector(directorId) {
        const directorIndex = directors.findIndex(d => d.id === directorId);
        if (directorIndex !== -1) {
            const directorName = directors[directorIndex].name;
            const directorFilms = films.filter(f => f.directorId === directorId);
            
            // Vérifie s'il y a des films associés
            if (directorFilms.length > 0) {
                showToast(`Impossible de supprimer "${directorName}" car il a ${directorFilms.length} film(s) associé(s).`, 'error');
                return;
            }
            
            directors.splice(directorIndex, 1);
            saveDataToLocalStorage();
            renderDirectors();
            updateDashboard();
            showToast(`Réalisateur "${directorName}" supprimé avec succès !`, 'success');
        }
    }
    
    // ===== MODULE 3 : DASHBOARD & STATISTIQUES =====
    
    // Met à jour toutes les données du dashboard
    function updateDashboard() {
        // Met à jour les KPI (Key Performance Indicators)
        document.getElementById('kpi-films').textContent = films.length;
        document.getElementById('kpi-directors').textContent = directors.length;
        
        // Calcule la note moyenne des films
        const avgRating = films.length > 0 
            ? (films.reduce((sum, film) => sum + film.rating, 0) / films.length).toFixed(1)
            : '0.0';
        document.getElementById('kpi-avg-rating').textContent = avgRating;
        
        // Calcule la durée totale en heures
        const totalMinutes = films.reduce((sum, film) => sum + film.duration, 0);
        const totalHours = Math.round(totalMinutes / 60);
        document.getElementById('kpi-total-duration').textContent = totalHours;
        
        // Met à jour la liste des films récents
        updateRecentFilms();
        
        // Met à jour les graphiques du dashboard
        updateDashboardCharts();
    }
    
    // Met à jour la table des films récemment ajoutés
    function updateRecentFilms() {
        const recentFilmsBody = document.getElementById('recent-films-body');
        if (!recentFilmsBody) return;
        
        recentFilmsBody.innerHTML = '';
        
        // Récupère les 5 films les plus récents
        const recentFilms = [...films]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 5);
        
        recentFilms.forEach(film => {
            const director = getDirectorById(film.directorId);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${film.poster}" alt="${film.title}" class="rounded me-2" style="width: 40px; height: 60px; object-fit: cover;">
                        <strong>${film.title}</strong>
                    </div>
                </td>
                <td>${director?.name || 'Inconnu'}</td>
                <td>${film.year}</td>
                <td><span class="badge bg-secondary">${film.genre}</span></td>
                <td>${film.duration} min</td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-star text-warning me-1"></i>
                        <span>${film.rating.toFixed(1)}</span>
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-film-btn" data-id="${film.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            recentFilmsBody.appendChild(row);
        });
        
        // Attache les événements aux boutons de visualisation
        recentFilmsBody.querySelectorAll('.view-film-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filmId = parseInt(e.currentTarget.getAttribute('data-id'));
                showFilmDetails(filmId);
            });
        });
    }
    
    // Rafraîchit le dashboard avec animation
    function refreshDashboard() {
        const refreshBtn = document.getElementById('refresh-dashboard');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualisation...';
        
        // Simule un délai de rafraîchissement
        setTimeout(() => {
            updateDashboard();
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser';
            showToast('Dashboard actualisé avec succès', 'success');
        }, 1000);
    }
    
    // ===== INTÉGRATION API EXTERNE =====
    
    // Recherche des films via l'API OMDB
    async function searchFilmsAPI() {
        const searchInput = document.getElementById('api-search-input').value.trim();
        const resultsContainer = document.getElementById('api-results-container');
        const resultsCount = document.getElementById('api-results-count');
        
        if (!searchInput) {
            showToast('Veuillez saisir un terme de recherche', 'warning');
            return;
        }
        
        // Affiche l'indicateur de chargement
        showLoading();
        resultsContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3"></div>
                <p>Recherche en cours...</p>
            </div>
        `;
        
        try {
            // Utilisation de l'API OMDB avec clé publique de test
            const apiKey = 'apikey=thewdb'; // Clé publique pour démonstration
            const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(searchInput)}&${apiKey}`);
            
            if (!response.ok) throw new Error('Erreur réseau');
            
            const data = await response.json();
            
            if (data.Response === 'True') {
                // Récupère les détails complets pour chaque film
                const filmDetailsPromises = data.Search.slice(0, 8).map(async (item) => {
                    const detailResponse = await fetch(`https://www.omdbapi.com/?i=${item.imdbID}&${apiKey}`);
                    return await detailResponse.json();
                });
                
                const filmDetails = await Promise.all(filmDetailsPromises);
                displayAPIResults(filmDetails);
                resultsCount.textContent = `${filmDetails.length} résultat(s)`;
            } else {
                // Aucun résultat
                resultsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-film fa-3x text-muted mb-3"></i>
                        <h5>Aucun résultat</h5>
                        <p class="text-muted">Aucun film trouvé pour "${searchInput}"</p>
                    </div>
                `;
                resultsCount.textContent = '0 résultat(s)';
            }
        } catch (error) {
            console.error('Erreur API:', error);
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h5>Erreur de connexion</h5>
                    <p class="text-muted">Impossible de se connecter à l'API. Vérifiez votre connexion Internet.</p>
                </div>
            `;
            resultsCount.textContent = 'Erreur';
            showToast('Erreur lors de la recherche API', 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Affiche les résultats de l'API OMDB
    function displayAPIResults(filmsData) {
        const resultsContainer = document.getElementById('api-results-container');
        resultsContainer.innerHTML = '';
        
        filmsData.forEach(film => {
            const filmCard = document.createElement('div');
            filmCard.className = 'api-film-card mb-3';
            filmCard.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <img src="${film.Poster !== 'N/A' ? film.Poster : 'https://via.placeholder.com/300x450?text=Poster+non+disponible'}" 
                                     class="img-fluid rounded" alt="${film.Title}">
                            </div>
                            <div class="col-md-9">
                                <h5>${film.Title} (${film.Year})</h5>
                                <div class="row mb-2">
                                    <div class="col-md-6">
                                        <p><strong>Réalisateur :</strong> ${film.Director !== 'N/A' ? film.Director : 'Inconnu'}</p>
                                        <p><strong>Genre :</strong> ${film.Genre !== 'N/A' ? film.Genre : 'Non spécifié'}</p>
                                        <p><strong>Durée :</strong> ${film.Runtime !== 'N/A' ? film.Runtime : 'Non spécifiée'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Note :</strong> <span class="badge bg-warning">${film.imdbRating !== 'N/A' ? film.imdbRating : 'N/A'}</span></p>
                                        <p><strong>Langue :</strong> ${film.Language !== 'N/A' ? film.Language : 'N/A'}</p>
                                        <p><strong>Pays :</strong> ${film.Country !== 'N/A' ? film.Country : 'N/A'}</p>
                                    </div>
                                </div>
                                <p class="mb-3">${film.Plot !== 'N/A' ? film.Plot.substring(0, 200) + '...' : 'Aucun synopsis disponible.'}</p>
                                <button class="btn btn-primary add-from-api-btn" data-film='${JSON.stringify(film).replace(/'/g, "\\'")}'>
                                    <i class="fas fa-plus me-2"></i> Ajouter à ma base
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            resultsContainer.appendChild(filmCard);
        });
        
        // Attache les événements aux boutons d'ajout depuis l'API
        document.querySelectorAll('.add-from-api-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filmData = JSON.parse(e.currentTarget.getAttribute('data-film'));
                addFilmFromAPI(filmData);
            });
        });
    }
    
    // Ajoute un film depuis l'API à la base locale
    function addFilmFromAPI(apiFilm) {
        // Cherche ou crée le réalisateur
        let director = directors.find(d => d.name === apiFilm.Director);
        let directorId;
        
        if (!director && apiFilm.Director !== 'N/A') {
            // Crée un nouveau réalisateur
            directorId = getNextId(directors);
            const newDirector = {
                id: directorId,
                name: apiFilm.Director,
                nationality: apiFilm.Country !== 'N/A' ? apiFilm.Country.split(', ')[0] : '',
                birthdate: '',
                bio: `Réalisateur de "${apiFilm.Title}"`
            };
            directors.push(newDirector);
            director = newDirector;
        } else if (director) {
            directorId = director.id;
        } else {
            directorId = 0; // Réalisateur inconnu
        }
        
        // Crée l'objet film pour la base locale
        const newFilm = {
            id: getNextId(films),
            title: apiFilm.Title,
            directorId: directorId,
            year: parseInt(apiFilm.Year) || new Date().getFullYear(),
            genre: apiFilm.Genre !== 'N/A' ? apiFilm.Genre.split(', ')[0] : 'Non spécifié',
            duration: apiFilm.Runtime !== 'N/A' ? parseInt(apiFilm.Runtime.split(' ')[0]) : 120,
            rating: apiFilm.imdbRating !== 'N/A' ? parseFloat(apiFilm.imdbRating) : 7.0,
            poster: apiFilm.Poster !== 'N/A' ? apiFilm.Poster : 'https://via.placeholder.com/300x450?text=Poster+non+disponible',
            synopsis: apiFilm.Plot !== 'N/A' ? apiFilm.Plot : '',
            createdAt: new Date().toISOString()
        };
        
        // Ajoute à la base locale
        films.push(newFilm);
        saveDataToLocalStorage();
        
        // Met à jour l'interface
        renderFilms();
        renderDirectors();
        updateDashboard();
        
        showToast(`Film "${newFilm.title}" ajouté avec succès depuis l'API !`, 'success');
        
        // Redirige vers la section des films
        document.getElementById('films-link').click();
    }
    
    // ===== INITIALISATION DES GRAPHIQUES CHART.JS =====
    
    function initCharts() {
        // Graphique linéaire : Évolution des ajouts de films
        const filmsCtx = document.getElementById('filmsChart')?.getContext('2d');
        if (filmsCtx) {
            charts.filmsChart = new Chart(filmsCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
                    datasets: [{
                        label: 'Films ajoutés',
                        data: Array(12).fill(0),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#3498db',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                drawBorder: false
                            },
                            ticks: {
                                stepSize: 1
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
        
        // Graphique circulaire : Films par réalisateur
        const directorsCtx = document.getElementById('directorsChart')?.getContext('2d');
        if (directorsCtx) {
            charts.directorsChart = new Chart(directorsCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
                            '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        }
                    }
                }
            });
        }
        
        // Graphique en barres : Films par année (section statistiques)
        const yearCtx = document.getElementById('yearChart')?.getContext('2d');
        if (yearCtx) {
            charts.yearChart = new Chart(yearCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Nombre de films',
                        data: [],
                        backgroundColor: '#3498db',
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                drawBorder: false
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
        
        // Graphique circulaire : Répartition par genre (section statistiques)
        const genreCtx = document.getElementById('genreChart')?.getContext('2d');
        if (genreCtx) {
            charts.genreChart = new Chart(genreCtx, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
                            '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        }
        
        // Graphique en barres : Distribution des notes (section statistiques)
        const ratingCtx = document.getElementById('ratingChart')?.getContext('2d');
        if (ratingCtx) {
            charts.ratingChart = new Chart(ratingCtx, {
                type: 'bar',
                data: {
                    labels: ['0-2', '2-4', '4-6', '6-8', '8-10'],
                    datasets: [{
                        label: 'Nombre de films',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: '#f39c12',
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                drawBorder: false
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
    
    // Met à jour les graphiques du dashboard principal
    function updateDashboardCharts() {
        // Graphique des films par mois
        const filmsByMonth = Array(12).fill(0);
        films.forEach(film => {
            const date = new Date(film.createdAt || new Date());
            const month = date.getMonth();
            filmsByMonth[month]++;
        });
        
        if (charts.filmsChart) {
            charts.filmsChart.data.datasets[0].data = filmsByMonth;
            charts.filmsChart.update();
        }
        
        // Graphique des films par réalisateur (top 5)
        const filmsByDirector = {};
        films.forEach(film => {
            filmsByDirector[film.directorId] = (filmsByDirector[film.directorId] || 0) + 1;
        });
        
        const directorEntries = Object.entries(filmsByDirector)
            .map(([directorId, count]) => ({
                name: getDirectorById(parseInt(directorId))?.name || `Réalisateur #${directorId}`,
                count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        if (charts.directorsChart) {
            charts.directorsChart.data.labels = directorEntries.map(d => d.name);
            charts.directorsChart.data.datasets[0].data = directorEntries.map(d => d.count);
            charts.directorsChart.update();
        }
    }
    
    // Met à jour les graphiques de la section statistiques
    function updateStatsCharts() {
        // Met à jour les statistiques rapides
        if (films.length > 0) {
            const years = films.map(f => f.year);
            document.getElementById('stat-oldest-year').textContent = Math.min(...years);
            document.getElementById('stat-newest-year').textContent = Math.max(...years);
            
            const avgDuration = Math.round(films.reduce((sum, f) => sum + f.duration, 0) / films.length);
            document.getElementById('stat-avg-duration').textContent = `${avgDuration} min`;
            
            const uniqueGenres = [...new Set(films.map(f => f.genre))];
            document.getElementById('stat-genres-count').textContent = uniqueGenres.length;
        }
        
        // Graphique des films par année
        const filmsByYear = {};
        films.forEach(film => {
            filmsByYear[film.year] = (filmsByYear[film.year] || 0) + 1;
        });
        
        const years = Object.keys(filmsByYear).sort((a, b) => a - b);
        const countsByYear = years.map(year => filmsByYear[year]);
        
        if (charts.yearChart) {
            charts.yearChart.data.labels = years;
            charts.yearChart.data.datasets[0].data = countsByYear;
            charts.yearChart.update();
        }
        
        // Graphique des films par genre
        const filmsByGenre = {};
        films.forEach(film => {
            filmsByGenre[film.genre] = (filmsByGenre[film.genre] || 0) + 1;
        });
        
        const genres = Object.keys(filmsByGenre);
        const countsByGenre = genres.map(genre => filmsByGenre[genre]);
        
        if (charts.genreChart) {
            charts.genreChart.data.labels = genres;
            charts.genreChart.data.datasets[0].data = countsByGenre;
            charts.genreChart.update();
        }
        
        // Graphique de distribution des notes
        const ratingDistribution = [0, 0, 0, 0, 0];
        films.forEach(film => {
            const rating = film.rating;
            if (rating >= 0 && rating < 2) ratingDistribution[0]++;
            else if (rating >= 2 && rating < 4) ratingDistribution[1]++;
            else if (rating >= 4 && rating < 6) ratingDistribution[2]++;
            else if (rating >= 6 && rating < 8) ratingDistribution[3]++;
            else if (rating >= 8 && rating <= 10) ratingDistribution[4]++;
        });
        
        if (charts.ratingChart) {
            charts.ratingChart.data.datasets[0].data = ratingDistribution;
            charts.ratingChart.update();
        }
    }
    
    // ===== GESTION DE LA PERSISTANCE DES DONNÉES =====
    
    // Sauvegarde les données dans le localStorage du navigateur
    function saveDataToLocalStorage() {
        localStorage.setItem('cineTechFilms', JSON.stringify(films));
        localStorage.setItem('cineTechDirectors', JSON.stringify(directors));
        
        // Met à jour les statistiques d'utilisation du stockage
        updateStorageStats();
    }
    
    // Efface toutes les données de l'application
    function clearAllData() {
        films = [];
        directors = [];
        selectedFilms.clear();
        saveDataToLocalStorage();
        renderFilms();
        renderDirectors();
        updateDashboard();
        showToast('Toutes les données ont été effacées.', 'info');
    }
    
    // Exporte toutes les données au format JSON
    function exportData() {
        const data = {
            films: films,
            directors: directors,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Crée un lien de téléchargement
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `cineTech-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Données exportées avec succès !', 'success');
    }
    
    // Déclenche la sélection de fichier pour l'import
    function triggerImport() {
        document.getElementById('import-data-file').click();
    }
    
    // Gère l'import de données depuis un fichier JSON
    function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                
                // Vérifie le format du fichier
                if (!data.films || !data.directors) {
                    showToast('Format de fichier invalide', 'error');
                    return;
                }
                
                // Demande confirmation avant d'écraser les données
                if (confirm(`Cette action remplacera vos ${films.length} films et ${directors.length} réalisateurs par ${data.films.length} films et ${data.directors.length} réalisateurs. Continuer ?`)) {
                    films = data.films;
                    directors = data.directors;
                    saveDataToLocalStorage();
                    renderFilms();
                    renderDirectors();
                    updateDashboard();
                    showToast('Données importées avec succès !', 'success');
                }
            } catch (error) {
                showToast('Erreur lors de la lecture du fichier', 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
        
        // Réinitialise l'input file
        e.target.value = '';
    }
    
    // Met à jour l'affichage des statistiques de stockage
    function updateStorageStats() {
        const filmsSize = JSON.stringify(films).length;
        const directorsSize = JSON.stringify(directors).length;
        const totalSize = filmsSize + directorsSize;
        
        const maxSize = 5 * 1024 * 1024; // 5MB - limite du localStorage
        const percentage = (totalSize / maxSize) * 100;
        
        const progressBar = document.getElementById('storage-progress');
        const usedSpan = document.getElementById('storage-used');
        const totalSpan = document.getElementById('storage-total');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        
        if (usedSpan) {
            usedSpan.textContent = formatBytes(totalSize);
        }
        
        if (totalSpan) {
            totalSpan.textContent = formatBytes(maxSize);
        }
    }
    
    // ===== FONCTIONS UTILITAIRES =====
    
    // Génère un ID unique pour un nouvel élément dans un tableau
    function getNextId(array) {
        return array.length > 0 ? Math.max(...array.map(item => item.id)) + 1 : 1;
    }
    
    // Récupère un réalisateur par son ID
    function getDirectorById(id) {
        return directors.find(d => d.id === id);
    }
    
    // Affiche une modal de confirmation avant suppression
    function confirmDelete(type, id, name, callback) {
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const textElement = document.getElementById('delete-confirm-text');
        
        let message = '';
        if (type === 'film') {
            message = `Êtes-vous sûr de vouloir supprimer le film "${name}" ? Cette action est irréversible.`;
        } else if (type === 'director') {
            const directorFilms = films.filter(f => f.directorId === id);
            if (directorFilms.length > 0) {
                message = `Attention : ce réalisateur a ${directorFilms.length} film(s) associé(s). Êtes-vous sûr de vouloir le supprimer ?`;
            } else {
                message = `Êtes-vous sûr de vouloir supprimer le réalisateur "${name}" ? Cette action est irréversible.`;
            }
        } else if (type === 'films') {
            message = `Êtes-vous sûr de vouloir supprimer ${name} ? Cette action est irréversible.`;
        }
        
        textElement.textContent = message;
        
        // Stocke le callback à exécuter après confirmation
        deleteCallback = () => {
            callback();
            modal.hide();
            deleteCallback = null;
        };
        
        modal.show();
    }
    
    // Initialise l'application avec des données d'exemple
    function initializeSampleData() {
        // Réalisateurs par défaut
        const defaultDirectors = [
            { id: 1, name: "Christopher Nolan", nationality: "Britannique", birthdate: "1970-07-30", bio: "Réalisateur, scénariste et producteur britannique connu pour ses films complexes." },
            { id: 2, name: "Quentin Tarantino", nationality: "Américain", birthdate: "1963-03-27", bio: "Réalisateur, scénariste et producteur américain, maître du dialogue et de la violence stylisée." },
            { id: 3, name: "Steven Spielberg", nationality: "Américain", birthdate: "1946-12-18", bio: "Réalisateur, scénariste et producteur américain, pionnier du cinéma moderne." },
            { id: 4, name: "Martin Scorsese", nationality: "Américain", birthdate: "1942-11-17", bio: "Réalisateur, scénariste et producteur américain, spécialiste des films sur la mafia." },
            { id: 5, name: "James Cameron", nationality: "Canadien", birthdate: "1954-08-16", bio: "Réalisateur, scénariste et producteur canadien, connu pour ses films à grand budget." }
        ];
        
        // Films par défaut
        const defaultFilms = [
            { 
                id: 1, 
                title: "Inception", 
                directorId: 1, 
                year: 2010, 
                genre: "Science-fiction", 
                duration: 148, 
                rating: 8.8, 
                poster: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_FMjpg_UX1000_.jpg",
                synopsis: "Un voleur qui s'infiltre dans les rêves est chargé de planter une idée dans l'esprit d'un PDG.",
                createdAt: "2024-01-15T10:30:00Z"
            },
            { 
                id: 2, 
                title: "Pulp Fiction", 
                directorId: 2, 
                year: 1994, 
                genre: "Thriller", 
                duration: 154, 
                rating: 8.9, 
                poster: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_FMjpg_UX1000_.jpg",
                synopsis: "Les vies de deux tueurs à gages, d'un boxeur et d'un couple de braqueurs s'entrecroisent.",
                createdAt: "2024-02-20T14:45:00Z"
            },
            { 
                id: 3, 
                title: "Jurassic Park", 
                directorId: 3, 
                year: 1993, 
                genre: "Aventure", 
                duration: 127, 
                rating: 8.2, 
                poster: "https://m.media-amazon.com/images/M/MV5BMjM2MDgxMDg0Nl5BMl5BanBnXkFtZTgwNTM2OTM5NDE@._V1_FMjpg_UX1000_.jpg",
                synopsis: "Un entrepreneur crée un parc à thème avec des dinosaures clonés.",
                createdAt: "2024-03-10T09:15:00Z"
            },
            { 
                id: 4, 
                title: "The Departed", 
                directorId: 4, 
                year: 2006, 
                genre: "Thriller", 
                duration: 151, 
                rating: 8.5, 
                poster: "https://m.media-amazon.com/images/M/MV5BMTI1MTY2OTIxNV5BMl5BanBnXkFtZTYwNjQ4NjY3._V1_FMjpg_UX1000_.jpg",
                synopsis: "Un policier infiltre la mafia de Boston tandis qu'un criminel infiltre la police.",
                createdAt: "2024-03-25T16:20:00Z"
            },
            { 
                id: 5, 
                title: "Avatar", 
                directorId: 5, 
                year: 2009, 
                genre: "Science-fiction", 
                duration: 162, 
                rating: 7.9, 
                poster: "https://m.media-amazon.com/images/M/MV5BZDA0OGQxNTItMDZkMC00N2UyLTg3MzMtYTJmNjg3Nzk5MzRiXkEyXkFqcGdeQXVyMjUzOTY1NTc@._V1_FMjpg_UX1000_.jpg",
                synopsis: "Un marine paraplégique est envoyé sur la lune Pandora pour une mission unique.",
                createdAt: "2024-04-05T11:10:00Z"
            }
        ];
        
        directors = defaultDirectors;
        films = defaultFilms;
        
        saveDataToLocalStorage();
        showToast('Données d\'exemple chargées avec succès !', 'success');
    }
    
    // Gère la recherche globale dans toute l'application
    function handleGlobalSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm.length >= 2) {
            // Si on est sur le dashboard, redirige vers les films
            const activeSection = document.querySelector('.content-section.active');
            if (activeSection && activeSection.id === 'dashboard-section') {
                document.getElementById('films-link').click();
            }
            
            // Remplit le champ de recherche des films
            const filmSearch = document.getElementById('film-search');
            if (filmSearch) {
                filmSearch.value = searchTerm;
                renderFilms();
            }
        }
    }
    
    // Gère le changement de thème (clair/sombre/auto)
    function handleThemeChange(e) {
        const theme = e.currentTarget.getAttribute('data-theme');
        
        // Met à jour les boutons actifs
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Applique le thème sélectionné
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
        } else {
            // Mode auto - suit les préférences système
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
        
        showToast(`Thème ${theme} appliqué`, 'success');
    }
    
    // Gère le changement de couleur principale
    function handleColorChange(e) {
        const color = e.currentTarget.getAttribute('data-color');
        
        // Met à jour les boutons actifs
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Met à jour les variables CSS
        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--primary-dark', darkenColor(color, 20));
        
        showToast(`Couleur principale mise à jour`, 'success');
    }
    
    // Assombrit une couleur hexadécimale
    function darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return "#" + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }
    
    // Formate une taille en octets en unités lisible (Ko, Mo, Go)
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // Affiche l'overlay de chargement
    function showLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.add('show');
        }
    }
    
    // Cache l'overlay de chargement
    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.remove('show');
        }
    }
    
    // Affiche une notification toast (popup temporaire)
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Animation d'entrée
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto-destruction après 5 secondes
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
    
    // ===== INTERFACE PUBLIQUE DU MODULE =====
    // Expose uniquement les méthodes nécessaires à l'extérieur
    return {
        init: init,                     // Initialise l'application
        showToast: showToast,          // Affiche une notification
        getFilms: () => films,         // Récupère la liste des films (lecture seule)
        getDirectors: () => directors  // Récupère la liste des réalisateurs (lecture seule)
    };
})();

// ===== POINT D'ENTRÉE DE L'APPLICATION =====
// Initialise l'application quand le DOM est complètement chargé
document.addEventListener('DOMContentLoaded', function() {
    CineTechApp.init();
});

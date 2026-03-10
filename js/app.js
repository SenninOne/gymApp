// App State
const AppState = {
    workouts: [],
    exercises: [],
    activeWorkoutId: null,
    currentExerciseId: null,
    chartInstance: null
};

// Theme State
const ThemeState = {
    current: 'dark',
    icons: {
        dark: '🌙',
        light: '☀️',
        auto: '⚙️'
    }
};

// Initialize App
async function initApp() {
    try {
        await db.connect();
        console.log('✓ Database connected');
        
        // Load initial data
        await loadExercises();
        await loadWorkouts();
        
        // Initialize theme
        initTheme();
        
        console.log('✓ App initialized successfully');
        showToast('Gym Tracker ready!');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Error initializing app', 'error');
    }
}

// Load exercises into UI
async function loadExercises() {
    try {
        const exercises = await db.getAllExercises();
        AppState.exercises = exercises;
        
        // Populate exercise selects
        populateSelect('#exercise-list', exercises);
        populateSelect('#progress-exercise', exercises);
        
        // Render exercise library
        renderExerciseLibrary(exercises);
    } catch (error) {
        console.error('Failed to load exercises:', error);
        showToast('Error loading exercises', 'error');
    }
}

// Populate select dropdowns
function populateSelect(selector, items) {
    const select = document.querySelector(selector);
    if (!select) return;
    
    select.innerHTML = '<option value="">Select an exercise</option>';
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

// Render exercise library in More tab
function renderExerciseLibrary(exercises) {
    const container = document.getElementById('exercise-library');
    
    if (!container) return;
    
    // Sort alphabetically and separate custom from default
    const sortedExercises = exercises.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = sortedExercises.map(exercise => `
        <div class="exercise-item animate-in">
            <span class="exercise-name">${escapeHtml(exercise.name)}</span>
            <button 
                class="exercise-delete" 
                onclick="deleteExercise(${exercise.id}, '${escapeHtml(exercise.name)}')"
                title="Delete exercise">✕
            </button>
        </div>
    `).join('');
}

// Delete exercise handler
async function deleteExercise(id, name) {
    // Check if exercise is used in workouts
    const workoutExercises = await db.getAllWorkoutExercises();
    const isUsed = workoutExercises.some(we => we.exerciseId === id);
    
    if (isUsed) {
        showToast('Cannot delete: Exercise is used in workouts', 'error');
        return;
    }
    
    confirmModal(
        'Delete Exercise',
        `Are you sure you want to delete "${name}"? This cannot be undone.`,
        async () => {
            try {
                await db.deleteExercise(id);
                await loadExercises();
                
                // Update current exercise if needed
                if (AppState.currentExerciseId === id) {
                    AppState.currentExerciseId = null;
                    updateActiveWorkoutUI();
                }
                
                showToast(`✓ "${name}" deleted`);
            } catch (error) {
                console.error('Failed to delete exercise:', error);
                showToast('Error deleting exercise', 'error');
            }
        }
    );
}

// Load workouts into UI
async function loadWorkouts() {
    try {
        const workouts = await db.getAllWorkouts();
        AppState.workouts = workouts;
        
        renderWorkoutHistory(workouts);
    } catch (error) {
        console.error('Failed to load workouts:', error);
        showToast('Error loading workouts', 'error');
    }
}

// Render workout history
async function renderWorkoutHistory(workouts) {
    const container = document.getElementById('workouts-list');
    
    if (!container) return;
    
    if (workouts.length === 0) {
        container.innerHTML = `
            <div class="card">
                <p style="text-align: center; color: #575a6e; padding: 20px;">
                    No workouts yet. Start your first workout!
                </p>
            </div>
        `;
        return;
    }
    
    const renderedItems = await Promise.all(workouts.map(workout => renderWorkoutItem(workout)));
    container.innerHTML = renderedItems.join('');
}

// Render single workout item
async function renderWorkoutItem(workout) {
    const formattedDate = formatDate(workout.date);
    
    try {
        const workoutExercises = await db.getWorkoutExercises(workout.id);
        const exerciseName = workoutExercises[0]?.exerciseName || 'Unknown Exercise';
        
        let totalSets = 0;
        let volume = 0;
        let completedSets = [];
        
        workoutExercises.forEach(ex => {
            (ex.sets || []).forEach((set, index) => {
                if (set.completed) {
                    totalSets++;
                    const weight = parseFloat(set.weight) || 0;
                    const reps = parseInt(set.reps) || 0;
                    volume += weight * reps;
                    
                    if (weight > 0) {
                        completedSets.push({
                            setNumber: index + 1,
                            weight: weight,
                            reps: reps
                        });
                    }
                }
            });
        });
        
        let html = `
            <div class="workout-item animate-in" onclick="viewWorkoutDetails(${workout.id})">
                <div class="workout-header">
                    <span class="exercise-name">${escapeHtml(exerciseName)}</span>
                    <span class="workout-date">${formattedDate}</span>
                </div>
        `;
        
        if (workout.notes) {
            html += `<div class="workout-notes">${escapeHtml(workout.notes)}</div>`;
        }
        
        const statLabelSize = '13px';
        const setsHtml = completedSets.map(set => 
            `<span class="set-badge-inline-small">${set.weight}kg × ${set.reps} reps</span>`
        ).join('');
        
        html += `
                <div class="workout-actions">
                    <div class="stat-group">
                        <span class="stat-value">${totalSets}</span>
                        <span class="stat-label-large">SET</span>
                        <span class="stat-value">${volume}</span>
                        <span class="stat-label-large">KG</span>
                    </div>
                    <div class="sets-scroll-wrapper">${setsHtml}</div>
                </div>
            </div>
        `;
        
        return html;
    } catch (error) {
        console.error('Failed to render workout item:', error);
        return `
            <div class="workout-item animate-in" onclick="viewWorkoutDetails(${workout.id})">
                <div class="workout-date">${formattedDate}</div>
                <p style="color: #f87171; font-size: 12px;">Error loading workout data</p>
            </div>
        `;
    }
}

// Get workout stats for display
async function getWorkoutStats(workoutId) {
    try {
        const exercises = await db.getWorkoutExercises(workoutId);
        let totalSets = 0;
        let totalExercises = exercises.length;
        
        exercises.forEach(ex => {
            totalSets += (ex.sets || []).length;
        });
        
        return { totalSets, totalExercises };
    } catch (error) {
        console.error('Failed to get workout stats:', error);
        return { totalSets: 0, totalExercises: 0 };
    }
}

// View workout details
async function viewWorkoutDetails(workoutId) {
    try {
        const workout = await db.getWorkout(workoutId);
        if (!workout) return;
        
        const exercises = await db.getWorkoutExercises(workoutId);
        const formattedDate = formatDate(workout.date);
        
        let html = `<p style="color: #5eead4; margin-bottom: 15px;">${formattedDate}</p>`;
        if (workout.notes) {
            html += `<p style="margin-bottom: 20px; color: #575a6e;">${escapeHtml(workout.notes)}</p>`;
        }
        
        exercises.forEach((ex) => {
            html += `
                <div class="workout-details-item">
                    <div class="detail-header">${escapeHtml(ex.exerciseName)}</div>
                    <div class="detail-sets">
                        ${(ex.sets || []).map(set => 
                            set.completed ? `
                                <span class="set-badge">
                                    ${set.weight}kg × ${set.reps} reps
                                </span>` : ''
                        ).join('')}
                    </div>
                </div>
            `;
        });
        
        showModal(
            'Workout Details',
            html,
            async () => {
                await db.deleteWorkout(workoutId);
                await loadWorkouts();
                
                // If viewing completed workout during active session, reset
                if (AppState.activeWorkoutId === workoutId) {
                    AppState.activeWorkoutId = null;
                    updateActiveWorkoutUI();
                    showToast('Previous workout deleted');
                } else {
                    showToast('✓ Workout deleted');
                }
            },
            true
        );
    } catch (error) {
        console.error('Failed to view workout:', error);
        showToast('Error loading workout details', 'error');
    }
}

// Navigation handling
function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Update nav buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show corresponding tab
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Modal handling
function confirmModal(title, message, onConfirm) {
    showModal(
        title,
        `<p>${message}</p>`,
        onConfirm,
        true
    );
}

function showModal(title, content, onConfirm = null, showConfirm = false, onCancel = null) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    
    confirmBtn.style.display = showConfirm ? 'block' : 'none';
    
    // Setup confirm button
    if (onConfirm) {
        confirmBtn.onclick = () => {
            closeModal();
            onConfirm();
        };
    } else {
        confirmBtn.style.display = 'none';
    }
    
    // Setup cancel button
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (onCancel) {
        cancelBtn.onclick = () => {
            closeModal();
            onCancel();
        };
    } else {
        cancelBtn.onclick = closeModal;
    }
    
    overlay.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// Toast notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
        return `Today, ${formatTime(date)}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${formatTime(date)}`;
    } else {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Theme Functions
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('theme-toggle');
    
    if (savedTheme) {
        ThemeState.current = savedTheme;
    } else {
        ThemeState.current = 'auto';
    }
    
    applyTheme(ThemeState.current);
    setupThemeToggle(themeToggle);
}

function setupThemeToggle(button) {
    button.addEventListener('click', () => {
        cycleTheme();
    });
}

function cycleTheme() {
    const themes = ['dark', 'light', 'auto'];
    const currentIndex = themes.indexOf(ThemeState.current);
    ThemeState.current = themes[(currentIndex + 1) % themes.length];
    
    applyTheme(ThemeState.current);
    saveThemePreference();
}

function applyTheme(theme) {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (theme === 'auto') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.setAttribute('data-theme', systemDark ? 'dark' : 'light');
        themeToggle.textContent = ThemeState.icons.auto;
    } else {
        body.setAttribute('data-theme', theme);
        themeToggle.textContent = ThemeState.icons[theme];
    }
}

function saveThemePreference() {
    localStorage.setItem('theme', ThemeState.current);
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

// Add add-to-home-screen prompt for PWA
function setupPWA() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Could show a custom install button here
    });
    
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        showToast('App installed successfully!');
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch((error) => console.log('Service Worker registration failed:', error));
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupNavigation();
    setupPWA();
    
    // Make functions globally accessible for inline onclick handlers
    window.deleteExercise = deleteExercise;
    window.viewWorkoutDetails = viewWorkoutDetails;
    window.loadExercises = loadExercises;
    window.loadWorkouts = loadWorkouts;
    window.updateProgressChart = updateProgressChart;
});
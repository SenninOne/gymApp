// Workout State
let currentSetNumber = 1;

function setupWorkoutElements() {
    const btn = document.getElementById('add-workout-btn');
    
    if (btn) {
        btn.addEventListener('click', startNewWorkout);
    }
    
    // End workout button
    document.getElementById('end-workout-btn')?.addEventListener('click', endCurrentWorkout);
    
    // Add set button
    document.getElementById('add-set-btn')?.addEventListener('click', addSet);
    
    // Add set after exercise selection change
    const exerciseList = document.getElementById('exercise-list');
    if (exerciseList) {
        exerciseList.addEventListener('change', handleExerciseSelection);
        
        // Show sets container when exercise is selected
        exerciseList.parentElement?.parentElement?.classList.add('selected');
    }

    // Add exercise inline button
    document.getElementById('add-exercise-inline-btn')?.addEventListener('click', addCustomExerciseInline);
    
    // Custom exercise modal buttons
    const addCustomBtn = document.getElementById('add-custom-exercise-btn');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', () => {
            const modalContent = `<div class="input-group">
                <label>Exercise Name</label>
                <input type="text" id="custom-exercise-name" placeholder="Enter exercise name..." autofocus>
            </div>`;
            
            showModal(
                'Add Custom Exercise',
                modalContent,
                async () => {
                    const input = document.getElementById('custom-exercise-name');
                    const name = input.value.trim();
                    
                    if (!name) {
                        showToast('Please enter an exercise name', 'error');
                        return;
                    }
                    
                    try {
                        await db.addExercise(name);
                        await loadExercises();
                        
                        const select = document.getElementById('exercise-list');
                        const option = select.querySelector(`option[value="${select.lastChild.value}"]`);
                        if (option) select.value = select.lastChild.value;
                        
                        closeModal();
                        showToast(`✓ "${name}" added to library`);
                    } catch (error) {
                        console.error('Failed to add exercise:', error);
                        showToast('Error adding exercise', 'error');
                    }
                },
                true
            );
            
            const input = document.getElementById('custom-exercise-name');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('modal-confirm-btn').click();
                }
            });
        });
    }

    // Add custom exercise in workout
    document.getElementById('add-exercise-inline-btn')?.addEventListener('click', () => {
        const modalContent = `<div class="input-group">
            <label>Exercise Name</label>
            <input type="text" id="inline-custom-name" placeholder="Enter exercise name..." autofocus>
        </div>`;
        
        showModal(
            'Add Custom Exercise',
            modalContent,
            async () => {
                const input = document.getElementById('inline-custom-name');
                const name = input.value.trim();
                
                if (!name) {
                    showToast('Please enter an exercise name', 'error');
                    return;
                }
                
                try {
                    const newExerciseId = await db.addExercise(name);
                    await loadExercises();
                    
                    const select = document.getElementById('exercise-list');
                    select.value = newExerciseId;
                    
                    closeModal();
                    
                    addCustomSets(newExerciseId, name);
                } catch (error) {
                    console.error('Failed to add exercise:', error);
                    showToast('Error adding exercise', 'error');
                }
            },
            true
        );
        
        const input = document.getElementById('inline-custom-name');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('modal-confirm-btn').click();
            }
        });
    });
}

// Start new workout
async function startNewWorkout() {
    const notesInput = document.getElementById('workout-notes');
    const notes = notesInput?.value.trim() || '';
    
    try {
        AppState.activeWorkoutId = await db.addWorkout(notes);
        
        // Clear notes
        if (notesInput) notesInput.value = '';
        
        // Update UI
        updateActiveWorkoutUI();
        showToast('✓ Started new workout');
    } catch (error) {
        console.error('Failed to start workout:', error);
        showToast('Error starting workout', 'error');
    }
}

// End current workout
async function endCurrentWorkout() {
    if (!AppState.activeWorkoutId) return;
    
    confirmModal(
        'End Workout',
        'Are you sure you want to end this workout? All exercises will be saved.',
        async () => {
            try {
                AppState.activeWorkoutId = null;
                updateActiveWorkoutUI();
                
                await loadWorkouts();
                
                showToast('✓ Workout saved!');
            } catch (error) {
                console.error('Failed to end workout:', error);
                showToast('Error ending workout', 'error');
            }
        }
    );
}

// Handle exercise selection from dropdown
async function handleExerciseSelection(e) {
    const exerciseId = e.target.value;
    
    if (!exerciseId || !AppState.activeWorkoutId) return;
    
    // Reset current sets
    clearCurrentSets();
    
    // Auto-load 5 default sets for this exercise
    await addCustomSets(parseInt(exerciseId), e.target.options[e.target.selectedIndex].text);
    
    AppState.currentExerciseId = parseInt(exerciseId);
}

// Add custom sets with modal input
async function addCustomSets(selectedExerciseId, selectedName) {
    const currentExerciseSelect = document.getElementById('exercise-list');
    
    confirmModal(
        'Add Sets',
        `Adding sets for: ${selectedName}`,
        async () => {
            let setCount = 3; // Default to 3 sets
            
            if (AppState.activeWorkoutId) {
                // Create sets data
                const sets = [];
                
                // Add default values
                for (let i = 0; i < setCount; i++) {
                    sets.push({ weight: '', reps: '', completed: false });
                }
                
                try {
                    await db.addWorkoutExercise(AppState.activeWorkoutId, selectedExerciseId, sets);
                    
                    // Reload active workout UI
                    updateActiveWorkoutUI();
                    
                    if (sets.length > 0) {
                        showToast(`✓ Added ${sets.length} set(s)`);
                    } else {
                        showToast('Added exercise (add sets now)');
                    }
                } catch (error) {
                    console.error('Failed to add exercise to workout:', error);
                    showToast('Error adding exercise', 'error');
                }
            }
        },
        true, // Show confirm
        () => {} // Cancel callback - just dismiss modal but keep exercise selected
    );
}

// Add a new empty set row in the current workout view
async function addSet() {
    if (!AppState.activeWorkoutId || !AppState.currentExerciseId) {
        showToast('Select an exercise first!', 'error');
        return;
    }
    
    const container = document.getElementById('sets-container');
    if (!container) return;
    
    currentSetNumber++;
    
    const setHtml = `
        <div class="set-item animate-in" id="set-${currentSetNumber}">
            <div class="set-header">
                <span class="set-number">Set ${currentSetNumber}</span>
                <button class="remove-set-btn" onclick="removeSet(${currentSetNumber})">✕</button>
            </div>
            <div class="set-inputs">
                <div class="set-input-row">
                    <input 
                        type="number" 
                        placeholder="Weight (kg)" 
                        onblur="updateSet(${currentSetNumber}, 'weight', this)"
                        data-set="${currentSetNumber}"
                        data-field="weight"
                    >
                    <input 
                        type="number" 
                        placeholder="Reps" 
                        onblur="updateSet(${currentSetNumber}, 'reps', this)"
                        data-set="${currentSetNumber}"
                        data-field="reps"
                    >
                </div>
                <select 
                    onchange="updateSet(${currentSetNumber}, 'completed', this)"
                    data-set="${currentSetNumber}"
                    data-field="completed"
                >
                    <option value="">All Done?</option>
                    <option value="true">✅ Yes</option>
                    <option value="false">❌ No</option>
                </select>
            </div>
        </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = setHtml;
    container.appendChild(tempDiv.firstElementChild);
    
    // Save new empty set to IndexedDB
    try {
        const workoutExercises = await db.getWorkoutExercises(AppState.activeWorkoutId);
        
        for (const we of workoutExercises) {
            if (we.exerciseId === AppState.currentExerciseId) {
                we.sets.push({ weight: '', reps: '', completed: false });
                await db.updateWorkoutExercise(we.id, { sets: we.sets });
                break;
            }
        }
    } catch (error) {
        console.error('Failed to save new set:', error);
    }
}

// Update set data
async function updateSet(setNum, field, element) {
    const value = element.value;
    
    // Parse value appropriately
    let parsedValue;
    if (element.tagName === 'SELECT') {
        parsedValue = value === 'true' || value === 'false';
    } else if (field === 'weight' || field === 'reps') {
        parsedValue = value ? parseFloat(value) : '';
    } else {
        parsedValue = value;
    }
    
    const setIndex = setNum - 1; // Convert to 0-based index
    
    // Get all workout exercises for current workout
    try {
        const workoutExercises = await db.getWorkoutExercises(AppState.activeWorkoutId);
        
        let foundExercise = false;
        
        for (const we of workoutExercises) {
            if (we.exerciseId === AppState.currentExerciseId && we.sets[setIndex]) {
                // Mark first set as completed
                let markedCompleted = false;

                Object.keys(we.sets).forEach((idx, arrIdx) => {
                    const idxInt = parseInt(idx);
                    if (arrIdx < setIndex || (arrIdx === setIndex && field !== 'completed')) {
                        we.sets[idxInt].completed = true;
                    } else if (arrIdx === setIndex && field === 'completed') {
                        // Only mark this set as completed if user selected it
                        markedCompleted = (we.sets[idxInt]?.completed === true) ? true : false;
                    }
                });

                we.sets[setIndex][field] = parsedValue;
                
                await db.updateWorkoutExercise(we.id, { sets: we.sets });
                foundExercise = true;
            }
        }

        if (!foundExercise) {
            showToast('Please select an exercise first', 'error');
        }
    } catch (error) {
        console.error('Failed to update set:', error);
    }
}

// Remove a set from the current workout
async function removeSet(setNum) {
    try {
        const workoutExercises = await db.getWorkoutExercises(AppState.activeWorkoutId);
        
        for (const we of workoutExercises) {
            if (we.exerciseId === AppState.currentExerciseId && we.sets[setNum - 1]) {
                // Remove this set from the sets array
                we.sets.splice(setNum - 1, 1);
                
                await db.updateWorkoutExercise(we.id, { sets: we.sets });
                
                // Update UI - remove the element
                const setElement = document.getElementById(`set-${setNum}`);
                if (setElement) {
                    setElement.remove();
                    
                    // Re-number remaining sets
                    document.querySelectorAll('#sets-container .set-item').forEach((el, index) => {
                        el.querySelector('.set-number').textContent = `Set ${index + 1}`;
                    });
                }
                
                // Decrement the counter
                currentSetNumber = setNum - 1;
                break;
            }
        }
        
        showToast('✓ Set removed');
    } catch (error) {
        console.error('Failed to remove set:', error);
        showToast('Error removing set', 'error');
    }
}

// Clear current sets UI
function clearCurrentSets() {
    const container = document.getElementById('sets-container');
    if (container) container.innerHTML = '';
    
    currentSetNumber = 0;
}

// Update active workout UI
async function updateActiveWorkoutUI() {
    const activeWorkoutDiv = document.getElementById('active-workout');
    const currentExerciseName = document.getElementById('current-exercise-name');
    
    if (AppState.activeWorkoutId) {
        // Show active workout container
        activeWorkoutDiv?.classList.remove('hidden');
        
        // Load and display exercises for this workout
        try {
            const workoutExercises = await db.getWorkoutExercises(AppState.activeWorkoutId);
            
            if (workoutExercises.length > 0) {
                // Get first exercise details
                const firstExercise = workoutExercises[0];
                currentExerciseName.textContent = firstExercise.exerciseName;
                
                // Select it in dropdown
                const exerciseSelect = document.getElementById('exercise-list');
                if (exerciseSelect && firstExercise.exerciseId) {
                    exerciseSelect.value = firstExercise.exerciseId;
                    AppState.currentExerciseId = firstExercise.exerciseId;
                    
                    // Render sets
                    renderSets(firstExercise);
                }
            } else {
                currentExerciseName.textContent = 'Select Exercise';
            }
        } catch (error) {
            console.error('Failed to load workout exercises:', error);
        }
    } else {
        activeWorkoutDiv?.classList.add('hidden');
    }
}

// Render sets in the active workout view
function renderSets(workoutExercise) {
    const container = document.getElementById('sets-container');
    if (!container) return;
    
    clearCurrentSets();
    
    currentSetNumber = 0;
    
    (workoutExercise.sets || []).forEach((set, index) => {
        currentSetNumber++;
        
        const weightValue = set.weight !== undefined ? set.weight : '';
        const repsValue = set.reps !== undefined ? set.reps : '';
        const completedValue = set.completed === true ? 'true' : (set.completed === false ? 'false' : '');
        
        const setHtml = `
            <div class="set-item animate-in" id="set-${currentSetNumber}">
                <div class="set-header">
                    <span class="set-number">Set ${index + 1}</span>
                    <button class="remove-set-btn" onclick="removeSet(${currentSetNumber})">✕</button>
                </div>
                <div class="set-inputs">
                    <div class="set-input-row">
                        <input 
                            type="number" 
                            placeholder="Weight (kg)" 
                            value="${weightValue}"
                            onblur="updateSet(${currentSetNumber}, 'weight', this)"
                            data-set="${currentSetNumber}"
                            data-field="weight"
                        >
                        <input 
                            type="number" 
                            placeholder="Reps" 
                            value="${repsValue}"
                            onblur="updateSet(${currentSetNumber}, 'reps', this)"
                            data-set="${currentSetNumber}"
                            data-field="reps"
                        >
                    </div>
                    <select 
                        onchange="updateSet(${currentSetNumber}, 'completed', this)"
                        data-set="${currentSetNumber}"
                        data-field="completed"
                    >
                        <option value="">All Done?</option>
                        <option value="true" ${set.completed ? 'selected' : ''}>✅ Yes</option>
                        <option value="false" ${!set.completed && set.completed !== undefined ? 'selected' : ''}>❌ No</option>
                    </select>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = setHtml;
        container.appendChild(tempDiv.firstElementChild);
    });
}

// Add custom exercise inline (when already started workout)
async function addCustomExerciseInline() {
    showModal(
        'Add Custom Exercise',
        `<div class="input-group">
            <label>Exercise Name</label>
            <input type="text" id="quick-custom-name" placeholder="Enter custom exercise...">
        </div>`,
        async () => {
            const input = document.getElementById('quick-custom-name');
            const name = input.value.trim();
            
            if (!name) {
                showToast('Please enter an exercise name', 'error');
                return;
            }
            
            try {
                const newExerciseId = await db.addExercise(name);
                await loadExercises();
                
                // Select the new custom exercise
                const select = document.getElementById('exercise-list');
                select.value = newExerciseId;
                
                closeModal();
                
                handleExerciseSelection({ target: select });
            } catch (error) {
                console.error('Failed to add custom exercise:', error);
                showToast('Error adding exercise', 'error');
            }
        }
    );
}

// Initialize workout elements when DOM is ready
document.addEventListener('DOMContentLoaded', setupWorkoutElements);

// Expose functions to window for inline onclick handlers
window.startNewWorkout = startNewWorkout;
window.endCurrentWorkout = endCurrentWorkout;
window.addSet = addSet;
window.removeSet = removeSet;
window.updateSet = updateSet;
window.addCustomExerciseInline = addCustomExerciseInline;
window.handleExerciseSelection = handleExerciseSelection;
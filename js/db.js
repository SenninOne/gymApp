class GymDB {
    constructor() {
        this.dbName = 'GymTrackerDB';
        this.version = 1;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database connected successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Exercises store
                if (!db.objectStoreNames.contains('exercises')) {
                    const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
                    exerciseStore.createIndex('name', 'name', { unique: false });
                    
                    // Add default exercises
                    const defaultExercises = [
                        { name: 'Barbell Bench Press' },
                        { name: 'Barbell Squat' },
                        { name: 'Deadlift' },
                        { name: 'Overhead Press' },
                        { name: 'Barbell Row' },
                        { name: 'Pull-ups' },
                        { name: 'Dumbbell Bench Press' },
                        { name: 'Dumbbell Shoulder Press' },
                        { name: 'Lat Pulldown' },
                        { name: 'Leg Press' },
                        { name: 'Leg Curl' },
                        { name: 'Leg Extension' },
                        { name: 'Cable Fly' },
                        { name: 'Tricep Pushdown' },
                        { name: 'Bicep Curl' },
                        { name: 'Lunges' },
                        { name: 'Plank' },
                        { name: 'Dips' },
                        { name: 'Cable Crossover' },
                        { name: 'Face Pulls' }
                    ];

                    defaultExercises.forEach(exercise => {
                        exerciseStore.add(exercise);
                    });
                }

                // Workouts store
                if (!db.objectStoreNames.contains('workouts')) {
                    const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
                    workoutStore.createIndex('date', 'date', { unique: false });
                }

                // Workout Exercises store (links between workouts and exercises)
                if (!db.objectStoreNames.contains('workoutExercises')) {
                    db.createObjectStore('workoutExercises', { keyPath: 'id', autoIncrement: true });
                }

                console.log('Database structure created/updated');
            };
        });
    }

    // Exercises CRUD
    async getAllExercises() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['exercises'], 'readonly');
            const store = transaction.objectStore('exercises');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addExercise(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['exercises'], 'readwrite');
            const store = transaction.objectStore('exercises');
            const exercise = { name };
            const request = store.add(exercise);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteExercise(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['exercises', 'workoutExercises'], 'readwrite');
            
            // Delete from exercises
            const exerciseStore = transaction.objectStore('exercises');
            exerciseStore.delete(id);

            // Delete associated workout exercises
            const workoutExercisesStore = transaction.objectStore('workoutExercises');
            const request = workoutExercisesStore.getAll();
            
            request.onsuccess = () => {
                request.result.forEach(item => {
                    if (item.exerciseId === id) {
                        workoutExercisesStore.delete(item.id);
                    }
                });
                
                transaction.oncomplete = () => resolve();
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Workouts CRUD
    async getAllWorkouts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workouts'], 'readonly');
            const store = transaction.objectStore('workouts');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result.sort((a, b) => b.date - a.date));
            request.onerror = () => reject(request.error);
        });
    }

    async getWorkout(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workouts'], 'readonly');
            const store = transaction.objectStore('workouts');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addWorkout(notes = '') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workouts'], 'readwrite');
            const store = transaction.objectStore('workouts');
            const workout = {
                notes,
                date: Date.now()
            };
            const request = store.add(workout);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateWorkout(id, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workouts'], 'readwrite');
            const store = transaction.objectStore('workouts');
            
            store.get(id).onsuccess = (e) => {
                const existing = e.target.result;
                const updated = { ...existing, ...data };
                const request = store.put(updated);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    async deleteWorkout(id) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get all workout exercises and delete them
                const workoutExercises = await this.getAllWorkoutExercises();
                
                const transaction = this.db.transaction(['workouts', 'workoutExercises'], 'readwrite');
                
                // Delete associated workout exercises
                const exerciseStore = transaction.objectStore('workoutExercises');
                workoutExercises.forEach(item => {
                    if (item.workoutId === id) {
                        exerciseStore.delete(item.id);
                    }
                });

                // Delete workout
                const workoutStore = transaction.objectStore('workouts');
                workoutStore.delete(id);

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Workout Exercises CRUD
    async addWorkoutExercise(workoutId, exerciseId, sets) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readwrite');
            const store = transaction.objectStore('workoutExercises');
            
            const workoutExercise = {
                workoutId,
                exerciseId,
                sets
            };

            const request = store.add(workoutExercise);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWorkoutExercises(workoutId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readonly');
            const store = transaction.objectStore('workoutExercises');
            const request = store.getAll();

            request.onsuccess = () => {
                const exercises = request.result.filter(ve => ve.workoutId === workoutId);
                
                // Get exercise names
                const exercisePromises = exercises.map(ex => 
                    this.getExerciseById(ex.exerciseId).then(exer => ({
                        ...ex,
                        exerciseName: exer?.name || 'Unknown'
                    }))
                );

                Promise.all(exercisePromises).then(results => resolve(results));
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getAllWorkoutExercises() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readonly');
            const store = transaction.objectStore('workoutExercises');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWorkoutExercise(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readonly');
            const store = transaction.objectStore('workoutExercises');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateWorkoutExercise(id, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readwrite');
            const store = transaction.objectStore('workoutExercises');
            
            store.get(id).onsuccess = (e) => {
                const existing = e.target.result;
                const updated = { ...existing, ...data };
                const request = store.put(updated);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    async deleteWorkoutExercise(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['workoutExercises'], 'readwrite');
            const store = transaction.objectStore('workoutExercises');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Get single exercise
    async getExerciseById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['exercises'], 'readonly');
            const store = transaction.objectStore('exercises');
            const request = store.get(parseInt(id));

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get progress data for an exercise
    async getExerciseProgress(exerciseId, metric = 'max-weight') {
        return new Promise(async (resolve, reject) => {
            try {
                const workoutExercises = await this.getAllWorkoutExercises();
                const workouts = await this.getAllWorkouts();

                // Filter workout exercises for this exercise
                const relevantData = workoutExercises
                    .filter(we => we.exerciseId === parseInt(exerciseId))
                    .map(we => {
                        const workout = workouts.find(w => w.id === we.workoutId);
                        if (!workout) return null;

                        // Calculate metrics for each set in the workout exercise
                        const sets = we.sets || [];
                        
                        let maxWeight = 0;
                        let totalVolume = 0;
                        let lastWorkoutWeight = 0;

                        sets.forEach(set => {
                            if (set.completed) {
                                const weight = parseFloat(set.weight) || 0;
                                const reps = parseInt(set.reps) || 0;
                                
                                maxWeight = Math.max(maxWeight, weight);
                                totalVolume += weight * reps;
                                lastWorkoutWeight = weight;
                            }
                        });

                        return {
                            date: workout.date,
                            formattedDate: new Date(workout.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: '2-digit'
                            }),
                            maxWeight,
                            totalVolume,
                            lastWorkoutWeight
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.date - b.date);

                resolve(relevantData);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create global instance
const db = new GymDB();
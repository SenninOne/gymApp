// Chart Manager
let progressChartInstance = null;

// Initialize chart controls
document.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.getElementById('update-chart-btn');
    const metricSelect = document.getElementById('metric-type');
    const exerciseSelect = document.getElementById('progress-exercise');
    
    if (updateBtn) {
        updateBtn.addEventListener('click', updateProgressChart);
        
        // Also update on exercise change
        if (exerciseSelect) {
            exerciseSelect.addEventListener('change', updateProgressChart);
        }
        
        // If metric changes, update chart
        if (metricSelect) {
            metricSelect.addEventListener('change', () => {
                setTimeout(updateProgressChart, 200);
            });
        }
    }
});

// Update progress chart
async function updateProgressChart() {
    const exerciseId = document.getElementById('progress-exercise')?.value;
    const metricType = document.getElementById('metric-type')?.value || 'max-weight';
    
    if (!exerciseId) {
        showToast('Please select an exercise', 'error');
        
        // Clear chart if no exercise selected
        clearChart();
        return;
    }
    
    try {
        const progressData = await db.getExerciseProgress(exerciseId, metricType);
        
        if (!progressData || progressData.length === 0) {
            showToast('No workout data for this exercise yet', 'error');
            clearChart();
            return;
        }
        
        renderProgressBar(chart => {
            Chart.defaults.color = '#ffffff';
            Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto';
            
            const chartConfig = {
                type: 'line',
                data: getChartConfig(progressData, metricType),
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true
                        },
                        tooltip: {
                            backgroundColor: '#16213e',
                            titleColor: '#5eead4',
                            bodyColor: '#ffffff',
                            borderColor: '#0f3460',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y;
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: '#0f3460',
                                borderColor: '#0f3460'
                            },
                            ticks: {
                                font: { size: 11 }
                            }
                        },
                        y: {
                            beginAtZero: false,
                            grid: {
                                color: '#0f3460',
                                borderColor: '#0f3460'
                            },
                            ticks: {
                                font: { size: 11 }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    elements: {
                        line: {
                            tension: 0.4,
                            borderWidth: 3
                        },
                        point: {
                            radius: 5,
                            hoverRadius: 7
                        }
                    }
                }
            };
            
            return chartConfig;
        });
        
        showToast('✓ Progress chart updated');
    } catch (error) {
        console.error('Failed to load progress data:', error);
        showToast('Error loading progress data', 'error');
    }
}

// Get chart configuration based on metric type
function getChartConfig(data, metricType) {
    const labels = [];
    const values = [];
    
    // Sort by date (oldest first)
    const sortedData = [...data].sort((a, b) => a.date - b.date);
    
    sortedData.forEach(item => {
        labels.push(item.formattedDate);
        
        let value;
        switch (metricType) {
            case 'max-weight':
                value = item.maxWeight;
                break;
            case 'total-volume':
                value = Math.round(item.totalVolume / 10) / 10; // Round to nearest 10kg
                break;
            case 'last-workout':
                value = item.lastWorkoutWeight;
                break;
            default:
                value = item.maxWeight;
        }
        
        values.push(value);
    });
    
    const metricLabels = {
        'max-weight': 'Max Weight (kg)',
        'total-volume': 'Total Volume (kg)',
        'last-workout': 'Last Workout (kg)'
    };
    
    return {
        labels: labels,
        datasets: [{
            label: metricLabels[metricType] || 'Weight',
            data: values,
            borderColor: '#5eead4',
            backgroundColor: 'rgba(94, 234, 212, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#5eead4',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        }]
    };
}

// Render or update progress bar
function renderProgressBar(configCallback) {
    const canvas = document.getElementById('progress-chart');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (progressChartInstance) {
        progressChartInstance.destroy();
    }
    
    // Get config and render new chart
    const config = configCallback(progressChartInstance);
    progressChartInstance = new Chart(ctx, config);
}

// Clear the chart
function clearChart() {
    if (progressChartInstance) {
        progressChartInstance.destroy();
        progressChartInstance = null;
    }
    
    const canvas = document.getElementById('progress-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (progressChartInstance) {
        // Ensure proper dimensions after resize
        const container = document.getElementById('progress-exercise')?.parentElement;
        if (container) {
            progressChartInstance.resize();
        }
    }
});
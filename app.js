// ==========================================================
// == GLOBAL CONSTANTS, REFERENCES, AND STATE VARIABLES ====
// ==========================================================

// Sensor and Calculation Constants
const ACCELERATION_THRESHOLD = 1.25; 
const STEP_DEBOUNCE_TIME = 200;
const STEP_LENGTH_M = 0.76;

// Element References (Defined once, globally)
const dateTimeDisplay = document.getElementById('dateTimeDisplay');
const stepsElement = document.getElementById('steps');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const statusMessage = document.getElementById('statusMessage');
const counterDisplay = document.getElementById('counterDisplay');
const warningBox = document.getElementById('warningBox');
const notSupportedBox = document.getElementById('notSupportedBox');
const distanceElement = document.getElementById('distanceDisplay');
const durationElement = document.getElementById('durationDisplay');
const historyLog = document.getElementById('historyLog'); 

// State Variables (Defined once, globally)
let stepCount = 0;
let isRunning = false;
let lastStepTime = 0;
let lastZ = 0;
let timerInterval = null; 
let durationSeconds = 0;  

// ==========================================================
// == UTILITY FUNCTIONS (Clock, Duration, History) ==========
// ==========================================================

/**
 * Updates the date and time display every second.
 */
function updateDateTime() {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString(undefined, dateOptions);
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const timeString = now.toLocaleTimeString(undefined, timeOptions);
    dateTimeDisplay.innerHTML = `${dateString} | ${timeString}`;
}

/**
 * Formats total seconds into a clean HH:MM:SS string.
 */
function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Updates the duration every second.
 */
function updateDurationDisplay() {
    durationSeconds++;
    durationElement.textContent = formatDuration(durationSeconds);
}

// ------------------- HISTORY FUNCTIONS ----------------------

function loadHistory() {
    const historyJson = localStorage.getItem('stepHistory');
    return historyJson ? JSON.parse(historyJson) : [];
}

function saveDailySteps() {
    const today = new Date().toISOString().split('T')[0];
    let history = loadHistory();

    const todayIndex = history.findIndex(item => item.date === today);

    if (todayIndex > -1) {
        history[todayIndex].steps = stepCount; 
    } else if (stepCount > 0) {
        history.push({ date: today, steps: stepCount });
    }

    history = history.slice(-7); 
    localStorage.setItem('stepHistory', JSON.stringify(history));
    renderHistory(); 
}

function renderHistory() {
    const history = loadHistory();
    historyLog.innerHTML = ''; 

    if (history.length === 0) {
        historyLog.innerHTML = '<p class="text-gray-500 text-sm italic">No history yet. Start tracking steps!</p>';
        return;
    }

    history.slice().reverse().forEach(item => {
        const dateObj = new Date(item.date);
        const displayDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0';
        div.innerHTML = `
            <span class="font-medium text-gray-700">${displayDate}</span>
            <span class="font-bold text-indigo-600">${item.steps.toLocaleString()} steps</span>
        `;
        historyLog.appendChild(div);
    });
}


// ==========================================================
// == CORE APP LOGIC (Called by HTML/Events) ================
// ==========================================================

/**
 * Checks support and handles permission request on click.
 * This is the function called by the "Start Tracking" button.
 */
async function requestSensorAccess() {
    if (isRunning) {
        toggleCounting();
        return;
    }

    if (!('DeviceMotionEvent' in window)) {
        notSupportedBox.classList.remove('hidden');
        statusMessage.textContent = "Motion sensor not supported.";
        return;
    }
    
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        warningBox.classList.remove('hidden');
        try {
            const permissionState = await DeviceMotionEvent.requestPermission();
            warningBox.classList.add('hidden');
            if (permissionState === 'granted') {
                toggleCounting(true);
            } else {
                statusMessage.textContent = "Permission denied. Cannot track steps.";
                startButton.textContent = "Permission Denied";
                startButton.disabled = true;
            }
        } catch (error) {
            console.error("Error requesting motion permission:", error);
            statusMessage.textContent = "Error requesting motion permission.";
        }
    } else {
        toggleCounting(true);
    }
}

/**
 * Detecting steps based on device acceleration.
 */
function handleDeviceMotion(event) {
    if (!isRunning) return;
    const currentZ = event.accelerationIncludingGravity.z;
    const timeNow = Date.now();
    const deltaZ = currentZ - lastZ;

    if (Math.abs(deltaZ) > ACCELERATION_THRESHOLD && (timeNow - lastStepTime) > STEP_DEBOUNCE_TIME) {
        stepCount++;
        stepsElement.textContent = stepCount;
        const distanceKM = (stepCount * STEP_LENGTH_M) / 1000;
        distanceElement.textContent = distanceKM.toFixed(2);
        lastStepTime = timeNow;
    }
    lastZ = currentZ;
}

/**
 * Starts or stops the step counting process.
 */
function toggleCounting(forceStart = null) {
    const shouldRun = forceStart !== null ? forceStart : !isRunning;
    if (shouldRun) {
        // Start Tracking
        window.addEventListener('devicemotion', handleDeviceMotion);
        if (!timerInterval) {
            timerInterval = setInterval(updateDurationDisplay, 1000); 
        }
        startButton.textContent = "Stop Tracking";
        startButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700'); 
        startButton.classList.add('bg-red-500', 'hover:bg-red-600');
        statusMessage.textContent = "Tracking active. Start walking!";
        counterDisplay.classList.add('running');
        isRunning = true;
    } else {              
        // Stop Tracking
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        window.removeEventListener('devicemotion', handleDeviceMotion);
        
        saveDailySteps(); 

        startButton.textContent = "Start Tracking";
        startButton.classList.remove('bg-red-500', 'hover:bg-red-600');
        startButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        statusMessage.textContent = `Tracking paused. Total steps: ${stepCount}.`;
        counterDisplay.classList.remove('running');
        isRunning = false;
    }
}

/**
 * Resets the step counter and display.
 */
function resetCounter() {
    if (isRunning) {
        toggleCounting(false); 
    }
    saveDailySteps(); 
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    stepCount = 0;
    durationSeconds = 0;
    lastStepTime = 0;
    stepsElement.textContent = 0;
    distanceElement.textContent = '0.00';
    durationElement.textContent = '00:00:00';
    statusMessage.textContent = "Counter reset. Press 'Start' to begin tracking.";
    console.log("Step counter reset.");
}

// ==========================================================
// == INITIALIZATION (Runs after the HTML is Ready) =========
// ==========================================================

function initializeApp() {
    // Set initial button state
    startButton.classList.remove('bg-red-500', 'hover:bg-red-600');
    startButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    startButton.textContent = "Start Tracking";
    statusMessage.textContent = "Press 'Start' to begin tracking.";
    
    // Load and display history on app start
    renderHistory();
}

// 1. Start the real-time clock immediately
setInterval(updateDateTime, 1000);
updateDateTime();

// 2. Call the main initializer when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// 3. PWA Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
            console.log('Service Worker registered! Scope:', reg.scope);
        })
        .catch(err => {
            console.warn('Service Worker registration failed:', err);
        });
    }
}
registerServiceWorker();

// --- End of app.js ---
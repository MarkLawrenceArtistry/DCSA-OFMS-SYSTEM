/**
* =============================================================================
* DCSA Caloocan - Online Feedback Management System
* =============================================================================
*
* Scope:
*   •	Provides a web platform for DCSA Caloocan students and alumni to submit feedback.
*   •	Allows DCSA staff (Moderators, Admins) to manage users and moderate feedback.
*   •	Tracks the status and roadmap progress of submitted feedback.
*   •	Logs staff actions for accountability.
*   •	Offers basic configuration options for feedback categorization (topics, categories, roadmaps, courses).
*   •	Includes data recovery features like recycle bins and backup/restore.
*   •	Manages user accounts, including registration approval and deletion requests.
*   •	Operates using the browser's LocalStorage for data persistence.
*
* Coder:                  [Mark Lawrence L. Catubay]
* System Architect:       [Ryan Anthony Terrado]
* QA Tester:              [Jayson Bernante]
* Date:        [5/7/2025]
*
* =============================================================================
* Table of Contents
* =============================================================================
*
* 1. Constants
* 2. Global Variables
* 3. Utilities
* 4. Modal Functions
* 5. Session & Authentication Check
* 6. Login/Logout
* 7. Forgot Password Flow
* 8. User Account Management
* 9. Feedback Handling
* 10. Feedback Management
* 11. User Management (Students)
* 12. User Management (Alumni)
* 13. User Management (Staff)
* 14. User Recycle Bin
* 15. Configuration Management
* 16. Configuration Recycle Bin
* 17. Dashboard Functions
* 18. Action Log
* 19. Backup/Restore
* 20. Account Deletion Flow
* 21. UI
* 22. Page Initialization
* 23. Developer Maintenance Functions
=============================================================================
*/


// ==========================================================================
// - 1.) Constants -
// ==========================================================================
const STUDENTS_KEY = 'feedbackSystem_students';
const ALUMNI_KEY = 'feedbackSystem_alumni';
const STAFF_KEY = 'feedbackSystem_staff';
const FEEDBACKS_KEY = 'feedbackSystem_feedbacks';
const CONFIG_KEY = 'feedbackSystem_config';
const ACTION_LOG_KEY = 'feedbackSystem_actionLog';
const RECYCLE_BIN_KEY = 'feedbackSystem_recycleBin';
const LOGIN_ATTEMPTS_KEY = 'feedbackSystem_loginAttempts';
const FEEDBACK_COOLDOWN_KEY = 'feedbackSystem_feedbackCooldown';
const SESSIONS_KEY = 'feedbackSystem_sessions';
const PINNED_FEEDBACKS_KEY = 'feedbackSystem_pinnedFeedbacks';
const DELETION_QUEUE_KEY = 'feedbackSystem_deletionQueue';
const STUDENT_TIMEOUT_LIMIT_MINUTES = 30;
const ALUMNI_TIMEOUT_LIMIT_MINUTES = 30;
const ADMIN_TIMEOUT_LIMIT_MINUTES = 30;
const FEEDBACK_COOLDOWN_MINUTES = 30;
const LOGIN_ATTEMPT_LIMIT = 5;
const LOCKOUT_DURATION_MINUTES = 5;
const DEFAULT_COURSES = [
    { id: generateId('course'), name: 'BS Information Technology', description: 'College Program', isActive: true },
    { id: generateId('course'), name: 'BS Hospitality Management', description: 'College Program', isActive: true },
    { id: generateId('course'), name: 'STEM', description: 'Senior High Strand', isActive: true },
    { id: generateId('course'), name: 'ICT', description: 'Senior High Strand', isActive: true },
    { id: generateId('course'), name: 'HUMSS', description: 'Senior High Strand', isActive: true },
    { id: generateId('course'), name: 'ABM', description: 'Senior High Strand', isActive: true },
    { id: generateId('course'), name: 'TVL', description: 'Senior High Strand', isActive: true },
    { id: generateId('course'), name: 'GAS', description: 'Senior High Strand', isActive: true }
];

// ==========================================================================
// - 2.) Global Variables -
// ==========================================================================
let currentForgotPasswordUser = null;
let currentForgotPasswordType = null;
let activeLockoutTimers = {};
let thankYouModalTimeoutId = null;
let currentAlertKeyDownHandler = null;
let currentSuccessKeyDownHandler = null;
let sessionTimeoutIntervalId = null;

// ==========================================================================
// - 3.) Core Utilities -
// ==========================================================================

function generateId(prefix = 'id') {
    const randomPart = Math.random().toString(36).substring(2, 8);
    return prefix + '_' + randomPart;
}
function generateAlumniId() {
    let newId = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!isUnique && attempts < maxAttempts) {
        attempts++;
        const randomNum = Math.floor(Math.random() * 900000) + 100000;
        newId = randomNum.toString();
        
        isUnique = true;

        const activeAlumni = getData(ALUMNI_KEY) || [];
        for (let i = 0; i < activeAlumni.length; i++) {
            if (activeAlumni[i].alumniId === newId) {
                isUnique = false;
                break;
            }
        }

        if (isUnique) {
            const recycleBin = getData(RECYCLE_BIN_KEY);
            const deletedAlumni = recycleBin.deletedAlumni || [];
            for (let i = 0; i < deletedAlumni.length; i++) {
                if (deletedAlumni[i].alumniId === newId) {
                    isUnique = false;
                    break;
                }
            }
        }
    }

    if (!isUnique) {
        return generateId('alum_fallback');
    }

    return newId;
}
function getData(key) {
    const data = localStorage.getItem(key);
    let parsed;

    if (data === "") {
        parsed = null;
    } else {
        parsed = JSON.parse(data);
    }

    if (key === STUDENTS_KEY || key === STAFF_KEY || key === FEEDBACKS_KEY || key === ACTION_LOG_KEY || key === ALUMNI_KEY || key === DELETION_QUEUE_KEY) {
        if (Array.isArray(parsed)) {
            return parsed;
        } else {
            return [];
        }
    }

    if (key === CONFIG_KEY) {
        if (parsed !== null &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.topics) &&
            Array.isArray(parsed.categories) &&
            Array.isArray(parsed.roadmaps) &&
            Array.isArray(parsed.courses) &&
            typeof parsed.adminRecoveryPin !== 'undefined') {
            return parsed;
        } else {
            return {
                topics: [],
                categories: [],
                roadmaps: [],
                courses: [],
                adminRecoveryPin: 'DCSApinR3c'
            };
        }
    }

    if (key === RECYCLE_BIN_KEY) {
        if (parsed !== null &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.deletedStudents) &&
            Array.isArray(parsed.deletedStaff) &&
            Array.isArray(parsed.deletedFeedbacks) &&
            Array.isArray(parsed.deletedConfigs) &&
            Array.isArray(parsed.deletedAlumni)) {
            return parsed;
        } else {
            return {
                deletedStudents: [],
                deletedStaff: [],
                deletedFeedbacks: [],
                deletedConfigs: [],
                deletedAlumni: []
            };
        }
    }

    if (key === LOGIN_ATTEMPTS_KEY || key === FEEDBACK_COOLDOWN_KEY || key === SESSIONS_KEY || key === PINNED_FEEDBACKS_KEY) {
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        } else {
            return {}; 
        }
    }

    return parsed || null;
}
function setData(key, data) {
    const jsonDataString = JSON.stringify(data);
    localStorage.setItem(key, jsonDataString);
}
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function formatTimestampForDisplay(timestampString) {
    if (!timestampString || typeof timestampString !== 'string' || timestampString.length < 19) {
        
        return timestampString || 'N/A';
    }
    const date = new Date(timestampString);

    if (isNaN(date.getTime())) {
        return timestampString; 
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    
    const monthIndex = date.getMonth(); 
    const day = date.getDate();         
    const year = date.getFullYear();    

    let hours = date.getHours();       
    let minutes = date.getMinutes();     

    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; 

    const minutesPadded = minutes < 10 ? '0' + minutes : minutes.toString();
    const hoursPadded = hours < 10 ? '0' + hours : hours.toString();
    const formattedDate = monthNames[monthIndex] + ' ' + day + ', ' + year + ' ' + hoursPadded + ':' + minutesPadded + ampm;

    return formattedDate;
}
function simpleCipher(text, shift = 5) {
    let result = "";
    if (text == null) return result;

    for (let i = 0; i < text.length; i++) {
        let charCode = text.charCodeAt(i);
        if (charCode >= 32 && charCode <= 126) {
            let shiftedCode = charCode + shift;

            if (shiftedCode > 126) {
                shiftedCode = 32 + (shiftedCode - 127);
            }
            
            else if (shiftedCode < 32 && shift < 0) {
                shiftedCode = 127 - (32 - shiftedCode);
            }

            result += String.fromCharCode(shiftedCode);
        } else {
            result += text[i];
        }
    }

    return result;
}
function validatePassword(password) {
    if (password.length < 8) return false;
    let hasUpper = false;
    let hasLower = false;
    let hasSpecial = false;
    const specialChars = /[!@#$%^&*(),.?":{}|<>]/;

    for (let i = 0; i < password.length; i++) {
        const char = password[i];
        if (char >= 'A' && char <= 'Z') hasUpper = true;
        else if (char >= 'a' && char <= 'z') hasLower = true;
        else if (specialChars.test(char)) hasSpecial = true;
    }

    return hasUpper && hasLower && hasSpecial;
}
function forceNumericInput(event) {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
}
function searchStudents() {
    const statusFilterDropdown = document.getElementById('studentStatusFilter');
    const courseFilterDropdown = document.getElementById('studentCourseFilter');
    const searchInput = document.getElementById('studentSearchInput');
    const statusFilter = statusFilterDropdown ? statusFilterDropdown.value : 'all';
    const courseFilter = courseFilterDropdown ? courseFilterDropdown.value : 'all';
    const searchTerm = searchInput ? searchInput.value.trim() : '';

    displayManageStudents(statusFilter, courseFilter, searchTerm);
}
function triggerLogSearch() {
    const searchTerm = document.getElementById('logSearchInput')?.value || '';
    displayActionLog(searchTerm);
}
function populateDropdown(selectId, dataArray, valueField, textField, defaultOptionText) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        return;
    }

    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = "all";
    defaultOption.textContent = defaultOptionText || "Select an option";

    const isFilter = defaultOptionText.toLowerCase().includes("all");

    if (isFilter) {
        defaultOption.disabled = false;
        defaultOption.selected = true;
    } else {
        defaultOption.value = "";
        defaultOption.disabled = true;
        defaultOption.selected = true;
    }
    selectElement.appendChild(defaultOption);

    if (Array.isArray(dataArray)) {
        dataArray.forEach(item => {
            if (item.isActive !== false) {
                const option = document.createElement('option');
                option.value = item[valueField];
                option.textContent = item[textField];
                option.disabled = false;
                selectElement.appendChild(option);
            }
        });
    }
}
function insertQuickText(textareaId, textToInsert) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        return;
    }

    const currentText = textarea.value;

    if (currentText.startsWith(textToInsert)) {
        textarea.focus(); 
        return;
    }

    textarea.value = textToInsert;
    textarea.focus();
}
function updateSidebarIconsForTheme() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const icons = document.querySelectorAll('.sidebar__nav-icon');

    icons.forEach(icon => {
        let currentSrc = icon.getAttribute('src');
        if (!currentSrc) return;

        if (currentSrc.endsWith('-red.png')) {
            return;
        }

        let newSrc = currentSrc;

        if (isDarkMode) {
            if (currentSrc.includes('-black.png')) {
                newSrc = currentSrc.replace('-black.png', '.png');
            }
        } else {
            if (!currentSrc.includes('-black.png')) {
                const lastDotIndex = currentSrc.lastIndexOf('.png');
                if (lastDotIndex !== -1) { // Ensure it's a .png file
                    const namePart = currentSrc.substring(0, lastDotIndex);
                    newSrc = namePart + '-black.png';
                }
            }
        }

        if (newSrc !== currentSrc) {
            icon.setAttribute('src', newSrc);
        }
    });
}

// ==========================================================================
// - 4.) Modal Functions -
// ==========================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
}
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');

        const promptInput = modal.querySelector('#modalPromptInput');
        if (promptInput) {
            promptInput.value = '';
            promptInput.style.display = '';
        }
        const actionsContainer = modal.querySelector('#modalActions');
        if (actionsContainer) actionsContainer.innerHTML = '';
        const promptArea = modal.querySelector('#modalPromptInputArea');
        if (promptArea) {
            const dynamicContent = promptArea.querySelector('#dynamicPromptContent');
            if (dynamicContent) dynamicContent.remove();
            const originalLabel = modal.querySelector('#modalPromptLabel');
            if (originalLabel) originalLabel.style.display = '';
            promptArea.style.display = 'none';
        }

        if (currentAlertKeyDownHandler) {
            document.removeEventListener('keydown', currentAlertKeyDownHandler);
            currentAlertKeyDownHandler = null;
        }
        if (currentSuccessKeyDownHandler) {
            document.removeEventListener('keydown', currentSuccessKeyDownHandler);
            currentSuccessKeyDownHandler = null;
        }
        
        if (modalId === 'thankYouModal') {
            const progressBar = document.getElementById('thankYouModalProgressBar');
            if (progressBar) {
                progressBar.classList.remove('animate');
                progressBar.style.width = '0%';
            }
            if (thankYouModalTimeoutId) {
                clearTimeout(thankYouModalTimeoutId);
                thankYouModalTimeoutId = null;
            }
        }
    }
}
function showAlert(message, title = 'Information') {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalActions = document.getElementById('modalActions');
    const modalPromptArea = document.getElementById('modalPromptInputArea');

    if (modalTitle && modalMessage && modalActions && modalPromptArea) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        if (modalPromptArea) modalPromptArea.style.display = 'none';

        if (modalActions) modalActions.innerHTML = '';
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'btn btn-primary';

        const handleOkAndCleanup = () => {
            closeModal('genericModal');
        };
        okButton.onclick = handleOkAndCleanup;

        if (modalActions) modalActions.appendChild(okButton);
        if (currentAlertKeyDownHandler) {
            document.removeEventListener('keydown', currentAlertKeyDownHandler);
        }
        currentAlertKeyDownHandler = function(event) {
            if (event.key === 'Enter' && document.getElementById('genericModal').style.display === 'block') {
                event.preventDefault();
                okButton.click();
            }
        };
        document.addEventListener('keydown', currentAlertKeyDownHandler);

        openModal('genericModal');
        okButton.focus();
    } else {
        alert(message);
    }
}
function openTermsModal(event) {
    event.preventDefault();
    openModal('termsModal');
}
function showSuccess(message, title = 'Success', onOk) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalActions = document.getElementById('modalActions');
    const modalPromptArea = document.getElementById('modalPromptInputArea');

    if (modalTitle && modalMessage && modalActions && modalPromptArea) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        if (modalPromptArea) modalPromptArea.style.display = 'none';

        if (modalActions) modalActions.innerHTML = '';
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'btn btn-success';

        const handleOkAndCleanup = () => {
            closeModal('genericModal');
            if (typeof onOk === 'function') {
                onOk();
            }
        };
        okButton.onclick = handleOkAndCleanup;

        if (modalActions) modalActions.appendChild(okButton);

        if (currentSuccessKeyDownHandler) {
            document.removeEventListener('keydown', currentSuccessKeyDownHandler);
        }
        currentSuccessKeyDownHandler = function(event) {
            if (event.key === 'Enter' && document.getElementById('genericModal').style.display === 'block') {
                event.preventDefault();
                okButton.click();
            }
        };
        document.addEventListener('keydown', currentSuccessKeyDownHandler);

        openModal('genericModal');
        okButton.focus();
    } else {
        alert(message);
        if (typeof onOk === 'function') {
            onOk();
        }
    }
}
function showConfirm(message, title = 'Confirmation', onConfirm, onCancel) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalActions = document.getElementById('modalActions');
    const modalPromptArea = document.getElementById('modalPromptInputArea');

     if (modalTitle && modalMessage && modalActions && modalPromptArea) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalPromptArea.style.display = 'none';

        modalActions.innerHTML = '';

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.className = 'btn btn-primary';
        confirmButton.onclick = function() {
            closeModal('genericModal');
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.onclick = function() {
            closeModal('genericModal');
            if (typeof onCancel === 'function') {
                onCancel();
            }
        };

        modalActions.appendChild(cancelButton);
        modalActions.appendChild(confirmButton);

        openModal('genericModal');
    } else {
        if (confirm(message)) {
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
    }
}
function showPrompt(message, labelText = 'Reason:', title = 'Input Required', onConfirm, onCancel) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalActions = document.getElementById('modalActions');
    const modalPromptArea = document.getElementById('modalPromptInputArea');
    const modalPromptLabel = document.getElementById('modalPromptLabel');
    const modalPromptInput = document.getElementById('modalPromptInput');

    if (modalPromptArea) {
        const dynamicContent = modalPromptArea.querySelector('#dynamicPromptContent');
        if (dynamicContent) {
            dynamicContent.remove();
        }
        if (modalPromptInput) modalPromptInput.style.display = 'block';
        if (modalPromptLabel) modalPromptLabel.style.display = 'block';
    }

    let promptErrorElement = modalPromptArea.querySelector('.prompt-input-error');
    if (!promptErrorElement && modalPromptInput && modalPromptInput.parentNode) {
        promptErrorElement = document.createElement('small');
        promptErrorElement.className = 'prompt-input-error error-message';
        promptErrorElement.style.display = 'none';
        promptErrorElement.style.marginTop = '5px';
        modalPromptInput.parentNode.insertBefore(promptErrorElement, modalPromptInput.nextSibling);
    }

    if (modalTitle && modalMessage && modalActions && modalPromptArea && modalPromptLabel && modalPromptInput) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalPromptLabel.textContent = labelText;
        modalPromptInput.value = ''; 
        modalPromptInput.style.borderColor = '';
        if (promptErrorElement) {
            promptErrorElement.style.display = 'none';
            promptErrorElement.textContent = '';
        }
        modalPromptArea.style.display = 'block';

        modalActions.innerHTML = ''; 

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Submit';
        confirmButton.className = 'btn btn-primary';
        confirmButton.onclick = function() {
            const inputValue = modalPromptInput.value;
            if (!inputValue.trim()) {
                modalPromptInput.style.borderColor = 'var(--error-color)';
                if (promptErrorElement) {
                    promptErrorElement.textContent = 'This field is required.';
                    promptErrorElement.style.display = 'block';
                }
                modalPromptInput.focus();
                return; 
            }
            modalPromptInput.style.borderColor = '';
            if (promptErrorElement) promptErrorElement.style.display = 'none';
            
            closeModal('genericModal');
            if (typeof onConfirm === 'function') {
                onConfirm(inputValue.trim());
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.onclick = function() {
            closeModal('genericModal');
            if (typeof onCancel === 'function') {
                onCancel();
            }
        };

        modalActions.appendChild(cancelButton);
        modalActions.appendChild(confirmButton);

        openModal('genericModal');
        modalPromptInput.focus(); 
    } else {
        const reason = prompt(message); 
        if (reason !== null) { 
            if (typeof onConfirm === 'function') onConfirm(reason);
        } else { 
             if (typeof onCancel === 'function') onCancel();
        }
    }
}
function showThankYouModal() {
    const modal = document.getElementById('thankYouModal');
    const progressBar = document.getElementById('thankYouModalProgressBar');

    if (modal && progressBar) {
        // Reset progress bar
        progressBar.classList.remove('animate');
        progressBar.style.width = '0%';

        openModal('thankYouModal');

        void progressBar.offsetWidth;
        progressBar.classList.add('animate');

        if (thankYouModalTimeoutId) {
            clearTimeout(thankYouModalTimeoutId);
        }

        thankYouModalTimeoutId = setTimeout(() => {
            closeThankYouModal(true);
        }, 5000);
    } else {
        alert("Your feedback has been submitted successfully.");
    }
}

function closeThankYouModal(isAutoClose = false) {
    const modal = document.getElementById('thankYouModal');
    const progressBar = document.getElementById('thankYouModalProgressBar');

    if (thankYouModalTimeoutId) {
        clearTimeout(thankYouModalTimeoutId);
        thankYouModalTimeoutId = null;
    }

    if (progressBar) {
        progressBar.classList.remove('animate');
        progressBar.style.width = '0%';
    }

    closeModal('thankYouModal');

    if (isAutoClose) {
        if (document.body.classList.contains('body--student-page')) {
            window.location.href = 'student-dashboard.html';
        } else if (document.body.classList.contains('body--alumni-page')) {
            window.location.href = 'alumni/alumni-dashboard.html'; // Adjusted path for alumni
        }
    }
}

// ==========================================================================
// - 5.) Session & Authentication Check -
// ==========================================================================

function loginUser(userType, userData) {
    const sessions = getData(SESSIONS_KEY);

    if (!sessions || typeof sessions !== 'object') {
        console.error("Session data object is missing or invalid! Reinitializing.");
        sessions = { student: null, admin: null, alumni: null };
    }
    if (typeof sessions.student === 'undefined') sessions.student = null;
    if (typeof sessions.admin === 'undefined') sessions.admin = null;
    if (typeof sessions.alumni === 'undefined') sessions.alumni = null;

    const now = Date.now();

    if (userType === 'student') {
        sessions.student = {
            studentId: userData.studentId,
            fullName: userData.fullName,
            loggedInAt: now,
            lastActivity: now
        };
    } else if (userType === 'admin') {
        sessions.admin = {
            username: userData.username,
            role: userData.role,
            loggedInAt: now,
            lastActivity: now
        };
    } else if (userType === 'alumni') {
        sessions.alumni = {
            alumniId: userData.alumniId,
            email: userData.email,
            fullName: userData.fullName,
            loggedInAt: now,
            lastActivity: now
        };
    } else {
        console.error("loginUser called with unknown userType:", userType);
        return;
    }

    setData(SESSIONS_KEY, sessions);
}
function logoutUser(userType) {
    if (sessionTimeoutIntervalId) {
        clearInterval(sessionTimeoutIntervalId);
        sessionTimeoutIntervalId = null;
    } 

    const sessions = getData(SESSIONS_KEY);
    let usernameToLog = ''; 

    if (userType === 'student' && sessions && sessions.student) {
        usernameToLog = sessions.student.studentId;
        sessions.student = null; 
        setData(SESSIONS_KEY, sessions); 
        window.location.href = '../login.html'; 
    } else if (userType === 'admin' && sessions && sessions.admin) {
        usernameToLog = sessions.admin.username;
        const isAdmin = sessions.admin.role === 'Admin';
        const logMessage = `User '${usernameToLog}' logged out.`;
        sessions.admin = null;
        setData(SESSIONS_KEY, sessions);
        logAction(usernameToLog, isAdmin ? 'Admin Logout' : 'Moderator Logout', logMessage);
        window.location.href = '../admin-login.html';
    } else if (userType === 'alumni' && sessions && sessions.alumni) {
        usernameToLog = sessions.alumni.email;
        sessions.alumni = null; 
        setData(SESSIONS_KEY, sessions); 
        window.location.href = '../alumni-login.html';
    }
}
function recordUserActivity() {
    const sessions = getData(SESSIONS_KEY);
    if (!sessions) return;

    const now = Date.now();
    let sessionChanged = false;

    if (sessions.student && isStudentLoggedIn()) {
        sessions.student.lastActivity = now;
        sessionChanged = true;
    }
    if (sessions.admin && isAdminLoggedIn()) {
        sessions.admin.lastActivity = now;
        sessionChanged = true;
    }
    if (sessions.alumni && isAlumniLoggedIn()) {
        sessions.alumni.lastActivity = now;
        sessionChanged = true;
    }

    if (sessionChanged) {
        setData(SESSIONS_KEY, sessions);
    }
}
function checkSessionTimeout() {
    const sessions = getData(SESSIONS_KEY);
    if (!sessions) return false;

    const now = Date.now();
    let timeoutOccurred = false;

    if (sessions.student && sessions.student.lastActivity) {
        const timeDifference = now - sessions.student.lastActivity;
        const studentTimeoutMs = STUDENT_TIMEOUT_LIMIT_MINUTES * 60 * 1000;
        if (timeDifference > studentTimeoutMs) {
            showAlert('Your student session has timed out due to inactivity. Please log in again.', 'Session Timeout');
            logoutUser('student');
            timeoutOccurred = true;
        }
    }

    if (sessions.admin && sessions.admin.lastActivity) {
        const timeDifference = now - sessions.admin.lastActivity;
        const adminTimeoutMs = ADMIN_TIMEOUT_LIMIT_MINUTES * 60 * 1000;
        if (timeDifference > adminTimeoutMs) {
            showAlert('Your staff session has timed out due to inactivity. Please log in again.', 'Session Timeout');
            logoutUser('admin');
            timeoutOccurred = true;
        }
    }

    if (sessions.alumni && sessions.alumni.lastActivity) {
        const timeDifference = now - sessions.alumni.lastActivity;
        const alumniTimeoutMs = ALUMNI_TIMEOUT_LIMIT_MINUTES * 60 * 1000;
        if (timeDifference > alumniTimeoutMs) {
            showAlert('Your alumni session has timed out due to inactivity. Please log in again.', 'Session Timeout');
            logoutUser('alumni');
            timeoutOccurred = true;
        }
    }

    if (timeoutOccurred) {
        return true;
    }

    return false;
}
function isStudentLoggedIn() {
    const sessions = getData(SESSIONS_KEY);
    return sessions && sessions.student !== null;
}
function isAlumniLoggedIn() {
    const sessions = getData(SESSIONS_KEY);
    return sessions && sessions.alumni !== null;
}
function isAdminLoggedIn() {
    const sessions = getData(SESSIONS_KEY);
    return sessions && sessions.admin !== null;
}
function getCurrentStudentSession() {
    const sessions = getData(SESSIONS_KEY);
    return sessions ? sessions.student : null;
}
function getCurrentAlumniSession() {
    const sessions = getData(SESSIONS_KEY);
    return sessions ? sessions.alumni : null;
}
function getCurrentAdminSession() {
    const sessions = getData(SESSIONS_KEY);
    return sessions ? sessions.admin : null;
}
function redirectToLogin(userType) {
    if (userType === 'student' && !isStudentLoggedIn()) {
        window.location.href = '../login.html';
    } else if (userType === 'admin' && !isAdminLoggedIn()) {
        window.location.href = '../admin-login.html';
    } else if (userType === 'alumni' && !isAlumniLoggedIn()) {
        window.location.href = '../alumni-login.html';
    }
}
function togglePasswordVisibility(inputId, buttonElement) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput || !buttonElement) return;

    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    buttonElement.textContent = type === 'password' ? 'Show' : 'Hide';
}
function recordLoginAttempt(formIdentifier, isSuccess) {
    let attempts = getData(LOGIN_ATTEMPTS_KEY);
    const now = Date.now();

    if (!attempts[formIdentifier]) {
        attempts[formIdentifier] = { count: 0, lockoutUntil: 0 };
    }

    const formAttempts = attempts[formIdentifier];
    
    if (formAttempts.lockoutUntil > now) {
        return { 
            lockedOut: true, 
            lockoutTime: formAttempts.lockoutUntil 
        };
    }

    if (isSuccess) {
        formAttempts.count = 0;
        formAttempts.lockoutUntil = 0;
    } else {
        formAttempts.count += 1;

        if (formAttempts.count >= LOGIN_ATTEMPT_LIMIT) {
            formAttempts.lockoutUntil = now + (LOCKOUT_DURATION_MINUTES * 60 * 1000);
            formAttempts.count = 0;
            setData(LOGIN_ATTEMPTS_KEY, attempts);
            return { lockedOut: true, lockoutTime: formAttempts.lockoutUntil };
        }
    }

    setData(LOGIN_ATTEMPTS_KEY, attempts);

    return { lockedOut: false, remainingAttempts: LOGIN_ATTEMPT_LIMIT - formAttempts.count };
}
function checkLockoutStatus(formIdentifier) {
    const attempts = getData(LOGIN_ATTEMPTS_KEY);
    const now = Date.now();

    if (attempts[formIdentifier] && attempts[formIdentifier].lockoutUntil > now) {
        return { lockedOut: true, lockoutTime: attempts[formIdentifier].lockoutUntil };
    }

    return { lockedOut: false };
}
function cleanupExpiredLockouts() {
    let attempts = getData(LOGIN_ATTEMPTS_KEY);
    const now = Date.now();
    let changed = false;

    for (const identifier in attempts) {
        if (attempts[identifier].lockoutUntil <= now) {
            delete attempts[identifier];
            changed = true;
        }
    }

    if (changed) {
        setData(LOGIN_ATTEMPTS_KEY, attempts);
    }
}
function displayLockoutMessage(elementId, lockoutTime, buttonId, formIdentifier) {
    const messageElement = document.getElementById(elementId);
    const loginButton = document.getElementById(buttonId);

    if (!formIdentifier) {
    }

    if (!messageElement || !loginButton) {
        return;
    }
    
    if (formIdentifier && activeLockoutTimers[formIdentifier]) {
        clearInterval(activeLockoutTimers[formIdentifier]);
    }

    function updateTimer() {
        const now = Date.now();
        const remainingMillis = lockoutTime - now;

        if (remainingMillis <= 0) {
            messageElement.style.display = 'none';
            loginButton.disabled = false;
            if (formIdentifier && activeLockoutTimers[formIdentifier]) {
                clearInterval(activeLockoutTimers[formIdentifier]);
                delete activeLockoutTimers[formIdentifier];
            }
        } else {
            messageElement.style.display = 'block';
            loginButton.disabled = true;

            const remainingSecondsTotal = Math.ceil(remainingMillis / 1000);
            const minutes = Math.floor(remainingSecondsTotal / 60);
            const seconds = remainingSecondsTotal % 60;

            let timeString = "";
            if (minutes > 0) {
                timeString += `${minutes} minute(s) `;
            }
            
            if (minutes === 0 || seconds > 0 || remainingSecondsTotal <= 60) {
                const displaySeconds = seconds.toString().padStart(2, '0'); 
                timeString += `${displaySeconds} second(s)`;
            }
            if(timeString === "") timeString = "less than a second"; 

            messageElement.textContent = `Too many failed login attempts. Please try again in ${timeString}.`;
        }
    }

    updateTimer();
    if (formIdentifier) {
        activeLockoutTimers[formIdentifier] = setInterval(updateTimer, 1000);
    }
}

// ==========================================================================
// - 6.) Login/Logout -
// ==========================================================================

function handleLogin(event) {
    event.preventDefault();
    const identifierInput = document.getElementById('loginIdentifier');
    const passwordInput = document.getElementById('loginPassword');
    const errorElement = document.getElementById('loginError');
    const lockoutMessageEl = document.getElementById('lockoutMessage');
    const formIdentifier = 'student_login'; 

    if (errorElement) errorElement.style.display = 'none';
    if (lockoutMessageEl) lockoutMessageEl.style.display = 'none';

    const lockoutStatus = checkLockoutStatus(formIdentifier);
    if (lockoutStatus.lockedOut) {
        displayLockoutMessage('lockoutMessage', lockoutStatus.lockoutTime, 'loginButton', formIdentifier); 
        return;
    }

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;

    if (!identifier || !password) {
        if(errorElement) {
            errorElement.textContent = "Please enter both Student ID and Password.";
            errorElement.style.display = 'block';
        }
        const attemptResult = recordLoginAttempt(formIdentifier, false);
        if (attemptResult.lockedOut) {
             displayLockoutMessage('lockoutMessage', attemptResult.lockoutTime, 'loginButton', formIdentifier); 
        } else if (errorElement && attemptResult.remainingAttempts > 0) {
             errorElement.textContent += ` (${attemptResult.remainingAttempts} attempts remaining)`;
        } else if (errorElement && attemptResult.remainingAttempts <= 0 && !attemptResult.lockedOut) {
            errorElement.textContent += ` (Last attempt)`;
        }
        if(event.target) event.target.reset();
        return;
    }

    let students = getData(STUDENTS_KEY);
    let student = null;
    for(let i=0; i<students.length; i++){
        if(students[i].studentId.toLowerCase() === identifier.toLowerCase()){
            student = students[i];
            break;
        }
    }

    let loginFailed = false;
    let failureReason = "Invalid Student ID or Password.";

    if (student && student.status === 'pending_deletion') { 
        const scheduledDate = student.scheduledDeletionTimestamp || 'an unknown date';
        const formattedDate = formatTimestampForDisplay(scheduledDate);
        showConfirm(
            `Your account (${student.studentId}) is scheduled for permanent deletion around ${formattedDate}. Logging in now will cancel this request.\n\nDo you want to cancel deletion and log in?`,
            "Cancel Account Deletion?",
            () => {
                cancelAccountDeletion(student.studentId, 'student');
                const enteredPassword = passwordInput.value;
                if (student.password !== simpleCipher(enteredPassword)) {
                    errorElement.textContent = "Deletion cancelled, but the password entered was incorrect.";
                    errorElement.style.display = 'block';
                    if (event.target) event.target.reset();
                } else {
                    recordLoginAttempt(formIdentifier, true);
                    loginUser('student', student);
                    showSuccess(`Account deletion cancelled. Welcome back, ${student.fullName}!`, "Login Successful", () => {
                        window.location.href = 'student/student-dashboard.html';
                    });
                }
            },
            () => {
                if(event.target) event.target.reset();
            }
        );
        return;
    }

    if (!student) {
        loginFailed = true;
    } else if (student.password !== simpleCipher(password)) {
        loginFailed = true;
    } else if (student.status === 'pending') {
        loginFailed = true;
        failureReason = "Your account registration is still pending approval.";
        if(errorElement) {
            errorElement.textContent = failureReason;
            errorElement.style.display = 'block';
        }
        if(event.target) event.target.reset();
        return; 
    } else if (student.status !== 'approved') {
        loginFailed = true;
        failureReason = "Your account is not currently active. Please contact support.";
        if(errorElement) {
            errorElement.textContent = failureReason;
            errorElement.style.display = 'block';
        }
        if(event.target) event.target.reset();
        return; 
    }

    if (loginFailed) {
        const attemptResult = recordLoginAttempt(formIdentifier, false);
        if (attemptResult.lockedOut) {
            displayLockoutMessage('lockoutMessage', attemptResult.lockoutTime, 'loginButton', formIdentifier); 
        } else {
            if (errorElement) {
                errorElement.textContent = `${failureReason} ${attemptResult.remainingAttempts} attempts remaining.`;
                errorElement.style.display = 'block';
            }
        }
        if(event.target) event.target.reset();
        return;
    }

    recordLoginAttempt(formIdentifier, true);
    loginUser('student', student);
    showSuccess(`Welcome back, ${student.fullName}!`, "Login Successful", () => {
        window.location.href = 'student/student-dashboard.html';
    });
}
function handleAdminLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('adminLoginUsername');
    const passwordInput = document.getElementById('adminLoginPassword');
    const errorElement = document.getElementById('adminLoginError');
    const lockoutMessageEl = document.getElementById('adminLockoutMessage');
    const loginButton = document.getElementById('adminLoginButton');
    const formIdentifier = 'admin_login'; 

    if (errorElement) errorElement.style.display = 'none';
    if (lockoutMessageEl) lockoutMessageEl.style.display = 'none';

    const lockoutStatus = checkLockoutStatus(formIdentifier);
    if (lockoutStatus.lockedOut) {
        displayLockoutMessage('adminLockoutMessage', lockoutStatus.lockoutTime, 'adminLoginButton', formIdentifier); 
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        if(errorElement) {
            errorElement.textContent = "Please enter both Username and Password.";
            errorElement.style.display = 'block';
        }
        const attemptResult = recordLoginAttempt(formIdentifier, false);
        if (attemptResult.lockedOut) {
            displayLockoutMessage('adminLockoutMessage', attemptResult.lockoutTime, 'adminLoginButton', formIdentifier); 
        } else if (errorElement && attemptResult.remainingAttempts > 0) {
            errorElement.textContent += ` (${attemptResult.remainingAttempts} attempts remaining)`;
        } else if (errorElement && attemptResult.remainingAttempts <= 0 && !attemptResult.lockedOut){
            errorElement.textContent += ` (Last attempt)`;
        }
        if(event.target) event.target.reset();
        return;
    }

    let staff = getData(STAFF_KEY);
    let staffMember = null;
    for(let i=0; i<staff.length; i++){
        if (staff[i].username.toLowerCase() === username.toLowerCase() && (!staff[i].isHidden || username === 'dev_maint')) {
            staffMember = staff[i];
            break;
        }
    }

    let loginFailed = false;
    let failureReason = "Invalid Username or Password.";

    if (!staffMember) {
        loginFailed = true;
    } else if (staffMember.password !== simpleCipher(password)) {
        loginFailed = true;
    }

    if (loginFailed) {
        const attemptResult = recordLoginAttempt(formIdentifier, false);
        if (attemptResult.lockedOut) {
            displayLockoutMessage('adminLockoutMessage', attemptResult.lockoutTime, 'adminLoginButton', formIdentifier); 
        } else {
            if (errorElement) {
                errorElement.textContent = `${failureReason} ${attemptResult.remainingAttempts} attempts remaining.`;
                errorElement.style.display = 'block';
            }
        }
         if(event.target) event.target.reset();
        return;
    }

    recordLoginAttempt(formIdentifier, true);

    if (staffMember.username === 'admin') {
        if (localStorage.getItem('feedbackSystem_initialAdminLoginComplete') !== 'true') {
            localStorage.setItem('feedbackSystem_initialAdminLoginComplete', 'true');
        }
    }

    loginUser('admin', staffMember);
    logAction(staffMember.username, staffMember.role === 'Admin' ? 'Admin Login' : 'Moderator Login', `User '${staffMember.username}' logged in.`);
    processDeletionQueue();

    showSuccess(`Welcome back, ${staffMember.username}!`, "Login Successful", () => {
        if (staffMember.username === 'dev_maint') {
            window.location.href = 'admin/dev-maintenance.html';
        } else {
            window.location.href = 'admin/admin-dashboard.html';
        }
    });
}
function handleAlumniLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('alumniLoginEmail');
    const passwordInput = document.getElementById('alumniLoginPassword');
    const errorElement = document.getElementById('alumniLoginError');
    const lockoutMessageEl = document.getElementById('alumniLockoutMessage');
    const loginButton = document.getElementById('alumniLoginButton');
    const formIdentifier = 'alumni_login'; 

    if (errorElement) errorElement.style.display = 'none';
    if (lockoutMessageEl) lockoutMessageEl.style.display = 'none';

    const lockoutStatus = checkLockoutStatus(formIdentifier);
    if (lockoutStatus.lockedOut) {
        displayLockoutMessage('alumniLockoutMessage', lockoutStatus.lockoutTime, 'alumniLoginButton', formIdentifier); 
        return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        if(errorElement) {
            errorElement.textContent = "Please enter both Email and Password.";
            errorElement.style.display = 'block';
        }
        const attemptResult = recordLoginAttempt(formIdentifier, false);
         if (attemptResult.lockedOut) {
             displayLockoutMessage('alumniLockoutMessage', attemptResult.lockoutTime, 'alumniLoginButton', formIdentifier); 
        } else if (errorElement && attemptResult.remainingAttempts > 0) {
             errorElement.textContent += ` (${attemptResult.remainingAttempts} attempts remaining)`;
        } else if (errorElement && attemptResult.remainingAttempts <= 0 && !attemptResult.lockedOut) {
             errorElement.textContent += ` (Last attempt)`;
        }
        if(event.target) event.target.reset();
        return;
    }

    let alumni = getData(ALUMNI_KEY);
    let foundAlumnus = null;
    for (let i = 0; i < alumni.length; i++) {
        if (alumni[i].email.toLowerCase() === email) {
            foundAlumnus = alumni[i];
            break;
        }
    }

    let loginFailed = false;
    let failureReason = "Invalid Email or Password.";

    if (foundAlumnus && foundAlumnus.status === 'pending_deletion') { 
        const scheduledDate = foundAlumnus.scheduledDeletionTimestamp || 'an unknown date';
        const formattedDate = formatTimestampForDisplay(scheduledDate);
        showConfirm(
            `Your account (${foundAlumnus.email}) is scheduled for permanent deletion around ${formattedDate}. Logging in now will cancel this request.\n\nDo you want to cancel deletion and log in?`,
            "Cancel Account Deletion?",
            () => {
                cancelAccountDeletion(foundAlumnus.alumniId, 'alumni');
                const enteredPassword = passwordInput.value;
                if (foundAlumnus.password !== simpleCipher(enteredPassword)) {
                    errorElement.textContent = "Deletion cancelled, but the password entered was incorrect.";
                    errorElement.style.display = 'block';
                     if (event.target) event.target.reset();
                } else {
                    recordLoginAttempt(formIdentifier, true);
                    loginUser('alumni', foundAlumnus);
                    showSuccess(`Account deletion cancelled. Welcome back, ${foundAlumnus.fullName}!`, "Login Successful", () => {
                        window.location.href = 'alumni/alumni-dashboard.html';
                    });
                }
            },
            () => {
                 if(event.target) event.target.reset();
            }
        );
        return;
    }

    if (!foundAlumnus) {
        loginFailed = true;
    } else if (foundAlumnus.password !== simpleCipher(password)) {
        loginFailed = true;
    } else if (foundAlumnus.status === 'pending') {
        loginFailed = true;
        failureReason = "Your account registration is still pending approval.";
         if(errorElement) {
             errorElement.textContent = failureReason;
             errorElement.style.display = 'block';
         }
         if(event.target) event.target.reset();
         return; 
    } else if (foundAlumnus.status !== 'approved') {
        loginFailed = true;
        failureReason = "Your account is not currently active. Please contact support.";
         if(errorElement) {
             errorElement.textContent = failureReason;
             errorElement.style.display = 'block';
         }
          if(event.target) event.target.reset();
         return; 
    }

    if (loginFailed) {
        const attemptResult = recordLoginAttempt(formIdentifier, false);
        if (attemptResult.lockedOut) {
            displayLockoutMessage('alumniLockoutMessage', attemptResult.lockoutTime, 'alumniLoginButton', formIdentifier); 
        } else {
            if (errorElement) {
                errorElement.textContent = `${failureReason} ${attemptResult.remainingAttempts} attempts remaining.`;
                errorElement.style.display = 'block';
            }
        }
        if(event.target) event.target.reset();
        return;
    }

    recordLoginAttempt(formIdentifier, true);
    loginUser('alumni', foundAlumnus);
    showSuccess(`Welcome back, ${foundAlumnus.fullName}!`, "Login Successful", () => {
        window.location.href = 'alumni/alumni-dashboard.html';
    });
}
function promptLogout(userType) {
    const message = "Are you sure you want to logout?";
    const title = "Confirm Logout";
    
    showConfirm(message, title,
        () => {logoutUser(userType);},
        () => {}
    );
}

// ==========================================================================
// - 7.) Forgot Password Flow -
// ==========================================================================

function loadForgotPasswordPage() {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const identifierInput = document.getElementById('forgotIdentifier');
    const identifierLabel = document.getElementById('forgotIdentifierLabel');
    const loginLink = document.getElementById('loginLink');

    if (!forgotPasswordForm || !identifierInput || !identifierLabel || !loginLink) {
        const errorElement = document.getElementById('forgotPasswordError');
        if(errorElement){
            errorElement.textContent = "Page loading error. Required elements missing.";
            errorElement.style.display = 'block';
        }
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlType = urlParams.get('type');

    if (urlType === 'staff') {
        currentForgotPasswordType = 'staff';
    } else if (urlType === 'alumni') {
        currentForgotPasswordType = 'alumni';
    } else {
        currentForgotPasswordType = 'student';
    }

    if (currentForgotPasswordType === 'staff') {
        identifierLabel.textContent = 'Username:';
        identifierInput.type = 'text';
        identifierInput.placeholder = 'Enter your staff username';
        loginLink.href = 'admin-login.html';
        loginLink.textContent = 'Staff Login here';
        identifierInput.removeEventListener('input', forceNumericInput);
    } else if (currentForgotPasswordType === 'alumni') {
        identifierLabel.textContent = 'Email Address:';
        identifierInput.type = 'email';
        identifierInput.placeholder = 'Enter your registered email';
        loginLink.href = 'alumni-login.html';
        loginLink.textContent = 'Alumni Login here';
        identifierInput.removeEventListener('input', forceNumericInput);
    } else {
        identifierLabel.textContent = 'Student ID:';
        identifierInput.type = 'text';
        identifierInput.placeholder = 'Enter your Student ID';
        loginLink.href = 'login.html';
        loginLink.textContent = 'Student Login here';
        identifierInput.removeEventListener('input', forceNumericInput);
        identifierInput.addEventListener('input', forceNumericInput);
    }

    forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit);
    resetForgotPasswordForm();
}
function showForgotPasswordStep(stepToShow) {
    const step1Div = document.getElementById('step1Identify');
    const step2SecurityDiv = document.getElementById('step2Security');
    const step2PinDiv = document.getElementById('step2PinInput');
    const step3ResetDiv = document.getElementById('step3Reset');

    const forgotIdentifierInput = document.getElementById('forgotIdentifier');
    const forgotSecurityAnswerInput = document.getElementById('forgotSecurityAnswer');
    const forgotPinInput = document.getElementById('forgotPin');
    const forgotNewPasswordInput = document.getElementById('forgotNewPassword');
    const forgotConfirmPasswordInput = document.getElementById('forgotConfirmPassword');

    // Hide all steps first
    if (step1Div) step1Div.style.display = 'none';
    if (step2SecurityDiv) step2SecurityDiv.style.display = 'none';
    if (step2PinDiv) step2PinDiv.style.display = 'none';
    if (step3ResetDiv) step3ResetDiv.style.display = 'none';

    // Make all relevant inputs non-required by default
    if (forgotIdentifierInput) forgotIdentifierInput.required = false;
    if (forgotSecurityAnswerInput) forgotSecurityAnswerInput.required = false;
    if (forgotPinInput) forgotPinInput.required = false;
    if (forgotNewPasswordInput) forgotNewPasswordInput.required = false;
    if (forgotConfirmPasswordInput) forgotConfirmPasswordInput.required = false;

    const errorElement = document.getElementById('forgotPasswordError');
    if (errorElement) errorElement.style.display = 'none';


    if (stepToShow === 1) {
        if (step1Div) step1Div.style.display = 'block';
        if (forgotIdentifierInput) {
            forgotIdentifierInput.required = true;
            forgotIdentifierInput.disabled = false;
            forgotIdentifierInput.value = '';
        }
        const findAccountButton = document.getElementById('findAccountButton'); // Ensure this ID exists in HTML
        if (findAccountButton) findAccountButton.style.display = 'block';
        const choiceButtonsDiv = document.getElementById('step1ChoiceButtons');
        if (choiceButtonsDiv) choiceButtonsDiv.style.display = 'none';

    } else if (stepToShow === 2) {
        if (!currentForgotPasswordUser) {
            resetForgotPasswordForm();
            return;
        }
        if (step2SecurityDiv) step2SecurityDiv.style.display = 'block';
        if (forgotSecurityAnswerInput) {
            forgotSecurityAnswerInput.required = true;
            forgotSecurityAnswerInput.value = '';
            forgotSecurityAnswerInput.focus();
        }
        if (forgotIdentifierInput) forgotIdentifierInput.disabled = true;

    } else if (stepToShow === 2.1) {
         if (!currentForgotPasswordUser || currentForgotPasswordUser.role !== 'Admin') {
            resetForgotPasswordForm();
            return;
        }
        if (step2PinDiv) step2PinDiv.style.display = 'block';
        if (forgotPinInput) {
            forgotPinInput.required = true;
            forgotPinInput.value = '';
            forgotPinInput.focus();
        }
        const pinLockoutMsg = document.getElementById('pinLockoutMessage');
        if (pinLockoutMsg) pinLockoutMsg.style.display = 'none';
        if (forgotIdentifierInput) forgotIdentifierInput.disabled = true;

    } else if (stepToShow === 3) {
        if (!currentForgotPasswordUser) {
            resetForgotPasswordForm();
            return;
        }
        if (step3ResetDiv) step3ResetDiv.style.display = 'block';
        if (forgotNewPasswordInput) {
            forgotNewPasswordInput.required = true;
            forgotNewPasswordInput.value = '';
        }
        if (forgotConfirmPasswordInput) {
            forgotConfirmPasswordInput.required = true;
            forgotConfirmPasswordInput.value = '';
        }
        if (forgotNewPasswordInput) forgotNewPasswordInput.focus();
        if (forgotIdentifierInput) forgotIdentifierInput.disabled = true;
    }
}
function resetForgotPasswordForm() {
    showForgotPasswordStep(1);
    const securityQuestionInput = document.getElementById('forgotSecurityQuestion');
    if (securityQuestionInput) securityQuestionInput.value = '';
    currentForgotPasswordUser = null;
}
function handleForgotPasswordStep1() {
    const identifierInput = document.getElementById('forgotIdentifier');
    const errorElement = document.getElementById('forgotPasswordError');
    const identifier = identifierInput.value.trim();
    const findAccountButton = document.getElementById('findAccountButton');
    const choiceButtonsDiv = document.getElementById('step1ChoiceButtons');

    if (errorElement) errorElement.style.display = 'none';

    if (!identifier) {
        let idTypeName = 'Identifier';
        if (currentForgotPasswordType === 'student') idTypeName = 'Student ID';
        else if (currentForgotPasswordType === 'alumni') idTypeName = 'Email Address';
        else if (currentForgotPasswordType === 'staff') idTypeName = 'Username';
        errorElement.textContent = "Please enter your " + idTypeName + ".";
        errorElement.style.display = 'block';
        return;
    }

    let userFound = null;
    if (currentForgotPasswordType === 'staff') {
        const staff = getData(STAFF_KEY);
        for (let i = 0; i < staff.length; i++) {
            if (staff[i].username.toLowerCase() === identifier.toLowerCase() && !staff[i].isHidden) {
                userFound = staff[i];
                break;
            }
        }
    } else if (currentForgotPasswordType === 'alumni') {
        const alumni = getData(ALUMNI_KEY);
        for (let i = 0; i < alumni.length; i++) {
            if (alumni[i].email.toLowerCase() === identifier.toLowerCase() && alumni[i].status === 'approved') {
                userFound = alumni[i];
                break;
            }
        }
    } else {
        const students = getData(STUDENTS_KEY);
        for (let i = 0; i < students.length; i++) {
            if (students[i].studentId === identifier && students[i].status === 'approved') {
                userFound = students[i];
                break;
            }
        }
    }

    if (!userFound) {
        errorElement.textContent = "Account not found or is not active/approved.";
        errorElement.style.display = 'block';
        return;
    }

    currentForgotPasswordUser = userFound;
    if (identifierInput) identifierInput.disabled = true;
    if (findAccountButton) findAccountButton.style.display = 'none';

    if (currentForgotPasswordType === 'staff' && userFound.role === 'Admin') {
        if (choiceButtonsDiv) choiceButtonsDiv.style.display = 'block';
    } else {
        showSecurityQuestionStep();
    }
}
function showSecurityQuestionStep() {
    if (!currentForgotPasswordUser) {
        resetForgotPasswordForm();
        return;
    }
    const securityQuestionDisplay = document.getElementById('forgotSecurityQuestion');
    if (securityQuestionDisplay) {
        const securityQuestionMap = {
            'mother_maiden_name': "What is your mother's maiden name?",
            'first_pet_name': "What was the name of your first pet?",
            'birth_city': "In what city were you born?"
        };
        if (currentForgotPasswordUser.securityQuestion) {
            securityQuestionDisplay.value = securityQuestionMap[currentForgotPasswordUser.securityQuestion] || currentForgotPasswordUser.securityQuestion;
        } else {
            securityQuestionDisplay.value = "Error: Security question not found.";
        }
    }
    showForgotPasswordStep(2);
}
function showPinInputStep() {
    if (!currentForgotPasswordUser || currentForgotPasswordUser.role !== 'Admin') {
        resetForgotPasswordForm();
        return;
    }
    showForgotPasswordStep(2.1);
}
function handleForgotPasswordStep2() {
    const answerInput = document.getElementById('forgotSecurityAnswer');
    const errorElement = document.getElementById('forgotPasswordError');
    if (errorElement) errorElement.style.display = 'none';

    if (!currentForgotPasswordUser) {
        if (errorElement) {
            errorElement.textContent = "An error occurred (user session lost). Please start over.";
            errorElement.style.display = 'block';
        }
        resetForgotPasswordForm();
        return;
    }
    if (typeof currentForgotPasswordUser.securityAnswer !== 'string') {
        if (errorElement) {
            errorElement.textContent = "Security answer not set for this account. Please contact support.";
            errorElement.style.display = 'block';
        }
        return;
    }

    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        if (errorElement) {
            errorElement.textContent = "Please answer the security question.";
            errorElement.style.display = 'block';
        }
        return;
    }

    if (userAnswer.toLowerCase() !== currentForgotPasswordUser.securityAnswer.toLowerCase()) {
        if (errorElement) {
            errorElement.textContent = "Incorrect security answer.";
            errorElement.style.display = 'block';
        }
        return;
    }
    showForgotPasswordStep(3);
}
function handleForgotPasswordPinVerify() {
    const pinInput = document.getElementById('forgotPin');
    const errorElement = document.getElementById('forgotPasswordError');
    const pinLockoutMessage = document.getElementById('pinLockoutMessage');
    const verifyButton = document.getElementById('verifyPinButton');

    if (errorElement) errorElement.style.display = 'none';
    if (pinLockoutMessage) pinLockoutMessage.style.display = 'none';

    if (!currentForgotPasswordUser || currentForgotPasswordUser.role !== 'Admin') {
        if (errorElement) {
            errorElement.textContent = "Verification error (user context). Please start over.";
            errorElement.style.display = 'block';
        }
        resetForgotPasswordForm();
        return;
    }

    const enteredPin = pinInput.value;
    if (!enteredPin || enteredPin.length !== 10) {
        if (errorElement) {
            errorElement.textContent = "Please enter the 10-character PIN.";
            errorElement.style.display = 'block';
        }
        if (pinInput) pinInput.focus();
        return;
    }

    const username = currentForgotPasswordUser.username;
    const pinAttemptIdentifier = username + '_pin_recovery';
    const lockoutStatus = checkLockoutStatus(pinAttemptIdentifier);

    if (lockoutStatus.lockedOut) {
        displayPinLockoutMessage('pinLockoutMessage', lockoutStatus.lockoutTime);
        if (verifyButton) verifyButton.disabled = true;
        return;
    } else {
        if (verifyButton) verifyButton.disabled = false;
    }

    const config = getData(CONFIG_KEY);
    if (!config || typeof config.adminRecoveryPin !== 'string') {
        if (errorElement) {
            errorElement.textContent = "System configuration error (PIN). Please contact support.";
            errorElement.style.display = 'block';
        }
        resetForgotPasswordForm();
        return;
    }
    const correctPin = config.adminRecoveryPin;

    if (enteredPin !== correctPin) {
        const attemptResult = recordLoginAttempt(pinAttemptIdentifier, false);
        if (attemptResult.lockedOut) {
            displayPinLockoutMessage('pinLockoutMessage', attemptResult.lockoutTime);
            if (verifyButton) verifyButton.disabled = true;
        } else {
            if (errorElement) {
                errorElement.textContent = `Incorrect PIN. ${attemptResult.remainingAttempts} attempts remaining.`;
                errorElement.style.display = 'block';
            }
        }
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
        return;
    }

    recordLoginAttempt(pinAttemptIdentifier, true);
    showForgotPasswordStep(3);
}
function displayPinLockoutMessage(elementId, lockoutTime) {
    const messageElement = document.getElementById(elementId);
    const verifyButton = document.getElementById('verifyPinButton');

    if (!messageElement) { console.warn("displayPinLockoutMessage: Lockout message element not found:", elementId); return; }

    let intervalId = activeLockoutTimers[elementId];
    if (intervalId) {
        clearInterval(intervalId);
    }

    function updateTimer() {
        const now = Date.now();
        const remainingMillis = lockoutTime - now;

        if (remainingMillis <= 0) {
            messageElement.style.display = 'none';
            if (verifyButton) verifyButton.disabled = false;
            if (intervalId) {
                clearInterval(intervalId);
                delete activeLockoutTimers[elementId];
            }
        } else {
            messageElement.style.display = 'block';
            if (verifyButton) verifyButton.disabled = true;

            const remainingSecondsTotal = Math.ceil(remainingMillis / 1000);
            const minutes = Math.floor(remainingSecondsTotal / 60);
            const seconds = remainingSecondsTotal % 60;
            let timeString = (minutes > 0 ? `${minutes}m ` : '') + `${seconds.toString().padStart(2, '0')}s`;
            messageElement.textContent = `Too many failed PIN attempts. Please try again in ${timeString}.`;
        }
    }
    updateTimer();
    activeLockoutTimers[elementId] = setInterval(updateTimer, 1000);
}
function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    const newPasswordInput = document.getElementById('forgotNewPassword');
    const confirmPasswordInput = document.getElementById('forgotConfirmPassword');
    const errorElement = document.getElementById('forgotPasswordError');

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if(errorElement) errorElement.style.display = 'none';

    if (!newPassword || !confirmPassword) {
        if(errorElement) {
            errorElement.textContent = "Please enter and confirm your new password.";
            errorElement.style.display = 'block';
        }
        if (!newPassword && newPasswordInput) newPasswordInput.focus();
        else if (confirmPasswordInput) confirmPasswordInput.focus();
        return;
    }
    if (newPassword !== confirmPassword) {
        if(errorElement) {
            errorElement.textContent = "New passwords do not match.";
            errorElement.style.display = 'block';
        }
        if(confirmPasswordInput) confirmPasswordInput.focus();
        return;
    }
    if (!validatePassword(newPassword)) {
        if(errorElement) {
            errorElement.textContent = "New password does not meet requirements (min 8 chars, upper, lower, special).";
            errorElement.style.display = 'block';
        }
        if(newPasswordInput) newPasswordInput.focus();
        return;
    }
    if (!currentForgotPasswordUser) {
        if(errorElement) {
            errorElement.textContent = "An error occurred. Please start over.";
            errorElement.style.display = 'block';
        }
        resetForgotPasswordForm();
        return;
    }

    let success = false;
    let loginPage = 'login.html';

    if (currentForgotPasswordType === 'staff') {
        let staff = getData(STAFF_KEY);
        let staffIndex = -1;
        for (let i = 0; i < staff.length; i++) {
            if (staff[i].username.toLowerCase() === currentForgotPasswordUser.username.toLowerCase()) {
                staffIndex = i;
                break;
            }
        }
        if (staffIndex > -1) {
            staff[staffIndex].password = simpleCipher(newPassword);
            setData(STAFF_KEY, staff);
            logAction(staff[staffIndex].username, 'Password Reset', `User '${staff[staffIndex].username}' reset their password via forgot password.`);
            success = true;
            loginPage = '../admin-login.html'; // Adjusted path
        }
    } else if (currentForgotPasswordType === 'alumni') {
        let alumni = getData(ALUMNI_KEY);
        let alumniIndex = -1;
        for (let i = 0; i < alumni.length; i++) {
            if (alumni[i].email.toLowerCase() === currentForgotPasswordUser.email.toLowerCase()) {
                alumniIndex = i;
                break;
            }
        }
        if (alumniIndex > -1) {
            alumni[alumniIndex].password = simpleCipher(newPassword);
            setData(ALUMNI_KEY, alumni);
            success = true;
            loginPage = '../alumni-login.html';
        }
    } else {
        let students = getData(STUDENTS_KEY);
        let studentIndex = -1;
        for (let i = 0; i < students.length; i++) {
            if (students[i].studentId === currentForgotPasswordUser.studentId) {
                studentIndex = i;
                break;
            }
        }
        if (studentIndex > -1) {
            students[studentIndex].password = simpleCipher(newPassword);
            setData(STUDENTS_KEY, students);
            success = true;
            loginPage = '../login.html';
        }
    }

    if (success) {
        showSuccess("Password successfully reset! You can now log in with your new password.", "Password Reset", () => {
            resetForgotPasswordForm();
            window.location.href = loginPage;
        });
    } else {
        if(errorElement) {
            errorElement.textContent = "Failed to update password. User not found or error occurred.";
            errorElement.style.display = 'block';
        }
        resetForgotPasswordForm();
    }
}

// ==========================================================================
// - 8.) User Account Management -
// ==========================================================================

function toggleSignupFields() {
    const isStudent = document.getElementById('userTypeStudent').checked;
    const studentFieldsDiv = document.getElementById('studentFields');
    const alumniFieldsDiv = document.getElementById('alumniFields');
    const studentIdInput = document.getElementById('studentId');
    const studentCourseSelect = document.getElementById('studentCourse');
    const alumniYearSelect = document.getElementById('alumniYearGraduated');
    const alumniCourseSelect = document.getElementById('alumniCourseCompleted');
    const heading = document.querySelector('.auth-form h2');

    if (isStudent) {
        if (studentFieldsDiv) studentFieldsDiv.style.display = 'block';
        if (alumniFieldsDiv) alumniFieldsDiv.style.display = 'none';
        if (studentIdInput) studentIdInput.required = true;
        if (studentCourseSelect) studentCourseSelect.required = true;
        if (alumniYearSelect) alumniYearSelect.required = false;
        if (alumniCourseSelect) alumniCourseSelect.required = false;
        if(heading) heading.textContent = 'Student Registration';
    } else { 
        if (studentFieldsDiv) studentFieldsDiv.style.display = 'none';
        if (alumniFieldsDiv) alumniFieldsDiv.style.display = 'block';
        if (studentIdInput) studentIdInput.required = false;
        if (studentCourseSelect) studentCourseSelect.required = false;
        if (alumniYearSelect) alumniYearSelect.required = true;
        if (alumniCourseSelect) alumniCourseSelect.required = true;
        if(heading) heading.textContent = 'Alumni Registration';
    }
}
function handleSignup(event) {
    event.preventDefault();
    const isStudent = document.getElementById('userTypeStudent').checked;
    const userType = isStudent ? 'student' : 'alumni';
    const fullNameInput = document.getElementById('studentFullName');
    const emailInput = document.getElementById('studentEmail');
    const passwordInput = document.getElementById('studentPassword');
    const confirmPasswordInput = document.getElementById('studentConfirmPassword');
    const securityQuestionInput = document.getElementById('studentSecurityQuestion');
    const securityAnswerInput = document.getElementById('studentSecurityAnswer');
    const termsCheckbox = document.getElementById('termsCheckbox');
    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const securityQuestion = securityQuestionInput.value;
    const securityAnswer = securityAnswerInput.value.trim();
    
    if (!fullName || !email || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
        showAlert("Please fill in all common fields (Name, Email, Password, Security Q/A).", "Signup Error");
        return; 
    }
    if (password !== confirmPassword) { 
        showAlert("Passwords do not match.", "Signup Error");
        return; 
    }
    if (!validatePassword(password)) { 
        showAlert("Password does not meet requirements: Minimum 8 characters, including at least one uppercase letter, one lowercase letter, and one special character (!@#$%^&*(),.?\":{}|<>).", "Signup Error");
        return; 
    }
    if (!termsCheckbox.checked) { 
        showAlert("You must accept the Terms and Conditions to register.", "Signup Error");
        return; 
    }
    
    let identifier = ''; 
    let course = '';
    let studentId = ''; 
    let yearGraduated = ''; 
    let courseCompleted = '';
    let specificFieldsValid = true; 

    if (userType === 'student') {
        const studentIdInput = document.getElementById('studentId');
        const courseInput = document.getElementById('studentCourse');
        studentId = studentIdInput.value.trim();
        course = courseInput.value;

        if (!studentId || !course) {
            showAlert("Please fill in Student ID and Course/Strand.", "Signup Error");
            specificFieldsValid = false;
        } else if (!/^\d{5}$/.test(studentId)) {
            showAlert("Student ID must be exactly 5 numbers.", "Signup Error");
            specificFieldsValid = false;
        }
        identifier = studentId;
    } else { 
        const yearGraduatedInput = document.getElementById('alumniYearGraduated');
        const courseCompletedInput = document.getElementById('alumniCourseCompleted');
        yearGraduated = yearGraduatedInput.value.trim();
        courseCompleted = courseCompletedInput.value.trim();
        identifier = email; 
        
        if (!yearGraduated || !courseCompleted) { 
            showAlert("Please fill in Year Graduated and Course Completed.", "Signup Error");
            specificFieldsValid = false; 
            
        } else if (!/^\d{4}$/.test(yearGraduated) || parseInt(yearGraduated) < 1950 || parseInt(yearGraduated) > new Date().getFullYear()) {
            showAlert("Please enter a valid 4-digit year for Year Graduated.", "Signup Error");
            specificFieldsValid = false; 
             
        } else if (courseCompleted.length < 3) { 
            showAlert("Please enter a valid Course Completed name.", "Signup Error");
            specificFieldsValid = false; 
        }
    }

    if (!specificFieldsValid) {
        return; 
    }
    
    let usersArray = [];
    let idToCheck = '';
    let checkType = ''; 
    let emailExists = false; 
    let allStudents = getData(STUDENTS_KEY);
    let allAlumni = getData(ALUMNI_KEY);
    let combinedUsers = allStudents.concat(allAlumni); 

    for (let i = 0; i < combinedUsers.length; i++) {
        
        if (combinedUsers[i].email.toLowerCase() === email.toLowerCase()) {
            emailExists = true;
            break;
        }
    }

    if (emailExists){
        showAlert("This Email address is already registered.", "Signup Error");
        return;
    }

    if (userType === 'student') {
        usersArray = allStudents; 
        idToCheck = studentId.toLowerCase();
        checkType = 'studentId';
        
        const existingUser = usersArray.find(user => user[checkType].toLowerCase() === idToCheck);
        if (existingUser) {
            showAlert('Student ID already registered.', "Signup Error");
            return;
        }
        
        let recycleBin = getData(RECYCLE_BIN_KEY);
        const deletedStudent = (recycleBin.deletedStudents || []).find(u => u.studentId.toLowerCase() === studentId.toLowerCase());
        if (deletedStudent) {
            showAlert("This Student ID was previously registered and deleted. Please contact administration.", "Signup Error");
            return;
        }

    } else {
        let recycleBin = getData(RECYCLE_BIN_KEY);
        const deletedAlumnus = (recycleBin.deletedAlumni || []).find(u => u.email.toLowerCase() === email.toLowerCase()); 
        if (deletedAlumnus) {
            showAlert("This Email was previously registered and deleted. Please contact administration.", "Signup Error");
            return;
        }
    }
    
    if (userType === 'student') {
        const newStudent = {  
            studentId: studentId, 
            fullName: fullName,
            course: course, 
            email: email,
            password: simpleCipher(password),
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
            status: 'pending', 
            registrationDate: getCurrentTimestamp(),
            pendingChanges: null
        };

        let students = getData(STUDENTS_KEY);
        students.push(newStudent);
        setData(STUDENTS_KEY, students);
    } else { 
        const newAlumnus = {
            alumniId: generateAlumniId(),
            fullName: fullName,
            yearGraduated: yearGraduated,
            courseCompleted: courseCompleted,
            email: email,
            password: simpleCipher(password),
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
            status: 'pending',
            registrationDate: getCurrentTimestamp()
        };

        let alumni = getData(ALUMNI_KEY);
        alumni.push(newAlumnus);
        setData(ALUMNI_KEY, alumni);
    }
    
    showSuccess("Registration successful! Your account is pending approval. Please expect an email update within 0–3 working days.", "Registration Pending", () => {
        if(event.target) event.target.reset(); 
        toggleSignupFields(); 
        window.location.href = 'index.html'; 
    });
}
function loadStudentSettingsPage() {
    const session = getCurrentStudentSession();
    if (!session) {
        redirectToLogin('student');
        return;
    }

    const students = getData(STUDENTS_KEY);
    let currentUserData = null;
    for(let i=0; i < students.length; i++) {
        if (students[i].studentId === session.studentId) {
            currentUserData = students[i];
            break;
        }
    }

    if (!currentUserData) {
        showAlert("Could not load your account data.", "Error");
        return;
    }

    const securityQuestionMap = {
        'mother_maiden_name': "What is your mother's maiden name?",
        'first_pet_name': "What was the name of your first pet?",
        'birth_city': "In what city were you born?"
    };
    if (currentUserData.securityQuestion) {
        document.getElementById('displaySecurityQuestion').textContent = securityQuestionMap[currentUserData.securityQuestion] || currentUserData.securityQuestion;
    }
    
    const idInput = document.getElementById('studentSettingsId');
    const fullNameInput = document.getElementById('studentSettingsFullName');
    const courseSelect = document.getElementById('studentSettingsCourse'); 
    const currentFullNameSpan = document.getElementById('currentFullName');
    const currentCourseSpan = document.getElementById('currentCourse');
    const infoMessage = document.getElementById('infoChangeFormInfo');
    const requestButton = document.getElementById('requestChangeButton');
    const deleteBtnStudent = document.getElementById('studentDeleteAccountButton');
    if (deleteBtnStudent) {
        deleteBtnStudent.onclick = () => promptAccountDeletion('student');
    } else { console.error("studentDeleteAccountButton not found"); }

    if (idInput) idInput.value = currentUserData.studentId;
    if (fullNameInput) fullNameInput.value = currentUserData.fullName;
    
    if (currentFullNameSpan) currentFullNameSpan.textContent = currentUserData.fullName;
    if (currentCourseSpan) currentCourseSpan.textContent = currentUserData.course;

    const config = getData(CONFIG_KEY);
    const courses = config.courses || [];
    populateDropdown('studentSettingsCourse', courses, 'name', 'name', 'Select your course/strand');

    if (courseSelect) courseSelect.value = currentUserData.course;
    if (currentUserData.pendingChanges) {
        if (infoMessage && requestButton) {
            infoMessage.textContent = `You have a pending change request submitted on ${currentUserData.pendingChanges.requestDate}. Please wait for administrator review. Old Name: ${currentUserData.pendingChanges.oldFullName}, Old Course: ${currentUserData.pendingChanges.oldCourse}. New Name: ${currentUserData.pendingChanges.newFullName}, New Course: ${currentUserData.pendingChanges.newCourse}.`;
            infoMessage.style.display = 'block';
            requestButton.disabled = true; 
            fullNameInput.disabled = true;
            courseSelect.disabled = true;
        }
    } else {
        if (infoMessage && requestButton) {
            infoMessage.style.display = 'none';
            requestButton.disabled = false;
            fullNameInput.disabled = false;
            courseSelect.disabled = false;
        }
    }

    const infoChangeForm = document.getElementById('studentInfoChangeForm');
    const passwordChangeForm = document.getElementById('studentChangePasswordForm'); 

    if (infoChangeForm) {
        infoChangeForm.addEventListener('submit', handleStudentInfoChangeRequest);
    }

    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', handleStudentChangePassword);
    }
}
function handleStudentInfoChangeRequest(event) {
    event.preventDefault();
    const session = getCurrentStudentSession();
    if (!session) return;

    const students = getData(STUDENTS_KEY);
    let studentIndex = -1;
     for(let i=0; i < students.length; i++) {
        if (students[i].studentId === session.studentId) {
            studentIndex = i;
            break;
        }
    }

    if (studentIndex === -1) {
        showAlert("Error finding your account data.", "Error");
        return;
    }

    const currentUserData = students[studentIndex];

    if (currentUserData.pendingChanges) {
        showAlert("You already have a pending change request.", "Info");
        return;
    }

    const newFullNameInput = document.getElementById('studentSettingsFullName');
    const newCourseSelect = document.getElementById('studentSettingsCourse');
    const errorElement = document.getElementById('infoChangeFormError');
    const infoMessage = document.getElementById('infoChangeFormInfo');
    const requestButton = document.getElementById('requestChangeButton');

    errorElement.style.display = 'none';
    infoMessage.style.display = 'none';

    const newFullName = newFullNameInput.value.trim();
    const newCourse = newCourseSelect.value;

    if (!newFullName || !newCourse) {
        errorElement.textContent = "Please ensure Full Name and Course are selected/entered.";
        errorElement.style.display = 'block';
        return;
    }

    if (newFullName === currentUserData.fullName && newCourse === currentUserData.course) {
        errorElement.textContent = "No changes detected in Full Name or Course.";
        errorElement.style.display = 'block';
        return;
    }

    students[studentIndex].pendingChanges = {
        oldFullName: currentUserData.fullName,
        oldCourse: currentUserData.course,
        newFullName: newFullName,
        newCourse: newCourse,
        requestDate: getCurrentTimestamp()
    };

    setData(STUDENTS_KEY, students);

    if (infoMessage && requestButton && newFullNameInput && newCourseSelect) {
        infoMessage.textContent = `Change request submitted successfully on ${students[studentIndex].pendingChanges.requestDate}. Please wait for administrator review.`;
        infoMessage.style.display = 'block';
        requestButton.disabled = true;
        newFullNameInput.disabled = true;
        newCourseSelect.disabled = true;
        errorElement.style.display = 'none'; 
    }

    showSuccess("Your information change request has been submitted for approval.", "Request Submitted");
}
function handleStudentChangePassword(event) {
    event.preventDefault();
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const errorElement = document.getElementById('changePasswordError');

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    errorElement.style.display = 'none';

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorElement.textContent = "Please fill in all fields.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }
    if (newPassword !== confirmNewPassword) {
        errorElement.textContent = "New passwords do not match.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }
    if (!validatePassword(newPassword)) {
        errorElement.textContent = "New password does not meet requirements (min 8 chars, upper, lower, special).";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    const session = getCurrentStudentSession();
    if (!session) {
        redirectToLogin('student');
        return;
    }

    let students = getData(STUDENTS_KEY);
    const studentIndex = students.findIndex(s => s.studentId === session.studentId);

    if (studentIndex === -1) {
        errorElement.textContent = "Error finding your account.";
        event.target.reset();
        errorElement.style.display = 'block';
        return; 
    }

    const student = students[studentIndex];

    if (student.password !== simpleCipher(currentPassword)) {
        errorElement.textContent = "Incorrect current password.";
        event.target.reset();
        errorElement.style.display = 'block';
        return;
    }

    if (simpleCipher(newPassword) === student.password) {
        errorElement.textContent = "New password cannot be the same as the current password.";
        event.target.reset();
        errorElement.style.display = 'block';
        return;
    
    }
    
    students[studentIndex].password = simpleCipher(newPassword); 
    setData(STUDENTS_KEY, students);

    showSuccess("Password updated successfully.", "Password Change", () => {
        event.target.reset(); 
    });
}
function loadAlumniSettingsPage() {
    const session = getCurrentAlumniSession();
    if (!session) {
        redirectToLogin('alumni');
        return;
    }
    
    const alumni = getData(ALUMNI_KEY);
    let currentUserData = null;
    for(let i=0; i < alumni.length; i++){
        
        if(alumni[i].email === session.email) {
            currentUserData = alumni[i];
            break;
        }
    }

    if (!currentUserData) {
        showAlert("Could not load your account data.", "Error");
        logoutUser('alumni'); 
        return;
    }

    const securityQuestionMap = {
        'mother_maiden_name': "What is your mother's maiden name?",
        'first_pet_name': "What was the name of your first pet?",
        'birth_city': "In what city were you born?"
    };
    if (currentUserData.securityQuestion) {
        document.getElementById('displaySecurityQuestion').textContent = securityQuestionMap[currentUserData.securityQuestion] || currentUserData.securityQuestion;
    }

    const emailInput = document.getElementById('alumniSettingsEmail');
    const fullNameInput = document.getElementById('alumniSettingsFullName');
    const yearGradInput = document.getElementById('alumniSettingsYearGraduated');
    const courseCompInput = document.getElementById('alumniSettingsCourseCompleted');
    const deleteBtnAlumni = document.getElementById('alumniDeleteAccountButton');
    if (deleteBtnAlumni) {
        deleteBtnAlumni.onclick = () => promptAccountDeletion('alumni');
    } else { console.error("alumniDeleteAccountButton not found"); }

    if(emailInput) emailInput.value = currentUserData.email;
    if(fullNameInput) fullNameInput.value = currentUserData.fullName;
    if(yearGradInput) yearGradInput.value = currentUserData.yearGraduated || ''; 
    if(courseCompInput) courseCompInput.value = currentUserData.courseCompleted || ''; 
    
    if (yearGradInput) {
        yearGradInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4); 
        });
    }

    
    const passwordForm = document.getElementById('alumniChangePasswordForm');
    const profileForm = document.getElementById('alumniProfileUpdateForm');

    if (passwordForm) {
        passwordForm.addEventListener('submit', handleAlumniChangePassword);
    }

    if (profileForm) {
        profileForm.addEventListener('submit', handleAlumniUpdateProfile); 
    }
}
function handleAlumniUpdateProfile(event) {
    event.preventDefault(); 
    const session = getCurrentAlumniSession();
    if (!session) {
        redirectToLogin('alumni'); 
        return;
    }
    
    const yearGradInput = document.getElementById('alumniSettingsYearGraduated');
    const courseCompInput = document.getElementById('alumniSettingsCourseCompleted');
    const errorElement = document.getElementById('alumniProfileUpdateError');
    const successElement = document.getElementById('alumniProfileUpdateSuccess');

    errorElement.style.display = 'none'; 
    successElement.style.display = 'none';
    const newYearGraduated = yearGradInput.value.trim();
    const newCourseCompleted = courseCompInput.value.trim();
    
    if (!newYearGraduated || !newCourseCompleted) {
        errorElement.textContent = "Please fill in both Year Graduated and Course Completed.";
        errorElement.style.display = 'block';
        return;
    }
    
    if (!/^\d{4}$/.test(newYearGraduated) || parseInt(newYearGraduated) < 1950 || parseInt(newYearGraduated) > new Date().getFullYear() + 1) { 
        errorElement.textContent = "Please enter a valid 4-digit year for Year Graduated.";
        errorElement.style.display = 'block';
        return;
    }
    
    if (newCourseCompleted.length < 3) { 
        errorElement.textContent = "Please enter a valid Course Completed name.";
        errorElement.style.display = 'block';
        return;
    }
    
    let alumni = getData(ALUMNI_KEY);
    let userIndex = -1;
    for (let i = 0; i < alumni.length; i++) {
        if (alumni[i].email === session.email) {
            userIndex = i;
            break;
        }
    }

    if (userIndex === -1) {
        errorElement.textContent = "Error finding your account data. Please try logging out and back in.";
        errorElement.style.display = 'block';
        return;
    }

    if (alumni[userIndex].yearGraduated === newYearGraduated && alumni[userIndex].courseCompleted === newCourseCompleted) {
        errorElement.textContent = "No changes detected in profile information.";
        errorElement.style.display = 'block';
        return;
    }

    alumni[userIndex].yearGraduated = newYearGraduated;
    alumni[userIndex].courseCompleted = newCourseCompleted;

    setData(ALUMNI_KEY, alumni);
    successElement.textContent = "Profile information updated successfully!";
    successElement.style.display = 'block';
}
function handleAlumniChangePassword(event) {
    event.preventDefault();
    const session = getCurrentAlumniSession();
    if (!session) return;

    const currentPasswordInput = document.getElementById('alumniCurrentPassword');
    const newPasswordInput = document.getElementById('alumniNewPassword');
    const confirmNewPasswordInput = document.getElementById('alumniConfirmNewPassword');
    const errorElement = document.getElementById('alumniChangePasswordError'); 
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    errorElement.style.display = 'none';

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorElement.textContent = "Please fill in all password fields.";
        errorElement.style.display = 'block';
        if(event.target) event.target.reset();
        return;
    }
    if (newPassword !== confirmNewPassword) {  if(event.target) event.target.reset(); return; }
    if (!validatePassword(newPassword)) {  if(event.target) event.target.reset(); return; }

    let alumni = getData(ALUMNI_KEY);
    let userIndex = -1;
    let currentUserData = null;
    for(let i=0; i < alumni.length; i++){
        if(alumni[i].email === session.email) { 
            userIndex = i;
            currentUserData = alumni[i];
            break;
        }
    }
    if (userIndex === -1 || !currentUserData) {  return; }

    
    if (currentUserData.password !== simpleCipher(currentPassword)) {
        errorElement.textContent = "Incorrect current password.";
        errorElement.style.display = 'block';
        if(event.target) event.target.reset();
        return;
    }

    if (simpleCipher(newPassword) === currentUserData.password) {
        errorElement.textContent = "New password cannot be the same as the current password.";
        errorElement.style.display = 'block';
        if(event.target) event.target.reset();
        return;
    }

    alumni[userIndex].password = simpleCipher(newPassword);
    setData(ALUMNI_KEY, alumni);

    showSuccess("Password updated successfully.", "Password Change", () => {
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
    });
}
function loadStaffSettingsPage() {
    const session = getCurrentAdminSession();
    if (!session) {
        redirectToLogin('admin'); 
        return;
    }

    const staffList = getData(STAFF_KEY);
    let currentUserData = null;
    for(let i=0; i < staffList.length; i++) {
        if (staffList[i].username === session.username) {
            currentUserData = staffList[i];
            break;
        }
    }

    if (!currentUserData) {
        showAlert("Could not load your account data.", "Error");
        return; 
    }

    const usernameInput = document.getElementById('staffSettingsUsername');
    const roleInput = document.getElementById('staffSettingsRole');
    const fullNameInput = document.getElementById('staffSettingsFullName');
    const securityQuestionSelect = document.getElementById('staffSettingsSecurityQuestion'); 
    const securityAnswerInput = document.getElementById('staffSettingsSecurityAnswer');   

    if(usernameInput) usernameInput.value = currentUserData.username;
    if(roleInput) roleInput.value = currentUserData.role;
    if(fullNameInput) fullNameInput.value = currentUserData.fullName || '';
    if(securityQuestionSelect) {
        securityQuestionSelect.value = currentUserData.securityQuestion || ''; 
    } else { console.error("staffSettingsSecurityQuestion select not found"); }
    
    if (securityAnswerInput) {
        securityAnswerInput.value = currentUserData.securityAnswer || ''; 
    } else { console.error("staffSettingsSecurityAnswer input not found"); }

    const currentPasswordVerifyInput = document.getElementById('staffInfoCurrentPassword');
    if(currentPasswordVerifyInput) currentPasswordVerifyInput.value = '';

    if (usernameInput && (currentUserData.username === 'admin' || currentUserData.username === 'dev_maint')) {
        usernameInput.disabled = true;
        usernameInput.title = 'The username of this default account cannot be changed.';
        
    } else if (usernameInput) {
        usernameInput.disabled = false; 
        usernameInput.title = ''; 
    }

    const infoForm = document.getElementById('staffInfoForm');
    const passwordForm = document.getElementById('staffChangePasswordForm');

    if (infoForm) {
        infoForm.addEventListener('submit', handleUpdateStaffInfo);
    }
    if (passwordForm) {
        passwordForm.addEventListener('submit', handleStaffChangePasswordSelf);
    }
}
function handleUpdateStaffInfo(event) {
    event.preventDefault();
    const session = getCurrentAdminSession();
    if (!session) {
        redirectToLogin('admin');
        return;
    }

    const usernameInput = document.getElementById('staffSettingsUsername'); 
    const fullNameInput = document.getElementById('staffSettingsFullName');
    const securityQuestionSelect = document.getElementById('staffSettingsSecurityQuestion');
    const securityAnswerInput = document.getElementById('staffSettingsSecurityAnswer');
    const currentPasswordInput = document.getElementById('staffInfoCurrentPassword');
    const errorElement = document.getElementById('infoFormError');

    errorElement.style.display = 'none';

    const newUsername = usernameInput.value.trim(); 
    const newFullName = fullNameInput.value.trim();
    const newSecurityQuestion = securityQuestionSelect.value;
    const newSecurityAnswer = securityAnswerInput.value.trim();
    const verificationPassword = currentPasswordInput.value;

    
    if (!newUsername || !newFullName || !newSecurityQuestion || !newSecurityAnswer || !verificationPassword) {
        errorElement.textContent = "Username, Full Name, Security Question, Answer, and Current Password are required.";
        errorElement.style.display = 'block';
        currentPasswordInput.value = '';
        return;
    }
    if (newSecurityAnswer.length < 3) {
        errorElement.textContent = "Security Answer should be at least 3 characters.";
        errorElement.style.display = 'block';
        currentPasswordInput.value = '';
        return;
    }
    
    if (newUsername.indexOf(' ') !== -1) {
        errorElement.textContent = "Username cannot contain spaces.";
        errorElement.style.display = 'block';
        return;
    }

    let staffList = getData(STAFF_KEY);
    let userIndex = -1;
    let currentUserData = null;
    for(let i=0; i < staffList.length; i++) {
        if(staffList[i].username === session.username) { 
            userIndex = i;
            currentUserData = staffList[i];
            break;
        }
    }
    if (userIndex === -1 || !currentUserData) {
        errorElement.textContent = "Error finding your account data.";
        errorElement.style.display = 'block';
        currentPasswordInput.value = '';
        return;
    }

    
    const usernameChanged = newUsername !== currentUserData.username;
    if (usernameChanged) {
        if (currentUserData.username === 'admin' || currentUserData.username === 'dev_maint') {
            errorElement.textContent = "Cannot change the username of this default account.";
            errorElement.style.display = 'block';
            usernameInput.value = currentUserData.username; 
            return;
        }
        
        let usernameExists = false;
        
        for (let i = 0; i < staffList.length; i++) {
            if (i !== userIndex && staffList[i].username.toLowerCase() === newUsername.toLowerCase()) {
                usernameExists = true;
                break;
            }
        }
        
        if (!usernameExists) {
            const recycleBin = getData(RECYCLE_BIN_KEY);
            const deletedStaff = recycleBin.deletedStaff || [];
            for (let i = 0; i < deletedStaff.length; i++) {
                if (deletedStaff[i].username.toLowerCase() === newUsername.toLowerCase()) {
                    usernameExists = true;
                    break;
                }
            }
        }

        if (usernameExists) {
            errorElement.textContent = `Username "${newUsername}" is already taken. Please choose another.`;
            errorElement.style.display = 'block';
            usernameInput.value = currentUserData.username; 
            return;
        }
         
    }
    
    if (currentUserData.password !== simpleCipher(verificationPassword)) {
        errorElement.textContent = "Incorrect Current Password. Changes not saved.";
        errorElement.style.display = 'block';
        currentPasswordInput.value = '';
        currentPasswordInput.focus();
        return;
}
    
    if (!usernameChanged &&
        currentUserData.fullName === newFullName &&
        currentUserData.securityQuestion === newSecurityQuestion &&
        currentUserData.securityAnswer === newSecurityAnswer) {
        errorElement.textContent = "No changes detected in account information.";
        errorElement.style.display = 'block';
        currentPasswordInput.value = '';
        return;
    }
    
    let updatedFieldsLog = [];
    let sessionNeedsUpdate = false;

    if (usernameChanged) {
        staffList[userIndex].username = newUsername;
        updatedFieldsLog.push("Username");
        sessionNeedsUpdate = true; 
    }
    if (staffList[userIndex].fullName !== newFullName) {
        staffList[userIndex].fullName = newFullName;
        updatedFieldsLog.push("Full Name");
    }
    if (staffList[userIndex].securityQuestion !== newSecurityQuestion) {
        staffList[userIndex].securityQuestion = newSecurityQuestion;
        updatedFieldsLog.push("Security Question");
    }
    if (staffList[userIndex].securityAnswer !== newSecurityAnswer) {
        staffList[userIndex].securityAnswer = newSecurityAnswer;
        updatedFieldsLog.push("Security Answer");
    }

    setData(STAFF_KEY, staffList); 
    logAction(session.username, 'Account Info Update', `Updated own account info: ${updatedFieldsLog.join(', ')}.`);
    currentPasswordInput.value = '';
    showSuccess("Account information updated successfully.", "Update Complete");

    if (sessionNeedsUpdate) {
        const updatedUserData = staffList[userIndex];
        loginUser('admin', updatedUserData); 
        updateAdminUI(); 
    }
}
function handleStaffChangePasswordSelf(event) {
    event.preventDefault();
    const session = getCurrentAdminSession();
    if (!session) return;

    const currentPasswordInput = document.getElementById('staffCurrentPassword');
    const newPasswordInput = document.getElementById('staffNewPassword');
    const confirmNewPasswordInput = document.getElementById('staffConfirmNewPassword');
    const errorElement = document.getElementById('passwordFormError');
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    errorElement.style.display = 'none';

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorElement.textContent = "Please fill in all password fields.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    if (newPassword !== confirmNewPassword) {
        errorElement.textContent = "New passwords do not match.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    if (!validatePassword(newPassword)) {
        errorElement.textContent = "New password does not meet requirements (min 8 chars, upper, lower, special).";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    let staffList = getData(STAFF_KEY);
    let userIndex = -1;
    let currentUserData = null;
    for(let i=0; i < staffList.length; i++) {
        if(staffList[i].username === session.username) {
            userIndex = i;
            currentUserData = staffList[i];
            break;
        }
    }

    if (userIndex === -1 || !currentUserData) {
        errorElement.textContent = "Error finding your account data.";
        errorElement.style.display = 'block';
        return;
    }

    if (currentUserData.password !== simpleCipher(currentPassword)) {
        errorElement.textContent = "Incorrect current password.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    if (simpleCipher(newPassword) === currentUserData.password) {
        errorElement.textContent = "New password cannot be the same as the current password.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }
    
    staffList[userIndex].password = simpleCipher(newPassword);
    setData(STAFF_KEY, staffList);
    logAction(session.username, 'Password Change', `Changed own password.`);
    showSuccess("Password updated successfully.", "Password Change", () => {
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
    });
}

// ==========================================================================
// - 9.) Feedback Handling -
// ==========================================================================

function loadSubmitFeedbackPage() {
    const session = getCurrentStudentSession();
    if (!session) {
        redirectToLogin('student'); 
        return;
    }

    const feedbackForm = document.getElementById('feedbackForm');
    const cooldownMessage = document.getElementById('feedbackCooldownMessage');
    const submitButton = document.getElementById('submitFeedbackButton');
    const feedbackStudentIdInput = document.getElementById('feedbackStudentId');
    const feedbackTopicSelect = document.getElementById('feedbackTopic'); 

    if (!feedbackTopicSelect) {
        const errorDiv = document.getElementById('feedbackSubmitError');
        if(errorDiv) {
            errorDiv.textContent = "Error loading form component (Topic). Please contact support.";
            errorDiv.style.display = 'block';
        }
        return; 
    }

    if (feedbackStudentIdInput) {
        feedbackStudentIdInput.value = session.studentId;
    }

    const config = getData(CONFIG_KEY);
    populateDropdown('feedbackTopic', config.topics, 'name', 'name', 'Select a topic');
    const cooldowns = getData(FEEDBACK_COOLDOWN_KEY);
    const lastSubmissionTime = cooldowns[session.studentId];
    const now = Date.now();
    const cooldownMillis = FEEDBACK_COOLDOWN_MINUTES * 60 * 1000;
    let cooldownIntervalId = null;

    function updateCooldownDisplay() {
        const currentTime = Date.now();
        const endTime = lastSubmissionTime + cooldownMillis;
        const remainingMillis = endTime - currentTime;

        if (remainingMillis <= 0) {
            if (cooldownIntervalId) {
                clearInterval(cooldownIntervalId); 
                cooldownIntervalId = null;
            }

            if (cooldownMessage) cooldownMessage.style.display = 'none';
            if (submitButton) submitButton.disabled = false;
        } else {
            const remainingSeconds = Math.ceil(remainingMillis / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            let timeString = '';

            if (minutes > 0) {
                timeString += `${minutes} minute(s) `;
            }
            
            if (minutes === 0 || seconds > 0) {
                 timeString += `${seconds} second(s)`;
            }

            if (cooldownMessage && submitButton) {
                cooldownMessage.textContent = `You can submit new feedback again in ${timeString}.`;
                cooldownMessage.style.display = 'block';
                submitButton.disabled = true;
            }
        }
    }

    const topicSelectElement = document.getElementById('feedbackTopic');
    const descriptionDisplayElement = document.getElementById('topicDescriptionDisplay');

    if (topicSelectElement && descriptionDisplayElement) {
        topicSelectElement.addEventListener('change', function(event) {
            const selectedTopicName = event.target.value; 
            let description = ''; 

            if (selectedTopicName) {
                const allTopics = config.topics || []; 
                
                for (let i = 0; i < allTopics.length; i++) {
                    if (allTopics[i].name === selectedTopicName) {
                        description = allTopics[i].description || ''; 
                        break; 
                    }
                }
            }
            descriptionDisplayElement.textContent = description; 
        });
        
    }

    if (lastSubmissionTime && (now - lastSubmissionTime < cooldownMillis)) {
        updateCooldownDisplay();
        cooldownIntervalId = setInterval(updateCooldownDisplay, 1000);
    } else {
        if (cooldownMessage) cooldownMessage.style.display = 'none';
        if (submitButton) submitButton.disabled = false;
    }

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleSubmitFeedback);
        
    }
}
function handleSubmitFeedback(event) {
    event.preventDefault();

    const topicInput = document.getElementById('feedbackTopic');
    const detailsInput = document.getElementById('feedbackDetails');
    const studentIdInput = document.getElementById('feedbackStudentId');
    const errorElement = document.getElementById('feedbackSubmitError');
    const submitButton = document.getElementById('submitFeedbackButton');
    const cooldownMessage = document.getElementById('feedbackCooldownMessage');
    const anonymousCheckbox = document.getElementById('anonymousCheckbox');

    errorElement.style.display = 'none';

    const topic = topicInput.value;
    const details = detailsInput.value.trim();
    const studentId = studentIdInput.value; 
    const isAnonymous = anonymousCheckbox.checked;

    if (!topic || !details) {
        errorElement.textContent = "Please fill in all feedback fields.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    const cooldowns = getData(FEEDBACK_COOLDOWN_KEY);
    const lastSubmissionTime = cooldowns[studentId];
    const now = Date.now();
    const cooldownMillis = FEEDBACK_COOLDOWN_MINUTES * 60 * 1000;

    if (lastSubmissionTime && (now - lastSubmissionTime < cooldownMillis)) {
        const minutesRemaining = Math.ceil((cooldownMillis - (now - lastSubmissionTime)) / (60 * 1000));
        if (cooldownMessage && submitButton) {
            cooldownMessage.textContent = `You must wait ${minutesRemaining} more minute(s) to submit feedback.`;
            cooldownMessage.style.display = 'block';
            submitButton.disabled = true;
        }
        
        setTimeout(() => {
            if (cooldownMessage) cooldownMessage.style.display = 'none';
            if (submitButton) submitButton.disabled = false;
        }, cooldownMillis - (now - lastSubmissionTime));
        return; 
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    const newFeedback = {
        feedbackId: generateId('fb'),
        studentId: studentId, 
        topic: topic,
        details: details,
        submissionDate: getCurrentTimestamp(),
        status: 'pending',
        roadmap: null,
        isAnonymous: isAnonymous,
        moderatorAssigned: null
    };

    feedbacks.unshift(newFeedback); 
    setData(FEEDBACKS_KEY, feedbacks);

    cooldowns[studentId] = now;
    setData(FEEDBACK_COOLDOWN_KEY, cooldowns);
    showThankYouModal();

    event.target.reset();
    if (cooldownMessage && submitButton) {
        cooldownMessage.textContent = `You can submit new feedback again in ${FEEDBACK_COOLDOWN_MINUTES} minute(s).`;
        cooldownMessage.style.display = 'block';
        submitButton.disabled = true;
        setTimeout(() => {
            if (cooldownMessage) cooldownMessage.style.display = 'none';
            if (submitButton) submitButton.disabled = false;
        }, cooldownMillis);
    }
}
function loadAlumniSubmitFeedbackPage() {
    const session = getCurrentAlumniSession();
    if (!session) {
        redirectToLogin('alumni');
        return;
    }

    const feedbackForm = document.getElementById('alumniFeedbackForm');
    const cooldownMessage = document.getElementById('alumniFeedbackCooldownMessage'); 
    const submitButton = document.getElementById('submitAlumniFeedbackButton'); 
    const alumniIdentifierInput = document.getElementById('alumniFeedbackIdentifier'); 
    const feedbackTopicSelect = document.getElementById('feedbackTopic'); 

    if (!feedbackTopicSelect || !feedbackForm || !cooldownMessage || !submitButton || !alumniIdentifierInput) {
        const errorDiv = document.getElementById('alumniFeedbackSubmitError'); 
        if(errorDiv) {
            errorDiv.textContent = "Error loading form components. Please contact support.";
            errorDiv.style.display = 'block';
        }
        return;
    }
    
    alumniIdentifierInput.value = session.alumniId; 
    const identifierForCooldown = session.alumniId; 
    const config = getData(CONFIG_KEY);
    populateDropdown('feedbackTopic', config.topics, 'name', 'name', 'Select a topic');

    const descriptionDisplayElement = document.getElementById('topicDescriptionDisplay');
    if (feedbackTopicSelect && descriptionDisplayElement) {
        feedbackTopicSelect.addEventListener('change', function(event) {
            const selectedTopicName = event.target.value; 
            let description = ''; 
            if (selectedTopicName) {
                const allTopics = config.topics || []; 
                for (let i = 0; i < allTopics.length; i++) {
                    if (allTopics[i].name === selectedTopicName) {
                        description = allTopics[i].description || ''; 
                        break; 
                    }
                }
            }
            descriptionDisplayElement.textContent = description; 
        });
        
    }
    
    const cooldowns = getData(FEEDBACK_COOLDOWN_KEY);
    const lastSubmissionTime = cooldowns[identifierForCooldown]; 
    const now = Date.now();
    const cooldownMillis = FEEDBACK_COOLDOWN_MINUTES * 60 * 1000;
    let cooldownIntervalId = null;

    function updateAlumniCooldownDisplay() {
        const currentTime = Date.now();
        const endTime = lastSubmissionTime + cooldownMillis;
        const remainingMillis = endTime - currentTime;

        if (remainingMillis <= 0) {
            if (cooldownIntervalId) {
                clearInterval(cooldownIntervalId);
                cooldownIntervalId = null;
            }
            if (cooldownMessage) cooldownMessage.style.display = 'none';
            if (submitButton) submitButton.disabled = false;
        } else {
            const remainingSeconds = Math.ceil(remainingMillis / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            let timeString = (minutes > 0 ? `${minutes} min(s) ` : '') + (minutes === 0 || seconds > 0 ? `${seconds} sec(s)` : '');

            if (cooldownMessage && submitButton) {
                cooldownMessage.textContent = `You can submit new feedback again in ${timeString}.`;
                cooldownMessage.style.display = 'block';
                submitButton.disabled = true;
            }
        }
    }

    if (lastSubmissionTime && (now - lastSubmissionTime < cooldownMillis)) {
        updateAlumniCooldownDisplay();
        cooldownIntervalId = setInterval(updateAlumniCooldownDisplay, 1000);
    } else {
        if (cooldownMessage) cooldownMessage.style.display = 'none';
        if (submitButton) submitButton.disabled = false;
    }

    feedbackForm.addEventListener('submit', handleAlumniSubmitFeedback);
}
function handleAlumniSubmitFeedback(event) {
    event.preventDefault();

    const topicInput = document.getElementById('feedbackTopic'); 
    const detailsInput = document.getElementById('feedbackDetails'); 
    const identifierInput = document.getElementById('alumniFeedbackIdentifier'); 
    const errorElement = document.getElementById('alumniFeedbackSubmitError'); 
    const submitButton = document.getElementById('submitAlumniFeedbackButton'); 
    const cooldownMessage = document.getElementById('alumniFeedbackCooldownMessage'); 
    const anonymousCheckbox = document.getElementById('anonymousCheckbox'); 

    errorElement.style.display = 'none';
    const topic = topicInput.value;
    const details = detailsInput.value.trim();
    const alumniId = identifierInput.value; 
    const isAnonymous = anonymousCheckbox.checked;

    if (!topic || !details) {
        errorElement.textContent = "Please select a Topic and provide Details.";
        errorElement.style.display = 'block';
        return;
    }
    if (!alumniId) { 
        errorElement.textContent = "Error submitting feedback: User identifier missing. Please re-login.";
        errorElement.style.display = 'block';
        return;
    }

     
    const cooldowns = getData(FEEDBACK_COOLDOWN_KEY);
    const lastSubmissionTime = cooldowns[alumniId]; 
    const now = Date.now();
    const cooldownMillis = FEEDBACK_COOLDOWN_MINUTES * 60 * 1000;

    if (lastSubmissionTime && (now - lastSubmissionTime < cooldownMillis)) {
        
        const remainingSeconds = Math.ceil((lastSubmissionTime + cooldownMillis - now) / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        let timeString = (minutes > 0 ? `${minutes} min(s) ` : '') + (minutes === 0 || seconds > 0 ? `${seconds} sec(s)` : '');

        if (cooldownMessage && submitButton) {
            cooldownMessage.textContent = `You must wait ${timeString} to submit feedback.`;
            cooldownMessage.style.display = 'block';
            submitButton.disabled = true;
            
            setTimeout(() => {
                if (cooldownMessage) cooldownMessage.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
            }, lastSubmissionTime + cooldownMillis - now);
        }
        return; 
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    const newFeedback = {
        feedbackId: generateId('fb'),
        userType: 'Alumni', 
        submitterId: alumniId,
        topic: topic,
        details: details,
        submissionDate: getCurrentTimestamp(),
        status: 'pending',
        category: null, 
        roadmap: null,
        isAnonymous: isAnonymous, 
        moderatorAssigned: null,
        approvalDate: null
         
    };

    feedbacks.unshift(newFeedback); 
    setData(FEEDBACKS_KEY, feedbacks);
    cooldowns[alumniId] = now;
    setData(FEEDBACK_COOLDOWN_KEY, cooldowns);
    showThankYouModal();
    event.target.reset(); 
     
    const descriptionDisplay = document.getElementById('topicDescriptionDisplay');
    if(descriptionDisplay) descriptionDisplay.textContent = '';
     
    if (cooldownMessage && submitButton) {
        const minutes = FEEDBACK_COOLDOWN_MINUTES;
        cooldownMessage.textContent = `You can submit new feedback again in ${minutes} minute(s).`;
        cooldownMessage.style.display = 'block';
        submitButton.disabled = true;
        setTimeout(() => {
            if (cooldownMessage) cooldownMessage.style.display = 'none';
            if (submitButton) submitButton.disabled = false;
        }, cooldownMillis);
    }
}
function loadFeedbackHistoryPage() {
    const session = getCurrentStudentSession();
    if (!session) return;
    displayFeedbackHistory();

    const config = getData(CONFIG_KEY);
    populateDropdown('editFeedbackTopic', config.topics, 'name', 'name', 'Select a topic');
   
    const editFeedbackForm = document.getElementById('editFeedbackForm');
    if (editFeedbackForm) {
        editFeedbackForm.addEventListener('submit', handleUpdateFeedback);
    }
}
function displayFeedbackHistory() {
    const session = getCurrentStudentSession();
    if (!session) return;

    const tableBody = document.getElementById('feedbackHistoryBody');
    if (!tableBody) return;

    const allFeedbacks = getData(FEEDBACKS_KEY);
    const studentFeedbacks = allFeedbacks.filter(fb => fb.studentId === session.studentId);
    studentFeedbacks.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
    tableBody.innerHTML = ''; 

    if (studentFeedbacks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="no-data">No feedback submitted yet.</td></tr>`; 
        return;
    }

    studentFeedbacks.forEach(fb => { 
        const row = tableBody.insertRow();
        let actionsHtml = '';
    
        actionsHtml += `<button class="btn btn-sm btn-view" onclick="viewStudentFeedbackDetails('${fb.feedbackId}')">View</button> `;
        
        if (fb.status === 'pending') {
            actionsHtml += `<button class="btn btn-sm btn-edit" onclick="editFeedback('${fb.feedbackId}')">Edit</button> `;
            actionsHtml += `<button class="btn btn-sm btn-delete" onclick="promptDeleteStudentFeedback('${fb.feedbackId}')">Delete</button>`;
        }

        row.innerHTML = `
            <td>${formatTimestampForDisplay(fb.submissionDate)}</td>
            <td>${fb.topic || 'N/A'} ${fb.isAnonymous ? '<small>(Anonymous)</small>' : ''}</td>
            <td><span class="status-${fb.status.toLowerCase()}">${fb.status}</span></td>
            <td>${fb.roadmap || 'N/A'}</td>
            <td>${actionsHtml}</td>
        `;
    });
}
function viewStudentFeedbackDetails(feedbackId) {
    const session = getCurrentStudentSession(); 
    if (!session) return;

    const allFeedbacks = getData(FEEDBACKS_KEY);
    let feedback = null;
    
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId && allFeedbacks[i].studentId === session.studentId){
            feedback = allFeedbacks[i];
            break;
        }
    }

    if (!feedback) {
        showAlert("Feedback details not found.", "Error");
        return;
    }
    
    document.getElementById('studentDetailDate').textContent = formatTimestampForDisplay(feedback.submissionDate);
    document.getElementById('studentDetailTopic').textContent = feedback.topic || 'N/A';
    document.getElementById('studentDetailMessage').textContent = feedback.details || '';
    document.getElementById('studentDetailStatus').textContent = feedback.status;
    document.getElementById('studentDetailRoadmap').textContent = feedback.roadmap || 'N/A';

    const staffMessageArea = document.getElementById('staffMessageArea');
    const staffMessageSeparator = document.getElementById('staffMessageSeparator');
    const staffMessageElement = document.getElementById('studentDetailStaffMessage');

    if (feedback.staffMessage && staffMessageArea && staffMessageElement && staffMessageSeparator) {
        staffMessageElement.textContent = feedback.staffMessage;
        staffMessageArea.style.display = 'block';
        staffMessageSeparator.style.display = 'block';
    } else if (staffMessageArea && staffMessageSeparator) {
        
        staffMessageArea.style.display = 'none';
        staffMessageSeparator.style.display = 'none';
    }
    openModal('viewStudentFeedbackDetailsModal');
}
function loadAlumniFeedbackHistoryPage() {
    const session = getCurrentAlumniSession();
    if (!session) {
        redirectToLogin('alumni');
        return;
    }
    displayAlumniFeedbackHistory(); 

    const config = getData(CONFIG_KEY);
    populateDropdown('editAlumniFeedbackTopic', config.topics, 'name', 'name', 'Select a topic'); 

    
    const editFeedbackForm = document.getElementById('editAlumniFeedbackForm'); 
    if (editFeedbackForm) {
        editFeedbackForm.addEventListener('submit', handleUpdateAlumniFeedback); 
    }
}
function displayAlumniFeedbackHistory() {
    const session = getCurrentAlumniSession();
    if (!session) return;

    const tableBody = document.getElementById('alumniFeedbackHistoryBody');
    if (!tableBody) return;

    const allFeedbacks = getData(FEEDBACKS_KEY);
    let alumniFeedbacks = [];
    for (let i = 0; i < allFeedbacks.length; i++) {
        if (allFeedbacks[i].userType === 'Alumni' && allFeedbacks[i].submitterId === session.alumniId) {
        alumniFeedbacks.push(allFeedbacks[i]);
        }
    }

    alumniFeedbacks.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));
    tableBody.innerHTML = '';

    if (alumniFeedbacks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="no-data">No feedback submitted yet.</td></tr>`;
        return;
    }

    alumniFeedbacks.forEach(fb => {
        const row = tableBody.insertRow();
        let actionsHtml = '';
        const feedbackItem = fb;

        actionsHtml += `<button class="btn btn-sm btn-view" onclick="viewAlumniFeedbackDetails('${feedbackItem.feedbackId}')">View</button> `;

        if (feedbackItem.status === 'pending') {
            actionsHtml += `<button class="btn btn-sm btn-edit" onclick="editAlumniFeedback('${feedbackItem.feedbackId}')">Edit</button> `;
            actionsHtml += `<button class="btn btn-sm btn-delete" onclick="promptDeleteAlumniFeedback('${feedbackItem.feedbackId}')">Delete</button>`;
        }

        row.innerHTML = `
            <td>${formatTimestampForDisplay(feedbackItem.submissionDate)}</td>
            <td>${feedbackItem.topic || 'N/A'} ${feedbackItem.isAnonymous ? '<small>(Anonymous)</small>' : ''}</td>
            <td><span class="status-${feedbackItem.status.toLowerCase()}">${feedbackItem.status}</span></td>
            <td>${feedbackItem.roadmap || 'N/A'}</td>
            <td>${actionsHtml}</td>
        `;
    });
}
function viewAlumniFeedbackDetails(feedbackId) {
    const session = getCurrentAlumniSession();
    if (!session) return;

    const allFeedbacks = getData(FEEDBACKS_KEY);
    let feedback = null;
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId &&
           allFeedbacks[i].userType === 'Alumni' &&
           allFeedbacks[i].submitterId === session.alumniId){
            feedback = allFeedbacks[i];
            break;
        }
    }

    if (!feedback) {
        showAlert("Feedback details not found.", "Error");
        return;
    }

    document.getElementById('alumniDetailDate').textContent = formatTimestampForDisplay(feedback.submissionDate);
    document.getElementById('alumniDetailTopic').textContent = feedback.topic || 'N/A';
    document.getElementById('alumniDetailMessage').textContent = feedback.details || '';
    document.getElementById('alumniDetailStatus').textContent = feedback.status;
    document.getElementById('alumniDetailRoadmap').textContent = feedback.roadmap || 'N/A';

    const staffMessageArea = document.getElementById('alumniStaffMessageArea');
    const staffMessageSeparator = document.getElementById('alumniStaffMessageSeparator');
    const staffMessageElement = document.getElementById('alumniDetailStaffMessage');

    if (feedback.staffMessage && staffMessageArea && staffMessageElement && staffMessageSeparator) {
        staffMessageElement.textContent = feedback.staffMessage;
        staffMessageArea.style.display = 'block';
        staffMessageSeparator.style.display = 'block';
    } else if (staffMessageArea && staffMessageSeparator) {
        staffMessageArea.style.display = 'none';
        staffMessageSeparator.style.display = 'none';
    }

    openModal('viewAlumniFeedbackDetailsModal');
}
function editFeedback(feedbackId) {
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const feedback = allFeedbacks.find(fb => fb.feedbackId === feedbackId && fb.status === 'pending'); 

    if (!feedback) {
        showAlert("Feedback not found or can no longer be edited.", "Error");
        displayFeedbackHistory(); 
        return;
    }

    
    document.getElementById('editFeedbackId').value = feedback.feedbackId;
    document.getElementById('editFeedbackTopic').value = feedback.topic;
    document.getElementById('editFeedbackDetails').value = feedback.details;

    openModal('editFeedbackModal');
}
function handleUpdateFeedback(event) {
    event.preventDefault();
    const feedbackId = document.getElementById('editFeedbackId').value;
    const topic = document.getElementById('editFeedbackTopic').value;
    const details = document.getElementById('editFeedbackDetails').value.trim();

    if (!topic || !details) {
        showAlert("Please select a Topic and provide Details.", "Edit Error");
        event.target.reset();
        return;
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    const feedbackIndex = feedbacks.findIndex(fb => fb.feedbackId === feedbackId && fb.status === 'pending');

    if (feedbackIndex === -1) {
        showAlert("Feedback not found or can no longer be edited.", "Error");
        closeModal('editFeedbackModal');
        displayFeedbackHistory(); 
        return;
    }

    const originalIsAnonymous = feedbacks[feedbackIndex].isAnonymous;
    feedbacks[feedbackIndex].topic = topic;
    feedbacks[feedbackIndex].details = details;
    feedbacks[feedbackIndex].isAnonymous = originalIsAnonymous;

    setData(FEEDBACKS_KEY, feedbacks);
    closeModal('editFeedbackModal');
    showSuccess("Feedback updated successfully.", "Update Complete");
    displayFeedbackHistory(); 
}
function promptDeleteStudentFeedback(feedbackId) {
    const session = getCurrentStudentSession();
    if (!session) return; 
    const allFeedbacks = getData(FEEDBACKS_KEY);
    let feedbackToDelete = null;
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId && allFeedbacks[i].studentId === session.studentId && allFeedbacks[i].status === 'pending'){
            feedbackToDelete = allFeedbacks[i];
            break;
        }
    }

    if (!feedbackToDelete) {
        showAlert("Feedback not found or cannot be deleted.", "Error");
        displayFeedbackHistory(); 
        return;
    }

    const message = `Are you sure you want to delete your feedback about "${feedbackToDelete.topic}" submitted on ${feedbackToDelete.submissionDate}? This action cannot be undone.`;

    showConfirm(message, "Confirm Feedback Deletion", () => {
        deleteStudentFeedback(feedbackId);
    });
}
function deleteStudentFeedback(feedbackId) {
    const session = getCurrentStudentSession();
    if (!session) return;

    let feedbacks = getData(FEEDBACKS_KEY);
    let feedbackIndex = -1;
    
    for(let i=0; i < feedbacks.length; i++){
        if (feedbacks[i].feedbackId === feedbackId && feedbacks[i].studentId === session.studentId && feedbacks[i].status === 'pending') {
            feedbackIndex = i;
            break;
        }
    }


    if (feedbackIndex === -1) {
        showAlert("Feedback not found or cannot be deleted (it might have been approved already).", "Error");
        displayFeedbackHistory(); 
        return;
    }
    
    feedbacks.splice(feedbackIndex, 1);
    setData(FEEDBACKS_KEY, feedbacks);
    showSuccess("Your feedback has been deleted.", "Deletion Complete");
    displayFeedbackHistory(); 
}
function editAlumniFeedback(feedbackId) {
    const session = getCurrentAlumniSession();
    if (!session) return;

    const allFeedbacks = getData(FEEDBACKS_KEY);
     
    let feedback = null;
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId && 
        allFeedbacks[i].userType === 'Alumni' &&
        allFeedbacks[i].submitterId === session.alumniId && 
        allFeedbacks[i].status === 'pending'){
            feedback = allFeedbacks[i];
            break;
        }
    }

    if (!feedback) {
        showAlert("Feedback not found or can no longer be edited.", "Error");
        displayAlumniFeedbackHistory(); 
        return;
    }
    
    document.getElementById('editAlumniFeedbackId').value = feedback.feedbackId;
    document.getElementById('editAlumniFeedbackTopic').value = feedback.topic;
    document.getElementById('editAlumniFeedbackDetails').value = feedback.details;

    openModal('editAlumniFeedbackModal'); 
}
function handleUpdateAlumniFeedback(event) {
    event.preventDefault();
    const session = getCurrentAlumniSession();
    if (!session) return;

    const feedbackId = document.getElementById('editAlumniFeedbackId').value;
    const topic = document.getElementById('editAlumniFeedbackTopic').value;
    const details = document.getElementById('editAlumniFeedbackDetails').value.trim();

    if (!topic || !details) {
        showAlert("Please select a Topic and provide Details.", "Edit Error");
        return; 
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    let feedbackIndex = -1;
     
     for(let i=0; i<feedbacks.length; i++){
        if(feedbacks[i].feedbackId === feedbackId && 
            feedbacks[i].userType === 'Alumni' &&
            feedbacks[i].submitterId === session.alumniId && 
            feedbacks[i].status === 'pending'){
            feedbackIndex = i;
            break;
        }
    }

    if (feedbackIndex === -1) {
        showAlert("Feedback not found or can no longer be edited.", "Error");
        closeModal('editAlumniFeedbackModal'); 
        displayAlumniFeedbackHistory(); 
        return;
    }
    
    const originalIsAnonymous = feedbacks[feedbackIndex].isAnonymous;
    
    feedbacks[feedbackIndex].topic = topic;
    feedbacks[feedbackIndex].details = details;
    feedbacks[feedbackIndex].isAnonymous = originalIsAnonymous; 

    setData(FEEDBACKS_KEY, feedbacks);
    closeModal('editAlumniFeedbackModal'); 
    showSuccess("Feedback updated successfully.", "Update Complete");
    displayAlumniFeedbackHistory(); 
}
function promptDeleteAlumniFeedback(feedbackId) {
    const session = getCurrentAlumniSession();
    if (!session) return; 

    const allFeedbacks = getData(FEEDBACKS_KEY);
    let feedbackToDelete = null;
     
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId && 
        allFeedbacks[i].userType === 'Alumni' &&
        allFeedbacks[i].submitterId === session.alumniId && 
        allFeedbacks[i].status === 'pending'){
            feedbackToDelete = allFeedbacks[i];
            break;
        }
    }

    if (!feedbackToDelete) {
        showAlert("Feedback not found or cannot be deleted.", "Error");
        displayAlumniFeedbackHistory(); 
        return;
    }

    const message = `Are you sure you want to delete your feedback about "${feedbackToDelete.topic}" submitted on ${feedbackToDelete.submissionDate}? This action cannot be undone.`;

    showConfirm(message, "Confirm Feedback Deletion", () => {
        deleteAlumniFeedback(feedbackId); 
    });
}
function deleteAlumniFeedback(feedbackId) {
    const session = getCurrentAlumniSession();
    if (!session) return;

    let feedbacks = getData(FEEDBACKS_KEY);
    let feedbackIndex = -1;

     
    for(let i=0; i < feedbacks.length; i++){
        if (feedbacks[i].feedbackId === feedbackId && 
            feedbacks[i].userType === 'Alumni' &&
            feedbacks[i].submitterId === session.alumniId && 
            feedbacks[i].status === 'pending') {
            feedbackIndex = i;
            break;
        }
    }

    if (feedbackIndex === -1) {
        showAlert("Feedback not found or cannot be deleted (it might have been approved already).", "Error");
        displayAlumniFeedbackHistory(); 
        return;
    }

    feedbacks.splice(feedbackIndex, 1);
    setData(FEEDBACKS_KEY, feedbacks);

    showSuccess("Your feedback has been deleted.", "Deletion Complete");
    displayAlumniFeedbackHistory(); 
}

// ==========================================================================
// - 10.) Feedback Management -
// ==========================================================================

function loadAdminFeedbacksPage() {
    const statusFilterDropdown = document.getElementById('feedbackStatusFilter');
    const topicFilterDropdown = document.getElementById('feedbackTopicFilter'); 
    const categoryFilterDropdown = document.getElementById('feedbackCategoryFilter'); 
    const roadmapFilterDropdown = document.getElementById('feedbackRoadmapFilter'); 
    const searchInput = document.getElementById('feedbackSearchInput');
    const userTypeFilterDropdown = document.getElementById('feedbackUserTypeFilter');
    const config = getData(CONFIG_KEY);
    
    const populateSimpleDropdown = (element, items, defaultText) => {
        if (!element) return;
        element.innerHTML = `<option value="all">${defaultText}</option>`; 
        items.forEach(item => {
            if (item.isActive !== false) { 
                element.innerHTML += `<option value="${item.name}">${item.name}</option>`;
            }
        });
    };

    populateSimpleDropdown(topicFilterDropdown, config.topics || [], 'All Topics');
    populateSimpleDropdown(categoryFilterDropdown, config.categories || [], 'All Categories');
    populateSimpleDropdown(roadmapFilterDropdown, config.roadmaps || [], 'All Roadmaps');triggerFeedbackSearch(); 

    [statusFilterDropdown, topicFilterDropdown, categoryFilterDropdown, roadmapFilterDropdown, userTypeFilterDropdown].forEach(dropdown => {
        if (dropdown) {
            dropdown.addEventListener('change', triggerFeedbackSearch);
        }
    });

    const sortOrderDropdown = document.getElementById('feedbackSortOrder');
    if (sortOrderDropdown) {
        sortOrderDropdown.addEventListener('change', triggerFeedbackSearch);
        
    }   

    const approveSelectedBtn = document.getElementById('approveSelectedFeedbacksButton');
    if (approveSelectedBtn) {
        approveSelectedBtn.addEventListener('click', handleApproveSelectedFeedbacks);
    }

    if (searchInput) {
        searchInput.addEventListener('input', triggerFeedbackSearch);
        searchInput.addEventListener('search', triggerFeedbackSearch);
    }

    populateDropdown('assignFeedbackCategory', config.categories, 'name', 'name', 'Select Category');
    populateDropdown('assignFeedbackRoadmap', config.roadmaps, 'name', 'name', 'Select Roadmap Step');

    const assignFeedbackForm = document.getElementById('assignFeedbackForm');
    if (assignFeedbackForm) {
        assignFeedbackForm.addEventListener('submit', handleAssignFeedback);
    }

    const exportButton = document.getElementById('exportFeedbacksButton');
    if (exportButton) {
        exportButton.addEventListener('click', handleExportFeedbacks);
        
    }
}
function displayManageFeedbacks(statusFilter = 'all', userTypeFilter = 'all', topicFilter = 'all', categoryFilter = 'all', roadmapFilter = 'all', searchTerm = '') {
    const tableBody = document.getElementById('manageFeedbacksBody');
    if (!tableBody) return;
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const allStudents = getData(STUDENTS_KEY); 
    const allAlumni = getData(ALUMNI_KEY);   
    const adminSession = getCurrentAdminSession(); 
    const sortOrderElement = document.getElementById('feedbackSortOrder');
    const currentSortOrder = sortOrderElement ? sortOrderElement.value : 'date_desc';
    let filteredFeedbacks = allFeedbacks;
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    if (statusFilter === 'pending' || statusFilter === 'approved') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.status === statusFilter);
    } else { 
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.status === 'pending' || fb.status === 'approved');
    }

    if (userTypeFilter === 'Student') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.userType === 'Student' || !fb.userType); 
    } else if (userTypeFilter === 'Alumni') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.userType === 'Alumni');
    }
    
    if (topicFilter !== 'all') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.topic === topicFilter);
    }

    if (categoryFilter !== 'all') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.category === categoryFilter);
    }

    if (roadmapFilter !== 'all') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.roadmap === roadmapFilter);
    }

    if (lowerSearchTerm) {
        filteredFeedbacks = filteredFeedbacks.filter(fb => {
            let submitterName = '[Submitter Not Found]';
            if (fb.userType === 'Alumni' && fb.submitterId) {
                let foundAlum = null;
                for(let i=0; i<allAlumni.length; i++) { if(allAlumni[i].alumniId === fb.submitterId) { foundAlum = allAlumni[i]; break; } }
                if(foundAlum) submitterName = foundAlum.fullName;
            } else if (fb.studentId) { 
                 let foundStud = null;
                 for(let i=0; i<allStudents.length; i++) { if(allStudents[i].studentId === fb.studentId) { foundStud = allStudents[i]; break; } }
                 if(foundStud) submitterName = foundStud.fullName;
            }

            return (
                (fb.studentId && fb.studentId.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.submitterId && fb.submitterId.toLowerCase().includes(lowerSearchTerm)) ||
                (submitterName && submitterName.toLowerCase().includes(lowerSearchTerm)) || 
                (fb.topic && fb.topic.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.details && fb.details.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.feedbackId && fb.feedbackId.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.category && fb.category.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.roadmap && fb.roadmap.toLowerCase().includes(lowerSearchTerm)) ||
                (fb.userType && fb.userType.toLowerCase().includes(lowerSearchTerm))
            );
        });
    }

    filteredFeedbacks.sort((a, b) => {
        let valA, valB;
        
        const safeGet = (obj, prop, fallback = '') => (obj && obj[prop] != null) ? obj[prop] : fallback;
        const safeGetDate = (obj, prop) => {
            const timestamp = safeGet(obj, prop, null);
            if (!timestamp) return 0; 
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? 0 : date.getTime(); 
        };

        switch (currentSortOrder) {
            case 'date_asc':
                return safeGetDate(a, 'submissionDate') - safeGetDate(b, 'submissionDate');
            case 'date_desc':
            default:
                return safeGetDate(b, 'submissionDate') - safeGetDate(a, 'submissionDate');
            case 'submitter_asc':
                valA = a.isAnonymous ? 'anonymous' : (safeGet(a, 'submitterId', safeGet(a, 'studentId', 'z'))); 
                valB = b.isAnonymous ? 'anonymous' : (safeGet(b, 'submitterId', safeGet(b, 'studentId', 'z')));
                if (valA.toLowerCase() < valB.toLowerCase()) return -1;
                if (valA.toLowerCase() > valB.toLowerCase()) return 1;
                return 0; 
            case 'submitter_desc':
                valA = a.isAnonymous ? 'anonymous' : (safeGet(a, 'submitterId', safeGet(a, 'studentId', 'z')));
                valB = b.isAnonymous ? 'anonymous' : (safeGet(b, 'submitterId', safeGet(b, 'studentId', 'z')));
                if (valA.toLowerCase() > valB.toLowerCase()) return -1;
                if (valA.toLowerCase() < valB.toLowerCase()) return 1;
                return 0;
            case 'topic_asc':
                valA = safeGet(a, 'topic').toLowerCase();
                valB = safeGet(b, 'topic').toLowerCase();
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            case 'topic_desc':
                valA = safeGet(a, 'topic').toLowerCase();
                valB = safeGet(b, 'topic').toLowerCase();
                if (valA > valB) return -1;
                if (valA < valB) return 1;
                return 0;
            case 'status_asc':
                valA = safeGet(a, 'status').toLowerCase();
                valB = safeGet(b, 'status').toLowerCase();
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            case 'status_desc':
                valA = safeGet(a, 'status').toLowerCase();
                valB = safeGet(b, 'status').toLowerCase();
                if (valA > valB) return -1;
                if (valA < valB) return 1;
                return 0;
        }
    });

    tableBody.innerHTML = '';
    if (filteredFeedbacks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="no-data">No feedbacks match the filters/search.</td></tr>`;
        
        const feedbackCountHeadingElementZero = document.getElementById('feedbackCountHeading');
        if (feedbackCountHeadingElementZero) {
            feedbackCountHeadingElementZero.textContent = 'Feedbacks Found: 0';
        }
        return; 
    }

    filteredFeedbacks.forEach(feedbackItem => {
        let submitterId = '';
        let submitterName = '[User Not Found]'; 
        let userTypeLabel = '';
        let displayId = '';
        let displayName = '';
        let rowStyle = '';
        let rowTitle = '';
        
        if (feedbackItem.userType === 'Alumni' && feedbackItem.submitterId) {
            submitterId = feedbackItem.submitterId;
            userTypeLabel = '(Alumni)';
            let foundAlumnus = null;
            for(let i=0; i<allAlumni.length; i++){
                if(allAlumni[i].alumniId === submitterId){
                    foundAlumnus = allAlumni[i];
                    break;
                }
            }
            if (foundAlumnus) { submitterName = foundAlumnus.fullName; }
        } else if (feedbackItem.studentId) { 
            submitterId = feedbackItem.studentId;
            userTypeLabel = '(Student)';
            let foundStudent = null;
            for (let i=0; i<allStudents.length; i++){
                if(allStudents[i].studentId === submitterId){
                    foundStudent = allStudents[i];
                    break;
                }
            }
            if (foundStudent) { submitterName = foundStudent.fullName; }
        } else {
            submitterId = '[Unknown ID]';
            submitterName = '[Unknown Submitter]';
        }
        
        const isAdmin = adminSession && adminSession.role === 'Admin';
        if (feedbackItem.isAnonymous) {
            if (!isAdmin) {
                displayId = 'Anonymous';
                displayName = 'Anonymous';
            } else {
                displayId = `${submitterId} <small>(Anon)</small>`;
                displayName = `${submitterName} <small>(Anon)</small>`;
                rowStyle = 'font-style: italic; background-color: #fff8e1;'; 
                rowTitle = `Submitted anonymously by ${userTypeLabel} ${submitterName} (${submitterId}). Visible only to Admins.`;
            }
        } else {
            displayId = submitterId;
            displayName = submitterName;
        }
        
        const row = tableBody.insertRow();
        if (rowStyle) row.style.cssText = rowStyle;
        if (rowTitle) row.title = rowTitle;

        const currentUserPinnedIds = getPinnedFeedbacksForCurrentUser();
        let isCurrentlyPinned = false;
        for(let k=0; k < currentUserPinnedIds.length; k++){
            if(currentUserPinnedIds[k] === feedbackItem.feedbackId){
                isCurrentlyPinned = true;
                break;
            }
        }

        row.innerHTML = `
            <td><input type="checkbox" class="feedback-row-checkbox" value="${feedbackItem.feedbackId}"></td>
            <td>${formatTimestampForDisplay(feedbackItem.submissionDate)}</td>
            <td>${displayId}</td>
            <td>${displayName}</td>
            <td>${feedbackItem.topic || 'N/A'}</td>
            <td>${feedbackItem.category || 'N/A'}</td>
            <td><span class="status-${feedbackItem.status.toLowerCase()}">${feedbackItem.status}</span></td>
            <td>${feedbackItem.roadmap || 'N/A'}</td>
            <td>
                ${feedbackItem.status === 'pending' ? `<button class="btn btn-sm btn-approve" onclick="promptApproveFeedback('${feedbackItem.feedbackId}')">Approve</button>` : ''}
                <button class="btn btn-sm btn-delete" onclick="promptDeleteFeedback('${feedbackItem.feedbackId}')">Delete</button>
                <button class="btn btn-sm btn-view" onclick="viewFeedbackDetails('${feedbackItem.feedbackId}')">View</button>
                ${feedbackItem.status === 'approved' ? `<button class="btn btn-sm btn-edit" onclick="promptUpdateRoadmap('${feedbackItem.feedbackId}', '${feedbackItem.roadmap || ''}')">Update Roadmap</button>` : ''}

                <button
                    class="btn btn-sm btn-secondary btn-pin"
                    onclick="togglePinFeedback('${feedbackItem.feedbackId}', this)"
                    title="${isCurrentlyPinned ? 'Remove from pinned items' : 'Add to pinned items'}">
                    ${isCurrentlyPinned ? 'Unpin' : 'Pin'}
                </button>
            </td>
        `;
    });
    
    const feedbackCountHeadingElement = document.getElementById('feedbackCountHeading');
    if (feedbackCountHeadingElement) {
        const count = filteredFeedbacks.length;
        feedbackCountHeadingElement.textContent = 'Feedbacks Found: ' + count;
    }
    
    addCheckboxListeners('manageFeedbacksTable', 'selectAllFeedbacksCheckbox', 'feedback-row-checkbox');

    const approveSelectedFeedbacksBtn = document.getElementById('approveSelectedFeedbacksButton');
    if (approveSelectedFeedbacksBtn) {
        approveSelectedFeedbacksBtn.onclick = handleApproveSelectedFeedbacks;
    }
    
    const deleteSelectedFeedbacksBtn = document.getElementById('deleteSelectedFeedbacksButton');
    if (deleteSelectedFeedbacksBtn) {
        deleteSelectedFeedbacksBtn.onclick = handleDeleteSelectedFeedbacks;
    }

    const clearSelectedFeedbacksBtn = document.getElementById('clearSelectedFeedbacksButton');
    if (clearSelectedFeedbacksBtn) {
        clearSelectedFeedbacksBtn.onclick = () => clearSelection('manageFeedbacksTable', 'selectAllFeedbacksCheckbox', 'feedback-row-checkbox');
    }
}
function triggerFeedbackSearch() {
    const searchTerm = document.getElementById('feedbackSearchInput')?.value || '';
    const statusFilter = document.getElementById('feedbackStatusFilter')?.value || 'all';
    const topicFilter = document.getElementById('feedbackTopicFilter')?.value || 'all'; 
    const categoryFilter = document.getElementById('feedbackCategoryFilter')?.value || 'all'; 
    const roadmapFilter = document.getElementById('feedbackRoadmapFilter')?.value || 'all'; 
    const userTypeFilter = document.getElementById('feedbackUserTypeFilter')?.value || 'all';

    displayManageFeedbacks(statusFilter, userTypeFilter, topicFilter, categoryFilter, roadmapFilter, searchTerm);
}
function viewFeedbackDetails(feedbackId) {
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const allStudents = getData(STUDENTS_KEY); 
    const allAlumni = getData(ALUMNI_KEY);   
    const adminSession = getCurrentAdminSession(); 
    
    let feedback = null;
    for(let i = 0; i < allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId){
            feedback = allFeedbacks[i];
            break;
        }
    }
    
    if (!feedback) {
        showAlert("Feedback details not found.", "Error");
        return; 
    }

    let submitterId = '';
    let submitterName = '[User Not Found]'; 
    let userTypeLabel = '';
    let displaySubmitterInfo = '';
    
    if (feedback.userType === 'Alumni' && feedback.submitterId) {
        submitterId = feedback.submitterId;
        userTypeLabel = 'Alumni';
        
        let foundAlumnus = null;
        for (let i = 0; i < allAlumni.length; i++) {
            if (allAlumni[i].alumniId === submitterId) {
                foundAlumnus = allAlumni[i];
                break;
            }
        }
        
        if (foundAlumnus) {
            submitterName = foundAlumnus.fullName;
        }
    }
    
    else if (feedback.studentId) {
        submitterId = feedback.studentId;
        userTypeLabel = 'Student';
        
        let foundStudent = null;
        for (let i = 0; i < allStudents.length; i++) {
            if (allStudents[i].studentId === submitterId) {
                foundStudent = allStudents[i];
                break;
            }
        }
        
        if (foundStudent) {
            submitterName = foundStudent.fullName;
        }
    }
    
    else {
        submitterId = '[Unknown ID]';
        submitterName = '[Unknown Submitter]';
        userTypeLabel = 'Unknown';
    }
    
    const isAdmin = adminSession && adminSession.role === 'Admin'; 
    if (feedback.isAnonymous) { 
        if (!isAdmin) {
            displaySubmitterInfo = 'Anonymous (Hidden by User)';
        } else {
            displaySubmitterInfo = `${submitterName} (${submitterId}) <span>(Submitted Anonymously)</span>`;
        }
    } else { 
        displaySubmitterInfo = `${submitterName} (${submitterId})`;
    }
    
    const detailSubmitterElement = document.getElementById('detailStudentId'); 
    const detailDateElement = document.getElementById('detailDate');
    const detailTopicElement = document.getElementById('detailTopic');
    const detailCategoryElement = document.getElementById('detailCategory');
    const detailMessageElement = document.getElementById('detailMessage');
    const detailStatusElement = document.getElementById('detailStatus');
    const detailRoadmapElement = document.getElementById('detailRoadmap');
    const detailsContentElement = document.getElementById('feedbackDetailsContent'); 

    if (detailSubmitterElement) detailSubmitterElement.innerHTML = displaySubmitterInfo; 
    if (detailDateElement) detailDateElement.textContent = feedback.submissionDate || 'N/A';
    if (detailTopicElement) detailTopicElement.textContent = feedback.topic || 'N/A';
    if (detailCategoryElement) detailCategoryElement.textContent = feedback.category || 'N/A';
    if (detailMessageElement) detailMessageElement.textContent = feedback.details || ''; 
    if (detailStatusElement) detailStatusElement.textContent = feedback.status || 'N/A';
    if (detailRoadmapElement) detailRoadmapElement.textContent = feedback.roadmap || 'N/A';
    if (detailsContentElement) {
        detailsContentElement.style.fontStyle = ''; 
        detailsContentElement.style.backgroundColor = ''; 
        detailsContentElement.title = ''; 

        
        if (feedback.isAnonymous && isAdmin) {
            detailsContentElement.style.fontStyle = 'italic';
            detailsContentElement.style.backgroundColor = '#fff8e1'; 
            detailsContentElement.title = `This feedback was submitted anonymously. Submitter info visible only to Admins.`;
        }
    }

    openModal('viewFeedbackDetailsModal');
}
function promptApproveFeedback(feedbackId) {
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const feedback = allFeedbacks.find(fb => fb.feedbackId === feedbackId && fb.status === 'pending');

    if (!feedback) {
        showAlert("Feedback not found or already processed.", "Error");
        displayManageFeedbacks(document.getElementById('feedbackStatusFilter')?.value || 'all');
        return;
    }

    document.getElementById('assignFeedbackId').value = feedbackId;
    document.getElementById('assignFeedbackCategory').value = ''; 
    document.getElementById('assignFeedbackRoadmap').value = '';
    openModal('assignFeedbackModal');
}
function handleAssignFeedback(event) {
    event.preventDefault();
    const feedbackId = document.getElementById('assignFeedbackId').value;
    const category = document.getElementById('assignFeedbackCategory').value;
    const roadmap = document.getElementById('assignFeedbackRoadmap').value;

    if (!category || !roadmap) {
        showAlert("Please select both a Category and a Roadmap step.", "Approval Error"); 
        return;
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    const feedbackIndex = feedbacks.findIndex(fb => fb.feedbackId === feedbackId && fb.status === 'pending');

    if (feedbackIndex === -1) {
        showAlert("Feedback not found or already processed.", "Error");
        closeModal('assignFeedbackModal');
        displayManageFeedbacks(document.getElementById('feedbackStatusFilter')?.value || 'all');
        return;
    }

    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;
    
    feedbacks[feedbackIndex].status = 'approved';
    feedbacks[feedbackIndex].category = category; 
    feedbacks[feedbackIndex].roadmap = roadmap;
    feedbacks[feedbackIndex].moderatorAssigned = adminSession.username; 
    feedbacks[feedbackIndex].approvalDate = getCurrentTimestamp(); 

    setData(FEEDBACKS_KEY, feedbacks);
    logAction(adminSession.username, 'Feedback Approve', `Approved feedback ID '${feedbackId}'. Assigned Category: ${category}, Roadmap: ${roadmap}.`);
    closeModal('assignFeedbackModal');
    showSuccess("Feedback approved and assigned successfully.", "Approval Complete");
    displayManageFeedbacks(document.getElementById('feedbackStatusFilter')?.value || 'all'); 
    updateDashboardStats(); 
}
function promptUpdateRoadmap(feedbackId, currentRoadmap) {
    const allFeedbacks = getData(FEEDBACKS_KEY);
    
    let feedback = null;
    for(let i=0; i<allFeedbacks.length; i++){
        if(allFeedbacks[i].feedbackId === feedbackId && allFeedbacks[i].status === 'approved'){
            feedback = allFeedbacks[i];
            break;
        }
    }

    if (!feedback) {
        showAlert("Approved feedback not found.", "Error");
         
         if(typeof displayManageFeedbacks === 'function'){
             
             const statusFilterValue = document.getElementById('feedbackStatusFilter')?.value || 'all';
             displayManageFeedbacks(statusFilterValue);
         }
        return; 
    }
    
    const config = getData(CONFIG_KEY);
    let optionsHTML = '';
    (config.roadmaps || []).forEach(r => { 
        
        if (r.isActive !== false) {
            
            const selectedAttr = (r.name === currentRoadmap) ? 'selected' : '';
            optionsHTML += `<option value="${r.name}" ${selectedAttr}>${r.name}</option>`;
        }
    });

    const modal = document.getElementById('genericModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalActions = document.getElementById('modalActions');
    const modalPromptArea = document.getElementById('modalPromptInputArea');
    const modalPromptLabel = document.getElementById('modalPromptLabel');

    if (modal && modalTitle && modalMessage && modalActions && modalPromptArea && modalPromptLabel) {
        modalTitle.textContent = 'Update Feedback Roadmap & Add Message'; 
        modalMessage.textContent = `Select the new roadmap status for feedback ID '${feedbackId}' and optionally add a message for the submitter.`; 
        modalPromptArea.style.display = 'block'; 

        const existingDynamicContent = modalPromptArea.querySelector('#dynamicPromptContent');
        if (existingDynamicContent) {
            existingDynamicContent.remove();
        }

        const container = document.createElement('div');
        container.id = 'dynamicPromptContent'; 
        
        container.innerHTML += `
            <div class="form__group modal-prompt-group">
                <label for="roadmapUpdateSelect" class="form__label">New Roadmap Status:</label>
                <select id="roadmapUpdateSelect" class="form__select">
                    ${optionsHTML}
                </select>
            </div>
        `;
        
        const existingStaffMessage = feedback.staffMessage || '';
        container.innerHTML += `
            <div class="form__group modal-prompt-group">
                <label for="staffMessageInput" class="form__label">Optional Message to Submitter:</label>
                <textarea id="staffMessageInput" class="form__textarea" rows="3" placeholder="(This message will be visible to the feedback submitter)">${existingStaffMessage}</textarea>
            </div>
        `;

        modalPromptLabel.style.display = 'none';
        const originalInput = document.getElementById('modalPromptInput');
        if (originalInput) originalInput.style.display = 'none';

        modalPromptArea.appendChild(container);

        modalActions.innerHTML = ''; 
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Update Status';
        confirmButton.className = 'btn btn-primary';
        confirmButton.onclick = function() {
            const selectElement = document.getElementById('roadmapUpdateSelect');
            const messageInput = document.getElementById('staffMessageInput');
            const newRoadmap = selectElement ? selectElement.value : null; 
            const staffMessage = messageInput ? messageInput.value.trim() : ''; 

            if (!newRoadmap) {
                showAlert("Please select a roadmap status.", "Error");
                return; 
            }

            container.remove();
            modalPromptLabel.style.display = ''; 
            if (originalInput) originalInput.style.display = ''; 
            modalPromptArea.style.display = 'none'; 

            closeModal('genericModal'); 
            updateFeedbackRoadmap(feedbackId, newRoadmap, staffMessage); 
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.onclick = function() {
            
            container.remove();
            modalPromptLabel.style.display = '';
             if (originalInput) originalInput.style.display = '';
            modalPromptArea.style.display = 'none';
            closeModal('genericModal');
        };

        modalActions.appendChild(cancelButton); 
        modalActions.appendChild(confirmButton); 

        openModal('genericModal'); 

    } else {
        const newRoadmapFallback = prompt(`Enter new roadmap status for feedback ID ${feedbackId} (Current: ${currentRoadmap}):`);
        if (newRoadmapFallback && newRoadmapFallback.trim() !== '') {
            
            const isValidRoadmap = (config.roadmaps || []).some(r => r.name === newRoadmapFallback.trim() && r.isActive !== false);
            if (isValidRoadmap) {
                updateFeedbackRoadmap(feedbackId, newRoadmapFallback.trim(), ''); 
            } else {
                showAlert(`"${newRoadmapFallback}" is not a valid roadmap status.`, "Error");
            }
        }
    }
}
function updateFeedbackRoadmap(feedbackId, newRoadmap, staffMessage = '') { 
    let feedbacks = getData(FEEDBACKS_KEY);
    
    let feedbackIndex = -1;
    for(let i = 0; i < feedbacks.length; i++) {
        if (feedbacks[i].feedbackId === feedbackId && feedbacks[i].status === 'approved') {
            feedbackIndex = i;
            break;
        }
    }

    if (feedbackIndex === -1) {
        showAlert("Approved feedback not found.", "Error");
        
        if(typeof displayManageFeedbacks === 'function'){
            const statusFilterValue = document.getElementById('feedbackStatusFilter')?.value || 'all';
            displayManageFeedbacks(statusFilterValue);
        }
        return; 
    }

    const adminSession = getCurrentAdminSession();
    if (!adminSession) {
        showAlert("Authentication error. Please log in.", "Error");
        return;
    }

    const oldRoadmap = feedbacks[feedbackIndex].roadmap || 'N/A'; 
    const oldMessage = feedbacks[feedbackIndex].staffMessage || ''; 

    if (oldRoadmap === newRoadmap && oldMessage === staffMessage) {
        showAlert("No changes detected in roadmap status or message.", "Info");
        return; 
    }
    
    feedbacks[feedbackIndex].roadmap = newRoadmap;
    feedbacks[feedbackIndex].staffMessage = staffMessage; 
    feedbacks[feedbackIndex].lastStatusUpdate = getCurrentTimestamp();
    
    setData(FEEDBACKS_KEY, feedbacks);

    let logDetails = `Updated feedback ID '${feedbackId}'. Roadmap: '${oldRoadmap}' -> '${newRoadmap}'.`;
    
    if (staffMessage && !oldMessage) {
        logDetails += ` Added staff message.`;
    } else if (!staffMessage && oldMessage) {
        logDetails += ` Cleared staff message.`;
    } else if (staffMessage && oldMessage && staffMessage !== oldMessage) {
        logDetails += ` Updated staff message.`;
    } 

    logAction(adminSession.username, 'Roadmap/Message Update', logDetails);
    showSuccess("Feedback roadmap status and message updated successfully.", "Update Complete");
    
    if(typeof displayManageFeedbacks === 'function'){
        const statusFilterValue = document.getElementById('feedbackStatusFilter')?.value || 'all';
        displayManageFeedbacks(statusFilterValue);
    }
}
function handleApproveSelectedFeedbacks() {
    const table = document.getElementById('manageFeedbacksTable');
    if (!table) return;

    const selectedCheckboxes = table.querySelectorAll('.feedback-row-checkbox:checked');
    const idsToApprove = []; 

    for (let i = 0; i < selectedCheckboxes.length; i++) {
        const checkbox = selectedCheckboxes[i];
        const row = checkbox.closest('tr'); 
        if (!row) continue; 

        const statusElement = row.querySelector('td:nth-child(7) span');

        if (statusElement) {
            const statusText = statusElement.textContent.trim().toLowerCase();
            
            if (statusText === 'pending') {
            idsToApprove.push(checkbox.value); 
            }
        }
    }
    
    if (idsToApprove.length === 0) {
        showAlert("Please select at least one 'Pending' feedback item to approve.", "No Pending Selection");
        return;
    }

    if (idsToApprove.length === 1) {
        promptApproveFeedback(idsToApprove[0]);
        clearSelection('manageFeedbacksTable', 'selectAllFeedbacksCheckbox', 'feedback-row-checkbox');
        return; 
    }

    const message = `You are about to approve ${idsToApprove.length} feedback item(s).\n\nPlease select a Category and initial Roadmap status to apply to ALL selected items.`;
    const modalTitle = document.getElementById('assignFeedbackModal').querySelector('h3');
    const modalSubmitButton = document.getElementById('assignFeedbackModal').querySelector('button[type="submit"]');
    const modalHiddenInput = document.getElementById('assignFeedbackId');
    const modalElement = document.getElementById('assignFeedbackModal'); 

    if (!modalTitle || !modalSubmitButton || !modalHiddenInput || !modalElement) {
        showAlert("Error: Could not load approval form.", "Error");
        return;
    }
    modalElement.setAttribute('data-batch-ids', JSON.stringify(idsToApprove));
    modalTitle.textContent = 'Batch Approve Feedbacks';
    modalSubmitButton.textContent = 'Approve Selected Items';
    modalHiddenInput.value = ''; 
    
    document.getElementById('assignFeedbackCategory').value = '';
    document.getElementById('assignFeedbackRoadmap').value = '';
    modalSubmitButton.onclick = function(event) {
        event.preventDefault(); 

        const category = document.getElementById('assignFeedbackCategory').value;
        const roadmap = document.getElementById('assignFeedbackRoadmap').value;

        if (!category || !roadmap) {
            showAlert("Please select both a Category and a Roadmap step for the batch.", "Input Required");
            return;
        }

        const batchIdsString = modalElement.getAttribute('data-batch-ids');
        const batchIds = JSON.parse(batchIdsString || '[]'); 

        if (batchIds.length === 0) {
            showAlert("Error retrieving selected feedback IDs.", "Error");
            closeModal('assignFeedbackModal');
            resetAssignModalToDefault(); 
            return;
        }

        closeModal('assignFeedbackModal');
        executeBatchApprove(batchIds, category, roadmap);
        resetAssignModalToDefault();
    };
    openModal('assignFeedbackModal');
}
function executeBatchApprove(ids, category, roadmap) {
    let feedbacks = getData(FEEDBACKS_KEY);
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return; 

    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    let alreadyProcessedCount = 0;

    for (let i = 0; i < ids.length; i++) {
        const feedbackId = ids[i];
        let feedbackIndex = -1;
        
        for(let j=0; j<feedbacks.length; j++){
            if(feedbacks[j].feedbackId === feedbackId){
                feedbackIndex = j;
                break;
            }
        }

        if (feedbackIndex === -1) {
            notFoundCount++;
            continue; 
        }

        if (feedbacks[feedbackIndex].status !== 'pending') {
            alreadyProcessedCount++;
            continue; 
        }

        feedbacks[feedbackIndex].status = 'approved';
        feedbacks[feedbackIndex].category = category; 
        feedbacks[feedbackIndex].roadmap = roadmap;
        feedbacks[feedbackIndex].moderatorAssigned = adminSession.username; 
        feedbacks[feedbackIndex].approvalDate = getCurrentTimestamp(); 
        successCount++;
        
    }
    
    setData(FEEDBACKS_KEY, feedbacks);
    logAction(adminSession.username, 'Feedback Batch Approve', `Batch approved ${successCount} feedback item(s). Assigned Category: ${category}, Roadmap: ${roadmap}. IDs: [${ids.join(', ')}].`);
    
    let message = `Batch approval process complete.\nSuccessfully approved: ${successCount}`;
    if (alreadyProcessedCount > 0) message += `\nSkipped (already processed): ${alreadyProcessedCount}`;
    if (notFoundCount > 0) message += `\nSkipped (not found): ${notFoundCount}`;
    if (errorCount > 0) message += `\nFailed (errors): ${errorCount}`; 

    showAlert(message, "Batch Approval Results");
    displayManageFeedbacks(); 
    updateDashboardStats(); 
}
function resetAssignModalToDefault() {
    const modalTitle = document.getElementById('assignFeedbackModal').querySelector('h3');
    const modalSubmitButton = document.getElementById('assignFeedbackModal').querySelector('button[type="submit"]');
    const modalElement = document.getElementById('assignFeedbackModal');
    if(modalTitle) modalTitle.textContent = 'Approve Feedback & Assign';
    if(modalSubmitButton) modalSubmitButton.textContent = 'Approve & Assign';
    if(modalElement) modalElement.removeAttribute('data-batch-ids');
     
     
    const assignForm = document.getElementById('assignFeedbackForm');
    if(assignForm) {
         
        if(modalSubmitButton) modalSubmitButton.onclick = null; 
    }
}
function promptDeleteFeedback(feedbackId) {
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const feedback = allFeedbacks.find(fb => fb.feedbackId === feedbackId); 

    if (!feedback) {
        showAlert("Feedback not found.", "Error");
        displayManageFeedbacks(document.getElementById('feedbackStatusFilter')?.value || 'all');
        return;
    }

    showPrompt(
        `Are you sure you want to delete feedback ID '${feedbackId}'? Please provide a reason for deletion.`,
        'Reason for Deletion:',
        'Confirm Deletion',
        (reason) => { 
            if (!reason) {
                showAlert("Deletion reason is required.", "Error");
                
                
                return;
            }
            deleteFeedback(feedbackId, reason);
        },
        () => {}
    );
}
function deleteFeedback(feedbackId, reason) {
    let feedbacks = getData(FEEDBACKS_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    const adminSession = getCurrentAdminSession(); 
    if (!adminSession) return; 

    const feedbackIndex = feedbacks.findIndex(fb => fb.feedbackId === feedbackId);
    if (feedbackIndex === -1) {  return; }

    const feedbackToDelete = feedbacks[feedbackIndex];
    const deletedByRole = adminSession.role; 
    feedbackToDelete.deletedByModerator = (deletedByRole === 'Moderator');
    feedbackToDelete.adminReviewed = (deletedByRole === 'Admin');
    feedbackToDelete.deletedByUsername = adminSession.username; 
    feedbackToDelete.deletionDate = getCurrentTimestamp();
    feedbackToDelete.deletionReason = reason;

    recycleBin.deletedFeedbacks.unshift(feedbackToDelete);
    feedbacks.splice(feedbackIndex, 1);

    setData(FEEDBACKS_KEY, feedbacks);
    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, 'Feedback Delete', `Deleted feedback ID '${feedbackId}'. Reason: ${reason}`);
    showSuccess("Feedback moved to Recycle Bin.", "Deletion Complete");
    displayManageFeedbacks(document.getElementById('feedbackStatusFilter')?.value || 'all');
    updateDashboardStats();
}
function handleDeleteSelectedFeedbacks() {
    const table = document.getElementById('manageFeedbacksTable');
    if (!table) return;

    const selectedCheckboxes = table.querySelectorAll('.feedback-row-checkbox:checked');
    const idsToDelete = [];
    for (let i = 0; i < selectedCheckboxes.length; i++) {
        idsToDelete.push(selectedCheckboxes[i].value);
    }

    if (idsToDelete.length === 0) {
        showAlert("Please select at least one feedback item to delete.", "No Selection");
        return;
    }

    if (idsToDelete.length === 1) {
        promptDeleteFeedback(idsToDelete[0]);
        clearSelection('manageFeedbacksTable', 'selectAllFeedbacksCheckbox', 'feedback-row-checkbox');
        return;
    }

    const message = `Are you sure you want to delete the selected ${idsToDelete.length} feedback item(s)? This will move them to the recycle bin. Please provide a reason for this batch deletion.`;

    showPrompt(
        message,
        'Reason for Batch Deletion:',
        'Confirm Batch Deletion',
        (reason) => {
            if (!reason) {
                showAlert("Deletion reason is required for batch delete.", "Error");
                return;
            }
            
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < idsToDelete.length; i++) {
                const deleted = executeDeleteFeedback(idsToDelete[i], reason);
                if (deleted) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            if (errorCount > 0) {
                showAlert(`Successfully deleted ${successCount} feedback(s). Failed to delete ${errorCount}. Please check logs or refresh.`, "Partial Deletion");
            } else {
                showSuccess(`Successfully deleted ${successCount} feedback item(s).`, "Batch Deletion Complete");
            }

            displayManageFeedbacks();
            updateDashboardStats();

        },
        () => {
            
        }
    );
}
function executeDeleteFeedback(feedbackId, reason) {
    let feedbacks = getData(FEEDBACKS_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return false;

    const feedbackIndex = feedbacks.findIndex(fb => fb.feedbackId === feedbackId);
    if (feedbackIndex === -1) {
        return false;
    }

    const feedbackToDelete = feedbacks[feedbackIndex];

    const deletedByRole = adminSession.role;
    feedbackToDelete.deletedByModerator = (deletedByRole === 'Moderator');
    feedbackToDelete.adminReviewed = (deletedByRole === 'Admin');
    feedbackToDelete.deletedByUsername = adminSession.username;
    feedbackToDelete.deletionDate = getCurrentTimestamp();
    feedbackToDelete.deletionReason = reason;

    recycleBin.deletedFeedbacks.unshift(feedbackToDelete);
    feedbacks.splice(feedbackIndex, 1);

    setData(FEEDBACKS_KEY, feedbacks);
    setData(RECYCLE_BIN_KEY, recycleBin);

    logAction(adminSession.username, 'Feedback Batch Delete', `Batch deleted feedback ID '${feedbackId}'. Reason: ${reason}`);
    return true;
}
function loadAdminFeedbacksRecyclePage() {
    displayRecycleFeedbacks('');
    const searchInput = document.getElementById('recycleFeedbackSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', triggerRecycleFeedbackSearch);
        searchInput.addEventListener('search', triggerRecycleFeedbackSearch);
    }
}
function displayRecycleFeedbacks(searchTerm = '') {
    const tableBody = document.getElementById('recycleFeedbackBody');
    if (!tableBody) {
        return;
    }

    const recycleBin = getData(RECYCLE_BIN_KEY);
    let deletedFeedbacks = recycleBin.deletedFeedbacks || [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (lowerSearchTerm) {
        deletedFeedbacks = deletedFeedbacks.filter(fb =>
            (fb.studentId && fb.studentId.toLowerCase().includes(lowerSearchTerm)) ||
            (fb.deletedByUsername && fb.deletedByUsername.toLowerCase().includes(lowerSearchTerm)) ||
            (fb.deletionReason && fb.deletionReason.toLowerCase().includes(lowerSearchTerm)) ||
            (fb.feedbackId && fb.feedbackId.toLowerCase().includes(lowerSearchTerm)) || 
            (fb.topic && fb.topic.toLowerCase().includes(lowerSearchTerm)) || 
            (fb.details && fb.details.toLowerCase().includes(lowerSearchTerm)) 
        );
    }

    deletedFeedbacks.sort((a, b) => new Date(b.deletionDate) - new Date(a.deletionDate));

    
    tableBody.innerHTML = '';
    if (deletedFeedbacks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="no-data">Feedback recycle bin is empty or search returned no results.</td></tr>`; 
        return;
    }

    const adminSession = getCurrentAdminSession();
    const isAdmin = adminSession && adminSession.role === 'Admin';

    deletedFeedbacks.forEach(fb => {
        const row = tableBody.insertRow();
        let actionButtonsHTML = '';
        const viewButtonHTML = `<button class="btn btn-sm btn-view" onclick="viewDeletedFeedbackDetails('${fb.feedbackId}')">View</button>`; 
        const wasDeletedByMod = fb.deletedByModerator === true;
        const needsReview = wasDeletedByMod && fb.adminReviewed !== true; 

        if (isAdmin) {
            
            if (needsReview) {
                actionButtonsHTML += `<button class="btn btn-sm btn-info" onclick="markDeletionAsReviewed('${fb.feedbackId}', 'feedback')">Mark Reviewed</button> `;
            }
            actionButtonsHTML += `<button class="btn btn-sm btn-restore" onclick="promptRestoreFeedback('${fb.feedbackId}')">Restore</button> `;
            actionButtonsHTML += `<button class="btn btn-sm btn-delete-perm" onclick="promptPermanentDeleteFeedback('${fb.feedbackId}')">Delete Permanently</button>`;
        } else { 
            if (wasDeletedByMod) {
                if (fb.adminReviewed === true) {
                    
                    actionButtonsHTML += `<button class="btn btn-sm btn-restore" onclick="promptRestoreFeedback('${fb.feedbackId}')">Restore</button> `;
                    actionButtonsHTML += `<button class="btn btn-sm btn-delete-perm" onclick="promptPermanentDeleteFeedback('${fb.feedbackId}')">Delete Permanently</button>`;
                } else {
                    actionButtonsHTML = '<span class="text-muted" title="Administrator needs to review this deletion first.">Admin Review Pending</span>';
                }
            } else {
                actionButtonsHTML = '<span class="text-muted">Action by Admin Only</span>';
            }
        }
        
        row.innerHTML = `
            <td>${formatTimestampForDisplay(fb.submissionDate)}</td>
            <td>${fb.studentId || fb.submitterId || 'N/A'}</td> 
            <td>${fb.deletedByUsername || 'N/A'}</td>
            <td>${fb.deletionReason || 'N/A'}</td>
            <td>${formatTimestampForDisplay(fb.deletionDate)}</td>
            <td>${viewButtonHTML} ${actionButtonsHTML}</td> 
        `;

        
        row.style.backgroundColor = ''; 
        row.title = ''; 
        if (isAdmin && needsReview) {
            row.style.backgroundColor = 'rgba(255, 235, 180, 0.3)'; 
            row.title = "This deletion by a moderator needs review.";
        }
    });
}
function triggerRecycleFeedbackSearch() {
    const searchTerm = document.getElementById('recycleFeedbackSearchInput')?.value || '';
    displayRecycleFeedbacks(searchTerm);
}
function viewDeletedFeedbackDetails(deletedFeedbackId) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const feedback = recycleBin.deletedFeedbacks.find(fb => fb.feedbackId === deletedFeedbackId);

    if (!feedback) {
        showAlert("Deleted feedback details not found.", "Error");
        return;
    }

    document.getElementById('deletedDetailStudentId').textContent = feedback.studentId || 'N/A';
    document.getElementById('deletedDetailOrigDate').textContent = feedback.submissionDate || 'N/A';
    document.getElementById('deletedDetailTopic').textContent = feedback.topic || 'N/A';
    document.getElementById('deletedDetailCategory').textContent = feedback.category || 'N/A';
    document.getElementById('deletedDetailMessage').textContent = feedback.details || '';
    document.getElementById('deletedDetailDateDeleted').textContent = feedback.deletionDate || 'N/A';
    document.getElementById('deletedDetailDeletedBy').textContent = feedback.deletedBy || 'N/A';
    document.getElementById('deletedDetailReason').textContent = feedback.deletionReason || 'N/A';

    openModal('viewDeletedFeedbackDetailsModal');
}
function promptRestoreFeedback(deletedFeedbackId) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const feedback = recycleBin.deletedFeedbacks.find(fb => fb.feedbackId === deletedFeedbackId);

    if (!feedback) {
        showAlert("Deleted feedback not found.", "Error");
        displayRecycleFeedbacks();
        return;
    }

    showConfirm(
        `Are you sure you want to restore feedback ID '${deletedFeedbackId}'? It will be returned to its previous status (${feedback.status}).`,
        'Confirm Restore',
        () => restoreFeedback(deletedFeedbackId)
    );
}
function restoreFeedback(deletedFeedbackId) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return; 

    const recycleBin = getData(RECYCLE_BIN_KEY); 
    const feedbackIndex = recycleBin.deletedFeedbacks.findIndex(fb => fb.feedbackId === deletedFeedbackId);
    if (feedbackIndex === -1) { showAlert("Deleted feedback not found.", "Error"); return; } 
    const feedbackToRestore = recycleBin.deletedFeedbacks[feedbackIndex];

    if (adminSession.role === 'Moderator') {
        
        if (feedbackToRestore.deletedByModerator !== true || feedbackToRestore.adminReviewed !== true) {
            showAlert("Permission Denied. Restore requires Admin review or was deleted by Admin.", "Error");
            return; 
        }
    }

    let feedbacks = getData(FEEDBACKS_KEY);
    if (feedbackIndex === -1) {
        showAlert("Deleted feedback not found.", "Error");
        return;
    }

    const originalStatus = feedbackToRestore.status; 
    delete feedbackToRestore.deletionDate;
    delete feedbackToRestore.deletedBy;
    delete feedbackToRestore.deletionReason;

    feedbacks.unshift(feedbackToRestore); 
    recycleBin.deletedFeedbacks.splice(feedbackIndex, 1);

    setData(FEEDBACKS_KEY, feedbacks);
    setData(RECYCLE_BIN_KEY, recycleBin);

    logAction(adminSession.username, 'Feedback Restore', `Restored feedback ID '${deletedFeedbackId}' to status '${originalStatus}'.`);
    showSuccess("Feedback restored successfully.", "Restore Complete");
    displayRecycleFeedbacks(); 
    updateDashboardStats(); 
}
function promptPermanentDeleteFeedback(deletedFeedbackId) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const feedback = recycleBin.deletedFeedbacks.find(fb => fb.feedbackId === deletedFeedbackId);

    if (!feedback) {
        showAlert("Deleted feedback not found.", "Error");
        displayRecycleFeedbacks();
        return;
    }

    showConfirm(
        `WARNING: This action is irreversible! Are you sure you want to permanently delete feedback ID '${deletedFeedbackId}'?`,
        'Confirm Permanent Deletion',
        () => permanentDeleteFeedback(deletedFeedbackId),
        null
    );
}
function permanentDeleteFeedback(deletedFeedbackId) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return; 

    const recycleBin = getData(RECYCLE_BIN_KEY); 
    const feedbackIndex = recycleBin.deletedFeedbacks.findIndex(fb => fb.feedbackId === deletedFeedbackId);
    if (feedbackIndex === -1) { showAlert("Deleted feedback not found.", "Error"); return; }

    if (adminSession.role === 'Moderator') {
        
        if (feedbackToDelete.deletedByModerator !== true || feedbackToDelete.adminReviewed !== true) {
            showAlert("Permission Denied. Permanent deletion requires Admin review or was deleted by Admin.", "Error");
            return; 
        }
    }

    if (feedbackIndex === -1) {
        showAlert("Deleted feedback not found.", "Error");
        return;
    }

    const feedbackToDelete = recycleBin.deletedFeedbacks[feedbackIndex];
    recycleBin.deletedFeedbacks.splice(feedbackIndex, 1);
    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, 'Feedback Permanent Delete', `Permanently deleted feedback ID '${deletedFeedbackId}'.`);
    showSuccess("Feedback permanently deleted.", "Deletion Complete");
    displayRecycleFeedbacks(); 
}
function displayPinnedFeedbacks() {
    const tableBody = document.getElementById('pinnedFeedbacksBody');
    const session = getCurrentAdminSession(); 
    if (!tableBody || !session || !session.username) {
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="no-data">Error loading pinned items.</td></tr>`;
        return;
    }

    const username = session.username; 
    let allPinnedData = getData(PINNED_FEEDBACKS_KEY) || {}; 
    const pinnedIds = allPinnedData[username] || [];
    const allFeedbacks = getData(FEEDBACKS_KEY);
    const allStudents = getData(STUDENTS_KEY);
    const allAlumni = getData(ALUMNI_KEY);

    tableBody.innerHTML = ''; 

    if (pinnedIds.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="no-data">You have not pinned any feedbacks yet.</td></tr>`;
        return;
    }

    let pinnedFeedbacksData = [];
    let validPinnedIds = []; 
    let orphansFound = false; 

    for (let i = 0; i < pinnedIds.length; i++) {
        const pinnedId = pinnedIds[i];
        let foundFeedback = null;
        for (let j = 0; j < allFeedbacks.length; j++) {
            
            if (allFeedbacks[j].feedbackId === pinnedId && (allFeedbacks[j].status === 'pending' || allFeedbacks[j].status === 'approved')) {
                foundFeedback = allFeedbacks[j];
                break;
            }
        }
        
        if (foundFeedback) {
            pinnedFeedbacksData.push(foundFeedback);
            validPinnedIds.push(pinnedId); 
        } else {
            orphansFound = true; 
        }
    }

    if (orphansFound) {
        allPinnedData[username] = validPinnedIds; 
        setData(PINNED_FEEDBACKS_KEY, allPinnedData); 
    }
    
    pinnedFeedbacksData.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    if (pinnedFeedbacksData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="no-data">No active pinned feedbacks found (previously pinned items may have been deleted).</td></tr>`;
        return;
    }

    for(let i=0; i < pinnedFeedbacksData.length; i++) {
        const feedbackItem = pinnedFeedbacksData[i];
        const row = tableBody.insertRow();

        let submitterId = feedbackItem.submitterId || feedbackItem.studentId || 'N/A';
        let submitterName = '[User Not Found]';
        if (feedbackItem.userType === 'Alumni' && feedbackItem.submitterId) { 
            let foundAlum = null; for(let k=0; k<allAlumni.length; k++){ if(allAlumni[k].alumniId === feedbackItem.submitterId) { foundAlum = allAlumni[k]; break;}} if(foundAlum) submitterName = foundAlum.fullName;
        } else if (feedbackItem.studentId) { 
            let foundStud = null; for(let k=0; k<allStudents.length; k++){ if(allStudents[k].studentId === feedbackItem.studentId) { foundStud = allStudents[k]; break;}} if(foundStud) submitterName = foundStud.fullName;
        }
        
        const isAdmin = session && session.role === 'Admin';
        let displayId = submitterId;
        let displayName = submitterName;
        if (feedbackItem.isAnonymous) {
            if (!isAdmin) { displayId = 'Anonymous'; displayName = 'Anonymous'; }
            else { displayId = `${submitterId} <small>(Anon)</small>`; displayName = `${submitterName} <small>(Anon)</small>`; }
        }

        const actionsHtml = `
            <button class="btn btn-sm btn-view" onclick="viewFeedbackDetails('${feedbackItem.feedbackId}')">View</button>
            <button class="btn btn-sm btn-secondary btn-pin" onclick="togglePinFeedback('${feedbackItem.feedbackId}', this)">Unpin</button>
        `;

        row.innerHTML = `
            <td>${formatTimestampForDisplay(feedbackItem.submissionDate)}</td>
            <td>${displayId}</td>
            <td>${displayName}</td>
            <td>${feedbackItem.topic || 'N/A'}</td>
            <td><span class="status-${feedbackItem.status.toLowerCase()}">${feedbackItem.status}</span></td>
            <td>${feedbackItem.roadmap || 'N/A'}</td>
            <td>${actionsHtml}</td>
        `;
    }
}
function getPinnedFeedbacksForCurrentUser() {
    const session = getCurrentAdminSession();
    if (!session || !session.username) {
        return []; 
    }
    const allPinnedData = getData(PINNED_FEEDBACKS_KEY) || {}; 
    return allPinnedData[session.username] || []; 
}
function togglePinFeedback(feedbackId, buttonElement) {
    const session = getCurrentAdminSession();
    if (!session || !session.username) {
        showAlert("Please log in to manage pinned items.", "Error");
        return;
    }

    const username = session.username;
    let allPinnedData = getData(PINNED_FEEDBACKS_KEY) || {}; 
    let userPinnedIds = allPinnedData[username] || []; 
    let isPinned = false;

    let foundIndex = -1;
    for (let i = 0; i < userPinnedIds.length; i++) {
        if (userPinnedIds[i] === feedbackId) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex > -1) {
        userPinnedIds.splice(foundIndex, 1); 
        isPinned = false;
        logAction(username, 'Feedback Unpin', `Unpinned feedback ID '${feedbackId}'.`);
    } else {
        userPinnedIds.unshift(feedbackId); 
        isPinned = true;
        
        logAction(username, 'Feedback Pin', `Pinned feedback ID '${feedbackId}'.`);
    }

    allPinnedData[username] = userPinnedIds;
    setData(PINNED_FEEDBACKS_KEY, allPinnedData); 

    updatePinButtonUI(buttonElement, isPinned);

    if (window.location.pathname.includes('admin/admin-pinned-feedbacks.html')) {
        displayPinnedFeedbacks();
    }
}
function updatePinButtonUI(buttonElement, isPinned) {
    if (!buttonElement) return;
    if (isPinned) {
        buttonElement.textContent = 'Unpin'; 
        buttonElement.title = 'Remove from pinned items';
    } else {
        buttonElement.textContent = 'Pin';
        buttonElement.title = 'Add to pinned items';
    }
}
function handleExportFeedbacks() {
    const statusFilter = document.getElementById('feedbackStatusFilter')?.value || 'all';
    const userTypeFilter = document.getElementById('feedbackUserTypeFilter')?.value || 'all';
    const topicFilter = document.getElementById('feedbackTopicFilter')?.value || 'all';
    const categoryFilter = document.getElementById('feedbackCategoryFilter')?.value || 'all';
    const roadmapFilter = document.getElementById('feedbackRoadmapFilter')?.value || 'all';
    const searchTerm = document.getElementById('feedbackSearchInput')?.value || '';
    const sortOrder = document.getElementById('feedbackSortOrder')?.value || 'date_desc'; 

    const allFeedbacks = getData(FEEDBACKS_KEY);
    const allStudents = getData(STUDENTS_KEY);
    const allAlumni = getData(ALUMNI_KEY);
    let filteredFeedbacks = allFeedbacks;
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (statusFilter === 'pending' || statusFilter === 'approved') {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.status === statusFilter);
    } else {
        filteredFeedbacks = filteredFeedbacks.filter(fb => fb.status === 'pending' || fb.status === 'approved');
    }
    
    if (userTypeFilter === 'Student') { filteredFeedbacks = filteredFeedbacks.filter(fb => fb.userType === 'Student' || !fb.userType); }
    else if (userTypeFilter === 'Alumni') { filteredFeedbacks = filteredFeedbacks.filter(fb => fb.userType === 'Alumni'); }
    
    if (topicFilter !== 'all') { filteredFeedbacks = filteredFeedbacks.filter(fb => fb.topic === topicFilter); }
    
    if (categoryFilter !== 'all') { filteredFeedbacks = filteredFeedbacks.filter(fb => fb.category === categoryFilter); }
    
    if (roadmapFilter !== 'all') { filteredFeedbacks = filteredFeedbacks.filter(fb => fb.roadmap === roadmapFilter); }
    
    if (lowerSearchTerm) {
        filteredFeedbacks = filteredFeedbacks.filter(fb => {
            let sName = '';
            if (fb.userType === 'Alumni') {  } else {  }
            return (fb.studentId?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.submitterId?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.topic?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.details?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.feedbackId?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.category?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.roadmap?.toLowerCase().includes(lowerSearchTerm) ||
                    fb.userType?.toLowerCase().includes(lowerSearchTerm));
        });
    }
    
    filteredFeedbacks.sort((a, b) => {
        let valA, valB;
        const safeGet = (obj, prop, fallback = '') => (obj && obj[prop] != null) ? obj[prop] : fallback;
        const safeGetDate = (obj, prop) => { const ts = safeGet(obj, prop, null); if (!ts) return 0; const d = new Date(ts); return isNaN(d.getTime()) ? 0 : d.getTime(); };
        switch (sortOrder) {
            case 'date_asc': return safeGetDate(a, 'submissionDate') - safeGetDate(b, 'submissionDate');
            case 'date_desc': default: return safeGetDate(b, 'submissionDate') - safeGetDate(a, 'submissionDate');
            case 'submitter_asc': valA = a.isAnonymous ? 'anonymous' : (safeGet(a, 'submitterId', safeGet(a, 'studentId', 'z'))); valB = b.isAnonymous ? 'anonymous' : (safeGet(b, 'submitterId', safeGet(b, 'studentId', 'z'))); return valA.toLowerCase().localeCompare(valB.toLowerCase());
            case 'submitter_desc': valA = a.isAnonymous ? 'anonymous' : (safeGet(a, 'submitterId', safeGet(a, 'studentId', 'z'))); valB = b.isAnonymous ? 'anonymous' : (safeGet(b, 'submitterId', safeGet(b, 'studentId', 'z'))); return valB.toLowerCase().localeCompare(valA.toLowerCase());
            case 'topic_asc': return safeGet(a, 'topic').toLowerCase().localeCompare(safeGet(b, 'topic').toLowerCase());
            case 'topic_desc': return safeGet(b, 'topic').toLowerCase().localeCompare(safeGet(a, 'topic').toLowerCase());
            case 'status_asc': return safeGet(a, 'status').toLowerCase().localeCompare(safeGet(b, 'status').toLowerCase());
            case 'status_desc': return safeGet(b, 'status').toLowerCase().localeCompare(safeGet(a, 'status').toLowerCase());
        }
        
    });
    
    const dataForReport = [];
    for(let i = 0; i < filteredFeedbacks.length; i++) {
        const fb = filteredFeedbacks[i];
        let submitterName = '[User Not Found]';

        if (fb.userType === 'Alumni' && fb.submitterId) {
            let foundAlum = null;
            for(let k=0; k<allAlumni.length; k++){ 
                if (allAlumni[k].alumniId === fb.submitterId) {
                foundAlum = allAlumni[k]; break;
            }
        }

        if (foundAlum) submitterName = foundAlum.fullName;
        } else if (fb.studentId) {
            let foundStud = null;
            for(let k=0; k<allStudents.length; k++){ if(allStudents[k].studentId === fb.studentId) {
                foundStud = allStudents[k]; break;
            }
        }
            if(foundStud) submitterName = foundStud.fullName;
        }
        
        const reportItem = { ...fb, submitterName: submitterName };
        dataForReport.push(reportItem);
    }

    try {
        sessionStorage.setItem('feedbackReportData', JSON.stringify(dataForReport));
        let filterDesc = `Status: ${statusFilter}, User: ${userTypeFilter}, Topic: ${topicFilter}, Category: ${categoryFilter}, Roadmap: ${roadmapFilter}, Search: ${searchTerm || 'None'}, Sort: ${sortOrder}`;
        sessionStorage.setItem('feedbackReportFilters', filterDesc);

    } catch (e) {
        showAlert("Could not prepare report data. Storage might be full.", "Export Error");
        return;
    }

    window.open('../export-feedbacks.html', '_blank');
}

// ==========================================================================
// - 11.) User Management (Students) -
// ==========================================================================

function loadAdminUsersStudentsPage() {
    const statusFilterDropdown = document.getElementById('studentStatusFilter');
    
    const courseFilterDropdown = document.getElementById('studentCourseFilter');
    const searchInput = document.getElementById('studentSearchInput');

    if (statusFilterDropdown) {
        const option = document.createElement('option');
        option.value = 'pending_deletion';
        option.textContent = 'Pending Deletion';
        statusFilterDropdown.appendChild(option);
    }

    const config = getData(CONFIG_KEY);
    const courses = config.courses || [];

    populateDropdown(
        'studentCourseFilter',     
        courses,                   
        'name',                    
        'name',                    
        'All Courses & Strands'    
    );
    
    searchStudents(); 
    
    if (statusFilterDropdown) {
        statusFilterDropdown.addEventListener('change', searchStudents);
    }

    if (courseFilterDropdown) {
        courseFilterDropdown.addEventListener('change', searchStudents);
    }

    if (searchInput) {
        searchInput.addEventListener('input', searchStudents);
        searchInput.addEventListener('search', searchStudents);
    }
}
function displayManageStudents(statusFilter = 'all', courseFilter = 'all', searchTerm = '') {
    const tableBody = document.getElementById('manageStudentsBody');
    if (!tableBody) { console.error("manageStudentsBody element not found."); return; }
    const allStudents = getData(STUDENTS_KEY);
    let filteredStudents = allStudents; 

    if (statusFilter !== 'all') { 
        filteredStudents = filteredStudents.filter(s => s.status === statusFilter);
    }
    
    if (courseFilter !== 'all' && courseFilter !== '') {
        const studentsBeforeCourseFilter = filteredStudents.length;
        filteredStudents = filteredStudents.filter(s => s.course === courseFilter);
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    if (lowerSearchTerm) {
        const studentsBeforeSearch = filteredStudents.length;
        filteredStudents = filteredStudents.filter(s =>
            (s.studentId && s.studentId.toLowerCase().includes(lowerSearchTerm)) ||
            (s.fullName && s.fullName.toLowerCase().includes(lowerSearchTerm)) ||
            (s.email && s.email.toLowerCase().includes(lowerSearchTerm)) ||
            (s.course && s.course.toLowerCase().includes(lowerSearchTerm)) ||
            (s.status && s.status.toLowerCase().includes(lowerSearchTerm)) 
        );
    }
    
    filteredStudents.sort((a, b) => {
        const dateA = new Date(a.registrationDate).getTime();
        const dateB = new Date(b.registrationDate).getTime();
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
    });

    tableBody.innerHTML = ''; 
    if (filteredStudents.length === 0) {
        
        tableBody.innerHTML = `<tr><td colspan="7" class="no-data">No student accounts match the filters/search.</td></tr>`;
        return;
    }
    
    filteredStudents.forEach(student => {
        const row = tableBody.insertRow();
        let statusDisplay = '';
        if (student.status === 'pending_deletion') {
            const scheduledDate = student.scheduledDeletionTimestamp ? formatTimestampForDisplay(student.scheduledDeletionTimestamp) : 'soon';
            statusDisplay = `<span class="status-pending_deletion" title="Scheduled for deletion around ${scheduledDate}">Pending Deletion</span>`;
        } else {
            statusDisplay = `<span class="status-${student.status.toLowerCase()}">${student.status}</span>`;
            if (student.pendingChanges) {
                const changeDetails = `Name: ${student.pendingChanges.newFullName}\nCourse: ${student.pendingChanges.newCourse}`;
                statusDisplay += `<br><small title="${changeDetails}">Info Change Pending</small>`;
            }
        }
         
        let actionButtons = '';
        if (student.status === 'pending_deletion') {
            actionButtons += `<button class="btn btn-sm btn-warning" onclick="adminCancelDeletion('${student.studentId}', 'student')" title="Cancel the user's deletion request and reactivate account">Cancel Deletion</button>`;
        } else {
            if (student.pendingChanges) {
                actionButtons += `<button class="btn btn-sm btn-success" onclick="promptApproveStudentChange('${student.studentId}')" title="Approve Info Change">Approve Chg</button> `;
                actionButtons += `<button class="btn btn-sm btn-danger" onclick="promptRejectStudentChange('${student.studentId}')" title="Reject Info Change">Reject Chg</button> `;
            }
            
            if (student.status === 'pending') {
                actionButtons += `<button class="btn btn-sm btn-approve" onclick="approveStudent('${student.studentId}')" title="Approve Registration">Approve</button> `;
            }
            
            actionButtons += `<button class="btn btn-sm btn-delete" onclick="promptDeleteStudent('${student.studentId}')" title="Delete Account (Move to Recycle Bin)">Delete</button>`;
        }
        
        row.innerHTML = `
            <td><input type="checkbox" class="student-row-checkbox" value="${student.studentId}"></td> 
            <td>${student.studentId}</td>
            <td>${student.fullName}</td>
            <td>${student.course}</td>
            <td>${formatTimestampForDisplay(student.registrationDate)}</td>
            <td>${statusDisplay}</td>
            <td>${actionButtons}</td>
        `;
    });

    addCheckboxListeners('manageStudentsTable', 'selectAllStudentsCheckbox', 'student-row-checkbox');

    const approveSelectedStudentsBtn = document.getElementById('approveSelectedStudentsButton');
    if (approveSelectedStudentsBtn) {
        approveSelectedStudentsBtn.onclick = handleApproveSelectedStudents; 
    }

    const deleteSelectedStudentsBtn = document.getElementById('deleteSelectedStudentsButton');
    if (deleteSelectedStudentsBtn) {
        deleteSelectedStudentsBtn.onclick = handleDeleteSelectedStudents; 
    }

    const clearSelectedStudentsBtn = document.getElementById('clearSelectedStudentsButton');
    if (clearSelectedStudentsBtn) {
        clearSelectedStudentsBtn.onclick = () => clearSelection('manageStudentsTable', 'selectAllStudentsCheckbox', 'student-row-checkbox');
    }
}
function searchStudents() {
    const statusFilterDropdown = document.getElementById('studentStatusFilter');
    const courseFilterDropdown = document.getElementById('studentCourseFilter'); 
    const searchInput = document.getElementById('studentSearchInput');
    const statusFilter = statusFilterDropdown ? statusFilterDropdown.value : 'all';
    const courseFilter = courseFilterDropdown ? courseFilterDropdown.value : 'all'; 
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    displayManageStudents(statusFilter, courseFilter, searchTerm);
}
function approveStudent(studentId) {
    let students = getData(STUDENTS_KEY);
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;

    const studentIndex = students.findIndex(s => s.studentId === studentId && s.status === 'pending');

    if (studentIndex === -1) {
        showAlert("Student account not found or already approved.", "Error");
        displayManageStudents(document.getElementById('studentStatusFilter')?.value || 'all', document.getElementById('studentSearchInput')?.value.trim().toLowerCase() || '');
        return;
    }

    students[studentIndex].status = 'approved';
    students[studentIndex].approvalDate = getCurrentTimestamp(); 
    students[studentIndex].approvedBy = adminSession.username; 

    setData(STUDENTS_KEY, students);
    logAction(adminSession.username, 'Student Approve', `Approved student account registration for ID '${studentId}' (Name: ${students[studentIndex].fullName}).`);
    showSuccess("Student account approved successfully.", "Approval Complete");
    searchStudents(); 
    updateDashboardStats(); 
}
function promptDeleteStudent(studentId) {
    const allStudents = getData(STUDENTS_KEY);
    const student = allStudents.find(s => s.studentId === studentId); 

    if (!student) {
        showAlert("Student account not found.", "Error");
        displayManageStudents(document.getElementById('studentStatusFilter')?.value || 'all', document.getElementById('studentSearchInput')?.value.trim().toLowerCase() || '');
        return;
    }

    showPrompt(
        `WARNING: Deleting student '${student.fullName}' (${studentId}) will also permanently delete all their submitted feedback (including approved ones). This cannot be undone.\n\nPlease provide a reason for deleting this account.`,
        'Reason for Deletion:',
        'Confirm Account Deletion',
        (reason) => { 
            if (!reason) {
                showAlert("Deletion reason is required.", "Error");
                return;
            }
            deleteStudent(studentId, reason);
        },
        () => {}
    );
}
function deleteStudent(studentId, reason) {
    let students = getData(STUDENTS_KEY);
    let feedbacks = getData(FEEDBACKS_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let sessions = getData(SESSIONS_KEY);
    const adminSession = getCurrentAdminSession(); 

    if (!adminSession) {
        showAlert("Authentication error. Please log in again.", "Error");
        return; 
    }

    const studentIndex = students.findIndex(s => s.studentId === studentId);
    if (studentIndex === -1) {
        showAlert("Student account not found or already deleted.", "Error");
        searchStudents(); 
        return;
    }
    const studentToDelete = students[studentIndex];
    
    let initialFeedbackCount = feedbacks.length;
    feedbacks = feedbacks.filter(fb => fb.studentId !== studentId);
    let deletedFeedbackCount = initialFeedbackCount - feedbacks.length;
    
    setData(FEEDBACKS_KEY, feedbacks);

    let deletedFeedbacks = recycleBin.deletedFeedbacks || [];
    let initialRecycledCount = deletedFeedbacks.length;
    deletedFeedbacks = deletedFeedbacks.filter(fb => fb.studentId !== studentId);
    let removedRecycledCount = initialRecycledCount - deletedFeedbacks.length;
    
    recycleBin.deletedFeedbacks = deletedFeedbacks;
    const deletedByRole = adminSession.role; 
    studentToDelete.deletedByModerator = (deletedByRole === 'Moderator'); 
    studentToDelete.adminReviewed = (deletedByRole === 'Admin'); 
    studentToDelete.deletedByUsername = adminSession.username; 
    studentToDelete.deletionDate = getCurrentTimestamp();
    studentToDelete.deletionReason = reason;

    if (!recycleBin.deletedStudents) { 
        recycleBin.deletedStudents = [];
    }
    recycleBin.deletedStudents.unshift(studentToDelete);
    
    students.splice(studentIndex, 1);setData(STUDENTS_KEY, students);
    setData(RECYCLE_BIN_KEY, recycleBin);
    
    if (sessions.student && sessions.student.studentId === studentId) {
        
        sessions.student = null;
        setData(SESSIONS_KEY, sessions);
    }

    logAction(
        adminSession.username,
        'Student Delete',
        `Deleted student account ID '${studentId}' (Name: ${studentToDelete.fullName}). Reason: ${reason}. Associated feedback permanently deleted.`
    );
    
    showSuccess("Student account moved to Recycle Bin. All associated feedback permanently deleted.", "Deletion Complete");
    searchStudents(); 
    updateDashboardStats();
    
}
function handleApproveSelectedStudents() {
    const table = document.getElementById('manageStudentsTable');
    if (!table) return;
    const selectedCheckboxes = table.querySelectorAll('.student-row-checkbox:checked');
    const idsToApprove = [];

    
    for (let i = 0; i < selectedCheckboxes.length; i++) {
        const checkbox = selectedCheckboxes[i];
        const row = checkbox.closest('tr');
        if (!row) continue;
        
        const statusElement = row.querySelector('td:nth-child(6) span'); 
        if (statusElement && statusElement.textContent.trim().toLowerCase() === 'pending') {
            idsToApprove.push(checkbox.value);
        }
    }

    if (idsToApprove.length === 0) {
        showAlert("Please select at least one 'Pending' student account to approve.", "No Pending Selection");
        return;
    }

    if (idsToApprove.length === 1) {
        showConfirm(
            `Are you sure you want to approve student account ID '${idsToApprove[0]}'?`,
            "Confirm Student Approval",
            () => {
                approveStudent(idsToApprove[0]);
                clearSelection('manageStudentsTable', 'selectAllStudentsCheckbox', 'student-row-checkbox');
            }
        );
        return;
    }

    showConfirm(
        `Are you sure you want to approve the selected ${idsToApprove.length} pending student account(s)?`,
        'Confirm Batch Approval',
        () => {
            executeBatchApproveUsers(idsToApprove, 'student'); 
        }
    );
}
function handleDeleteSelectedStudents() {
    const table = document.getElementById('manageStudentsTable');
    if (!table) return;
    const selectedCheckboxes = table.querySelectorAll('.student-row-checkbox:checked');
    const idsToDelete = [];
    for (let i = 0; i < selectedCheckboxes.length; i++) {
        idsToDelete.push(selectedCheckboxes[i].value);
    }

    if (idsToDelete.length === 0) {
        showAlert("Please select at least one student account to delete.", "No Selection");
        return;
    }

    if (idsToDelete.length === 1) {
        promptDeleteStudent(idsToDelete[0]);
        clearSelection('manageStudentsTable', 'selectAllStudentsCheckbox', 'student-row-checkbox');
        return;
    }

    showPrompt(
        `WARNING: Deleting ${idsToDelete.length} student account(s) will also PERMANENTLY DELETE all their associated feedback (including approved and recycled items). This action CANNOT BE UNDONE.\n\nPlease provide a reason for this batch deletion.`,
        'Reason for Batch Deletion:',
        'Confirm Batch Deletion',
        (reason) => {
            if (!reason) {
                showAlert("Deletion reason is required for batch delete.", "Error");
                return;
            }
            executeBatchDeleteUsers(idsToDelete, 'student', reason);
        }
    );
}
function promptApproveStudentChange(studentId) {
    const students = getData(STUDENTS_KEY);
    let student = null;
    for(let i=0; i < students.length; i++){
        if(students[i].studentId === studentId){
            student = students[i];
            break;
        }
    }

    if (!student || !student.pendingChanges) {
        showAlert("No pending change request found for this student.", "Error");
        displayManageStudents(); 
        return;
    }

    const changes = student.pendingChanges;
    const message = `Approve changes for student ${studentId}?
                    \nOld Name: ${changes.oldFullName} -> New Name: ${changes.newFullName}
                    \nOld Course: ${changes.oldCourse} -> New Course: ${changes.newCourse}
                    \nRequested on: ${changes.requestDate}`;

    showConfirm(message, "Confirm Information Change", () => {
        approveStudentChange(studentId);
    });
}
function approveStudentChange(studentId) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;

    let students = getData(STUDENTS_KEY);
    let studentIndex = -1;
    for(let i=0; i < students.length; i++){
        if(students[i].studentId === studentId){
            studentIndex = i;
            break;
        }
    }

    if (studentIndex === -1 || !students[studentIndex].pendingChanges) {
        showAlert("Error processing request. Pending change not found.", "Error");
        displayManageStudents();
        return;
    }

    const changes = students[studentIndex].pendingChanges;
    students[studentIndex].fullName = changes.newFullName;
    students[studentIndex].course = changes.newCourse;
    students[studentIndex].pendingChanges = null;
    setData(STUDENTS_KEY, students);
    logAction(adminSession.username, 'Student Info Change Approved', `Approved info change for student ${studentId}. New Name: ${changes.newFullName}, New Course: ${changes.newCourse}.`);
    showSuccess("Student information change approved.", "Approval Complete");
    displayManageStudents(); 
}
function promptRejectStudentChange(studentId) {
    const students = getData(STUDENTS_KEY);
    let student = null;
    for(let i=0; i < students.length; i++){
        if(students[i].studentId === studentId){
            student = students[i];
            break;
        }
    }

    if (!student || !student.pendingChanges) {
        showAlert("No pending change request found for this student.", "Error");
        displayManageStudents(); 
        return;
    }
    const changes = student.pendingChanges;
    const message = `Reject changes for student ${studentId}?
                    \nRequested New Name: ${changes.newFullName}
                    \nRequested New Course: ${changes.newCourse}
                    \nRequested on: ${changes.requestDate}`;

    showPrompt(
        message + "\n\nPlease provide a reason for rejection (optional).",
        'Reason for Rejection:',
        'Confirm Rejection',
        (reason) => { 
            rejectStudentChange(studentId, reason || "No reason provided."); 
        },
        () => { 
            
        }
    );
}
function rejectStudentChange(studentId, reason) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;

    let students = getData(STUDENTS_KEY);
    let studentIndex = -1;
    for(let i=0; i < students.length; i++){
        if(students[i].studentId === studentId){
            studentIndex = i;
            break;
        }
    }

    if (studentIndex === -1 || !students[studentIndex].pendingChanges) {
        showAlert("Error processing request. Pending change not found.", "Error");
        displayManageStudents();
        return;
    }

    const changes = students[studentIndex].pendingChanges; 
    students[studentIndex].pendingChanges = null;
    setData(STUDENTS_KEY, students);
    logAction(adminSession.username, 'Student Info Change Rejected', `Rejected info change for student ${studentId}. Requested Name: ${changes.newFullName}, Course: ${changes.newCourse}. Reason: ${reason}`);
    showSuccess("Student information change request rejected.", "Rejection Complete");
    displayManageStudents(); 
}

// ==========================================================================
// - 12.) User Management (Alumni) -
// ==========================================================================

function loadAdminUsersAlumniPage() {
    const statusFilterDropdown = document.getElementById('alumniStatusFilter');
    const yearFilterInput = document.getElementById('alumniYearFilter');
    const courseFilterDropdown = document.getElementById('alumniCourseFilter'); 
    const searchInput = document.getElementById('alumniSearchInput');

    if (statusFilterDropdown) {
        const option = document.createElement('option');
        option.value = 'pending_deletion';
        option.textContent = 'Pending Deletion';
        statusFilterDropdown.appendChild(option);
        
    }
    
    const config = getData(CONFIG_KEY);
    const courses = config.courses || [];

    populateDropdown(
        'alumniCourseFilter',      
        courses,                   
        'name',                    
        'name',                    
        'All Courses'              
    );
    searchAlumni(); 

    if (statusFilterDropdown) statusFilterDropdown.addEventListener('change', searchAlumni);
    if (yearFilterInput) yearFilterInput.addEventListener('input', searchAlumni); 
    if (courseFilterDropdown) courseFilterDropdown.addEventListener('change', searchAlumni); 
    if (searchInput) {
        searchInput.addEventListener('input', searchAlumni);
        searchInput.addEventListener('search', searchAlumni);
    }
}
function displayManageAlumni(statusFilter = 'all', yearFilter = '', courseFilter = 'all', searchTerm = '') {
    const tableBody = document.getElementById('manageAlumniBody');
    if (!tableBody) {
        console.error("manageAlumniBody element not found.");
        return;
    }

    const allAlumni = getData(ALUMNI_KEY);
    let filteredAlumni = allAlumni;

    if (statusFilter !== 'all') {
        filteredAlumni = filteredAlumni.filter(a => a.status === statusFilter);
    }

    document.getElementById('alumniYearFilter').addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (this.value.length > 4) {
            this.value = this.value.slice(0, 4);
        } 
    });

    if (yearFilter && /^\d{4}$/.test(yearFilter)) {
        const yearNum = parseInt(yearFilter);
        filteredAlumni = filteredAlumni.filter(a => parseInt(a.yearGraduated) === yearNum);
    }

    if (courseFilter !== 'all' && courseFilter !== '') {
        filteredAlumni = filteredAlumni.filter(a => a.courseCompleted === courseFilter);
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    if (lowerSearchTerm) {
        filteredAlumni = filteredAlumni.filter(a =>
            (a.fullName && a.fullName.toLowerCase().includes(lowerSearchTerm)) ||
            (a.email && a.email.toLowerCase().includes(lowerSearchTerm)) ||
            (a.courseCompleted && a.courseCompleted.toLowerCase().includes(lowerSearchTerm)) ||
            (a.alumniId && a.alumniId.toLowerCase().includes(lowerSearchTerm)) ||
            (a.yearGraduated && a.yearGraduated.toString().includes(lowerSearchTerm)) ||
            (a.status && a.status.toLowerCase().includes(lowerSearchTerm))
        );
    }

    filteredAlumni.sort((a, b) => {
        const dateA = new Date(a.registrationDate).getTime();
        const dateB = new Date(b.registrationDate).getTime();
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
    });

    tableBody.innerHTML = '';

    if (filteredAlumni.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="no-data">No alumni accounts match the filters/search.</td></tr>`;
        return;
    }

    filteredAlumni.forEach(alumnus => {
        const row = tableBody.insertRow();
        let statusDisplay = '';
        if (alumnus.status === 'pending_deletion') {
            const scheduledDate = alumnus.scheduledDeletionTimestamp ? formatTimestampForDisplay(alumnus.scheduledDeletionTimestamp) : 'soon';
            statusDisplay = `<span class="status-pending_deletion" title="Scheduled for deletion around ${scheduledDate}">Pending Deletion</span>`;
        } else {
            statusDisplay = `<span class="status-${alumnus.status.toLowerCase()}">${alumnus.status}</span>`;
        }

        let actionButtons = '';
        if (alumnus.status === 'pending_deletion') {
            actionButtons += `<button class="btn btn-sm btn-warning" onclick="adminCancelDeletion('${alumnus.alumniId}', 'alumni')" title="Cancel the user's deletion request and reactivate account">Cancel Deletion</button>`;
        } else {
            if (alumnus.status === 'pending') {
                actionButtons += `<button class="btn btn-sm btn-approve" onclick="approveAlumnus('${alumnus.alumniId}')" title="Approve Registration">Approve</button> `;
            }
            actionButtons += `<button class="btn btn-sm btn-delete" onclick="promptDeleteAlumnus('${alumnus.alumniId}')" title="Delete Account (Move to Recycle Bin)">Delete</button>`;
        }

        row.innerHTML = `
            <td><input type="checkbox" class="alumni-row-checkbox" value="${alumnus.alumniId}"></td>
            <td>${alumnus.email}</td>
            <td>${alumnus.fullName}</td>
            <td>${alumnus.yearGraduated || 'N/A'}</td>
            <td>${alumnus.courseCompleted || 'N/A'}</td>
            <td>${formatTimestampForDisplay(alumnus.registrationDate)}</td>
            <td>${statusDisplay}</td>
            <td>${actionButtons}</td>
        `;
    });

    addCheckboxListeners('manageAlumniTable', 'selectAllAlumniCheckbox', 'alumni-row-checkbox');

    const approveSelectedAlumniBtn = document.getElementById('approveSelectedAlumniButton');
    if (approveSelectedAlumniBtn) {
        approveSelectedAlumniBtn.onclick = handleApproveSelectedAlumni;
    } else {
        console.warn("approveSelectedAlumniButton not found.");
    }

    const deleteSelectedAlumniBtn = document.getElementById('deleteSelectedAlumniButton');
    if (deleteSelectedAlumniBtn) {
        deleteSelectedAlumniBtn.onclick = handleDeleteSelectedAlumni;
    } else {
        console.warn("deleteSelectedAlumniButton not found.");
    }

    const clearSelectedAlumniBtn = document.getElementById('clearSelectedAlumniButton');
    if (clearSelectedAlumniBtn) {
        clearSelectedAlumniBtn.onclick = () => clearSelection('manageAlumniTable', 'selectAllAlumniCheckbox', 'alumni-row-checkbox');
    } else {
        console.warn("clearSelectedAlumniButton not found.");
    }
}
function searchAlumni() {
    const statusFilterDropdown = document.getElementById('alumniStatusFilter');
    const yearFilterInput = document.getElementById('alumniYearFilter');
    const courseFilterDropdown = document.getElementById('alumniCourseFilter'); 
    const searchInput = document.getElementById('alumniSearchInput');
    const statusFilter = statusFilterDropdown ? statusFilterDropdown.value : 'all';
    const yearFilter = yearFilterInput ? yearFilterInput.value.trim() : '';
    const courseFilter = courseFilterDropdown ? courseFilterDropdown.value : 'all'; 
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    
    displayManageAlumni(statusFilter, yearFilter, courseFilter, searchTerm); 
}
function approveAlumnus(alumniId) { 
    let alumni = getData(ALUMNI_KEY);
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;

    let alumnusIndex = -1;
    for(let i=0; i < alumni.length; i++){
        
        if (alumni[i].alumniId === alumniId && alumni[i].status === 'pending') {
            alumnusIndex = i;
            break;
        }
    }


    if (alumnusIndex === -1) {
        showAlert("Alumnus account not found or already approved.", "Error");
         searchAlumni(); 
        return;
    }

    alumni[alumnusIndex].status = 'approved';
    alumni[alumnusIndex].approvalDate = getCurrentTimestamp(); 
    alumni[alumnusIndex].approvedBy = adminSession.username; 

    setData(ALUMNI_KEY, alumni);
    logAction(adminSession.username, 'Alumni Approve', `Approved alumni account registration for ID '${alumniId}' (Email: ${alumni[alumnusIndex].email}).`);

    showSuccess("Alumnus account approved successfully.", "Approval Complete");
    searchAlumni(); 
    updateDashboardStats(); 
}
function promptDeleteAlumnus(alumniId) {
    const alumni = getData(ALUMNI_KEY);
    let alumnus = null;
    for(let i=0; i < alumni.length; i++){
        if(alumni[i].alumniId === alumniId){
            alumnus = alumni[i];
            break;
        }
    }

    if (!alumnus) {
    showAlert("Alumni account not found.", "Error");
        searchAlumni(); 
    return;
    }

    showPrompt(
        `WARNING: Deleting alumnus '${alumnus.fullName}' (${alumnus.email}) will also permanently delete all their submitted feedback (including approved ones). This cannot be undone.\n\nPlease provide a reason for deleting this account.`,
        'Reason for Deletion:',
        'Confirm Account Deletion',
        (reason) => {
            if (!reason) {
                showAlert("Deletion reason is required.", "Error");
                return;
            }
            deleteAlumnus(alumniId, reason);
        },
        () => {  }
    );
}
function deleteAlumnus(alumniId, reason) {
    let alumni = getData(ALUMNI_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let sessions = getData(SESSIONS_KEY); 
    const adminSession = getCurrentAdminSession();

    if (!adminSession) {
        showAlert("Authentication error. Please log in again.", "Error");
        return;
    }

    let alumnusIndex = -1;
    for(let i=0; i < alumni.length; i++){
        if(alumni[i].alumniId === alumniId){
            alumnusIndex = i;
            break;
        }
    }

    if (alumnusIndex === -1) {
        showAlert("Alumnus account not found or already deleted.", "Error");
        searchAlumni(); 
        return;
    }

    const alumnusToDelete = alumni[alumnusIndex];
    const deletedByRole = adminSession.role; 

    alumnusToDelete.deletedByModerator = (deletedByRole === 'Moderator'); 
    alumnusToDelete.adminReviewed = (deletedByRole === 'Admin'); 
    alumnusToDelete.deletedByUsername = adminSession.username; 
    alumnusToDelete.deletionDate = getCurrentTimestamp();
    alumnusToDelete.deletionReason = reason;

    if (!recycleBin.deletedAlumni) { 
        recycleBin.deletedAlumni = [];
    }
    recycleBin.deletedAlumni.unshift(alumnusToDelete);

    alumni.splice(alumnusIndex, 1);
    
    setData(ALUMNI_KEY, alumni);
    setData(RECYCLE_BIN_KEY, recycleBin);
    if (sessions.alumni && sessions.alumni.alumniId === alumniId) {
        
        sessions.alumni = null;
        setData(SESSIONS_KEY, sessions);
    }
    logAction(
        adminSession.username,
        'Alumni Delete',
        `Deleted alumni account ID '${alumniId}' (Email: ${alumnusToDelete.email}). Reason: ${reason}.` 
    );
    showSuccess("Alumnus account moved to Recycle Bin.", "Deletion Complete"); 
    searchAlumni(); 
    updateDashboardStats();
}
function handleApproveSelectedAlumni() {
    const table = document.getElementById('manageAlumniTable');
    if (!table) return;
    const selectedCheckboxes = table.querySelectorAll('.alumni-row-checkbox:checked');
    const idsToApprove = [];
     
    for (let i = 0; i < selectedCheckboxes.length; i++) {
        const checkbox = selectedCheckboxes[i];
        const row = checkbox.closest('tr');
        if (!row) continue;
        
        const statusElement = row.querySelector('td:nth-child(7) span'); 
        if (statusElement && statusElement.textContent.trim().toLowerCase() === 'pending') {
            idsToApprove.push(checkbox.value); 
        }
    }

    if (idsToApprove.length === 0) {
        showAlert("Please select at least one 'Pending' alumni account to approve.", "No Pending Selection");
        return;
    }

    if (idsToApprove.length === 1) {
        showConfirm(
            `Are you sure you want to approve alumni account ID '${idsToApprove[0]}'?`,
            "Confirm Alumni Approval",
            () => {
                approveAlumnus(idsToApprove[0]);
                clearSelection('manageAlumniTable', 'selectAllAlumniCheckbox', 'alumni-row-checkbox');
            }
        );
        return;
    }

    showConfirm(
        `Are you sure you want to approve the selected ${idsToApprove.length} pending alumni account(s)?`,
        'Confirm Batch Approval',
        () => {
            executeBatchApproveUsers(idsToApprove, 'alumni'); 
        }
    );
}
function handleDeleteSelectedAlumni() {
    const table = document.getElementById('manageAlumniTable');
    if (!table) return;
    const selectedCheckboxes = table.querySelectorAll('.alumni-row-checkbox:checked');
    const idsToDelete = [];
    for (let i = 0; i < selectedCheckboxes.length; i++) {
        idsToDelete.push(selectedCheckboxes[i].value); 
    }

    if (idsToDelete.length === 0) {
        showAlert("Please select at least one alumni account to delete.", "No Selection");
        return;
    }

    if (idsToDelete.length === 1) {
        promptDeleteAlumnus(idsToDelete[0]);
        clearSelection('manageAlumniTable', 'selectAllAlumniCheckbox', 'alumni-row-checkbox');
        return;
    }

    showPrompt(
        `WARNING: Deleting ${idsToDelete.length} alumni account(s) will also PERMANENTLY DELETE all their associated feedback (including approved and recycled items). This action cannot be undone.\n\nPlease provide a reason for this batch deletion.`,
        'Reason for Batch Deletion:',
        'Confirm Batch Deletion',
        (reason) => {
            if (!reason) {
                showAlert("Deletion reason is required for batch delete.", "Error");
                return;
            }
            executeBatchDeleteUsers(idsToDelete, 'alumni', reason);
        }
    );
}

// ==========================================================================
// - 13.) User Management (Staff) -
// ==========================================================================

function loadAdminUsersStaffPage() {
    const session = getCurrentAdminSession();
    if (!session || session.role !== 'Admin') {
        showAlert("Access Denied. Administrator privileges required.", "Error");
        window.location.href = 'admin/admin-dashboard.html';
        return;
    }
    
    displayManageStaff('');
    const searchInput = document.getElementById('staffSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', triggerStaffSearch);
        searchInput.addEventListener('search', triggerStaffSearch);
    }

    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', handleStaffFormSubmit);
    }
}
function displayManageStaff(searchTerm = '') {
    const tableBody = document.getElementById('manageStaffBody');
    const adminSession = getCurrentAdminSession();
    if (!tableBody || !adminSession || adminSession.role !== 'Admin') return;

    const allStaff = getData(STAFF_KEY);
    
    let visibleStaff = allStaff.filter(s => !s.isHidden && s.role === 'Moderator');
    const lowerSearchTerm = searchTerm.toLowerCase();

    
    if (lowerSearchTerm) {
        visibleStaff = visibleStaff.filter(s =>
            (s.username && s.username.toLowerCase().includes(lowerSearchTerm)) ||
            (s.fullName && s.fullName.toLowerCase().includes(lowerSearchTerm)) || 
            (s.role && s.role.toLowerCase().includes(lowerSearchTerm))
        );
    }

    
    visibleStaff.sort((a, b) => a.username.localeCompare(b.username));

    tableBody.innerHTML = '';
    if (visibleStaff.length === 0) {
        
        tableBody.innerHTML = `<tr><td colspan="4" class="no-data">No staff accounts found.</td></tr>`;
        return;
    }

    visibleStaff.forEach(s => {
        const row = tableBody.insertRow();
        row.setAttribute('data-username', s.username); 
        const isInitialAdmin = s.isDefaultAdmin === true;
        const isDevAccount = s.username === 'dev_maint'; 
        const canDelete = !isInitialAdmin && !isDevAccount; 

        row.innerHTML = `
            <td>${s.username}</td>
            <td>${s.fullName || ''}</td>
            <td>${s.role}</td>
            <td>${s.creationDate || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-edit" onclick="openUpdateStaffModal('${s.username}')">Edit</button>
                <button class="btn btn-sm btn-delete" onclick="promptDeleteStaff('${s.username}')" ${canDelete ? '' : 'disabled title="This account cannot be deleted."'}>Delete</button>
            </td>
        `;
    });
}
function triggerStaffSearch() {
    const searchTerm = document.getElementById('staffSearchInput')?.value || '';
    displayManageStaff(searchTerm);
}
function openCreateStaffModal() {
    const form = document.getElementById('staffForm');
    const modalTitle = document.getElementById('staffModalTitle');
    const submitButton = document.getElementById('staffFormSubmitButton');
    const usernameInput = document.getElementById('staffUsername');
    const passwordInput = document.getElementById('staffPassword');
    const confirmPasswordInput = document.getElementById('staffConfirmPassword');
    const passwordHint = document.getElementById('staffPasswordHint');
    const confirmHint = document.getElementById('staffConfirmPasswordHint');
    const errorElement = document.getElementById('staffFormError');

    if (form && modalTitle && submitButton && usernameInput && passwordInput && confirmPasswordInput && passwordHint && confirmHint && errorElement) {
        form.reset(); 
        errorElement.style.display = 'none';
        modalTitle.textContent = 'Create New Staff';
        submitButton.textContent = 'Create Staff';
        document.getElementById('staffEditUsername').value = ''; 
        usernameInput.disabled = false; 
        passwordInput.required = true;
        confirmPasswordInput.required = true;
        passwordHint.textContent = 'Required. Min 8 chars, upper, lower, special.';
        confirmHint.textContent = 'Required. Must match password.';
        openModal('staffModal');
    }
}
function openUpdateStaffModal(username) {
    const form = document.getElementById('staffForm');
    const modalTitle = document.getElementById('staffModalTitle');
    const submitButton = document.getElementById('staffFormSubmitButton');
    const usernameInput = document.getElementById('staffUsername');
    const passwordInput = document.getElementById('staffPassword');
    const confirmPasswordInput = document.getElementById('staffConfirmPassword');
    const passwordHint = document.getElementById('staffPasswordHint');
    const confirmHint = document.getElementById('staffConfirmPasswordHint');
    const errorElement = document.getElementById('staffFormError');
    const allStaff = getData(STAFF_KEY);
    const staffToEdit = allStaff.find(s => s.username === username);

    if (!staffToEdit) {
        showAlert("Staff member not found.", "Error");
        return;
    }

    if (form && modalTitle && submitButton && usernameInput && passwordInput && confirmPasswordInput && passwordHint && confirmHint && errorElement && document.getElementById('staffFullName')) {
        form.reset(); 
        errorElement.style.display = 'none';
        modalTitle.textContent = `Update Staff: ${username}`;
        submitButton.textContent = 'Save Changes';
        document.getElementById('staffEditUsername').value = username; 
        
        usernameInput.value = staffToEdit.username;
        usernameInput.disabled = false; 
        document.getElementById('staffFullName').value = staffToEdit.fullName || '';
        document.getElementById('staffRole').value = staffToEdit.role;
        document.getElementById('staffSecurityQuestion').value = staffToEdit.securityQuestion;
        document.getElementById('staffSecurityAnswer').value = staffToEdit.securityAnswer; 

        passwordInput.required = false;
        confirmPasswordInput.required = false;
        passwordInput.value = ''; 
        confirmPasswordInput.value = '';
        passwordHint.textContent = 'Optional: Enter new password to change. Min 8 chars, upper, lower, special.';
        confirmHint.textContent = 'Required only if changing password.';

        openModal('staffModal');
    }
}
function handleStaffFormSubmit(event) {
    event.preventDefault();
    const adminSession = getCurrentAdminSession();
     if (!adminSession || adminSession.role !== 'Admin') {
        showAlert("Permission Denied.", "Error");
        return;
    }

    const editUsername = document.getElementById('staffEditUsername').value; 
    const isUpdating = !!editUsername;
    const username = document.getElementById('staffUsername').value.trim();
    const fullName = document.getElementById('staffFullName').value.trim();
    const role = document.getElementById('staffRole').value;
    const password = document.getElementById('staffPassword').value; 
    const confirmPassword = document.getElementById('staffConfirmPassword').value; 
    const securityQuestion = document.getElementById('staffSecurityQuestion').value;
    const securityAnswer = document.getElementById('staffSecurityAnswer').value.trim();
    const errorElement = document.getElementById('staffFormError');

    errorElement.style.display = 'none';

    
    if (!role || !securityQuestion || !securityAnswer || !fullName || (!isUpdating && !username)) {
        errorElement.textContent = "Please fill in Username (for new), Full Name, Role, Security Question, and Answer.";
        errorElement.style.display = 'block';
        event.target.reset();
        return;
    }

    if (password || !isUpdating) { 
        if (!password) {
             errorElement.textContent = "Password is required for new staff.";
             errorElement.style.display = 'block';
            return;
        }
        if (password !== confirmPassword) {
            errorElement.textContent = "Passwords do not match.";
            errorElement.style.display = 'block';
            return;
        }
        if (!validatePassword(password)) {
            errorElement.textContent = "Password does not meet requirements (min 8 chars, upper, lower, special).";
            errorElement.style.display = 'block';
            return;
        }
    }

    let staff = getData(STAFF_KEY);
    if (role === 'Admin') {
        let staff = getData(STAFF_KEY);
        let adminExists = false;
        
        for (let i = 0; i < staff.length; i++) {
            if (staff[i].role === 'Admin' &&
                (!isUpdating || staff[i].username !== editUsername) && 
                staff[i].username !== 'admin' && 
                staff[i].username !== 'dev_maint') { 
                adminExists = true;
                break; 
            }
        }
        if (adminExists) {
            errorElement.textContent = "Cannot create/assign another Admin. Only one active Admin account (besides the default) is allowed.";
            errorElement.style.display = 'block';
            return; 
        }
    }

    if (isUpdating) {
        const staffIndex = staff.findIndex(s => s.username === editUsername);
        if (staffIndex === -1) {
            errorElement.textContent = "Error: Staff member to update not found.";
            errorElement.style.display = 'block';
            return;
        }
        
        staff[staffIndex].fullName = fullName;
        staff[staffIndex].role = role;
        staff[staffIndex].securityQuestion = securityQuestion;
        staff[staffIndex].securityAnswer = securityAnswer;
        if (password) { 
            staff[staffIndex].password = simpleCipher(password);
        }
        
        setData(STAFF_KEY, staff);
        logAction(adminSession.username, 'Staff Update', `Updated staff account details for username '${editUsername}'. ${password ? 'Password updated.' : ''}`);
        showSuccess(`Staff account '${editUsername}' updated successfully.`, "Update Complete", () => {
            closeModal('staffModal');
            displayManageStaff(); 
            
            if (adminSession.username === editUsername) {
                updateAdminUI(); 
                
                const updatedSessionData = staff[staffIndex];
                loginUser('admin', updatedSessionData); 
            }
        });
    } else {
        const existingStaff = staff.find(s => s.username.toLowerCase() === username.toLowerCase());
        let recycleBin = getData(RECYCLE_BIN_KEY);
        const deletedStaff = recycleBin.deletedStaff.find(s => s.username.toLowerCase() === username.toLowerCase());

        if (existingStaff || deletedStaff) {
            errorElement.textContent = "Username already exists.";
            errorElement.style.display = 'block';
            return;
        }

        const newStaff = {
            username: username,
            fullName: fullName,
            role: role,
            password: simpleCipher(password), 
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
            creationDate: getCurrentTimestamp(),
            
        };

        staff.push(newStaff);
        setData(STAFF_KEY, staff);
        logAction(adminSession.username, 'Staff Create', `Created new staff account: ${fullName} ('${username}') with role '${role}'.`);
        showSuccess(`Staff account '${username}' created successfully.`, "Creation Complete", () => {
            closeModal('staffModal');
            displayManageStaff(); 
            updateDashboardStats(); 
        });
    }
}
function promptDeleteStaff(username) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') return; 

    const allStaff = getData(STAFF_KEY);
    const staffToDelete = allStaff.find(s => s.username === username);

    if (!staffToDelete) {
        showAlert("Staff member not found.", "Error");
        displayManageStaff();
        return;
    }
    
    if (staffToDelete.isDefaultAdmin || staffToDelete.username === 'dev_maint') {
        showAlert("This account cannot be deleted.", "Action Denied");
        return;
    }

    if (adminSession.username === username) {
        showConfirm(
            `WARNING: You are about to delete your own account ('${username}'). You will be logged out immediately. Are you sure?`,
            'Confirm Self-Deletion',
            () => deleteStaff(username), 
            null
        );
    } else {
        showConfirm(
            `Are you sure you want to delete the staff account '${username}'? This action will move the account to the recycle bin.`,
            'Confirm Staff Deletion',
            () => deleteStaff(username), 
            null
        );
    }

}
function deleteStaff(username, reason = "N/A") { 
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') {
        showAlert("Permission Denied. Only Administrators can delete staff accounts.", "Error");
        return;
    }

    let staff = getData(STAFF_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let sessions = getData(SESSIONS_KEY);

    const staffIndex = staff.findIndex(s => s.username === username);

    if (staffIndex === -1) {
        showAlert("Staff member not found or already deleted.", "Error");
        displayManageStaff(); 
        return;
    }

    const staffToDelete = staff[staffIndex];
    if (staffToDelete.isDefaultAdmin || staffToDelete.username === 'dev_maint') {
        showAlert("This account cannot be deleted.", "Action Denied");
        return;
    }
    
    const deletedByRole = adminSession.role; 
    staffToDelete.deletedByModerator = (deletedByRole === 'Moderator'); 
    staffToDelete.adminReviewed = (deletedByRole === 'Admin'); 
    staffToDelete.deletedByUsername = adminSession.username;
    staffToDelete.deletionDate = getCurrentTimestamp();
    staffToDelete.deletionReason = reason; 
    if (!recycleBin.deletedStaff) { 
        recycleBin.deletedStaff = [];
    }
    recycleBin.deletedStaff.unshift(staffToDelete);
    staff.splice(staffIndex, 1);
    
    setData(STAFF_KEY, staff);
    setData(RECYCLE_BIN_KEY, recycleBin);
    if (sessions.admin && sessions.admin.username === username) {
        sessions.admin = null;
        setData(SESSIONS_KEY, sessions);
         
        if(adminSession.username === username) {
            window.location.href = '../admin-login.html';
            
        }
    }

    logAction(adminSession.username, 'Staff Delete', `Deleted staff account username '${username}'. Reason: ${reason}`);

    if (adminSession.username !== username) {
        showSuccess(`Staff account '${username}' moved to Recycle Bin.`, "Deletion Complete");
    }
    displayManageStaff(); 
    updateDashboardStats(); 
    
}

// ==========================================================================
// - 14.) User Recycle Bin -
// ==========================================================================

function loadAdminUsersRecyclePage() {
    displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all', '');

    const filterDropdown = document.getElementById('userTypeFilter');
    const searchInput = document.getElementById('recycleUserSearchInput');

    if (filterDropdown) {
        filterDropdown.addEventListener('change', triggerRecycleUserSearch); 
        
    }

    if (searchInput) {
        searchInput.addEventListener('input', triggerRecycleUserSearch);
        searchInput.addEventListener('search', triggerRecycleUserSearch);
    }
}
function displayRecycleUsers(typeFilter = 'all', searchTerm = '') {
    const tableBody = document.getElementById('recycleUserBody');
    if (!tableBody) {
        return;
    }

    const recycleBin = getData(RECYCLE_BIN_KEY);
    let combinedDeleted = [];
    const adminSession = getCurrentAdminSession();
    const isAdmin = adminSession && adminSession.role === 'Admin';
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (typeFilter === 'all' || typeFilter === 'student') {
        (recycleBin.deletedStudents || []).forEach(s => combinedDeleted.push({ ...s, type: 'Student', uniqueId: s.studentId, displayName: s.fullName }));
    }
    if (typeFilter === 'all' || typeFilter === 'alumni') { 
        (recycleBin.deletedAlumni || []).forEach(a => combinedDeleted.push({ ...a, type: 'Alumni', uniqueId: a.alumniId, displayName: a.fullName })); 
    }
    if (isAdmin && (typeFilter === 'all' || typeFilter === 'staff')) { 
        (recycleBin.deletedStaff || []).forEach(s => combinedDeleted.push({ ...s, type: 'Staff', uniqueId: s.username, displayName: s.role })); 
    }
    
    if (lowerSearchTerm) {
        combinedDeleted = combinedDeleted.filter(u => {
            const identifier = u.uniqueId ? u.uniqueId.toLowerCase() : '';
            const nameOrRole = u.displayName ? u.displayName.toLowerCase() : ''; 
            const deletedBy = u.deletedByUsername ? u.deletedByUsername.toLowerCase() : (u.deletedBy ? u.deletedBy.toLowerCase() : '');
            const reason = u.deletionReason ? u.deletionReason.toLowerCase() : '';
            const type = u.type ? u.type.toLowerCase() : ''; 
            const email = u.email ? u.email.toLowerCase() : ''; 

            return identifier.includes(lowerSearchTerm) ||
                   nameOrRole.includes(lowerSearchTerm) ||
                   deletedBy.includes(lowerSearchTerm) ||
                   reason.includes(lowerSearchTerm) ||
                   type.includes(lowerSearchTerm) || 
                   email.includes(lowerSearchTerm); 
        });
    }
    
    combinedDeleted.sort((a, b) => {
        const dateA = new Date(a.deletionDate).getTime();
        const dateB = new Date(b.deletionDate).getTime();
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1; 
        if (isNaN(dateB)) return -1;
        return dateB - dateA; 
    });

    tableBody.innerHTML = '';
    if (combinedDeleted.length === 0) { 
        tableBody.innerHTML = `<tr><td colspan="7" class="no-data">User recycle bin is empty or filter/search returned no results.</td></tr>`; 
        return; 
    }

    combinedDeleted.forEach(u => {
        if (u.type === 'Staff' && !isAdmin) {
            return; 
        }
        const row = tableBody.insertRow();
        const nameOrRole = u.displayName || (u.type === 'Staff' ? u.role : u.fullName) || 'N/A'; 

        let actionButtonsHTML = '';
        const identifier = u.uniqueId; 
        const itemTypeLower = u.type.toLowerCase(); 
        
        const wasDeletedByMod = u.deletedByModerator === true;
        const needsReview = (itemTypeLower === 'student' || itemTypeLower === 'alumni') && wasDeletedByMod && u.adminReviewed !== true;

        if (isAdmin) {
            if (needsReview) {
                actionButtonsHTML += `<button class="btn btn-sm btn-info" onclick="markDeletionAsReviewed('${identifier}', '${itemTypeLower}')">Mark Reviewed</button> `;
            }
            actionButtonsHTML += `<button class="btn btn-sm btn-restore" onclick="promptRestoreUser('${identifier}', '${itemTypeLower}')">Restore</button> `;
            actionButtonsHTML += `<button class="btn btn-sm btn-delete-perm" onclick="promptPermanentDeleteUser('${identifier}', '${itemTypeLower}')">Delete Permanently</button>`;
        } else { 
            if (itemTypeLower === 'student' || itemTypeLower === 'alumni') {
                if (wasDeletedByMod) {
                    if (u.adminReviewed === true) {
                        actionButtonsHTML += `<button class="btn btn-sm btn-restore" onclick="promptRestoreUser('${identifier}', '${itemTypeLower}')">Restore</button> `;
                        actionButtonsHTML += `<button class="btn btn-sm btn-delete-perm" onclick="promptPermanentDeleteUser('${identifier}', '${itemTypeLower}')">Delete Permanently</button>`;
                    } else {
                        actionButtonsHTML = '<span class="text-muted" title="Administrator needs to review this deletion first.">Admin Review Pending</span>';
                    }
                } else {
                    actionButtonsHTML = '<span class="text-muted">Action by Admin Only</span>';
                }
            } else { 
                actionButtonsHTML = '<span class="text-muted">Action by Admin Only</span>'; 
            }
        }

        row.innerHTML = `
            <td>${identifier || 'N/A'}</td>
            <td>${nameOrRole}</td>
            <td>${u.type || 'N/A'}</td>
            <td>${formatTimestampForDisplay(u.deletionDate)}</td>
            <td>${u.deletedByUsername || 'N/A'}</td>
            <td>${u.deletionReason || 'N/A'}</td>
            <td>${actionButtonsHTML}</td>
        `;
        
        row.style.backgroundColor = ''; 
        row.title = ''; 
        if (isAdmin && needsReview) {
            row.style.backgroundColor = 'rgba(255, 235, 180, 0.3)'; 
            row.title = `This ${u.type} deletion by a moderator needs review.`;
        }
    });
}
function triggerRecycleUserSearch() {
    const typeFilter = document.getElementById('userTypeFilter')?.value || 'all';
    const searchTerm = document.getElementById('recycleUserSearchInput')?.value || '';
    displayRecycleUsers(typeFilter, searchTerm);
}
function promptRestoreUser(deletedUserId, userType) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    let user = null; 
    let userName = deletedUserId; 

    
    if (userType === 'student') {
        
        user = (recycleBin.deletedStudents || []).find(s => s.studentId === deletedUserId);
        if (user) userName = user.fullName; 
    } else if (userType === 'staff') {
        
        const adminSession = getCurrentAdminSession();
        if (!adminSession || adminSession.role !== 'Admin') {
            showAlert("Permission Denied. Only Administrators can restore staff accounts.", "Error");
            return;
        }
        
        user = (recycleBin.deletedStaff || []).find(s => s.username === deletedUserId);
        if (user) userName = user.username; 
    } else if (userType === 'alumni') {
        
        user = (recycleBin.deletedAlumni || []).find(a => a.alumniId === deletedUserId); 
        if (user) userName = user.fullName; 
    }

    if (!user) {
        showAlert(`Deleted ${userType} account not found.`, "Error");
        
        displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all');
        return;
    }
    
    const warning = " Restoring the account will NOT restore any previously deleted feedback.";
    
    showConfirm(
        `Are you sure you want to restore the ${userType} account '${userName}' (${deletedUserId})? It will be returned to its previous status.${warning}`,
        'Confirm Restore', 
        () => restoreUser(deletedUserId, userType) 
    );
}
function restoreUser(deletedUserId, userType) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) {
        showAlert("Authentication error. Please log in again.", "Error");
        return; 
    }

    let recycleBin = getData(RECYCLE_BIN_KEY); 
    let userIndex = -1;
    let userToRestore = null;
    let sourceArray = null;
    let idField = '';
    
    if (userType === 'student') {
        sourceArray = recycleBin.deletedStudents || [];
        idField = 'studentId';
    } else if (userType === 'staff') {
        sourceArray = recycleBin.deletedStaff || [];
        idField = 'username';
        
        if (adminSession.role !== 'Admin') {
            showAlert("Permission Denied. Only Administrators can restore staff accounts.", "Error");
            return;
        }
    } else if (userType === 'alumni') {
        sourceArray = recycleBin.deletedAlumni || [];
        idField = 'alumniId'; 
    } else {
        showAlert("Invalid user type for restore.", "Error");
        return;
    }
    
    for(let i=0; i < sourceArray.length; i++){
        if(sourceArray[i][idField] === deletedUserId){
            userIndex = i;
            userToRestore = sourceArray[i];
            break;
        }
    }

    if (userIndex === -1 || !userToRestore) {
        showAlert(`Deleted ${userType} account not found in the recycle bin.`, "Error");
        return; 
    }

    if (adminSession.role === 'Moderator') {
        if (userType === 'student' || userType === 'alumni') {
            if (userToRestore.deletedByModerator !== true || userToRestore.adminReviewed !== true) {
                showAlert("Permission Denied. Restore requires Admin review or was deleted by Admin.", "Error");
                return; 
            }
        } else {
            showAlert("Permission Denied. Moderators cannot restore staff.", "Error");
            return;
        }
    }
    
    let students = getData(STUDENTS_KEY);
    let staff = getData(STAFF_KEY);
    let alumni = getData(ALUMNI_KEY);
    let targetArray = null; 
    let logDetails = '';

    if (userType === 'student') {
        targetArray = students;
        logDetails = `Restored student account ID '${deletedUserId}' (Name: ${userToRestore.fullName}) to status '${userToRestore.status}'.`;
    } else if (userType === 'staff') {
        targetArray = staff;
        logDetails = `Restored staff account username '${deletedUserId}' (Role: ${userToRestore.role}).`;
    } else if (userType === 'alumni') {
        targetArray = alumni;
        logDetails = `Restored alumni account ID '${deletedUserId}' (Email: ${userToRestore.email}).`;
    }
    
    const originalStatus = userToRestore.status;
    delete userToRestore.deletionDate;
    delete userToRestore.deletedBy;
    delete userToRestore.deletedByUsername;
    delete userToRestore.deletionReason;
    delete userToRestore.deletedByModerator;
    delete userToRestore.adminReviewed;
    delete userToRestore.reviewedByAdmin;
    delete userToRestore.reviewDate;
    userToRestore.status = originalStatus || 'approved';
    if (userType === 'student') { userToRestore.pendingChanges = null; }
    
    targetArray.unshift(userToRestore);
    sourceArray.splice(userIndex, 1);

    if (userType === 'student') setData(STUDENTS_KEY, targetArray);
    else if (userType === 'staff') setData(STAFF_KEY, targetArray);
    else if (userType === 'alumni') setData(ALUMNI_KEY, targetArray);

    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, `${userType.charAt(0).toUpperCase() + userType.slice(1)} Restore`, logDetails);
    showSuccess(`${userType.charAt(0).toUpperCase() + userType.slice(1)} account restored successfully.`, "Restore Complete");
    displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all');
    updateDashboardStats();
}
function promptPermanentDeleteUser(deletedUserId, userType) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    let user = null; 
    let userName = deletedUserId; 
    
    if (userType === 'student') {
        
        user = (recycleBin.deletedStudents || []).find(s => s.studentId === deletedUserId);
        if (user) userName = user.fullName;
    } else if (userType === 'staff') {
        
        const adminSession = getCurrentAdminSession();
        if (!adminSession || adminSession.role !== 'Admin') {
            showAlert("Permission Denied. Only Administrators can permanently delete staff accounts.", "Error");
            return;
        }
        
        user = (recycleBin.deletedStaff || []).find(s => s.username === deletedUserId);
        if (user) userName = user.username;
    } else if (userType === 'alumni') {
        
        user = (recycleBin.deletedAlumni || []).find(a => a.alumniId === deletedUserId); 
        if (user) userName = user.fullName;
    }
    
    if (!user) {
        showAlert(`Deleted ${userType} account not found.`, "Error");
        displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all');
        return;
    }

    
    showConfirm(
        `WARNING: This action is irreversible! Are you sure you want to permanently delete the ${userType} account '${userName}' (${deletedUserId})? All data associated with this account in the recycle bin will be lost.`,
        'Confirm Permanent Deletion', 
        () => permanentDeleteUser(deletedUserId, userType), 
        null 
    );
}
function permanentDeleteUser(deletedUserId, userType) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) {
        showAlert("Authentication error. Please log in again.", "Error");
        return;
    }
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let userIndex = -1;
    let userToDelete = null;
    let sourceArray = null;
    let idField = '';
    let logDetails = '';
    if (userType === 'student') {
        sourceArray = recycleBin.deletedStudents || [];
        idField = 'studentId';
    } else if (userType === 'staff') {
        sourceArray = recycleBin.deletedStaff || [];
        idField = 'username';
    } else if (userType === 'alumni') {
        sourceArray = recycleBin.deletedAlumni || [];
        idField = 'alumniId';
    } else {
        showAlert("Invalid user type.", "Error");
        return;
    }

    for (let i = 0; i < sourceArray.length; i++) {
        if (sourceArray[i][idField] === deletedUserId) {
            userIndex = i;
            userToDelete = sourceArray[i];
            
            break;
        }
    }

    if (userIndex === -1 || !userToDelete) {
        showAlert(`Deleted ${userType} account not found.`, "Error");
        return;
    }
    
    if (userType === 'student') { logDetails = `Permanently deleted student account ID '${deletedUserId}' (Name: ${userToDelete.fullName}).`; }
    else if (userType === 'staff') { logDetails = `Permanently deleted staff account username '${deletedUserId}' (Role: ${userToDelete.role}).`; }
    else if (userType === 'alumni') { logDetails = `Permanently deleted alumni account ID '${deletedUserId}' (Email: ${userToDelete.email}).`; }

    let hasPermission = false;
    if (adminSession.role === 'Admin') {
        hasPermission = true;
    } else if (adminSession.role === 'Moderator') {
        if (userType === 'student' || userType === 'alumni') {
            if (userToDelete.deletedByModerator === true && userToDelete.adminReviewed === true) {
                hasPermission = true;
            } else {
                showAlert("Permission Denied. Permanent deletion requires Admin review or was deleted by Admin.", "Error");
                return; 
            }
        } else if (userType === 'staff') {
            showAlert("Permission Denied. Moderators cannot permanently delete staff accounts.", "Error");
            return;
        }
    } else {
        showAlert("Permission Denied. Unknown user role.", "Error");
        return;
    }

    if (!hasPermission) {
        showAlert("Permission Denied.", "Error"); 
        return;
    }
    sourceArray.splice(userIndex, 1); 
    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, `${userType.charAt(0).toUpperCase() + userType.slice(1)} Permanent Delete`, logDetails);
    showSuccess(`${userType.charAt(0).toUpperCase() + userType.slice(1)} account permanently deleted.`, "Deletion Complete");
    displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all');
    
}
function markDeletionAsReviewed(itemId, itemType) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') {
        showAlert("Permission Denied. Only Administrators can mark items as reviewed.", "Error");
        return;
    }

    let recycleBin = getData(RECYCLE_BIN_KEY);
    let itemIndex = -1;
    let itemArray = null;
    let itemToUpdate = null;
    let idField = ''; 

    if (itemType === 'feedback') {
        itemArray = recycleBin.deletedFeedbacks;
        idField = 'feedbackId';
    } else if (itemType === 'student') {
        itemArray = recycleBin.deletedStudents;
        idField = 'studentId';
    } else {
        showAlert("Invalid item type for review.", "Error");
        return;
    }

    if (!itemArray) {
        showAlert("Error finding item data.", "Error");
        return;
    }

    itemIndex = itemArray.findIndex(item => item[idField] === itemId);

    if (itemIndex === -1) {
        showAlert(`Item ${itemId} not found in the recycle bin for ${itemType}.`, "Error");
        return;
    }

    itemToUpdate = itemArray[itemIndex];
    
    if (itemToUpdate.adminReviewed === true) {
        showAlert("This item has already been marked as reviewed.", "Info");
        return;
    }
    
    if (itemToUpdate.deletedByModerator !== true) {
        showAlert("This item was not deleted by a moderator and does not require explicit review.", "Info");
        return;
    }

    itemToUpdate.adminReviewed = true;
    itemToUpdate.reviewedByAdmin = adminSession.username; 
    itemToUpdate.reviewDate = getCurrentTimestamp();
    
    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Deletion Review`, `Reviewed deletion of ${itemType} ID '${itemId}' (Deleted by: ${itemToUpdate.deletedByUsername || 'Moderator'}).`);

    if (itemType === 'feedback') {
        displayRecycleFeedbacks();
    } else if (itemType === 'student') {
        displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all'); 
    }
}
function executeBatchApproveUsers(ids, userType) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;
    let users = userType === 'student' ? getData(STUDENTS_KEY) : getData(ALUMNI_KEY);
    let successCount = 0;

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        let userIndex = -1;
        
        for(let j = 0; j < users.length; j++){
            if(userType === 'student' && users[j].studentId === id && users[j].status === 'pending'){ userIndex = j; break;}
            if(userType === 'alumni' && users[j].alumniId === id && users[j].status === 'pending'){ userIndex = j; break;}
        }

        if (userIndex !== -1) {
            users[userIndex].status = 'approved';
            users[userIndex].approvalDate = getCurrentTimestamp();
            users[userIndex].approvedBy = adminSession.username;
            successCount++;
        }
    }
    
    if (userType === 'student') setData(STUDENTS_KEY, users);
    else if (userType === 'alumni') setData(ALUMNI_KEY, users);

    logAction(adminSession.username, `${userType.charAt(0).toUpperCase() + userType.slice(1)} Batch Approve`, `Batch approved ${successCount} ${userType} account(s). IDs: [${ids.join(', ')}]`);
    showSuccess(`Successfully approved ${successCount} ${userType} account(s).`, "Batch Approval Complete");

    if (userType === 'student') searchStudents();
    else if (userType === 'alumni') searchAlumni();
    updateDashboardStats();
}
function executeBatchDeleteUsers(ids, userType, reason) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) return;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        let deleted = false;
        if (userType === 'student') {
            try {
                deleteStudent(id, reason);
                successCount++; 
            } catch(e) {
                errorCount++;
            }

        } else if (userType === 'alumni') {
            try {
                deleteAlumnus(id, reason); 
                successCount++;
            } catch(e) {
                errorCount++;
            }
        }
    }

    logAction(adminSession.username, `${userType.charAt(0).toUpperCase() + userType.slice(1)} Batch Delete Attempt`, `Attempted batch deletion for ${ids.length} ${userType} account(s) with reason: ${reason}. Success/Fail handled individually.`);
}
function markDeletionAsReviewed(itemId, itemType) {
    
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') {
        showAlert("Permission Denied. Only Administrators can mark items as reviewed.", "Error");
        return;
    }

    let recycleBin = getData(RECYCLE_BIN_KEY);
    let itemIndex = -1;
    let itemArray = null;
    let idField = ''; 
    
    if (itemType === 'feedback') { itemArray = recycleBin.deletedFeedbacks; idField = 'feedbackId'; }
    else if (itemType === 'student') { itemArray = recycleBin.deletedStudents; idField = 'studentId'; }
    else if (itemType === 'alumni') { itemArray = recycleBin.deletedAlumni; idField = 'alumniId'; }
     
    else { showAlert("Invalid item type for review.", "Error"); return; }

    if (!itemArray) {
        showAlert("Error finding item data.", "Error");
        return;
    }
    
    for(let i = 0; i < itemArray.length; i++) {
        if (itemArray[i][idField] === itemId) {
            itemIndex = i;
            break;
        }
    }

    if (itemIndex === -1) {
        showAlert(`Item ${itemId} not found in the recycle bin for ${itemType}.`, "Error");
        return;
    }

    const itemToUpdate = itemArray[itemIndex];

    if (itemToUpdate.deletedByModerator !== true || itemToUpdate.adminReviewed === true) {
        showAlert("This item does not require review or has already been reviewed.", "Info");
        return;
    }

    itemToUpdate.adminReviewed = true;
    itemToUpdate.reviewedByAdmin = adminSession.username; 
    itemToUpdate.reviewDate = getCurrentTimestamp(); 

    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Deletion Review`, `Marked deletion of ${itemType} ID '${itemId}' as reviewed (Deleted by: ${itemToUpdate.deletedByUsername || 'Moderator'}).`);
    if (itemType === 'feedback') { displayRecycleFeedbacks(); }
    else if (itemType === 'student' || itemType === 'alumni') { displayRecycleUsers(document.getElementById('userTypeFilter')?.value || 'all'); }
}

// ==========================================================================
// - 15.) Configuration Management -
// ==========================================================================

function loadAdminConfigPage() {
    const session = getCurrentAdminSession();
    if (!session || session.role !== 'Admin') {
        showAlert("Access Denied. Administrator privileges required.", "Error");
        window.location.href = 'admin/admin-dashboard.html';
        return;
    }
    
    displayManageConfig('');

    const searchInput = document.getElementById('configSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', triggerConfigSearch);
        searchInput.addEventListener('search', triggerConfigSearch);
    }
    
    const configForm = document.getElementById('configForm');
    if (configForm) {
        configForm.addEventListener('submit', handleConfigFormSubmit);
    }
}
function displayManageConfig(searchTerm = '') {
    const tableBody = document.getElementById('manageConfigBody');
    if (!tableBody) {
        return;
    }

    const config = getData(CONFIG_KEY);
    let allConfigItems = [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (config.topics && config.topics.length > 0) {
        config.topics.filter(item => item.isActive !== false).forEach(item => allConfigItems.push({ ...item, type: 'Topic' }));
    }
    if (config.categories && config.categories.length > 0) {
        config.categories.filter(item => item.isActive !== false).forEach(item => allConfigItems.push({ ...item, type: 'Category' }));
    }
    if (config.roadmaps && config.roadmaps.length > 0) {
        config.roadmaps.filter(item => item.isActive !== false).forEach(item => allConfigItems.push({ ...item, type: 'Roadmap' }));
    }
    if (config.courses && config.courses.length > 0) {
        config.courses.filter(item => item.isActive !== false).forEach(item => allConfigItems.push({ ...item, type: 'Course' }));
    }

    
    if (lowerSearchTerm) {
        allConfigItems = allConfigItems.filter(item =>
            (item.name && item.name.toLowerCase().includes(lowerSearchTerm)) ||
            (item.description && item.description.toLowerCase().includes(lowerSearchTerm)) ||
            (item.type && item.type.toLowerCase().includes(lowerSearchTerm)) 
        );
    }

    allConfigItems.sort((a, b) => {
        if (a.type < b.type) return -1;
        if (a.type > b.type) return 1;
        return a.name.localeCompare(b.name);
    });

    
    tableBody.innerHTML = '';
    if (allConfigItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="no-data">No configuration items match the search.</td></tr>`;
        return;
    }

    allConfigItems.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.type}</td>
            <td>${item.name}</td>
            <td>${item.description || ''}</td>
            <td>
                <button class="btn btn-sm btn-edit" onclick="openUpdateConfigModal('${item.id}')">Edit</button>
                <button class="btn btn-sm btn-delete" onclick="promptDeleteConfig('${item.id}')">Delete</button>
            </td>
        `;
    });
    
}
function triggerConfigSearch() {
    const searchTerm = document.getElementById('configSearchInput')?.value || '';
    displayManageConfig(searchTerm);
}
function openCreateConfigModal() {
    const form = document.getElementById('configForm');
    const modalTitle = document.getElementById('configModalTitle');
    const submitButton = document.getElementById('configFormSubmitButton');
    const typeSelect = document.getElementById('configType');
    const errorElement = document.getElementById('configFormError');

    if (form && modalTitle && submitButton && typeSelect && errorElement) {
        form.reset(); 
        errorElement.style.display = 'none';
        modalTitle.textContent = 'Create New Configuration Item';
        submitButton.textContent = 'Create Item';
        document.getElementById('configEditId').value = ''; 
        typeSelect.disabled = false; 

        openModal('configModal');
    }
}
function openUpdateConfigModal(configId) {
    const form = document.getElementById('configForm');
    const modalTitle = document.getElementById('configModalTitle');
    const submitButton = document.getElementById('configFormSubmitButton');
    const typeSelect = document.getElementById('configType');
    const nameInput = document.getElementById('configName');
    const descriptionInput = document.getElementById('configDescription');
    const errorElement = document.getElementById('configFormError');


    const config = getData(CONFIG_KEY);
    let itemToEdit = null;
    let itemType = '';

    itemToEdit = (config.topics || []).find(i => i.id === configId);
    if (itemToEdit) {
        itemType = 'Topic';
    } else {
        itemToEdit = (config.categories || []).find(i => i.id === configId);
        if (itemToEdit) {
            itemType = 'Category';
        } else {
            itemToEdit = (config.roadmaps || []).find(i => i.id === configId);
            if (itemToEdit) {
                itemType = 'Roadmap';
            } else {
                
                itemToEdit = (config.courses || []).find(i => i.id === configId);
                if (itemToEdit) {
                    itemType = 'Course';
                }
                
            }
        }
    }
    if (!itemToEdit) {
        showAlert("Configuration item not found.", "Error");
        
        if (typeof displayManageConfig === 'function') { displayManageConfig(); }
        return; 
    }
    if (form && modalTitle && submitButton && typeSelect && nameInput && descriptionInput && errorElement) {
        form.reset(); 
        errorElement.style.display = 'none';
        modalTitle.textContent = `Update Config Item: ${itemToEdit.name}`;
        submitButton.textContent = 'Save Changes';
        document.getElementById('configEditId').value = configId; 

        
        typeSelect.value = itemType; 
        typeSelect.disabled = true; 
        nameInput.value = itemToEdit.name;
        descriptionInput.value = itemToEdit.description || ''; 

        openModal('configModal'); 
    } else {
        showAlert("Error: Could not load the edit form.", "Error"); 
    }
}
function handleConfigFormSubmit(event) {
    event.preventDefault();
    const adminSession = getCurrentAdminSession();
     if (!adminSession || adminSession.role !== 'Admin') {
        showAlert("Permission Denied.", "Error");
        return;
    }

    const editId = document.getElementById('configEditId').value;
    const isUpdating = !!editId;
    const type = document.getElementById('configType').value;
    const name = document.getElementById('configName').value.trim();
    const description = document.getElementById('configDescription').value.trim();
    const errorElement = document.getElementById('configFormError');

    errorElement.style.display = 'none';

    if (!type || !name) {
        errorElement.textContent = "Please select a Type and enter a Name/Value.";
        errorElement.style.display = 'block';
        return;
    }

    let config = getData(CONFIG_KEY);
    let targetArray = null;
    let arrayKey = '';

    if (type === 'Topic') { targetArray = config.topics; arrayKey = 'topics'; }
    else if (type === 'Category') { targetArray = config.categories; arrayKey = 'categories'; }
    else if (type === 'Roadmap') { targetArray = config.roadmaps; arrayKey = 'roadmaps'; }
    else if (type === 'Course') {
        targetArray = config.courses || []; 
        arrayKey = 'courses';               
    }
    else {
        errorElement.textContent = "Invalid configuration type selected.";
        errorElement.style.display = 'block';
        return;
    }

    if (!config[arrayKey]) {
        config[arrayKey] = [];
        targetArray = config[arrayKey]; 
    }
    
    let isDuplicate = false;
    for(let i=0; i < targetArray.length; i++) {
        if (targetArray[i].name.toLowerCase() === name.toLowerCase() &&
            (!isUpdating || targetArray[i].id !== editId)) { 
            isDuplicate = true;
            break;
        }
    }

    if (isDuplicate) {
        errorElement.textContent = `An item with the name "${name}" already exists for the type "${type}".`;
        errorElement.style.display = 'block';
        return;
    }

    if (isUpdating) {
        let itemIndex = -1;
        for(let i=0; i < targetArray.length; i++){
            if(targetArray[i].id === editId){
                itemIndex = i;
                break;
            }
        }

        if (itemIndex === -1) {
            errorElement.textContent = "Error: Config item to update not found.";
            errorElement.style.display = 'block';
            return;
        }
         
        config[arrayKey][itemIndex].name = name;
        config[arrayKey][itemIndex].description = description;

        setData(CONFIG_KEY, config);
        logAction(adminSession.username, 'Config Update', `Updated ${type} config item ID '${editId}' to Name: ${name}.`);
        showSuccess(`${type} item "${name}" updated successfully.`, "Update Complete", () => {
            closeModal('configModal');
            displayManageConfig(); 
            
        });

    } else {
        let idPrefix = '';
        if (type === 'Course') {
            idPrefix = 'course'; 
        } else {
            idPrefix = type.toLowerCase().substr(0, 4);
        }

        const newItem = {
            id: generateId(idPrefix),
            name: name,
            description: description,
            isActive: true 
        };

        config[arrayKey].push(newItem); 
        setData(CONFIG_KEY, config);
        logAction(adminSession.username, 'Config Create', `Created new ${type} config item: "${name}".`);
        showSuccess(`${type} item "${name}" created successfully.`, "Creation Complete", () => {
            closeModal('configModal');
            displayManageConfig(); 
            
        });
    }
}
function promptDeleteConfig(configId) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') return;

    const config = getData(CONFIG_KEY);
    let itemToDelete = null;
    let itemType = '';

    itemToDelete = (config.topics || []).find(i => i.id === configId);
    if (itemToDelete) {
        itemType = 'Topic';
    } else {
        itemToDelete = (config.categories || []).find(i => i.id === configId);
        if (itemToDelete) {
            itemType = 'Category';
        } else {
            itemToDelete = (config.roadmaps || []).find(i => i.id === configId);
            if (itemToDelete) {
                itemType = 'Roadmap';
            } else {
                itemToDelete = (config.courses || []).find(i => i.id === configId); 
                if (itemToDelete) {
                    itemType = 'Course'; 
                }
            }
        }
    }

    if (!itemToDelete) {
        showAlert("Configuration item not found.", "Error");
        
        return; 
    }

    const warningMessage = `Are you sure you want to delete the ${itemType} item "${itemToDelete.name}"? This will move it to the recycle bin. Existing feedbacks using this item will still show "${itemToDelete.name}".`;

    showConfirm(
        warningMessage,
        'Confirm Deletion',
        () => deleteConfig(configId, itemType, itemToDelete), 
        null 
    );
}
function deleteConfig(configId, itemType, itemToDelete) { 
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') return;

    let config = getData(CONFIG_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let targetArray = null;
    let arrayKey = ''; 

    if (itemType === 'Topic') {
        targetArray = config.topics;
        arrayKey = 'topics';
    } else if (itemType === 'Category') {
        targetArray = config.categories;
        arrayKey = 'categories';
    } else if (itemType === 'Roadmap') {
        targetArray = config.roadmaps;
        arrayKey = 'roadmaps';
    }
    
    else if (itemType === 'Course') {
        targetArray = config.courses;
        arrayKey = 'courses';
    }
    
    else {
        showAlert(`Invalid item type "${itemType}" for deletion.`, "Error");
        return;
    }
    
    if (!targetArray || !Array.isArray(targetArray)) {
         showAlert(`Configuration array for ${itemType} not found or invalid.`, "Error");
         return;
    }

    let itemIndex = -1;
    for (let i = 0; i < targetArray.length; i++) {
        if (targetArray[i].id === configId) {
            itemIndex = i;
            break;
        }
    }

    if (itemIndex === -1) {
        showAlert(`Configuration item with ID ${configId} not found in the active ${itemType} list.`, "Error");
        return; 
    }
    
    const configItemToDelete = targetArray[itemIndex];
    configItemToDelete.deletionDate = getCurrentTimestamp();
    configItemToDelete.deletedBy = adminSession.username; 
    configItemToDelete.itemType = itemType; 

    if (!recycleBin.deletedConfigs) {
        recycleBin.deletedConfigs = [];
    }
    recycleBin.deletedConfigs.unshift(configItemToDelete);
    
    config[arrayKey].splice(itemIndex, 1);

    setData(CONFIG_KEY, config);
    setData(RECYCLE_BIN_KEY, recycleBin);
    logAction(adminSession.username, 'Config Delete', `Deleted ${itemType} config item ID '${configId}' (Name: ${itemToDelete.name}).`);
    showSuccess(`${itemType} item moved to Recycle Bin.`, "Deletion Complete");
    displayManageConfig(); 
}

// ==========================================================================
// - 16.) Configuration Recycle Bin -
// ==========================================================================

function loadAdminConfigRecyclePage() {
    const session = getCurrentAdminSession();
    if (!session || session.role !== 'Admin') {
        showAlert("Access Denied. Administrator privileges required.", "Error");
        window.location.href = 'admin/admin-dashboard.html';
        return;
    }
    
    displayRecycleConfig('');
    const searchInput = document.getElementById('recycleConfigSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', triggerRecycleConfigSearch);
        searchInput.addEventListener('search', triggerRecycleConfigSearch);
    }
}
function displayRecycleConfig(searchTerm = '') {
    const tableBody = document.getElementById('recycleConfigBody');
    if (!tableBody) {
        return;
    }
    
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') {
    tableBody.innerHTML = `<tr><td colspan="5" class="no-data">Access Denied. Administrator privileges required.</td></tr>`;
    return;
    }

    const recycleBin = getData(RECYCLE_BIN_KEY);
    let deletedConfigs = recycleBin.deletedConfigs || [];
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (lowerSearchTerm) {
        deletedConfigs = deletedConfigs.filter(item =>
            (item.itemType && item.itemType.toLowerCase().includes(lowerSearchTerm)) ||
            (item.name && item.name.toLowerCase().includes(lowerSearchTerm)) ||
            (item.description && item.description.toLowerCase().includes(lowerSearchTerm)) || 
            (item.deletedByUsername && item.deletedByUsername.toLowerCase().includes(lowerSearchTerm)) || 
            (item.id && item.id.toLowerCase().includes(lowerSearchTerm)) 
        );
    }

    deletedConfigs.sort((a, b) => new Date(b.deletionDate) - new Date(a.deletionDate));
    tableBody.innerHTML = '';
    if (deletedConfigs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="no-data">Configuration recycle bin is empty or search returned no results.</td></tr>`;
        return;
    }

    deletedConfigs.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.itemType || 'N/A'}</td>
            <td>${item.name}</td>
            <td>${item.deletionDate || 'N/A'}</td>
            <td>${item.deletedByUsername || item.deletedBy || 'N/A'}</td> 
            <td>
                <button class="btn btn-sm btn-restore" onclick="promptRestoreConfig('${item.id}')">Restore</button>
                <button class="btn btn-sm btn-delete-perm" onclick="promptPermanentDeleteConfig('${item.id}')">Delete Permanently</button>
            </td>
        `;
    });
     
}
function triggerRecycleConfigSearch() {
    const searchTerm = document.getElementById('recycleConfigSearchInput')?.value || '';
    displayRecycleConfig(searchTerm);
}
function promptRestoreConfig(deletedConfigId) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const item = recycleBin.deletedConfigs.find(i => i.id === deletedConfigId);

    if (!item) {
        showAlert("Deleted configuration item not found.", "Error");
        displayRecycleConfig();
        return;
    }

    const config = getData(CONFIG_KEY);
    let targetArray = null;
    if (item.itemType === 'Topic') targetArray = config.topics;
    else if (item.itemType === 'Category') targetArray = config.categories;
    else if (item.itemType === 'Roadmap') targetArray = config.roadmaps;

    const nameConflict = targetArray ? targetArray.some(activeItem => activeItem.name.toLowerCase() === item.name.toLowerCase() && activeItem.isActive !== false) : false;

    let message = `Are you sure you want to restore the ${item.itemType} item "${item.name}"?`;
    if (nameConflict) {
        message += `\n\nWARNING: An active item with the same name already exists. Restoring may cause duplicates or unexpected behavior in dropdowns. Consider renaming the active item first.`;
    }


    showConfirm(
        message,
        'Confirm Restore',
        () => restoreConfig(deletedConfigId, nameConflict), 
        null
    );
}
function restoreConfig(deletedConfigId, hadNameConflict) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') return;

    let config = getData(CONFIG_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);

    const itemIndex = recycleBin.deletedConfigs.findIndex(i => i.id === deletedConfigId);
    if (itemIndex === -1) {
        showAlert("Deleted configuration item not found.", "Error");
        return;
    }

    const itemToRestore = recycleBin.deletedConfigs[itemIndex];
    const itemType = itemToRestore.itemType;
    let targetArray = null;
    let arrayKey = '';

    if (itemType === 'Topic') { targetArray = config.topics; arrayKey = 'topics'; }
    else if (itemType === 'Category') { targetArray = config.categories; arrayKey = 'categories'; }
    else if (itemType === 'Roadmap') { targetArray = config.roadmaps; arrayKey = 'roadmaps'; }
    else if (itemType === 'Course') { targetArray = config.courses; arrayKey = 'courses'; }
    else { showAlert("Invalid item type for restore.", "Error"); return; }

    if (!config[arrayKey]) {
    config[arrayKey] = []; 
    targetArray = config[arrayKey]; 
    }
     
    delete itemToRestore.deletionDate;
    delete itemToRestore.deletedBy;
    delete itemToRestore.itemType;
    itemToRestore.isActive = true; 

    targetArray.push(itemToRestore);
    recycleBin.deletedConfigs.splice(itemIndex, 1);

    setData(CONFIG_KEY, config);
    setData(RECYCLE_BIN_KEY, recycleBin);

    logAction(adminSession.username, 'Config Restore', `Restored ${itemType} config item ID '${deletedConfigId}' (Name: ${itemToRestore.name}). ${hadNameConflict ? '(Name conflict existed)' : ''}`);

    showSuccess(`${itemType} item "${itemToRestore.name}" restored successfully.${hadNameConflict ? ' Please review active items for potential duplicates.' : ''}`, "Restore Complete");
    displayRecycleConfig(); 
}
function promptPermanentDeleteConfig(deletedConfigId) {
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const item = recycleBin.deletedConfigs.find(i => i.id === deletedConfigId);

    if (!item) {
        showAlert("Deleted configuration item not found.", "Error");
        displayRecycleConfig();
        return;
    }

    showConfirm(
        `WARNING: This action is irreversible! Are you sure you want to permanently delete the ${item.itemType} item "${item.name}"?`,
        'Confirm Permanent Deletion',
        () => permanentDeleteConfig(deletedConfigId),
        null
    );
}
function permanentDeleteConfig(deletedConfigId) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession || adminSession.role !== 'Admin') return;

    let recycleBin = getData(RECYCLE_BIN_KEY);

    const itemIndex = recycleBin.deletedConfigs.findIndex(i => i.id === deletedConfigId);
    if (itemIndex === -1) {
        showAlert("Deleted configuration item not found.", "Error");
        return;
    }

    const itemToDelete = recycleBin.deletedConfigs[itemIndex];

    
    recycleBin.deletedConfigs.splice(itemIndex, 1);

    setData(RECYCLE_BIN_KEY, recycleBin);

    logAction(adminSession.username, 'Config Permanent Delete', `Permanently deleted ${itemToDelete.itemType} config item ID '${deletedConfigId}' (Name: ${itemToDelete.name}).`);

    showSuccess(`${itemToDelete.itemType} item permanently deleted.`, "Deletion Complete");
    displayRecycleConfig(); 
}

// ==========================================================================
// - 17.) Dashboard Functions -
// ==========================================================================

function loadAdminDashboard() {
    updateDashboardStats();
    displayTopTopics();
    displayFeedbackTrendsBarGraph(); 
}
function updateDashboardStats() {
    const feedbacks = getData(FEEDBACKS_KEY);
    const students = getData(STUDENTS_KEY);
    const staff = getData(STAFF_KEY);
    const recycleBin = getData(RECYCLE_BIN_KEY);
    const alumni = getData(ALUMNI_KEY);

    let pendingFeedbacks = 0;
    let approvedFeedbacks = 0;
    feedbacks.forEach(fb => {
        if (fb.status === 'pending') pendingFeedbacks++;
        else if (fb.status === 'approved') approvedFeedbacks++;
    });

    let pendingStudents = 0;
    let activeStudents = 0;
     students.forEach(s => {
        if (s.status === 'pending') pendingStudents++;
        else if (s.status === 'approved') activeStudents++;
    });

    let pendingAlumni = 0;
    let activeAlumni = 0;
    alumni.forEach(a => {
        if (a.status === 'pending') pendingAlumni++;
        else if (a.status === 'approved') activeAlumni++;
    });

    const deletedFeedbacks = (recycleBin.deletedFeedbacks || []).length;
    const totalStaff = (staff || []).filter(s => !s.isHidden).length; 

    let needsReviewCount = 0;
    const adminReviewCategoryName = "Requires Admin Review"; 
    
    for(let i = 0; i < feedbacks.length; i++) {
        
        if (feedbacks[i].category === adminReviewCategoryName && (feedbacks[i].status === 'approved' || feedbacks[i].status === 'pending')) {
            needsReviewCount++;
        }
    }

    const statNeedsReviewEl = document.getElementById('statNeedsAdminReview'); 
    if (statNeedsReviewEl) {
        statNeedsReviewEl.textContent = needsReviewCount;
        
        const cardElement = statNeedsReviewEl.closest('.stat-card');
        if (cardElement) {
            const session = getCurrentAdminSession();
            
            if (needsReviewCount > 0 && session && session.role === 'Admin') {
                cardElement.style.display = ''; 
            } else {
                cardElement.style.display = 'none'; 
            }
        }
    }

    const statPendingFeedbacksEl = document.getElementById('statPendingFeedbacks');
    const statApprovedFeedbacksEl = document.getElementById('statApprovedFeedbacks');
    const statDeletedFeedbacksEl = document.getElementById('statDeletedFeedbacks');
    const statPendingStudentsEl = document.getElementById('statPendingStudents');
    const statActiveStudentsEl = document.getElementById('statActiveStudents');
    const statTotalStaffEl = document.getElementById('statTotalStaff');
    const statPendingAlumniEl = document.getElementById('statPendingAlumni'); 
    const statActiveAlumniEl = document.getElementById('statActiveAlumni');
    const roadmapTableBody = document.getElementById('roadmapStatusTableBody');

    if(statPendingFeedbacksEl) statPendingFeedbacksEl.textContent = pendingFeedbacks;
    if(statApprovedFeedbacksEl) statApprovedFeedbacksEl.textContent = approvedFeedbacks;
    if(statDeletedFeedbacksEl) statDeletedFeedbacksEl.textContent = deletedFeedbacks;
    if(statPendingStudentsEl) statPendingStudentsEl.textContent = pendingStudents;
    if(statActiveStudentsEl) statActiveStudentsEl.textContent = activeStudents;
    if(statTotalStaffEl) statTotalStaffEl.textContent = totalStaff;
    if(statPendingAlumniEl) statPendingAlumniEl.textContent = pendingAlumni; 
    if(statActiveAlumniEl) statActiveAlumniEl.textContent = activeAlumni; 
    if (roadmapTableBody) {
        const config = getData(CONFIG_KEY);
        const roadmapsFromConfig = config.roadmaps || []; 
        const approvedFeedbacks = feedbacks.filter(fb => fb.status === 'approved'); 
    
        let roadmapCounts = {}; 

        for (let i = 0; i < roadmapsFromConfig.length; i++) {
            if (roadmapsFromConfig[i].isActive !== false) {
                roadmapCounts[roadmapsFromConfig[i].name] = 0;
            }
        }
        roadmapCounts['N/A'] = 0; 
        
        for (let i = 0; i < approvedFeedbacks.length; i++) {
            const fb = approvedFeedbacks[i];
            const statusName = fb.roadmap || 'N/A';
    
            if (roadmapCounts[statusName] !== undefined) {
                roadmapCounts[statusName]++; 
            } else {
            }
        }
    
        roadmapTableBody.innerHTML = ''; 
        let hasData = false; 
    
        for (let i = 0; i < roadmapsFromConfig.length; i++) {
            const roadmapConfigItem = roadmapsFromConfig[i];
            if (roadmapConfigItem.isActive !== false) { 
                const roadmapName = roadmapConfigItem.name;
                const count = roadmapCounts[roadmapName]; 

                const row = roadmapTableBody.insertRow(); 
                const cellStatus = row.insertCell(); 
                const cellCount = row.insertCell(); 

                cellStatus.textContent = roadmapName; 
                cellCount.textContent = count;       
                cellCount.style.textAlign = 'center'; 

                if (count > 0) {
                    hasData = true;
                }
            }
        }
        
        if (roadmapCounts['N/A'] > 0) {
            const count = roadmapCounts['N/A'];
            const row = roadmapTableBody.insertRow();
            const cellStatus = row.insertCell();
            const cellCount = row.insertCell();

            cellStatus.textContent = 'Not Assigned (N/A)';
            cellCount.textContent = count;
            cellCount.style.textAlign = 'left';
            hasData = true;
        }
        
        if (!hasData) {
            const row = roadmapTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2; 
            cell.textContent = 'No approved feedbacks found.';
            cell.className = 'no-data'; 
            cell.style.textAlign = 'center'; 
        }
    }
}
function displayTopTopics() {
    const topTopicsList = document.getElementById('topTopicsList');
    if (!topTopicsList) return;

    const feedbacks = getData(FEEDBACKS_KEY);
    const relevantFeedbacks = feedbacks.filter(fb => fb.status === 'approved');

    if (relevantFeedbacks.length === 0) {
        const placeholderItems = topTopicsList.querySelectorAll('.topic-list__item:not(.no-data)');
        placeholderItems.forEach(item => item.style.display = 'none');

        const noDataLi = topTopicsList.querySelector('.topic-list__item.no-data');
        if (noDataLi) {
            noDataLi.style.display = 'list-item';
        } else {
            topTopicsList.innerHTML = `<li class="topic-list__item no-data">No approved feedback data available.</li>`;
        }
        return;
    }
    
    const noDataLi = topTopicsList.querySelector('.topic-list__item.no-data');
    if (noDataLi) noDataLi.style.display = 'none';


    let topicCounts = {};
    relevantFeedbacks.forEach(fb => {
        const topic = fb.topic || 'Uncategorized';
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    let sortedTopics = [];
    for (const topic in topicCounts) {
        sortedTopics.push({ name: topic, count: topicCounts[topic] });
    }
    sortedTopics.sort((a, b) => b.count - a.count);

    topTopicsList.innerHTML = '';
    const topN = sortedTopics.slice(0, 3);

    if (topN.length === 0) {
         topTopicsList.innerHTML = `<li class="topic-list__item no-data">No topics found in approved feedback.</li>`;
    } else {
        topN.forEach(topic => {
            const li = document.createElement('li');
            li.className = 'topic-list__item';
            li.innerHTML = `${topic.name} <span class="topic-list__count">${topic.count}</span>`;
            topTopicsList.appendChild(li);
        });
    }
}
function displayFeedbackTrendsBarGraph() {
    const graphContainer = document.getElementById('feedbackTrendsGraphHorizontal');
    const noDataMsg = document.getElementById('feedbackTrendsNoData');

    const hBarTodayEl = document.getElementById('hBarToday');
    const hBarTodayLastYearEl = document.getElementById('hBarTodayLastYear');
    const hBar7DaysEl = document.getElementById('hBar7Days');
    const hBar30DaysEl = document.getElementById('hBar30Days');

    const hValueTodayEl = document.getElementById('hValueToday');
    const hValueTodayLastYearEl = document.getElementById('hValueTodayLastYear');
    const hValue7DaysEl = document.getElementById('hValue7Days');
    const hValue30DaysEl = document.getElementById('hValue30Days');
    
    if (!graphContainer || !noDataMsg ||
        !hBarTodayEl || !hBarTodayLastYearEl || !hBar7DaysEl || !hBar30DaysEl ||
        !hValueTodayEl || !hValueTodayLastYearEl || !hValue7DaysEl || !hValue30DaysEl) {
        const oldVerticalContainer = document.getElementById('feedbackTrendsGraph');

        if (oldVerticalContainer) oldVerticalContainer.style.display = 'none';
        if (graphContainer) graphContainer.style.display = 'none';
        if (noDataMsg) noDataMsg.style.display = 'block';

        return;
    }

    const allFeedbacks = getData(FEEDBACKS_KEY);
    
    if (!Array.isArray(allFeedbacks) || allFeedbacks.length === 0) {
        graphContainer.style.display = 'none';
        noDataMsg.style.display = 'block';
        return;
    }
    
    graphContainer.style.display = 'block';
    noDataMsg.style.display = 'none';
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
    const sevenDaysAgoStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); 
    const thirtyDaysAgoStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); 
    const todayLastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); 
    const todayLastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1); 

    let countToday = 0;
    let count7Days = 0;
    let count30Days = 0;
    let countTodayLastYear = 0;
    
    for (let i = 0; i < allFeedbacks.length; i++) {
        const fb = allFeedbacks[i];
        if (!fb.submissionDate) { 
            continue;
        }

        const submissionDate = new Date(fb.submissionDate);
        if (isNaN(submissionDate.getTime())) {
            continue; 
        }

        const submissionDayStart = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());

        if (submissionDayStart >= thirtyDaysAgoStart) {
            count30Days++;
            if (submissionDayStart >= sevenDaysAgoStart) {
                count7Days++;
                if (submissionDayStart >= todayStart) {
                    countToday++;
                }
            }
        }

        
        if (submissionDate >= todayLastYearStart && submissionDate < todayLastYearEnd) {
            countTodayLastYear++;
        }
    }
    
    const maxValue = Math.max(countToday, countTodayLastYear, count7Days, count30Days, 1);
    const widthToday = (countToday / maxValue) * 100;
    const widthTodayLastYear = (countTodayLastYear / maxValue) * 100;
    const width7Days = (count7Days / maxValue) * 100;
    const width30Days = (count30Days / maxValue) * 100;
    
    hBarTodayEl.style.width = widthToday + '%';
    hBarTodayLastYearEl.style.width = widthTodayLastYear + '%';
    hBar7DaysEl.style.width = width7Days + '%';
    hBar30DaysEl.style.width = width30Days + '%';

    hValueTodayEl.textContent = countToday;
    hValueTodayLastYearEl.textContent = countTodayLastYear;
    hValue7DaysEl.textContent = count7Days;
    hValue30DaysEl.textContent = count30Days;

    hBarTodayEl.title = `Today: ${countToday} submissions`;
    const lastYearDateString = (todayLastYearStart.getMonth() + 1) + '/' + todayLastYearStart.getDate() + '/' + todayLastYearStart.getFullYear();
    hBarTodayLastYearEl.title = `Same date last year (${lastYearDateString}): ${countTodayLastYear} submissions`;
    hBar7DaysEl.title = `Last 7 Days: ${count7Days} submissions`;
    hBar30DaysEl.title = `Last 30 Days: ${count30Days} submissions`;
}

// ==========================================================================
// - 18.) Action Log -
// ==========================================================================

function loadAdminActionLogPage() {
    displayActionLog('');
    const searchInput = document.getElementById('logSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', triggerLogSearch);
        searchInput.addEventListener('search', triggerLogSearch); 
    }
}
function displayActionLog(searchTerm = '') {
    const tableBody = document.getElementById('actionLogBody');
    if (!tableBody) return;

    let logs = getData(ACTION_LOG_KEY); 
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (lowerSearchTerm) {
        logs = logs.filter(log =>
            (log.staffUsername && log.staffUsername.toLowerCase().includes(lowerSearchTerm)) ||
            (log.actionType && log.actionType.toLowerCase().includes(lowerSearchTerm)) ||
            (log.details && log.details.toLowerCase().includes(lowerSearchTerm)) ||
            (log.timestamp && log.timestamp.includes(searchTerm)) 
        );
    }

    tableBody.innerHTML = '';
    if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="no-data">No actions logged yet.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${formatTimestampForDisplay(log.timestamp)}</td>
            <td>${log.staffUsername}</td>
            <td>${log.actionType}</td>
            <td>${log.details}</td>
        `;
    });
}
function logAction(staffUsername, actionType, details) {
    let logs = getData(ACTION_LOG_KEY);

    const newLog = {
        logId: generateId('log'),
        timestamp: getCurrentTimestamp(),
        staffUsername: staffUsername,
        actionType: actionType,
        details: details
    };

    logs.unshift(newLog);
    setData(ACTION_LOG_KEY, logs);
}

// ==========================================================================
// - 19.) Backup/Restore -
// ==========================================================================

function handleExportData() {
    const exportTextArea = document.getElementById('exportData');
    if (!exportTextArea) return;

    let exportObject = {};
    let keyCount = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith('feedbackSystem_')) {
            try { 
                exportObject[key] = JSON.parse(localStorage.getItem(key));
                keyCount++;
            } catch (e) {
            }
        }
    }

    let exportString = '';
    try { 
        exportString = JSON.stringify(exportObject, null, 2); 
    } catch (e) {
        showAlert("Error generating export data. Check console.", "Export Error");
        exportTextArea.value = "Error generating data.";
        return;
    }

    exportTextArea.value = exportString;
    showAlert(`Data generated for ${keyCount} application keys. Please copy the text from the box.`, "Export Ready");
    
}
function handleImportData() {
    const importTextArea = document.getElementById('importData');
    if (!importTextArea) return;

    const importString = importTextArea.value.trim();
    if (!importString) {
        showAlert("Please paste the exported data into the text box before importing.", "Import Error");
        return;
    }
    
    showConfirm(
        "WARNING: ARE YOU ABSOLUTELY SURE?\n\nThis will ERASE all current data in the system and replace it with the data you pasted. This action CANNOT BE UNDONE.\n\nOnly proceed if you have a valid backup and understand the consequences.",
        "Confirm Data Import (Overwrite!)",
        () => {promptForImportConfirmation(importString);},
        () => {}
    );
    
}
function promptForImportConfirmation(importString) {
    const confirmationPhrase = "OVERWRITE ALL DATA"; 

    showPrompt(
        `To confirm this irreversible action, please type the following phrase exactly:\n\n${confirmationPhrase}`, 
        'Type Confirmation Phrase:',            
        'Final Import Confirmation',            
        (typedValue) => { 
            if (typedValue === confirmationPhrase) {
                executeImport(importString); 
            } else {
                showAlert("Import cancelled. The confirmation phrase was not typed correctly.", "Import Cancelled");
                
                const importTextArea = document.getElementById('importData');
                if (importTextArea) importTextArea.value = '';
            }
        },
        () => {}
    );
}
function executeImport(importString) {
    let dataToImport;
    let parseError = false;
    
    try { 
        dataToImport = JSON.parse(importString);
    } catch(e) {
        parseError = true;
    }
    
    if (parseError || typeof dataToImport !== 'object' || dataToImport === null) {
        showAlert("Import failed. The pasted data is not valid JSON or is not in the expected format.", "Import Error");
        return;
    }

    let hasExpectedKeys = false;
    const expectedPrefix = 'feedbackSystem_';
    for (const key in dataToImport) {
        if (key.startsWith(expectedPrefix)) {
            hasExpectedKeys = true;
            break;
        }
    }
    if (!hasExpectedKeys) {
        showAlert("Import failed. The data does not seem to contain valid application keys.", "Import Error");
        return;
    }
    
    let keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(expectedPrefix)) {
            keysToRemove.push(key);
        }
    }
    for(let i = 0; i < keysToRemove.length; i++) {
        localStorage.removeItem(keysToRemove[i]);
        
    }
    
    let importCount = 0;
    let importErrors = 0;
    
    for (const key in dataToImport) {
        
        if (key.startsWith(expectedPrefix)) {
            const valueToStore = dataToImport[key];
            try { 
                
                localStorage.setItem(key, JSON.stringify(valueToStore));
                importCount++;
            } catch(e) {
                importErrors++;
            }
        }
    }
    
    if (importErrors > 0) {
        showSuccess(
            `Import partially completed with ${importErrors} errors (check console). Imported ${importCount} keys. The application will now reload. Some data might be missing or corrupted.`,
            "Import Partially Complete",
            () => { window.location.reload(); } 
        );
    } else {
        showSuccess(
            `Import successful! Imported ${importCount} keys. The application will now reload with the imported data.`,
            "Import Complete",
            () => { window.location.reload(); } 
        );
    }
}

// ==========================================================================
// - 20.) Account Deletion Flow -
// ==========================================================================

function calculateDeletionDate(days = 20) {
    const now = new Date();
    const deletionTime = now.getTime() + (days * 24 * 60 * 60 * 1000); 
    const deletionDate = new Date(deletionTime);
    
    const year = deletionDate.getFullYear();
    const month = (deletionDate.getMonth() + 1).toString().padStart(2, '0');
    const day = deletionDate.getDate().toString().padStart(2, '0');
    const hours = deletionDate.getHours().toString().padStart(2, '0');
    const minutes = deletionDate.getMinutes().toString().padStart(2, '0');
    const seconds = deletionDate.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function promptAccountDeletion(userType) {
    let session = null;
    if (userType === 'student') {
        session = getCurrentStudentSession();
    } else if (userType === 'alumni') {
        session = getCurrentAlumniSession();
    }

    if (!session) {
        showAlert("Error: Could not identify user session.", "Error");
        return;
    }

    const userId = userType === 'student' ? session.studentId : session.alumniId;
    const userName = session.fullName || (userType === 'alumni' ? session.email : userId); 
    const users = userType === 'student' ? getData(STUDENTS_KEY) : getData(ALUMNI_KEY);
    let userAccount = null;
    for(let i=0; i<users.length; i++) {
        const currentId = userType === 'student' ? users[i].studentId : users[i].alumniId;
        if(currentId === userId) {
            userAccount = users[i];
            break;
        }
    }

    if (userAccount && userAccount.status === 'pending_deletion') {
        showAlert("Your account deletion request is already pending.", "Info");
        return;
    }


    const message = `WARNING: ${userName}, are you absolutely sure you want to request account deletion?\n\n` +
                    `Your account will be deactivated immediately.\n` +
                    `If you do not log back in within 20 days, your account and all associated data (including feedback) will be PERMANENTLY DELETED.\n\n` +
                    `Logging back in within 20 days will cancel this request.`;

    showConfirm(
        message,
        "Confirm Account Deletion Request",
        () => { 
            requestAccountDeletion(userType, userId);
        },
        () => {}
    );
}
function requestAccountDeletion(userType, userId) {
    const DELETION_QUEUE_KEY = 'feedbackSystem_deletionQueue';
    let queue = getData(DELETION_QUEUE_KEY);
    let users = null;
    let userKey = '';
    let idField = '';

    if (userType === 'student') {
        users = getData(STUDENTS_KEY);
        userKey = STUDENTS_KEY;
        idField = 'studentId';
    } else if (userType === 'alumni') {
        users = getData(ALUMNI_KEY);
        userKey = ALUMNI_KEY;
        idField = 'alumniId';
    } else {
        showAlert("Invalid user type for deletion request.", "Error");
        return;
    }

    let userIndex = -1;
    for(let i=0; i < users.length; i++){
        if(users[i][idField] === userId){
            userIndex = i;
            break;
        }
    }

    if (userIndex === -1) {
        showAlert("Error: Could not find your account data.", "Error");
        return;
    }

    let alreadyInQueue = false;
    for(let i=0; i < queue.length; i++) {
        if(queue[i].userId === userId && queue[i].userType === userType) {
             alreadyInQueue = true;
             break;
        }
    }

    if (alreadyInQueue || users[userIndex].status === 'pending_deletion') {
        showAlert("Account deletion is already pending.", "Info");
        return;
    }
    
    const scheduledDeletionTimestamp = calculateDeletionDate(20); 
    const queueEntry = {
        userId: userId,
        userType: userType,
        deletionRequestTimestamp: getCurrentTimestamp(),
        scheduledDeletionTimestamp: scheduledDeletionTimestamp,
        status: 'pending_deletion' 
    };
    queue.unshift(queueEntry); 
    setData(DELETION_QUEUE_KEY, queue);

    users[userIndex].status = 'pending_deletion';
    users[userIndex].scheduledDeletionTimestamp = scheduledDeletionTimestamp; 
    setData(userKey, users);
    logoutUser(userType);
}
function cancelAccountDeletion(userId, userType) {
    const DELETION_QUEUE_KEY = 'feedbackSystem_deletionQueue';
    let queue = getData(DELETION_QUEUE_KEY);
    let users = null;
    let userKey = '';
    let idField = '';

    if (userType === 'student') {
        users = getData(STUDENTS_KEY);
        userKey = STUDENTS_KEY;
        idField = 'studentId';
    } else if (userType === 'alumni') {
        users = getData(ALUMNI_KEY);
        userKey = ALUMNI_KEY;
        idField = 'alumniId';
    } else { return; } 
    
    let queueIndex = -1;
    for(let i=0; i < queue.length; i++){
        if(queue[i].userId === userId && queue[i].userType === userType){
            queueIndex = i;
            break;
        }
    }

    if (queueIndex !== -1) {
        queue.splice(queueIndex, 1);
        setData(DELETION_QUEUE_KEY, queue);
    }
    
    let userIndex = -1;
    for(let i=0; i < users.length; i++){
        if(users[i][idField] === userId){
            userIndex = i;
            break;
        }
    }
    if (userIndex !== -1) {
        users[userIndex].status = 'approved'; 
        delete users[userIndex].scheduledDeletionTimestamp; 
        setData(userKey, users);  
    }
}
function adminCancelDeletion(userId, userType) {
    const adminSession = getCurrentAdminSession();
    if (!adminSession) {
        showAlert("Authentication error. Please log in again.", "Error");
        return;
    }
    
    const DELETION_QUEUE_KEY = 'feedbackSystem_deletionQueue';
    let queue = getData(DELETION_QUEUE_KEY);
    let users = null;
    let userKey = '';
    let idField = '';
    
    if (userType === 'student') {
        users = getData(STUDENTS_KEY);
        userKey = STUDENTS_KEY;
        idField = 'studentId';
    } else if (userType === 'alumni') {
        users = getData(ALUMNI_KEY);
        userKey = ALUMNI_KEY;
        idField = 'alumniId';
    } else {
        showAlert("Invalid user type provided for cancellation.", "Error");
        return;
    }

    let userIndex = -1;
    for (let i = 0; i < users.length; i++) {
        if (users[i][idField] === userId) {
            userIndex = i;
            break;
        }
    }

    if (userIndex === -1) {
        showAlert(`Error: Could not find ${userType} account with ID ${userId}.`, "Error");
        return;
    }
    
    if (users[userIndex].status !== 'pending_deletion') {
        showAlert(`This ${userType} account is not currently pending deletion.`, "Info");
        
        if (userType === 'student') displayManageStudents();
        else if (userType === 'alumni') displayManageAlumni();
        return;
    }

    users[userIndex].status = 'approved'; 
    delete users[userIndex].scheduledDeletionTimestamp; 
    setData(userKey, users); 
    
    let queueIndex = -1;
    for (let i = 0; i < queue.length; i++){
        if(queue[i].userId === userId && queue[i].userType === userType){
            queueIndex = i;
            break;
        }
    }

    if (queueIndex !== -1) {
        queue.splice(queueIndex, 1);
        setData(DELETION_QUEUE_KEY, queue);
    }

    logAction(adminSession.username, `${userType.charAt(0).toUpperCase() + userType.slice(1)} Deletion Cancelled`, `Admin cancelled pending deletion for ${userType} ID '${userId}'. Account reactivated.`);
    showSuccess(`${userType.charAt(0).toUpperCase() + userType.slice(1)} account deletion request cancelled successfully. The account is now active.`, "Deletion Cancelled");

    if (userType === 'student') {
        displayManageStudents(); 
    } else if (userType === 'alumni') {
        displayManageAlumni();   
    }
}
function processDeletionQueue() {
    const DELETION_QUEUE_KEY = 'feedbackSystem_deletionQueue';
    let queue = getData(DELETION_QUEUE_KEY);
    const now = Date.now();
    let changed = false; 

    const remainingQueue = []; 

    for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];
        const scheduledTime = new Date(entry.scheduledDeletionTimestamp).getTime();

        if (!isNaN(scheduledTime) && now >= scheduledTime) {
            permanentlyDeleteUserData(entry.userId, entry.userType); 
            changed = true; 
            
        } else if (isNaN(scheduledTime)) {
            changed = true; 
        }
         else {
            remainingQueue.push(entry);
        }
    }
    
    if (changed) {
        setData(DELETION_QUEUE_KEY, remainingQueue);
    }
}
function permanentlyDeleteUserData(userId, userType) {
    let success = false; 
    let users = null;
    let userKey = '';
    let idField = '';
    if (userType === 'student') {
        users = getData(STUDENTS_KEY);
        userKey = STUDENTS_KEY;
        idField = 'studentId';
    } else if (userType === 'alumni') {
        users = getData(ALUMNI_KEY);
        userKey = ALUMNI_KEY;
        idField = 'alumniId';
    } else { return; } 

    let userIndex = -1;
    for(let i=0; i<users.length; i++){
        if(users[i][idField] === userId){
            userIndex = i;
            break;
        }
    }
    if (userIndex !== -1) {
        const deletedUserName = users[userIndex].fullName || userId; 
        users.splice(userIndex, 1);
        setData(userKey, users);
        
        success = true; 
         
        logAction("System", "Account Purge", `Permanently deleted ${userType} account ${userId} (${deletedUserName}) due to expired deletion request.`);
    } else {
        logAction("System", "Account Purge Attempt", `Attempted permanent deletion for ${userType} ${userId}, but user not found in active list.`);
    }
    
    let feedbacks = getData(FEEDBACKS_KEY);
    let recycleBin = getData(RECYCLE_BIN_KEY);
    let initialFeedbackCount = feedbacks.length;
    let initialRecycledCount = (recycleBin.deletedFeedbacks || []).length;

    if (userType === 'student') {
        feedbacks = feedbacks.filter(fb => fb.studentId !== userId);
        recycleBin.deletedFeedbacks = (recycleBin.deletedFeedbacks || []).filter(fb => fb.studentId !== userId);
    } else if (userType === 'alumni') {
         
        feedbacks = feedbacks.filter(fb => !(fb.userType === 'Alumni' && fb.submitterId === userId));
         recycleBin.deletedFeedbacks = (recycleBin.deletedFeedbacks || []).filter(fb => !(fb.userType === 'Alumni' && fb.submitterId === userId));
    }

    let feedbackRemoved = initialFeedbackCount - feedbacks.length;
    let recycledRemoved = initialRecycledCount - (recycleBin.deletedFeedbacks || []).length;

    if (feedbackRemoved > 0) {
        setData(FEEDBACKS_KEY, feedbacks);
         
    }
    if (recycledRemoved > 0) {
        setData(RECYCLE_BIN_KEY, recycleBin); 
         
    }

    let userBinKey = userType === 'student' ? 'deletedStudents' : 'deletedAlumni';
    let userBinIndex = -1;
    if(recycleBin[userBinKey]) {
        for(let i=0; i < recycleBin[userBinKey].length; i++){
            if(recycleBin[userBinKey][i][idField] === userId){
                userBinIndex = i;
                break;
            }
        }
        if(userBinIndex !== -1) {
            recycleBin[userBinKey].splice(userBinIndex, 1);
            setData(RECYCLE_BIN_KEY, recycleBin); 
            
        }
    }

    return success; 
}

// ==========================================================================
// - 21.) UI -
// ==========================================================================

function setupAccordion() {
    const accordions = document.querySelectorAll('.sidebar__accordion-toggle');
    accordions.forEach(accordion => {
        const content = accordion.nextElementSibling;

        if (!content || !content.classList.contains('sidebar__accordion-content')) {
            return;
        }

        const isActiveLinkPresent = content.querySelector('.sidebar__nav-link--active');
        if (isActiveLinkPresent) {
            accordion.classList.add('sidebar__accordion-toggle--active');
            content.classList.add('sidebar__accordion-content--active');
            content.style.maxHeight = content.scrollHeight + "px";
        } else {
            content.style.maxHeight = '0px';
        }
        
        accordion.addEventListener('click', function() {
            this.classList.toggle('sidebar__accordion-toggle--active');

            if (content.style.maxHeight && content.style.maxHeight !== '0px') {
                content.style.maxHeight = '0px';
                content.classList.remove('sidebar__accordion-content--active');
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                content.classList.add('sidebar__accordion-content--active');
            }

            accordions.forEach(otherAccordion => {
                if (otherAccordion !== this) {
                    const otherContent = otherAccordion.nextElementSibling;
                    if (otherContent && otherContent.classList.contains('sidebar__accordion-content') && otherContent.style.maxHeight !== '0px') {
                        otherAccordion.classList.remove('sidebar__accordion-toggle--active');
                        otherContent.classList.remove('sidebar__accordion-content--active');
                        otherContent.style.maxHeight = '0px';
                    }
                }
            });
        });
    });
}
function setupPublicNavbarToggle() {
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarMenu = document.getElementById('navbarMenu');
    const publicNavbar = document.querySelector('.public-navbar');

    if (navbarToggle && navbarMenu && publicNavbar) {
        navbarToggle.addEventListener('click', function() {
            navbarMenu.classList.toggle('public-navbar__menu--active');
            publicNavbar.classList.toggle('public-navbar--open');
            const isExpanded = navbarMenu.classList.contains('public-navbar__menu--active');
            navbarToggle.setAttribute('aria-expanded', isExpanded);
        });

        document.addEventListener('click', function(event) {
            const isClickInsideNavbar = publicNavbar.contains(event.target);
            if (!isClickInsideNavbar && navbarMenu.classList.contains('public-navbar__menu--active')) {
                navbarMenu.classList.remove('public-navbar__menu--active');
                publicNavbar.classList.remove('public-navbar--open');
                navbarToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
}
function setupPublicNavbarDropdownClick() {
    const dropdownToggles = document.querySelectorAll('.public-navbar__menu-item.dropdown > .public-navbar__menu-link');

    dropdownToggles.forEach(toggle => {
        const dropdownMenu = toggle.nextElementSibling;

        if (dropdownMenu && dropdownMenu.classList.contains('public-navbar__dropdown-menu')) {
            toggle.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();

                // Close other open dropdowns (if any)
                document.querySelectorAll('.public-navbar__dropdown-menu--active').forEach(openMenu => {
                    if (openMenu !== dropdownMenu) {
                        openMenu.classList.remove('public-navbar__dropdown-menu--active');
                        openMenu.previousElementSibling.classList.remove('public-navbar__menu-link--active');
                    }
                });

                dropdownMenu.classList.toggle('public-navbar__dropdown-menu--active');
                toggle.classList.toggle('public-navbar__menu-link--active');
            });
        }
    });

    document.addEventListener('click', function(event) {
        const activeDropdowns = document.querySelectorAll('.public-navbar__dropdown-menu--active');
        activeDropdowns.forEach(dropdownMenu => {
            const toggle = dropdownMenu.previousElementSibling;
            if (!dropdownMenu.contains(event.target) && toggle && !toggle.contains(event.target)) {
                dropdownMenu.classList.remove('public-navbar__dropdown-menu--active');
                if (toggle) {
                    toggle.classList.remove('public-navbar__menu-link--active');
                }
            }
        });
    });
}
function setupSidebarToggle() {
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const body = document.body;

    if (sidebarToggleBtn && sidebar && body) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            body.classList.toggle('sidebar-open');
        });

        if (overlay) {
             overlay.addEventListener('click', () => {
                if (body.classList.contains('sidebar-open')) {
                    body.classList.remove('sidebar-open');
                }
             });
        }

        const sidebarLinks = sidebar.querySelectorAll('.sidebar__nav-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
            if (window.innerWidth < 1100 && body.classList.contains('sidebar-open')) {
                body.classList.remove('sidebar-open');
            }
            });
        });
    } else {
        if (!sidebarToggleBtn) console.error(" - #sidebarToggle not found");
        if (!sidebar) console.error(" - .sidebar not found");
        if (!body) console.error(" - document.body not found");
        if (!overlay) console.warn(" - .overlay not found (optional)");
    }
}
function updateToggleButton() {
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    const body = document.body;

    if (sidebarToggleBtn) {
        if (body.classList.contains('sidebar-open')) {
            sidebarToggleBtn.textContent = '✕'; 
            sidebarToggleBtn.setAttribute('aria-expanded', 'true');
            sidebarToggleBtn.setAttribute('aria-label', 'Close sidebar menu');
        } else {
            sidebarToggleBtn.textContent = '≡'; 
            sidebarToggleBtn.setAttribute('aria-expanded', 'false');
            sidebarToggleBtn.setAttribute('aria-label', 'Open sidebar menu');
        }
    }
}
function updateAdminUI() {
    const session = getCurrentAdminSession();
    const isAdmin = session && session.role === 'Admin';

    const adminOnlyElements = document.querySelectorAll('.admin-only');
    adminOnlyElements.forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });

    const adminOnlyActionRows = document.querySelectorAll('.admin-only-action');
    adminOnlyActionRows.forEach(row => {
        row.style.display = isAdmin ? '' : 'none';
    });

    if(session && session.username === 'admin') {
        const staffTableBody = document.getElementById('manageStaffBody');
        if(staffTableBody) {
            const adminRow = staffTableBody.querySelector('tr[data-username="admin"]');
            if (adminRow) {
                const deleteButton = adminRow.querySelector('.btn-delete');
                if(deleteButton) {
                    deleteButton.disabled = true;
                    deleteButton.title = 'Cannot delete the initial admin account.';
                }
            }
        }
    }
    
    const devUsername = 'dev_maint';
    if (session && session.username === devUsername) {
    
    } else if (isAdmin) {
        const staffTableBody = document.getElementById('manageStaffBody');
        if (staffTableBody) {
            const devRow = staffTableBody.querySelector(`tr[data-username="${devUsername}"]`);
            if (devRow) {
                const deleteButton = devRow.querySelector('.btn-delete');
                if(deleteButton) {
                    deleteButton.disabled = true;
                    deleteButton.title = 'Cannot delete the maintenance account.';
                }
            }
            const adminRow = staffTableBody.querySelector('tr[data-username="admin"]');
            if (adminRow) {
                const deleteButton = adminRow.querySelector('.btn-delete');
                if(deleteButton) {
                    deleteButton.disabled = true;
                    deleteButton.title = 'Cannot delete the initial admin account.';
                }
            }
        }
    }

    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const adminRoleDisplay = document.getElementById('adminRoleDisplay');
    if (adminUsernameDisplay && adminRoleDisplay && session) {
        adminUsernameDisplay.textContent = session.username;
        adminRoleDisplay.textContent = session.role;
    }
}
function addCheckboxListeners(tableId, selectAllId, rowCheckboxClass) {
    const selectAllCheckbox = document.getElementById(selectAllId);
    const table = document.getElementById(tableId);
    if (!selectAllCheckbox || !table) return;

    const rowCheckboxes = table.querySelectorAll(`.${rowCheckboxClass}`);

    selectAllCheckbox.addEventListener('change', function() {
        for (let i = 0; i < rowCheckboxes.length; i++) {
            rowCheckboxes[i].checked = this.checked;
        }
    });

    for (let i = 0; i < rowCheckboxes.length; i++) {
        rowCheckboxes[i].addEventListener('change', function() {
            if (!this.checked) {
                selectAllCheckbox.checked = false;
            }

            let allChecked = true;

            for (let k = 0; k < rowCheckboxes.length; k++) {
                if (!rowCheckboxes[k].checked) {
                    allChecked = false;
                    break;
                }
            }
             selectAllCheckbox.checked = allChecked;
        });
    }
}
function clearSelection(tableId, selectAllCheckboxId, rowCheckboxClass) {
    const selectAllCheckbox = document.getElementById(selectAllCheckboxId);
    const table = document.getElementById(tableId);

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false; 
    }

    if (table) {
        const rowCheckboxes = table.querySelectorAll(`.${rowCheckboxClass}:checked`); 
        for (let i = 0; i < rowCheckboxes.length; i++) {
            rowCheckboxes[i].checked = false; 
        }
    }
     
}

// ==========================================================================
// - 22.) Page Initialization -
// ==========================================================================

function initializeLocalStorage() {
    localStorage.removeItem('lastActivityTimestamp');

    if (!localStorage.getItem(STUDENTS_KEY)) {
        localStorage.setItem(STUDENTS_KEY, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(DELETION_QUEUE_KEY)) {
        localStorage.setItem(DELETION_QUEUE_KEY, JSON.stringify([]));
    }

    if (!localStorage.getItem(PINNED_FEEDBACKS_KEY)) {
        localStorage.setItem(PINNED_FEEDBACKS_KEY, JSON.stringify({})); 
    }

    if (!localStorage.getItem(ALUMNI_KEY)) {
        localStorage.setItem(ALUMNI_KEY, JSON.stringify([]));
    }

    if (!localStorage.getItem(STAFF_KEY)) {
        const initialStaff = [
            {
                username: 'admin',
                role: 'Admin',
                password: simpleCipher('AdminPass1!'),
                securityQuestion: 'birth_city',
                securityAnswer: 'default',
                creationDate: getCurrentTimestamp(),
                isDefaultAdmin: true,
                fullName: 'Administrator'
            },
            {
                username: 'dev_maint',
                role: 'Admin',
                password: simpleCipher('DevPassword123!'),
                securityQuestion: 'mother_maiden_name',
                securityAnswer: 'developer',
                creationDate: getCurrentTimestamp(),
                isHidden: true,
                fullName: 'Developer Maintenance'
            }
        ];
        localStorage.setItem(STAFF_KEY, JSON.stringify(initialStaff));
    }

    if (!localStorage.getItem(FEEDBACKS_KEY)) {
        localStorage.setItem(FEEDBACKS_KEY, JSON.stringify([]));
    }

    if (!localStorage.getItem(CONFIG_KEY)) {
        const initialConfig = {
            topics: [
                { id: 'topic_' + Date.now() + Math.random(), name: 'Other', description: 'Other related issues.', isActive: true },
                { id: 'topic_' + Date.now() + Math.random(), name: 'Library', description: 'Concerns about the library.', isActive: true },
                { id: 'topic_' + Date.now() + Math.random(), name: 'Classroom', description: 'Feedback regarding classrooms.', isActive: true },
                { id: 'topic_' + Date.now() + Math.random(), name: 'Faculty', description: 'Feedback concerning instructors.', isActive: true }
            ],
            categories: [
                { id: 'cat_' + Date.now() + Math.random(), name: 'Cleanliness', description: 'Hygiene and tidiness.', isActive: true },
                { id: 'cat_' + Date.now() + Math.random(), name: 'Resources', description: 'Availability of materials/equipment.', isActive: true },
                { id: 'cat_' + Date.now() + Math.random(), name: 'Maintenance', description: 'Repairs and upkeep needed.', isActive: true },
                { id: 'cat_' + Date.now() + Math.random(), name: 'Suggestion', description: 'Ideas for improvement.', isActive: true },
                { id: 'cat_' + Date.now() + Math.random(), name: 'Requires Admin Review', description: 'Flagged by Moderator for Admin attention (sensitive content, policy issue, etc.)', isActive: true },
                { id: 'cat_' + Date.now() + Math.random(), name: 'Uncategorized', description: 'Category not implemented yet.', isActive: true }
            ],
            roadmaps: [
                { id: 'road_' + Date.now() + Math.random(), name: 'Received', description: 'Feedback acknowledged.', isActive: true },
                { id: 'road_' + Date.now() + Math.random(), name: 'Under Review', description: 'Feedback is being evaluated.', isActive: true },
                { id: 'road_' + Date.now() + Math.random(), name: 'In Progress', description: 'Action is being taken.', isActive: true },
                { id: 'road_' + Date.now() + Math.random(), name: 'Resolved', description: 'Feedback has been addressed.', isActive: true },
                { id: 'road_' + Date.now() + Math.random(), name: 'Rejected', description: 'Feedback will not be actioned.', isActive: true }
            ],
            courses: DEFAULT_COURSES,
            adminRecoveryPin: 'DCSApinR3c'
        };
        localStorage.setItem(CONFIG_KEY, JSON.stringify(initialConfig));
    } else {
        let config = getData(CONFIG_KEY);
        let configChanged = false;
        if (typeof config.adminRecoveryPin === 'undefined' || config.adminRecoveryPin.length !== 10) { 
            
            config.adminRecoveryPin = 'DCSApinR3c';
            configChanged = true;
        }
        if (!Array.isArray(config.courses)) {
            config.courses = DEFAULT_COURSES;
            configChanged = true;
        }
        
        if (configChanged) {
            setData(CONFIG_KEY, config);
            
        }
    }

    if (!localStorage.getItem(ACTION_LOG_KEY)) {
        localStorage.setItem(ACTION_LOG_KEY, JSON.stringify([]));
    }

    if (!localStorage.getItem(RECYCLE_BIN_KEY)) {
        const initialRecycleBin = {
            deletedStudents: [],
            deletedStaff: [],
            deletedFeedbacks: [],
            deletedConfigs: [],
            deletedAlumni: []
        };
        localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(initialRecycleBin));
    }

    if (!localStorage.getItem(LOGIN_ATTEMPTS_KEY)) {
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({}));
    }

    if (!localStorage.getItem(FEEDBACK_COOLDOWN_KEY)) {
        localStorage.setItem(FEEDBACK_COOLDOWN_KEY, JSON.stringify({}));
    }

    if (!localStorage.getItem(SESSIONS_KEY)) {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify({ student: null, admin: null, alumni: null }));
    }

    cleanupExpiredLockouts();
}
function loadSignupPage() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
        const studentIdInput = document.getElementById('studentId');
        if (studentIdInput) {
            studentIdInput.addEventListener('input', forceNumericInput);
        }

        const yearGraduatedInput = document.getElementById('alumniYearGraduated');
        if (yearGraduatedInput) {
            yearGraduatedInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4);
            });
        }
        const yearSelect = document.getElementById('alumniYearGraduated');
        if (yearSelect) {
            const currentYear = new Date().getFullYear();
            const startYear = 1950;

            for (let i = yearSelect.options.length - 1; i >= 1; i--) {
                yearSelect.remove(i);
            }

            for (let year = currentYear; year >= startYear; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }
        }

        const config = getData(CONFIG_KEY);
        const courses = config.courses || [];
        
        populateDropdown('studentCourse', courses, 'name', 'name', 'Select your course/strand');
        populateDropdown('alumniCourseCompleted', courses, 'name', 'name', 'Select Course Completed');
        toggleSignupFields();
    }
}
function loadLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const loginIdentifierInput = document.getElementById('loginIdentifier');
    const lockoutMessageEl = document.getElementById('lockoutMessage');
    const loginButton = document.getElementById('loginButton');
    const formIdentifier = 'student_login';

    if (!loginForm || !loginIdentifierInput || !lockoutMessageEl || !loginButton) {
        return;
    }
    loginForm.addEventListener('submit', handleLogin);

    const initialLockoutStatus = checkLockoutStatus(formIdentifier);
    if (initialLockoutStatus.lockedOut) {
        displayLockoutMessage('lockoutMessage', initialLockoutStatus.lockoutTime, 'loginButton', formIdentifier);
    } else {
        lockoutMessageEl.style.display = 'none';
        loginButton.disabled = false;
    }

    loginIdentifierInput.addEventListener('input', forceNumericInput);
}
function loadAlumniLoginPage() {
    const alumniLoginForm = document.getElementById('alumniLoginForm');
    const alumniLoginEmailInput = document.getElementById('alumniLoginEmail');
    const lockoutMessageEl = document.getElementById('alumniLockoutMessage');
    const alumniLoginButton = document.getElementById('alumniLoginButton');
    const errorElement = document.getElementById('alumniLoginError');
    const formIdentifier = 'alumni_login'; 

    if (!alumniLoginForm || !alumniLoginEmailInput || !lockoutMessageEl || !alumniLoginButton || !errorElement) {
        if (errorElement) {
            errorElement.textContent = "Page loading error. Required elements missing.";
            errorElement.style.display = 'block';
        }
        return;
    }
    alumniLoginForm.addEventListener('submit', handleAlumniLogin);

    const initialLockoutStatus = checkLockoutStatus(formIdentifier);
    if (initialLockoutStatus.lockedOut) {
        displayLockoutMessage('alumniLockoutMessage', initialLockoutStatus.lockoutTime, 'alumniLoginButton', formIdentifier); 
    } else {
        lockoutMessageEl.style.display = 'none';
        alumniLoginButton.disabled = false;
    }
}
function loadAdminLoginPage() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminLoginUsernameInput = document.getElementById('adminLoginUsername');
    const adminLoginButton = document.getElementById('adminLoginButton');
    const initialCredsElement = document.getElementById('initialAdminInfo');
    const errorElement = document.getElementById('adminLoginError');
    const lockoutMessageEl = document.getElementById('adminLockoutMessage');
    const formIdentifier = 'admin_login';

    if (!adminLoginForm || !adminLoginUsernameInput || !adminLoginButton || !initialCredsElement || !errorElement || !lockoutMessageEl) {
        if (errorElement) {
             errorElement.textContent = "Page loading error. Required elements missing.";
             errorElement.style.display = 'block';
        }
        return;
    }
    adminLoginForm.addEventListener('submit', handleAdminLogin);

    const initialLockoutStatus = checkLockoutStatus(formIdentifier);
    if (initialLockoutStatus.lockedOut) {
        displayLockoutMessage('adminLockoutMessage', initialLockoutStatus.lockoutTime, 'adminLoginButton', formIdentifier); 
    } else {
        lockoutMessageEl.style.display = 'none';
        adminLoginButton.disabled = false;
    }

    const initialLoginFlag = localStorage.getItem('feedbackSystem_initialAdminLoginComplete');
    if (initialLoginFlag === 'true') {
        initialCredsElement.style.display = 'none';
    } else {
        initialCredsElement.style.display = 'block';
        initialCredsElement.innerHTML = `
            Initial Admin Account:<br>
            Username: <strong>admin</strong><br>
            Password: <strong>AdminPass1!</strong><br>
            (Please change this password immediately after first login)
        `;
    }
}
function loadStudentDashboard() {
    const session = getCurrentStudentSession();
    if (!session) return; 

    const studentNameDisplay = document.getElementById('studentNameDisplay');
    if (studentNameDisplay) {
        studentNameDisplay.textContent = session.fullName;
    }
}
function loadAlumniDashboard() {
    const session = getCurrentAlumniSession(); 
    if (!session) {
        redirectToLogin('alumni'); 
        return; 
    }
    const alumniNameDisplay = document.getElementById('alumniNameDisplay');
    const alumniIdentifierDisplay = document.getElementById('alumniIdentifierDisplay'); 

    if (alumniNameDisplay) {
        alumniNameDisplay.textContent = session.fullName; 
    }
    if (alumniIdentifierDisplay) {
        
        alumniIdentifierDisplay.textContent = session.email; 
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const initialAdminLoginDone = localStorage.getItem('feedbackSystem_initialAdminLoginComplete');
    const currentPagePath = window.location.pathname;
    const currentPageName = currentPagePath.substring(currentPagePath.lastIndexOf('/') + 1).split(/[?#]/)[0];

    if (initialAdminLoginDone !== 'true' && currentPageName !== 'admin-login.html') {
        let redirectToPath = 'admin-login.html';

        const knownSubfolders = ['/student/', '/admin/', '/alumni/'];
        let isInSubfolder = false;
        for (let i = 0; i < knownSubfolders.length; i++) {
            if (currentPagePath.includes(knownSubfolders[i])) {
                isInSubfolder = true;
                break;
            }
        }

        if (isInSubfolder) {
            redirectToPath = '../admin-login.html';
        } else if (currentPageName === 'dev-maintenance.html' || currentPageName === 'export-feedbacks.html') {}

        window.location.href = redirectToPath;
        return;
    }

    try {
        initializeLocalStorage();
        autoCleanRecycleBin();
    } catch (error) {
        alert("A critical error occurred initializing the application data. Please check the console.");
        return;
    }

    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;
    const themeKey = 'feedbackSystem_themePreference';

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.textContent = 'Switch to Light Mode';
        } else {
            body.classList.remove('dark-mode');
            if (darkModeToggle) darkModeToggle.textContent = 'Switch to Dark Mode';
        }
        updateSidebarIconsForTheme();
    }

    const savedTheme = localStorage.getItem(themeKey);
    applyTheme(savedTheme || 'light');

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            let newTheme;
            if (body.classList.contains('dark-mode')) {
                newTheme = 'light';
            } else {
                newTheme = 'dark';
            }
            applyTheme(newTheme);
            localStorage.setItem(themeKey, newTheme);
        });
    }

    if (document.getElementById('sidebarToggle')) {
        setupSidebarToggle();
    }

    const pagePath = window.location.pathname;
    const pageName = pagePath.substring(pagePath.lastIndexOf('/') + 1).split(/[?#]/)[0];
    const isStudentPage = pagePath.includes('/student/');
    const isAdminPage = pagePath.includes('/admin/');
    const isAlumniPage = pagePath.includes('/alumni/');
    const isProtectedRootPage = ['export-feedbacks.html', 'dev-maintenance.html'].includes(pageName);
    const isPublicPage = !isStudentPage && !isAdminPage && !isAlumniPage && !isProtectedRootPage;

    if (document.querySelector('.admin-wrapper')) {
        setupSidebarToggle();
    }

    if (document.getElementById('navbarToggle') && document.getElementById('navbarMenu')) {
        setupPublicNavbarToggle();
        setupPublicNavbarDropdownClick();
    }

    if (isProtectedRootPage) {
        if (checkSessionTimeout()) return;
        if (!isAdminLoggedIn()) {
            window.location.href = 'admin-login.html';
            return;
        }

        if (pageName === 'dev-maintenance.html') {
            const session = getCurrentAdminSession();
            if (!session || session.username !== 'dev_maint') {
                showAlert("Access Denied.", "Error");
                window.location.href = 'admin-login.html';
                return;
            }
            const resetButton = document.getElementById('resetAdminFlagButton');
            const logoutLink = document.getElementById('devLogoutLink');
            if (resetButton) { resetButton.addEventListener('click', handleResetAdminFlag); }
            if (logoutLink) { logoutLink.addEventListener('click', (e) => { e.preventDefault(); promptLogout('admin'); }); }
            const devThemeKey = 'feedbackSystem_themePreference';
            const devSavedTheme = localStorage.getItem(devThemeKey);
            if (devSavedTheme === 'dark') { document.body.classList.add('dark-mode'); }
        }
        // No specific load function needed for export-feedbacks.html here, its own script handles it.

    } else if (isPublicPage) {
        if (pageName === 'signup.html') { loadSignupPage(); } 
        else if (pageName === 'login.html') { 
            if (isStudentLoggedIn()) { window.location.href = 'student/student-dashboard.html'; return; }
            loadLoginPage(); 
        } 
        else if (pageName === 'admin-login.html') {
            if (isAdminLoggedIn()) {
                const session = getCurrentAdminSession();
                if (session && session.username === 'dev_maint') { window.location.href = 'dev-maintenance.html'; }
                else { window.location.href = 'admin/admin-dashboard.html'; }
                return;
            }
            loadAdminLoginPage();
        } else if (pageName === 'forgot-password.html') {
            loadForgotPasswordPage();
        } else if (pageName === 'alumni-login.html') {
            if (isAlumniLoggedIn()) { window.location.href = 'alumni/alumni-dashboard.html'; return; }
            loadAlumniLoginPage();
        }
    } else if (isStudentPage) {
        if (checkSessionTimeout()) return;
        if (!isStudentLoggedIn()) {
            window.location.href = '../login.html';
            return;
        }
        if (sessionTimeoutIntervalId) clearInterval(sessionTimeoutIntervalId);
        sessionTimeoutIntervalId = setInterval(checkSessionTimeout, 60000);

        setupAccordion();
        const session = getCurrentStudentSession();
        const usernameDisplays = document.querySelectorAll('#studentUsernameDisplay');
        usernameDisplays.forEach(el => { if (el && session) el.textContent = session.studentId; });
        const logoutLinks = document.querySelectorAll('#studentLogoutLink');
        logoutLinks.forEach(el => { if (el) el.onclick = () => promptLogout('student'); });

        if (pageName === 'student-dashboard.html') { loadStudentDashboard(); }
        else if (pageName === 'submit-feedback.html') { loadSubmitFeedbackPage(); }
        else if (pageName === 'feedback-history.html') { loadFeedbackHistoryPage(); }
        else if (pageName === 'student-settings.html') { loadStudentSettingsPage(); }
        else if (pageName === 'change-password-student.html') { }

    } else if (isAdminPage) {
        if (checkSessionTimeout()) return;
        if (!isAdminLoggedIn()) {
            window.location.href = '../admin-login.html';
            return;
        }
        const session = getCurrentAdminSession();
        if (session && session.username === 'dev_maint') {
            showAlert("Access Denied. Maintenance account cannot access this page.", "Error");
            window.location.href = '../dev-maintenance.html';
            return;
        }

        if (sessionTimeoutIntervalId) clearInterval(sessionTimeoutIntervalId);
        sessionTimeoutIntervalId = setInterval(checkSessionTimeout, 60000);
        
        setupAccordion();
        updateAdminUI();
        const logoutLinks = document.querySelectorAll('#adminLogoutLink');
        logoutLinks.forEach(el => { if (el) el.onclick = () => promptLogout('admin'); });

        if (pageName === 'admin-dashboard.html') { loadAdminDashboard(); }
        else if (pageName === 'admin-action-log.html') { loadAdminActionLogPage(); }
        else if (pageName === 'admin-feedbacks.html') { loadAdminFeedbacksPage(); }
        else if (pageName === 'admin-pinned-feedbacks.html') { displayPinnedFeedbacks(); }
        else if (pageName === 'admin-feedbacks-recycle.html') { loadAdminFeedbacksRecyclePage(); }
        else if (pageName === 'admin-users-students.html') { loadAdminUsersStudentsPage(); }
        else if (pageName === 'admin-users-alumni.html') { loadAdminUsersAlumniPage(); }
        else if (pageName === 'admin-users-staff.html') { loadAdminUsersStaffPage(); }
        else if (pageName === 'admin-users-recycle.html') { loadAdminUsersRecyclePage(); }
        else if (pageName === 'admin-config.html') { loadAdminConfigPage(); }
        else if (pageName === 'admin-backup.html') {
            const adminSessionCheck = getCurrentAdminSession();
            if (!adminSessionCheck || adminSessionCheck.role !== 'Admin') {
                showAlert("Access Denied. Administrator privileges required.", "Error");
                window.location.href = 'admin-dashboard.html';
                return;
            }
            const exportBtn = document.getElementById('exportButton');
            const importBtn = document.getElementById('importButton');
            if (exportBtn) { exportBtn.addEventListener('click', handleExportData); }
            if (importBtn) { importBtn.addEventListener('click', handleImportData); }
        }
        else if (pageName === 'admin-config-recycle.html') { loadAdminConfigRecyclePage(); }
        else if (pageName === 'staff-settings.html') { loadStaffSettingsPage(); }

    } else if (isAlumniPage) {
        if (checkSessionTimeout()) return;
        if (!isAlumniLoggedIn()) {
            window.location.href = '../alumni-login.html';
            return;
        }

        if (sessionTimeoutIntervalId) clearInterval(sessionTimeoutIntervalId);
        sessionTimeoutIntervalId = setInterval(checkSessionTimeout, 60000);
        
        setupAccordion();
        const session = getCurrentAlumniSession();
        const identifierDisplays = document.querySelectorAll('#alumniIdentifierDisplay');
        identifierDisplays.forEach(el => { if (el && session) el.textContent = session.email; });
        const logoutLinks = document.querySelectorAll('#alumniLogoutLink');
        logoutLinks.forEach(el => { if (el) el.onclick = () => promptLogout('alumni'); });

        if (pageName === 'alumni-dashboard.html') { loadAlumniDashboard(); }
        else if (pageName === 'alumni-settings.html') { loadAlumniSettingsPage(); }
        else if (pageName === 'alumni-submit-feedback.html') { loadAlumniSubmitFeedbackPage(); }
        else if (pageName === 'alumni-feedback-history.html') { loadAlumniFeedbackHistoryPage(); }
    }

    document.body.addEventListener('click', recordUserActivity);
    document.body.addEventListener('keypress', recordUserActivity);
});

// ==========================================================================
// - 23.) Developer Maintenance Functions -
// ==========================================================================

function handleResetAdminFlag() {
    showConfirm(
        "Are you sure you want to reset the Initial Admin Setup?\n\nThis will:\n1. Make the notice show again on the login page.\n2. Reset the 'admin' account password to the default 'AdminPass1!'.\n\nThis action cannot be undone.", 
        "Confirm Admin Reset",
        () => { 
            let success = false; 

            localStorage.setItem('feedbackSystem_initialAdminLoginComplete', 'false');
            
            let staff = getData(STAFF_KEY); 
            let adminIndex = -1;
            
            for(let i = 0; i < staff.length; i++) {
                if (staff[i].username === 'admin') {
                    adminIndex = i;
                    break;
                }
            }

            if (adminIndex > -1) {
                
                const defaultPassword = 'AdminPass1!';
                staff[adminIndex].password = simpleCipher(defaultPassword); 
                setData(STAFF_KEY, staff); 
                
                success = true;
            } else {
                showAlert("Admin Setup flag reset, but failed to find the 'admin' account to reset its password. Please check the data.", "Partial Reset Error");
                
                const session = getCurrentAdminSession();
                if(session && session.username === 'dev_maint') {
                    logAction(session.username, 'Maintenance Action Error', 'Reset initialAdminLoginComplete flag, but failed to find/reset admin password.');
                }
                return; 
            }

            const session = getCurrentAdminSession();
            if(session && session.username === 'dev_maint') {
                logAction(session.username, 'Maintenance Action', "Reset initialAdminLoginComplete flag AND reset 'admin' password to default.");
            }

            showSuccess("Initial Admin setup flag and password have been reset successfully.", "Reset Complete");
        },
        () => { 
             
        }
    );
}
function autoCleanRecycleBin() {
    let recycleBin = getData(RECYCLE_BIN_KEY);
    const now = Date.now(); 
    const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000; 
    let changed = false; 

    const typesToClean = ['deletedStudents', 'deletedStaff', 'deletedFeedbacks', 'deletedConfigs', 'deletedAlumni'];

    for (let i = 0; i < typesToClean.length; i++) {
        const key = typesToClean[i]; 
        const items = recycleBin[key] || []; 
        const originalCount = items.length;

        if (originalCount === 0) {
            continue; 
        }

        const keptItems = []; 
        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            let keep = true; 

            if (item.deletionDate) {
                const deletionTimestamp = new Date(item.deletionDate).getTime(); 
                
                if (!isNaN(deletionTimestamp) && (now - deletionTimestamp > thirtyDaysInMillis)) {
                    keep = false; 
                    
                }
            }
             
            if (keep) {
                keptItems.push(item);
            }
        }

        if (keptItems.length !== originalCount) {
            recycleBin[key] = keptItems;
            changed = true;
            
        }
    }

    if (changed) {
        setData(RECYCLE_BIN_KEY, recycleBin);
    }
}

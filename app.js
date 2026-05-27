/**
 * AuraCal - Calendar Application JavaScript Logic
 * Features: Responsive grid rendering, LocalStorage persistence, custom color/notes,
 * custom text contrast adjustment, theme switching, backup/restore.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // State Variables
    // ==========================================================================
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth(); // 0-11
    let currentYear = currentDate.getFullYear();
    let selectedDateStr = null; // Stores currently editing YYYY-MM-DD date

    // Main local database object
    // Schema: { "YYYY-MM-DD": { notes: "text", checkboxes: { diary, one, two, thought } } }
    let calendarData = {};

    // Constant Months and Days names
    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // ==========================================================================
    // DOM Elements
    // ==========================================================================
    const monthYearDisplay = document.getElementById('month-year-display');
    const calendarDaysGrid = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-btn');
    const jumpMonthSelect = document.getElementById('jump-month');
    const jumpYearSelect = document.getElementById('jump-year');
    
    // Stats
    const pendingDaysCountBadge = document.getElementById('pending-days-count');
    const monthCompletionBadge = document.getElementById('month-completion-percentage');

    // Modals
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const modalDateTitle = document.getElementById('modal-date-title');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const clearDayBtn = document.getElementById('clear-day-btn');
    const notesTextarea = document.getElementById('notes-textarea');
    
    // Modal Checkboxes
    const modalCbDiary = document.getElementById('modal-cb-diary');
    const modalCbOne = document.getElementById('modal-cb-one');
    const modalCbTwo = document.getElementById('modal-cb-two');
    const modalCbThought = document.getElementById('modal-cb-thought');
    


    // Mobile Sidebar Elements
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // Theme & Backup
    const themeToggleBtn = document.getElementById('theme-toggle');
    const exportBtn = document.getElementById('export-btn');
    const importTriggerBtn = document.getElementById('import-trigger-btn');
    const importFileInput = document.getElementById('import-file');
    
    // Cloud Guide
    const dbGuideBtn = document.getElementById('db-guide-btn');
    const dbGuideModal = document.getElementById('db-guide-modal');
    const closeGuideModal = document.getElementById('close-guide-modal');
    const closeGuideFooterBtn = document.getElementById('close-guide-footer-btn');

    // Toast
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // ==========================================================================
    // Database Functions
    // ==========================================================================
    function loadDatabase() {
        try {
            const data = localStorage.getItem('auracal_data');
            calendarData = data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading data from localStorage:', e);
            calendarData = {};
            showToast('Failed to load database. Initialized empty calendar.', 'danger');
        }
        updateStats(currentYear, currentMonth);
    }

    function saveDatabase() {
        try {
            localStorage.setItem('auracal_data', JSON.stringify(calendarData));
            updateStats(currentYear, currentMonth);
        } catch (e) {
            console.error('Error saving data to localStorage:', e);
            showToast('Failed to save changes to storage.', 'danger');
        }
    }

    function updateStats(year, month) {
        const totalDays = new Date(year, month + 1, 0).getDate(); // Days in current month
        let pendingDays = 0;
        let totalCheckedInMonth = 0;

        for (let day = 1; day <= totalDays; day++) {
            const dateStr = formatDateString(year, month, day);
            const savedData = calendarData[dateStr];
            const cb = (savedData && savedData.checkboxes) ? savedData.checkboxes : {};
            
            const checkedCount = [cb.diary, cb.one, cb.two, cb.thought].filter(Boolean).length;
            
            if (checkedCount < 4) {
                pendingDays++;
            }
            totalCheckedInMonth += checkedCount;
        }

        const totalPossibleTasks = totalDays * 4;
        const progressPercentage = totalPossibleTasks > 0 
            ? Math.round((totalCheckedInMonth / totalPossibleTasks) * 100) 
            : 0;

        pendingDaysCountBadge.textContent = pendingDays;
        monthCompletionBadge.textContent = `${progressPercentage}%`;
    }

    // ==========================================================================
    // UI Helpers (Toast, Luminance contrast check)
    // ==========================================================================
    function showToast(message, type = 'success') {
        toastMessage.textContent = message;
        toast.className = 'toast'; // Reset
        if (type === 'danger') {
            toast.style.backgroundColor = 'var(--color-danger)';
            toast.style.color = '#ffffff';
        } else {
            toast.style.backgroundColor = 'var(--text-primary)';
            toast.style.color = 'var(--text-inverse)';
        }
        toast.classList.remove('hidden');
        
        // Auto hide after 3 seconds
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        window.toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }



    // ==========================================================================
    // Calendar Generation
    // ==========================================================================
    function initJumpSelectors() {
        // Populate Months
        jumpMonthSelect.innerHTML = '';
        MONTHS.forEach((month, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = month;
            jumpMonthSelect.appendChild(option);
        });

        // Populate Years (Current Year - 10 to Current Year + 10)
        jumpYearSelect.innerHTML = '';
        const startYear = currentYear - 10;
        const endYear = currentYear + 10;
        for (let y = startYear; y <= endYear; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            jumpYearSelect.appendChild(option);
        }

        // Set values
        jumpMonthSelect.value = currentMonth;
        jumpYearSelect.value = currentYear;
    }

    function renderCalendar() {
        calendarDaysGrid.innerHTML = '';
        
        // Sync Jump Selectors
        jumpMonthSelect.value = currentMonth;
        jumpYearSelect.value = currentYear;

        // Display Header
        monthYearDisplay.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

        // Get key dates
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // Day of week (0-6)
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate(); // Days in current month
        const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate(); // Days in prev month
        
        // We will render exactly 42 cells (6 rows * 7 days) to maintain layout consistency
        const totalCells = 42;
        
        // Render Previous Month Padding Days (Inactive)
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const prevDayNum = prevTotalDays - i;
            const cell = createDayCell(prevDayNum, true);
            calendarDaysGrid.appendChild(cell);
        }

        // Render Active Month Days
        const todayObj = new Date();
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = formatDateString(currentYear, currentMonth, day);
            const isToday = todayObj.getDate() === day && 
                            todayObj.getMonth() === currentMonth && 
                            todayObj.getFullYear() === currentYear;
            
            const cell = createDayCell(day, false, dateStr, isToday);
            calendarDaysGrid.appendChild(cell);
        }

        // Render Next Month Padding Days (Inactive)
        const remainingCells = totalCells - (firstDayIndex + totalDays);
        for (let day = 1; day <= remainingCells; day++) {
            const cell = createDayCell(day, true);
            calendarDaysGrid.appendChild(cell);
        }

        // Update Stats for the displayed month
        updateStats(currentYear, currentMonth);
    }

    function formatDateString(year, month, day) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }

    function createDayCell(dayNum, isInactive, dateStr = null, isToday = false) {
        const cell = document.createElement('div');
        cell.classList.add('day-cell');
        
        if (isInactive) {
            cell.classList.add('inactive');
            cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
            return cell;
        }

        if (isToday) {
            cell.classList.add('today');
        }

        // Day number
        const numberSpan = document.createElement('span');
        numberSpan.classList.add('day-number');
        numberSpan.textContent = dayNum;
        cell.appendChild(numberSpan);

        // Retrieve Saved Data for this Day
        const savedData = calendarData[dateStr];
        
        // Always render the 4 checkboxes row for active cells
        const cbRow = document.createElement('div');
        cbRow.classList.add('cell-checkboxes-row');

        const cbTypes = [
            { key: 'diary', icon: '<i class="fa-solid fa-book"></i>', label: 'Diary' },
            { key: 'one', icon: '1', label: 'Task 1' },
            { key: 'two', icon: '2', label: 'Task 2' },
            { key: 'thought', icon: '<i class="fa-solid fa-brain"></i>', label: 'Decision' }
        ];

        const dayCheckboxes = (savedData && savedData.checkboxes) ? savedData.checkboxes : {};
        
        // Add completion class if all 4 tasks are completed
        const checkedCount = [dayCheckboxes.diary, dayCheckboxes.one, dayCheckboxes.two, dayCheckboxes.thought].filter(Boolean).length;
        if (checkedCount === 4) {
            cell.classList.add('completed-day');
        }

        cbTypes.forEach(type => {
            const cbBtn = document.createElement('button');
            cbBtn.classList.add('cell-cb-btn', `cb-${type.key}`);
            cbBtn.innerHTML = type.icon;
            cbBtn.title = type.label;
            cbBtn.type = 'button';
            
            if (dayCheckboxes[type.key]) {
                cbBtn.classList.add('active');
            }
            
            // Toggle checklist state directly on calendar grid click
            cbBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop click from opening details modal
                toggleCellCheckbox(dateStr, type.key);
            });
            
            cbRow.appendChild(cbBtn);
        });
        cell.appendChild(cbRow);

        if (savedData) {
            // Meta indicators: notes preview & indicator dot
            const cellMeta = document.createElement('div');
            cellMeta.classList.add('cell-meta');

            if (savedData.notes && savedData.notes.trim() !== '') {
                // Preview text (shown on desktop)
                const preview = document.createElement('div');
                preview.classList.add('note-preview');
                preview.textContent = savedData.notes;
                cell.appendChild(preview);

                // Dot badge (shown on mobile, fallback on desktop)
                const badge = document.createElement('span');
                badge.classList.add('note-indicator');
                badge.innerHTML = `<i class="fa-solid fa-file-lines"></i>`;
                badge.title = savedData.notes;
                cellMeta.appendChild(badge);
            }
            
            cell.appendChild(cellMeta);
        }

        // Click event opens editor modal
        cell.addEventListener('click', () => openEditModal(dateStr, dayNum));

        return cell;
    }

    function toggleCellCheckbox(dateStr, key) {
        if (!calendarData[dateStr]) {
            calendarData[dateStr] = { notes: '', checkboxes: {} };
        }
        if (!calendarData[dateStr].checkboxes) {
            calendarData[dateStr].checkboxes = {};
        }
        
        const currentStatus = !!calendarData[dateStr].checkboxes[key];
        calendarData[dateStr].checkboxes[key] = !currentStatus;
        
        // Clean up data if completely default/empty
        const cb = calendarData[dateStr].checkboxes;
        const hasActiveCb = cb.diary || cb.one || cb.two || cb.thought;
        
        if ((!calendarData[dateStr].notes || calendarData[dateStr].notes.trim() === '') && 
            !hasActiveCb) {
            delete calendarData[dateStr];
        }
        
        saveDatabase();
        renderCalendar();
    }

    // ==========================================================================
    // Modal Event Handlers & Color Swatches
    // ==========================================================================
    function openEditModal(dateStr, dayNum) {
        selectedDateStr = dateStr;
        
        // Set nice human-readable title
        const dateObj = new Date(selectedDateStr + 'T00:00:00'); // Standard local parsing
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        modalDateTitle.textContent = dateObj.toLocaleDateString('en-US', options);

        // Load current configurations
        const savedData = calendarData[dateStr] || { notes: '', checkboxes: {} };
        notesTextarea.value = savedData.notes || '';
        
        const dayCheckboxes = savedData.checkboxes || {};
        modalCbDiary.checked = !!dayCheckboxes.diary;
        modalCbOne.checked = !!dayCheckboxes.one;
        modalCbTwo.checked = !!dayCheckboxes.two;
        modalCbThought.checked = !!dayCheckboxes.thought;

        // Open modal
        editModal.classList.add('active');
        notesTextarea.focus();
    }

    // Form Submit (Save Changes)
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const noteText = notesTextarea.value.trim();
        const isDiary = modalCbDiary.checked;
        const isOne = modalCbOne.checked;
        const isTwo = modalCbTwo.checked;
        const isThought = modalCbThought.checked;
        
        const hasCheckboxes = isDiary || isOne || isTwo || isThought;

        if (noteText === '' && !hasCheckboxes) {
            // Delete if no details
            delete calendarData[selectedDateStr];
        } else {
            // Store / Update
            calendarData[selectedDateStr] = {
                notes: noteText,
                checkboxes: {
                    diary: isDiary,
                    one: isOne,
                    two: isTwo,
                    thought: isThought
                }
            };
        }

        saveDatabase();
        closeModal();
        renderCalendar();
        showToast('Calendar updated successfully!');
    });

    // Clear Button
    clearDayBtn.addEventListener('click', () => {
        if (calendarData[selectedDateStr]) {
            delete calendarData[selectedDateStr];
            saveDatabase();
            renderCalendar();
            showToast('Day settings cleared.', 'danger');
        }
        closeModal();
    });

    function closeModal() {
        editModal.classList.remove('active');
        selectedDateStr = null;
        notesTextarea.value = '';
        modalCbDiary.checked = false;
        modalCbOne.checked = false;
        modalCbTwo.checked = false;
        modalCbThought.checked = false;
    }

    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    
    // Close modal on background click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });

    // ==========================================================================
    // Mobile Sidebar Event Listeners
    // ==========================================================================
    if (menuToggleBtn && closeMenuBtn && sidebar && sidebarOverlay) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-active');
            sidebarOverlay.classList.add('active');
        });

        const closeMobileSidebar = () => {
            sidebar.classList.remove('mobile-active');
            sidebarOverlay.classList.remove('active');
        };

        closeMenuBtn.addEventListener('click', closeMobileSidebar);
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // ==========================================================================
    // Calendar Navigation Triggers
    // ==========================================================================
    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    todayBtn.addEventListener('click', () => {
        const today = new Date();
        currentMonth = today.getMonth();
        currentYear = today.getFullYear();
        renderCalendar();
    });

    jumpMonthSelect.addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value, 10);
        renderCalendar();
    });

    jumpYearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value, 10);
        renderCalendar();
    });

    // ==========================================================================
    // Theme Switcher Logic
    // ==========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('auracal_theme') || 'dark-theme';
        document.body.className = savedTheme;
    }

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light-theme' : 'dark-theme';
        document.body.className = newTheme;
        localStorage.setItem('auracal_theme', newTheme);
        showToast(`Theme switched to ${isDark ? 'Light' : 'Dark'} Mode!`);
    });

    // ==========================================================================
    // Backup & Restore (JSON Import/Export)
    // ==========================================================================
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calendarData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute("download", `auracal-backup-${timestamp}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Database exported successfully!');
    });

    importTriggerBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsedData = JSON.parse(evt.target.result);
                
                // Simple structure validation
                if (typeof parsedData !== 'object' || parsedData === null) {
                    throw new Error('Invalid JSON structure');
                }
                
                // Overwrite and Save
                calendarData = parsedData;
                saveDatabase();
                renderCalendar();
                showToast('Database restored successfully from backup!');
            } catch (err) {
                console.error('Error importing backup:', err);
                showToast('Import failed. Invalid JSON backup file.', 'danger');
            }
            // Clear input so same file can be imported again if needed
            importFileInput.value = '';
        };
        reader.readAsText(file);
    });

    // ==========================================================================
    // Guide Modal
    // ==========================================================================
    dbGuideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dbGuideModal.classList.add('active');
    });

    function closeGuide() {
        dbGuideModal.classList.remove('active');
    }

    closeGuideModal.addEventListener('click', closeGuide);
    closeGuideFooterBtn.addEventListener('click', closeGuide);
    dbGuideModal.addEventListener('click', (e) => {
        if (e.target === dbGuideModal) closeGuide();
    });

    // ==========================================================================
    // Initial Setup
    // ==========================================================================
    initTheme();
    loadDatabase();
    initJumpSelectors();
    renderCalendar();
});

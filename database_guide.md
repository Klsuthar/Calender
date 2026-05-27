# Guide: Connecting a Free Database to AuraCal

By default, AuraCal uses **LocalStorage**, which is a 100% free, private, and offline database built into your browser. 

If you want to sync your notes and checklist statuses across different devices or save them online, you can easily connect a free cloud database. Below are two simple options: **Google Sheets** and **Firebase**.

---

## Option 1: Google Sheets as a Database (100% Free & No Account Signup Needed)
You can use Google Sheets to view, edit, and store your calendar data.

### Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a **Blank Spreadsheet**.
2. Name your spreadsheet (e.g., `AuraCal Data`).
3. Rename the first tab/sheet to `Data`.

### Step 2: Add Google Apps Script
1. In the top menu of your Google Sheet, go to **Extensions** > **Apps Script**.
2. Delete any code in the editor and paste the following Apps Script code:

```javascript
// Google Apps Script to read and write Calendar Data
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  var rows = sheet.getDataRange().getValues();
  var data = {};
  
  // Skip header row
  for (var i = 1; i < rows.length; i++) {
    var dateKey = rows[i][0];
    var diary = rows[i][1];
    var one = rows[i][2];
    var two = rows[i][3];
    var thought = rows[i][4];
    var notes = rows[i][5];
    if (dateKey) {
      data[dateKey] = { 
        notes: notes, 
        checkboxes: {
          diary: diary === 1 || diary === true,
          one: one === 1 || one === true,
          two: two === 1 || two === true,
          thought: thought === 1 || thought === true
        }
      };
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  
  // Clear existing content except headers
  sheet.clearContents();
  sheet.appendRow(["Date", "Diary", "Task 1", "Task 2", "Decision", "Notes"]);
  
  // Write new data
  for (var dateKey in params) {
    if (params.hasOwnProperty(dateKey)) {
      var item = params[dateKey];
      var cb = item.checkboxes || {};
      sheet.appendRow([
        dateKey,
        cb.diary ? 1 : 0,
        cb.one ? 1 : 0,
        cb.two ? 1 : 0,
        cb.thought ? 1 : 0,
        item.notes || ""
      ]);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click the **Save** icon (diskette).
4. Click the **Deploy** button > **New deployment**.
5. Select type: **Web app**.
6. Set the settings:
   - **Execute as**: Me (your email).
   - **Who has access**: Anyone.
7. Click **Deploy**.
8. Copy the **Web App URL** generated (it will look like `https://script.google.com/macros/s/.../exec`).

### Step 3: Update `app.js` to use your Google Sheets URL
Open `app.js` and update the `loadDatabase` and `saveDatabase` functions to communicate with this URL using `fetch`. Replace `YOUR_SHEET_URL` with your copied URL:

```javascript
const SHEET_URL = "YOUR_SHEET_URL";

// Replace loadDatabase inside app.js:
async function loadDatabase() {
    try {
        const response = await fetch(SHEET_URL);
        calendarData = await response.json();
    } catch (e) {
        console.error('Error fetching from Google Sheets:', e);
        // Fallback to localStorage if offline
        const local = localStorage.getItem('auracal_data');
        calendarData = local ? JSON.parse(local) : {};
    }
    updateStats();
    renderCalendar();
}

// Replace saveDatabase inside app.js:
async function saveDatabase() {
    try {
        // Save to localStorage as local backup
        localStorage.setItem('auracal_data', JSON.stringify(calendarData));
        updateStats();

        // Send to Google Sheets
        await fetch(SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for Google Web Apps without custom CORS
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(calendarData)
        });
        showToast('Synced to Google Sheets!');
    } catch (e) {
        console.error('Error saving to Google Sheets:', e);
        showToast('Saved locally, but failed to sync to cloud.', 'danger');
    }
}
```

---

## Option 2: Firebase Realtime Database (Real-time Cloud Sync)
Firebase provides a free tier that is excellent for instant, real-time syncing.

### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and follow the steps.
3. In the project dashboard, click **Build** > **Realtime Database** > **Create Database**.
4. Choose database location and select **Start in test mode** (allows read/writes for testing. For production, secure it with Auth rules).

### Step 2: Connect Firebase to AuraCal
Add the Firebase Web SDK to the top of your `app.js` file (change `app.js` imports to script type="module" in index.html):

1. Change `index.html` script tag to module:
   ```html
   <script type="module" src="app.js"></script>
   ```

2. Replace the start of your `app.js` with the Firebase initialization and listeners:

```javascript
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your Firebase Config (from Firebase Console project settings)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'calendar_data');

let calendarData = {};

// Replace loadDatabase inside app.js:
function loadDatabase() {
    // Realtime sync: whenever database changes on Firebase, UI updates automatically!
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        calendarData = data || {};
        updateStats();
        renderCalendar();
    });
}

// Replace saveDatabase inside app.js:
function saveDatabase() {
    set(dbRef, calendarData)
        .then(() => {
            showToast('Changes saved to Firebase Cloud!');
        })
        .catch((error) => {
            console.error('Firebase save error:', error);
            showToast('Failed to save to cloud.', 'danger');
        });
}
```

Now you have a cloud database syncing your calendar automatically!

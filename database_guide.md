# Google Sheets Database Integration Guide for AuraCal

This guide explains how to connect your **AuraCal Calendar** to a **Google Sheet** so that your checklist status and notes are synced to the cloud and accessible from any device.

---

## Why Google Sheets?
- **100% Free**: No subscription or card setup required.
- **Easy Setup**: Uses Google Apps Script to act as a secure API.
- **Excel/Data Friendly**: You can view and edit your checklist data directly in your browser.

---

## Step-by-Step Setup

### Step 1: Create Your Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and click **Blank Spreadsheet**.
2. Name your spreadsheet (e.g., `AuraCal Cloud Database`).
3. Rename the first sheet tab (at the bottom-left) to **`Data`** (with a capital D).

### Step 2: Add the Google Apps Script
1. In the Google Sheets menu, click **Extensions** > **Apps Script**.
2. Delete any default code in the editor (`code.gs`) and paste the following Apps Script code:

```javascript
// Google Apps Script to read and write AuraCal checklist and notes
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  var rows = sheet.getDataRange().getValues();
  var data = {};
  
  // Skip the header row (i = 1)
  for (var i = 1; i < rows.length; i++) {
    var dateKey = rows[i][0];
    var diary = rows[i][1];
    var one = rows[i][2];
    var two = rows[i][3];
    var thought = rows[i][4];
    var notes = rows[i][5];
    
    if (dateKey) {
      data[dateKey] = { 
        notes: notes ? String(notes) : "", 
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
  
  // Clear sheet and rewrite headers
  sheet.clearContents();
  sheet.appendRow(["Date Key (YYYY-MM-DD)", "Diary Done", "Task 1 Done", "Task 2 Done", "Decision Done", "Notes Content"]);
  
  // Save calendar data row-by-row
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

3. Click the **Save** icon (floppy disk) at the top of the editor.

### Step 3: Deploy the Script as a Web App
1. Click the **Deploy** button at the top-right, and select **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Configure the deployment settings:
   - **Description**: `AuraCal API Link`
   - **Execute as**: **`Me (your-email@gmail.com)`**
   - **Who has access**: **`Anyone`** (This allows the calendar app to fetch/post data without prompting google login credentials).
4. Click **Deploy**.
5. *If prompted*, click **Authorize Access**, choose your Google account, click **Advanced** at the bottom, and click **Go to Untitled project (unsafe)** to approve scopes.
6. Once deployed, copy the **`Web app URL`** (it will look like: `https://script.google.com/macros/s/XXXXX/exec`).

---

### Step 4: Integrate the URL into `app.js`

Open `app.js` and apply these changes:

1. Add your Web App URL at the very top of `app.js` (line 6):
   ```javascript
   const SHEET_URL = "YOUR_COPIED_GOOGLE_SHEETS_WEB_APP_URL";
   ```

2. Replace the `loadDatabase` function in `app.js` with this async code:
   ```javascript
   async function loadDatabase() {
       try {
           const response = await fetch(SHEET_URL);
           calendarData = await response.json();
       } catch (e) {
           console.error('Error fetching from Google Sheets:', e);
           // Fallback to local storage if offline
           const local = localStorage.getItem('auracal_data');
           calendarData = local ? JSON.parse(local) : {};
       }
       updateStats(currentYear, currentMonth);
       renderCalendar();
   }
   ```

3. Replace the `saveDatabase` function in `app.js` with this async code:
   ```javascript
   async function saveDatabase() {
       try {
           // Save local backup
           localStorage.setItem('auracal_data', JSON.stringify(calendarData));
           updateStats(currentYear, currentMonth);

           // Sync with Google Sheets
           await fetch(SHEET_URL, {
               method: 'POST',
               mode: 'no-cors', // Avoid cross-origin script blocks
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

Now, every time you check items or write notes in the calendar, the data will be securely saved into your Google Spreadsheet!

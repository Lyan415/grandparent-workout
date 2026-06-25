/* ============================================================
   葉爺爺葉奶奶的重訓筆記 — Google Apps Script 後台 v2
   ============================================================
   【首次設定步驟】
   1. 建立 Google Sheet
   2. 在 Sheet 裡選「擴充功能」→「Apps Script」
   3. 把這整個檔案的內容貼到 Code.gs，存檔
   4. 在 Apps Script 編輯器執行一次「setupSheets」函式
      （上方工具列選「setupSheets」→ 點▶執行，會自動建立分頁與標題列）
   5. 「部署」→「新增部署作業」
      類型：Web 應用程式
      執行身分：我（你自己的帳號）
      存取：任何人（包括匿名使用者）
   6. 複製「Web App URL」，貼到 app 的設定頁面
   ============================================================ */

const SETS_SHEET  = 'Sets';
const EQUIP_SHEET = 'Equipment';
const FOLDER_NAME = 'gym_photos';   // Drive 照片資料夾名稱

// 欄位順序（與前端 store 對應）
const SETS_COLS  = ['id','date','ts','trainer','equipId','equipName','part','unit','weight','weightKg','reps','rpe','sessionId'];
const EQUIP_COLS = ['id','name','nameEn','part','tips','photo','video','defaultUnit','active'];

// 需要設成文字格式的欄位（防止 Sheet 自動轉日期）
const DATE_COLS_SETS  = ['date','ts'];
const DATE_COLS_EQUIP = [];

/* ============================================================
   入口：GET / POST
   ============================================================ */
function doGet(e) {
  try {
    const action = ((e || {}).parameter || {}).action || 'loadAll';
    if (action === 'loadAll') return resp(loadAll());
    if (action === 'ping')    return resp({ ok: true, v: 2, ts: new Date().toISOString() });
    return resp({ error: 'unknown action: ' + action });
  } catch (err) {
    return resp({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'saveAll')     return resp(saveAll(payload.data));
    if (payload.action === 'uploadPhoto') return resp(doUploadPhoto(payload));
    return resp({ error: 'unknown action: ' + payload.action });
  } catch (err) {
    return resp({ error: String(err) });
  }
}

function resp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   讀取（GET loadAll）
   ============================================================ */
function loadAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok:        true,
    sets:      sheetToObjects(ss.getSheetByName(SETS_SHEET),  SETS_COLS),
    equipment: sheetToObjects(ss.getSheetByName(EQUIP_SHEET), EQUIP_COLS),
    ts:        new Date().toISOString(),
  };
}

/* ============================================================
   覆寫（POST saveAll）
   CRUD 模型：雲端為準全量覆寫，不做聯集合併，刪除才會真的刪除
   ============================================================ */
function saveAll(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  objectsToSheet(ss.getSheetByName(SETS_SHEET),  data.sets      || [], SETS_COLS,  DATE_COLS_SETS);
  objectsToSheet(ss.getSheetByName(EQUIP_SHEET), data.equipment || [], EQUIP_COLS, DATE_COLS_EQUIP);
  return { ok: true, ts: new Date().toISOString() };
}

/* ============================================================
   照片上傳到 Drive（POST uploadPhoto）
   payload: { action, base64, mimeType, filename }
   回傳: { ok, url, fileId }
   ============================================================ */
function doUploadPhoto(payload) {
  const folder = getOrCreateFolder(FOLDER_NAME);
  const bytes  = Utilities.base64Decode(payload.base64);
  const blob   = Utilities.newBlob(bytes, payload.mimeType || 'image/jpeg', payload.filename || ('photo_' + Date.now() + '.jpg'));
  const file   = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // Drive thumbnail URL（直接顯示在 <img>，不需下載）
  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
  return { ok: true, url: url, fileId: file.getId() };
}

function getOrCreateFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/* ============================================================
   工具：Sheet ↔ Object 轉換
   ============================================================ */

/** 把 Sheet 資料轉成 Object 陣列 */
function sheetToObjects(sheet, cols) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];   // 只有標題列，無資料
  const header = data[0].map(String);
  const numCols = new Set(['weight', 'weightKg', 'reps']);

  return data.slice(1).map(function(row) {
    const obj = {};
    header.forEach(function(h, i) {
      let v = row[i];
      // 防 Sheet 把日期字串自動轉成 Date 物件
      if (v instanceof Date) {
        v = Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
      }
      // boolean（active 欄位）
      if (v === true  || v === 'TRUE')  v = true;
      if (v === false || v === 'FALSE') v = false;
      // 數字欄
      if (numCols.has(h) && v !== '' && v !== null && v !== undefined) {
        v = Number(v);
      }
      obj[h] = (v === '' || v === null || v === undefined) ? null : v;
    });
    return obj;
  }).filter(function(obj) {
    return obj.id;   // 過濾掉空列
  });
}

/** 把 Object 陣列覆寫到 Sheet（全量取代，不合併） */
function objectsToSheet(sheet, objects, cols, dateCols) {
  if (!sheet) return;
  dateCols = dateCols || [];

  // 清除舊資料（保留第一列標題）
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, cols.length).clearContent();
  }
  if (!objects || !objects.length) return;

  // 先把日期欄設為文字格式，防止 Sheet 自動轉換
  const maxRows = objects.length + 100;   // 多設一些以防萬一
  dateCols.forEach(function(colName) {
    const colIdx = cols.indexOf(colName) + 1;
    if (colIdx > 0) {
      sheet.getRange(2, colIdx, maxRows, 1).setNumberFormat('@');
    }
  });

  // 寫入資料
  const rows = objects.map(function(obj) {
    return cols.map(function(c) {
      const v = obj[c];
      if (v === null || v === undefined) return '';
      return v;
    });
  });
  sheet.getRange(2, 1, rows.length, cols.length).setValues(rows);
}

/* ============================================================
   首次設定：執行一次建立分頁與標題列
   在 Apps Script 編輯器手動執行這個函式
   ============================================================ */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SETS_SHEET,  SETS_COLS);
  ensureSheet(ss, EQUIP_SHEET, EQUIP_COLS);
  Logger.log('設定完成：已建立 Sets 和 Equipment 分頁');
}

function ensureSheet(ss, name, cols) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log('建立新分頁：' + name);
  }
  // 如果沒有標題列就加上去
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    Logger.log('已為 ' + name + ' 加上標題列');
  }
}

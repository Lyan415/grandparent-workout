/* ============================================================
   葉爺爺葉奶奶的重訓筆記 —— 應用程式邏輯（第 1 階段：純前端 + 假資料）
   後台（Google Sheet / Drive）將在第 2 階段接上，目前資料存在 localStorage。
   ============================================================ */

'use strict';

/* ---------- 常數設定 ---------- */
const TZ = 'Asia/Taipei';
const PASS_USER = '250622';
const PASS_ADMIN = '666622';
const LB_TO_KG = 0.4536;

const TRAINERS = ['葉爺爺', '葉奶奶'];

// 部位分類（4 大類 + 伸展）
const PARTS = [
  { id: 'chestShoulder', name: '胸肩', color: 'var(--part-chestShoulder)', countVolume: true },
  { id: 'backArm',       name: '背臂', color: 'var(--part-backArm)',       countVolume: true },
  { id: 'hipLeg',        name: '臀腿', color: 'var(--part-hipLeg)',        countVolume: true },
  { id: 'core',          name: '核心', color: 'var(--part-core)',          countVolume: true },
  { id: 'stretch',       name: '伸展', color: 'var(--part-stretch)',       countVolume: false },
];
const partById = (id) => PARTS.find(p => p.id === id) || PARTS[0];

// 進步建議門檻（管理頁可調，先放預設）
const PROGRESS = {
  repsToAddWeight: 14,   // 次數達此值且輕鬆 → 建議加重
  okDaysToNudge: 2,      // 連續幾天多為「還好」 → 建議加次數
};

/* ---------- 種子器材清單 ---------- */
function seedEquipment() {
  const E = (id, name, nameEn, part, tips) => ({
    id, name, nameEn, part, tips,
    photo: '',            // 之後接 Drive，先用佔位圖
    video: '',            // 管理者貼上的 YouTube 操作影片連結
    defaultUnit: '公斤',
    active: true,
  });
  return [
    E('eq_chest',   '胸推機',            'Chest Pusher',        'chestShoulder',
      '坐穩、背貼椅背，雙手握把往前推到手臂快伸直，再慢慢收回。推的時候吐氣。'),
    E('eq_shoulder','肩推機',            'Shoulder Pusher',     'chestShoulder',
      '握把與肩同高，往上推，手肘不要鎖死。肩膀有痠的感覺就對了。'),
    E('eq_rdelt',   '坐姿蝴蝶機／後三角肌','Rear Deltoid',       'chestShoulder',
      '手臂往兩側打開，像展翅，感覺肩膀後方在出力，慢慢回來。'),
    E('eq_dip',     '單雙槓助推訓練機',   'Assisted Dip',        'chestShoulder',
      '踏上踏板，身體往下再撐起來。會有踏板幫忙省力，不用怕。'),
    E('eq_lat',     '滑輪下拉機',         'Lat Pulldown',        'backArm',
      '握住上方握把往下拉到胸前，背往後夾，再慢慢放回去。'),
    E('eq_biceps',  '二頭肌訓練器材',     'Biceps Curl',         'backArm',
      '手肘固定，把握把往上彎到肩膀附近，慢慢放下。'),
    E('eq_back',    '背部伸展機',         'Back Extension',      'backArm',
      '上半身往下再抬起來打直，動作放慢，不要用甩的。下背痠就停。'),
    E('eq_legpress','腿推機',            'Leg Press',           'hipLeg',
      '雙腳踩穩踏板，往前推到腿快伸直，膝蓋不要鎖死，再慢慢收回。'),
    E('eq_hip',     '臀部收縮訓練機',     'Hip Contraction',     'hipLeg',
      '雙腿往內或往外夾，感覺臀部和大腿在出力，慢慢回來。'),
    E('eq_waist',   '腰部旋轉訓練機',     'Waist Rotation',      'core',
      '坐穩，上半身帶著器材慢慢轉，左右都要做，腰部會微微出力。'),
    E('eq_abs',     '腹部屈曲架',         'Abdominal Flexion',   'core',
      '上半身往前捲，感覺肚子在收，慢慢回來，不要憋氣。'),
    E('eq_stretch', '伸展訓練機',         'Stretch Machine',     'stretch',
      '練前練後都可以用，幫忙放鬆筋骨，做到微微緊緊的就好，不要硬拉。'),
  ];
}

/* ---------- 佔位照片（之後換成 Drive 真實照片） ---------- */
function placeholderPhoto(equip) {
  const color = getComputedColor(partById(equip.part).color) || '#888';
  const name = equip.name;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>` +
    `<rect width='100%' height='100%' fill='${color}'/>` +
    `<rect x='14' y='14' width='372' height='272' rx='18' fill='none' stroke='rgba(255,255,255,.5)' stroke-width='3'/>` +
    `<text x='200' y='130' font-size='80' text-anchor='middle' fill='rgba(255,255,255,.85)'>📷</text>` +
    `<text x='200' y='205' font-size='30' font-weight='700' text-anchor='middle' fill='#fff'>${name}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
// 把 CSS 變數解析成實際色碼（給 SVG 用）
const _PART_HEX = {
  'var(--part-chestShoulder)': '#d9534f',
  'var(--part-backArm)': '#3b7dd8',
  'var(--part-hipLeg)': '#3aa76d',
  'var(--part-core)': '#e0922f',
  'var(--part-stretch)': '#8a8f98',
};
function getComputedColor(v) { return _PART_HEX[v] || v; }
function equipPhoto(equip) { return equip.photo || placeholderPhoto(equip); }

/* ============================================================
   狀態 / 儲存
   ============================================================ */
const LS_KEY = 'yeh_gym_v1';

const store = {
  data: {
    equipment: [],
    sets: [],          // 每一組訓練
    settings: { gasUrl: '', lastSync: null },
  },
  session: null,       // 進行中的訓練 session
  role: null,          // 'user' | 'admin'
};

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      store.data = Object.assign(store.data, parsed);
    }
  } catch (e) { console.warn('load fail', e); }

  // 一定要有器材清單才能用 app（首次離線時先用內建 12 台）
  if (!store.data.equipment || store.data.equipment.length === 0) {
    store.data.equipment = seedEquipment();
  }
  // 練習紀錄不自動塞示範資料：空的訓練歷史是正常狀態。
  // （接上雲端後尤其重要，否則空雲端會一直被假資料污染）
  if (!Array.isArray(store.data.sets)) store.data.sets = [];
  saveData();
}

function saveData() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store.data)); }
  catch (e) { console.warn('save fail', e); }
}

/* ---------- 日期工具（統一台北時區） ---------- */
function todayStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
function fmtDateHuman(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

/* ---------- 假訓練紀錄（示範用，跨好幾天） ---------- */
function seedSets() {
  const sets = [];
  let counter = 0;
  const mk = (daysAgo, trainer, eqId, weight, reps, rpe) => {
    const equip = store.data.equipment.find(e => e.id === eqId);
    const date = addDays(todayStr(), -daysAgo);
    sets.push({
      id: 'set_' + (Date.now()) + '_' + (counter++),
      date,
      ts: date + 'T10:00:00',
      trainer,
      equipId: eqId,
      equipName: equip ? equip.name : eqId,
      part: equip ? equip.part : 'chestShoulder',
      unit: '公斤',
      weight,
      weightKg: weight,
      reps,
      rpe,                 // 'hard' | 'ok' | 'easy'
      sessionId: 'seed_' + date + '_' + trainer,
    });
  };
  // 葉爺爺
  mk(6, '葉爺爺', 'eq_chest', 30, 10, 'ok');
  mk(6, '葉爺爺', 'eq_chest', 30, 10, 'ok');
  mk(6, '葉爺爺', 'eq_lat', 25, 12, 'ok');
  mk(4, '葉爺爺', 'eq_chest', 30, 12, 'ok');
  mk(4, '葉爺爺', 'eq_legpress', 50, 12, 'easy');
  mk(2, '葉爺爺', 'eq_chest', 30, 13, 'easy');
  mk(2, '葉爺爺', 'eq_lat', 27, 12, 'ok');
  // 葉奶奶
  mk(6, '葉奶奶', 'eq_legpress', 20, 12, 'ok');
  mk(4, '葉奶奶', 'eq_legpress', 20, 12, 'ok');
  mk(4, '葉奶奶', 'eq_hip', 15, 12, 'ok');
  mk(2, '葉奶奶', 'eq_legpress', 20, 13, 'ok');
  return sets;
}

/* ---------- 訓練量計算 ---------- */
function toKg(weight, unit) { return unit === '磅' ? Math.round(weight * LB_TO_KG * 10) / 10 : weight; }
function setVolume(s) {
  if (!partById(s.part).countVolume) return 0;
  return s.weightKg * s.reps;
}
function fmtNum(n) { return Math.round(n).toLocaleString('en-US'); }

/* ============================================================
   DOM 工具
   ============================================================ */
const $app = document.getElementById('app');
const $topbar = document.getElementById('topbar');
const $topTitle = document.getElementById('topTitle');
const $overlay = document.getElementById('overlay');
const $toast = document.getElementById('toast');
const $timer = document.getElementById('timerDisplay');

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

let _toastTimer = null;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => $toast.classList.add('hidden'), 1800);
}

function showOverlay(node) {
  $overlay.innerHTML = '';
  $overlay.appendChild(node);
  $overlay.classList.remove('hidden');
}
function hideOverlay() { $overlay.classList.add('hidden'); $overlay.innerHTML = ''; }

/* ============================================================
   路由
   ============================================================ */
const routes = {};
let _stack = [];
function route(name, fn) { routes[name] = fn; }

function go(name, params = {}, opts = {}) {
  if (!opts.replace) _stack.push({ name, params });
  else _stack[_stack.length - 1] = { name, params };
  render();
}
function back() {
  if (_stack.length > 1) { _stack.pop(); render(); }
}
function render() {
  const cur = _stack[_stack.length - 1];
  if (!cur) return;
  const fn = routes[cur.name];
  $app.innerHTML = '';
  // 頂部列：登入頁不顯示
  const showTop = cur.name !== 'login';
  $topbar.classList.toggle('hidden', !showTop);
  document.getElementById('btnBack').classList.toggle('hidden', _stack.length <= 1);
  fn(cur.params || {});
}

/* ============================================================
   頂部列按鈕
   ============================================================ */
document.getElementById('btnBack').addEventListener('click', back);
document.getElementById('btnSync').addEventListener('click', manualSync);

/* ============================================================
   第 2 階段：雲端同步（Google Sheet ＋ Drive）
   ============================================================ */

// 預設後台網址（Apps Script 部署 URL）。設定頁留空白時就用這個。
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyh2pXpuzKofMcopCeeJYrXFBAEYEF79LfOd_h-xBcKa8wWJLm1w_DYpcCCIviBVbky/exec';

function getGasUrl() {
  const saved = store.data.settings && store.data.settings.gasUrl;
  // 設定頁有填且格式正確就用設定值，否則退回預設網址
  const url = (saved && /^https:\/\/script\.google\.com\//.test(saved)) ? saved : DEFAULT_GAS_URL;
  return /^https:\/\/script\.google\.com\//.test(url) ? url : null;
}

async function syncFromCloud() {
  const url = getGasUrl();
  if (!url) return false;
  try {
    const res = await fetch(url + '?action=loadAll', { redirect: 'follow' });
    const result = await res.json();
    if (!result.ok) return false;
    const remoteEquip = result.equipment || [];
    // 首次使用：雲端還沒有器材資料 → 視為未初始化。
    // 把本地的 12 台器材推上去當作種子，「乾淨開始」不上傳示範練習紀錄。
    // 否則「雲端為準」會用空雲端把本地器材洗掉。
    if (remoteEquip.length === 0) {
      store.data.equipment = (store.data.equipment && store.data.equipment.length)
        ? store.data.equipment : seedEquipment();
      store.data.sets = [];
      saveData();
      await syncToCloud();
      return true;
    }
    // 正常情況：CRUD 模型，雲端全量取代本地，刪除才會真的生效
    store.data.sets      = result.sets || [];
    store.data.equipment = remoteEquip;
    store.data.settings.lastSync = new Date().toISOString();
    saveData();
    return true;
  } catch (e) {
    console.warn('syncFromCloud error', e);
    return false;
  }
}

async function syncToCloud() {
  const url = getGasUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'saveAll',
        data: { sets: store.data.sets, equipment: store.data.equipment },
      }),
      redirect: 'follow',
    });
    const result = await res.json();
    if (result.ok) {
      store.data.settings.lastSync = result.ts || new Date().toISOString();
      saveData();
      return true;
    }
  } catch (e) {
    console.warn('syncToCloud error', e);
  }
  return false;
}

async function uploadPhotoToDrive(file) {
  const url = getGasUrl();
  if (!url) throw new Error('請先設定 Apps Script 網址才能上傳照片');
  const base64 = await fileToBase64(file);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'uploadPhoto', base64, mimeType: file.type, filename: file.name }),
    redirect: 'follow',
  });
  const result = await res.json();
  if (!result.ok) throw new Error(result.error || '上傳失敗');
  return result.url;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function manualSync() {
  const url = getGasUrl();
  if (!url) { toast('請先在設定頁填入 Apps Script 網址'); return; }
  const btn = document.getElementById('btnSync');
  btn.classList.add('spinning');
  const ok = await syncFromCloud();
  btn.classList.remove('spinning');
  if (ok) { toast('已從雲端同步最新資料'); render(); }
  else toast('同步失敗，請確認網址或網路連線');
}

/* ============================================================
   計時器
   ============================================================ */
let _timerStart = null, _timerInt = null;
function startTimer() {
  _timerStart = Date.now();
  $timer.classList.remove('hidden');
  clearInterval(_timerInt);
  _timerInt = setInterval(updateTimer, 1000);
  updateTimer();
}
function stopTimer() { clearInterval(_timerInt); $timer.classList.add('hidden'); _timerStart = null; }
function updateTimer() {
  if (!_timerStart) return;
  const s = Math.floor((Date.now() - _timerStart) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $timer.textContent = `⏱ ${mm}:${ss}`;
}

/* ============================================================
   畫面：登入
   ============================================================ */
route('login', () => {
  let buf = '';
  const screen = h(`<div class="login">
    <div class="login__logo">💪</div>
    <div class="login__app">葉爺爺葉奶奶的<br>重訓筆記</div>
    <div class="login__hint">請輸入密碼</div>
    <div class="login__dots" id="dots"></div>
    <div class="keypad" id="keypad"></div>
  </div>`);
  $app.appendChild(screen);

  const keys = ['2', '5', '6', '0'];
  const layout = ['2', '5', '6', '0'];
  const $keypad = screen.querySelector('#keypad');
  const $dots = screen.querySelector('#dots');

  function drawDots() {
    $dots.innerHTML = '';
    const n = Math.max(6, buf.length);
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('div');
      dot.className = 'login__dot' + (i < buf.length ? ' filled' : '');
      $dots.appendChild(dot);
    }
  }
  function press(k) {
    if (k === 'del') { buf = buf.slice(0, -1); drawDots(); return; }
    if (buf.length >= 6) return;
    buf += k;
    drawDots();
    if (buf.length === 6) setTimeout(() => check(), 150);
  }
  function check() {
    if (buf === PASS_USER || buf === PASS_ADMIN) {
      store.role = buf === PASS_ADMIN ? 'admin' : 'user';
      _stack = [{ name: 'home' }]; render();
      // 登入後背景拉雲端最新資料
      syncFromCloud().then(ok => { if (ok) { toast('已從雲端同步最新資料'); render(); } });
    } else {
      toast('密碼不對，再試一次'); buf = ''; drawDots();
    }
  }

  // 數字鍵（2 5 6 0）＋ 刪除
  const order = ['2', '5', '6', '0'];
  order.forEach(k => {
    const b = h(`<button class="keypad__key">${k}</button>`);
    b.addEventListener('click', () => press(k));
    $keypad.appendChild(b);
  });
  const del = h(`<button class="keypad__key keypad__key--action">刪除</button>`);
  del.addEventListener('click', () => press('del'));
  $keypad.appendChild(del);

  drawDots();
});

/* ============================================================
   畫面：主選單
   ============================================================ */
route('home', () => {
  stopTimer();
  $topTitle.textContent = '重訓筆記';
  const isAdmin = store.role === 'admin';
  const screen = h(`<div class="stack">
    <div class="home__hello">歡迎回來，今天也一起加油！</div>
    <button class="btn btn--big btn--block" id="bTrain">🏋️ 開始訓練</button>
    <button class="btn btn--big btn--block btn--ghost" id="bRecord">📒 觀看紀錄</button>
    ${isAdmin ? `<div class="spacer"></div><button class="btn btn--block btn--gray" id="bAdmin">⚙️ 管理者設定</button>` : ''}
    <div class="spacer"></div>
    <button class="btn btn--block btn--gray" id="bLogout">🚪 登出</button>
  </div>`);
  $app.appendChild(screen);
  screen.querySelector('#bTrain').addEventListener('click', () => {
    store.session = { id: 'sess_' + Date.now(), date: todayStr(), startTs: new Date().toISOString() };
    startTimer();
    go('equipSelect');
  });
  screen.querySelector('#bRecord').addEventListener('click', () => go('records'));
  if (isAdmin) screen.querySelector('#bAdmin').addEventListener('click', () => go('admin'));
  screen.querySelector('#bLogout').addEventListener('click', () => {
    store.role = null;
    store.session = null;
    stopTimer();
    _stack = [{ name: 'login' }];
    render();
  });
});

/* ============================================================
   畫面：器材選擇（大照片卡）
   ============================================================ */
route('equipSelect', (params) => {
  $topTitle.textContent = '選擇器材';
  let activePart = params.part || 'all';
  const screen = h(`<div>
    <div class="part-tabs" id="tabs"></div>
    <div class="equip-grid" id="grid"></div>
  </div>`);
  $app.appendChild(screen);

  const $tabs = screen.querySelector('#tabs');
  const $grid = screen.querySelector('#grid');

  function drawTabs() {
    $tabs.innerHTML = '';
    const all = h(`<button class="part-tab ${activePart === 'all' ? 'active' : ''}">全部</button>`);
    if (activePart === 'all') all.style.background = 'var(--green)', all.style.borderColor = 'var(--green)';
    all.addEventListener('click', () => { activePart = 'all'; drawTabs(); drawGrid(); });
    $tabs.appendChild(all);
    PARTS.forEach(p => {
      const t = h(`<button class="part-tab ${activePart === p.id ? 'active' : ''}">${p.name}</button>`);
      if (activePart === p.id) { t.style.background = p.color; t.style.borderColor = p.color; }
      t.addEventListener('click', () => { activePart = p.id; drawTabs(); drawGrid(); });
      $tabs.appendChild(t);
    });
  }
  function drawGrid() {
    $grid.innerHTML = '';
    const list = store.data.equipment.filter(e => e.active && (activePart === 'all' || e.part === activePart));
    list.forEach(eq => {
      const part = partById(eq.part);
      const card = h(`<button class="equip-card">
        <img class="equip-card__photo" src="${equipPhoto(eq)}" alt="${esc(eq.name)}" />
        <div class="equip-card__body">
          <div class="equip-card__name">${esc(eq.name)}</div>
          <span class="equip-card__part" style="background:${part.color}">${part.name}</span>
        </div>
      </button>`);
      card.addEventListener('click', () => go('equipDetail', { equipId: eq.id }));
      $grid.appendChild(card);
    });
    // 新增卡
    const add = h(`<button class="equip-card equip-card--add">＋ 新增器材</button>`);
    add.addEventListener('click', () => {
      if (store.role === 'admin') go('adminEquipEdit', { equipId: null });
      else toast('新增器材請交給管理者設定喔');
    });
    $grid.appendChild(add);
  }
  drawTabs();
  drawGrid();

  // 進入訓練時（從「開始訓練」進來、本次 session 還沒提示過）跳出今日建議
  if (store.session && !store.session.greeted && !params.part) {
    store.session.greeted = true;
    const sug = suggestTodayParts();
    if (sug) showTodaySuggestion(sug, (partId) => { activePart = partId; drawTabs(); drawGrid(); });
  }
});

/* 依歷史推薦今天練的部位：上次練的部位，這次換沒練到的 */
function suggestTodayParts() {
  const today = todayStr();
  const pastDays = Array.from(new Set(
    store.data.sets.filter(s => s.date < today).map(s => s.date))).sort();
  if (!pastDays.length) return null;            // 還沒有歷史，不提示
  const lastDay = pastDays[pastDays.length - 1];
  const lastParts = new Set(store.data.sets
    .filter(s => s.date === lastDay && partById(s.part).countVolume)
    .map(s => s.part));
  const all = PARTS.filter(p => p.countVolume);
  const rec = all.filter(p => !lastParts.has(p.id));
  return {
    lastParts: all.filter(p => lastParts.has(p.id)),
    recParts: rec.length ? rec : all,          // 上次全練了就推全部
  };
}

function showTodaySuggestion(sug, onPick) {
  const lastTxt = sug.lastParts.length ? sug.lastParts.map(p => p.name).join('、') : '（沒有上一次的紀錄）';
  const recBtns = sug.recParts.map(p =>
    `<button class="btn btn--block" data-p="${p.id}" style="background:${p.color}">去練 ${p.name}</button>`).join('<div class="spacer"></div>');
  const dlg = h(`<div class="dialog">
    <div class="dialog__emoji">📅</div>
    <div class="dialog__title">今天練哪裡好呢？</div>
    <div class="dialog__body">上次練了 <b>${lastTxt}</b>，<br>今天建議換 <b>${sug.recParts.map(p => p.name).join('、')}</b>！</div>
    ${recBtns}
    <div class="spacer"></div>
    <button class="btn btn--block btn--ghost" id="skip">我自己選就好</button>
  </div>`);
  dlg.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
    hideOverlay();
    onPick && onPick(b.dataset.p);
  }));
  dlg.querySelector('#skip').addEventListener('click', () => hideOverlay());
  showOverlay(dlg);
}

/* ============================================================
   畫面：器材使用要點
   ============================================================ */
route('equipDetail', (params) => {
  const eq = store.data.equipment.find(e => e.id === params.equipId);
  if (!eq) return back();
  $topTitle.textContent = eq.name;
  const screen = h(`<div class="stack">
    <img class="detail__photo" src="${equipPhoto(eq)}" alt="${esc(eq.name)}" />
    <div class="detail__name">${esc(eq.name)}</div>
    <div class="detail__tips">
      <h4>📋 器材使用要點</h4>
      <div>${esc(eq.tips || '（尚未填寫使用要點）')}</div>
    </div>
    ${eq.video ? `<a class="btn btn--block btn--soft" href="${esc(eq.video)}" target="_blank" rel="noopener">▶️ 看操作影片</a>` : ''}
    <div class="detail__cheer">加油！訓練完和我說一聲 💪</div>
    <button class="btn btn--big btn--block" id="bStart">完成了，開始紀錄</button>
  </div>`);
  $app.appendChild(screen);
  screen.querySelector('#bStart').addEventListener('click', () => go('logSet', { equipId: eq.id }));
});

/* ============================================================
   畫面：記一組
   ============================================================ */
route('logSet', (params) => {
  const eq = store.data.equipment.find(e => e.id === params.equipId);
  if (!eq) return back();
  $topTitle.textContent = '記錄一組';

  // 狀態
  const st = {
    trainer: params.trainer || null,
    unit: eq.defaultUnit || '公斤',
    weight: 20,
    reps: 10,
    rpe: null,
  };

  const part = partById(eq.part);
  const screen = h(`<div>
    <div class="detail__name" style="font-size:1.4rem;margin-bottom:4px;">${esc(eq.name)}</div>
    <div class="center muted" style="margin-bottom:18px;">
      <span class="equip-card__part" style="background:${part.color}">${part.name}</span>
    </div>

    <div class="field">
      <div class="field__label">是誰在練？</div>
      <div class="choice-row" id="trainerRow">
        ${TRAINERS.map(t => `<button class="choice" data-t="${t}">${t}</button>`).join('')}
      </div>
    </div>

    <div id="prefillNote" class="prefill-note hidden"></div>

    <div class="field">
      <div class="field__label">重量單位</div>
      <div class="choice-row" id="unitRow">
        <button class="choice" data-u="公斤">公斤</button>
        <button class="choice" data-u="磅">磅</button>
      </div>
    </div>

    <div class="field">
      <div class="field__label">重量</div>
      <div class="stepper">
        <button class="stepper__btn" data-w="-">－</button>
        <input class="stepper__value" id="weightVal" type="number" inputmode="decimal" value="${st.weight}" />
        <button class="stepper__btn" data-w="+">＋</button>
      </div>
      <div class="stepper__unit" id="unitLabel">公斤</div>
    </div>

    <div class="field">
      <div class="field__label">本組做了幾下</div>
      <div class="stepper">
        <button class="stepper__btn" data-r="-">－</button>
        <input class="stepper__value" id="repsVal" type="number" inputmode="numeric" value="${st.reps}" />
        <button class="stepper__btn" data-r="+">＋</button>
      </div>
      <div class="stepper__unit">下</div>
    </div>

    <div class="field">
      <div class="field__label">體感如何？</div>
      <div class="rpe-row" id="rpeRow">
        <button class="rpe" data-v="hard"><span class="rpe__emoji">😣</span>有點勉強</button>
        <button class="rpe" data-v="ok"><span class="rpe__emoji">🙂</span>還好</button>
        <button class="rpe" data-v="easy"><span class="rpe__emoji">😄</span>很輕鬆</button>
      </div>
    </div>

    <button class="btn btn--big btn--block" id="bSave">✓ 寫入這一組</button>
  </div>`);
  $app.appendChild(screen);

  const $weight = screen.querySelector('#weightVal');
  const $reps = screen.querySelector('#repsVal');
  const $unitLabel = screen.querySelector('#unitLabel');
  const $prefill = screen.querySelector('#prefillNote');

  function syncWeightStep() {
    return st.unit === '磅' ? 5 : 2.5;
  }
  function renderUnit() {
    screen.querySelectorAll('#unitRow .choice').forEach(b => b.classList.toggle('active', b.dataset.u === st.unit));
    $unitLabel.textContent = st.unit;
  }
  function selectTrainer(t) {
    st.trainer = t;
    screen.querySelectorAll('#trainerRow .choice').forEach(b => b.classList.toggle('active', b.dataset.t === t));
    // 自動帶入上次數據（體感除外）
    const last = lastSetFor(t, eq.id);
    if (last) {
      st.unit = last.unit; st.weight = last.weight; st.reps = last.reps;
      $weight.value = last.weight; $reps.value = last.reps;
      renderUnit();
      $prefill.textContent = `已帶入 ${t} 上次的數據：${last.weight}${last.unit} × ${last.reps} 下`;
      $prefill.classList.remove('hidden');
    } else {
      $prefill.textContent = `${t} 還沒有這台器材的紀錄，先設定一個吧`;
      $prefill.classList.remove('hidden');
    }
  }

  screen.querySelectorAll('#trainerRow .choice').forEach(b =>
    b.addEventListener('click', () => selectTrainer(b.dataset.t)));
  screen.querySelectorAll('#unitRow .choice').forEach(b =>
    b.addEventListener('click', () => { st.unit = b.dataset.u; renderUnit(); }));

  screen.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    let v = parseFloat($weight.value) || 0;
    v += (b.dataset.w === '+' ? 1 : -1) * syncWeightStep();
    if (v < 0) v = 0;
    $weight.value = Math.round(v * 10) / 10;
  }));
  screen.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
    let v = parseInt($reps.value) || 0;
    v += (b.dataset.r === '+' ? 1 : -1);
    if (v < 0) v = 0;
    $reps.value = v;
  }));
  screen.querySelectorAll('#rpeRow .rpe').forEach(b => b.addEventListener('click', () => {
    st.rpe = b.dataset.v;
    screen.querySelectorAll('#rpeRow .rpe').forEach(x => x.classList.toggle('active', x === b));
  }));

  renderUnit();
  if (st.trainer) selectTrainer(st.trainer);

  screen.querySelector('#bSave').addEventListener('click', () => {
    const weight = parseFloat($weight.value);
    const reps = parseInt($reps.value);
    if (!st.trainer) return toast('請先選「是誰在練」');
    if (!(weight >= 0)) return toast('請輸入重量');
    if (!(reps > 0)) return toast('請輸入次數');
    if (!st.rpe) {
      const row = screen.querySelector('#rpeRow');
      row.classList.add('need');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => row.classList.remove('need'), 800);
      return toast('請先選「體感如何」再寫入');
    }

    const set = {
      id: 'set_' + Date.now(),
      date: store.session ? store.session.date : todayStr(),
      ts: new Date().toISOString(),
      trainer: st.trainer,
      equipId: eq.id,
      equipName: eq.name,
      part: eq.part,
      unit: st.unit,
      weight,
      weightKg: toKg(weight, st.unit),
      reps,
      rpe: st.rpe,
      sessionId: store.session ? store.session.id : ('sess_' + todayStr()),
    };
    store.data.sets.push(set);
    saveData();
    syncToCloud();

    const advice = analyzeProgress(set);
    if (advice) showAdvice(advice, () => afterSet(eq, st.trainer));
    else afterSet(eq, st.trainer);
  });
});

function lastSetFor(trainer, equipId) {
  const list = store.data.sets
    .filter(s => s.trainer === trainer && s.equipId === equipId)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return list[0] || null;
}

/* ---------- 進步建議引擎 ----------
   原則：
   1. 一定要有足夠歷史（至少兩個不同訓練日）才給建議，只有一筆資料不亂建議。
   2. 經過判斷後「只建議一件事」：次數 或 重量，不會兩個一起講。
   3. 加重量的條件：體感「很輕鬆」，或「還好」連續兩次；
      但若次數最近還在增加（代表還在用加次數進步），就先不要求加重，繼續鼓勵多做幾下。
*/
function analyzeProgress(set) {
  const hist = store.data.sets
    .filter(s => s.trainer === set.trainer && s.equipId === set.equipId)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));

  // 依「不同訓練日」分組（days[0] 為最新一天）
  const byDay = {};
  hist.forEach(s => { (byDay[s.date] = byDay[s.date] || []).push(s); });
  const days = Object.keys(byDay).sort().reverse();
  if (days.length < 2) return null;            // 歷史不足，不給建議

  const repRpe = d => byDay[d][0].rpe;                          // 當天代表體感（最後一組）
  const dayMaxReps = d => Math.max(...byDay[d].map(s => s.reps)); // 當天最高次數

  const latestEasy = repRpe(days[0]) === 'easy';
  // 「還好」連續兩次（兩天都不勉強，至少其一為還好）
  const okTwice = ['ok', 'easy'].includes(repRpe(days[0])) &&
                  ['ok', 'easy'].includes(repRpe(days[1]));
  // 次數最近是否有增加：最新訓練日最高次數 > 前一訓練日最高次數
  const repsIncreased = dayMaxReps(days[0]) > dayMaxReps(days[1]);

  // 決定要不要建議加重量
  let suggestWeight = false;
  if (latestEasy) {
    suggestWeight = true;                      // 很輕鬆 → 直接建議加重
  } else if (okTwice) {
    suggestWeight = !repsIncreased;            // 還好兩次，但次數還在增加就先不加重
  }

  if (suggestWeight) {
    return {
      emoji: '🔥',
      title: '下次可以加一點重量',
      body: `${set.trainer} 這台已經很穩了，下次可以試著<b>加一點點重量</b>！`,
    };
  }
  // 不加重，但只要狀態不錯（輕鬆或還好兩次）就鼓勵多做幾下
  if (latestEasy || okTwice) {
    return {
      emoji: '💪',
      title: '下次可以多做幾下',
      body: `${set.trainer} 狀態不錯，下次這台可以試著<b>多做一兩下</b>！`,
    };
  }
  return null;
}

function showAdvice(advice, onClose) {
  const dlg = h(`<div class="dialog">
    <div class="dialog__emoji">${advice.emoji}</div>
    <div class="dialog__title">${advice.title}</div>
    <div class="dialog__body">${advice.body}</div>
    <button class="btn btn--block" id="ok">好，我知道了</button>
  </div>`);
  dlg.querySelector('#ok').addEventListener('click', () => { hideOverlay(); onClose && onClose(); });
  showOverlay(dlg);
}

/* ---------- 共用：離開循環前的再次確認 ---------- */
function confirmDialog(opts, onYes, onNo) {
  const dlg = h(`<div class="dialog">
    <div class="dialog__emoji">${opts.emoji || '🤔'}</div>
    <div class="dialog__title">${opts.title}</div>
    <div class="dialog__body">${opts.body || ''}</div>
    <button class="btn btn--block btn--danger" id="yes">${opts.yes || '確定'}</button>
    <div class="spacer"></div>
    <button class="btn btn--block" id="no">${opts.no || '取消'}</button>
  </div>`);
  dlg.querySelector('#yes').addEventListener('click', () => { hideOverlay(); onYes && onYes(); });
  dlg.querySelector('#no').addEventListener('click', () => { hideOverlay(); onNo && onNo(); });
  showOverlay(dlg);
}

/* ---------- 一組寫完後：本組完成 ---------- */
function afterSet(eq, trainer) {
  const dlg = h(`<div class="dialog">
    <div class="dialog__emoji">✅</div>
    <div class="dialog__title">本組紀錄完成！</div>
    <div class="dialog__body">接著訓練吧！</div>
    <button class="btn btn--block" id="again">接著用本器材</button>
    <div class="spacer"></div>
    <button class="btn btn--block btn--danger" id="done">本器材練完了</button>
  </div>`);
  dlg.querySelector('#again').addEventListener('click', () => {
    hideOverlay();
    // 「加油！訓練完和我說一聲」→ 再記一組（沿用訓練者）
    const cheer = h(`<div class="dialog">
      <div class="dialog__emoji">💪</div>
      <div class="dialog__title">加油！</div>
      <div class="dialog__body">訓練完和我說一聲</div>
      <button class="btn btn--block" id="goRec">完成了，開始紀錄</button>
    </div>`);
    cheer.querySelector('#goRec').addEventListener('click', () => { hideOverlay(); go('logSet', { equipId: eq.id, trainer }, { replace: true }); });
    showOverlay(cheer);
  });
  dlg.querySelector('#done').addEventListener('click', () => {
    hideOverlay();
    confirmDialog(
      { emoji: '🤔', title: '這台練完了嗎？', body: '確定這個器材就先到這裡？', yes: '是，這台練完了', no: '還沒，繼續練' },
      () => go('reviewEquipSets', { equipId: eq.id }, { replace: true }),
      () => afterSet(eq, trainer)        // 還沒 → 回到原本的選項
    );
  });
  showOverlay(dlg);
}

/* ============================================================
   畫面：本器材紀錄確認（練完這台後，再次確認 / 修改）
   ============================================================ */
const RPE_LABEL = { hard: '😣 有點勉強', ok: '🙂 還好', easy: '😄 很輕鬆' };
function rpeLabel(v) { return RPE_LABEL[v] || ''; }

route('reviewEquipSets', (params) => {
  $topTitle.textContent = '確認紀錄';
  const sid = store.session && store.session.id;
  const eq = store.data.equipment.find(e => e.id === params.equipId);
  const sets = store.data.sets
    .filter(s => s.sessionId === sid && s.equipId === params.equipId)
    .sort((a, b) => (a.ts < b.ts ? -1 : 1));

  const screen = h(`<div>
    <div class="screen-title">確認一下這台的紀錄</div>
    <div class="screen-subtitle">${eq ? esc(eq.name) : ''}　有錯的話點那一筆就能改</div>
    <div id="list" class="stack"></div>
    <div class="spacer"></div>
    <button class="btn btn--block btn--soft" id="addSet">＋ 手動補一組（漏記時用）</button>
    <div class="spacer"></div>
    <button class="btn btn--big btn--block" id="ok">✓ 都正確，繼續</button>
  </div>`);
  $app.appendChild(screen);
  const $list = screen.querySelector('#list');
  screen.querySelector('#addSet').addEventListener('click', () => go('editSet', { newForEquip: params.equipId }));

  if (!sets.length) {
    $list.appendChild(h(`<div class="card center muted">這台這次還沒有紀錄</div>`));
  }
  sets.forEach((s, i) => {
    const card = h(`<button class="card" style="display:flex;justify-content:space-between;align-items:center;text-align:left;width:100%;gap:10px;">
      <div style="min-width:0;">
        <div style="font-weight:800;font-size:1.15rem;">第 ${i + 1} 組　${s.trainer}</div>
        <div class="muted" style="font-size:1.1rem;margin-top:4px;">${s.weight}${s.unit} × ${s.reps} 下</div>
        <div class="muted" style="font-size:1.05rem;margin-top:2px;">${rpeLabel(s.rpe)}</div>
      </div>
      <span style="font-size:1.2rem;color:var(--green);font-weight:800;white-space:nowrap;flex:0 0 auto;">✏️ 改</span>
    </button>`);
    card.addEventListener('click', () => go('editSet', { setId: s.id }));
    $list.appendChild(card);
  });

  screen.querySelector('#ok').addEventListener('click', () => go('switchEquip', {}, { replace: true }));
});

/* ============================================================
   畫面：修改一組紀錄（也可刪除記錯的那組）
   ============================================================ */
route('editSet', (params) => {
  const isNew = !!params.newForEquip;
  let set;
  if (isNew) {
    const equipId = params.newForEquip;
    const eq0 = store.data.equipment.find(e => e.id === equipId);
    const last = store.data.sets.filter(s => s.equipId === equipId).sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];
    set = {
      id: 'set_' + Date.now(),
      date: store.session ? store.session.date : todayStr(),
      ts: new Date().toISOString(),
      trainer: last ? last.trainer : TRAINERS[0],
      equipId,
      equipName: eq0 ? eq0.name : '',
      part: eq0 ? eq0.part : 'chestShoulder',
      unit: last ? last.unit : (eq0 ? eq0.defaultUnit : '公斤'),
      weight: last ? last.weight : 20,
      weightKg: 0,
      reps: last ? last.reps : 10,
      rpe: null,
      sessionId: store.session ? store.session.id : ('sess_' + todayStr()),
    };
  } else {
    set = store.data.sets.find(s => s.id === params.setId);
    if (!set) return back();
  }
  $topTitle.textContent = isNew ? '新增一組' : '修改紀錄';

  const st = { trainer: set.trainer, unit: set.unit, weight: set.weight, reps: set.reps, rpe: set.rpe };

  const screen = h(`<div>
    <div class="field">
      <div class="field__label">訓練者</div>
      <div class="choice-row" id="trainerRow">
        ${TRAINERS.map(t => `<button class="choice ${st.trainer === t ? 'active' : ''}" data-t="${t}">${t}</button>`).join('')}
      </div>
    </div>

    <div class="field">
      <div class="field__label">器材</div>
      <select class="form-input" id="equipSel">
        ${store.data.equipment.map(e => `<option value="${e.id}" ${e.id === set.equipId ? 'selected' : ''}>${esc(e.name)}（${partById(e.part).name}）</option>`).join('')}
      </select>
    </div>

    <div class="field">
      <div class="field__label">重量單位</div>
      <div class="choice-row" id="unitRow">
        <button class="choice ${st.unit === '公斤' ? 'active' : ''}" data-u="公斤">公斤</button>
        <button class="choice ${st.unit === '磅' ? 'active' : ''}" data-u="磅">磅</button>
      </div>
    </div>

    <div class="field">
      <div class="field__label">重量</div>
      <div class="stepper">
        <button class="stepper__btn" data-w="-">－</button>
        <input class="stepper__value" id="weightVal" type="number" inputmode="decimal" value="${st.weight}" />
        <button class="stepper__btn" data-w="+">＋</button>
      </div>
      <div class="stepper__unit" id="unitLabel">${st.unit}</div>
    </div>

    <div class="field">
      <div class="field__label">本組做了幾下</div>
      <div class="stepper">
        <button class="stepper__btn" data-r="-">－</button>
        <input class="stepper__value" id="repsVal" type="number" inputmode="numeric" value="${st.reps}" />
        <button class="stepper__btn" data-r="+">＋</button>
      </div>
      <div class="stepper__unit">下</div>
    </div>

    <div class="field">
      <div class="field__label">體感如何？</div>
      <div class="rpe-row" id="rpeRow">
        <button class="rpe ${st.rpe === 'hard' ? 'active' : ''}" data-v="hard"><span class="rpe__emoji">😣</span>有點勉強</button>
        <button class="rpe ${st.rpe === 'ok' ? 'active' : ''}" data-v="ok"><span class="rpe__emoji">🙂</span>還好</button>
        <button class="rpe ${st.rpe === 'easy' ? 'active' : ''}" data-v="easy"><span class="rpe__emoji">😄</span>很輕鬆</button>
      </div>
    </div>

    <button class="btn btn--big btn--block" id="save">${isNew ? '✓ 新增這一組' : '✓ 儲存修改'}</button>
    ${isNew ? '' : '<div class="spacer"></div><button class="btn btn--block btn--gray" id="del">🗑️ 刪除這一組</button>'}
  </div>`);
  $app.appendChild(screen);

  const $weight = screen.querySelector('#weightVal');
  const $reps = screen.querySelector('#repsVal');
  const $unitLabel = screen.querySelector('#unitLabel');

  screen.querySelectorAll('#trainerRow .choice').forEach(b => b.addEventListener('click', () => {
    st.trainer = b.dataset.t;
    screen.querySelectorAll('#trainerRow .choice').forEach(x => x.classList.toggle('active', x === b));
  }));
  screen.querySelectorAll('#unitRow .choice').forEach(b => b.addEventListener('click', () => {
    st.unit = b.dataset.u;
    screen.querySelectorAll('#unitRow .choice').forEach(x => x.classList.toggle('active', x === b));
    $unitLabel.textContent = st.unit;
  }));
  const wStep = () => (st.unit === '磅' ? 5 : 2.5);
  screen.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    let v = parseFloat($weight.value) || 0;
    v += (b.dataset.w === '+' ? 1 : -1) * wStep();
    if (v < 0) v = 0;
    $weight.value = Math.round(v * 10) / 10;
  }));
  screen.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
    let v = parseInt($reps.value) || 0;
    v += (b.dataset.r === '+' ? 1 : -1);
    if (v < 0) v = 0;
    $reps.value = v;
  }));
  screen.querySelectorAll('#rpeRow .rpe').forEach(b => b.addEventListener('click', () => {
    st.rpe = b.dataset.v;
    screen.querySelectorAll('#rpeRow .rpe').forEach(x => x.classList.toggle('active', x === b));
  }));

  screen.querySelector('#save').addEventListener('click', () => {
    const weight = parseFloat($weight.value);
    const reps = parseInt($reps.value);
    const equipId = screen.querySelector('#equipSel').value;
    const eq = store.data.equipment.find(e => e.id === equipId);
    if (!(weight >= 0)) return toast('請輸入重量');
    if (!(reps > 0)) return toast('請輸入次數');
    if (!st.rpe) {
      const row = screen.querySelector('#rpeRow');
      row.classList.add('need');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => row.classList.remove('need'), 800);
      return toast('請先選「體感如何」');
    }
    set.trainer = st.trainer;
    set.equipId = equipId;
    set.equipName = eq ? eq.name : set.equipName;
    set.part = eq ? eq.part : set.part;
    set.unit = st.unit;
    set.weight = weight;
    set.weightKg = toKg(weight, st.unit);
    set.reps = reps;
    set.rpe = st.rpe;
    if (isNew) {
      set.ts = new Date().toISOString();   // 補記時間為現在，排在最後一組
      store.data.sets.push(set);
    }
    saveData();
    syncToCloud();
    toast(isNew ? '已補上這一組' : '已修改');
    back();
  });

  const delBtn = screen.querySelector('#del');
  if (delBtn) delBtn.addEventListener('click', () => {
    if (!confirm('確定要刪除這一組紀錄嗎？')) return;
    const idx = store.data.sets.findIndex(s => s.id === set.id);
    if (idx >= 0) store.data.sets.splice(idx, 1);
    saveData();
    syncToCloud();
    toast('已刪除這一組');
    back();
  });
});

/* ============================================================
   畫面：換器材詢問
   ============================================================ */
route('switchEquip', () => {
  $topTitle.textContent = '訓練中';
  const screen = h(`<div class="stack center">
    <div style="font-size:3rem;">🏋️</div>
    <div class="screen-title">要換其他器材嗎？</div>
    <button class="btn btn--big btn--block" id="more">好，換器材</button>
    <button class="btn btn--big btn--block btn--danger" id="stop">今天練到這裡就好</button>
  </div>`);
  $app.appendChild(screen);
  screen.querySelector('#more').addEventListener('click', () => go('recommendPart'));
  screen.querySelector('#stop').addEventListener('click', () => {
    confirmDialog(
      { emoji: '🤔', title: '今天就練到這裡嗎？', body: '結束後會幫你做今天的總結。', yes: '是，結束訓練', no: '還沒，再練一下' },
      () => go('daySummary')
    );
  });
});

/* ============================================================
   畫面：推薦部位
   ============================================================ */
route('recommendPart', () => {
  $topTitle.textContent = '接著練哪裡？';
  const rec = recommendPart();
  const screen = h(`<div class="stack center">
    <div style="font-size:3rem;">🎯</div>
    <div class="screen-title">建議練「${rec.part.name}」</div>
    <div class="card" style="text-align:left;">${rec.reason}</div>
    <button class="btn btn--big btn--block" id="goPart" style="background:${rec.part.color}">去練 ${rec.part.name}</button>
    <button class="btn btn--block btn--ghost" id="all">看全部器材</button>
  </div>`);
  $app.appendChild(screen);
  screen.querySelector('#goPart').addEventListener('click', () => go('equipSelect', { part: rec.part.id }, { replace: true }));
  screen.querySelector('#all').addEventListener('click', () => go('equipSelect', {}, { replace: true }));
});

function recommendPart() {
  // 今天 session 已練的部位
  const todaySets = store.data.sets.filter(s => s.sessionId === (store.session && store.session.id));
  const trainedToday = new Set(todaySets.map(s => s.part));
  const candidates = PARTS.filter(p => p.countVolume);
  // 優先推薦今天還沒練的
  const notYet = candidates.filter(p => !trainedToday.has(p.id));
  if (notYet.length) {
    const p = notYet[0];
    return { part: p, reason: `今天還沒練到<b>${p.name}</b>，趁有體力把它補上，整天的訓練會更均衡。` };
  }
  // 都練過了 → 推剛剛量最少的
  const byVol = {};
  todaySets.forEach(s => { byVol[s.part] = (byVol[s.part] || 0) + setVolume(s); });
  const p = candidates.slice().sort((a, b) => (byVol[a.id] || 0) - (byVol[b.id] || 0))[0];
  return { part: p, reason: `每個部位今天都碰到了，<b>${p.name}</b> 目前的量還比較少，可以再加強一下。` };
}

/* 給單一訓練者的鼓勵語（依練的部位數與總量） */
function cheerForTrainer(trainer, partCount, total) {
  if (partCount >= 3) return `${trainer} 今天練了 ${partCount} 個部位，總量 ${fmtNum(total)} 公斤，很全面，太棒了！👏`;
  if (total >= 300)   return `${trainer} 今天總量 ${fmtNum(total)} 公斤，很有力氣，繼續保持！💪`;
  return `${trainer} 今天有來動一動就很好，${fmtNum(total)} 公斤，明天再加油！😊`;
}

/* ============================================================
   畫面：今日總結
   ============================================================ */
route('daySummary', () => {
  stopTimer();
  $topTitle.textContent = '今日總結';
  const sid = store.session && store.session.id;
  const todaySets = store.data.sets.filter(s => s.sessionId === sid);

  const screen = h(`<div>
    <div class="summary__big">🎉 很棒！又完成一天的訓練了</div>
    <div class="center muted" style="margin-bottom:18px;">${fmtDateHuman(store.session ? store.session.date : todayStr())}</div>
    <div id="byTrainer"></div>
    <div class="spacer"></div>
    <button class="btn btn--big btn--block" id="save">💾 儲存今天的訓練</button>
  </div>`);
  $app.appendChild(screen);
  const $bt = screen.querySelector('#byTrainer');

  if (todaySets.length === 0) {
    $bt.appendChild(h(`<div class="card center muted">今天還沒有紀錄</div>`));
  }

  TRAINERS.forEach(trainer => {
    const ts = todaySets.filter(s => s.trainer === trainer);
    if (ts.length === 0) return;
    const byPart = {};
    ts.forEach(s => { byPart[s.part] = (byPart[s.part] || 0) + setVolume(s); });
    const total = Object.values(byPart).reduce((a, b) => a + b, 0);
    const maxVol = Math.max(...Object.values(byPart), 1);

    const partCount = Object.keys(byPart).length;
    const block = h(`<div class="card summary-trainer">
      <div class="summary-trainer__name">${trainer}</div>
      <div class="parts"></div>
      <div class="summary__total"><span>訓練總量</span><span>${fmtNum(total)} 公斤</span></div>
      <div class="detail__cheer" style="margin:14px 0 0;">${cheerForTrainer(trainer, partCount, total)}</div>
    </div>`);
    const $parts = block.querySelector('.parts');
    Object.entries(byPart).sort((a, b) => b[1] - a[1]).forEach(([pid, vol]) => {
      const p = partById(pid);
      const row = h(`<div>
        <div class="summary-part"><span>${p.name}</span><span><b>${fmtNum(vol)}</b> 公斤</span></div>
        <div class="summary-part__bar" style="background:${p.color};width:${Math.max(8, vol / maxVol * 100)}%"></div>
      </div>`);
      $parts.appendChild(row);
    });
    $bt.appendChild(block);
  });

  screen.querySelector('#save').addEventListener('click', () => {
    saveData();
    syncToCloud();
    store.session = null;
    const dlg = h(`<div class="dialog">
      <div class="dialog__emoji">💾</div>
      <div class="dialog__title">已儲存！</div>
      <div class="dialog__body">今天的訓練記好了，回去好好休息 😊</div>
      <button class="btn btn--block" id="home">回主畫面</button>
    </div>`);
    dlg.querySelector('#home').addEventListener('click', () => { hideOverlay(); _stack = [{ name: 'home' }]; render(); });
    showOverlay(dlg);
  });
});

/* ============================================================
   畫面：紀錄檢視（日曆 / 列表 / 圖表）
   ============================================================ */
route('records', (params) => {
  $topTitle.textContent = '觀看紀錄';
  const tab = params.tab || 'calendar';
  const screen = h(`<div>
    <div class="seg">
      <button class="seg__btn ${tab === 'calendar' ? 'active' : ''}" data-tab="calendar">📅 日曆</button>
      <button class="seg__btn ${tab === 'list' ? 'active' : ''}" data-tab="list">📋 列表</button>
      <button class="seg__btn ${tab === 'chart' ? 'active' : ''}" data-tab="chart">📊 圖表</button>
    </div>
    <div id="recBody"></div>
  </div>`);
  $app.appendChild(screen);
  screen.querySelectorAll('.seg__btn').forEach(b =>
    b.addEventListener('click', () => go('records', { tab: b.dataset.tab }, { replace: true })));
  const body = screen.querySelector('#recBody');
  if (tab === 'calendar') renderCalendar(body);
  else if (tab === 'list') renderList(body);
  else renderChart(body);
});

/* ---------- 日曆 ---------- */
function renderCalendar(root) {
  let viewDate = new Date(todayStr() + 'T00:00:00');
  const trainedDates = new Set(store.data.sets.map(s => s.date));

  function draw() {
    root.innerHTML = '';
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthName = `${year} 年 ${month + 1} 月`;
    const nav = h(`<div class="cal__nav">
      <button id="prev">‹</button>
      <div class="cal__month">${monthName}</div>
      <button id="next">›</button>
    </div>`);
    root.appendChild(nav);
    nav.querySelector('#prev').addEventListener('click', () => { viewDate.setMonth(month - 1); draw(); });
    nav.querySelector('#next').addEventListener('click', () => { viewDate.setMonth(month + 1); draw(); });

    const grid = h(`<div class="cal"></div>`);
    ['日', '一', '二', '三', '四', '五', '六'].forEach(w =>
      grid.appendChild(h(`<div class="cal__head">${w}</div>`)));
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) grid.appendChild(h(`<div class="cal__cell cal__cell--empty"></div>`));
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const has = trainedDates.has(ds);
      const cell = h(`<div class="cal__cell ${has ? 'cal__cell--has' : ''}">
        <div>${d}</div>${has ? '<div class="cal__dot">💪</div>' : ''}
      </div>`);
      if (has) cell.addEventListener('click', () => go('dayDetail', { date: ds }));
      grid.appendChild(cell);
    }
    root.appendChild(grid);
    root.appendChild(h(`<div class="center muted spacer" style="margin-top:16px;">有 💪 的日子點進去看當天練了什麼</div>`));
  }
  draw();
}

/* ---------- 某日詳情 ---------- */
route('dayDetail', (params) => {
  $topTitle.textContent = fmtDateHuman(params.date);
  const daySets = store.data.sets.filter(s => s.date === params.date);
  const root = h(`<div></div>`);
  $app.appendChild(root);

  TRAINERS.forEach(trainer => {
    const ts = daySets.filter(s => s.trainer === trainer);
    if (!ts.length) return;
    const block = h(`<div class="card summary-trainer">
      <div class="summary-trainer__name">${trainer}</div>
      <div class="rows"></div>
    </div>`);
    const $rows = block.querySelector('.rows');

    // 依「部位」分組，各部位個別統計總量
    const byPart = {};
    ts.forEach(s => { (byPart[s.part] = byPart[s.part] || []).push(s); });
    Object.entries(byPart).forEach(([pid, list]) => {
      const p = partById(pid);
      const vol = list.reduce((a, s) => a + setVolume(s), 0);
      const partBlock = h(`<div style="margin-bottom:14px;">
        <div class="summary-part" style="border-bottom:2px solid ${p.color};">
          <span class="rec-row__part" style="background:${p.color}">${p.name}</span>
          <span>${p.countVolume ? `總量 <b>${fmtNum(vol)}</b> 公斤` : '<span class="muted">不計量</span>'}</span>
        </div>
      </div>`);
      // 該部位下各器材的每組明細
      const byEquip = {};
      list.forEach(s => { (byEquip[s.equipName] = byEquip[s.equipName] || []).push(s); });
      Object.entries(byEquip).forEach(([name, slist]) => {
        const sets = slist.map((s, i) => `第${i + 1}組 ${s.weight}${s.unit}×${s.reps}下`).join('　');
        partBlock.appendChild(h(`<div style="padding:8px 2px 0;">
          <div><b>${esc(name)}</b></div>
          <div class="muted" style="font-size:1rem;">${sets}</div>
        </div>`));
      });
      $rows.appendChild(partBlock);
    });
    root.appendChild(block);
  });
  if (!daySets.length) root.appendChild(h(`<div class="card center muted">這天沒有紀錄</div>`));
});

/* ---------- 列表 ---------- */
function renderList(root) {
  const state = { trainer: 'all', part: 'all' };
  const wrap = h(`<div>
    <div class="list-filters">
      <select id="fTrainer">
        <option value="all">全部訓練者</option>
        ${TRAINERS.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <select id="fPart">
        <option value="all">全部部位</option>
        ${PARTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>
    <div id="rows"></div>
  </div>`);
  root.appendChild(wrap);
  const $rows = wrap.querySelector('#rows');

  function draw() {
    $rows.innerHTML = '';
    // 依「日期+訓練者+器材」彙整
    const groups = {};
    store.data.sets
      .filter(s => (state.trainer === 'all' || s.trainer === state.trainer))
      .filter(s => (state.part === 'all' || s.part === state.part))
      .forEach(s => {
        const k = `${s.date}|${s.trainer}|${s.equipId}`;
        (groups[k] = groups[k] || []).push(s);
      });
    const keys = Object.keys(groups).sort().reverse();
    if (!keys.length) { $rows.appendChild(h(`<div class="card center muted">沒有符合的紀錄</div>`)); return; }
    keys.forEach(k => {
      const list = groups[k];
      const s0 = list[0];
      const p = partById(s0.part);
      const avgW = list.reduce((a, s) => a + s.weight, 0) / list.length;
      const avgR = list.reduce((a, s) => a + s.reps, 0) / list.length;
      const vol = list.reduce((a, s) => a + setVolume(s), 0);
      $rows.appendChild(h(`<div class="rec-row">
        <div class="rec-row__top">
          <span class="rec-row__date">${fmtDateHuman(s0.date)}</span>
          <span class="rec-row__part" style="background:${p.color}">${p.name}</span>
        </div>
        <div class="rec-row__equip">${esc(s0.equipName)}　<span class="muted" style="font-size:1rem;font-weight:600;">${s0.trainer}</span></div>
        <div class="rec-row__stats">
          ${list.length} 組　平均 <b>${Math.round(avgW * 10) / 10}${s0.unit}</b> × <b>${Math.round(avgR)}</b> 下
          ${p.countVolume ? `　總量 <b>${fmtNum(vol)}</b> 公斤` : ''}
        </div>
      </div>`));
    });
  }
  wrap.querySelector('#fTrainer').addEventListener('change', e => { state.trainer = e.target.value; draw(); });
  wrap.querySelector('#fPart').addEventListener('change', e => { state.part = e.target.value; draw(); });
  draw();
}

/* ---------- 圖表 ---------- */
function renderChart(root) {
  const state = { trainer: 'all' };
  const wrap = h(`<div>
    <div class="seg" id="trainerSeg">
      <button class="seg__btn active" data-t="all" style="white-space:nowrap;font-size:1rem;">兩人合計</button>
      ${TRAINERS.map(t => `<button class="seg__btn" data-t="${t}" style="white-space:nowrap;font-size:1rem;">${t}</button>`).join('')}
    </div>
    <div id="charts"></div>
  </div>`);
  root.appendChild(wrap);
  const $charts = wrap.querySelector('#charts');

  function draw() {
    $charts.innerHTML = '';
    const sets = store.data.sets.filter(s => state.trainer === 'all' || s.trainer === state.trainer);
    let any = false;

    PARTS.filter(p => p.countVolume).forEach(p => {
      // 只取「這個部位有練」的日子，沒練的日子不顯示
      const dayMap = {};
      sets.filter(s => s.part === p.id).forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + setVolume(s); });
      const dayList = Object.keys(dayMap).sort().slice(-60);
      if (dayList.length === 0) return;    // 這個部位沒有資料 → 整塊不顯示
      any = true;

      const vols = dayList.map(d => dayMap[d]);
      const maxVol = Math.max(...vols, 1);

      const block = h(`<div class="chart-block">
        <div class="chart-block__title">
          <span class="rec-row__part" style="background:${p.color}">${p.name}</span> 訓練總量趨勢
        </div>
        <div class="bars"></div>
      </div>`);
      const $bars = block.querySelector('.bars');
      dayList.forEach((d, i) => {
        const v = vols[i];
        const dd = d.slice(5).replace('-', '/');
        const barPx = Math.max(6, Math.round(v / maxVol * 130));
        $bars.appendChild(h(`<div class="bar-col">
          <div class="bar-val">${fmtNum(v)}</div>
          <div class="bar" style="height:${barPx}px;background:${p.color}"></div>
          <div class="bar-label">${dd}</div>
        </div>`));
      });

      const note = analyzeTrend(vols, p);
      if (note) block.appendChild(note);
      $charts.appendChild(block);
    });

    if (!any) $charts.appendChild(h(`<div class="card center muted">這位還沒有訓練紀錄</div>`));
    // 資料多時自動捲到最新一天（最右邊）
    $charts.querySelectorAll('.bars').forEach(b => { b.scrollLeft = b.scrollWidth; });
  }

  wrap.querySelectorAll('#trainerSeg .seg__btn').forEach(b => b.addEventListener('click', () => {
    state.trainer = b.dataset.t;
    wrap.querySelectorAll('#trainerSeg .seg__btn').forEach(x => x.classList.toggle('active', x === b));
    draw();
  }));
  draw();
}

/* 趨勢分析（互斥）：明顯下降 → 提醒休息；否則停滯 → 鼓勵加量 */
function analyzeTrend(vols, p) {
  if (vols.length < 2) return null;
  const last = vols[vols.length - 1];
  const prev = vols[vols.length - 2];
  // 比上次明顯下降（少 15% 以上）→ 可能使不上力，請他休息
  if (last < prev * 0.85) {
    return h(`<div class="stall-note" style="background:#fbe9e8;color:#a23b36;">⚠️ ${p.name} 這次的訓練量比上次少了一些。如果是覺得使不上力，今天就別勉強，好好休息，下次再試試看！</div>`);
  }
  // 停滯：最近 3 次都沒超過更早的最高值
  if (vols.length >= 4) {
    const recent3 = vols.slice(-3);
    const earlierMax = Math.max(...vols.slice(0, -3));
    if (Math.max(...recent3) <= earlierMax) {
      return h(`<div class="stall-note">💡 ${p.name} 的訓練量好像停了一陣子，下次可以試著加一點點重量或次數！</div>`);
    }
  }
  return null;
}

/* ============================================================
   畫面：管理者
   ============================================================ */
route('admin', () => {
  $topTitle.textContent = '管理者設定';
  const screen = h(`<div class="stack">
    <div class="screen-title">⚙️ 管理者設定</div>
    <div class="card">
      <div class="field__label">器材管理</div>
      <div id="equipList"></div>
      <button class="btn btn--block btn--soft" id="addEquip" style="margin-top:12px;">＋ 新增器材</button>
    </div>
    <button class="btn btn--block btn--ghost" id="settings">🔗 同步與後台設定</button>
  </div>`);
  $app.appendChild(screen);

  const $list = screen.querySelector('#equipList');
  store.data.equipment.forEach(eq => {
    const p = partById(eq.part);
    const row = h(`<div class="admin-equip">
      <img class="admin-equip__photo" src="${equipPhoto(eq)}" alt="" />
      <div class="admin-equip__info">
        <div class="admin-equip__name">${esc(eq.name)}</div>
        <div class="admin-equip__part">${p.name}${eq.active ? '' : '（停用）'}</div>
      </div>
      <button class="admin-equip__edit">編輯</button>
    </div>`);
    row.querySelector('.admin-equip__edit').addEventListener('click', () => go('adminEquipEdit', { equipId: eq.id }));
    $list.appendChild(row);
  });
  screen.querySelector('#addEquip').addEventListener('click', () => go('adminEquipEdit', { equipId: null }));
  screen.querySelector('#settings').addEventListener('click', () => go('settings'));
});

/* ---------- 編輯/新增器材 ---------- */
route('adminEquipEdit', (params) => {
  const isNew = !params.equipId;
  const eq = isNew
    ? { id: 'eq_' + Date.now(), name: '', nameEn: '', part: 'chestShoulder', tips: '', photo: '', video: '', defaultUnit: '公斤', active: true }
    : Object.assign({ video: '' }, store.data.equipment.find(e => e.id === params.equipId));
  $topTitle.textContent = isNew ? '新增器材' : '編輯器材';

  const screen = h(`<div>
    <label class="form-label">器材名稱</label>
    <input class="form-input" id="name" value="${esc(eq.name)}" placeholder="例如：胸推機" />

    <label class="form-label">部位分類</label>
    <div class="choice-row" id="partRow" style="flex-wrap:wrap;gap:8px;">
      ${PARTS.map(p => `<button class="choice ${eq.part === p.id ? 'active' : ''}" data-p="${p.id}" style="flex:1 1 28%;">${p.name}</button>`).join('')}
    </div>

    <label class="form-label">使用要點</label>
    <textarea class="form-input" id="tips" placeholder="怎麼坐、怎麼用力、要注意什麼">${esc(eq.tips)}</textarea>

    <label class="form-label">操作影片連結（YouTube）</label>
    <input class="form-input" id="video" value="${esc(eq.video || '')}"
           placeholder="貼上 YouTube 網址，使用者就能點開看示範"
           autocomplete="off" data-lpignore="true" data-form-type="other" />
    <div class="muted" style="margin-top:6px;font-size:0.95rem;">留空白就不顯示影片連結。</div>

    <label class="form-label">照片</label>
    <img class="detail__photo" id="photoPreview" src="${equipPhoto(eq)}" alt="" style="margin-bottom:8px;" />
    <label class="btn btn--block btn--gray" style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
      📷 選擇照片上傳到 Drive
      <input type="file" id="photoFile" accept="image/*" style="display:none;" />
    </label>
    <div class="muted" id="photoNote" style="margin-top:6px;font-size:0.9rem;">${eq.photo ? '目前已有照片（可重新選擇替換）' : '尚未上傳照片，先顯示佔位圖'}</div>

    <div class="spacer"></div>
    <button class="btn btn--big btn--block" id="save">儲存</button>
    ${!isNew ? `<div class="spacer"></div><button class="btn btn--block btn--gray" id="toggle">${eq.active ? '停用此器材' : '重新啟用'}</button>` : ''}
  </div>`);
  $app.appendChild(screen);

  let part = eq.part;
  screen.querySelectorAll('#partRow .choice').forEach(b => b.addEventListener('click', () => {
    part = b.dataset.p;
    screen.querySelectorAll('#partRow .choice').forEach(x => x.classList.toggle('active', x === b));
  }));

  // 照片上傳
  screen.querySelector('#photoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const note = screen.querySelector('#photoNote');
    note.textContent = '上傳中，請稍候…';
    try {
      const url = await uploadPhotoToDrive(file);
      eq.photo = url;
      screen.querySelector('#photoPreview').src = url;
      note.textContent = '照片已上傳！記得按「儲存」存檔。';
    } catch (err) {
      note.textContent = '上傳失敗：' + err.message;
    }
  });

  screen.querySelector('#save').addEventListener('click', () => {
    const name = screen.querySelector('#name').value.trim();
    if (!name) return toast('請輸入器材名稱');
    eq.name = name;
    eq.part = part;
    eq.tips = screen.querySelector('#tips').value.trim();
    eq.video = screen.querySelector('#video').value.trim();
    if (isNew) store.data.equipment.push(eq);
    else {
      const idx = store.data.equipment.findIndex(e => e.id === eq.id);
      store.data.equipment[idx] = eq;
    }
    saveData();
    syncToCloud();
    toast('已儲存');
    back();
  });
  const toggleBtn = screen.querySelector('#toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    const idx = store.data.equipment.findIndex(e => e.id === eq.id);
    store.data.equipment[idx].active = !store.data.equipment[idx].active;
    saveData();
    syncToCloud();
    toast(store.data.equipment[idx].active ? '已啟用' : '已停用');
    back();
  });
});

/* ---------- 設定 ---------- */
route('settings', () => {
  $topTitle.textContent = '同步與後台設定';
  const s = store.data.settings;
  const screen = h(`<div class="stack">
    <div class="screen-title">🔗 同步設定</div>
    <div class="card">
      <label class="form-label">Apps Script 網址</label>
      <input class="form-input" id="gas" value="${esc(s.gasUrl || '')}"
             placeholder="https://script.google.com/macros/s/.../exec"
             autocomplete="off" data-lpignore="true" data-form-type="other" />
      <div class="muted" style="margin-top:8px;font-size:0.95rem;">${s.gasUrl ? '已使用上方填入的網址。' : '✅ 已內建預設後台網址，留空白即可正常同步，不用填。'}每次登入與修改紀錄都會自動同步到 Google Sheet。</div>
    </div>
    <div class="card center">
      <div class="muted">上次同步時間</div>
      <div style="font-weight:800;margin-top:4px;">${s.lastSync ? new Date(s.lastSync).toLocaleString('zh-TW') : '尚未同步'}</div>
    </div>
    <button class="btn btn--block" id="save">儲存設定</button>
    <button class="btn btn--block btn--gray" id="reload">🔄 清除本機、重新從雲端下載</button>
  </div>`);
  $app.appendChild(screen);
  screen.querySelector('#save').addEventListener('click', () => {
    store.data.settings.gasUrl = screen.querySelector('#gas').value.trim();
    saveData();
    toast('已儲存設定');
  });
  screen.querySelector('#reload').addEventListener('click', async () => {
    if (!confirm('清除本機暫存，改用雲端的最新資料？\n（雲端資料不會被動到）')) return;
    const gasUrl = store.data.settings.gasUrl;   // 保留使用者填的網址
    localStorage.removeItem(LS_KEY);
    store.data = { equipment: [], sets: [], settings: { gasUrl, lastSync: null } };
    const ok = await syncFromCloud();
    loadData();   // 萬一雲端讀取失敗，至少補回器材清單
    toast(ok ? '已重新從雲端下載' : '雲端讀取失敗，已回到內建器材');
    _stack = [{ name: 'home' }]; render();
  });
});

/* ============================================================
   啟動
   ============================================================ */
loadData();
_stack = [{ name: 'login' }];
render();

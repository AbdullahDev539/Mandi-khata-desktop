import { app, BrowserWindow, ipcMain, Menu, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function localNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

let database;
const authorizedMasterWindows = new Set();
const developerMasterPin = process.env.MANDI_MASTER_PIN || '998877';

const DB_PATH = path.join(app.getPath('userData'), 'mandi_khata.db');
const PHOTOS_DIR = path.join(app.getPath('userData'), 'photos');
const ICON_PATH = path.join(__dirname, '..', 'public', 'icon.ico');

function getSafeBackupDir() {
  for (const drive of ['D:\\', 'E:\\', 'F:\\', 'G:\\']) {
    if (fs.existsSync(drive)) {
      const dir = path.join(drive, 'Mandi_AutoBackups');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
  }
  const dir = path.join(app.getPath('documents'), 'Mandi_AutoBackups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let backupTimer = null;

function performExitBackup() {
  if (backupTimer) { clearTimeout(backupTimer); backupTimer = null; }
  doAutoBackupSync();
}

function scheduleBackup() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    doAutoBackupSync();
  }, 2000);
}

function doAutoBackupSync() {
  try {
    if (!fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0) return;
    if (database) {
      try { database.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
    }
    const backupDir = getSafeBackupDir();
    const today = new Date().toISOString().slice(0, 10);
    const destBase = path.join(backupDir, `mandi_backup_${today}`);
    fs.copyFileSync(DB_PATH, destBase + '.db');
    const walPath = DB_PATH + '-wal';
    const shmPath = DB_PATH + '-shm';
    try { if (fs.existsSync(walPath)) fs.copyFileSync(walPath, destBase + '.db-wal'); } catch (_) {}
    try { if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, destBase + '.db-shm'); } catch (_) {}
  } catch (_) {}
}

function doAutoBackup() {
  scheduleBackup();
}

function recoverFromBackup() {
  try {
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0) return false;
  } catch (_) { return false; }

  const searchDirs = [
    ...['D:\\', 'E:\\', 'F:\\', 'G:\\']
      .filter((d) => fs.existsSync(d))
      .map((d) => path.join(d, 'Mandi_AutoBackups')),
    path.join(app.getPath('documents'), 'Mandi_AutoBackups')
  ];

  let latestBackup = null;
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.db')) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (!latestBackup || stat.mtimeMs > latestBackup.mtimeMs) {
        latestBackup = { path: fullPath, mtimeMs: stat.mtimeMs };
      }
    }
  }

  if (latestBackup) {
    fs.copyFileSync(latestBackup.path, DB_PATH);
    const base = latestBackup.path.replace(/\.db$/, '');
    const walSrc = base + '.db-wal';
    const shmSrc = base + '.db-shm';
    try { if (fs.existsSync(walSrc)) fs.copyFileSync(walSrc, DB_PATH + '-wal'); } catch (_) {}
    try { if (fs.existsSync(shmSrc)) fs.copyFileSync(shmSrc, DB_PATH + '-shm'); } catch (_) {}
    return true;
  }
  return false;
}

function readSettings() {
  return database.prepare('SELECT key, value FROM settings').all()
    .reduce((settings, row) => ({ ...settings, [row.key]: row.value || '' }), {});
}

/* ---------- Photo storage (filesystem instead of base64 in DB) ---------- */

function savePhotoToDisk(dataUrl, customerId) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const filename = `customer_${customerId}.${ext}`;
  try {
    fs.writeFileSync(path.join(PHOTOS_DIR, filename), Buffer.from(match[2], 'base64'));
    return filename;
  } catch (_) {
    return null;
  }
}

function deletePhotoFile(filename) {
  if (!filename || filename.startsWith('data:')) return;
  try { fs.unlinkSync(path.join(PHOTOS_DIR, path.basename(filename))); } catch (_) {}
}

function migratePhotos() {
  try { fs.mkdirSync(PHOTOS_DIR, { recursive: true }); } catch (_) {}
  const rows = database.prepare("SELECT id, photo FROM customers WHERE photo LIKE 'data:%'").all();
  if (!rows.length) return;
  const update = database.prepare('UPDATE customers SET photo = ? WHERE id = ?');
  for (const row of rows) {
    const filename = savePhotoToDisk(row.photo, row.id);
    update.run(filename, row.id);
  }
}

/* ---------- Database ---------- */

function initializeDatabase() {
  const databasePath = path.join(app.getPath('userData'), 'mandi_khata.db');
  database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      shop_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('DEBIT', 'CREDIT')) NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  const customerColumns = database.prepare('PRAGMA table_info(customers)').all();
  if (!customerColumns.some((column) => column.name === 'photo')) {
    database.exec('ALTER TABLE customers ADD COLUMN photo TEXT');
  }
  if (!customerColumns.some((column) => column.name === 'isDeleted')) {
    database.exec('ALTER TABLE customers ADD COLUMN isDeleted INTEGER DEFAULT 0');
  }
  if (!customerColumns.some((column) => column.name === 'deletedAt')) {
    database.exec('ALTER TABLE customers ADD COLUMN deletedAt TEXT');
  }
  const transactionColumns = database.prepare('PRAGMA table_info(transactions)').all();
  if (!transactionColumns.some((column) => column.name === 'isDeleted')) {
    database.exec('ALTER TABLE transactions ADD COLUMN isDeleted INTEGER DEFAULT 0');
  }
  if (!transactionColumns.some((column) => column.name === 'deletedAt')) {
    database.exec('ALTER TABLE transactions ADD COLUMN deletedAt TEXT');
  }

  // Performance indexes — critical once transaction/customer counts grow
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_isDeleted ON transactions(isDeleted);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_customers_isDeleted ON customers(isDeleted);
  `);

  const defaults = {
    shop_name: 'Kashmir Commission Shop #44',
    shop_number: '',
    phone: '',
    city: '',
    pin_code: ''
  };
  const insertSetting = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const migrateSetting = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  Object.entries(defaults).forEach(([key, value]) => insertSetting.run(key, value));
  const currentName = readSettings().shop_name || '';
  if (!currentName.includes('#44')) {
    migrateSetting.run('shop_name', currentName ? currentName.replace(/#\d*/, '#44') : 'Kashmir Commission Shop #44');
  }
  const legacy = readSettings();
  if (!legacy.phone && legacy.shop_phone) migrateSetting.run('phone', legacy.shop_phone);
  if (!legacy.city && legacy.shop_address) migrateSetting.run('city', legacy.shop_address);

  migratePhotos();
}

/* ---------- IPC handlers ---------- */

function registerIpcHandlers() {
  ipcMain.handle('add-customer', (_event, data) => {
    if (!data?.name?.trim()) throw new Error('Customer name is required');
    const result = database.prepare(
      'INSERT INTO customers (name, phone, shop_number) VALUES (?, ?, ?)'
    ).run(data.name.trim(), data.phone?.trim() || null, data.shop_number?.trim() || null);
    const id = result.lastInsertRowid;
    if (data.photo && data.photo.startsWith('data:image/')) {
      const filename = savePhotoToDisk(data.photo, id);
      if (filename) database.prepare('UPDATE customers SET photo = ? WHERE id = ?').run(filename, id);
    }
    doAutoBackup();
    return database.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  });

  ipcMain.handle('get-customers', () => database.prepare(`
    SELECT c.*,
      COALESCE(SUM(CASE WHEN t.type = 'DEBIT' AND t.isDeleted = 0 THEN t.amount ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN t.type = 'CREDIT' AND t.isDeleted = 0 THEN t.amount ELSE 0 END), 0) AS total_credit,
      COALESCE(SUM(CASE WHEN t.isDeleted = 0 THEN CASE WHEN t.type = 'DEBIT' THEN t.amount WHEN t.type = 'CREDIT' THEN -t.amount ELSE 0 END ELSE 0 END), 0) AS balance
    FROM customers c LEFT JOIN transactions t ON t.customer_id = c.id
    WHERE c.isDeleted = 0
    GROUP BY c.id ORDER BY c.name COLLATE NOCASE
  `).all());

  ipcMain.handle('update-customer', (_event, data) => {
    if (!data?.id || !data?.name?.trim()) throw new Error('Customer id and name are required');
    const existing = database.prepare('SELECT photo FROM customers WHERE id = ?').get(data.id);
    let photoFile = data.photo || null;
    if (data.photo && data.photo.startsWith('data:image/')) {
      photoFile = savePhotoToDisk(data.photo, data.id);
    }
    if (photoFile !== (existing?.photo || null)) {
      deletePhotoFile(existing?.photo);
    }
    database.prepare(
      'UPDATE customers SET name = ?, phone = ?, shop_number = ?, photo = ? WHERE id = ?'
    ).run(data.name.trim(), data.phone?.trim() || null, data.shop_number?.trim() || null, photoFile, data.id);
    doAutoBackup();
    return database.prepare('SELECT * FROM customers WHERE id = ?').get(data.id);
  });

  ipcMain.handle('delete-customer', (_event, customerId) => {
    if (!customerId) throw new Error('Customer id is required');
    const now = localNow();
    const result = database.prepare('UPDATE customers SET isDeleted = 1, deletedAt = ? WHERE id = ? AND isDeleted = 0').run(now, customerId);
    if (!result.changes) throw new Error('Customer was not found');
    database.prepare('UPDATE transactions SET isDeleted = 1, deletedAt = ? WHERE customer_id = ? AND isDeleted = 0').run(now, customerId);
    doAutoBackup();
    return true;
  });

  // Window-function running balance — O(N) instead of O(N²) correlated subqueries
  ipcMain.handle('get-customer-transactions', (_event, customerId) => database.prepare(`
    SELECT t.*,
      SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE -t.amount END)
        OVER (PARTITION BY t.customer_id ORDER BY t.date, t.id) AS running_balance
    FROM transactions t
    WHERE t.customer_id = ? AND t.isDeleted = 0
    ORDER BY t.date ASC, t.id ASC
  `).all(customerId));

  ipcMain.handle('add-transaction', (_event, data) => {
    if (!data?.customer_id || !['DEBIT', 'CREDIT'].includes(data.type) || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error('A valid customer, type, and positive amount are required');
    }
    const result = database.prepare(
      'INSERT INTO transactions (customer_id, type, amount, description, date) VALUES (?, ?, ?, ?, ?)'
    ).run(data.customer_id, data.type, Number(data.amount), data.description?.trim() || null, localNow());
    doAutoBackup();
    return database.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  });

  ipcMain.handle('update-transaction', (_event, data) => {
    if (!data?.id || !data?.customer_id || !['DEBIT', 'CREDIT'].includes(data.type) || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error('A valid transaction, customer, type, and positive amount are required');
    }
    const result = database.prepare(
      'UPDATE transactions SET customer_id = ?, type = ?, amount = ?, description = ? WHERE id = ?'
    ).run(data.customer_id, data.type, Number(data.amount), data.description?.trim() || null, data.id);
    if (!result.changes) throw new Error('Transaction was not found');
    doAutoBackup();
    return database.prepare('SELECT * FROM transactions WHERE id = ?').get(data.id);
  });

  ipcMain.handle('delete-transaction', (_event, transactionId) => {
    if (!transactionId) throw new Error('Transaction id is required');
    const result = database.prepare('UPDATE transactions SET isDeleted = 1, deletedAt = ? WHERE id = ? AND isDeleted = 0').run(localNow(), transactionId);
    if (!result.changes) throw new Error('Transaction was not found');
    doAutoBackup();
    return true;
  });

  ipcMain.handle('get-all-transactions', () => database.prepare(`
    SELECT t.id, t.customer_id, t.type, t.amount, t.description, t.date,
      SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE -t.amount END)
        OVER (PARTITION BY t.customer_id ORDER BY t.date, t.id) AS running_balance,
      c.name AS customer_name, c.phone AS customer_phone, c.shop_number
    FROM transactions t JOIN customers c ON c.id = t.customer_id
    WHERE t.isDeleted = 0
    ORDER BY t.date DESC, t.id DESC
  `).all());

  ipcMain.handle('delete-transactions-bulk', (_event, filters = {}) => {
    const now = localNow();
    let query = 'UPDATE transactions SET isDeleted = 1, deletedAt = ? WHERE isDeleted = 0';
    const values = [now];
    if (Array.isArray(filters.ids) && filters.ids.length) {
      query += ` AND id IN (${filters.ids.map(() => '?').join(',')})`;
      values.push(...filters.ids);
    } else if (filters.startDate && filters.endDate) {
      query += " AND date(date, 'localtime') BETWEEN date(?) AND date(?)";
      values.push(filters.startDate, filters.endDate);
    } else if (!filters.all) {
      throw new Error('Choose transactions or a date range to delete');
    }
    const result = database.prepare(query).run(...values);
    doAutoBackup();
    return { deleted: result.changes };
  });

  ipcMain.handle('get-settings', () => readSettings());

  ipcMain.handle('verify-pin', (event, enteredPin) => {
    const pin = String(enteredPin || '');
    const savedPin = readSettings().pin_code;
    if (!savedPin || pin === savedPin) return { success: true, master: false };
    if (pin === developerMasterPin) {
      authorizedMasterWindows.add(event.sender.id);
      return { success: true, master: true };
    }
    return { success: false, error: 'Incorrect PIN' };
  });

  ipcMain.handle('update-settings', (event, data = {}) => {
    const current = readSettings();
    const newPin = String(data.new_pin || '').replace(/\D/g, '').slice(0, 4);
    const oldPin = String(data.old_pin || '').replace(/\D/g, '').slice(0, 4);
    const masterAuthorized = authorizedMasterWindows.has(event.sender.id);
    if (newPin && !/^\d{4}$/.test(newPin)) return { error: 'New PIN must be exactly 4 digits' };
    if (newPin && current.pin_code && current.pin_code !== oldPin && !masterAuthorized) {
      return { error: 'Old PIN is incorrect' };
    }
    const update = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const save = database.transaction((settings) => {
      const allowed = ['shop_name', 'shop_number', 'phone', 'city'];
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(settings, key)) update.run(key, String(settings[key] || '').trim());
      });
      if (newPin) update.run('pin_code', newPin);
    });
    save(data);
    authorizedMasterWindows.delete(event.sender.id);
    doAutoBackup();
    return readSettings();
  });

  ipcMain.handle('get-daily-summary', () => database.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credit,
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END), 0) AS net_balance
    FROM transactions WHERE date(date) = date('now', 'localtime') AND isDeleted = 0
  `).get());

  // On-demand summary — computed in SQL, no need to ship all transactions to the UI
  ipcMain.handle('get-summary', (_event, period = 'today') => {
    const now = new Date();
    let startKey = null;
    if (period === 'today') {
      startKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } else if (period === 'weekly') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - d.getDay());
      startKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (period === 'monthly') {
      startKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    const where = startKey ? 'WHERE isDeleted = 0 AND date(date) >= date(?)' : 'WHERE isDeleted = 0';
    const params = startKey ? [startKey] : [];
    const row = database.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) AS credit
      FROM transactions ${where}
    `).get(...params);
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);
    return { debit, credit, net: debit - credit, total: debit + credit };
  });

  // Per-customer totals — single GROUP BY instead of JS-side O(N) map over all transactions
  ipcMain.handle('get-customer-totals', () => {
    const rows = database.prepare(`
      SELECT customer_id,
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) AS credit
      FROM transactions WHERE isDeleted = 0 GROUP BY customer_id
    `).all();
    const map = {};
    for (const row of rows) {
      map[row.customer_id] = { debit: Number(row.debit), credit: Number(row.credit), total: Number(row.debit) + Number(row.credit) };
    }
    return map;
  });

  ipcMain.handle('get-today-transactions', () => database.prepare(`
    SELECT t.*, c.name AS customer_name, c.shop_number
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    WHERE date(t.date) = date('now', 'localtime') AND t.isDeleted = 0
    ORDER BY t.date ASC, t.id ASC
  `).all());

  ipcMain.handle('get-deleted-items', () => {
    const customers = database.prepare(`
      SELECT id, name, phone, shop_number, deletedAt, 'customer' AS type
      FROM customers WHERE isDeleted = 1 ORDER BY deletedAt DESC
    `).all();
    const transactions = database.prepare(`
      SELECT t.id, t.customer_id, t.type AS txType, t.amount, t.description, t.date, t.deletedAt,
        c.name AS customer_name, c.phone AS customer_phone, c.shop_number, 'transaction' AS type,
        (SELECT COALESCE(SUM(CASE WHEN t2.type = 'DEBIT' THEN t2.amount ELSE -t2.amount END), 0)
         FROM transactions t2 WHERE t2.customer_id = t.customer_id AND t2.isDeleted = 0
         AND (t2.date < t.date OR (t2.date = t.date AND t2.id <= t.id))) AS running_balance
      FROM transactions t JOIN customers c ON c.id = t.customer_id
      WHERE t.isDeleted = 1 ORDER BY t.deletedAt DESC
    `).all();
    return [...customers, ...transactions].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  });

  ipcMain.handle('get-deleted-count', () => {
    const c = database.prepare('SELECT COUNT(*) AS count FROM customers WHERE isDeleted = 1').get();
    const t = database.prepare('SELECT COUNT(*) AS count FROM transactions WHERE isDeleted = 1').get();
    return c.count + t.count;
  });

  ipcMain.handle('restore-item', (_event, { type, id }) => {
    if (type === 'customer') {
      database.prepare('UPDATE customers SET isDeleted = 0, deletedAt = NULL WHERE id = ?').run(id);
      database.prepare('UPDATE transactions SET isDeleted = 0, deletedAt = NULL WHERE customer_id = ? AND isDeleted = 1').run(id);
    } else {
      database.prepare('UPDATE transactions SET isDeleted = 0, deletedAt = NULL WHERE id = ?').run(id);
    }
    doAutoBackup();
    return true;
  });

  ipcMain.handle('permanent-delete', (_event, { type, id }) => {
    if (type === 'customer') {
      const customer = database.prepare('SELECT photo FROM customers WHERE id = ? AND isDeleted = 1').get(id);
      database.prepare('DELETE FROM transactions WHERE customer_id = ? AND isDeleted = 1').run(id);
      database.prepare('DELETE FROM customers WHERE id = ? AND isDeleted = 1').run(id);
      deletePhotoFile(customer?.photo);
    } else {
      database.prepare('DELETE FROM transactions WHERE id = ? AND isDeleted = 1').run(id);
    }
    doAutoBackup();
    return true;
  });

  ipcMain.handle('empty-recycle-bin', () => {
    const photos = database.prepare('SELECT photo FROM customers WHERE isDeleted = 1 AND photo IS NOT NULL').all();
    database.prepare('DELETE FROM transactions WHERE isDeleted = 1').run();
    database.prepare('DELETE FROM customers WHERE isDeleted = 1').run();
    photos.forEach((row) => deletePhotoFile(row.photo));
    doAutoBackup();
    return true;
  });

  ipcMain.handle('print-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('Unable to find the print window');
    return new Promise((resolve) => {
      window.webContents.print({ silent: false, printBackground: true, pageSize: 'A4' }, (success) => {
        resolve(success);
      });
    });
  });
}

/* ---------- Custom photo:// protocol (serves avatar files from disk) ---------- */

function registerPhotoProtocol() {
  protocol.handle('photo', async (request) => {
    try {
      const url = new URL(request.url);
      const filename = path.basename(url.hostname || url.pathname);
      const filePath = path.join(PHOTOS_DIR, filename);
      if (!fs.existsSync(filePath)) return new Response('Not Found', { status: 404 });
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filename).slice(1).toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
        : 'application/octet-stream';
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (_) {
      return new Response('Bad Request', { status: 400 });
    }
  });
}

/* ---------- Window ---------- */

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 650,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (!app.isPackaged) window.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

app.whenReady().then(() => {
  recoverFromBackup();
  initializeDatabase();
  registerIpcHandlers();
  registerPhotoProtocol();
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  authorizedMasterWindows.clear();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  performExitBackup();
  if (database) database.close();
});
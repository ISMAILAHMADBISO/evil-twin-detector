import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import express, {type NextFunction, type Request, type Response} from 'express';
import fs from 'fs';
import {execFile} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import os from 'os';
import path from 'path';
import {promisify} from 'util';
import {fileURLToPath} from 'url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_PROJECT_DIR = path.join(__dirname, 'evil_twin_detector');

function resolveWritableInstanceDir(): string {
  const preferred = path.join(PYTHON_PROJECT_DIR, 'instance');
  try {
    fs.mkdirSync(preferred, {recursive: true});
    const probe = path.join(preferred, '.write_test');
    fs.writeFileSync(probe, 'ok', 'utf-8');
    fs.unlinkSync(probe);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'eviltwin_detector_instance');
    fs.mkdirSync(fallback, {recursive: true});
    return fallback;
  }
}

const INSTANCE_DIR = resolveWritableInstanceDir();
const DB_PATH = path.join(INSTANCE_DIR, 'eviltwin_detector.db');
const SECRET_FILE = path.join(INSTANCE_DIR, '.node_session_secret');

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, 'utf-8');
  return generated;
}

const SESSION_SECRET = getSessionSecret();
const SESSION_COOKIE = 'etd_session';

let db = new DatabaseSync(DB_PATH);

function initDatabase(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Administrator',
      status TEXT NOT NULL DEFAULT 'Active',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS approved_access_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ssid TEXT NOT NULL,
      bssid TEXT UNIQUE NOT NULL,
      expected_security TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS scan_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'Running',
      networks_found INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wireless_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_session_id INTEGER NOT NULL,
      ssid TEXT NOT NULL,
      bssid TEXT NOT NULL,
      signal_strength INTEGER,
      channel INTEGER,
      security TEXT NOT NULL,
      frequency TEXT,
      classification TEXT NOT NULL,
      detection_reason TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS detection_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observation_id INTEGER NOT NULL,
      triggered_rule TEXT NOT NULL,
      classification TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (observation_id) REFERENCES wireless_observations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      detection_event_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (detection_event_id) REFERENCES detection_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluation_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ssid TEXT NOT NULL,
      bssid TEXT NOT NULL,
      expected_security TEXT NOT NULL DEFAULT 'WPA2',
      observed_security TEXT NOT NULL DEFAULT 'WPA2',
      expected_classification TEXT NOT NULL,
      actual_classification TEXT NOT NULL,
      detection_time_ms REAL NOT NULL DEFAULT 0,
      test_description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL
    );
  `);

  const defaults: Array<[string, string]> = [
    ['scan_interval_seconds', '30'],
    ['auto_scan_enabled', 'false'],
    ['alerts_enabled', 'true'],
    ['alert_on_unknown', 'false'],
    ['demo_mode', 'false'],
    ['preferred_interface', 'auto'],
  ];

  const insertSetting = database.prepare(
    'INSERT OR IGNORE INTO application_settings (setting_key, setting_value) VALUES (?, ?)'
  );
  for (const [k, v] of defaults) {
    insertSetting.run(k, v);
  }

  // Safely migrate existing users table if upgrading from older schema
  const userCols = database.prepare('PRAGMA table_info(users)').all() as Array<{name: string}>;
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has('full_name')) {
    database.exec("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  }
  if (!colNames.has('role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Administrator'");
  }
  if (!colNames.has('status')) {
    database.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'");
  }
  if (!colNames.has('last_login_at')) {
    database.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');
  }

  // Ensure student administrator Zainab Bashir Mainasara exists
  const zainabExists = database
    .prepare("SELECT id FROM users WHERE LOWER(username) = LOWER('Zainab Bashir Mainasara')")
    .get();
  if (!zainabExists) {
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO users (username, full_name, role, status, password_hash, created_at)
         VALUES (?, ?, ?, 'Active', ?, ?)`
      )
      .run(
        'Zainab Bashir Mainasara',
        'Zainab Bashir Mainasara',
        'Primary Administrator',
        hashPassword('Iamzainab@26'),
        now
      );
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

initDatabase(db);

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signToken(payload: {userId: number; username: string}): string {
  const data = Buffer.from(JSON.stringify({...payload, iat: Date.now()})).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string | undefined): {userId: number; username: string} | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (typeof parsed.userId === 'number' && typeof parsed.username === 'string') {
      return {userId: parsed.userId, username: parsed.username};
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeBssid(raw: string): string {
  const cleaned = (raw || '').replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length !== 12) return (raw || '').trim().toUpperCase();
  const parts: string[] = [];
  for (let i = 0; i < 12; i += 2) {
    parts.push(cleaned.slice(i, i + 2).toUpperCase());
  }
  return parts.join(':');
}

function normalizeSecurity(raw: string): string {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('WPA3')) return 'WPA3';
  if (upper.includes('WPA2')) return 'WPA2';
  if (upper.includes('WPA')) return 'WPA';
  if (upper.includes('WEP')) return 'WEP';
  if (upper.includes('OPEN') || upper.includes('NONE')) return 'Open';
  return (raw || 'Unknown').trim() || 'Unknown';
}

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

interface ApprovedAPRow {
  id: number;
  ssid: string;
  bssid: string;
  expected_security: string;
  description: string;
  created_at: string;
  status: string;
}

interface DetectionResult {
  ssid: string;
  bssid: string;
  signal_strength: number | null;
  channel: number | null;
  security: string;
  frequency: string | null;
  classification: 'AUTHORISED' | 'SUSPICIOUS' | 'UNKNOWN';
  triggered_rule: string;
  reason: string;
  supporting_indicators: string[];
  timestamp: string;
}

function evaluateAccessPoint(
  approvedRows: ApprovedAPRow[],
  obs: {
    ssid: string;
    bssid: string;
    security: string;
    signal_strength: number | null;
    channel: number | null;
    frequency: string | null;
    timestamp?: string;
  }
): DetectionResult {
  const activeAps = approvedRows.filter((ap) => (ap.status || 'Active').toLowerCase() === 'active');
  const byBssid = new Map<string, ApprovedAPRow>();
  const bySsid = new Map<string, ApprovedAPRow[]>();

  for (const ap of activeAps) {
    byBssid.set(normalizeBssid(ap.bssid), ap);
    const key = ap.ssid.trim().toLowerCase();
    const list = bySsid.get(key) || [];
    list.push(ap);
    bySsid.set(key, list);
  }

  const obsSsid = (obs.ssid || '').trim() || '<Hidden Network>';
  const obsBssid = normalizeBssid(obs.bssid);
  const obsSec = normalizeSecurity(obs.security);
  const ts = obs.timestamp || new Date().toISOString();

  const indicators: string[] = [];
  if (obs.signal_strength !== null && obs.signal_strength !== undefined) {
    if (obs.signal_strength >= -45) {
      indicators.push(
        `Strong RSSI (${obs.signal_strength} dBm) — nearby transmitter; verify physical AP placement.`
      );
    } else {
      indicators.push(`Observed signal strength: ${obs.signal_strength} dBm.`);
    }
  }
  if (obs.channel !== null && obs.channel !== undefined) {
    indicators.push(
      `Operating on Channel ${obs.channel}${obs.frequency ? ` (${obs.frequency})` : ''}.`
    );
  }

  const registered = byBssid.get(obsBssid);
  if (registered) {
    const expSec = normalizeSecurity(registered.expected_security);
    if (obsSec.toUpperCase() === expSec.toUpperCase()) {
      if (registered.ssid.trim().toLowerCase() !== obsSsid.toLowerCase()) {
        return {
          ssid: obsSsid,
          bssid: obsBssid,
          signal_strength: obs.signal_strength,
          channel: obs.channel,
          security: obsSec,
          frequency: obs.frequency,
          classification: 'SUSPICIOUS',
          triggered_rule: 'Rule 4: Unexpected Configuration',
          reason: `Registered BSSID ${obsBssid} is broadcasting SSID '${obsSsid}' instead of expected '${registered.ssid}'.`,
          supporting_indicators: indicators,
          timestamp: ts,
        };
      }
      return {
        ssid: obsSsid,
        bssid: obsBssid,
        signal_strength: obs.signal_strength,
        channel: obs.channel,
        security: obsSec,
        frequency: obs.frequency,
        classification: 'AUTHORISED',
        triggered_rule: 'Rule 1: Registered Access Point',
        reason: `BSSID ${obsBssid} and security (${obsSec}) match the approved profile for '${registered.ssid}'.`,
        supporting_indicators: indicators,
        timestamp: ts,
      };
    }
    return {
      ssid: obsSsid,
      bssid: obsBssid,
      signal_strength: obs.signal_strength,
      channel: obs.channel,
      security: obsSec,
      frequency: obs.frequency,
      classification: 'SUSPICIOUS',
      triggered_rule: 'Rule 4: Unexpected Security Configuration',
      reason: `Registered BSSID ${obsBssid} ('${registered.ssid}') advertised ${obsSec} instead of expected ${registered.expected_security}.`,
      supporting_indicators: indicators,
      timestamp: ts,
    };
  }

  const matchingSsid = bySsid.get(obsSsid.toLowerCase());
  if (matchingSsid && matchingSsid.length > 0) {
    const expectedBssids = matchingSsid.map((ap) => ap.bssid).join(', ');
    return {
      ssid: obsSsid,
      bssid: obsBssid,
      signal_strength: obs.signal_strength,
      channel: obs.channel,
      security: obsSec,
      frequency: obs.frequency,
      classification: 'SUSPICIOUS',
      triggered_rule: 'Rule 2: Same SSID, Different BSSID',
      reason: `Unregistered BSSID ${obsBssid} is advertising approved SSID '${obsSsid}'. Registered BSSID(s): ${expectedBssids}.`,
      supporting_indicators: indicators,
      timestamp: ts,
    };
  }

  return {
    ssid: obsSsid,
    bssid: obsBssid,
    signal_strength: obs.signal_strength,
    channel: obs.channel,
    security: obsSec,
    frequency: obs.frequency,
    classification: 'UNKNOWN',
    triggered_rule: 'Rule 3: Unknown Access Point',
    reason: `Access point '${obsSsid}' (${obsBssid}) is not present in the approved database and does not impersonate any registered SSID.`,
    supporting_indicators: indicators,
    timestamp: ts,
  };
}

function getAllSettings(): Record<string, string> {
  const rows = db
    .prepare('SELECT setting_key, setting_value FROM application_settings')
    .all() as Array<{setting_key: string; setting_value: string}>;
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.setting_key] = r.setting_value;
  }
  return result;
}

interface AuthedRequest extends Request {
  user?: {userId: number; username: string; full_name: string; role: string};
}

function extractRequestToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return req.cookies?.[SESSION_COOKIE];
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractRequestToken(req);
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({error: 'Authentication required.'});
    return;
  }
  const userExists = db
    .prepare('SELECT id, username, full_name, role, status FROM users WHERE id = ?')
    .get(verified.userId) as
    | {id: number; username: string; full_name: string; role: string; status: string}
    | undefined;
  if (!userExists || userExists.status !== 'Active') {
    res.status(401).json({error: 'Session invalid or administrator account disabled.'});
    return;
  }
  req.user = {
    userId: userExists.id,
    username: userExists.username,
    full_name: userExists.full_name || userExists.username,
    role: userExists.role || 'Administrator',
  };
  next();
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({limit: '10mb'}));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({status: 'ok', app: 'EvilTwin Detector'});
});

// Authentication routes
app.get('/api/auth/status', (req: AuthedRequest, res: Response) => {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as {cnt: number};
  const needsSetup = countRow.cnt === 0;
  const token = extractRequestToken(req);
  const verified = verifyToken(token);
  if (!verified) {
    res.json({needsSetup, authenticated: false, user: null});
    return;
  }
  const userRow = db
    .prepare(
      'SELECT id, username, full_name, role, status, created_at, last_login_at FROM users WHERE id = ?'
    )
    .get(verified.userId) as
    | {
        id: number;
        username: string;
        full_name: string;
        role: string;
        status: string;
        created_at: string;
        last_login_at: string | null;
      }
    | undefined;
  if (!userRow || userRow.status !== 'Active') {
    res.json({needsSetup, authenticated: false, user: null});
    return;
  }
  res.json({needsSetup, authenticated: true, user: userRow});
});

app.post('/api/auth/setup', (req: Request, res: Response) => {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as {cnt: number};
  if (countRow.cnt > 0) {
    res.status(403).json({error: 'Initial administrator account already exists.'});
    return;
  }
  const username = String(req.body?.username || '').trim();
  const fullName = String(req.body?.full_name || username).trim();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (username.length < 3) {
    res.status(400).json({error: 'Username must be at least 3 characters.'});
    return;
  }
  if (password.length < 8) {
    res.status(400).json({error: 'Administrator password must be at least 8 characters.'});
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({error: 'Passwords do not match.'});
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (username, full_name, role, status, password_hash, created_at, last_login_at)
       VALUES (?, ?, 'Primary Administrator', 'Active', ?, ?, ?)`
    )
    .run(username, fullName, passwordHash, now, now);

  const userId = Number(info.lastInsertRowid);
  const token = signToken({userId, username});
  setSessionCookie(req, res, token);
  res.status(201).json({
    token,
    user: {
      id: userId,
      username,
      full_name: fullName,
      role: 'Primary Administrator',
      status: 'Active',
      created_at: now,
      last_login_at: now,
    },
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  const userRow = db
    .prepare(
      `SELECT id, username, full_name, role, status, password_hash, created_at
       FROM users WHERE LOWER(username) = LOWER(?)`
    )
    .get(username) as
    | {
        id: number;
        username: string;
        full_name: string;
        role: string;
        status: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({error: 'Invalid administrator username or password.'});
    return;
  }
  if (userRow.status !== 'Active') {
    res.status(403).json({error: 'This administrator account is currently disabled.'});
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userRow.id);

  const token = signToken({userId: userRow.id, username: userRow.username});
  setSessionCookie(req, res, token);
  res.json({
    token,
    user: {
      id: userRow.id,
      username: userRow.username,
      full_name: userRow.full_name || userRow.username,
      role: userRow.role || 'Administrator',
      status: userRow.status,
      created_at: userRow.created_at,
      last_login_at: now,
    },
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
  res.json({ok: true});
});

// Administrator Management CRUD
app.get('/api/admins', requireAuth, (_req: AuthedRequest, res: Response) => {
  const admins = db
    .prepare(
      'SELECT id, username, full_name, role, status, created_at, last_login_at FROM users ORDER BY id ASC'
    )
    .all();
  res.json({admins});
});

app.post('/api/admins', requireAuth, (req: AuthedRequest, res: Response) => {
  const username = String(req.body?.username || '').trim();
  const fullName = String(req.body?.full_name || username).trim();
  const role = String(req.body?.role || 'Administrator').trim();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (username.length < 3) {
    res.status(400).json({error: 'Username must be at least 3 characters.'});
    return;
  }
  if (password.length < 8) {
    res.status(400).json({error: 'Password must be at least 8 characters.'});
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({error: 'Passwords do not match.'});
    return;
  }
  if (!['Primary Administrator', 'Administrator', 'Security Analyst'].includes(role)) {
    res.status(400).json({error: 'Invalid administrator role selected.'});
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
    .get(username);
  if (existing) {
    res.status(409).json({error: `Administrator username '${username}' already exists.`});
    return;
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (username, full_name, role, status, password_hash, created_at)
       VALUES (?, ?, ?, 'Active', ?, ?)`
    )
    .run(username, fullName, role, hashPassword(password), now);

  const created = db
    .prepare(
      'SELECT id, username, full_name, role, status, created_at, last_login_at FROM users WHERE id = ?'
    )
    .get(Number(info.lastInsertRowid));
  res.status(201).json({admin: created});
});

app.put('/api/admins/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const targetId = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, username, role, status FROM users WHERE id = ?')
    .get(targetId) as {id: number; username: string; role: string; status: string} | undefined;
  if (!existing) {
    res.status(404).json({error: 'Administrator account not found.'});
    return;
  }

  const fullName = String(req.body?.full_name || existing.username).trim();
  const role = String(req.body?.role || existing.role).trim();
  const status = String(req.body?.status || existing.status).trim();
  const newPassword = String(req.body?.password || '');

  if (!['Primary Administrator', 'Administrator', 'Security Analyst'].includes(role)) {
    res.status(400).json({error: 'Invalid administrator role.'});
    return;
  }
  if (status !== 'Active' && status !== 'Disabled') {
    res.status(400).json({error: "Status must be 'Active' or 'Disabled'."});
    return;
  }
  if (req.user?.userId === targetId && status === 'Disabled') {
    res.status(400).json({error: 'You cannot disable your own currently signed-in account.'});
    return;
  }
  if (status === 'Disabled') {
    const activeCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE status = 'Active' AND id != ?").get(targetId) as {
        cnt: number;
      }
    ).cnt;
    if (activeCount === 0) {
      res.status(400).json({error: 'At least one active administrator account is required.'});
      return;
    }
  }

  if (newPassword) {
    if (newPassword.length < 8) {
      res.status(400).json({error: 'New password must be at least 8 characters.'});
      return;
    }
    db.prepare(
      'UPDATE users SET full_name = ?, role = ?, status = ?, password_hash = ? WHERE id = ?'
    ).run(fullName, role, status, hashPassword(newPassword), targetId);
  } else {
    db.prepare('UPDATE users SET full_name = ?, role = ?, status = ? WHERE id = ?').run(
      fullName,
      role,
      status,
      targetId
    );
  }

  const updated = db
    .prepare(
      'SELECT id, username, full_name, role, status, created_at, last_login_at FROM users WHERE id = ?'
    )
    .get(targetId);
  res.json({admin: updated});
});

app.delete('/api/admins/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const targetId = Number(req.params.id);
  if (req.user?.userId === targetId) {
    res.status(400).json({error: 'You cannot delete your own currently signed-in account.'});
    return;
  }
  const activeCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM users WHERE status = 'Active' AND id != ?").get(targetId) as {
      cnt: number;
    }
  ).cnt;
  if (activeCount === 0) {
    res.status(400).json({error: 'Cannot remove the last active administrator account.'});
    return;
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  if (info.changes === 0) {
    res.status(404).json({error: 'Administrator account not found.'});
    return;
  }
  res.json({deleted: true, id: targetId});
});

// Scanner hardware capability detection
app.get('/api/scanner/capabilities', requireAuth, async (_req: AuthedRequest, res: Response) => {
  const platformName = process.platform;
  let hasLiveAdapter = false;
  let detail = '';

  if (platformName === 'win32') {
    try {
      const {stdout} = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'], {timeout: 5000});
      if (stdout.toLowerCase().includes('there is no wireless interface')) {
        detail = 'No wireless adapter detected via Windows netsh.';
      } else {
        hasLiveAdapter = true;
        detail = 'Windows WLAN adapter detected via netsh.';
      }
    } catch {
      detail = 'Windows WLAN interface unavailable.';
    }
  } else if (platformName === 'linux') {
    try {
      await execFileAsync('which', ['nmcli'], {timeout: 3000});
      const {stdout} = await execFileAsync('nmcli', ['-t', '-f', 'TYPE,STATE', 'dev'], {timeout: 5000});
      hasLiveAdapter = stdout.toLowerCase().includes('wifi');
      detail = hasLiveAdapter
        ? 'Linux Wi-Fi adapter detected via nmcli.'
        : 'nmcli is present, but no physical Wi-Fi hardware interface was detected.';
    } catch {
      detail =
        'Cloud / virtualized Linux environment without physical Wi-Fi hardware (nmcli/wlan0 unavailable). Use Demo Mode here, or run locally on Windows 10/11 or Linux with a Wi-Fi adapter.';
    }
  } else {
    detail = `Live hardware Wi-Fi scanning is not configured for ${platformName}.`;
  }

  res.json({
    platform: platformName,
    has_live_adapter: hasLiveAdapter,
    detail,
  });
});

// Dashboard summary
app.get('/api/dashboard/summary', requireAuth, (_req: AuthedRequest, res: Response) => {
  const totalDiscovered = (
    db.prepare('SELECT COUNT(*) as cnt FROM wireless_observations').get() as {cnt: number}
  ).cnt;
  const authorised = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM wireless_observations WHERE classification = 'AUTHORISED'")
      .get() as {cnt: number}
  ).cnt;
  const suspicious = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM wireless_observations WHERE classification = 'SUSPICIOUS'")
      .get() as {cnt: number}
  ).cnt;
  const unknown = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM wireless_observations WHERE classification = 'UNKNOWN'")
      .get() as {cnt: number}
  ).cnt;
  const totalAlerts = (
    db.prepare('SELECT COUNT(*) as cnt FROM security_alerts').get() as {cnt: number}
  ).cnt;
  const openAlerts = (
    db.prepare("SELECT COUNT(*) as cnt FROM security_alerts WHERE status = 'Open'").get() as {
      cnt: number;
    }
  ).cnt;
  const approvedCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM approved_access_points WHERE status = 'Active'").get() as {
      cnt: number;
    }
  ).cnt;

  const latestSession = db
    .prepare('SELECT * FROM scan_sessions ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;

  const recentObservations = db
    .prepare(
      `SELECT o.*, e.triggered_rule
       FROM wireless_observations o
       LEFT JOIN detection_events e ON e.observation_id = o.id
       ORDER BY o.id DESC LIMIT 10`
    )
    .all();

  const recentAlerts = db
    .prepare(
      `SELECT a.*, e.triggered_rule, e.reason as detection_reason, o.ssid, o.bssid
       FROM security_alerts a
       JOIN detection_events e ON e.id = a.detection_event_id
       JOIN wireless_observations o ON o.id = e.observation_id
       ORDER BY a.id DESC LIMIT 6`
    )
    .all();

  const recentSessions = db
    .prepare('SELECT * FROM scan_sessions ORDER BY id DESC LIMIT 8')
    .all();

  const sessionsChron = db
    .prepare('SELECT * FROM scan_sessions ORDER BY id ASC LIMIT 12')
    .all() as Array<{id: number; started_at: string}>;

  const timelineLabels: string[] = [];
  const timelineAuth: number[] = [];
  const timelineSusp: number[] = [];
  const timelineUnk: number[] = [];

  const countBySessionStmt = db.prepare(
    'SELECT classification, COUNT(*) as cnt FROM wireless_observations WHERE scan_session_id = ? GROUP BY classification'
  );

  for (const s of sessionsChron) {
    const dt = new Date(s.started_at);
    timelineLabels.push(
      Number.isNaN(dt.getTime()) ? `Scan #${s.id}` : dt.toISOString().slice(11, 19)
    );
    const counts = countBySessionStmt.all(s.id) as Array<{classification: string; cnt: number}>;
    const map: Record<string, number> = {};
    for (const c of counts) map[c.classification] = c.cnt;
    timelineAuth.push(map.AUTHORISED || 0);
    timelineSusp.push(map.SUSPICIOUS || 0);
    timelineUnk.push(map.UNKNOWN || 0);
  }

  const alertRows = db
    .prepare('SELECT created_at FROM security_alerts ORDER BY id ASC')
    .all() as Array<{created_at: string}>;
  const alertDateBuckets = new Map<string, number>();
  for (const row of alertRows) {
    const day = (row.created_at || '').slice(0, 10) || 'Unknown';
    alertDateBuckets.set(day, (alertDateBuckets.get(day) || 0) + 1);
  }

  const settings = getAllSettings();
  res.json({
    summary: {
      total_discovered: totalDiscovered,
      authorised,
      suspicious,
      unknown,
      total_alerts: totalAlerts,
      open_alerts: openAlerts,
      approved_count: approvedCount,
    },
    scanner_status: {
      demo_mode: settings.demo_mode === 'true',
      auto_scan_enabled: settings.auto_scan_enabled === 'true',
      scan_interval_seconds: Number(settings.scan_interval_seconds || '30'),
      host_platform: process.platform,
      last_scan: latestSession || null,
    },
    charts: {
      distribution: {
        Authorised: authorised,
        Suspicious: suspicious,
        Unknown: unknown,
      },
      timeline: {
        labels: timelineLabels,
        authorised: timelineAuth,
        suspicious: timelineSusp,
        unknown: timelineUnk,
      },
      alert_trends: {
        labels: Array.from(alertDateBuckets.keys()),
        counts: Array.from(alertDateBuckets.values()),
      },
    },
    recent_observations: recentObservations,
    recent_alerts: recentAlerts,
    recent_sessions: recentSessions,
  });
});

// Live wireless scanner execution via Python WifiScanner module
app.post('/api/scan', requireAuth, async (req: AuthedRequest, res: Response) => {
  const settings = getAllSettings();
  const demoMode =
    typeof req.body?.demo_mode === 'boolean'
      ? req.body.demo_mode
      : settings.demo_mode === 'true';
  const alertsEnabled = settings.alerts_enabled !== 'false';
  const startedAt = new Date().toISOString();

  const sessionInsert = db
    .prepare(
      "INSERT INTO scan_sessions (started_at, status, networks_found, is_demo) VALUES (?, 'Running', 0, ?)"
    )
    .run(startedAt, demoMode ? 1 : 0);
  const scanSessionId = Number(sessionInsert.lastInsertRowid);

  const args = ['-m', 'scanner.wifi_scanner'];
  if (demoMode) {
    args.push('--demo');
  }

  let scanPayload: {
    networks?: Array<{
      ssid: string;
      bssid: string;
      signal_strength: number | null;
      channel: number | null;
      security: string;
      frequency: string | null;
      timestamp?: string;
    }>;
    platform_name?: string;
    is_demo?: boolean;
    error?: string;
  };

  try {
    const {stdout} = await execFileAsync('python3', args, {
      cwd: PYTHON_PROJECT_DIR,
      timeout: 20000,
    });
    scanPayload = JSON.parse(stdout);
  } catch (err: unknown) {
    if (demoMode) {
      const ts = new Date().toISOString();
      scanPayload = {
        platform_name: `${process.platform} (Demo Mode)`,
        is_demo: true,
        networks: [
          {
            ssid: 'CCUK_Campus_WiFi',
            bssid: 'A4:2B:8C:10:44:01',
            signal_strength: -48,
            channel: 6,
            security: 'WPA2',
            frequency: '2.4 GHz',
            timestamp: ts,
          },
          {
            ssid: 'CCUK_Campus_WiFi',
            bssid: 'DE:AD:BE:EF:11:99',
            signal_strength: -39,
            channel: 11,
            security: 'Open',
            frequency: '2.4 GHz',
            timestamp: ts,
          },
          {
            ssid: 'CCUK_Staff_Secure',
            bssid: 'B8:27:EB:45:12:0A',
            signal_strength: -54,
            channel: 36,
            security: 'WPA3',
            frequency: '5 GHz',
            timestamp: ts,
          },
          {
            ssid: 'Neighbor_Fiber_5G',
            bssid: 'C0:56:27:9A:33:E2',
            signal_strength: -72,
            channel: 149,
            security: 'WPA2',
            frequency: '5 GHz',
            timestamp: ts,
          },
          {
            ssid: 'Library_Guest_AP',
            bssid: '00:1A:2B:3C:4D:5E',
            signal_strength: -63,
            channel: 1,
            security: 'WPA2',
            frequency: '2.4 GHz',
            timestamp: ts,
          },
        ],
      };
    } else {
      let errorMsg = 'Unable to scan wireless networks from the host adapter.';
      const execErr = err as {stdout?: string; stderr?: string; message?: string};
      if (execErr.stdout) {
        try {
          const parsed = JSON.parse(execErr.stdout);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          errorMsg = execErr.stdout.trim() || errorMsg;
        }
      } else if (execErr.stderr) {
        errorMsg = execErr.stderr.trim();
      } else if (execErr.message) {
        errorMsg = execErr.message;
      }

      const completedAt = new Date().toISOString();
      db.prepare(
        "UPDATE scan_sessions SET status = 'Failed', completed_at = ?, error_message = ? WHERE id = ?"
      ).run(completedAt, errorMsg, scanSessionId);

      const failedSession = db
        .prepare('SELECT * FROM scan_sessions WHERE id = ?')
        .get(scanSessionId);
      res.status(422).json({
        ok: false,
        error: errorMsg,
        scan_session: failedSession,
        observations: [],
      });
      return;
    }
  }

  const networks = scanPayload.networks || [];
  const approvedRows = db
    .prepare('SELECT * FROM approved_access_points')
    .all() as unknown as ApprovedAPRow[];

  const insertObs = db.prepare(`
    INSERT INTO wireless_observations (
      scan_session_id, ssid, bssid, signal_strength, channel,
      security, frequency, classification, detection_reason, is_demo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO detection_events (
      observation_id, triggered_rule, classification, reason, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertAlert = db.prepare(`
    INSERT INTO security_alerts (
      detection_event_id, title, severity, status, created_at
    ) VALUES (?, ?, ?, 'Open', ?)
  `);

  const savedObservations: Array<Record<string, unknown>> = [];
  let alertsCreated = 0;

  db.exec('BEGIN');
  try {
    for (const net of networks) {
      const decision = evaluateAccessPoint(approvedRows, net);
      const nowIso = new Date().toISOString();
      const obsInfo = insertObs.run(
        scanSessionId,
        decision.ssid,
        decision.bssid,
        decision.signal_strength,
        decision.channel,
        decision.security,
        decision.frequency,
        decision.classification,
        decision.reason,
        demoMode ? 1 : 0,
        nowIso
      );
      const obsId = Number(obsInfo.lastInsertRowid);

      const evtInfo = insertEvent.run(
        obsId,
        decision.triggered_rule,
        decision.classification,
        decision.reason,
        nowIso
      );
      const evtId = Number(evtInfo.lastInsertRowid);

      if (alertsEnabled && decision.classification === 'SUSPICIOUS') {
        const severity =
          decision.triggered_rule.includes('Rule 2') || decision.triggered_rule.includes('Rule 4')
            ? 'High'
            : 'Medium';
        const title = `Suspicious Access Point Detected: ${decision.ssid} (${decision.bssid})`;
        insertAlert.run(evtId, title, severity, nowIso);
        alertsCreated += 1;
      }

      savedObservations.push({
        id: obsId,
        scan_session_id: scanSessionId,
        ...decision,
        is_demo: demoMode ? 1 : 0,
        created_at: nowIso,
      });
    }

    const completedAt = new Date().toISOString();
    db.prepare(
      "UPDATE scan_sessions SET status = 'Completed', completed_at = ?, networks_found = ? WHERE id = ?"
    ).run(completedAt, savedObservations.length, scanSessionId);

    db.exec('COMMIT');
  } catch (txErr) {
    db.exec('ROLLBACK');
    throw txErr;
  }

  const completedSession = db
    .prepare('SELECT * FROM scan_sessions WHERE id = ?')
    .get(scanSessionId);

  res.json({
    ok: true,
    scan_session: completedSession,
    observations: savedObservations,
    alerts_created: alertsCreated,
    platform: scanPayload.platform_name || process.platform,
    is_demo: demoMode,
  });
});

// Latest scan & detected networks
app.get('/api/networks', requireAuth, (_req: AuthedRequest, res: Response) => {
  const latestSession = db
    .prepare("SELECT * FROM scan_sessions WHERE status = 'Completed' ORDER BY id DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;
  const lastAnySession = db
    .prepare('SELECT * FROM scan_sessions ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;

  if (!latestSession) {
    res.json({latest_session: lastAnySession || null, observations: []});
    return;
  }

  const observations = db
    .prepare(
      `SELECT o.*, e.triggered_rule
       FROM wireless_observations o
       LEFT JOIN detection_events e ON e.observation_id = o.id
       WHERE o.scan_session_id = ?
       ORDER BY o.classification ASC, o.id ASC`
    )
    .all(latestSession.id as number);

  res.json({
    latest_session: latestSession,
    last_any_session: lastAnySession || latestSession,
    observations,
  });
});

// Approved Access Points CRUD
app.get('/api/access-points', requireAuth, (req: AuthedRequest, res: Response) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || '').trim();

  let rows = db
    .prepare('SELECT * FROM approved_access_points ORDER BY id DESC')
    .all() as unknown as ApprovedAPRow[];

  if (statusFilter === 'Active' || statusFilter === 'Inactive') {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  if (search) {
    rows = rows.filter(
      (r) =>
        r.ssid.toLowerCase().includes(search) ||
        r.bssid.toLowerCase().includes(search) ||
        r.description.toLowerCase().includes(search)
    );
  }
  res.json({access_points: rows});
});

app.post('/api/access-points', requireAuth, (req: AuthedRequest, res: Response) => {
  const ssid = String(req.body?.ssid || '').trim();
  const rawBssid = String(req.body?.bssid || '').trim();
  const expectedSecurity = String(req.body?.expected_security || '').trim();
  const description = String(req.body?.description || '').trim();
  const status = String(req.body?.status || 'Active').trim();

  if (!ssid) {
    res.status(400).json({error: 'SSID is required.'});
    return;
  }
  if (!MAC_REGEX.test(rawBssid)) {
    res.status(400).json({error: 'BSSID must be a valid MAC address (e.g., AA:BB:CC:DD:EE:FF).'});
    return;
  }
  if (!expectedSecurity) {
    res.status(400).json({error: 'Expected security configuration is required.'});
    return;
  }
  if (status !== 'Active' && status !== 'Inactive') {
    res.status(400).json({error: "Status must be 'Active' or 'Inactive'."});
    return;
  }

  const normBssid = normalizeBssid(rawBssid);
  const existing = db
    .prepare('SELECT ssid FROM approved_access_points WHERE bssid = ?')
    .get(normBssid) as {ssid: string} | undefined;
  if (existing) {
    res.status(409).json({
      error: `BSSID ${normBssid} is already registered under SSID '${existing.ssid}'.`,
    });
    return;
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO approved_access_points (ssid, bssid, expected_security, description, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ssid, normBssid, expectedSecurity, description, now, status);

  const created = db
    .prepare('SELECT * FROM approved_access_points WHERE id = ?')
    .get(Number(info.lastInsertRowid));
  res.status(201).json({access_point: created});
});

app.put('/api/access-points/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const existingRow = db
    .prepare('SELECT * FROM approved_access_points WHERE id = ?')
    .get(id) as ApprovedAPRow | undefined;
  if (!existingRow) {
    res.status(404).json({error: 'Approved access point not found.'});
    return;
  }

  const ssid = String(req.body?.ssid || '').trim();
  const rawBssid = String(req.body?.bssid || '').trim();
  const expectedSecurity = String(req.body?.expected_security || '').trim();
  const description = String(req.body?.description || '').trim();
  const status = String(req.body?.status || 'Active').trim();

  if (!ssid || !MAC_REGEX.test(rawBssid) || !expectedSecurity) {
    res.status(400).json({error: 'Valid SSID, BSSID MAC address, and expected security are required.'});
    return;
  }
  if (status !== 'Active' && status !== 'Inactive') {
    res.status(400).json({error: "Status must be 'Active' or 'Inactive'."});
    return;
  }

  const normBssid = normalizeBssid(rawBssid);
  const duplicate = db
    .prepare('SELECT id FROM approved_access_points WHERE bssid = ? AND id != ?')
    .get(normBssid, id);
  if (duplicate) {
    res.status(409).json({error: `Another record already uses BSSID ${normBssid}.`});
    return;
  }

  db.prepare(
    `UPDATE approved_access_points
     SET ssid = ?, bssid = ?, expected_security = ?, description = ?, status = ?
     WHERE id = ?`
  ).run(ssid, normBssid, expectedSecurity, description, status, id);

  const updated = db.prepare('SELECT * FROM approved_access_points WHERE id = ?').get(id);
  res.json({access_point: updated});
});

app.delete('/api/access-points/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM approved_access_points WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({error: 'Access point not found.'});
    return;
  }
  res.json({deleted: true, id});
});

// Security Alerts
app.get('/api/alerts', requireAuth, (req: AuthedRequest, res: Response) => {
  const severity = String(req.query.severity || '').trim();
  const status = String(req.query.status || '').trim();

  let rows = db
    .prepare(
      `SELECT a.*, e.triggered_rule, e.reason as detection_reason, o.ssid, o.bssid, o.signal_strength, o.channel, o.security
       FROM security_alerts a
       JOIN detection_events e ON e.id = a.detection_event_id
       JOIN wireless_observations o ON o.id = e.observation_id
       ORDER BY a.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  if (severity) rows = rows.filter((r) => r.severity === severity);
  if (status) rows = rows.filter((r) => r.status === status);
  res.json({alerts: rows});
});

app.post('/api/alerts/:id/review', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();
  const info = db
    .prepare("UPDATE security_alerts SET status = 'Reviewed', reviewed_at = ? WHERE id = ?")
    .run(now, id);
  if (info.changes === 0) {
    res.status(404).json({error: 'Alert not found.'});
    return;
  }
  const updated = db.prepare('SELECT * FROM security_alerts WHERE id = ?').get(id);
  res.json({alert: updated});
});

app.post('/api/alerts/:id/resolve', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT reviewed_at FROM security_alerts WHERE id = ?')
    .get(id) as {reviewed_at: string | null} | undefined;
  if (!existing) {
    res.status(404).json({error: 'Alert not found.'});
    return;
  }
  db.prepare("UPDATE security_alerts SET status = 'Resolved', reviewed_at = ? WHERE id = ?").run(
    existing.reviewed_at || now,
    id
  );
  const updated = db.prepare('SELECT * FROM security_alerts WHERE id = ?').get(id);
  res.json({alert: updated});
});

// Detection History
app.get('/api/history', requireAuth, (req: AuthedRequest, res: Response) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const classification = String(req.query.classification || '').trim().toUpperCase();
  const startDate = String(req.query.start_date || '').trim();
  const endDate = String(req.query.end_date || '').trim();

  let rows = db
    .prepare(
      `SELECT o.*, e.triggered_rule
       FROM wireless_observations o
       LEFT JOIN detection_events e ON e.observation_id = o.id
       ORDER BY o.id DESC
       LIMIT 500`
    )
    .all() as Array<Record<string, unknown>>;

  if (
    classification === 'AUTHORISED' ||
    classification === 'SUSPICIOUS' ||
    classification === 'UNKNOWN'
  ) {
    rows = rows.filter((r) => r.classification === classification);
  }
  if (startDate) {
    rows = rows.filter((r) => String(r.created_at || '') >= startDate);
  }
  if (endDate) {
    rows = rows.filter((r) => String(r.created_at || '') <= `${endDate}T23:59:59.999Z`);
  }
  if (search) {
    rows = rows.filter(
      (r) =>
        String(r.ssid || '').toLowerCase().includes(search) ||
        String(r.bssid || '').toLowerCase().includes(search) ||
        String(r.detection_reason || '').toLowerCase().includes(search)
    );
  }

  res.json({observations: rows});
});

// Performance Evaluation & Analytics
function computeMetrics(cases: Array<Record<string, unknown>>) {
  if (cases.length === 0) {
    return {
      has_data: false,
      total_cases: 0,
      tp: 0,
      fp: 0,
      tn: 0,
      fn: 0,
      precision: null,
      detection_rate: null,
      false_positive_rate: null,
      avg_detection_time_ms: null,
    };
  }
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let totalTime = 0;

  for (const c of cases) {
    const gt = String(c.expected_classification || '').trim();
    const actual = String(c.actual_classification || '').trim().toUpperCase();
    totalTime += Number(c.detection_time_ms || 0);
    const isThreat = gt === 'Simulated Evil Twin';
    const isPredictedThreat = actual === 'SUSPICIOUS';

    if (isThreat && isPredictedThreat) tp += 1;
    else if (isThreat && !isPredictedThreat) fn += 1;
    else if (!isThreat && isPredictedThreat) fp += 1;
    else tn += 1;
  }

  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : null;
  const detectionRate = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : null;
  const fpr = fp + tn > 0 ? Number((fp / (fp + tn)).toFixed(4)) : null;

  return {
    has_data: true,
    total_cases: cases.length,
    tp,
    fp,
    tn,
    fn,
    precision,
    detection_rate: detectionRate,
    false_positive_rate: fpr,
    avg_detection_time_ms: Number((totalTime / cases.length).toFixed(4)),
  };
}

app.get('/api/evaluation', requireAuth, (_req: AuthedRequest, res: Response) => {
  const cases = db
    .prepare('SELECT * FROM evaluation_cases ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;
  res.json({cases, metrics: computeMetrics(cases)});
});

app.post('/api/evaluation/cases', requireAuth, (req: AuthedRequest, res: Response) => {
  const ssid = String(req.body?.ssid || '').trim();
  const rawBssid = String(req.body?.bssid || '').trim();
  const observedSecurity = String(req.body?.observed_security || 'WPA2').trim();
  const expectedSecurity = String(req.body?.expected_security || observedSecurity).trim();
  const expectedClassification = String(req.body?.expected_classification || '').trim();
  const testDescription = String(req.body?.test_description || '').trim();

  if (!ssid || !MAC_REGEX.test(rawBssid)) {
    res.status(400).json({error: 'Valid SSID and MAC BSSID are required.'});
    return;
  }
  if (
    expectedClassification !== 'Legitimate' &&
    expectedClassification !== 'Unknown' &&
    expectedClassification !== 'Simulated Evil Twin'
  ) {
    res.status(400).json({
      error: "Ground-truth category must be 'Legitimate', 'Unknown', or 'Simulated Evil Twin'.",
    });
    return;
  }

  const approvedRows = db
    .prepare('SELECT * FROM approved_access_points')
    .all() as unknown as ApprovedAPRow[];

  const startNs = process.hrtime.bigint();
  const decision = evaluateAccessPoint(approvedRows, {
    ssid,
    bssid: normalizeBssid(rawBssid),
    security: observedSecurity,
    signal_strength: null,
    channel: null,
    frequency: null,
  });
  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO evaluation_cases (
        ssid, bssid, expected_security, observed_security,
        expected_classification, actual_classification, detection_time_ms,
        test_description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ssid,
      decision.bssid,
      expectedSecurity,
      decision.security,
      expectedClassification,
      decision.classification,
      Number(elapsedMs.toFixed(4)),
      testDescription || decision.reason,
      now
    );

  const created = db
    .prepare('SELECT * FROM evaluation_cases WHERE id = ?')
    .get(Number(info.lastInsertRowid));
  const allCases = db
    .prepare('SELECT * FROM evaluation_cases ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;

  res.status(201).json({case: created, metrics: computeMetrics(allCases)});
});

app.delete('/api/evaluation/cases/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM evaluation_cases WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({error: 'Evaluation case not found.'});
    return;
  }
  const allCases = db
    .prepare('SELECT * FROM evaluation_cases ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;
  res.json({deleted: true, metrics: computeMetrics(allCases)});
});

// Settings, Backup & Restore
app.get('/api/settings', requireAuth, (_req: AuthedRequest, res: Response) => {
  res.json({
    settings: getAllSettings(),
    host_platform: process.platform,
    database_path: 'instance/eviltwin_detector.db',
  });
});

app.post('/api/settings', requireAuth, (req: AuthedRequest, res: Response) => {
  const allowed = new Set([
    'scan_interval_seconds',
    'auto_scan_enabled',
    'alerts_enabled',
    'alert_on_unknown',
    'demo_mode',
    'preferred_interface',
  ]);
  const upsert = db.prepare(
    'INSERT INTO application_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value'
  );
  const body = req.body || {};
  for (const [key, val] of Object.entries(body)) {
    if (!allowed.has(key)) continue;
    let strVal = String(val).trim();
    if (key === 'scan_interval_seconds') {
      const parsed = Number.parseInt(strVal, 10);
      if (Number.isNaN(parsed) || parsed < 5 || parsed > 3600) {
        res.status(400).json({error: 'Scan interval must be between 5 and 3600 seconds.'});
        return;
      }
      strVal = String(parsed);
    }
    upsert.run(key, strVal);
  }
  res.json({settings: getAllSettings()});
});

app.get('/api/settings/backup', requireAuth, (_req: AuthedRequest, res: Response) => {
  if (!fs.existsSync(DB_PATH)) {
    res.status(404).json({error: 'Database file not found.'});
    return;
  }
  res.download(DB_PATH, 'eviltwin_detector_backup.db');
});

app.post('/api/settings/restore', requireAuth, (req: AuthedRequest, res: Response) => {
  const base64Data = String(req.body?.data || '');
  if (!base64Data) {
    res.status(400).json({error: 'No backup payload provided.'});
    return;
  }
  const buf = Buffer.from(base64Data, 'base64');
  const magic = buf.subarray(0, 16).toString('utf-8');
  if (!magic.startsWith('SQLite format 3')) {
    res.status(400).json({error: 'Uploaded file is not a valid SQLite 3 database.'});
    return;
  }

  db.close();
  fs.writeFileSync(DB_PATH, buf);
  db = new DatabaseSync(DB_PATH);
  initDatabase(db);
  res.json({restored: true});
});

// Vite dev middleware or static production serving
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EvilTwin Detector server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

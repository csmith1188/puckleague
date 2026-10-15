const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'adventure.db');
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

let ready = null;

function init() {
    if (ready) return ready;
    ready = (async () => {
        await run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            displayName TEXT NOT NULL,
            pin TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);
        await run(`CREATE TABLE IF NOT EXISTS players (
            userId INTEGER PRIMARY KEY,
            currentZone TEXT NOT NULL,
            travelUntil INTEGER NOT NULL DEFAULT 0,
            badges TEXT NOT NULL DEFAULT '[]',
            joinedAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);
        await run(`CREATE TABLE IF NOT EXISTS inventory (
            userId INTEGER NOT NULL,
            itemName TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (userId, itemName),
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);
        await run(`CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            itemName TEXT NOT NULL,
            direction TEXT NOT NULL CHECK (direction IN ('deposit', 'withdraw')),
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
            notes TEXT DEFAULT '',
            createdAt TEXT DEFAULT (datetime('now')),
            closedAt TEXT,
            closedBy INTEGER,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);
        return true;
    })();
    return ready;
}

async function upsertUser(id, displayName) {
    await init();
    const existing = await get('SELECT id FROM users WHERE id = ?', [id]);
    if (existing) {
        await run('UPDATE users SET displayName = ? WHERE id = ?', [displayName, id]);
    } else {
        await run('INSERT INTO users (id, displayName) VALUES (?, ?)', [id, displayName]);
    }
}

async function getPlayer(userId) {
    await init();
    return get('SELECT * FROM players WHERE userId = ?', [userId]);
}

async function createPlayer(userId, currentZone) {
    await init();
    await run(
        'INSERT INTO players (userId, currentZone, travelUntil) VALUES (?, ?, 0)',
        [userId, currentZone]
    );
    return getPlayer(userId);
}

async function setPlayerZone(userId, zone, travelUntil) {
    await init();
    await run(
        'UPDATE players SET currentZone = ?, travelUntil = ? WHERE userId = ?',
        [zone, travelUntil || 0, userId]
    );
    return getPlayer(userId);
}

async function getInventory(userId) {
    await init();
    return all(
        'SELECT itemName, qty FROM inventory WHERE userId = ? AND qty > 0 ORDER BY itemName',
        [userId]
    );
}

async function getItemQty(userId, itemName) {
    await init();
    const row = await get(
        'SELECT qty FROM inventory WHERE userId = ? AND itemName = ?',
        [userId, itemName]
    );
    return row ? row.qty : 0;
}

async function addInventory(userId, itemName, delta) {
    await init();
    const current = await getItemQty(userId, itemName);
    const next = current + delta;
    if (next < 0) {
        throw new Error(`Not enough ${itemName} in inventory`);
    }
    if (current === 0 && delta > 0) {
        await run(
            'INSERT INTO inventory (userId, itemName, qty) VALUES (?, ?, ?)',
            [userId, itemName, next]
        );
    } else if (next === 0) {
        await run(
            'DELETE FROM inventory WHERE userId = ? AND itemName = ?',
            [userId, itemName]
        );
    } else {
        await run(
            'UPDATE inventory SET qty = ? WHERE userId = ? AND itemName = ?',
            [next, userId, itemName]
        );
    }
    return next;
}

async function createTransfer(userId, itemName, direction, notes = '') {
    await init();
    const result = await run(
        `INSERT INTO transfers (userId, itemName, direction, status, notes)
         VALUES (?, ?, ?, 'open', ?)`,
        [userId, itemName, direction, notes]
    );
    return get('SELECT * FROM transfers WHERE id = ?', [result.lastID]);
}

async function getOpenTransfers() {
    await init();
    return all(
        `SELECT t.*, u.displayName
         FROM transfers t
         JOIN users u ON u.id = t.userId
         WHERE t.status = 'open'
         ORDER BY t.createdAt ASC`
    );
}

async function getUserTransfers(userId) {
    await init();
    return all(
        `SELECT * FROM transfers WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
        [userId]
    );
}

async function getTransfer(id) {
    await init();
    return get('SELECT * FROM transfers WHERE id = ?', [id]);
}

async function closeTransfer(id, closedBy) {
    await init();
    const transfer = await getTransfer(id);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'open') throw new Error('Transfer is not open');

    if (transfer.direction === 'withdraw') {
        await addInventory(transfer.userId, transfer.itemName, -1);
    } else if (transfer.direction === 'deposit') {
        await addInventory(transfer.userId, transfer.itemName, 1);
    }

    await run(
        `UPDATE transfers SET status = 'closed', closedAt = datetime('now'), closedBy = ?
         WHERE id = ?`,
        [closedBy, id]
    );
    return getTransfer(id);
}

async function cancelTransfer(id, userId) {
    await init();
    const transfer = await getTransfer(id);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.userId !== userId) throw new Error('Not your transfer');
    if (transfer.status !== 'open') throw new Error('Transfer is not open');
    await run(
        `UPDATE transfers SET status = 'cancelled', closedAt = datetime('now') WHERE id = ?`,
        [id]
    );
    return getTransfer(id);
}

async function listPlayers() {
    await init();
    return all(
        `SELECT p.*, u.displayName
         FROM players p
         JOIN users u ON u.id = p.userId
         ORDER BY u.displayName`
    );
}

async function savePin(userId, pin) {
    await init();
    await run('UPDATE users SET pin = ? WHERE id = ?', [String(pin), userId]);
}

async function getPin(userId) {
    await init();
    const row = await get('SELECT pin FROM users WHERE id = ?', [userId]);
    return row?.pin || '';
}

module.exports = {
    init,
    db,
    upsertUser,
    getPlayer,
    createPlayer,
    setPlayerZone,
    getInventory,
    getItemQty,
    addInventory,
    createTransfer,
    getOpenTransfers,
    getUserTransfers,
    getTransfer,
    closeTransfer,
    cancelTransfer,
    listPlayers,
    savePin,
    getPin
};

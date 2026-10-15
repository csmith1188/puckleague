const express = require('express');
const adventureDb = require('../../utils/adventureDb');
const { transferToPool } = require('../../utils/transferManager');
const {
    START_CITIES,
    MOVE_COST_DIGIPOGS,
    TRAVEL_MS,
    findZone,
    findValidMove,
    getZoneMartItems,
    findMartItem,
    digipogPrice,
    normalizeItemName,
    getOutgoingConnections
} = require('../../utils/adventureMap');
const { requireAdventureAuth } = require('../../middleware/adventureAuth');

const router = express.Router();

router.post('/join', requireAdventureAuth, async (req, res) => {
    try {
        const userId = req.session.token.id;
        const existing = await adventureDb.getPlayer(userId);
        if (existing) {
            return res.json({ ok: true, player: existing, message: 'Already joined' });
        }

        let startZone = req.body?.startZone || START_CITIES[0];
        if (!START_CITIES.includes(startZone)) {
            startZone = START_CITIES[0] || 'Viridian City';
        }
        if (!findZone(startZone)) {
            return res.status(400).json({ ok: false, error: 'Invalid start zone' });
        }

        const player = await adventureDb.createPlayer(userId, startZone);
        res.json({ ok: true, player });
    } catch (err) {
        console.error('[adventure/join]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post('/move', requireAdventureAuth, async (req, res) => {
    try {
        const userId = req.session.token.id;
        const { toZone, pin } = req.body || {};
        if (!toZone) {
            return res.status(400).json({ ok: false, error: 'toZone is required' });
        }

        const player = await adventureDb.getPlayer(userId);
        if (!player) {
            return res.status(400).json({ ok: false, error: 'Join the adventure first' });
        }

        const now = Date.now();
        if (player.travelUntil && player.travelUntil > now) {
            const secs = Math.ceil((player.travelUntil - now) / 1000);
            return res.status(429).json({
                ok: false,
                error: `Still traveling (${secs}s remaining)`,
                travelUntil: player.travelUntil
            });
        }

        const destZone = findZone(toZone);
        if (!destZone) {
            return res.status(400).json({ ok: false, error: 'Unknown destination zone' });
        }
        const canonicalTo = destZone.name;

        const inventory = await adventureDb.getInventory(userId);
        const moveCheck = findValidMove(player.currentZone, canonicalTo, inventory);
        if (!moveCheck.ok) {
            return res.status(400).json({ ok: false, error: moveCheck.error });
        }

        if (pin == null || pin === '') {
            return res.status(400).json({
                ok: false,
                error: 'PIN required',
                needsPin: true,
                amount: MOVE_COST_DIGIPOGS
            });
        }

        await transferToPool({
            from: userId,
            amount: MOVE_COST_DIGIPOGS,
            pin: Number(pin),
            reason: `Adventure move: ${player.currentZone} → ${canonicalTo}`
        });

        const travelUntil = now + TRAVEL_MS;
        // Arrive immediately in digital state, but lock further moves for 20s
        const updated = await adventureDb.setPlayerZone(userId, canonicalTo, travelUntil);

        res.json({
            ok: true,
            player: updated,
            cost: MOVE_COST_DIGIPOGS,
            travelUntil,
            travelSeconds: TRAVEL_MS / 1000
        });
    } catch (err) {
        console.error('[adventure/move]', err);
        res.status(400).json({ ok: false, error: err.message, details: err.details || null });
    }
});

router.post('/shop', requireAdventureAuth, async (req, res) => {
    try {
        const userId = req.session.token.id;
        const { itemName, pin, qty } = req.body || {};
        const quantity = Math.max(1, Math.min(99, Number(qty) || 1));

        if (!itemName) {
            return res.status(400).json({ ok: false, error: 'itemName is required' });
        }

        const player = await adventureDb.getPlayer(userId);
        if (!player) {
            return res.status(400).json({ ok: false, error: 'Join the adventure first' });
        }

        const martItems = getZoneMartItems(player.currentZone);
        const offered = martItems.find(
            (i) => normalizeItemName(i.name) === normalizeItemName(itemName)
        );
        if (!offered) {
            return res.status(400).json({
                ok: false,
                error: `${itemName} is not sold at ${player.currentZone}`
            });
        }

        const martItem = findMartItem(itemName);
        if (!martItem) {
            return res.status(400).json({ ok: false, error: 'Unknown mart item' });
        }

        const unitPrice = digipogPrice(martItem);
        const total = unitPrice * quantity;

        if (pin == null || pin === '') {
            return res.status(400).json({
                ok: false,
                error: 'PIN required',
                needsPin: true,
                amount: total
            });
        }

        await transferToPool({
            from: userId,
            amount: total,
            pin: Number(pin),
            reason: `Adventure shop: ${quantity}x ${martItem.name}`
        });

        await adventureDb.addInventory(userId, martItem.name, quantity);
        const inventory = await adventureDb.getInventory(userId);

        res.json({
            ok: true,
            item: martItem.name,
            quantity,
            cost: total,
            inventory
        });
    } catch (err) {
        console.error('[adventure/shop]', err);
        res.status(400).json({ ok: false, error: err.message, details: err.details || null });
    }
});

router.get('/neighbors', requireAdventureAuth, async (req, res) => {
    try {
        const userId = req.session.token.id;
        const player = await adventureDb.getPlayer(userId);
        if (!player) {
            return res.json({ ok: true, neighbors: [] });
        }
        const inventory = await adventureDb.getInventory(userId);
        const outgoing = getOutgoingConnections(player.currentZone);
        const neighbors = outgoing.map((c) => {
            const check = require('../../utils/adventureMap').canSatisfyReqs(c.req, inventory);
            return {
                to: c.to,
                req: c.req,
                canMove: check.ok,
                missing: check.missing || []
            };
        });
        // Dedupe by destination, prefer canMove
        const byDest = new Map();
        for (const n of neighbors) {
            const prev = byDest.get(n.to);
            if (!prev || (!prev.canMove && n.canMove)) {
                byDest.set(n.to, n);
            }
        }
        res.json({ ok: true, neighbors: [...byDest.values()], moveCost: MOVE_COST_DIGIPOGS });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post('/pin', requireAdventureAuth, async (req, res) => {
    try {
        const { pin } = req.body || {};
        if (!pin) {
            return res.status(400).json({ ok: false, error: 'PIN is required' });
        }
        await adventureDb.savePin(req.session.token.id, pin);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get('/pin', requireAdventureAuth, async (req, res) => {
    try {
        const pin = await adventureDb.getPin(req.session.token.id);
        res.json({ ok: true, pin: pin || '' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

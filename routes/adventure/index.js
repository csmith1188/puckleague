const express = require('express');
const adventureDb = require('../../utils/adventureDb');
const {
    START_CITIES,
    MOVE_COST_DIGIPOGS,
    TRAVEL_MS,
    DIGIPOG_MULTIPLIER,
    buildMapLayout,
    getZoneMartItems,
    getZonePois,
    getOutgoingConnections,
    canSatisfyReqs,
    findZone
} = require('../../utils/adventureMap');
const { requireAdventureAuth, requireGm, isGameMaster } = require('../../middleware/adventureAuth');

const router = express.Router();

// /adventure/login and /adventure/logout
router.use(require('./auth'));
router.use(require('./play'));
router.use('/transfers', require('./transfers'));

router.get('/', async (req, res) => {
    if (!req.session?.user || !req.session?.token) {
        return res.render('adventure/login-needed', {
            title: 'Adventure Mode',
            adventureUser: null
        });
    }

    // Ensure locals for layout
    const adventureUser = {
        id: req.session.token.id,
        displayName: req.session.token.displayName || req.session.user,
        permissions: req.session.token.permissions,
        isGm: isGameMaster(req)
    };

    try {
        await adventureDb.init();
        await adventureDb.upsertUser(adventureUser.id, adventureUser.displayName);

        const player = await adventureDb.getPlayer(adventureUser.id);
        const inventory = player ? await adventureDb.getInventory(adventureUser.id) : [];
        const myTransfers = player
            ? await adventureDb.getUserTransfers(adventureUser.id)
            : [];
        const map = buildMapLayout();

        let neighbors = [];
        let martItems = [];
        let pois = [];
        let zone = null;

        if (player) {
            zone = findZone(player.currentZone);
            martItems = getZoneMartItems(player.currentZone);
            pois = getZonePois(player.currentZone);
            const outgoing = getOutgoingConnections(player.currentZone);
            const byDest = new Map();
            for (const c of outgoing) {
                const check = canSatisfyReqs(c.req, inventory);
                const n = {
                    to: c.to,
                    req: c.req,
                    canMove: check.ok,
                    missing: check.missing || []
                };
                const prev = byDest.get(n.to);
                if (!prev || (!prev.canMove && n.canMove)) {
                    byDest.set(n.to, n);
                }
            }
            neighbors = [...byDest.values()];
        }

        const now = Date.now();
        const travelRemaining = player?.travelUntil
            ? Math.max(0, player.travelUntil - now)
            : 0;

        res.render('adventure/hub', {
            title: 'Adventure Mode',
            adventureUser,
            player,
            inventory,
            myTransfers: myTransfers.filter((t) => t.status === 'open'),
            map,
            neighbors,
            martItems,
            pois,
            zone,
            startCities: START_CITIES,
            moveCost: MOVE_COST_DIGIPOGS,
            travelMs: TRAVEL_MS,
            travelRemaining,
            digipogMultiplier: DIGIPOG_MULTIPLIER
        });
    } catch (err) {
        console.error('[adventure/]', err);
        res.status(500).render('adventure/error', {
            title: 'Error',
            message: err.message,
            adventureUser
        });
    }
});

router.get('/gm', requireAdventureAuth, requireGm, async (req, res) => {
    try {
        const openTransfers = await adventureDb.getOpenTransfers();
        const players = await adventureDb.listPlayers();
        res.render('adventure/gm', {
            title: 'Adventure GM',
            adventureUser: res.locals.adventureUser,
            openTransfers,
            players
        });
    } catch (err) {
        res.status(500).render('adventure/error', {
            title: 'Error',
            message: err.message,
            adventureUser: res.locals.adventureUser
        });
    }
});

module.exports = router;

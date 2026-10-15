const express = require('express');
const adventureDb = require('../../utils/adventureDb');
const { normalizeItemName, findMartItem } = require('../../utils/adventureMap');
const { requireAdventureAuth, requireGm } = require('../../middleware/adventureAuth');

const router = express.Router();

router.use(requireAdventureAuth);

router.post('/', async (req, res) => {
    try {
        const userId = req.session.token.id;
        const { itemName, direction, notes } = req.body || {};

        if (!itemName || !direction) {
            return res.status(400).json({ ok: false, error: 'itemName and direction are required' });
        }
        if (!['deposit', 'withdraw'].includes(direction)) {
            return res.status(400).json({ ok: false, error: 'direction must be deposit or withdraw' });
        }

        const player = await adventureDb.getPlayer(userId);
        if (!player) {
            return res.status(400).json({ ok: false, error: 'Join the adventure first' });
        }

        const name = findMartItem(itemName)?.name || normalizeItemName(itemName);

        if (direction === 'withdraw') {
            const qty = await adventureDb.getItemQty(userId, name);
            if (qty < 1) {
                // Also try exact itemName from inventory rows
                const inv = await adventureDb.getInventory(userId);
                const match = inv.find(
                    (r) => normalizeItemName(r.itemName) === normalizeItemName(itemName)
                );
                if (!match || match.qty < 1) {
                    return res.status(400).json({
                        ok: false,
                        error: `No ${itemName} in digital inventory to withdraw`
                    });
                }
            }
        }

        const transfer = await adventureDb.createTransfer(
            userId,
            name,
            direction,
            notes || ''
        );

        res.json({ ok: true, transfer });
    } catch (err) {
        console.error('[adventure/transfer]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get('/mine', async (req, res) => {
    try {
        const transfers = await adventureDb.getUserTransfers(req.session.token.id);
        res.json({ ok: true, transfers });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post('/:id/cancel', async (req, res) => {
    try {
        const transfer = await adventureDb.cancelTransfer(
            Number(req.params.id),
            req.session.token.id
        );
        res.json({ ok: true, transfer });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

router.get('/open', requireGm, async (req, res) => {
    try {
        const transfers = await adventureDb.getOpenTransfers();
        res.json({ ok: true, transfers });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post('/:id/close', requireGm, async (req, res) => {
    try {
        const transfer = await adventureDb.closeTransfer(
            Number(req.params.id),
            req.session.token.id
        );
        res.json({ ok: true, transfer });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

module.exports = router;

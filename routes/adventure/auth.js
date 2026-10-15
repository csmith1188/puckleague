const express = require('express');
const jwt = require('jsonwebtoken');
const adventureDb = require('../../utils/adventureDb');

const router = express.Router();

function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function getPublicBaseUrl() {
    const configured = stripTrailingSlash(
        process.env.URL || process.env.RENDER_EXTERNAL_URL || ''
    );
    const port = process.env.PORT || 3000;

    if (!configured) {
        return `http://localhost:${port}`;
    }

    try {
        const parsed = new URL(configured);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (isLocal && !parsed.port) {
            return `${parsed.protocol}//${parsed.hostname}:${port}`;
        }
        return stripTrailingSlash(parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname));
    } catch {
        return configured;
    }
}

const FORMBAR_ADDRESS = stripTrailingSlash(process.env.FORMBAR_ADDRESS);
const AUTH_URL = `${FORMBAR_ADDRESS}/oauth`;
const THIS_URL = `${getPublicBaseUrl()}/adventure/login`;

router.get('/login', async (req, res) => {
    if (!FORMBAR_ADDRESS) {
        return res.status(500).render('adventure/error', {
            title: 'Config Error',
            message: 'FORMBAR_ADDRESS is not configured. Copy .env-template to .env.',
            adventureUser: null
        });
    }

    if (req.query.token) {
        const rawToken = req.query.token;
        const tokenData = jwt.decode(rawToken);

        if (!tokenData || !tokenData.id) {
            return res.status(400).render('adventure/error', {
                title: 'Login Failed',
                message: 'Invalid Formbar token.',
                adventureUser: null
            });
        }

        req.session.token = tokenData;
        req.session.user = tokenData.displayName;
        req.session.permission = tokenData.permissions;
        req.session.rawToken = rawToken;

        try {
            await adventureDb.upsertUser(tokenData.id, tokenData.displayName || 'Trainer');
        } catch (err) {
            console.error('[adventure/login] DB error:', err.message);
        }

        return req.session.save((err) => {
            if (err) {
                console.error('[adventure/login] Session save error:', err);
                return res.status(500).send('Session error');
            }
            const redirectTo = req.query.redirectURL || '/adventure';
            res.redirect(redirectTo);
        });
    }

    res.redirect(`${AUTH_URL}?redirectURL=${encodeURIComponent(THIS_URL)}`);
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        if (FORMBAR_ADDRESS) {
            return res.redirect(`${AUTH_URL}?redirectURL=${encodeURIComponent(THIS_URL)}`);
        }
        res.redirect('/adventure');
    });
});

module.exports = router;

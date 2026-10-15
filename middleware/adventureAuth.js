/**
 * Adventure Mode auth helpers.
 * GMs: Formbar permissions >= 4 OR id listed in GM_IDS.
 */

function parseGmIds() {
    return String(process.env.GM_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !isNaN(n));
}

function isGameMaster(req) {
    const token = req.session?.token;
    if (!token) return false;
    const perms = Number(token.permissions);
    if (!isNaN(perms) && perms >= 4) return true;
    const id = Number(token.id);
    return parseGmIds().includes(id);
}

function requireAdventureAuth(req, res, next) {
    if (req.session?.user && req.session?.token) {
        const tokenData = req.session.token;
        try {
            const currentTime = Math.floor(Date.now() / 1000);
            if (tokenData.exp && tokenData.exp < currentTime) {
                throw new Error('Token has expired');
            }
            res.locals.adventureUser = {
                id: tokenData.id,
                displayName: tokenData.displayName || req.session.user,
                permissions: tokenData.permissions,
                isGm: isGameMaster(req)
            };
            return next();
        } catch (err) {
            req.session.destroy(() => {});
        }
    }

    const wantsJson =
        req.xhr ||
        (req.headers.accept && req.headers.accept.includes('application/json')) ||
        req.headers['content-type']?.includes('application/json');

    if (wantsJson || req.method !== 'GET') {
        return res.status(401).json({ ok: false, error: 'Unauthorized — log in with Formbar' });
    }
    return res.redirect('/adventure/login');
}

function requireGm(req, res, next) {
    if (!isGameMaster(req)) {
        const wantsJson =
            req.xhr ||
            (req.headers.accept && req.headers.accept.includes('application/json'));
        if (wantsJson || req.method !== 'GET') {
            return res.status(403).json({ ok: false, error: 'Game Master access required' });
        }
        return res.status(403).render('adventure/error', {
            title: 'GM Only',
            message: 'Game Master access required.',
            adventureUser: res.locals.adventureUser
        });
    }
    next();
}

module.exports = {
    requireAdventureAuth,
    requireGm,
    isGameMaster,
    parseGmIds
};

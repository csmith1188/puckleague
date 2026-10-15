const express = require('express');
const Pucks = require('../data/pucks');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    let pucks = Pucks;
    const { type, found } = req.query;

    if (type) {
        pucks = pucks.filter(
            (p) => p.type && p.type.toLowerCase() === String(type).toLowerCase()
        );
    }
    if (found) {
        pucks = pucks.filter(
            (p) => p.found && p.found.toLowerCase() === String(found).toLowerCase()
        );
    }

    res.render('pucks/index', {
        title: 'Pucks',
        pucks,
        filters: { type: type || '', found: found || '' },
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const puck = findBySlug(Pucks, req.params.slug);
    if (!puck) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No puck matching "${req.params.slug}".`
        });
    }
    res.render('pucks/show', {
        title: puck.name,
        puck,
        toSlug
    });
});

module.exports = router;

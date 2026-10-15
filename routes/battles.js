const express = require('express');
const Battles = require('../data/battles');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('battles/index', {
        title: 'Battles',
        battles: Battles,
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const battle = findBySlug(Battles, req.params.slug);
    if (!battle) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No battle matching "${req.params.slug}".`
        });
    }
    res.render('battles/show', {
        title: battle.name,
        battle,
        toSlug
    });
});

module.exports = router;

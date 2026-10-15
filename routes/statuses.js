const express = require('express');
const Statuses = require('../data/statuses');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('statuses/index', {
        title: 'Statuses',
        statuses: Statuses,
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const status = findBySlug(Statuses, req.params.slug);
    if (!status) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No status matching "${req.params.slug}".`
        });
    }
    res.render('statuses/show', {
        title: status.name,
        status,
        toSlug
    });
});

module.exports = router;

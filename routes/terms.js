const express = require('express');
const Terms = require('../data/terms');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('terms/index', {
        title: 'Terms',
        terms: Terms,
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const term = findBySlug(Terms, req.params.slug);
    if (!term) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No term matching "${req.params.slug}".`
        });
    }
    res.render('terms/show', {
        title: term.name,
        term,
        toSlug
    });
});

module.exports = router;

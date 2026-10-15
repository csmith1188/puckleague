const express = require('express');
const Slammers = require('../data/slammers');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('slammers/index', {
        title: 'Slammers',
        slammers: Slammers,
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const slammer = findBySlug(Slammers, req.params.slug);
    if (!slammer) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No slammer matching "${req.params.slug}".`
        });
    }
    res.render('slammers/show', {
        title: slammer.name,
        slammer,
        toSlug
    });
});

module.exports = router;

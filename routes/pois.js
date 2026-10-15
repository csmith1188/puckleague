const express = require('express');
const Pois = require('../data/pois');
const { findBySlug, toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('pois/index', {
        title: 'Points of Interest',
        pois: Pois,
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const poi = findBySlug(Pois, req.params.slug);
    if (!poi) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No point of interest matching "${req.params.slug}".`
        });
    }
    res.render('pois/show', {
        title: poi.name,
        poi,
        toSlug
    });
});

module.exports = router;

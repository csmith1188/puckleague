const express = require('express');
const Mart = require('../data/mart');
const { toSlug } = require('../utils/lookups');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('mart/index', {
        title: 'PokeMart',
        mart: Mart,
        toSlug
    });
});

module.exports = router;

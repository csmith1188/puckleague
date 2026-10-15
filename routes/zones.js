const express = require('express');
const Zones = require('../data/zones');
const Connections = require('../data/connections');
const Mart = require('../data/mart');
const Pucks = require('../data/pucks');
const Slammers = require('../data/slammers');
const Pois = require('../data/pois');
const {
    findBySlug,
    findConnections,
    findStdMart,
    otherZoneName,
    toSlug
} = require('../utils/lookups');

const router = express.Router();

function hasNamed(list, name) {
    return list.some((item) => item.name === name);
}

router.get('/', (req, res) => {
    let zones = Zones;
    const { type } = req.query;

    if (type) {
        zones = zones.filter(
            (z) => z.type && z.type.toLowerCase() === String(type).toLowerCase()
        );
    }

    res.render('zones/index', {
        title: 'Zones',
        zones,
        filters: { type: type || '' },
        toSlug
    });
});

router.get('/:slug', (req, res) => {
    const zone = findBySlug(Zones, req.params.slug);
    if (!zone) {
        return res.status(404).render('error', {
            title: 'Not Found',
            message: `No zone matching "${req.params.slug}".`
        });
    }

    const connections = findConnections(Connections, zone.name);
    const stdMartNames = zone.type === 'city' ? findStdMart(Mart) : [];
    const martItems = zone.type === 'city'
        ? stdMartNames.concat(zone.mart || [])
        : [];

    res.render('zones/show', {
        title: zone.name,
        zone,
        connections,
        martItems,
        otherZoneName,
        toSlug,
        puckExists: (name) => hasNamed(Pucks, name),
        slammerExists: (name) => hasNamed(Slammers, name),
        poiExists: (name) => hasNamed(Pois, name)
    });
});

module.exports = router;

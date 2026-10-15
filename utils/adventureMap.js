/**
 * Adventure map helpers: zone graph, mart stock, movement validation.
 */

const Zones = require('../data/zones');
const Connections = require('../data/connections');
const Mart = require('../data/mart');
const Pois = require('../data/pois');
const { findStdMart } = require('./lookups');

const DIGIPOG_MULTIPLIER = 100;
const MOVE_COST_DIGIPOGS = 1 * DIGIPOG_MULTIPLIER;
const TRAVEL_MS = 20 * 1000;

/** Cities players may start in (exclude Cinnabar and Fuchsia per rules). */
const START_CITIES = [
    'Pallet Town',
    'Viridian City',
    'Pewter City',
    'Cerulean City',
    'Vermillion City',
    'Lavender Town',
    'Celadon City',
    'Saffron City'
].filter((name) => Zones.some((z) => z.name === name));

/** Normalize known spelling variants for zone matching. */
function normalizeZoneName(name) {
    if (!name) return '';
    const n = String(name).trim();
    const aliases = {
        'Fuchsia City': 'Fuschia City',
        'Fuschia City': 'Fuschia City',
        'Vermilion City': 'Vermillion City',
        'Vermillion City': 'Vermillion City',
        Ultraball: 'Ultra Ball',
        'Ultra Ball': 'Ultra Ball',
        Greatball: 'Great Ball',
        'Great Ball': 'Great Ball',
        Energy: 'Energy Puck',
        'Energy Puck': 'Energy Puck'
    };
    return aliases[n] || n;
}

function findZone(name) {
    const target = normalizeZoneName(name);
    return Zones.find((z) => normalizeZoneName(z.name) === target);
}

function zonesEqual(a, b) {
    return normalizeZoneName(a) === normalizeZoneName(b);
}

/**
 * Item name aliases so zone mart lists match Mart catalog entries.
 */
function normalizeItemName(name) {
    if (!name) return '';
    const n = String(name).trim();
    const aliases = {
        Ultraball: 'Ultra Ball',
        Ultraballs: 'Ultra Ball',
        'Ultra Ball': 'Ultra Ball',
        Greatball: 'Great Ball',
        Greatballs: 'Great Ball',
        'Great Ball': 'Great Ball',
        Energy: 'Energy Puck',
        'Energy Puck': 'Energy Puck',
        Pokeball: 'Poké Ball',
        'Poke Ball': 'Poké Ball',
        'Poké Ball': 'Poké Ball',
        Potion: 'Potion',
        Berry: 'Berry',
        Bike: 'Bike',
        Switch: 'Switch',
        'Focus Energy': 'Focus Energy',
        'Full Heal': 'Full Heal',
        'Heavy Ball': 'Heavy Ball',
        'Power Stone': 'Power Stone'
    };
    return aliases[n] || n;
}

function findMartItem(name) {
    const target = normalizeItemName(name);
    return Mart.find((m) => normalizeItemName(m.name) === target);
}

function digipogPrice(martItem) {
    return (martItem?.cost || 0) * DIGIPOG_MULTIPLIER;
}

/**
 * Items available at a zone (std city items + zone extras + dept store list).
 */
function getZoneMartItems(zoneName) {
    const zone = findZone(zoneName);
    if (!zone) return [];

    const names = new Set();
    // All City Zones additionally sell Poké Ball + Potion (std mart)
    if (zone.type === 'city') {
        findStdMart(Mart, false).forEach((n) => names.add(normalizeItemName(n)));
    }
    (zone.mart || []).forEach((n) => names.add(normalizeItemName(n)));

    return [...names]
        .map((n) => findMartItem(n))
        .filter(Boolean)
        .map((item) => ({
            name: item.name,
            cost: item.cost,
            digipogs: digipogPrice(item)
        }));
}

/**
 * Connections leaving fromZone (handles alternate OR-paths as separate edges).
 */
function getOutgoingConnections(fromZone) {
    const from = normalizeZoneName(fromZone);
    return Connections.filter((c) => {
        if (c.direction === 'both') {
            return c.zones.some((z) => zonesEqual(z, from));
        }
        if (c.direction === 'up') {
            return zonesEqual(c.zones[0], from);
        }
        if (c.direction === 'down') {
            return zonesEqual(c.zones[1], from);
        }
        return false;
    }).map((c) => {
        const dest = zonesEqual(c.zones[0], from) ? c.zones[1] : c.zones[0];
        return {
            to: dest,
            req: c.req || [],
            direction: c.direction
        };
    });
}

/**
 * Check if player inventory satisfies a connection's requirements.
 * Multiple alternate edges (e.g. surf OR bike) are separate connections — any one matching works.
 * Within one edge, all req items are AND.
 *
 * Soft stubs: "water type pokemon", "grass type pokemon", "fighting type pokemon",
 * "8 badges", "defeated elite 4" are treated as owned if inventory has a matching
 * named item OR we skip type-pokemon checks for v1 (player plays with real pucks —
 * GM / honor system). For path items (bike, pokeflute, etc.) require inventory.
 */
function canSatisfyReqs(reqs, inventoryRows) {
    if (!reqs || reqs.length === 0) return { ok: true };

    const inv = new Set(
        (inventoryRows || []).map((r) => normalizeItemName(r.itemName).toLowerCase())
    );
    // Also allow raw lowercased names
    (inventoryRows || []).forEach((r) => inv.add(String(r.itemName).toLowerCase()));

    const softReqs = new Set([
        'water type pokemon',
        'grass type pokemon',
        'fighting type pokemon',
        '8 badges',
        'defeated elite 4'
    ]);

    const missing = [];
    for (const req of reqs) {
        const key = String(req).toLowerCase().trim();
        if (softReqs.has(key)) {
            // Honor system / real pucks — allow for online movement
            continue;
        }
        // Map common req names to inventory item names
        const itemAliases = {
            surf: null, // soft with water type — already soft if paired; alone treat soft
            cut: null,
            dig: null,
            bike: 'bike',
            pokeflute: 'pokeflute',
            'ss anne ticket': 'ss anne ticket',
            'silph scope': 'silph scope'
        };

        if (key === 'surf' || key === 'cut' || key === 'dig') {
            // HM moves: soft for hybrid play
            continue;
        }

        const needed = itemAliases[key] || key;
        if (needed && !inv.has(needed) && !inv.has(normalizeItemName(needed).toLowerCase())) {
            // Check inventory for loosely matching names
            const has = [...inv].some(
                (i) => i.includes(needed) || needed.includes(i)
            );
            if (!has) missing.push(req);
        }
    }

    return { ok: missing.length === 0, missing };
}

function findValidMove(fromZone, toZone, inventoryRows) {
    const candidates = getOutgoingConnections(fromZone).filter((c) =>
        zonesEqual(c.to, toZone)
    );
    if (candidates.length === 0) {
        return { ok: false, error: 'No path between those zones' };
    }
    for (const c of candidates) {
        const check = canSatisfyReqs(c.req, inventoryRows);
        if (check.ok) {
            return { ok: true, connection: c };
        }
    }
    const allMissing = candidates.flatMap((c) => canSatisfyReqs(c.req, inventoryRows).missing);
    return {
        ok: false,
        error: `Missing requirements: ${[...new Set(allMissing)].join(', ') || 'path blocked'}`
    };
}

function getZonePois(zoneName) {
    const zone = findZone(zoneName);
    if (!zone) return [];
    return (zone.poi || []).map((name) => {
        const def = Pois.find((p) => p.name === name);
        return def || { name, description: '', text: '' };
    });
}

/**
 * Build a simple force-layout-ish grid for SVG map (deterministic from names).
 */
function buildMapLayout() {
    const nodes = Zones.map((z, i) => {
        // Rough Kanto-ish placement by type buckets
        let x = 80 + (i % 8) * 110;
        let y = 60 + Math.floor(i / 8) * 90;
        // Hand-tuned anchors for major cities
        const anchors = {
            'Pallet Town': [120, 480],
            'Viridian City': [120, 380],
            'Pewter City': [120, 220],
            'Cerulean City': [420, 160],
            'Vermillion City': [420, 360],
            'Lavender Town': [620, 260],
            'Celadon City': [280, 260],
            'Saffron City': [420, 260],
            'Fuschia City': [420, 520],
            'Cinnabar Island': [200, 580],
            'Indigo Plateau': [40, 100],
            'Viridian Forest': [120, 300],
            'Mt. Moon': [260, 160],
            'Route 1': [120, 430],
            'Route 2': [120, 340]
        };
        if (anchors[z.name]) {
            [x, y] = anchors[z.name];
        }
        return {
            name: z.name,
            type: z.type,
            x,
            y,
            poi: z.poi || [],
            pkmn: z.pkmn || []
        };
    });

    const edges = [];
    const seen = new Set();
    for (const c of Connections) {
        const a = c.zones[0];
        const b = c.zones[1];
        const key = [normalizeZoneName(a), normalizeZoneName(b)].sort().join('|') + '|' + (c.req || []).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
            a,
            b,
            req: c.req || []
        });
    }

    return { nodes, edges };
}

module.exports = {
    DIGIPOG_MULTIPLIER,
    MOVE_COST_DIGIPOGS,
    TRAVEL_MS,
    START_CITIES,
    Zones,
    Connections,
    Mart,
    Pois,
    normalizeZoneName,
    normalizeItemName,
    findZone,
    zonesEqual,
    findMartItem,
    digipogPrice,
    getZoneMartItems,
    getOutgoingConnections,
    canSatisfyReqs,
    findValidMove,
    getZonePois,
    buildMapLayout
};

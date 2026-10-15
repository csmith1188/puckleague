const { toSlug } = require('./slug');

/**
 * Find an item in a list by matching its name slug to the given slug.
 */
function findBySlug(list, slug) {
    if (!list || !slug) return undefined;
    return list.find((item) => toSlug(item.name) === slug);
}

/**
 * Find connections for a zone.
 * reverse true if you want one-way routes coming into thisZone.
 */
function findConnections(Connections, thisZone, reverse) {
    if (!thisZone) return [];
    const findDirect = (zone) => {
        if (reverse) {
            return zone.direction === 'down' && zone.zones[0] === thisZone;
        }
        return (
            (zone.direction === 'up' && zone.zones[0] === thisZone) ||
            (zone.direction === 'both' && zone.zones.includes(thisZone))
        );
    };
    return Connections.filter(findDirect);
}

/**
 * Return standard mart item names (or full objects if fullObj is true).
 */
function findStdMart(Mart, fullObj) {
    const std = Mart.filter((puck) => puck.std);
    return fullObj ? std : std.map((puck) => puck.name);
}

/**
 * Neighbor zone name from a connection relative to thisZone.
 */
function otherZoneName(connection, thisZone) {
    return connection.zones[0] === thisZone
        ? connection.zones[1]
        : connection.zones[0];
}

module.exports = {
    findBySlug,
    findConnections,
    findStdMart,
    otherZoneName,
    toSlug
};

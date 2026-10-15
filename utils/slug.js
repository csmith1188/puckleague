/**
 * Convert a display name to a URL-friendly slug.
 * e.g. "Training Battle" → "training-battle"
 */
function toSlug(name) {
    if (!name) return '';
    return String(name)
        .toLowerCase()
        .trim()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

module.exports = { toSlug };

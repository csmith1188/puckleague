/**
 * DigiPog transfer manager (adapted from jukebar).
 * Pays into Formbar pool via socket, with HTTP fallback.
 */

const formbarSocket = require('./formbarSocket');

const FORMBAR_ADDRESS = String(process.env.FORMBAR_ADDRESS || '').replace(/\/+$/, '');
const POOL_ID = Number(process.env.POOL_ID);

function validateTransferParams({ from, to, amount, pin }) {
    if (!from || isNaN(Number(from))) {
        throw new Error('Invalid sender ID');
    }
    if (!to || isNaN(Number(to))) {
        throw new Error('Invalid recipient/pool ID');
    }
    if (!amount || Number(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
    }
    if (pin == null || isNaN(Number(pin))) {
        throw new Error('Valid PIN is required');
    }
}

async function httpTransfer(payload) {
    const response = await fetch(`${FORMBAR_ADDRESS}/api/digipogs/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const responseJson = await response.json().catch(() => ({}));

    if (response.ok && responseJson) {
        return responseJson;
    }

    let errorMessage = 'Transfer failed';
    if (responseJson?.token) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(responseJson.token);
            if (decoded?.message) errorMessage = decoded.message;
        } catch (_) {
            /* ignore */
        }
    }
    if (errorMessage === 'Transfer failed') {
        errorMessage =
            responseJson?.message ||
            responseJson?.error ||
            responseJson?.details?.message ||
            'Transfer failed';
    }

    const err = new Error(errorMessage);
    err.details = responseJson;
    throw err;
}

async function transfer({ from, to, amount, pin, reason = 'PokePucks Adventure', pool = false }) {
    validateTransferParams({ from, to, amount, pin });

    const isPoolTransfer = pool || Number(to) === POOL_ID;
    const payload = {
        from: Number(from),
        to: Number(to),
        amount: Number(amount),
        reason: String(reason),
        pin: Number(pin),
        pool: isPoolTransfer
    };

    if (formbarSocket.isSocketConnected()) {
        try {
            const response = await formbarSocket.emitWithResponse(
                'transferDigipogs',
                payload,
                null,
                15000
            );

            if (response && (response.ok || response.success)) {
                return response;
            }
            if (response && (response.error || response.message)) {
                const err = new Error(response.error || response.message || 'Transfer failed');
                err.details = response;
                throw err;
            }
            if (response) return response;
            throw new Error('Empty response from Formbar');
        } catch (socketError) {
            if (socketError.details) throw socketError;
            console.warn('[TransferManager] Socket failed, falling back to HTTP:', socketError.message);
        }
    }

    return httpTransfer(payload);
}

async function transferToPool({ from, amount, pin, reason = 'PokePucks Adventure' }) {
    if (!POOL_ID || isNaN(POOL_ID)) {
        throw new Error('Server misconfigured: POOL_ID is not set');
    }
    return transfer({ from, to: POOL_ID, amount, pin, reason, pool: true });
}

module.exports = {
    transfer,
    transferToPool,
    validateTransferParams
};

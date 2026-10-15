/**
 * Formbar socket connection manager (adapted from jukebar).
 * Used for DigiPog pool transfers via transferDigipogs.
 */

const { io: ioClient } = require('socket.io-client');

const FORMBAR_ADDRESS = String(process.env.FORMBAR_ADDRESS || '').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';

let socket = null;
let isConnected = false;
let connectionPromise = null;

function getSocket() {
    if (socket && isConnected) {
        return Promise.resolve(socket);
    }
    if (connectionPromise) {
        return connectionPromise;
    }
    if (!FORMBAR_ADDRESS) {
        return Promise.reject(new Error('FORMBAR_ADDRESS is not configured'));
    }

    connectionPromise = new Promise((resolve, reject) => {
        socket = ioClient(FORMBAR_ADDRESS, {
            extraHeaders: { api: API_KEY },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('[FormbarSocket] Connected:', socket.id);
            isConnected = true;
            connectionPromise = null;
            resolve(socket);
        });

        socket.on('connect_error', (err) => {
            console.error('[FormbarSocket] Connection error:', err.message);
            if (connectionPromise) {
                connectionPromise = null;
                reject(new Error(`Failed to connect to Formbar: ${err.message}`));
            }
        });

        socket.on('disconnect', (reason) => {
            console.warn('[FormbarSocket] Disconnected:', reason);
            isConnected = false;
        });

        socket.on('reconnect', () => {
            isConnected = true;
        });
    });

    return connectionPromise;
}

async function emitWithResponse(emitEvent, data, responseEvent = null, timeoutMs = 15000) {
    const sock = await getSocket();

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Socket request timed out after ${timeoutMs}ms for event: ${emitEvent}`));
        }, timeoutMs);

        if (responseEvent) {
            sock.once(responseEvent, (responseData) => {
                clearTimeout(timer);
                resolve(responseData);
            });
            sock.emit(emitEvent, data);
        } else {
            sock.emit(emitEvent, data, (ack) => {
                clearTimeout(timer);
                resolve(ack);
            });
        }
    });
}

function isSocketConnected() {
    return isConnected && !!socket?.connected;
}

function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
        isConnected = false;
        connectionPromise = null;
    }
}

module.exports = {
    getSocket,
    emitWithResponse,
    isSocketConnected,
    disconnect
};

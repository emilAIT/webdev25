import { getToken } from './authService.js';

let websocket = null;
const WS_URL_BASE = 'ws://127.0.0.1:8000/ws/'; // Centralize WS base URL
let actionHandlers = {}; // { action: handlerFunction(payload) }
let connectTimer = null;
const RECONNECT_DELAY = 5000; // 5 seconds

let onOpenCallback = null;
let onCloseCallback = null;
let onErrorCallback = null;


function getWebSocketUrl() {
    const token = getToken();
    if (!token) return null;
    return `${WS_URL_BASE}${token}`;
}

export function registerActionHandler(action, handler) {
    actionHandlers[action] = handler;
}

export function setOnOpen(callback) {
    onOpenCallback = callback;
}
export function setOnClose(callback) {
    onCloseCallback = callback;
}
export function setOnError(callback) {
    onErrorCallback = callback;
}

export function connect() {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
        console.error("Cannot connect WebSocket: No auth token.");
        // Consider calling onCloseCallback or onErrorCallback here too
        if (onCloseCallback) onCloseCallback({ code: 4001, reason: "No auth token", wasClean: true });
        return;
    }

    // Avoid multiple connections
    if (websocket && websocket.readyState !== WebSocket.CLOSED) {
        console.warn("WebSocket already connecting or open.");
        return;
    }

    clearTimeout(connectTimer); // Clear any pending reconnect timer
    console.log("Attempting WebSocket connection...");

    websocket = new WebSocket(wsUrl);

    websocket.onopen = (event) => {
        console.log('WebSocket connection opened', event);
        if (onOpenCallback) onOpenCallback();
    };

    websocket.onmessage = async (event) => {
        console.log('[WS Received]', event.data);
        try {
            const message = JSON.parse(event.data);
            const action = message.action;
            const payload = message.payload;

            if (actionHandlers[action]) {
                actionHandlers[action](payload); // Call registered handler
            } else if (action === 'ping') {
                 // Auto-respond to pings if backend expects it
                 // send('pong', { timestamp: payload.timestamp });
            } else {
                console.warn('Unknown WebSocket action received:', action);
            }

        } catch (error) {
            console.error('Failed to parse WebSocket message or handle action:', error);
             if (onErrorCallback) onErrorCallback("Message parse/handle error");
        }
    };

    websocket.onerror = (event) => {
        console.error('WebSocket error:', event);
         if (onErrorCallback) onErrorCallback("WebSocket error occurred");
    };

    websocket.onclose = (event) => {
        console.log(`WebSocket connection closed: Code=${event.code}, Reason=${event.reason}, Clean=${event.wasClean}`);
        websocket = null; // Clear the reference
        if (onCloseCallback) onCloseCallback(event);

        // Attempt to reconnect only if not closed cleanly or due to specific codes (like auth error)
        // Avoid reconnecting if explicitly disconnected (e.g., logout) or bad token (e.g., 1008)
        if (!event.wasClean && event.code !== 1008 && event.code !== 1000 && event.code !== 4001) {
            console.log(`Attempting to reconnect WebSocket in ${RECONNECT_DELAY / 1000}s...`);
            clearTimeout(connectTimer);
            connectTimer = setTimeout(connect, RECONNECT_DELAY);
        } else if (event.code === 1008) {
             console.error("WebSocket closed due to policy violation (likely bad token).");
             // Optional: Force logout or redirect here
        }
    };
}

export function send(action, payload) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log(`Sending WS Action: ${action}`, payload);
        websocket.send(JSON.stringify({ action: action, payload: payload }));
        return true;
    } else {
        console.error("WebSocket not connected. Cannot send message.");
        return false;
    }
}

export function disconnect(code = 1000, reason = "User logout") {
    clearTimeout(connectTimer); // Stop any reconnection attempts
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log(`Closing WebSocket connection: Code=${code}, Reason=${reason}`);
        websocket.close(code, reason);
    }
    websocket = null; // Ensure it's cleared
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const server = http_1.default.createServer();
const wss = new ws_1.default.Server({ noServer: true });
const users = new Map();
let userIdCounter = 1;
function broadcastPing(content, senderId) {
    console.log(`Broadcasting ping from User ${senderId} to all users`);
    users.forEach((client, id) => {
        if (id !== senderId && client.readyState === ws_1.default.OPEN) {
            const message = JSON.stringify({ type: 'ping', content, senderId });
            client.send(message, (error) => {
                if (error) {
                    console.error(`Error sending ping from User ${senderId} to User ${id}:`, error);
                }
                else {
                    console.log(`Successfully sent ping from User ${senderId} to User ${id}: ${message}`);
                }
            });
        }
    });
}
function sendPing(target, content, senderId) {
    const targetWs = users.get(target);
    if (targetWs && targetWs.readyState === ws_1.default.OPEN) {
        const message = JSON.stringify({ type: 'ping', content, senderId });
        targetWs.send(message, (error) => {
            if (error) {
                console.error(`Error sending ping from User ${senderId} to User ${target}:`, error);
            }
            else {
                console.log(`Successfully sent ping from User ${senderId} to User ${target}: ${message}`);
            }
        });
    }
    else {
        console.log(`Failed to send ping: User ${target} not found or connection not open`);
    }
}
function updateUserList() {
    const userList = Array.from(users.keys());
    const message = JSON.stringify({ type: 'userList', users: userList });
    users.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(message);
        }
    });
}
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
wss.on('connection', (ws) => {
    const userId = userIdCounter++;
    users.set(userId, ws);
    console.log(`User ${userId} connected`);
    ws.send(JSON.stringify({ type: 'userId', userId }));
    updateUserList();
    const pingInterval = setInterval(() => {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.ping();
        }
    }, 30000);
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            if (data.type === 'ping') {
                if (data.target === 'all') {
                    broadcastPing(data.content, data.senderId);
                }
                else {
                    sendPing(data.target, data.content, data.senderId);
                }
            }
        }
        catch (error) {
            console.error('Error processing message:', error);
        }
    });
    ws.on('close', () => {
        clearInterval(pingInterval);
        users.delete(userId);
        console.log(`User ${userId} disconnected`);
        updateUserList();
    });
    ws.on('error', (error) => {
        console.error(`WebSocket error for User ${userId}:`, error);
    });
});
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
});
server.on('error', (error) => {
    console.error('Server error:', error);
});

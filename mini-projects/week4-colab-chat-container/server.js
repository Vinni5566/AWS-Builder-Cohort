const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const urlMap = {
    "/": "index.html",
    "/style.css": "style.css",
  };

  const file = urlMap[req.url];
  if (!file) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const filePath = path.join(__dirname, file);
  const ext = path.extname(file);
  const contentType = ext === ".css" ? "text/css" : "text/html";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end("Server error");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// State
const rooms = {
  general: { name: "general", description: "Team-wide announcements", clients: new Set() },
  engineering: { name: "engineering", description: "Code reviews & PRs", clients: new Set() },
  devops: { name: "devops", description: "Infra, CI/CD, deployments", clients: new Set() },
  random: { name: "random", description: "Off-topic & memes", clients: new Set() },
};

const clients = new Map(); // ws -> { username, room, color }

const USER_COLORS = [
  "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
  "#79C0FF", "#56D364", "#FF7B72", "#E3B341",
];

let colorIndex = 0;

function broadcast(room, message, excludeWs = null) {
  const roomObj = rooms[room];
  if (!roomObj) return;
  roomObj.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastAll(message, excludeWs = null) {
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function getRoomList() {
  return Object.values(rooms).map((r) => ({
    name: r.name,
    description: r.description,
    count: r.clients.size,
  }));
}

function getOnlineUsers(room) {
  const roomObj = rooms[room];
  if (!roomObj) return [];
  const users = [];
  roomObj.clients.forEach((ws) => {
    const info = clients.get(ws);
    if (info) users.push({ username: info.username, color: info.color });
  });
  return users;
}

wss.on("connection", (ws) => {
  console.log("[WS] New connection");

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type } = msg;

    if (type === "join") {
      const username = (msg.username || "anon").slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, "");
      const room = rooms[msg.room] ? msg.room : "general";
      const color = USER_COLORS[colorIndex % USER_COLORS.length];
      colorIndex++;

      clients.set(ws, { username, room, color });
      rooms[room].clients.add(ws);

      // Send init state to joining user
      ws.send(JSON.stringify({
        type: "init",
        room,
        username,
        color,
        rooms: getRoomList(),
        users: getOnlineUsers(room),
      }));

      // Notify room of new user
      broadcast(room, {
        type: "system",
        text: `${username} joined #${room}`,
        ts: Date.now(),
      }, ws);

      // Update room counts for everyone
      broadcastAll({ type: "rooms_update", rooms: getRoomList() });

      console.log(`[JOIN] ${username} -> #${room}`);
      return;
    }

    const clientInfo = clients.get(ws);
    if (!clientInfo) return;

    if (type === "message") {
      const text = (msg.text || "").slice(0, 1000).trim();
      if (!text) return;

      const payload = {
        type: "message",
        username: clientInfo.username,
        color: clientInfo.color,
        text,
        room: clientInfo.room,
        ts: Date.now(),
      };

      // Echo back to sender too
      ws.send(JSON.stringify({ ...payload, self: true }));
      broadcast(clientInfo.room, payload, ws);
      return;
    }

    if (type === "switch_room") {
      const newRoom = rooms[msg.room] ? msg.room : "general";
      const oldRoom = clientInfo.room;

      if (newRoom === oldRoom) return;

      // Leave old room
      rooms[oldRoom].clients.delete(ws);
      broadcast(oldRoom, {
        type: "system",
        text: `${clientInfo.username} left #${oldRoom}`,
        ts: Date.now(),
      });

      // Join new room
      clientInfo.room = newRoom;
      rooms[newRoom].clients.add(ws);

      ws.send(JSON.stringify({
        type: "room_switched",
        room: newRoom,
        users: getOnlineUsers(newRoom),
      }));

      broadcast(newRoom, {
        type: "system",
        text: `${clientInfo.username} joined #${newRoom}`,
        ts: Date.now(),
      }, ws);

      broadcastAll({ type: "rooms_update", rooms: getRoomList() });
      return;
    }

    if (type === "typing") {
      broadcast(clientInfo.room, {
        type: "typing",
        username: clientInfo.username,
        color: clientInfo.color,
      }, ws);
      return;
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      rooms[info.room].clients.delete(ws);
      broadcast(info.room, {
        type: "system",
        text: `${info.username} disconnected`,
        ts: Date.now(),
      });
      broadcastAll({ type: "rooms_update", rooms: getRoomList() });
      clients.delete(ws);
      console.log(`[LEAVE] ${info.username}`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS Error]", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[SERVER] Collab Chat running on port ${PORT}`);
  console.log(`[SERVER] Rooms: ${Object.keys(rooms).join(", ")}`);
});

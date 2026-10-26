import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { RoomRecord, PlayerSymbol, ChatMessage } from './src/types/game';
import { checkWinner } from './src/lib/gameLogic';

const app = express();
app.use(express.json());

// In-memory room store (ensures real-time synchronization across Laptop and Mobile)
const rooms = new Map<string, RoomRecord>();
const roomMessages = new Map<string, ChatMessage[]>();

// Track connected SSE response streams per room
interface ConnectedClient {
  id: string;
  playerId: string;
  name: string;
  res: Response;
}
const roomClients = new Map<string, ConnectedClient[]>();

function getInitialRoom(roomId: string): RoomRecord {
  return {
    id: roomId,
    passcode: 'ithal_sanu_private_2026',
    player1_id: 'user_ithal',
    player1_name: 'Ithal',
    player2_id: 'user_sanu',
    player2_name: 'Sanu',
    board: ['', '', '', '', '', '', '', '', ''],
    current_turn: 'X',
    starter: 'X',
    winner: null,
    winning_line: null,
    match_id: 1,
    p1_score: 0,
    p2_score: 0,
    draws: 0,
    p1_rematch_ready: false,
    p2_rematch_ready: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function broadcastToRoom(roomId: string, data: object) {
  const clients = roomClients.get(roomId) || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

function getOnlinePlayerIds(roomId: string): string[] {
  const clients = roomClients.get(roomId) || [];
  const set = new Set<string>();
  clients.forEach((c) => set.add(c.playerId));
  return Array.from(set);
}

// 1. Get or initialize room state
app.get('/api/room/state', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || 'room_ithal_sanu';
  if (!rooms.has(roomId)) {
    rooms.set(roomId, getInitialRoom(roomId));
  }
  const room = rooms.get(roomId)!;
  const online = getOnlinePlayerIds(roomId);
  const messages = roomMessages.get(roomId) || [];
  res.json({ room, online, messages });
});

// 2. Server-Sent Events (SSE) real-time stream for presence, state & chat
app.get('/api/room/events', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || 'room_ithal_sanu';
  const playerId = (req.query.playerId as string) || 'anon';
  const name = (req.query.name as string) || 'Player';

  if (!rooms.has(roomId)) {
    rooms.set(roomId, getInitialRoom(roomId));
  }
  const room = rooms.get(roomId)!;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');

  const clientId = `${playerId}_${Date.now()}_${Math.random()}`;
  const client: ConnectedClient = { id: clientId, playerId, name, res };

  const existingClients = roomClients.get(roomId) || [];
  existingClients.push(client);
  roomClients.set(roomId, existingClients);

  // Send initial room state, presence, and chat history
  const online = getOnlinePlayerIds(roomId);
  const messages = roomMessages.get(roomId) || [];
  res.write(`data: ${JSON.stringify({ type: 'INIT', room, online, messages })}\n\n`);

  // Broadcast presence update to everyone in this room
  broadcastToRoom(roomId, { type: 'PRESENCE', online });

  // Keep-alive heartbeat every 15s
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = roomClients.get(roomId) || [];
    const filtered = clients.filter((c) => c.id !== clientId);
    roomClients.set(roomId, filtered);

    // Notify room of updated online players
    const updatedOnline = getOnlinePlayerIds(roomId);
    broadcastToRoom(roomId, { type: 'PRESENCE', online: updatedOnline });
  });
});

// 3. Submit game move
app.post('/api/room/move', (req: Request, res: Response) => {
  const { roomId = 'room_ithal_sanu', playerId, cellIndex } = req.body;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, getInitialRoom(roomId));
  }
  const room = rooms.get(roomId)!;

  const isP1 = playerId === room.player1_id;
  const isP2 = playerId === room.player2_id;
  if (!isP1 && !isP2) {
    res.status(403).json({ error: 'Unauthorized player' });
    return;
  }

  const symbol: PlayerSymbol = isP1 ? 'X' : 'O';

  if (room.winner) {
    res.status(400).json({ error: 'Game is already completed' });
    return;
  }

  if (room.current_turn !== symbol) {
    res.status(400).json({ error: "It's not your turn!" });
    return;
  }

  if (cellIndex < 0 || cellIndex > 8 || room.board[cellIndex] !== '') {
    res.status(400).json({ error: 'Invalid cell' });
    return;
  }

  // Apply move
  const newBoard = [...room.board];
  newBoard[cellIndex] = symbol;

  const { winner, line } = checkWinner(newBoard);
  const nextTurn: PlayerSymbol = symbol === 'X' ? 'O' : 'X';

  room.board = newBoard;
  room.winner = winner;
  room.winning_line = line;
  room.current_turn = winner ? room.current_turn : nextTurn;
  room.updated_at = new Date().toISOString();
  room.p1_rematch_ready = false;
  room.p2_rematch_ready = false;

  if (winner === 'X') room.p1_score += 1;
  else if (winner === 'O') room.p2_score += 1;
  else if (winner === 'DRAW') room.draws += 1;

  broadcastToRoom(roomId, { type: 'ROOM_UPDATE', room });
  res.json({ success: true, room });
});

// 4. Request rematch
app.post('/api/room/rematch', (req: Request, res: Response) => {
  const { roomId = 'room_ithal_sanu', playerId } = req.body;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, getInitialRoom(roomId));
  }
  const room = rooms.get(roomId)!;

  const isP1 = playerId === room.player1_id;
  const isP2 = playerId === room.player2_id;
  if (!isP1 && !isP2) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const nextStarter: PlayerSymbol = room.starter === 'X' ? 'O' : 'X';
  const otherReady = isP1 ? room.p2_rematch_ready : room.p1_rematch_ready;

  if (otherReady) {
    room.board = ['', '', '', '', '', '', '', '', ''];
    room.starter = nextStarter;
    room.current_turn = nextStarter;
    room.winner = null;
    room.winning_line = null;
    room.match_id += 1;
    room.p1_rematch_ready = false;
    room.p2_rematch_ready = false;
    room.updated_at = new Date().toISOString();
  } else {
    if (isP1) room.p1_rematch_ready = true;
    else room.p2_rematch_ready = true;
    room.updated_at = new Date().toISOString();
  }

  broadcastToRoom(roomId, { type: 'ROOM_UPDATE', room });
  res.json({ success: true, room });
});

// 5. Send live chat message
app.post('/api/room/chat', (req: Request, res: Response) => {
  const { roomId = 'room_ithal_sanu', senderId, senderName, text } = req.body;
  const cleanText = (text || '').trim();
  if (!cleanText) {
    res.status(400).json({ error: 'Empty message' });
    return;
  }

  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: senderId || 'anon',
    senderName: senderName || 'Player',
    text: cleanText.slice(0, 150),
    timestamp: Date.now(),
  };

  const list = roomMessages.get(roomId) || [];
  list.push(msg);
  if (list.length > 60) list.shift();
  roomMessages.set(roomId, list);

  broadcastToRoom(roomId, { type: 'CHAT_MESSAGE', message: msg });
  res.json({ success: true, message: msg });
});

// Mount Vite or static server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

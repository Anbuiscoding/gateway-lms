import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { ClassSession } from './models/ClassSession.js';
import { Attendance } from './models/Attendance.js';

// Live class rooms. State is kept in memory, so run a single API instance or add the socket.io Redis adapter.
const rooms = new Map();
const dateKey = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.ORG_TIMEZONE || 'Asia/Kolkata' });

export function attachSockets(server) {
  const origins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  const io = new Server(server, { cors: { origin: origins.length ? origins : true } });

  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ACCESS_SECRET);
      const u = await User.findById(payload.sub).select('name role active');
      if (!u?.active) throw new Error('inactive');
      socket.data.user = { id: String(u._id), name: u.name, role: u.role };
      next();
    } catch { next(new Error('unauthorized')); }
  });

  async function presence(room) {
    const st = rooms.get(room);
    if (!st) return;
    const unique = new Map();
    (await io.in(room).fetchSockets()).forEach((s) => unique.set(s.data.user.id, { ...s.data.user, host: !!s.data.host, paused: !!s.data.paused }));
    io.to(room).emit('presence', { people: [...unique.values()], hands: [...st.hands] });
  }

  io.on('connection', (socket) => {
    const me = socket.data.user;
    const ctx = () => { const st = rooms.get(socket.data.room); return st ? { room: socket.data.room, st } : null; };

    socket.on('room:join', async (sessionId, ack = () => {}) => {
      const s = await ClassSession.findById(sessionId).catch(() => null);
      if (!s) return ack({ error: 'Class not found' });
      const host = me.role === 'TRAINER' ? String(s.trainer) === me.id : me.role === 'ADMIN' || me.role === 'SUPER_ADMIN';
      if (s.status === 'ENDED') return ack({ error: 'This class has ended' });
      if (s.status === 'SCHEDULED' && !host) return ack({ error: 'This class has not started yet' });
      const room = 'class:' + sessionId;
      socket.join(room);
      Object.assign(socket.data, { room, host, sessionId });
      if (!rooms.has(room)) rooms.set(room, { code: s.starterCode || '', language: s.language, chat: [], hands: new Set(), output: '', cursor: null });
      const st = rooms.get(room);
      if (me.role === 'STUDENT' && s.status === 'LIVE') {
        Attendance.updateOne({ user: me.id, kind: 'CLASS', session: s._id }, { $setOnInsert: { date: dateKey(), status: 'PRESENT', checkIn: new Date() } }, { upsert: true }).catch(() => {});
      }
      ack({ ok: true, host, state: { code: st.code, language: st.language, chat: st.chat, output: st.output, cursor: st.cursor }, hands: [...st.hands] });
      presence(room);
    });

    socket.on('code:change', (code) => {
      const c = ctx(); if (!c || typeof code !== 'string' || code.length > 50000) return;
      if (!socket.data.host) return;
      c.st.code = code;
      socket.to(c.room).emit('code:change', { code, by: me.name });
    });
    socket.on('lang:change', (language) => {
      const c = ctx(); if (!c || !socket.data.host || typeof language !== 'string') return;
      c.st.language = language; io.to(c.room).emit('lang:change', language);
    });
    socket.on('cursor', (pos) => {
      const c = ctx(); if (!c || !socket.data.host || !pos || typeof pos.line !== 'number') return;
      c.st.cursor = pos; socket.to(c.room).emit('cursor', pos);
    });
    socket.on('follow:state', (paused) => { socket.data.paused = !!paused; if (socket.data.room) presence(socket.data.room); });
    socket.on('output:share', (text) => {
      const c = ctx(); if (!c || !socket.data.host) return;
      c.st.output = String(text).slice(0, 8000); io.to(c.room).emit('output:share', c.st.output);
    });
    socket.on('chat:send', (text) => {
      const c = ctx(); if (!c || typeof text !== 'string' || !text.trim()) return;
      const msg = { id: Date.now() + Math.random().toString(36).slice(2, 6), who: me.name, role: me.role, text: text.trim().slice(0, 500), at: Date.now() };
      c.st.chat = [...c.st.chat, msg].slice(-200);
      io.to(c.room).emit('chat:message', msg);
    });
    socket.on('hand:toggle', () => {
      const c = ctx(); if (!c) return;
      c.st.hands.has(me.id) ? c.st.hands.delete(me.id) : c.st.hands.add(me.id);
      presence(c.room);
    });
    socket.on('class:end', async () => {
      const c = ctx(); if (!c || !socket.data.host) return;
      await ClassSession.findByIdAndUpdate(socket.data.sessionId, { status: 'ENDED', endedAt: new Date() });
      io.to(c.room).emit('class:ended');
      rooms.delete(c.room);
    });
    socket.on('disconnect', () => { if (socket.data.room) presence(socket.data.room); });
  });
  return io;
}

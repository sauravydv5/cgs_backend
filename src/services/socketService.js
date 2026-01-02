import { Server } from "socket.io";

let io = null;

const socketExports = {
  initializeSocket: (server) => {
    io = new Server(server, {
      cors: {
        origin: "*", // Configure this to your frontend URL in production
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join room for specific order tracking
      socket.on("join-order-room", (orderId) => {
        socket.join(`order-${orderId}`);
        console.log(`Client ${socket.id} joined room: order-${orderId}`);
      });

      // Leave order room
      socket.on("leave-order-room", (orderId) => {
        socket.leave(`order-${orderId}`);
        console.log(`Client ${socket.id} left room: order-${orderId}`);
      });

      // Join ticket room
      socket.on("join-ticket-room", (ticketId) => {
        socket.join(`ticket-${ticketId}`);
        console.log(`Client ${socket.id} joined room: ticket-${ticketId}`);
      });

      // Leave ticket room
      socket.on("leave-ticket-room", (ticketId) => {
        socket.leave(`ticket-${ticketId}`);
        console.log(`Client ${socket.id} left room: ticket-${ticketId}`);
      });

      // Join Event Room (for live price updates)
      socket.on("join-event-room", (eventId) => {
        socket.join(`event-${eventId}`);
        console.log(`Client ${socket.id} joined room: event-${eventId}`);
      });

      socket.on("leave-event-room", (eventId) => {
        socket.leave(`event-${eventId}`);
        console.log(`Client ${socket.id} left room: event-${eventId}`);
      });

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.IO not initialized. Call initializeSocket first.");
    }
    return io;
  },

  emitOrderStatusUpdate: (orderId, orderData) => {
    if (!io) return;

    io.to(`order-${orderId}`).emit("order-status-update", {
      orderId,
      ...orderData,
      timestamp: new Date()
    });

    console.log(`Order status update emitted for order: ${orderId}`);
  },

  emitBetOrderUpdate: (userId, orderData) => {
    if (!io) return;
    io.to(`order-${orderData._id}`).emit("bet-order-update", {
      ...orderData,
      timestamp: new Date()
    });
    console.log(`[Socket] Bet Order Update emitted to order-${orderData._id}: Status ${orderData.status}`);
  },

  emitBetEventUpdate: (eventId, eventData) => {
    if (!io) return;
    io.to(`event-${eventId}`).emit("bet-event-update", {
      eventId,
      ...eventData,
      timestamp: new Date()
    });
    console.log(`[Socket] Bet Event Update emitted to event-${eventId}:`, eventData);
  }
};

export const { initializeSocket, getIO, emitOrderStatusUpdate, emitBetOrderUpdate, emitBetEventUpdate } = socketExports;
export default socketExports;


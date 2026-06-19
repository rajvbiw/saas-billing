const { Server } = require('socket.io');

let io = null;

/**
 * Initializes the Socket.io server.
 * Can be attached to the main Express HTTP server or run on a separate port.
 * 
 * @param {Object} server - HTTP Server instance
 */
function initSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Bind to frontend domains dynamically in production
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connection established: ${socket.id}`);

    // Standard tenant routing subscription room
    socket.on('join_tenant', (tenantId) => {
      const room = `tenant_${tenantId}`;
      socket.join(room);
      console.log(`Client ${socket.id} joined room ${room}`);
      socket.emit('joined', { room });
    });

    // Superadmin notification room
    socket.on('join_superadmin', () => {
      socket.join('superadmin');
      console.log(`Client ${socket.id} joined superadmin room`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket connection terminated: ${socket.id}`);
    });
  });

  return io;
}

function getIo() {
  return io;
}

/**
 * Emits an event to all clients joined to a tenant's room.
 * 
 * @param {number|string} tenantId 
 * @param {string} eventName 
 * @param {Object} data 
 */
function emitTenantEvent(tenantId, eventName, data) {
  if (io) {
    const room = `tenant_${tenantId}`;
    io.to(room).emit(eventName, data);
  }
}

/**
 * Emits an event to all superadmins.
 * 
 * @param {string} eventName 
 * @param {Object} data 
 */
function emitSuperadminEvent(eventName, data) {
  if (io) {
    io.to('superadmin').emit(eventName, data);
  }
}

module.exports = {
  initSocketServer,
  getIo,
  emitTenantEvent,
  emitSuperadminEvent
};

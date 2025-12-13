const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { logger } = require('../utils/logger');

/**
 * Socket.IO Real-Time Event Handler
 * Implements geo-filtered broadcasting and connection management
 */

// In-memory storage for active connections
// Format: { socketId: { userId, location: {lat, lng}, connectedAt, lastPing } }
const activeConnections = new Map();

// User to socket mapping for quick lookups
// Format: { odataModel: Set<socketId> }
const userSockets = new Map();

// Zone-based user counts
// Format: { zoneId: count }
const zoneCounts = new Map();

/**
 * Calculate zone ID from coordinates (grid-based)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Zone identifier
 */
const getZoneId = (lat, lng) => {
  const gridSize = 0.1; // ~11km grid cells
  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLng = Math.floor(lng / gridSize) * gridSize;
  return `zone:${gridLat.toFixed(1)}:${gridLng.toFixed(1)}`;
};

/**
 * Calculate distance between two points (Haversine formula)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get socket IDs of users within radius of a location
 */
const getSocketsInRadius = (lat, lng, radiusKm = 10) => {
  const socketIds = [];
  
  activeConnections.forEach((conn, socketId) => {
    if (conn.location) {
      const distance = calculateDistance(lat, lng, conn.location.lat, conn.location.lng);
      if (distance <= radiusKm) {
        socketIds.push(socketId);
      }
    }
  });
  
  return socketIds;
};

/**
 * Get users count in polygon
 */
const countUsersInPolygon = (polygon) => {
  let count = 0;
  
  activeConnections.forEach((conn) => {
    if (conn.location && isPointInPolygon(conn.location, polygon)) {
      count++;
    }
  });
  
  return count;
};

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
const isPointInPolygon = (point, polygon) => {
  const { lat, lng } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  
  return inside;
};

/**
 * Main Socket.IO Handler
 */
const socketHandler = (io) => {
  // Cleanup interval - remove stale connections every 5 minutes
  // Store interval ID on io object for cleanup in tests
  io._cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleThreshold = 60 * 60 * 1000; // 1 hour
    const updateThreshold = 5 * 60 * 1000; // 5 minutes
    
    activeConnections.forEach(async (conn, socketId) => {
      const timeSinceLastPing = now - conn.lastPing;
      
      // Remove stale connections (inactive > 1 hour)
      if (timeSinceLastPing > staleThreshold) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        cleanupConnection(socketId);
        logger.socket('cleanup', socketId, 'Stale connection removed');
      }
      // Update lastSeen every 5 minutes
      else if (conn.userId && timeSinceLastPing < updateThreshold) {
        try {
          await User.findByIdAndUpdate(conn.userId, { lastSeen: new Date() });
        } catch (error) {
          logger.error('Error updating lastSeen', error);
        }
      }
    });
  }, 5 * 60 * 1000); // Run every 5 minutes

  /**
   * Authentication middleware
   */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive) {
          socket.user = user;
          socket.userId = user._id.toString();
        }
      }

      // Allow connection even without auth (for public alerts)
      next();
    } catch (error) {
      logger.warn(`Socket auth: ${error.message}`);
      next();
    }
  });

  /**
   * Connection handler
   */
  io.on('connection', (socket) => {
    const userInfo = socket.user ? socket.user.email : 'Anonymous';
    logger.socket('connect', socket.id, userInfo);
    // Initialize connection tracking
    activeConnections.set(socket.id, {
      userId: socket.userId || null,
      location: null,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    });

    // Track user sockets
    if (socket.userId) {
      if (!userSockets.has(socket.userId)) {
        userSockets.set(socket.userId, new Set());
      }
      userSockets.get(socket.userId).add(socket.id);
      
      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Join role-based rooms
      if (socket.user?.role) {
        socket.join(`role:${socket.user.role}`);
      }
    }

    // ==========================================
    // CLIENT-SIDE EVENTS (Listen on Backend)
    // ==========================================

    /**
     * @event joinLocation
     * @desc User opens map, broadcasts location
     * @payload {userId, location: {lat, lng}}
     */
    socket.on('joinLocation', async (data) => {
      try {
        const { userId, location } = data;
        const { lat, lng } = location || {};

        if (!lat || !lng) {
          socket.emit('error', { message: 'Invalid location coordinates' });
          return;
        }

        // Update connection data
        const conn = activeConnections.get(socket.id);
        const oldZoneId = conn?.location ? getZoneId(conn.location.lat, conn.location.lng) : null;
        const newZoneId = getZoneId(lat, lng);

        // Update active connection
        activeConnections.set(socket.id, {
          ...conn,
          userId: userId || socket.userId,
          location: { lat, lng },
          lastPing: Date.now(),
        });

        // Join location room
        socket.join(newZoneId);
        socket.currentZone = newZoneId;

        // Leave old zone if different
        if (oldZoneId && oldZoneId !== newZoneId) {
          socket.leave(oldZoneId);
          
          // Update zone counts
          zoneCounts.set(oldZoneId, (zoneCounts.get(oldZoneId) || 1) - 1);
          
          // Emit userCountUpdate for old zone
          io.to(oldZoneId).emit('userCountUpdate', {
            zoneId: oldZoneId,
            count: zoneCounts.get(oldZoneId) || 0,
          });
        }

        // Update new zone count
        zoneCounts.set(newZoneId, (zoneCounts.get(newZoneId) || 0) + 1);

        // Emit userCountUpdate for new zone
        io.to(newZoneId).emit('userCountUpdate', {
          zoneId: newZoneId,
          count: zoneCounts.get(newZoneId),
        });

        // Update user's location in database
        if (socket.userId) {
          await User.findByIdAndUpdate(socket.userId, {
            'location.coordinates': [lng, lat],
            lastSeen: new Date(),
          });

          // Create/update session for population tracking
          await Session.findOneAndUpdate(
            { socketId: socket.id },
            {
              userId: socket.userId,
              socketId: socket.id,
              'location.coordinates': [lng, lat],
              isActive: true,
              lastPing: new Date(),
            },
            { upsert: true, new: true }
          );
        }

        socket.emit('joinedLocation', {
          success: true,
          zoneId: newZoneId,
          userCount: zoneCounts.get(newZoneId),
        });

        console.log(`[Socket] ${socket.id} joined location zone: ${newZoneId}`);
      } catch (error) {
        console.error('[Socket] joinLocation error:', error);
        socket.emit('error', { message: 'Failed to join location' });
      }
    });

    /**
     * @event leaveLocation
     * @desc User closes app
     * @payload {userId}
     */
    socket.on('leaveLocation', async (data) => {
      try {
        const conn = activeConnections.get(socket.id);
        
        if (conn?.location) {
          const zoneId = getZoneId(conn.location.lat, conn.location.lng);
          
          // Leave zone room
          socket.leave(zoneId);
          
          // Update zone count
          zoneCounts.set(zoneId, Math.max(0, (zoneCounts.get(zoneId) || 1) - 1));
          
          // Emit userCountUpdate
          io.to(zoneId).emit('userCountUpdate', {
            zoneId,
            count: zoneCounts.get(zoneId),
          });

          // Clear location from connection
          activeConnections.set(socket.id, {
            ...conn,
            location: null,
          });
        }

        // Update session
        if (socket.userId) {
          await Session.findOneAndUpdate(
            { socketId: socket.id },
            { isActive: false, disconnectedAt: new Date() }
          );
        }

        socket.emit('leftLocation', { success: true });
        console.log(`[Socket] ${socket.id} left location`);
      } catch (error) {
        console.error('[Socket] leaveLocation error:', error);
      }
    });

    /**
     * @event requestPopulation
     * @desc Alert role requests population count in polygon
     * @payload {polygon: [[lng, lat], ...]}
     */
    socket.on('requestPopulation', async (data) => {
      try {
        // Check authorization (alert role only)
        if (!socket.user || !['alert', 'admin', 'super_admin', 'responder'].includes(socket.user.role)) {
          socket.emit('error', { message: 'Unauthorized: Alert role required' });
          return;
        }

        const { polygon } = data;

        if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
          socket.emit('error', { message: 'Invalid polygon: Must have at least 3 coordinates' });
          return;
        }

        // Count from in-memory connections (real-time)
        const realtimeCount = countUsersInPolygon(polygon);

        // Count from database sessions (more accurate)
        let dbCount = 0;
        try {
          dbCount = await Session.countDocuments({
            isActive: true,
            'location.coordinates': {
              $geoWithin: {
                $polygon: polygon,
              },
            },
          });
        } catch (dbError) {
          console.error('Database population query error:', dbError);
        }

        socket.emit('populationCount', {
          polygon,
          realtimeCount,
          dbCount,
          estimatedCount: Math.max(realtimeCount, dbCount),
          timestamp: new Date(),
        });

        console.log(`[Socket] Population request from ${socket.id}: ${Math.max(realtimeCount, dbCount)} users`);
      } catch (error) {
        console.error('[Socket] requestPopulation error:', error);
        socket.emit('error', { message: 'Failed to get population count' });
      }
    });

    /**
     * @event ping - Keep connection alive
     */
    socket.on('ping', () => {
      const conn = activeConnections.get(socket.id);
      if (conn) {
        activeConnections.set(socket.id, {
          ...conn,
          lastPing: Date.now(),
        });
      }
      socket.emit('pong', { timestamp: Date.now() });
    });

    /**
     * @event subscribeAlerts - Subscribe to alert types
     */
    socket.on('subscribeAlerts', (data) => {
      const { types = [] } = data;
      types.forEach((type) => socket.join(`alertType:${type}`));
      socket.emit('subscribedAlerts', { types });
    });

    /**
     * @event joinReport - Join report room for updates
     */
    socket.on('joinReport', (data) => {
      const { reportId } = data;
      if (reportId) {
        socket.join(`report:${reportId}`);
      }
    });

    /**
     * @event leaveReport - Leave report room
     */
    socket.on('leaveReport', (data) => {
      const { reportId } = data;
      if (reportId) {
        socket.leave(`report:${reportId}`);
      }
    });

    /**
     * @event emergencySOS - Emergency help request
     */
    socket.on('emergencySOS', async (data) => {
      if (socket.userId) {
        const { lat, lng, message } = data;
        
        const sosData = {
          userId: socket.userId,
          user: socket.user ? {
            name: `${socket.user.firstName} ${socket.user.lastName}`,
            phone: socket.user.phone,
          } : null,
          location: lat && lng ? { lat, lng } : null,
          message,
          timestamp: new Date(),
        };

        // Broadcast to responders and admins
        io.to('role:admin').to('role:super_admin').to('role:responder').emit('emergencySOS', sosData);
        
        socket.emit('sosReceived', { success: true, message: 'Emergency SOS sent' });
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id}, reason: ${reason}`);
      await cleanupConnection(socket.id);
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${socket.id}:`, error);
    });
  });

  /**
   * Cleanup connection data
   */
  async function cleanupConnection(socketId) {
    const conn = activeConnections.get(socketId);
    
    if (conn) {
      // Update zone count
      if (conn.location) {
        const zoneId = getZoneId(conn.location.lat, conn.location.lng);
        zoneCounts.set(zoneId, Math.max(0, (zoneCounts.get(zoneId) || 1) - 1));
        
        io.to(zoneId).emit('userCountUpdate', {
          zoneId,
          count: zoneCounts.get(zoneId),
        });
      }

      // Remove from user sockets
      if (conn.userId && userSockets.has(conn.userId)) {
        userSockets.get(conn.userId).delete(socketId);
        if (userSockets.get(conn.userId).size === 0) {
          userSockets.delete(conn.userId);
        }
      }

      // Update session in database
      if (conn.userId) {
        try {
          await Session.findOneAndUpdate(
            { socketId },
            { isActive: false, disconnectedAt: new Date() }
          );
        } catch (error) {
          console.error('Session cleanup error:', error);
        }
      }

      activeConnections.delete(socketId);
    }
  }

  // ==========================================
  // SERVER-SIDE EVENTS (Emit from Backend)
  // ==========================================

  /**
   * @event newReport
   * @desc Notify nearby users of new incident (within 10km)
   * @trigger New report created
   */
  io.emitNewReport = (report) => {
    const payload = {
      reportId: report._id,
      location: {
        lat: report.location?.coordinates?.[1],
        lng: report.location?.coordinates?.[0],
      },
      type: report.category || report.incidentType,
      status: report.status,
      title: report.title,
      severity: report.severity,
      createdAt: report.createdAt,
    };

    // Geo-filtered broadcasting - only notify users within 10km
    if (payload.location.lat && payload.location.lng) {
      const nearbySocketIds = getSocketsInRadius(payload.location.lat, payload.location.lng, 10);
      
      nearbySocketIds.forEach((socketId) => {
        io.to(socketId).emit('newReport', payload);
      });

      console.log(`[Socket] newReport emitted to ${nearbySocketIds.length} nearby users`);
    } else {
      // Fallback: emit to all if no location
      io.emit('newReport', payload);
    }
  };

  /**
   * @event reportVerified
   * @desc Update marker color on all clients
   * @trigger Report reaches 3 verifications
   */
  io.emitReportVerified = (report) => {
    const payload = {
      reportId: report._id,
      newStatus: report.status,
      verificationStatus: report.verificationStatus,
      verificationCount: report.verificationCount || report.votes?.up || 0,
    };

    // Emit to report room subscribers
    io.to(`report:${report._id}`).emit('reportVerified', payload);

    // Also emit to nearby users
    if (report.location?.coordinates) {
      const [lng, lat] = report.location.coordinates;
      const nearbySocketIds = getSocketsInRadius(lat, lng, 10);
      nearbySocketIds.forEach((socketId) => {
        io.to(socketId).emit('reportVerified', payload);
      });
    }

    console.log(`[Socket] reportVerified emitted for report: ${report._id}`);
  };

  /**
   * @event officialAlert
   * @desc Push notification to affected users
   * @trigger Alert role creates alert
   */
  io.emitOfficialAlert = async (alert) => {
    const payload = {
      alertId: alert._id,
      message: alert.message || alert.description,
      title: alert.title,
      severity: alert.severity,
      geoFence: alert.geoFence || alert.targetArea,
      createdAt: alert.createdAt,
      expiresAt: alert.expiresAt,
    };

    // Get affected users based on geoFence
    let affectedCount = 0;

    if (alert.targetArea?.coordinates || alert.geoFence?.coordinates) {
      const coords = alert.targetArea?.coordinates || alert.geoFence?.coordinates;
      const radius = alert.targetArea?.radius || 10;

      // For circle-based alerts
      if (Array.isArray(coords) && coords.length === 2) {
        const [lng, lat] = coords;
        const nearbySocketIds = getSocketsInRadius(lat, lng, radius);
        
        nearbySocketIds.forEach((socketId) => {
          io.to(socketId).emit('officialAlert', payload);
        });
        
        affectedCount = nearbySocketIds.length;
      }
      // For polygon-based alerts
      else if (alert.geoFence?.type === 'Polygon') {
        const polygon = alert.geoFence.coordinates[0]; // First ring of polygon
        
        activeConnections.forEach((conn, socketId) => {
          if (conn.location && isPointInPolygon(conn.location, polygon)) {
            io.to(socketId).emit('officialAlert', payload);
            affectedCount++;
          }
        });
      }
    } else {
      // Broadcast to all if no geo-fence
      io.emit('officialAlert', payload);
      affectedCount = activeConnections.size;
    }

    console.log(`[Socket] officialAlert emitted to ${affectedCount} affected users`);
    return affectedCount;
  };

  /**
   * @event reportModerated
   * @desc Update report status on all maps
   * @trigger Admin moderates report
   */
  io.emitReportModerated = (report, action, moderatedBy) => {
    const payload = {
      reportId: report._id,
      action, // 'approve', 'reject', 'flag'
      newStatus: report.status,
      moderatedBy: moderatedBy,
      moderatedAt: new Date(),
    };

    // Emit to report room
    io.to(`report:${report._id}`).emit('reportModerated', payload);

    // Emit to nearby users for map update
    if (report.location?.coordinates) {
      const [lng, lat] = report.location.coordinates;
      const nearbySocketIds = getSocketsInRadius(lat, lng, 10);
      nearbySocketIds.forEach((socketId) => {
        io.to(socketId).emit('reportModerated', payload);
      });
    }

    // Notify admins
    io.to('role:admin').to('role:super_admin').emit('reportModerated', payload);

    console.log(`[Socket] reportModerated emitted for report: ${report._id}, action: ${action}`);
  };

  /**
   * @event userCountUpdate
   * @desc Live population estimate update
   * @trigger User enters/leaves zone
   * Note: This is automatically emitted in joinLocation/leaveLocation handlers
   */
  io.emitUserCountUpdate = (zoneId, count) => {
    io.to(zoneId).emit('userCountUpdate', { zoneId, count });
  };

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================

  /**
   * Notify specific user
   */
  io.notifyUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  /**
   * Notify users with specific role
   */
  io.notifyRole = (role, event, data) => {
    io.to(`role:${role}`).emit(event, data);
  };

  /**
   * Get active connections count
   */
  io.getActiveConnectionsCount = () => activeConnections.size;

  /**
   * Get users in zone count
   */
  io.getZoneCount = (zoneId) => zoneCounts.get(zoneId) || 0;

  /**
   * Broadcast to all users in radius
   */
  io.broadcastToRadius = (lat, lng, radiusKm, event, data) => {
    const nearbySocketIds = getSocketsInRadius(lat, lng, radiusKm);
    nearbySocketIds.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
    return nearbySocketIds.length;
  };

  return io;
};

module.exports = socketHandler;

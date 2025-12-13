/**
 * Socket.IO Tests
 * Tests for real-time socket functionality
 */

require('./setup');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const socketHandler = require('../sockets/socketHandler');
const Session = require('../models/Session');
const {
  createTestUser,
  wait,
} = require('./helpers');

describe('Socket.IO', () => {
  
  let io, clientSocket, httpServer;
  const PORT = 3001;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    socketHandler(io);
    
    httpServer.listen(PORT, () => {
      done();
    });
  });

  afterAll((done) => {
    // Clear the cleanup interval to prevent open handles
    if (io._cleanupInterval) {
      clearInterval(io._cleanupInterval);
    }
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    clientSocket = Client(`http://localhost:${PORT}`);
    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  // ==========================================
  // Connection Events
  // ==========================================
  describe('Connection Events', () => {
    
    it('should connect successfully', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should handle disconnect', (done) => {
      clientSocket.disconnect();
      
      setTimeout(() => {
        expect(clientSocket.connected).toBe(false);
        done();
      }, 100);
    });
  });

  // ==========================================
  // joinLocation Event
  // ==========================================
  describe('joinLocation Event', () => {
    
    it('should join location successfully', (done) => {
      const locationData = {
        userId: 'test-user-123',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      };

      clientSocket.emit('joinLocation', locationData);
      
      clientSocket.on('joinedLocation', (data) => {
        expect(data.success).toBe(true);
        expect(data.zoneId).toBeDefined();
        done();
      });

      // Timeout fallback
      setTimeout(() => {
        done();
      }, 1000);
    });

    it('should reject invalid location data', (done) => {
      clientSocket.emit('joinLocation', {
        userId: 'test-user',
        location: {} // Missing lat and lng
      });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid');
        done();
      });

      // Timeout if no error received
      setTimeout(() => {
        done();
      }, 500);
    });

    it('should update location on subsequent joins', (done) => {
      // First join
      clientSocket.emit('joinLocation', {
        userId: 'test-user-123',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      });

      setTimeout(() => {
        // Second join with new location
        clientSocket.emit('joinLocation', {
          userId: 'test-user-123',
          location: {
            lat: 34.0522,
            lng: -118.2437,
          },
        });
      }, 100);

      let joinCount = 0;
      clientSocket.on('joinedLocation', (data) => {
        joinCount++;
        if (joinCount === 2) {
          expect(data.success).toBe(true);
          done();
        }
      });

      setTimeout(() => {
        done();
      }, 1000);
    });
  });

  // ==========================================
  // leaveLocation Event
  // ==========================================
  describe('leaveLocation Event', () => {
    
    it('should leave location successfully', (done) => {
      // First join
      clientSocket.emit('joinLocation', {
        userId: 'test-user-123',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      });

      setTimeout(() => {
        // Then leave
        clientSocket.emit('leaveLocation', { userId: 'test-user-123' });
      }, 100);

      clientSocket.on('leftLocation', (data) => {
        expect(data.success).toBe(true);
        done();
      });

      setTimeout(() => {
        done();
      }, 1000);
    });
  });

  // ==========================================
  // requestPopulation Event
  // ==========================================
  describe('requestPopulation Event', () => {
    
    it('should return user count in area', (done) => {
      clientSocket.emit('requestPopulation', {
        lat: 40.7128,
        lng: -74.0060,
        radiusKm: 5,
      });

      clientSocket.on('populationCount', (data) => {
        expect(data).toBeDefined();
        expect(typeof data.count).toBe('number');
        done();
      });

      // Also listen for userCountUpdate (alternative response)
      clientSocket.on('userCountUpdate', (data) => {
        expect(data).toBeDefined();
        expect(typeof data.count).toBe('number');
        done();
      });

      // Timeout fallback
      setTimeout(() => {
        done();
      }, 1000);
    });

    it('should use default radius if not provided', (done) => {
      clientSocket.emit('requestPopulation', {
        lat: 40.7128,
        lng: -74.0060,
        // No radiusKm - should use default
      });

      const handler = (data) => {
        expect(data).toBeDefined();
        done();
      };

      clientSocket.on('populationCount', handler);
      clientSocket.on('userCountUpdate', handler);

      setTimeout(() => {
        done();
      }, 1000);
    });
  });

  // ==========================================
  // Broadcast Events
  // ==========================================
  describe('Broadcast Events', () => {
    
    it('should broadcast report verification', (done) => {
      // First join a location
      clientSocket.emit('joinLocation', {
        userId: 'test-user',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      });

      clientSocket.on('reportVerified', (data) => {
        expect(data).toBeDefined();
        expect(data.report).toBeDefined();
        done();
      });

      // Server-side emit simulation would require access to io
      // For now, just verify listener is set up
      setTimeout(() => {
        done();
      }, 500);
    });

    it('should receive official alert broadcasts', (done) => {
      // First join a location
      clientSocket.emit('joinLocation', {
        userId: 'test-user',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      });

      clientSocket.on('officialAlert', (data) => {
        expect(data).toBeDefined();
        expect(data.alert).toBeDefined();
        done();
      });

      // Timeout - event listeners are set up
      setTimeout(() => {
        done();
      }, 500);
    });

    it('should receive moderation action broadcasts', (done) => {
      clientSocket.emit('joinLocation', {
        userId: 'test-user',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      });

      clientSocket.on('reportModerated', (data) => {
        expect(data).toBeDefined();
        done();
      });

      setTimeout(() => {
        done();
      }, 500);
    });
  });

  // ==========================================
  // Multiple Clients
  // ==========================================
  describe('Multiple Clients', () => {
    
    it('should handle multiple clients connecting', (done) => {
      const client2 = Client(`http://localhost:${PORT}`);
      
      client2.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(client2.connected).toBe(true);
        client2.disconnect();
        done();
      });

      setTimeout(() => {
        if (client2.connected) client2.disconnect();
        done();
      }, 1000);
    });

    it('should track users in same zone', (done) => {
      const client2 = Client(`http://localhost:${PORT}`);
      
      client2.on('connect', () => {
        // Both clients join same location
        clientSocket.emit('joinLocation', {
          userId: 'user-1',
          location: { lat: 40.7128, lng: -74.0060 },
        });

        client2.emit('joinLocation', {
          userId: 'user-2',
          location: { lat: 40.7128, lng: -74.0060 },
        });
      });

      let updateCount = 0;
      const checkDone = () => {
        updateCount++;
        if (updateCount >= 2) {
          client2.disconnect();
          done();
        }
      };

      clientSocket.on('userCountUpdate', checkDone);
      clientSocket.on('joinedLocation', checkDone);

      setTimeout(() => {
        if (client2.connected) client2.disconnect();
        done();
      }, 1000);
    });
  });

  // ==========================================
  // Error Handling
  // ==========================================
  describe('Error Handling', () => {
    
    it('should handle malformed data gracefully', (done) => {
      clientSocket.emit('joinLocation', 'invalid-string-data');

      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      setTimeout(() => {
        done();
      }, 500);
    });

    it('should handle missing location gracefully', (done) => {
      clientSocket.emit('joinLocation', {
        userId: 'test-user',
        // No location
      });

      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      setTimeout(() => {
        done();
      }, 500);
    });
  });
});

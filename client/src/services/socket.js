import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentLocation = null;
    this.isConnected = false;
  }

  // Initialize socket connection
  connect(token = null) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    this.socket = io(socketUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupDefaultListeners();

    return this.socket;
  }

  // Setup default event listeners
  setupDefaultListeners() {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;

      // Rejoin location room if we had one
      if (this.currentLocation) {
        this.joinLocation(this.currentLocation.lat, this.currentLocation.lng);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentLocation = null;
    }
  }

  // Join a location-based room
  joinLocation(lat, lng) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot join location');
      return;
    }

    this.currentLocation = { lat, lng };
    this.socket.emit('joinLocation', { lat, lng });
  }

  // Leave current location room
  leaveLocation() {
    if (!this.socket?.connected) {
      return;
    }

    if (this.currentLocation) {
      this.socket.emit('leaveLocation', this.currentLocation);
      this.currentLocation = null;
    }
  }

  // Subscribe to new reports
  onNewReport(callback) {
    return this.on('newReport', callback);
  }

  // Subscribe to new alerts
  onNewAlert(callback) {
    return this.on('newAlert', callback);
  }

  // Subscribe to report updates
  onReportUpdated(callback) {
    return this.on('reportUpdated', callback);
  }

  // Subscribe to report verification updates
  onReportVerified(callback) {
    return this.on('reportVerified', callback);
  }

  // Subscribe to alert updates
  onAlertUpdated(callback) {
    return this.on('alertUpdated', callback);
  }

  // Subscribe to alert cancellations
  onAlertCancelled(callback) {
    return this.on('alertCancelled', callback);
  }

  // Subscribe to alert resolutions
  onAlertResolved(callback) {
    return this.on('alertResolved', callback);
  }

  // Subscribe to population updates
  onPopulationUpdate(callback) {
    return this.on('populationUpdate', callback);
  }

  // Generic event subscription
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return () => {};
    }

    this.socket.on(event, callback);

    // Track listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  // Remove event listener
  off(event, callback) {
    if (!this.socket) return;

    this.socket.off(event, callback);

    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Emit event
  emit(event, data) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot emit:', event);
      return;
    }

    this.socket.emit(event, data);
  }

  // Get connection status
  get connected() {
    return this.socket?.connected || false;
  }

  // Get socket ID
  get id() {
    return this.socket?.id || null;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;

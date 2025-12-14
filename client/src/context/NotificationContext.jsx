import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { useLocation as useGeoLocation } from './LocationContext';
import {
  requestNotificationPermission,
  showAlertNotification,
  showReportNotification,
  getNotificationPermission,
  playAlertSound,
  vibrateDevice,
} from '../utils/notificationHelper';

const NotificationContext = createContext(null);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const navigate = useNavigate();
  const { location: userLocation } = useGeoLocation();
  const [permission, setPermission] = useState(getNotificationPermission());
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem('notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const initializedRef = useRef(false);

  // Join location room when location is available
  useEffect(() => {
    if (userLocation && isConnected) {
      console.log('[Notifications] Joining location room:', userLocation.latitude, userLocation.longitude);
      socketService.joinLocation(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, isConnected]);

  // Periodically check socket connection and rejoin location if needed
  useEffect(() => {
    const interval = setInterval(() => {
      const currentlyConnected = socketService.connected;
      if (currentlyConnected !== isConnected) {
        setIsConnected(currentlyConnected);
      }
      // Rejoin location room if connected but location not joined
      if (currentlyConnected && userLocation && !socketService.currentLocation) {
        console.log('[Notifications] Rejoining location room after reconnect');
        socketService.joinLocation(userLocation.latitude, userLocation.longitude);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [userLocation, isConnected]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50)));
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  // Handle alert notification click
  const handleAlertClick = useCallback(
    (alert) => {
      window.focus();
      if (alert?.location?.coordinates) {
        const [lng, lat] = alert.location.coordinates;
        navigate(`/map?lat=${lat}&lng=${lng}&alertId=${alert._id}`);
      } else {
        navigate(`/alerts/${alert._id}`);
      }
    },
    [navigate]
  );

  // Handle report notification click
  const handleReportClick = useCallback(
    (report) => {
      window.focus();
      if (report?.location?.coordinates) {
        const [lng, lat] = report.location.coordinates;
        navigate(`/map?lat=${lat}&lng=${lng}&reportId=${report._id}`);
      } else {
        navigate(`/map`);
      }
    },
    [navigate]
  );

  // Show browser notification for official alert
  const showBrowserAlert = useCallback(
    (alert) => {
      if (permission !== 'granted') return null;

      if (alert.severity === 'critical' || alert.severity === 'high') {
        playAlertSound(alert.severity === 'critical' ? 'critical' : 'alert');
      }

      vibrateDevice(alert.severity === 'critical' ? [500, 200, 500, 200, 500] : [200, 100, 200]);

      const notification = showAlertNotification(alert);
      if (notification) {
        notification.onclick = () => handleAlertClick(alert);
      }
      return notification;
    },
    [permission, handleAlertClick]
  );

  // Add notification to local state
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => {
      // Prevent duplicates
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev.slice(0, 49)];
    });
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Remove single notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  // Setup Socket.IO event listeners
  useEffect(() => {
    // Show welcome notification if no notifications exist (only once)
    if (!initializedRef.current && notifications.length === 0) {
      initializedRef.current = true;
      addNotification({
        id: 'welcome',
        type: 'info',
        title: '👋 Welcome to QuickAlert!',
        message: 'You\'ll receive notifications about alerts and verified reports in your area.',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    // Auto request permission
    if (permission === 'default') {
      requestPermission();
    }

    // Connect to socket (socketService handles singleton pattern)
    const token = localStorage.getItem('token');
    const socket = socketService.connect(token);

    // Track connection status
    const handleConnect = () => {
      console.log('[Notifications] Socket connected');
      setIsConnected(true);
    };
    const handleDisconnect = () => {
      console.log('[Notifications] Socket disconnected');
      setIsConnected(false);
    };

    // Set initial connected state
    setIsConnected(socketService.connected);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Subscribe to official alerts
    const unsubscribeAlert = socketService.onNewAlert((alert) => {
      console.log('[Notifications] New alert received:', alert);
      showBrowserAlert(alert);

      addNotification({
        id: `alert-${alert._id}`,
        type: 'alert',
        title: alert.title,
        message: alert.description?.substring(0, 100),
        severity: alert.severity,
        data: alert,
        timestamp: new Date().toISOString(),
        read: false,
      });
    });

    // Subscribe to new reports
    const unsubscribeReport = socketService.onNewReport((report) => {
      console.log('[Notifications] New report received:', report);
      
      if (permission === 'granted') {
        const notification = showReportNotification(report);
        if (notification) {
          notification.onclick = () => handleReportClick(report);
        }
      }

      addNotification({
        id: `report-${report._id}`,
        type: 'report',
        title: report.title || 'New Report',
        message: report.description?.substring(0, 100) || `${report.category} incident reported nearby`,
        category: report.category,
        data: report,
        timestamp: new Date().toISOString(),
        read: false,
      });
    });

    // Subscribe to report verification
    const unsubscribeVerified = socketService.onReportVerified((data) => {
      console.log('[Notifications] Report verified:', data);
      
      const title = data.title || 'Nearby Incident';
      const category = data.category ? `[${data.category.toUpperCase()}] ` : '';

      addNotification({
        id: `verified-${data.reportId}`,
        type: 'verification',
        title: '⚠️ Verified Report Nearby',
        message: `${category}${title} - Confirmed by ${data.verificationCount} users`,
        data,
        timestamp: new Date().toISOString(),
        read: false,
      });

      // Browser notification
      if (Notification.permission === 'granted') {
        try {
          new Notification('⚠️ Verified Report Nearby', {
            body: `${category}${title}`,
            icon: '/favicon.ico',
            tag: `verified-${data.reportId}`,
          });
        } catch (e) {
          console.error('Browser notification error:', e);
        }
      }
    });

    // Subscribe to alert cancellations
    const unsubscribeCancelled = socketService.onAlertCancelled((data) => {
      console.log('[Notifications] Alert cancelled:', data);
      
      addNotification({
        id: `cancelled-${data.alertId}`,
        type: 'alert_cancelled',
        title: 'Alert Cancelled',
        message: data.reason || 'An alert has been cancelled',
        data,
        timestamp: new Date().toISOString(),
        read: false,
      });
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      unsubscribeAlert();
      unsubscribeReport();
      unsubscribeVerified();
      unsubscribeCancelled();
    };
  }, [permission, requestPermission, showBrowserAlert, addNotification, handleReportClick]);

  const value = {
    notifications,
    unreadCount,
    permission,
    isConnected,
    requestPermission,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification,
    // Debug helper to add test notification
    addTestNotification: () => {
      addNotification({
        id: `test-${Date.now()}`,
        type: 'verification',
        title: '🧪 Test Notification',
        message: 'This is a test notification to verify the system is working.',
        timestamp: new Date().toISOString(),
        read: false,
      });
    },
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;

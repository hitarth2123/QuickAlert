import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import {
  requestNotificationPermission,
  showAlertNotification,
  showReportNotification,
  getNotificationPermission,
  isNotificationSupported,
  playAlertSound,
  vibrateDevice,
} from '../utils/notificationHelper';

/**
 * useNotifications hook
 * Manages browser notifications, Socket.IO event subscriptions,
 * and notification permissions for real-time alerts
 */
const useNotifications = (options = {}) => {
  const {
    enableAlerts = true,
    enableReports = false,
    autoRequestPermission = true,
    playSound = true,
    vibrate = true,
  } = options;

  const navigate = useNavigate();
  const [permission, setPermission] = useState(getNotificationPermission());
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const unsubscribersRef = useRef([]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  // Handle alert notification click - focus map on alert location
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

      // Play sound for critical/high alerts
      if (playSound && (alert.severity === 'critical' || alert.severity === 'high')) {
        playAlertSound(alert.severity === 'critical' ? 'critical' : 'alert');
      }

      // Vibrate device
      if (vibrate) {
        vibrateDevice(alert.severity === 'critical' ? [500, 200, 500, 200, 500] : [200, 100, 200]);
      }

      const notification = showAlertNotification(alert);
      if (notification) {
        notification.onclick = () => handleAlertClick(alert);
      }
      return notification;
    },
    [permission, playSound, vibrate, handleAlertClick]
  );

  // Add notification to local state
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev.slice(0, 49)]); // Keep last 50
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Setup Socket.IO event listeners
  useEffect(() => {
    // Auto request permission on first load
    if (autoRequestPermission && permission === 'default') {
      requestPermission();
    }

    // Connect to socket if not already
    const token = localStorage.getItem('token');
    const socket = socketService.connect(token);

    // Track connection status
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Set initial connection status
    setIsConnected(socketService.connected);

    // Subscribe to official alerts
    if (enableAlerts) {
      const unsubscribeAlert = socketService.onNewAlert((alert) => {
        // Show browser notification
        showBrowserAlert(alert);

        // Add to notification list
        addNotification({
          id: alert._id,
          type: 'alert',
          title: alert.title,
          message: alert.description?.substring(0, 100),
          severity: alert.severity,
          data: alert,
          timestamp: new Date(),
          read: false,
        });
      });

      unsubscribersRef.current.push(unsubscribeAlert);
    }

    // Subscribe to new reports (optional)
    if (enableReports) {
      const unsubscribeReport = socketService.onNewReport((report) => {
        if (permission === 'granted') {
          const notification = showReportNotification(report);
          if (notification) {
            notification.onclick = () => handleReportClick(report);
          }
        }

        addNotification({
          id: report._id,
          type: 'report',
          title: report.title,
          message: report.description?.substring(0, 100),
          category: report.category,
          data: report,
          timestamp: new Date(),
          read: false,
        });
      });

      unsubscribersRef.current.push(unsubscribeReport);
    }

    // Subscribe to report verification
    const unsubscribeVerified = socketService.onReportVerified((data) => {
      addNotification({
        id: `verified-${data.reportId}`,
        type: 'verification',
        title: 'Report Verified',
        message: `A report has been verified by ${data.verificationCount} users`,
        data,
        timestamp: new Date(),
        read: false,
      });
    });

    unsubscribersRef.current.push(unsubscribeVerified);

    // Subscribe to alert cancellations
    const unsubscribeCancelled = socketService.onAlertCancelled((data) => {
      addNotification({
        id: `cancelled-${data.alertId}`,
        type: 'alert_cancelled',
        title: 'Alert Cancelled',
        message: data.reason || 'An alert has been cancelled',
        data,
        timestamp: new Date(),
        read: false,
      });
    });

    unsubscribersRef.current.push(unsubscribeCancelled);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);

      unsubscribersRef.current.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      unsubscribersRef.current = [];
    };
  }, [
    enableAlerts,
    enableReports,
    autoRequestPermission,
    permission,
    requestPermission,
    showBrowserAlert,
    addNotification,
    handleReportClick,
  ]);

  return {
    // Permission state
    permission,
    isSupported: isNotificationSupported(),
    requestPermission,

    // Connection state
    isConnected,

    // Notifications list
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,

    // Manual notification triggers
    showBrowserAlert,
  };
};

export default useNotifications;

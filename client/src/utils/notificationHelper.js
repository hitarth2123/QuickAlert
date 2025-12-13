// Push notification utilities

// Check if notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Check notification permission status
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return 'denied';
};

// Show a notification
export const showNotification = (title, options = {}) => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const defaultOptions = {
    icon: '/logo.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
  };

  const notification = new Notification(title, { ...defaultOptions, ...options });

  // Handle notification click
  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();

    if (options.onClick) {
      options.onClick(event);
    }

    // Navigate to URL if provided
    if (options.url) {
      window.location.href = options.url;
    }

    notification.close();
  };

  // Auto close after timeout
  if (options.timeout) {
    setTimeout(() => notification.close(), options.timeout);
  }

  return notification;
};

// Show alert notification with high priority
export const showAlertNotification = (alert) => {
  const severityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: '📢',
    low: 'ℹ️',
  };

  const title = `${severityEmoji[alert.severity] || '📢'} ${alert.title}`;
  
  return showNotification(title, {
    body: alert.description?.substring(0, 200) || 'New emergency alert in your area',
    tag: `alert-${alert._id}`,
    requireInteraction: alert.severity === 'critical' || alert.severity === 'high',
    url: `/alerts/${alert._id}`,
    data: { type: 'alert', id: alert._id },
  });
};

// Show report notification
export const showReportNotification = (report) => {
  const categoryEmoji = {
    accident: '🚗',
    fire: '🔥',
    crime: '🚨',
    medical: '🏥',
    natural_disaster: '🌊',
    infrastructure: '🏗️',
    traffic: '🚦',
    weather: '🌧️',
    other: '📋',
  };

  const title = `${categoryEmoji[report.category] || '📋'} New ${report.category} Report`;
  
  return showNotification(title, {
    body: report.title?.substring(0, 200) || 'New incident reported nearby',
    tag: `report-${report._id}`,
    url: `/reports/${report._id}`,
    data: { type: 'report', id: report._id },
    timeout: 10000,
  });
};

// Request permission and show test notification
export const testNotification = async () => {
  const permission = await requestNotificationPermission();

  if (permission === 'granted') {
    showNotification('QuickAlert Test', {
      body: 'Notifications are working correctly!',
      timeout: 5000,
    });
    return true;
  }

  return false;
};

// Create notification channel for Service Worker (for future PWA support)
export const setupNotificationChannel = () => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    // This would be used for actual push notifications
    // Requires server-side implementation
    console.log('Push notifications could be enabled');
  }
};

// Schedule a local notification (using setTimeout, not actual scheduling API)
export const scheduleNotification = (title, options, delayMs) => {
  return setTimeout(() => {
    showNotification(title, options);
  }, delayMs);
};

// Cancel scheduled notification
export const cancelScheduledNotification = (timeoutId) => {
  clearTimeout(timeoutId);
};

// Play alert sound
export const playAlertSound = (type = 'alert') => {
  const sounds = {
    alert: '/sounds/alert.mp3',
    notification: '/sounds/notification.mp3',
    critical: '/sounds/critical.mp3',
  };

  const audio = new Audio(sounds[type] || sounds.notification);
  audio.volume = 0.5;
  
  return audio.play().catch((error) => {
    console.warn('Could not play alert sound:', error);
  });
};

// Vibrate device (if supported)
export const vibrateDevice = (pattern = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
  showAlertNotification,
  showReportNotification,
  testNotification,
  setupNotificationChannel,
  scheduleNotification,
  cancelScheduledNotification,
  playAlertSound,
  vibrateDevice,
};

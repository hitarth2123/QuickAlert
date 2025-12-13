import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Notification types with their styles
const notificationStyles = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-400',
    icon: '✓',
    iconBg: 'bg-green-500',
    text: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    icon: '✕',
    iconBg: 'bg-red-500',
    text: 'text-red-800',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    icon: '⚠',
    iconBg: 'bg-yellow-500',
    text: 'text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    icon: 'ℹ',
    iconBg: 'bg-blue-500',
    text: 'text-blue-800',
  },
  alert: {
    bg: 'bg-red-100',
    border: 'border-red-600',
    icon: '🚨',
    iconBg: 'bg-red-600',
    text: 'text-red-900',
  },
};

// Single notification component
const NotificationItem = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const style = notificationStyles[notification.type] || notificationStyles.info;

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300);
  };

  return (
    <div
      className={`${style.bg} ${style.border} border-l-4 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      role="alert"
    >
      <div className="flex items-start">
        <div className={`${style.iconBg} rounded-full p-1 mr-3 flex-shrink-0`}>
          <span className="text-white text-sm w-5 h-5 flex items-center justify-center">
            {style.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className={`font-semibold ${style.text}`}>{notification.title}</p>
          )}
          <p className={`text-sm ${style.text}`}>{notification.message}</p>
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`mt-2 text-sm font-medium underline ${style.text} hover:opacity-80`}
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className={`ml-4 ${style.text} hover:opacity-70 flex-shrink-0`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Notification container component
const NotificationContainer = ({ notifications, removeNotification, position = 'top-right' }) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return createPortal(
    <div className={`fixed ${positionClasses[position]} z-50 w-full max-w-sm space-y-2`}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>,
    document.body
  );
};

// Notification hook for managing notifications
let notificationId = 0;
let notificationListeners = [];

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const listener = (notification) => {
      setNotifications((prev) => [...prev, notification]);
    };

    notificationListeners.push(listener);

    return () => {
      notificationListeners = notificationListeners.filter((l) => l !== listener);
    };
  }, []);

  const addNotification = useCallback((notification) => {
    const id = ++notificationId;
    const newNotification = {
      id,
      duration: 5000,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  };
};

// Global notification function (can be called from anywhere)
export const notify = {
  show: (notification) => {
    const id = ++notificationId;
    const newNotification = {
      id,
      duration: 5000,
      type: 'info',
      ...notification,
    };
    notificationListeners.forEach((listener) => listener(newNotification));
    return id;
  },
  success: (message, title) => notify.show({ type: 'success', message, title }),
  error: (message, title) => notify.show({ type: 'error', message, title }),
  warning: (message, title) => notify.show({ type: 'warning', message, title }),
  info: (message, title) => notify.show({ type: 'info', message, title }),
  alert: (message, title) => notify.show({ type: 'alert', message, title, duration: 0 }),
};

// Main Notification component to be rendered in App
const Notification = ({ position = 'top-right' }) => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <NotificationContainer
      notifications={notifications}
      removeNotification={removeNotification}
      position={position}
    />
  );
};

export default Notification;

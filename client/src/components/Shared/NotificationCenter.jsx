import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,
    permission,
    requestPermission,
    isConnected,
  } = useNotifications({
    enableAlerts: true,
    enableReports: true,
    autoRequestPermission: false,
  });

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'alert':
        return '🚨';
      case 'report':
        return '📝';
      case 'verification':
        return '✅';
      case 'alert_cancelled':
        return '❌';
      default:
        return '🔔';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Connection indicator */}
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50 rounded-t-xl">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Permission request */}
          {permission !== 'granted' && (
            <div className="px-4 py-3 bg-yellow-50 border-b">
              <p className="text-sm text-yellow-800">
                Enable notifications to receive real-time alerts
              </p>
              <button
                onClick={requestPermission}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700"
              >
                Enable Notifications
              </button>
            </div>
          )}

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1 max-h-96">
            {notifications.length > 0 ? (
              <div className="divide-y">
                {notifications.map((notification, index) => (
                  <Link
                    key={notification.id || index}
                    to={
                      notification.type === 'alert'
                        ? `/alerts/${notification.data?._id}`
                        : notification.type === 'report'
                        ? `/map?reportId=${notification.data?._id}`
                        : '/map'
                    }
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
                          notification.type === 'alert'
                            ? getSeverityColor(notification.severity)
                            : notification.type === 'report'
                            ? 'bg-blue-500'
                            : 'bg-gray-500'
                        }`}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 line-clamp-1">
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <span className="text-4xl">🔔</span>
                <p className="text-gray-500 mt-2">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  You'll see alerts and updates here
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t bg-gray-50 rounded-b-xl">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                {isConnected ? 'Live updates active' : 'Reconnecting...'}
              </span>
              <Link
                to="/settings/notifications"
                onClick={() => setIsOpen(false)}
                className="text-red-600 hover:text-red-700"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

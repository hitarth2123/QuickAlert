import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationContext } from '../context/NotificationContext';
import socketService from '../services/socket';
import { useLocation as useGeoLocation } from '../context/LocationContext';

const NotificationSettingsPage = () => {
  const { permission, requestPermission, isConnected, addNotification } = useNotificationContext();
  const { location: userLocation } = useGeoLocation();
  
  // Load settings from localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      return saved ? JSON.parse(saved) : {
        enableAlerts: true,
        enableReports: true,
        enableVerifications: true,
        playSound: true,
        vibrate: true,
        showBrowserNotifications: true,
      };
    } catch {
      return {
        enableAlerts: true,
        enableReports: true,
        enableVerifications: true,
        playSound: true,
        vibrate: true,
        showBrowserNotifications: true,
      };
    }
  });

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const SettingToggle = ({ label, description, settingKey, value }) => (
    <div className="flex items-center justify-between py-4">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => updateSetting(settingKey, !value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-red-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/notifications" className="hover:text-gray-700">Notifications</Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-500 mt-1">Manage how you receive notifications</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Connection Status</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
            {isConnected ? 'Connected to real-time updates' : 'Disconnected - notifications may be delayed'}
          </span>
        </div>
        
        {/* Debug Info */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg mb-4">
          <p><strong>Socket ID:</strong> {socketService.id || 'Not connected'}</p>
          <p><strong>Location:</strong> {userLocation ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}` : 'Not available'}</p>
          <p><strong>Location Room:</strong> {socketService.currentLocation ? `Joined (${socketService.currentLocation.lat.toFixed(4)}, ${socketService.currentLocation.lng.toFixed(4)})` : 'Not joined'}</p>
        </div>

        {/* Test Notification Button */}
        <button
          onClick={() => {
            addNotification({
              id: `test-${Date.now()}`,
              type: 'verification',
              title: '⚠️ Test Verified Report',
              message: 'This is a test notification to verify the system is working',
              timestamp: new Date().toISOString(),
              read: false,
            });
            if (Notification.permission === 'granted') {
              new Notification('⚠️ Test Notification', {
                body: 'Test notification from QuickAlert',
                icon: '/favicon.ico',
              });
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Send Test Notification
        </button>
      </div>

      {/* Browser Permission */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Browser Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-700">Permission Status</p>
            <p className="text-sm text-gray-500">
              {permission === 'granted' 
                ? 'Browser notifications are enabled'
                : permission === 'denied'
                ? 'Browser notifications are blocked'
                : 'Browser notifications not yet requested'}
            </p>
          </div>
          {permission === 'granted' ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ✓ Enabled
            </span>
          ) : permission === 'denied' ? (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              ✗ Blocked
            </span>
          ) : (
            <button
              onClick={requestPermission}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Enable Notifications
            </button>
          )}
        </div>
        {permission === 'denied' && (
          <p className="mt-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            ⚠️ Notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications for this site.
          </p>
        )}
      </div>

      {/* Notification Types */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Notification Types</h2>
        <p className="text-sm text-gray-500 mb-4">Choose which notifications you want to receive</p>
        
        <div className="divide-y">
          <SettingToggle
            label="🚨 Emergency Alerts"
            description="Official alerts from authorities about emergencies in your area"
            settingKey="enableAlerts"
            value={settings.enableAlerts}
          />
          <SettingToggle
            label="📝 New Reports"
            description="Community reports of incidents near your location"
            settingKey="enableReports"
            value={settings.enableReports}
          />
          <SettingToggle
            label="✅ Verified Reports"
            description="When a report near you gets verified by the community"
            settingKey="enableVerifications"
            value={settings.enableVerifications}
          />
        </div>
      </div>

      {/* Notification Behavior */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Notification Behavior</h2>
        <p className="text-sm text-gray-500 mb-4">Customize how notifications alert you</p>
        
        <div className="divide-y">
          <SettingToggle
            label="🔊 Sound"
            description="Play a sound for high-priority alerts"
            settingKey="playSound"
            value={settings.playSound}
          />
          <SettingToggle
            label="📳 Vibration"
            description="Vibrate device for notifications (mobile only)"
            settingKey="vibrate"
            value={settings.vibrate}
          />
          <SettingToggle
            label="🖥️ Browser Pop-ups"
            description="Show browser notification pop-ups"
            settingKey="showBrowserNotifications"
            value={settings.showBrowserNotifications}
          />
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="font-medium text-blue-900 flex items-center gap-2">
          <span>ℹ️</span>
          How notifications work
        </h3>
        <ul className="mt-3 text-sm text-blue-800 space-y-2">
          <li>• <strong>Emergency Alerts</strong> are created by officials and sent to everyone in the affected area</li>
          <li>• <strong>Verified Reports</strong> are community reports that have been confirmed by 3+ people</li>
          <li>• You'll only receive notifications for incidents within <strong>5km</strong> of your location</li>
          <li>• Make sure to allow location access for accurate notifications</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;

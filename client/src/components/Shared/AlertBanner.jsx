import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import socketService from '../../services/socket';
import { useLocation as useGeoLocation } from '../../context/LocationContext';
import { alertsApi } from '../../services/api';
import { calculateDistance, formatDistance } from '../../utils/geoLocation';

// Severity configurations
const severityConfig = {
  critical: {
    bg: 'bg-red-600',
    border: 'border-red-700',
    text: 'text-white',
    icon: '🚨',
    animate: true,
  },
  high: {
    bg: 'bg-orange-500',
    border: 'border-orange-600',
    text: 'text-white',
    icon: '⚠️',
    animate: true,
  },
  medium: {
    bg: 'bg-yellow-500',
    border: 'border-yellow-600',
    text: 'text-yellow-900',
    icon: '⚡',
    animate: false,
  },
  low: {
    bg: 'bg-blue-500',
    border: 'border-blue-600',
    text: 'text-white',
    icon: 'ℹ️',
    animate: false,
  },
};

// Check if user is within alert's affected area
const isWithinAffectedArea = (userLat, userLng, alert) => {
  if (!alert?.location?.coordinates) return false;
  
  const [alertLng, alertLat] = alert.location.coordinates;
  const distance = calculateDistance(userLat, userLng, alertLat, alertLng);
  
  // Check against affected area radius (default 10km)
  const radius = alert.affectedArea?.radius || 10000;
  return distance <= radius;
};

const AlertBanner = () => {
  const { location: userLocation } = useGeoLocation();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch nearby active alerts on mount
  useEffect(() => {
    const fetchNearbyAlerts = async () => {
      if (!userLocation) return;
      
      try {
        const response = await alertsApi.getNearby(
          userLocation.latitude,
          userLocation.longitude,
          25000 // 25km radius
        );
        
        const alerts = (response.data.data || []).filter(
          (alert) => 
            alert.status === 'active' && 
            isWithinAffectedArea(userLocation.latitude, userLocation.longitude, alert)
        );
        
        setActiveAlerts(alerts);
      } catch (error) {
        console.error('Failed to fetch nearby alerts:', error);
      }
    };
    
    fetchNearbyAlerts();
  }, [userLocation]);

  // Subscribe to real-time alert updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    socketService.connect(token);
    
    // Handle new official alerts
    const unsubscribeNew = socketService.onNewAlert((alert) => {
      if (
        userLocation &&
        alert.status === 'active' &&
        isWithinAffectedArea(userLocation.latitude, userLocation.longitude, alert)
      ) {
        setActiveAlerts((prev) => {
          // Avoid duplicates
          if (prev.some((a) => a._id === alert._id)) return prev;
          return [alert, ...prev];
        });
        
        // Play notification sound for critical/high severity
        if (alert.severity === 'critical' || alert.severity === 'high') {
          playAlertSound();
        }
      }
    });

    // Handle alert cancellations
    const unsubscribeCancelled = socketService.onAlertCancelled(({ alertId }) => {
      setActiveAlerts((prev) => prev.filter((a) => a._id !== alertId));
    });

    // Handle alert resolutions
    const unsubscribeResolved = socketService.onAlertResolved(({ alertId }) => {
      setActiveAlerts((prev) => prev.filter((a) => a._id !== alertId));
    });

    return () => {
      unsubscribeNew();
      unsubscribeCancelled();
      unsubscribeResolved();
    };
  }, [userLocation]);

  // Cycle through alerts if multiple are active
  useEffect(() => {
    if (activeAlerts.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAlertIndex((prev) => (prev + 1) % activeAlerts.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [activeAlerts.length]);

  // Play alert sound
  const playAlertSound = () => {
    try {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Audio autoplay might be blocked
      });
    } catch (e) {
      // Ignore audio errors
    }
  };

  // Dismiss an alert (local only)
  const handleDismiss = useCallback((alertId) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  }, []);

  // Filter out dismissed alerts
  const visibleAlerts = activeAlerts.filter((a) => !dismissedAlerts.has(a._id));
  
  if (visibleAlerts.length === 0) return null;
  
  const currentAlert = visibleAlerts[currentAlertIndex % visibleAlerts.length];
  if (!currentAlert) return null;
  
  const config = severityConfig[currentAlert.severity] || severityConfig.medium;
  
  // Calculate distance to alert
  let distanceText = '';
  if (userLocation && currentAlert.location?.coordinates) {
    const [alertLng, alertLat] = currentAlert.location.coordinates;
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      alertLat,
      alertLng
    );
    distanceText = formatDistance(distance);
  }

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-40 ${config.bg} ${config.border} border-b-2 shadow-lg ${
        config.animate ? 'animate-pulse' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Alert icon */}
            <span className="text-2xl flex-shrink-0">{config.icon}</span>
            
            {/* Alert content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${config.text} uppercase text-sm`}>
                  {currentAlert.severity} Alert
                </span>
                {currentAlert.metadata?.communityVerified && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-200 text-purple-900">
                    👥 Community Verified
                  </span>
                )}
                {visibleAlerts.length > 1 && (
                  <span className={`text-xs ${config.text} opacity-75`}>
                    ({currentAlertIndex + 1}/{visibleAlerts.length})
                  </span>
                )}
              </div>
              <h3 className={`font-semibold ${config.text} truncate`}>
                {currentAlert.title}
              </h3>
              {isExpanded && currentAlert.description && (
                <p className={`text-sm ${config.text} opacity-90 mt-1`}>
                  {currentAlert.description}
                </p>
              )}
              {isExpanded && currentAlert.instructions?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {currentAlert.instructions.slice(0, 3).map((inst, i) => (
                    <p key={i} className={`text-sm ${config.text} opacity-90`}>
                      • {inst.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
            
            {/* Distance */}
            {distanceText && (
              <span className={`text-sm ${config.text} opacity-75 flex-shrink-0`}>
                📍 {distanceText} away
              </span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1.5 rounded ${config.text} hover:bg-black/10 transition-colors`}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <Link
              to={`/map?alert=${currentAlert._id}`}
              className={`px-3 py-1.5 rounded ${config.text} bg-black/20 hover:bg-black/30 text-sm font-medium transition-colors`}
            >
              View Map
            </Link>
            
            <button
              onClick={() => handleDismiss(currentAlert._id)}
              className={`p-1.5 rounded ${config.text} hover:bg-black/10 transition-colors`}
              title="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Navigation dots for multiple alerts */}
        {visibleAlerts.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {visibleAlerts.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentAlertIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentAlertIndex % visibleAlerts.length
                    ? 'bg-white'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;

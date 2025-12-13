import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getCurrentPosition, watchPosition, clearWatch } from '../utils/geoLocation';

const LocationContext = createContext(null);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const { isAuthenticated, updateLocation } = useAuth();
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(null);

  // Update interval in milliseconds (30 seconds)
  const UPDATE_INTERVAL = 30000;

  // Get current position once
  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      setLocation(newLocation);

      // Update server if authenticated
      if (isAuthenticated) {
        await updateLocation(newLocation.latitude, newLocation.longitude);
      }

      return newLocation;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, updateLocation]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (watchIdRef.current) return;

    setError(null);
    setWatching(true);

    watchIdRef.current = watchPosition(
      async (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setLocation(newLocation);

        // Throttle server updates
        const now = Date.now();
        if (
          isAuthenticated &&
          (!lastUpdateRef.current || now - lastUpdateRef.current >= UPDATE_INTERVAL)
        ) {
          lastUpdateRef.current = now;
          try {
            await updateLocation(newLocation.latitude, newLocation.longitude);
          } catch (err) {
            console.error('Failed to update server location:', err);
          }
        }
      },
      (err) => {
        setError(err.message);
        console.error('Watch position error:', err);
      }
    );
  }, [isAuthenticated, updateLocation]);

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  // Get initial location on mount and when authentication changes
  useEffect(() => {
    getLocation().catch(() => {
      // Silently fail - user may not have granted permission yet
    });
  }, [isAuthenticated]); // Re-fetch when user logs in

  // Calculate distance from current location to a point
  const distanceTo = useCallback(
    (lat, lng) => {
      if (!location) return null;

      // Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (location.latitude * Math.PI) / 180;
      const φ2 = (lat * Math.PI) / 180;
      const Δφ = ((lat - location.latitude) * Math.PI) / 180;
      const Δλ = ((lng - location.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    },
    [location]
  );

  // Format distance for display
  const formatDistance = useCallback((meters) => {
    if (meters === null) return 'Unknown';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }, []);

  const value = {
    location,
    error,
    loading,
    watching,
    getLocation,
    startWatching,
    stopWatching,
    distanceTo,
    formatDistance,
    hasLocation: !!location,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext;

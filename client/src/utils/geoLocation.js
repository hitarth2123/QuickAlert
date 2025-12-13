// Browser Geolocation API utilities

const defaultOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000, // Cache position for 1 minute
};

// Check if geolocation is supported
export const isGeolocationSupported = () => {
  return 'geolocation' in navigator;
};

// Get current position (Promise-based)
export const getCurrentPosition = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(getGeolocationError(error));
      },
      { ...defaultOptions, ...options }
    );
  });
};

// Watch position (returns watch ID)
export const watchPosition = (onSuccess, onError, options = {}) => {
  if (!isGeolocationSupported()) {
    onError(new Error('Geolocation is not supported by this browser'));
    return null;
  }

  return navigator.geolocation.watchPosition(
    onSuccess,
    (error) => {
      onError(getGeolocationError(error));
    },
    { ...defaultOptions, ...options }
  );
};

// Clear watch
export const clearWatch = (watchId) => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
};

// Convert geolocation error to user-friendly message
const getGeolocationError = (error) => {
  let message;

  switch (error.code) {
    case error.PERMISSION_DENIED:
      message = 'Location access denied. Please enable location permissions in your browser settings.';
      break;
    case error.POSITION_UNAVAILABLE:
      message = 'Location information is unavailable. Please try again.';
      break;
    case error.TIMEOUT:
      message = 'Location request timed out. Please try again.';
      break;
    default:
      message = 'An unknown error occurred while getting location.';
      break;
  }

  const err = new Error(message);
  err.code = error.code;
  return err;
};

// Calculate distance between two points using Haversine formula
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Format distance for display
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

// Get bearing between two points
export const getBearing = (lat1, lng1, lat2, lng2) => {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
};

// Get cardinal direction from bearing
export const getCardinalDirection = (bearing) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

// Check if a point is within a bounding box
export const isPointInBounds = (lat, lng, bounds) => {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
};

// Calculate bounding box from center point and radius
export const getBoundingBox = (lat, lng, radiusMeters) => {
  const R = 6371e3; // Earth's radius in meters
  const latRad = (lat * Math.PI) / 180;

  const latDiff = (radiusMeters / R) * (180 / Math.PI);
  const lngDiff = (radiusMeters / (R * Math.cos(latRad))) * (180 / Math.PI);

  return {
    north: lat + latDiff,
    south: lat - latDiff,
    east: lng + lngDiff,
    west: lng - lngDiff,
  };
};

// Get a human-readable location description (requires reverse geocoding API)
export const getLocationDescription = async (lat, lng) => {
  try {
    // Using OpenStreetMap Nominatim for reverse geocoding (free, no API key)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'QuickAlert Emergency App',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export default {
  isGeolocationSupported,
  getCurrentPosition,
  watchPosition,
  clearWatch,
  calculateDistance,
  formatDistance,
  getBearing,
  getCardinalDirection,
  isPointInBounds,
  getBoundingBox,
  getLocationDescription,
};

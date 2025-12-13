/**
 * Geographic utility functions for distance calculations and location operations
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
const radiansToDegrees = (radians) => {
  return radians * (180 / Math.PI);
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @param {string} unit - Unit of measurement ('km' or 'miles')
 * @returns {number} Distance in specified unit
 */
const calculateDistance = (lat1, lon1, lat2, lon2, unit = 'km') => {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const radius = unit === 'miles' ? EARTH_RADIUS_MILES : EARTH_RADIUS_KM;
  return radius * c;
};

/**
 * Calculate distance between two coordinate arrays [longitude, latitude]
 * @param {number[]} coords1 - [longitude, latitude] of point 1
 * @param {number[]} coords2 - [longitude, latitude] of point 2
 * @param {string} unit - Unit of measurement
 * @returns {number} Distance in specified unit
 */
const distanceBetweenCoords = (coords1, coords2, unit = 'km') => {
  return calculateDistance(coords1[1], coords1[0], coords2[1], coords2[0], unit);
};

/**
 * Check if a point is within a radius of another point
 * @param {number[]} point - [longitude, latitude] to check
 * @param {number[]} center - [longitude, latitude] of center
 * @param {number} radius - Radius to check within
 * @param {string} unit - Unit of measurement
 * @returns {boolean} True if point is within radius
 */
const isWithinRadius = (point, center, radius, unit = 'km') => {
  const distance = distanceBetweenCoords(point, center, unit);
  return distance <= radius;
};

/**
 * Calculate bounding box for a center point and radius
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radius - Radius in km
 * @returns {Object} Bounding box { minLat, maxLat, minLon, maxLon }
 */
const getBoundingBox = (lat, lon, radius) => {
  const latDelta = radius / EARTH_RADIUS_KM;
  const lonDelta = radius / (EARTH_RADIUS_KM * Math.cos(degreesToRadians(lat)));

  return {
    minLat: lat - radiansToDegrees(latDelta),
    maxLat: lat + radiansToDegrees(latDelta),
    minLon: lon - radiansToDegrees(lonDelta),
    maxLon: lon + radiansToDegrees(lonDelta),
  };
};

/**
 * Calculate the center point of multiple coordinates
 * @param {number[][]} coordinates - Array of [longitude, latitude] pairs
 * @returns {number[]} Center point [longitude, latitude]
 */
const calculateCentroid = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  if (coordinates.length === 1) {
    return coordinates[0];
  }

  let x = 0;
  let y = 0;
  let z = 0;

  coordinates.forEach(([lon, lat]) => {
    const latRad = degreesToRadians(lat);
    const lonRad = degreesToRadians(lon);

    x += Math.cos(latRad) * Math.cos(lonRad);
    y += Math.cos(latRad) * Math.sin(lonRad);
    z += Math.sin(latRad);
  });

  const total = coordinates.length;
  x /= total;
  y /= total;
  z /= total;

  const centralLon = Math.atan2(y, x);
  const centralSqrt = Math.sqrt(x * x + y * y);
  const centralLat = Math.atan2(z, centralSqrt);

  return [radiansToDegrees(centralLon), radiansToDegrees(centralLat)];
};

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @returns {number} Bearing in degrees (0-360)
 */
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const lat1Rad = degreesToRadians(lat1);
  const lat2Rad = degreesToRadians(lat2);
  const dLon = degreesToRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = radiansToDegrees(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;

  return bearing;
};

/**
 * Get cardinal direction from bearing
 * @param {number} bearing - Bearing in degrees
 * @returns {string} Cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
const getCardinalDirection = (bearing) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

/**
 * Calculate destination point given start point, bearing, and distance
 * @param {number} lat - Start latitude
 * @param {number} lon - Start longitude
 * @param {number} bearing - Bearing in degrees
 * @param {number} distance - Distance in km
 * @returns {number[]} Destination [longitude, latitude]
 */
const calculateDestination = (lat, lon, bearing, distance) => {
  const latRad = degreesToRadians(lat);
  const lonRad = degreesToRadians(lon);
  const bearingRad = degreesToRadians(bearing);
  const angularDistance = distance / EARTH_RADIUS_KM;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const destLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
    );

  return [radiansToDegrees(destLonRad), radiansToDegrees(destLatRad)];
};

/**
 * Check if a point is inside a polygon
 * @param {number[]} point - [longitude, latitude]
 * @param {number[][]} polygon - Array of [longitude, latitude] pairs defining the polygon
 * @returns {boolean} True if point is inside polygon
 */
const isPointInPolygon = (point, polygon) => {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Generate points around a center for area coverage
 * @param {number[]} center - [longitude, latitude]
 * @param {number} radius - Radius in km
 * @param {number} numPoints - Number of points to generate
 * @returns {number[][]} Array of [longitude, latitude] points
 */
const generateCirclePoints = (center, radius, numPoints = 12) => {
  const points = [];
  const [lon, lat] = center;

  for (let i = 0; i < numPoints; i++) {
    const bearing = (360 / numPoints) * i;
    const point = calculateDestination(lat, lon, bearing, radius);
    points.push(point);
  }

  // Close the circle
  points.push(points[0]);

  return points;
};

/**
 * Format coordinates to readable string
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Formatted coordinate string
 */
const formatCoordinates = (lat, lon) => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`;
};

/**
 * Parse coordinates from string
 * @param {string} coordString - Coordinate string (various formats)
 * @returns {number[]|null} [longitude, latitude] or null if invalid
 */
const parseCoordinates = (coordString) => {
  // Try various formats
  const patterns = [
    // "lat,lon" or "lat, lon"
    /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
    // "lat lon"
    /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
    // "lat°N/S, lon°E/W"
    /^(\d+\.?\d*)°?\s*([NS])\s*,?\s*(\d+\.?\d*)°?\s*([EW])$/i,
  ];

  for (const pattern of patterns) {
    const match = coordString.trim().match(pattern);
    if (match) {
      if (match.length === 3) {
        // Simple lat,lon format
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return [lon, lat];
        }
      } else if (match.length === 5) {
        // Direction format
        let lat = parseFloat(match[1]);
        let lon = parseFloat(match[3]);
        if (match[2].toUpperCase() === 'S') lat = -lat;
        if (match[4].toUpperCase() === 'W') lon = -lon;
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return [lon, lat];
        }
      }
    }
  }

  return null;
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if coordinates are valid
 */
const validateCoordinates = (lat, lon) => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

/**
 * Sort locations by distance from a point
 * @param {Object[]} locations - Array of objects with location.coordinates
 * @param {number[]} fromPoint - [longitude, latitude]
 * @returns {Object[]} Sorted locations with added distance property
 */
const sortByDistance = (locations, fromPoint) => {
  return locations
    .map((location) => ({
      ...location,
      distance: distanceBetweenCoords(
        location.location?.coordinates || location.coordinates,
        fromPoint
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
};

module.exports = {
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  degreesToRadians,
  radiansToDegrees,
  calculateDistance,
  distanceBetweenCoords,
  isWithinRadius,
  getBoundingBox,
  calculateCentroid,
  calculateBearing,
  getCardinalDirection,
  calculateDestination,
  isPointInPolygon,
  generateCirclePoints,
  formatCoordinates,
  parseCoordinates,
  validateCoordinates,
  sortByDistance,
};

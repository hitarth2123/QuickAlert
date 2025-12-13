/**
 * Utilities Tests
 * Tests for encryption and geoUtils functions
 */

require('./setup');

describe('Utilities', () => {
  
  // ==========================================
  // Encryption Utils
  // ==========================================
  describe('Encryption Utils', () => {
    
    let encryption;

    beforeAll(() => {
      // Set encryption key for tests
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-ok!';
      encryption = require('../utils/encryption');
    });

    describe('encrypt', () => {
      it('should encrypt a string', () => {
        const plaintext = 'Hello, World!';
        const encrypted = encryption.encrypt(plaintext);

        expect(encrypted).toBeDefined();
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBe(plaintext);
      });

      it('should return different ciphertext for same plaintext (random IV)', () => {
        const plaintext = 'Same text';
        const encrypted1 = encryption.encrypt(plaintext);
        const encrypted2 = encryption.encrypt(plaintext);

        expect(encrypted1).not.toBe(encrypted2);
      });

      it('should handle empty string', () => {
        const encrypted = encryption.encrypt('');
        expect(encrypted).toBeDefined();
      });

      it('should handle special characters', () => {
        const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const encrypted = encryption.encrypt(plaintext);
        expect(encrypted).toBeDefined();
      });

      it('should handle unicode characters', () => {
        const plaintext = '你好世界 🌍 مرحبا';
        const encrypted = encryption.encrypt(plaintext);
        expect(encrypted).toBeDefined();
      });
    });

    describe('decrypt', () => {
      it('should decrypt encrypted text', () => {
        const plaintext = 'Hello, World!';
        const encrypted = encryption.encrypt(plaintext);
        const decrypted = encryption.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it('should handle long text', () => {
        const plaintext = 'A'.repeat(10000);
        const encrypted = encryption.encrypt(plaintext);
        const decrypted = encryption.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it('should handle JSON data', () => {
        const data = { name: 'John', email: 'john@example.com', age: 30 };
        const plaintext = JSON.stringify(data);
        const encrypted = encryption.encrypt(plaintext);
        const decrypted = encryption.decrypt(encrypted);

        expect(JSON.parse(decrypted)).toEqual(data);
      });
    });

    describe('hash', () => {
      it('should hash data consistently', () => {
        const data = 'test data';
        const hash1 = encryption.hash(data);
        const hash2 = encryption.hash(data);

        expect(hash1).toBe(hash2);
      });

      it('should produce different hashes for different data', () => {
        const hash1 = encryption.hash('data1');
        const hash2 = encryption.hash('data2');

        expect(hash1).not.toBe(hash2);
      });

      it('should return hex string', () => {
        const hashResult = encryption.hash('test');
        expect(/^[a-f0-9]+$/i.test(hashResult)).toBe(true);
      });
    });

    describe('generateToken', () => {
      it('should generate random token', () => {
        const token = encryption.generateToken();
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
      });

      it('should generate unique tokens', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
          tokens.add(encryption.generateToken());
        }
        expect(tokens.size).toBe(100);
      });

      it('should respect custom length', () => {
        const token = encryption.generateToken(64);
        // Hex encoding doubles the byte length
        expect(token.length).toBe(128);
      });
    });

    describe('generateNumericCode', () => {
      it('should generate numeric code of specified length', () => {
        const code = encryption.generateNumericCode(6);
        expect(code.length).toBe(6);
        expect(/^\d+$/.test(code)).toBe(true);
      });

      it('should default to 6 digits', () => {
        const code = encryption.generateNumericCode();
        expect(code.length).toBe(6);
      });
    });

    describe('hashWithSalt', () => {
      it('should hash data with salt', () => {
        const data = 'test data';
        const result = encryption.hashWithSalt(data);

        expect(result.hash).toBeDefined();
        expect(result.salt).toBeDefined();
        expect(typeof result.hash).toBe('string');
        expect(typeof result.salt).toBe('string');
      });

      it('should produce different hashes for same data with different salts', () => {
        const data = 'test data';
        const result1 = encryption.hashWithSalt(data);
        const result2 = encryption.hashWithSalt(data);

        expect(result1.hash).not.toBe(result2.hash);
        expect(result1.salt).not.toBe(result2.salt);
      });

      it('should produce same hash with same salt', () => {
        const data = 'test data';
        const salt = 'fixed-salt-for-test';
        const result1 = encryption.hashWithSalt(data, salt);
        const result2 = encryption.hashWithSalt(data, salt);

        expect(result1.hash).toBe(result2.hash);
      });
    });

    describe('verifyHash', () => {
      it('should verify correct hash', () => {
        const data = 'test data';
        const { hash, salt } = encryption.hashWithSalt(data);

        expect(encryption.verifyHash(data, hash, salt)).toBe(true);
      });

      it('should reject incorrect data', () => {
        const data = 'test data';
        const { hash, salt } = encryption.hashWithSalt(data);

        expect(encryption.verifyHash('wrong data', hash, salt)).toBe(false);
      });
    });
  });

  // ==========================================
  // GeoUtils
  // ==========================================
  describe('GeoUtils', () => {
    
    const geoUtils = require('../utils/geoUtils');

    describe('calculateDistance', () => {
      it('should calculate distance between two points', () => {
        // New York to Los Angeles (~3,935 km)
        const distance = geoUtils.calculateDistance(
          40.7128, -74.0060,  // NYC lat, lng
          34.0522, -118.2437  // LA lat, lng
        );

        expect(distance).toBeGreaterThan(3900);
        expect(distance).toBeLessThan(4000);
      });

      it('should return 0 for same point', () => {
        const distance = geoUtils.calculateDistance(
          40.7128, -74.0060,
          40.7128, -74.0060
        );

        expect(distance).toBe(0);
      });

      it('should return distance in kilometers by default', () => {
        // London to Paris (~343 km)
        const distance = geoUtils.calculateDistance(
          51.5074, -0.1278,  // London lat, lng
          48.8566, 2.3522    // Paris lat, lng
        );

        expect(distance).toBeGreaterThan(340);
        expect(distance).toBeLessThan(350);
      });

      it('should return distance in miles when specified', () => {
        // London to Paris (~213 miles)
        const distance = geoUtils.calculateDistance(
          51.5074, -0.1278,
          48.8566, 2.3522,
          'miles'
        );

        expect(distance).toBeGreaterThan(210);
        expect(distance).toBeLessThan(220);
      });
    });

    describe('distanceBetweenCoords', () => {
      it('should calculate distance between coordinate arrays', () => {
        // NYC to LA using [lng, lat] format
        const distance = geoUtils.distanceBetweenCoords(
          [-74.0060, 40.7128],  // NYC [lng, lat]
          [-118.2437, 34.0522]  // LA [lng, lat]
        );

        expect(distance).toBeGreaterThan(3900);
        expect(distance).toBeLessThan(4000);
      });

      it('should return 0 for same coordinates', () => {
        const distance = geoUtils.distanceBetweenCoords(
          [-74.0060, 40.7128],
          [-74.0060, 40.7128]
        );

        expect(distance).toBe(0);
      });
    });

    describe('isWithinRadius', () => {
      it('should return true for point within radius', () => {
        const result = geoUtils.isWithinRadius(
          [-73.9855, 40.7580],  // Times Square [lng, lat]
          [-74.0060, 40.7128],  // NYC center [lng, lat]
          10  // 10km radius
        );

        expect(result).toBe(true);
      });

      it('should return false for point outside radius', () => {
        const result = geoUtils.isWithinRadius(
          [-118.2437, 34.0522], // LA [lng, lat]
          [-74.0060, 40.7128],  // NYC center [lng, lat]
          100  // 100km radius
        );

        expect(result).toBe(false);
      });

      it('should handle edge case at exactly the radius', () => {
        // Test point about 10km from NYC center
        const center = [-74.0060, 40.7128];
        const point = [-73.9, 40.8]; // approximately 10km away
        
        const distance = geoUtils.distanceBetweenCoords(point, center);
        
        // Test at larger radius - should be within
        expect(geoUtils.isWithinRadius(point, center, distance + 1)).toBe(true);
        
        // Test at smaller radius - should be outside
        expect(geoUtils.isWithinRadius(point, center, distance - 1)).toBe(false);
      });
    });

    describe('getBoundingBox', () => {
      it('should return bounding box for a center and radius', () => {
        const bbox = geoUtils.getBoundingBox(40.7128, -74.0060, 10);

        expect(bbox).toBeDefined();
        expect(bbox.minLat).toBeLessThan(40.7128);
        expect(bbox.maxLat).toBeGreaterThan(40.7128);
        expect(bbox.minLon).toBeLessThan(-74.0060);
        expect(bbox.maxLon).toBeGreaterThan(-74.0060);
      });

      it('should return larger box for larger radius', () => {
        const smallBox = geoUtils.getBoundingBox(40.7128, -74.0060, 5);
        const largeBox = geoUtils.getBoundingBox(40.7128, -74.0060, 50);

        expect(largeBox.maxLat - largeBox.minLat).toBeGreaterThan(
          smallBox.maxLat - smallBox.minLat
        );
      });

      it('should return symmetric box around center', () => {
        const bbox = geoUtils.getBoundingBox(40.7128, -74.0060, 10);
        
        const centerLat = (bbox.maxLat + bbox.minLat) / 2;
        
        expect(centerLat).toBeCloseTo(40.7128, 2);
      });
    });

    describe('formatCoordinates', () => {
      it('should format coordinates as readable string', () => {
        const formatted = geoUtils.formatCoordinates(40.7128, -74.0060);

        expect(typeof formatted).toBe('string');
        expect(formatted).toContain('40.712800');
        expect(formatted).toContain('N');
        expect(formatted).toContain('74.006000');
        expect(formatted).toContain('W');
      });

      it('should handle negative latitudes', () => {
        const formatted = geoUtils.formatCoordinates(-33.8688, 151.2093);
        
        expect(formatted).toContain('S');
        expect(formatted).toContain('E');
      });
    });

    describe('parseCoordinates', () => {
      it('should parse comma-separated coordinates', () => {
        const result = geoUtils.parseCoordinates('40.7128, -74.0060');
        
        expect(result).toBeDefined();
        expect(result[0]).toBe(-74.006); // longitude
        expect(result[1]).toBe(40.7128); // latitude
      });

      it('should return null for invalid coordinates', () => {
        expect(geoUtils.parseCoordinates('invalid')).toBeNull();
        expect(geoUtils.parseCoordinates('999, 999')).toBeNull();
      });
    });

    describe('validateCoordinates', () => {
      it('should return true for valid coordinates', () => {
        expect(geoUtils.validateCoordinates(40.7128, -74.0060)).toBe(true);
        expect(geoUtils.validateCoordinates(-90, 180)).toBe(true);
        expect(geoUtils.validateCoordinates(90, -180)).toBe(true);
        expect(geoUtils.validateCoordinates(0, 0)).toBe(true);
      });

      it('should return false for invalid latitude', () => {
        expect(geoUtils.validateCoordinates(91, 0)).toBe(false);
        expect(geoUtils.validateCoordinates(-91, 0)).toBe(false);
      });

      it('should return false for invalid longitude', () => {
        expect(geoUtils.validateCoordinates(0, 181)).toBe(false);
        expect(geoUtils.validateCoordinates(0, -181)).toBe(false);
      });

      it('should return false for non-numeric values', () => {
        expect(geoUtils.validateCoordinates('abc', 0)).toBe(false);
        expect(geoUtils.validateCoordinates(0, 'xyz')).toBe(false);
        expect(geoUtils.validateCoordinates(null, 0)).toBe(false);
        expect(geoUtils.validateCoordinates(undefined, undefined)).toBe(false);
      });
    });

    describe('calculateCentroid', () => {
      it('should calculate centroid of multiple points', () => {
        const points = [
          [-74.0060, 40.7128], // NYC
          [-73.9855, 40.7580], // Times Square
          [-73.9712, 40.7831], // Central Park
        ];

        const centroid = geoUtils.calculateCentroid(points);

        expect(centroid).toBeDefined();
        expect(centroid.length).toBe(2);
        // Centroid should be roughly between the points
        expect(centroid[0]).toBeGreaterThan(-74.1);
        expect(centroid[0]).toBeLessThan(-73.9);
        expect(centroid[1]).toBeGreaterThan(40.7);
        expect(centroid[1]).toBeLessThan(40.8);
      });

      it('should return same point for single point array', () => {
        const points = [[-74.0060, 40.7128]];
        const centroid = geoUtils.calculateCentroid(points);

        expect(centroid).toEqual(points[0]);
      });

      it('should return null for empty array', () => {
        expect(geoUtils.calculateCentroid([])).toBeNull();
      });
    });

    describe('calculateBearing', () => {
      it('should calculate bearing between two points', () => {
        // NYC to LA should be roughly west-southwest
        const bearing = geoUtils.calculateBearing(
          40.7128, -74.0060,  // NYC
          34.0522, -118.2437  // LA
        );

        expect(bearing).toBeGreaterThan(250);
        expect(bearing).toBeLessThan(280);
      });

      it('should return 0 for due north', () => {
        const bearing = geoUtils.calculateBearing(0, 0, 10, 0);
        expect(bearing).toBeCloseTo(0, 0);
      });

      it('should return 90 for due east', () => {
        const bearing = geoUtils.calculateBearing(0, 0, 0, 10);
        expect(bearing).toBeCloseTo(90, 0);
      });
    });

    describe('getCardinalDirection', () => {
      it('should return N for north bearing', () => {
        expect(geoUtils.getCardinalDirection(0)).toBe('N');
        expect(geoUtils.getCardinalDirection(359)).toBe('N');
      });

      it('should return E for east bearing', () => {
        expect(geoUtils.getCardinalDirection(90)).toBe('E');
      });

      it('should return S for south bearing', () => {
        expect(geoUtils.getCardinalDirection(180)).toBe('S');
      });

      it('should return W for west bearing', () => {
        expect(geoUtils.getCardinalDirection(270)).toBe('W');
      });

      it('should return intercardinal directions', () => {
        expect(geoUtils.getCardinalDirection(45)).toBe('NE');
        expect(geoUtils.getCardinalDirection(135)).toBe('SE');
        expect(geoUtils.getCardinalDirection(225)).toBe('SW');
        expect(geoUtils.getCardinalDirection(315)).toBe('NW');
      });
    });
  });
});

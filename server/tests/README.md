# QuickAlert Backend Test Suite

## Overview

Comprehensive test suite for the QuickAlert emergency reporting and alert system backend. The test suite covers all API endpoints, middleware, models, utilities, Socket.IO real-time functionality, and end-to-end integration workflows.

## Test Statistics

| Metric | Value |
|--------|-------|
| **Total Tests** | 226 |
| **Test Suites** | 9 |
| **Pass Rate** | 100% |

## Test Structure

```
tests/
├── setup.js              # Global test setup and teardown
├── app.js                # Test Express app configuration
├── helpers.js            # Test utilities and data factories
├── models.test.js        # Database model tests
├── utils.test.js         # Utility function tests
├── middleware.test.js    # Middleware tests
├── auth.test.js          # Authentication endpoint tests
├── reports.test.js       # Reports endpoint tests
├── alerts.test.js        # Alerts endpoint tests
├── analytics.test.js     # Analytics endpoint tests
├── sockets.test.js       # Socket.IO tests
└── integration.test.js   # End-to-end integration tests
```

## Test Categories

### 1. Model Tests (`models.test.js`) - 28 Tests

Tests for all Mongoose models including validation, pre-save hooks, and methods.

| Model | Tests | Coverage |
|-------|-------|----------|
| User | 8 | Schema validation, password hashing, method behaviors |
| Report | 7 | Schema validation, GeoJSON, encryption, anonymity |
| Alert | 5 | Schema validation, instructions format, affected areas |
| Session | 4 | Token management, device info, expiration |
| Verification | 2 | Code generation, expiration |
| ReportVerification | 2 | Vote tracking, verification status |

### 2. Utility Tests (`utils.test.js`) - 54 Tests

Tests for all utility modules.

| Utility | Tests | Coverage |
|---------|-------|----------|
| Encryption | 20 | AES-256-GCM encryption, key generation, validation |
| Geo Utils | 34 | Distance calculation, bounding boxes, coordinate validation |

### 3. Middleware Tests (`middleware.test.js`) - 15 Tests

Tests for Express middleware functions.

| Middleware | Tests | Coverage |
|------------|-------|----------|
| Auth | 6 | Token validation, user attachment, error handling |
| Optional Auth | 3 | Optional authentication behavior |
| Role Check | 4 | Role-based access control |
| Rate Limiter | 2 | Rate limiting configuration |

### 4. Authentication Tests (`auth.test.js`) - 21 Tests

Tests for `/api/auth` endpoints.

| Endpoint | Method | Tests |
|----------|--------|-------|
| `/register` | POST | Registration validation, duplicate handling |
| `/verify-email` | POST | Email verification flow |
| `/login` | POST | Login validation, session creation |
| `/logout` | POST | Session termination |
| `/me` | GET | Profile retrieval |
| `/me` | PUT | Profile updates |
| `/me/password` | PUT | Password change |
| `/me/sessions` | GET | Session listing |
| `/me/sessions/:id` | DELETE | Session revocation |
| `/update-location` | PUT | Location updates |
| `/forgot-password` | POST | Password reset initiation |
| `/reset-password` | POST | Password reset completion |

### 5. Reports Tests (`reports.test.js`) - 36 Tests

Tests for `/api/reports` endpoints.

| Endpoint | Method | Tests |
|----------|--------|-------|
| `/` | GET | List reports with filters, pagination |
| `/` | POST | Create reports (authenticated & anonymous) |
| `/:id` | GET | Get report details |
| `/:id` | PUT | Update reports |
| `/:id` | DELETE | Delete reports |
| `/nearby` | GET | Geospatial queries |
| `/:id/verify` | POST | Verification voting |
| `/:id/moderate` | PUT | Admin moderation |
| `/categories/list` | GET | Category enumeration |

### 6. Alerts Tests (`alerts.test.js`) - 25 Tests

Tests for `/api/alerts` endpoints.

| Endpoint | Method | Tests |
|----------|--------|-------|
| `/` | GET | List alerts with filters |
| `/` | POST | Create alerts (admin/responder only) |
| `/:id` | GET | Get alert details |
| `/:id` | PUT | Update alerts |
| `/:id` | DELETE | Delete alerts |
| `/nearby` | GET | Geospatial queries |
| `/:id/cancel` | PUT | Cancel alerts |
| `/:id/resolve` | PUT | Resolve alerts |

### 7. Analytics Tests (`analytics.test.js`) - 20 Tests

Tests for `/api/analytics` endpoints.

| Endpoint | Method | Tests |
|----------|--------|-------|
| `/population` | GET | Population statistics |
| `/reports` | GET | Report statistics |
| `/reports/heatmap` | GET | Heatmap data |
| `/alerts` | GET | Alert statistics |
| `/alerts/heatmap` | GET | Alert heatmap data |

### 8. Socket.IO Tests (`sockets.test.js`) - 17 Tests

Tests for real-time Socket.IO functionality.

| Event | Direction | Tests |
|-------|-----------|-------|
| `connection` | Server | Connection handling, authentication |
| `joinLocation` | Client→Server | Room joining, location-based filtering |
| `leaveLocation` | Client→Server | Room leaving |
| `disconnect` | Client | Disconnection cleanup |
| `newReport` | Server→Client | Report broadcast |
| `newAlert` | Server→Client | Alert broadcast |
| `reportVerified` | Server→Client | Verification updates |

### 9. Integration Tests (`integration.test.js`) - 10 Tests

End-to-end workflow tests.

| Workflow | Tests |
|----------|-------|
| User Registration | Email verification, login, profile |
| Report Lifecycle | Create, verify, moderate, delete |
| Alert Lifecycle | Create, activate, resolve |
| Cross-Feature | Report triggers alert workflow |

## Running Tests

### Prerequisites

```bash
cd server
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Run model tests only
npm test -- models.test.js

# Run auth tests only
npm test -- auth.test.js

# Run multiple specific files
npm test -- models.test.js utils.test.js
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Tests with Verbose Output

```bash
npm test -- --verbose
```

## Test Configuration

### Jest Configuration

The test suite uses Jest with the following configuration in `package.json`:

```json
{
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["./tests/setup.js"],
    "testTimeout": 30000,
    "forceExit": true,
    "detectOpenHandles": true
  }
}
```

### Environment Setup

Tests use `mongodb-memory-server` for an isolated in-memory MongoDB instance. No external database connection is required.

The test setup (`setup.js`) handles:
- Starting in-memory MongoDB before tests
- Cleaning up collections between tests
- Stopping MongoDB after all tests complete

## Test Utilities

### `helpers.js` Exports

```javascript
// User creation
createTestUser(overrides)          // Create regular user
createAdminUser(overrides)         // Create admin user
createResponderUser(overrides)     // Create responder user
createSuperAdminUser(overrides)    // Create super admin user

// Data creation
createTestReport(userId, overrides) // Create test report
createTestAlert(userId, overrides)  // Create test alert
createTestSession(userId, overrides) // Create test session

// Authentication
loginUser(app, email, password)    // Login and get token
registerUser(app, userData)        // Register new user

// Geospatial
testLocation                       // Default test coordinates
generateNearbyLocation(base, km)   // Generate coordinates within distance

// Constants
validCategories                    // Valid report/alert categories
```

## Writing New Tests

### Example: Testing a New Endpoint

```javascript
const request = require('supertest');
const { createTestUser, loginUser } = require('./helpers');

describe('My New Endpoint', () => {
  let authToken;
  let testUser;
  
  beforeAll(async () => {
    testUser = await createTestUser();
    const loginRes = await loginUser(app, testUser.email, 'password123');
    authToken = loginRes.body.token;
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/my-endpoint')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
});
```

### Example: Testing Socket.IO Events

```javascript
const { io: Client } = require('socket.io-client');

describe('Socket Event', () => {
  let clientSocket;

  beforeAll((done) => {
    clientSocket = Client(`http://localhost:${port}`);
    clientSocket.on('connect', done);
  });

  afterAll(() => {
    clientSocket.close();
  });

  it('should receive broadcast', (done) => {
    clientSocket.on('myEvent', (data) => {
      expect(data).toHaveProperty('message');
      done();
    });
    
    // Trigger the event somehow
  });
});
```

## Common Test Patterns

### Testing Authentication

```javascript
// Unauthenticated request (should fail)
await request(app)
  .get('/api/protected')
  .expect(401);

// Authenticated request (should succeed)
await request(app)
  .get('/api/protected')
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);
```

### Testing Role-Based Access

```javascript
// Regular user (should fail)
await request(app)
  .post('/api/admin-only')
  .set('Authorization', `Bearer ${userToken}`)
  .expect(403);

// Admin user (should succeed)
await request(app)
  .post('/api/admin-only')
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(201);
```

### Testing Geospatial Queries

```javascript
const response = await request(app)
  .get('/api/reports/nearby')
  .query({
    lat: 40.7128,
    lng: -74.0060,
    radius: 5000
  })
  .set('Authorization', `Bearer ${authToken}`);

expect(response.body.data).toBeInstanceOf(Array);
```

## Troubleshooting

### Tests Timeout

Increase the timeout in Jest config or individual tests:

```javascript
jest.setTimeout(60000); // 60 seconds
```

### MongoDB Connection Issues

The tests use `mongodb-memory-server` which downloads MongoDB binaries on first run. Ensure you have internet connectivity and sufficient disk space.

### Socket.IO Open Handles

The socket handler includes cleanup code. If you see open handle warnings, ensure `io._cleanupInterval` is cleared in `afterAll`:

```javascript
afterAll(() => {
  if (io._cleanupInterval) {
    clearInterval(io._cleanupInterval);
  }
});
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| jest | ^29.7.0 | Test runner |
| supertest | ^7.0.0 | HTTP testing |
| mongodb-memory-server | ^10.0.0 | In-memory MongoDB |
| socket.io-client | ^4.7.2 | Socket.IO testing |

## License

MIT License - See [LICENSE](../LICENSE) for details.

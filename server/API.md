# QuickAlert API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Auth Routes (`/api/auth`)

### Register User
Create a new user account.

- **URL:** `/api/auth/register`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "phone": "+1234567890",
  "location": {
    "coordinates": [-122.4194, 37.7749],
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "64abc123...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Login
Authenticate user and receive JWT token.

- **URL:** `/api/auth/login`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64abc123...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isVerified": true,
      "location": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Get Current User
Get authenticated user's profile.

- **URL:** `/api/auth/me`
- **Method:** `GET`
- **Access:** Private (JWT required)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "64abc123...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "user",
    "isVerified": true,
    "isActive": true,
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749],
      "city": "San Francisco"
    },
    "alertPreferences": {
      "pushEnabled": true,
      "emailEnabled": true,
      "smsEnabled": false,
      "radius": 10
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastLogin": "2024-12-13T08:00:00.000Z"
  }
}
```

---

### Update Location
Update user's current location.

- **URL:** `/api/auth/update-location`
- **Method:** `PATCH`
- **Access:** Private (JWT required)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "address": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "country": "USA",
  "zipCode": "94102"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749],
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "country": "USA",
      "zipCode": "94102"
    }
  }
}
```

---

### Refresh Token
Get new access token using refresh token.

- **URL:** `/api/auth/refresh`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Forgot Password
Request password reset email.

- **URL:** `/api/auth/forgot-password`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists, a password reset link has been sent"
}
```

---

### Reset Password
Reset password with token.

- **URL:** `/api/auth/reset-password/:token`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "password": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Reports Routes (`/api/reports`)

### Create Report
Submit a new incident report (anonymous allowed).

- **URL:** `/api/reports`
- **Method:** `POST`
- **Access:** Public (Optional Auth)
- **Content-Type:** `multipart/form-data`

**Request Body:**
```json
{
  "title": "Road Accident on Highway 101",
  "description": "Multi-vehicle collision blocking two lanes",
  "category": "accident",
  "subcategory": "traffic",
  "severity": "high",
  "location": {
    "coordinates": [-122.4194, 37.7749],
    "address": "Highway 101, San Francisco",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "isAnonymous": false,
  "tags": ["traffic", "highway", "emergency"]
}
```

**Form Data Fields:**
- `media` - Up to 5 image/video files

**Response:**
```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "_id": "64abc456...",
    "title": "Road Accident on Highway 101",
    "description": "Multi-vehicle collision blocking two lanes",
    "category": "accident",
    "severity": "high",
    "status": "pending",
    "verificationStatus": "unverified",
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "createdAt": "2024-12-13T10:00:00.000Z"
  }
}
```

---

### Get Reports (Nearby)
Get reports within a specified radius.

- **URL:** `/api/reports`
- **Method:** `GET`
- **Access:** Public

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lat` | Number | - | Latitude for center point |
| `lng` | Number | - | Longitude for center point |
| `radius` | Number | 5 | Radius in kilometers |
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Results per page |
| `category` | String | - | Filter by category |
| `severity` | String | - | Filter by severity |
| `status` | String | - | Filter by status |

**Example:**
```
GET /api/reports?lat=37.7749&lng=-122.4194&radius=10&category=accident
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc456...",
      "title": "Road Accident on Highway 101",
      "category": "accident",
      "severity": "high",
      "status": "verified",
      "location": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749],
        "city": "San Francisco"
      },
      "distance": "2.45",
      "createdAt": "2024-12-13T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "hasMore": true
  }
}
```

---

### Get Single Report
Get detailed information about a specific report.

- **URL:** `/api/reports/:id`
- **Method:** `GET`
- **Access:** Public

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64abc456...",
    "title": "Road Accident on Highway 101",
    "description": "Multi-vehicle collision blocking two lanes",
    "category": "accident",
    "subcategory": "traffic",
    "severity": "high",
    "status": "verified",
    "verificationStatus": "verified",
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749],
      "address": "Highway 101, San Francisco",
      "city": "San Francisco"
    },
    "media": [
      {
        "url": "https://res.cloudinary.com/...",
        "type": "image"
      }
    ],
    "votes": {
      "up": 15,
      "down": 2
    },
    "viewCount": 234,
    "reporter": {
      "firstName": "John",
      "lastName": "D."
    },
    "createdAt": "2024-12-13T10:00:00.000Z"
  }
}
```

---

### Verify Report
Submit a verification vote (confirm/deny).

- **URL:** `/api/reports/:id/verify`
- **Method:** `POST`
- **Access:** Private (User role required)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "vote": "confirm"
}
```

Vote options: `confirm` or `deny`

**Response:**
```json
{
  "success": true,
  "message": "Vote confirmed successfully",
  "data": {
    "confirms": 16,
    "denies": 2,
    "verificationStatus": "verified",
    "userVote": "up"
  }
}
```

---

### Moderate Report
Approve, reject, or flag a report.

- **URL:** `/api/reports/:id/moderate`
- **Method:** `PATCH`
- **Access:** Private (Admin role required)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "action": "approve",
  "reason": "Verified by emergency services"
}
```

Action options: `approve`, `reject`, `flag`

**Response:**
```json
{
  "success": true,
  "message": "Report approved successfully",
  "data": {
    "id": "64abc456...",
    "status": "verified",
    "verificationStatus": "verified",
    "moderatedBy": "64xyz789...",
    "moderatedAt": "2024-12-13T11:00:00.000Z"
  }
}
```

---

### Delete Report
Delete a report (admin only).

- **URL:** `/api/reports/:id`
- **Method:** `DELETE`
- **Access:** Private (Admin role required)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

---

## Alerts Routes (`/api/alerts`)

### Create Alert
Create an official alert with geo-fence.

- **URL:** `/api/alerts`
- **Method:** `POST`
- **Access:** Private (Responder/Admin role required)
- **Content-Type:** `multipart/form-data`

**Request Body:**
```json
{
  "title": "Severe Weather Warning",
  "description": "Heavy rainfall expected in the next 24 hours",
  "type": "weather",
  "severity": "warning",
  "targetArea": {
    "coordinates": [-122.4194, 37.7749],
    "radius": 25,
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "effectiveFrom": "2024-12-13T12:00:00.000Z",
  "effectiveUntil": "2024-12-14T12:00:00.000Z",
  "instructions": [
    "Stay indoors",
    "Avoid low-lying areas",
    "Keep emergency supplies ready"
  ]
}
```

**Alert Types:** `emergency`, `weather`, `traffic`, `health`, `crime`, `fire`, `flood`, `earthquake`, `tsunami`, `terrorism`, `other`

**Severity Levels:** `advisory`, `watch`, `warning`, `emergency`, `critical`

**Response:**
```json
{
  "success": true,
  "message": "Alert created and broadcasted successfully",
  "data": {
    "_id": "64def789...",
    "title": "Severe Weather Warning",
    "type": "weather",
    "severity": "warning",
    "status": "active",
    "isActive": true,
    "targetArea": {
      "type": "Circle",
      "coordinates": [-122.4194, 37.7749],
      "radius": 25
    },
    "delivery": {
      "totalTargeted": 15420,
      "sent": 15420
    },
    "createdAt": "2024-12-13T12:00:00.000Z"
  }
}
```

---

### Get Alerts (Nearby)
Get active alerts for a location.

- **URL:** `/api/alerts`
- **Method:** `GET`
- **Access:** Public

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lat` | Number | - | Latitude |
| `lng` | Number | - | Longitude |
| `radius` | Number | 50 | Radius in kilometers |
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Results per page |
| `type` | String | - | Filter by alert type |
| `severity` | String | - | Filter by severity |

**Example:**
```
GET /api/alerts?lat=37.7749&lng=-122.4194&type=weather
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64def789...",
      "title": "Severe Weather Warning",
      "description": "Heavy rainfall expected",
      "type": "weather",
      "severity": "warning",
      "status": "active",
      "targetArea": {
        "type": "Circle",
        "coordinates": [-122.4194, 37.7749],
        "radius": 25
      },
      "distance": "5.30",
      "effectiveUntil": "2024-12-14T12:00:00.000Z",
      "createdAt": "2024-12-13T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "pages": 1,
    "hasMore": false
  }
}
```

---

### Get Single Alert
Get detailed information about a specific alert.

- **URL:** `/api/alerts/:id`
- **Method:** `GET`
- **Access:** Public

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64def789...",
    "title": "Severe Weather Warning",
    "description": "Heavy rainfall expected in the next 24 hours",
    "type": "weather",
    "severity": "warning",
    "status": "active",
    "source": {
      "type": "official",
      "officialSource": "admin"
    },
    "targetArea": {
      "type": "Circle",
      "coordinates": [-122.4194, 37.7749],
      "radius": 25,
      "city": "San Francisco"
    },
    "instructions": [
      "Stay indoors",
      "Avoid low-lying areas",
      "Keep emergency supplies ready"
    ],
    "media": [],
    "interactions": {
      "views": 5420,
      "acknowledged": 3200
    },
    "delivery": {
      "totalTargeted": 15420,
      "sent": 15420,
      "delivered": 14890,
      "read": 12350
    },
    "createdBy": {
      "firstName": "Admin",
      "lastName": "User"
    },
    "createdAt": "2024-12-13T12:00:00.000Z"
  }
}
```

---

### Delete/Expire Alert
Cancel or expire an active alert.

- **URL:** `/api/alerts/:id`
- **Method:** `DELETE`
- **Access:** Private (Responder/Admin role required)

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reason": "Weather conditions have improved"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Alert deleted/expired successfully",
  "data": {
    "id": "64def789...",
    "status": "cancelled",
    "cancelledAt": "2024-12-13T18:00:00.000Z"
  }
}
```

---

## Analytics Routes (`/api/analytics`)

### Population Count
Count users within a polygon or radius.

- **URL:** `/api/analytics/population`
- **Method:** `GET`
- **Access:** Private (Responder/Admin role required)

**Query Parameters (Polygon):**
```
GET /api/analytics/population?polygon=[[-122.5,37.8],[-122.3,37.8],[-122.3,37.7],[-122.5,37.7],[-122.5,37.8]]
```

**Query Parameters (Radius):**
```
GET /api/analytics/population?lat=37.7749&lng=-122.4194&radius=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "population": 15420,
    "query": "polygon",
    "timestamp": "2024-12-13T12:00:00.000Z"
  }
}
```

---

### Reports Statistics
Get comprehensive report statistics.

- **URL:** `/api/analytics/reports-stats`
- **Method:** `GET`
- **Access:** Private (Admin role required)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | Date | Filter from date |
| `endDate` | Date | Filter to date |
| `category` | String | Filter by category |

**Example:**
```
GET /api/analytics/reports-stats?startDate=2024-12-01&category=accident
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1542,
    "verified": 1230,
    "unverified": 250,
    "falseReports": 62,
    "byStatus": {
      "pending": 180,
      "verified": 1230,
      "resolved": 95,
      "rejected": 37
    },
    "byCategory": {
      "accident": 456,
      "crime": 312,
      "fire": 198,
      "weather": 245,
      "health": 156,
      "other": 175
    },
    "bySeverity": {
      "low": 320,
      "medium": 680,
      "high": 412,
      "critical": 130
    },
    "overTime": [
      { "_id": "2024-12-01", "count": 45 },
      { "_id": "2024-12-02", "count": 52 },
      { "_id": "2024-12-03", "count": 48 }
    ],
    "resolution": {
      "avgResolutionTimeHours": 4.5,
      "minResolutionTimeHours": 0.5,
      "maxResolutionTimeHours": 72
    },
    "generatedAt": "2024-12-13T12:00:00.000Z"
  }
}
```

---

### Heatmap Data
Get user or report density data for heatmap visualization.

- **URL:** `/api/analytics/heatmap`
- **Method:** `GET`
- **Access:** Private (Responder/Admin role required)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lat` | Number | - | Center latitude |
| `lng` | Number | - | Center longitude |
| `radius` | Number | 50 | Radius in km |
| `gridSize` | Number | 0.01 | Grid cell size in degrees (~1.1km) |
| `type` | String | users | `users` or `reports` |

**Example:**
```
GET /api/analytics/heatmap?lat=37.7749&lng=-122.4194&radius=25&type=users
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "users",
    "gridSize": 0.01,
    "points": [
      { "lat": 37.77, "lng": -122.42, "intensity": 245 },
      { "lat": 37.78, "lng": -122.41, "intensity": 189 },
      { "lat": 37.76, "lng": -122.43, "intensity": 156 }
    ],
    "totalPoints": 342,
    "bounds": {
      "minLat": 37.65,
      "maxLat": 37.85,
      "minLng": -122.55,
      "maxLng": -122.35
    },
    "maxIntensity": 245,
    "generatedAt": "2024-12-13T12:00:00.000Z"
  }
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 423 | Locked - Account temporarily locked |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error |

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests/15 min |
| Authentication | 5 requests/15 min |
| Report Creation | 10 requests/hour |
| Alert Broadcast | 10 requests/hour |
| Search/Analytics | 30 requests/min |
| Password Reset | 3 requests/hour |

---

## WebSocket Events

Connect to WebSocket: `ws://localhost:5000`

### Emitted Events

| Event | Description |
|-------|-------------|
| `newReport` | New report created |
| `reportModerated` | Report status changed |
| `reportDeleted` | Report deleted |
| `newAlert` | New alert broadcasted |
| `alertCancelled` | Alert cancelled/expired |
| `personalAlert` | Alert for specific user |
| `locationUpdated` | User location updated |

### Example WebSocket Usage

```javascript
const socket = io('http://localhost:5000');

// Listen for new alerts
socket.on('newAlert', (alert) => {
  console.log('New alert:', alert);
});

// Join user room for personal alerts
socket.emit('joinRoom', { room: `user:${userId}` });
```

---

## Categories

### Report Categories
- `accident` - Traffic/Vehicle accidents
- `crime` - Criminal activity
- `fire` - Fire incidents
- `weather` - Weather-related
- `health` - Health emergencies
- `infrastructure` - Infrastructure issues
- `environmental` - Environmental hazards
- `other` - Other incidents

### Alert Types
- `emergency` - General emergency
- `weather` - Weather alerts
- `traffic` - Traffic alerts
- `health` - Health advisories
- `crime` - Crime alerts
- `fire` - Fire warnings
- `flood` - Flood warnings
- `earthquake` - Earthquake alerts
- `tsunami` - Tsunami warnings
- `terrorism` - Security threats
- `other` - Other alerts

---

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `user` | Regular user | Create reports, verify reports |
| `responder` | Emergency responder | + Create alerts, view analytics |
| `admin` | Administrator | + Moderate reports, full analytics |
| `super_admin` | Super Administrator | Full system access |

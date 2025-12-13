# Socket.IO Real-Time Setup

QuickAlert uses Socket.IO for real-time communication between the server and clients. This document covers all socket events, connection management, and integration details.

---

## Table of Contents

1. [Connection Setup](#connection-setup)
2. [Server-Side Emit Events](#server-side-emit-events)
3. [Client-Side Listen Events](#client-side-listen-events)
4. [Connection Management](#connection-management)
5. [Geo-Filtered Broadcasting](#geo-filtered-broadcasting)
6. [Client Integration Examples](#client-integration-examples)

---

## Connection Setup

### Server Configuration

```javascript
// server.js
const { Server } = require('socket.io');
const { initializeSocket } = require('./sockets/socketHandler');

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

initializeSocket(io);
app.set('io', io);
```

### Client Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token' // Optional: for authenticated connections
  }
});
```

---

## Server-Side Emit Events

These events are emitted by the server to connected clients.

### 1. `newReport`

**Trigger:** New report created via `POST /api/reports`

**Geo-Filter:** 10km radius from report location

**Data Emitted:**
```javascript
{
  reportId: "ObjectId",
  location: [longitude, latitude],
  type: "accident|fire|flood|crime|medical|infrastructure|weather|other",
  status: "unverified"
}
```

**Usage in Route:**
```javascript
const io = req.app.get('io');
if (io && io.emitNewReport) {
  io.emitNewReport({
    reportId: report._id,
    location: report.location.coordinates,
    type: report.category,
    status: 'unverified'
  });
}
```

---

### 2. `reportVerified`

**Trigger:** Report verification reaches ≥3 confirmations via `POST /api/reports/:id/verify`

**Broadcast:** All connected clients

**Data Emitted:**
```javascript
{
  reportId: "ObjectId",
  newStatus: "verified|rejected",
  verificationCount: 3
}
```

**Usage in Route:**
```javascript
const io = req.app.get('io');
if (io && io.emitReportVerified) {
  io.emitReportVerified({
    reportId: report._id,
    newStatus: report.verificationStatus,
    verificationCount: report.votes.up
  });
}
```

---

### 3. `officialAlert`

**Trigger:** Official alert broadcast via `POST /api/alerts`

**Geo-Filter:** Alert's `targetArea.radius` (default 10km)

**Data Emitted:**
```javascript
{
  alertId: "ObjectId",
  title: "Alert Title",
  description: "Alert description",
  type: "weather|fire|flood|earthquake|tsunami|crime|health|traffic|infrastructure|other",
  severity: "advisory|warning|critical|emergency",
  targetArea: {
    coordinates: [longitude, latitude],
    radius: 10
  },
  instructions: ["Instruction 1", "Instruction 2"],
  effectiveUntil: "ISO Date String",
  createdAt: "ISO Date String"
}
```

**Usage in Route:**
```javascript
const io = req.app.get('io');
if (io && io.emitOfficialAlert) {
  io.emitOfficialAlert(alert);
}
```

---

### 4. `reportModerated`

**Trigger:** Admin moderates report via `PATCH /api/reports/:id/moderate`

**Broadcast:** All connected clients

**Data Emitted:**
```javascript
{
  reportId: "ObjectId",
  action: "approve|reject|remove|flag",
  moderatedBy: "ObjectId"
}
```

**Usage in Route:**
```javascript
const io = req.app.get('io');
if (io && io.emitReportModerated) {
  io.emitReportModerated(report, action, req.user._id);
}
```

---

### 5. `userCountUpdate`

**Trigger:** Client requests population count via `requestPopulation` event

**Response:** Sent to requesting socket only

**Data Emitted:**
```javascript
{
  count: 42,
  location: [longitude, latitude]
}
```

---

## Client-Side Listen Events

These events are sent by clients to the server.

### 1. `joinLocation`

**Purpose:** Update user's location and join geo-based room

**Client Sends:**
```javascript
socket.emit('joinLocation', {
  userId: "ObjectId",       // Required
  latitude: 40.7128,        // Required
  longitude: -74.0060       // Required
});
```

**Server Actions:**
- Stores user in `connectedUsers` Map
- Creates/updates Session document in database
- Enables geo-filtered event delivery

---

### 2. `leaveLocation`

**Purpose:** Remove user from location tracking

**Client Sends:**
```javascript
socket.emit('leaveLocation');
```

**Server Actions:**
- Removes user from `connectedUsers` Map
- Deletes Session document from database

---

### 3. `requestPopulation`

**Purpose:** Get count of nearby users

**Client Sends:**
```javascript
socket.emit('requestPopulation', {
  latitude: 40.7128,
  longitude: -74.0060,
  radiusKm: 5              // Optional, default: 5km
});
```

**Server Response:**
```javascript
// Server emits 'userCountUpdate' back to the requesting socket
{
  count: 15,
  location: [-74.0060, 40.7128]
}
```

---

## Connection Management

### Connected Users Tracking

```javascript
// In-memory Map structure
connectedUsers = Map {
  'socket_id_1' => { userId: 'user_id_1', location: [lng, lat] },
  'socket_id_2' => { userId: 'user_id_2', location: [lng, lat] },
  // ...
}
```

### Session Database Schema

```javascript
{
  socketId: String,           // Socket connection ID
  userId: ObjectId,           // Reference to User
  location: {
    type: 'Point',
    coordinates: [Number]     // [longitude, latitude]
  },
  connectionInfo: {
    ipAddress: String,
    userAgent: String,
    connectedAt: Date
  },
  lastSeen: Date,             // Updated every 5 minutes
  createdAt: Date             // TTL: auto-delete after 24 hours
}
```

### Automatic Cleanup

| Interval | Action |
|----------|--------|
| 5 minutes | Update `lastSeen` for all connected users |
| 1 hour | Remove stale sessions (disconnected but not cleaned up) |
| 24 hours | TTL auto-expire Session documents in MongoDB |

### Connection Lifecycle

```
Client Connects
      ↓
'connection' event fired
      ↓
Client emits 'joinLocation' with userId + coordinates
      ↓
Server stores in connectedUsers Map + creates Session doc
      ↓
Client receives geo-filtered events based on location
      ↓
Client emits 'leaveLocation' OR disconnects
      ↓
Server removes from Map + deletes Session doc
```

---

## Geo-Filtered Broadcasting

### How It Works

When emitting events like `newReport` or `officialAlert`, the server:

1. Calculates distance between event location and each connected user
2. Only emits to users within the specified radius
3. Uses Haversine formula for accurate distance calculation

### Distance Calculation

```javascript
function distanceBetweenCoords(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}
```

### Radius Defaults

| Event | Default Radius |
|-------|---------------|
| `newReport` | 10 km |
| `officialAlert` | Alert's `targetArea.radius` (default 10 km) |
| `requestPopulation` | 5 km (configurable) |

---

## Client Integration Examples

### React Native Example

```javascript
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

const useSocket = (userId, location) => {
  const [socket, setSocket] = useState(null);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    // Join with location
    newSocket.emit('joinLocation', {
      userId,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    // Listen for new reports
    newSocket.on('newReport', (data) => {
      setNearbyReports(prev => [data, ...prev]);
    });

    // Listen for official alerts
    newSocket.on('officialAlert', (data) => {
      setAlerts(prev => [data, ...prev]);
      // Show push notification
      showNotification(data.title, data.description);
    });

    // Listen for report verifications
    newSocket.on('reportVerified', (data) => {
      setNearbyReports(prev => 
        prev.map(r => r.reportId === data.reportId 
          ? { ...r, status: data.newStatus } 
          : r
        )
      );
    });

    // Listen for moderation actions
    newSocket.on('reportModerated', (data) => {
      if (data.action === 'remove') {
        setNearbyReports(prev => 
          prev.filter(r => r.reportId !== data.reportId)
        );
      }
    });

    // Cleanup on unmount
    return () => {
      newSocket.emit('leaveLocation');
      newSocket.disconnect();
    };
  }, [userId, location]);

  // Function to request nearby user count
  const requestPopulation = (radiusKm = 5) => {
    if (socket) {
      socket.emit('requestPopulation', {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm,
      });
    }
  };

  return { socket, nearbyReports, alerts, requestPopulation };
};
```

### Web (JavaScript) Example

```javascript
const socket = io('http://localhost:5000');

// Join with location
navigator.geolocation.getCurrentPosition((position) => {
  socket.emit('joinLocation', {
    userId: currentUser.id,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
});

// Event listeners
socket.on('newReport', (data) => {
  console.log('New report nearby:', data);
  addReportToMap(data.location, data.type);
});

socket.on('officialAlert', (data) => {
  console.log('Official alert:', data);
  showAlertBanner(data);
});

socket.on('reportVerified', (data) => {
  console.log('Report verified:', data);
  updateReportStatus(data.reportId, data.newStatus);
});

socket.on('reportModerated', (data) => {
  console.log('Report moderated:', data);
  if (data.action === 'remove') {
    removeReportFromMap(data.reportId);
  }
});

socket.on('userCountUpdate', (data) => {
  console.log(`${data.count} users nearby`);
  updatePopulationDisplay(data.count);
});

// Update location periodically
setInterval(() => {
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit('joinLocation', {
      userId: currentUser.id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  });
}, 60000); // Every minute

// Cleanup
window.addEventListener('beforeunload', () => {
  socket.emit('leaveLocation');
  socket.disconnect();
});
```

---

## Error Handling

### Server-Side

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Handle invalid data
socket.on('joinLocation', (data) => {
  if (!data.userId || !data.latitude || !data.longitude) {
    socket.emit('error', { message: 'Invalid location data' });
    return;
  }
  // Process valid data...
});
```

### Client-Side

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Retry logic or show error to user
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected, need to reconnect manually
    socket.connect();
  }
});
```

---

## Testing Socket Events

### Using Socket.IO Client CLI

```bash
# Install
npm install -g socket.io-client

# Connect and test
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  socket.emit('joinLocation', {
    userId: 'test-user-id',
    latitude: 40.7128,
    longitude: -74.0060
  });
});

socket.on('newReport', (data) => {
  console.log('New Report:', data);
});

socket.on('officialAlert', (data) => {
  console.log('Alert:', data);
});
"
```

### Using Postman

1. Create a new Socket.IO request
2. Connect to `http://localhost:5000`
3. Emit `joinLocation` with test data
4. Listen for incoming events

---

## Performance Considerations

1. **In-Memory vs Database:** `connectedUsers` Map is in-memory for fast lookups; Session collection provides persistence
2. **Geo-Filtering:** Done in-memory using Haversine formula (O(n) where n = connected users)
3. **Batch Updates:** `lastSeen` updates batched every 5 minutes to reduce database writes
4. **Cleanup:** Stale session cleanup prevents memory leaks

---

## Security

1. **Authentication:** Optional JWT token in socket auth for user identification
2. **Rate Limiting:** Socket events can be rate-limited if needed
3. **Input Validation:** All incoming data validated before processing
4. **Room Isolation:** Users only receive events relevant to their location

---

*Last Updated: December 2024*

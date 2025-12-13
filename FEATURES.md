# QuickAlert - Feature Documentation

## Overview

QuickAlert is a real-time emergency reporting and alert system designed for communities to report incidents, receive official alerts, and enable administrators to manage emergency responses effectively.

---

## 6. Population Estimation Tool

### Location
`/client/src/components/Map/PopulationEstimator.jsx`

### Access Control
- **Roles**: `admin`, `super_admin`, `responder` (alert role)
- Regular users cannot access this tool

### Features

#### Drawing Tools
- **Polygon**: Click to add points, close by clicking the first point
- **Circle**: Click and drag to define area with radius
- Uses Leaflet Draw library for interactive drawing

#### Population Estimation
- Click "Estimate Population" button after drawing an area
- Calls `GET /api/analytics/population?polygon=[[coords]]`
- Displays: "Estimated X active users in this area"

#### Heatmap Overlay
- Toggle heatmap visualization using `leaflet.heat` plugin
- Shows user density with color gradient:
  - Blue → Green → Yellow → Red (low to high density)
- Configurable radius and blur settings

#### Recent Reporters List
- Shows users who have submitted reports in the selected zone
- Displays: Name, last report title, timestamp
- Limited to 10 most recent reporters

### Usage
```jsx
import PopulationEstimator from './components/Map/PopulationEstimator';

// Inside MapView component (as a child)
<MapView>
  {showPopulationTool && (
    <PopulationEstimator
      onClose={() => setShowPopulationTool(false)}
      isAdmin={isAdmin}
      isAlert={isResponder}
    />
  )}
</MapView>
```

---

## 7. Admin Dashboard

### Location
`/client/src/components/Dashboard/AdminPanel.jsx`

### Features

#### Reports Table with Filters
| Filter | Options |
|--------|---------|
| Status | All, Pending, Unverified, Verified, Rejected, Flagged |
| Category | Accident, Fire, Crime, Medical, Natural Disaster, Infrastructure, Traffic, Other |
| Date Range | Start Date, End Date |

#### Moderation Actions
| Action | Description |
|--------|-------------|
| ✓ Approve | Mark report as verified manually |
| ✕ Reject | Remove from public map (requires reason) |
| 🚩 Flag | Mark for further review |

#### User Management (Super Admin Only)
- **View all users**: Table with name, email, role, status, join date
- **Promote**: Upgrade user to `alert` role (responder)
- **Demote**: Downgrade responder back to `user` role
- **Ban/Unban**: Disable or re-enable user accounts

#### Analytics Cards
| Metric | Description |
|--------|-------------|
| Reports (24h) | Total reports in last 24 hours |
| Verification Rate | Percentage of verified reports |
| Active Users | Users in monitored area |
| Avg Response Time | Average time to resolve reports |

#### Tabs
1. **Overview**: Quick stats, recent alerts, pending reports
2. **All Reports**: Full table with filters
3. **Pending**: Reports awaiting moderation
4. **Alerts**: Manage active/resolved alerts
5. **Users**: User management (super admin)
6. **Analytics**: Charts and statistics

---

## 8. Real-Time Updates (Socket.IO)

### Location
`/client/src/services/socket.js`

### Connection
```javascript
// Connect on component mount
const token = localStorage.getItem('token');
socketService.connect(token);

// Join location-based room
socketService.joinLocation(latitude, longitude);
```

### Events Listened

| Event | Action |
|-------|--------|
| `newReport` | Add new marker to map |
| `reportVerified` | Update marker color/status |
| `newAlert` | Show browser notification + in-app banner |
| `alertCancelled` | Remove/update alert on map |
| `alertResolved` | Update alert status |

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `joinLocation` | Map loads | `{ lat, lng }` |
| `leaveLocation` | Component unmount | `{ lat, lng }` |

### Cleanup
```javascript
// On component unmount
useEffect(() => {
  return () => {
    socketService.leaveLocation();
    unsubscribeReport();
    unsubscribeAlert();
  };
}, []);
```

---

## 9. Browser Notifications

### Location
- `/client/src/hooks/useNotifications.js`
- `/client/src/utils/notificationHelper.js`
- `/client/src/components/Shared/NotificationCenter.jsx`

### Permission Request
- Automatically requested on first visit (after 3 second delay)
- User can manually enable via NotificationCenter

### Notification Types

#### Official Alert Notification
```javascript
showAlertNotification(alert);
// Shows: 🚨 [SEVERITY] Alert Title
// Body: Alert description (truncated)
// Click: Navigate to /map?lat=X&lng=Y&alertId=ID
```

#### Report Notification
```javascript
showReportNotification(report);
// Shows: [Category Emoji] New [category] Report
// Body: Report title
// Click: Navigate to map with report focused
```

### Additional Features
- **Sound**: Plays alert sound for critical/high severity
- **Vibration**: Device vibration pattern based on severity
- **In-App Center**: Dropdown with notification history
- **Unread Badge**: Shows count of unread notifications

### Usage
```jsx
import useNotifications from '../hooks/useNotifications';

const MyComponent = () => {
  const {
    permission,
    requestPermission,
    notifications,
    unreadCount,
    markAllAsRead,
    isConnected,
  } = useNotifications({
    enableAlerts: true,
    enableReports: true,
    playSound: true,
    vibrate: true,
  });
  
  // ...
};
```

---

## 10. Responsive Design

### Approach
- **Mobile-first**: Base styles for mobile, enhanced for larger screens
- **Breakpoints**: `sm: 640px`, `md: 768px`, `lg: 1024px`

### Touch-Friendly Elements
- All interactive elements: minimum `44x44px` touch target
- Tailwind class: `min-h-11 min-w-11` or `min-h-[44px] min-w-[44px]`

### Bottom Sheet (Mobile)
Location: `/client/src/components/Shared/BottomSheet.jsx`

```jsx
// Forms slide up from bottom on mobile
<div className="absolute bottom-0 left-0 right-0 sm:bottom-auto sm:top-4 sm:right-4">
  {/* Content */}
</div>
```

Features:
- Swipe down to close
- Drag handle indicator
- Max height: 90vh
- Rounded top corners

### Navigation
- Desktop: Horizontal nav links
- Mobile: Hamburger menu with slide-out panel
- Profile dropdown adapts to screen size

### Map Controls
- Filters collapse to icons on mobile
- Stats bar below header on small screens
- Detail panels become bottom sheets

### CSS Utilities Added
Location: `/client/src/App.css`

```css
/* Safe area for notched devices */
.safe-area-top { padding-top: max(env(safe-area-inset-top), 16px); }
.safe-area-bottom { padding-bottom: max(env(safe-area-inset-bottom), 16px); }

/* Bottom sheet animation */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Touch target sizing */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}
```

---

## File Structure

### New Files Created
```
client/src/
├── components/
│   ├── Map/
│   │   └── PopulationEstimator.jsx    # Population estimation tool
│   └── Shared/
│       ├── NotificationCenter.jsx      # In-app notification dropdown
│       └── BottomSheet.jsx             # Mobile bottom sheet modal
└── hooks/
    ├── index.js                        # Hooks barrel export
    └── useNotifications.js             # Browser notifications hook
```

### Modified Files
```
client/src/
├── components/
│   ├── Dashboard/
│   │   └── AdminPanel.jsx              # Enhanced with all admin features
│   └── Shared/
│       └── Navbar.jsx                  # Added NotificationCenter
├── pages/
│   └── MapPage.jsx                     # Population tool, responsive updates
├── services/
│   └── api.js                          # Added usersApi endpoints
└── App.css                             # Responsive design styles
```

---

## API Endpoints Used

### Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/population` | GET | Get user count in polygon/radius |
| `/api/analytics/heatmap` | GET | Get heatmap data points |
| `/api/analytics/reports` | GET | Get report statistics |
| `/api/analytics/alerts` | GET | Get alert statistics |

### Users (Admin)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET | List all users |
| `/api/users/:id/role` | PUT | Update user role |
| `/api/users/:id/ban` | PUT | Ban user |
| `/api/users/:id/unban` | PUT | Unban user |

### Reports (Moderation)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/:id/moderate` | PUT | Moderate report (verify/reject/flag) |

---

## Dependencies

### Required npm packages (already installed)
```json
{
  "leaflet": "^1.9.4",
  "leaflet-draw": "^1.0.4",
  "leaflet.heat": "^0.2.0",
  "react-leaflet": "^5.0.0",
  "react-leaflet-draw": "^0.21.0",
  "socket.io-client": "^4.8.1"
}
```

---

## Configuration

### Environment Variables
```env
VITE_API_URL=/api
VITE_SOCKET_URL=http://localhost:5000
```

### Socket.IO Connection
- Auto-reconnect enabled (5 attempts)
- Supports both WebSocket and polling transports
- Authentication via JWT token in auth header

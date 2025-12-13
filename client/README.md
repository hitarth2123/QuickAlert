# QuickAlert Frontend

React-based frontend for the QuickAlert emergency management system.

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool with HMR
- **React Router v7** - Client-side routing
- **Tailwind CSS v4** - Utility-first styling
- **Leaflet / React-Leaflet** - Interactive maps
- **Leaflet Draw** - Geo-fence drawing tools
- **Leaflet Heat** - Heatmap visualization
- **Socket.IO Client** - Real-time updates
- **Axios** - HTTP client

## Project Structure

```
src/
├── components/
│   ├── Dashboard/
│   │   ├── AdminPanel.jsx      # Admin management interface
│   │   ├── AlertDashboard.jsx  # Alert listing with filters
│   │   └── UserDashboard.jsx   # User's reports/alerts view
│   ├── Forms/
│   │   ├── AlertForm.jsx       # Admin alert creation
│   │   ├── LoginForm.jsx       # User login
│   │   ├── RegisterForm.jsx    # User registration
│   │   └── ReportForm.jsx      # Incident report submission
│   ├── Map/
│   │   ├── GeoFenceTool.jsx    # Drawing tool for alert areas
│   │   ├── IncidentMarker.jsx  # Category-based map markers
│   │   └── MapView.jsx         # Main map with all features
│   └── Shared/
│       ├── Navbar.jsx          # Responsive navigation
│       ├── Notification.jsx    # Toast notification system
│       └── ProtectedRoute.jsx  # Role-based route protection
├── context/
│   ├── AuthContext.jsx         # Authentication state management
│   └── LocationContext.jsx     # GPS tracking & socket sync
├── pages/
│   ├── AdminPage.jsx           # Admin dashboard
│   ├── AlertPage.jsx           # Public alerts view
│   ├── DashboardPage.jsx       # User dashboard
│   ├── Home.jsx                # Landing page
│   ├── LoginPage.jsx           # Login page
│   ├── MapPage.jsx             # Full-screen map
│   ├── NotFoundPage.jsx        # 404 page
│   ├── ProfilePage.jsx         # User profile
│   ├── RegisterPage.jsx        # Registration page
│   ├── ReportPage.jsx          # Submit report page
│   └── UnauthorizedPage.jsx    # 403 page
├── services/
│   ├── api.js                  # Axios API client
│   └── socket.js               # Socket.IO service
├── utils/
│   ├── geoLocation.js          # Browser Geolocation API
│   └── notificationHelper.js   # Push notification utilities
├── App.jsx                     # Main app with routing
├── index.css                   # Tailwind imports
└── main.jsx                    # Entry point
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend server running (see `/server/README.md`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173` (or next available port).

### Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Features

### Public Features
- 🗺️ Interactive map with incident markers
- 🔥 Heatmap visualization of incident density
- 📍 Real-time location updates
- 🚨 Live alert notifications
- 📱 Responsive mobile design

### User Features
- 📝 Submit incident reports with photos
- 👤 User dashboard with report history
- ✅ Verify other users' reports
- 🔔 Push notifications for nearby alerts
- ⚙️ Profile management

### Admin Features
- 📊 Analytics dashboard
- 🎯 Create geo-fenced alerts
- ✓ Moderate and verify reports
- 👥 User management
- 📈 Real-time statistics

## Map Categories

The system supports these incident categories:
- 🚗 Accident
- 🔥 Fire
- 🚔 Crime
- 🏥 Medical
- 🌪️ Weather
- 🏗️ Infrastructure
- ⚠️ Hazard
- 📌 Other

## API Integration

The frontend connects to the backend API via:
- **REST API** - Standard CRUD operations
- **Socket.IO** - Real-time updates for:
  - New reports
  - Report status changes
  - New alerts
  - Alert updates
  - User location tracking

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation as useGeoLocation } from '../context/LocationContext';
import { useState, useEffect } from 'react';
import { alertsApi, reportsApi } from '../services/api';

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const { location, getLocation, error: locationError } = useGeoLocation();
  const [nearbyStats, setNearbyStats] = useState({ alerts: 0, reports: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location) {
      fetchNearbyStats();
    }
  }, [location]);

  const fetchNearbyStats = async () => {
    setLoading(true);
    try {
      const [alertsRes, reportsRes] = await Promise.all([
        alertsApi.getNearby(location.latitude, location.longitude, 10000),
        reportsApi.getNearby(location.latitude, location.longitude, 10000),
      ]);
      setNearbyStats({
        alerts: alertsRes.data.data?.length || 0,
        reports: reportsRes.data.data?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch nearby stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: '🗺️',
      title: 'Real-Time Map',
      description: 'View incidents and alerts on an interactive map',
    },
    {
      icon: '📝',
      title: 'Report Incidents',
      description: 'Help your community by reporting emergencies',
    },
    {
      icon: '🚨',
      title: 'Instant Alerts',
      description: 'Get notified about emergencies in your area',
    },
    {
      icon: '✓',
      title: 'Community Verified',
      description: 'Reports are verified by community members',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold">
              Stay Safe with{' '}
              <span className="text-yellow-300">QuickAlert</span>
            </h1>
            <p className="mt-4 text-xl text-red-100 max-w-2xl mx-auto">
              Real-time emergency reporting and alerts for your community.
              Report incidents, get notified, stay informed.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/map"
                className="px-8 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
              >
                🗺️ View Live Map
              </Link>
              <Link
                to={isAuthenticated ? '/report' : '/register'}
                className="px-8 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-400 transition-colors border-2 border-white/30"
              >
                📝 Report Incident
              </Link>
            </div>

            {/* Location status */}
            {location ? (
              <div className="mt-8 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span>Location active • {nearbyStats.alerts} alerts, {nearbyStats.reports} reports nearby</span>
              </div>
            ) : (
              <button
                onClick={getLocation}
                className="mt-8 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/20 transition-colors"
              >
                <span>📍</span>
                <span>Enable location for nearby alerts</span>
              </button>
            )}
          </div>
        </div>

        {/* Wave decoration */}
        <div className="h-16 bg-gray-50" style={{
          clipPath: 'ellipse(70% 100% at 50% 100%)',
          marginTop: '-1px'
        }}></div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900">
            How It Works
          </h2>
          <p className="mt-2 text-center text-gray-600 max-w-2xl mx-auto">
            QuickAlert connects communities with real-time emergency information
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">{feature.icon}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl font-bold">Ready to Stay Safe?</h2>
            <p className="mt-4 text-gray-300 max-w-xl mx-auto">
              Join thousands of community members who use QuickAlert to stay
              informed about emergencies in their area.
            </p>

            {!isAuthenticated ? (
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="px-8 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <div className="mt-8">
                <Link
                  to="/dashboard"
                  className="px-8 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors inline-block"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <span className="text-white font-bold">QuickAlert</span>
            </div>
            <p className="mt-4 md:mt-0 text-sm">
              © 2024 QuickAlert. Keeping communities safe.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

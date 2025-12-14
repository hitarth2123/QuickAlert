import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsApi, alertsApi } from '../../services/api';
import { useLocation as useGeoLocation } from '../../context/LocationContext';

const UserDashboard = () => {
  const { user } = useAuth();
  const { location } = useGeoLocation();
  const routeLocation = useLocation();
  
  const [myReports, setMyReports] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    verifiedReports: 0,
    activeAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's own reports (filter by reporter ID)
      const userId = user._id || user.id;
      const reportsRes = await reportsApi.getAll({ 
        limit: 5, 
        sort: '-createdAt',
        reporter: userId 
      });
      setMyReports(reportsRes.data.data || []);

      // Fetch nearby alerts and reports if location available
      if (location) {
        const [alertsRes, nearbyReportsRes] = await Promise.all([
          alertsApi.getNearby(location.latitude, location.longitude, 10000),
          reportsApi.getNearby(location.latitude, location.longitude, 10000)
        ]);
        setNearbyAlerts(alertsRes.data.data || []);
        
        // Filter out user's own reports from nearby reports
        const otherReports = (nearbyReportsRes.data.data || []).filter(
          r => r.reporter?._id !== userId && r.reporter?.id !== userId && r.reporter !== userId
        );
        setNearbyReports(otherReports);
      }

      // Calculate stats
      const allReports = reportsRes.data.data || [];
      setStats({
        totalReports: reportsRes.data.pagination?.total || allReports.length,
        verifiedReports: allReports.filter((r) => r.status === 'verified').length,
        activeAlerts: (await alertsApi.getAll({ status: 'active', limit: 1 })).data.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [location, user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refetch when navigating back to dashboard
  useEffect(() => {
    if (routeLocation.pathname === '/dashboard') {
      fetchDashboardData();
    }
  }, [routeLocation.pathname, fetchDashboardData]);

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white',
    };
    return badges[severity] || 'bg-gray-500 text-white';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-red-100 mt-1">
          Stay informed about incidents in your area
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">My Reports</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalReports}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Verified Reports</p>
              <p className="text-3xl font-bold text-green-600">{stats.verifiedReports}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Alerts Nearby</p>
              <p className="text-3xl font-bold text-red-600">{nearbyAlerts.length}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚨</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active alerts section */}
      {nearbyAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-red-50">
            <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
              <span>🚨</span>
              Active Alerts in Your Area
            </h2>
          </div>
          <div className="divide-y">
            {nearbyAlerts.slice(0, 3).map((alert) => (
              <Link
                key={alert._id}
                to={`/alerts/${alert._id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {alert.description}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(alert.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {nearbyAlerts.length > 3 && (
            <div className="px-6 py-3 bg-gray-50 border-t">
              <Link to="/alerts" className="text-sm text-red-600 hover:text-red-700 font-medium">
                View all alerts →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* My recent reports */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">My Recent Reports</h2>
          <Link
            to="/report"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            + New Report
          </Link>
        </div>
        
        {myReports.length > 0 ? (
          <>
            <div className="divide-y">
              {myReports.map((report) => (
                <Link
                  key={report._id}
                  to={`/reports/${report._id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(report.status)}`}>
                          {report.status}
                        </span>
                        {report.adminVerified && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            🛡️ Admin
                          </span>
                        )}
                        {report.verificationStatus === 'verified' && !report.adminVerified && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            👥 Verified
                          </span>
                        )}
                        <h3 className="font-medium text-gray-900">{report.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {report.category} • {report.votes?.up || report.verificationCount || 0} verifications
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t">
              <Link to="/my-reports" className="text-sm text-red-600 hover:text-red-700 font-medium">
                View all my reports →
              </Link>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <span className="text-4xl">📝</span>
            <p className="text-gray-500 mt-2">You haven't submitted any reports yet</p>
            <Link
              to="/report"
              className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Submit Your First Report
            </Link>
          </div>
        )}
      </div>

      {/* Nearby Reports from Others */}
      {nearbyReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">📍 Reports Nearby</h2>
            <p className="text-sm text-gray-500">Recent reports from your community</p>
          </div>
          <div className="divide-y">
            {nearbyReports.slice(0, 5).map((report) => (
              <Link
                key={report._id}
                to={`/reports/${report._id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(report.status)}`}>
                        {report.status}
                      </span>
                      <h3 className="font-medium text-gray-900">{report.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {report.category} • {report.votes?.up || 0} verifications
                      {report.distance && ` • ${report.distance} km away`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(report.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t">
            <Link to="/map" className="text-sm text-red-600 hover:text-red-700 font-medium">
              View all on map →
            </Link>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/map"
          className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-3xl">🗺️</span>
          <p className="mt-2 font-medium text-gray-900">View Map</p>
        </Link>
        <Link
          to="/report"
          className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-3xl">📝</span>
          <p className="mt-2 font-medium text-gray-900">New Report</p>
        </Link>
        <Link
          to="/alerts"
          className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-3xl">🚨</span>
          <p className="mt-2 font-medium text-gray-900">All Alerts</p>
        </Link>
        <Link
          to="/profile"
          className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-3xl">⚙️</span>
          <p className="mt-2 font-medium text-gray-900">Settings</p>
        </Link>
      </div>
    </div>
  );
};

export default UserDashboard;

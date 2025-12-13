import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsApi, alertsApi, analyticsApi } from '../../services/api';
import AlertForm from '../Forms/AlertForm';

const AdminPanel = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingReports, setPendingReports] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [moderatingReport, setModeratingReport] = useState(null);
  const [moderationReason, setModerationReason] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch analytics
      const [populationRes, reportsStatsRes, alertsStatsRes] = await Promise.all([
        analyticsApi.getPopulation(),
        analyticsApi.getReportStats(),
        analyticsApi.getAlertStats(),
      ]);

      setStats({
        population: populationRes.data.data,
        reports: reportsStatsRes.data.data,
        alerts: alertsStatsRes.data.data,
      });

      // Fetch pending reports
      const pendingRes = await reportsApi.getAll({ status: 'pending', limit: 10 });
      setPendingReports(pendingRes.data.data || []);

      // Fetch recent alerts
      const alertsRes = await alertsApi.getAll({ limit: 5, sort: '-createdAt' });
      setRecentAlerts(alertsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerateReport = async (reportId, status) => {
    try {
      await reportsApi.moderate(reportId, status, moderationReason);
      setPendingReports((prev) => prev.filter((r) => r._id !== reportId));
      setModeratingReport(null);
      setModerationReason('');
    } catch (error) {
      console.error('Moderation failed:', error);
      alert('Failed to moderate report');
    }
  };

  const handleAlertCreated = (alert) => {
    setShowAlertForm(false);
    setRecentAlerts((prev) => [alert.data, ...prev.slice(0, 4)]);
    fetchAdminData();
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'reports', label: 'Pending Reports', icon: '📝', count: pendingReports.length },
    { id: 'alerts', label: 'Manage Alerts', icon: '🚨' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-300 mt-1">
              Manage reports, alerts, and monitor activity
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Logged in as</p>
            <p className="font-medium">{user?.name}</p>
            <span className="inline-block px-2 py-0.5 bg-red-600 rounded text-xs mt-1">
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b">
          <nav className="flex space-x-1 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.count > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-blue-600 text-sm font-medium">Active Users</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {stats?.population?.activeUsers || 0}
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    Total: {stats?.population?.totalUsers || 0}
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-yellow-600 text-sm font-medium">Pending Reports</p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {pendingReports.length}
                  </p>
                  <p className="text-yellow-600 text-xs mt-1">
                    Needs review
                  </p>
                </div>

                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-red-600 text-sm font-medium">Active Alerts</p>
                  <p className="text-3xl font-bold text-red-900">
                    {stats?.alerts?.byStatus?.active || 0}
                  </p>
                  <p className="text-red-600 text-xs mt-1">
                    Total: {stats?.alerts?.total || 0}
                  </p>
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-green-600 text-sm font-medium">Verified Reports</p>
                  <p className="text-3xl font-bold text-green-900">
                    {stats?.reports?.byStatus?.verified || 0}
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    This period
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowAlertForm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  🚨 Create Alert
                </button>
                <Link
                  to="/map"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  🗺️ View Map
                </Link>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  📝 Review Reports ({pendingReports.length})
                </button>
              </div>

              {/* Recent activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent alerts */}
                <div className="border rounded-xl">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold">Recent Alerts</h3>
                  </div>
                  <div className="divide-y">
                    {recentAlerts.slice(0, 3).map((alert) => (
                      <Link
                        key={alert._id}
                        to={`/alerts/${alert._id}`}
                        className="block p-3 hover:bg-gray-50"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{alert.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{formatDate(alert.createdAt)}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Pending reports preview */}
                <div className="border rounded-xl">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold">Pending Reports</h3>
                  </div>
                  <div className="divide-y">
                    {pendingReports.slice(0, 3).map((report) => (
                      <div key={report._id} className="p-3">
                        <div className="flex justify-between">
                          <span className="font-medium">{report.title}</span>
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            pending
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {report.category} • {formatDate(report.createdAt)}
                        </p>
                      </div>
                    ))}
                    {pendingReports.length === 0 && (
                      <p className="p-4 text-gray-500 text-center">No pending reports</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pending Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {pendingReports.length > 0 ? (
                pendingReports.map((report) => (
                  <div key={report._id} className="border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{report.title}</h3>
                        <p className="text-gray-600 mt-1">{report.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>📁 {report.category}</span>
                          <span>🕐 {formatDate(report.createdAt)}</span>
                          <span>👥 {report.verificationCount || 0} verifications</span>
                        </div>
                        {report.imageUrl && (
                          <img
                            src={report.imageUrl}
                            alt="Report"
                            className="mt-3 w-48 h-32 object-cover rounded-lg"
                          />
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleModerateReport(report._id, 'verified')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          ✓ Verify
                        </button>
                        <button
                          onClick={() => setModeratingReport(report)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
                        >
                          ✕ Reject
                        </button>
                        <Link
                          to={`/reports/${report._id}`}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium text-center"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <span className="text-5xl">✅</span>
                  <h3 className="text-xl font-semibold mt-4">All caught up!</h3>
                  <p className="text-gray-500">No pending reports to review</p>
                </div>
              )}
            </div>
          )}

          {/* Manage Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Active Alerts</h3>
                <button
                  onClick={() => setShowAlertForm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  + Create Alert
                </button>
              </div>
              
              {recentAlerts.map((alert) => (
                <div key={alert._id} className="border rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                          alert.severity === 'critical' ? 'bg-red-600' :
                          alert.severity === 'high' ? 'bg-orange-500' :
                          alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {alert.status}
                        </span>
                      </div>
                      <h4 className="font-semibold mt-2">{alert.title}</h4>
                      <p className="text-sm text-gray-500">{formatDate(alert.createdAt)}</p>
                    </div>
                    
                    {alert.status === 'active' && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await alertsApi.resolve(alert._id);
                            fetchAdminData();
                          }}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Reason for cancellation:');
                            if (reason) {
                              await alertsApi.cancel(alert._id, reason);
                              fetchAdminData();
                            }
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reports by category */}
                <div className="border rounded-xl p-4">
                  <h3 className="font-semibold mb-4">Reports by Category</h3>
                  <div className="space-y-2">
                    {Object.entries(stats?.reports?.byCategory || {}).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="capitalize">{category.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{
                                width: `${(count / (stats?.reports?.total || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alerts by severity */}
                <div className="border rounded-xl p-4">
                  <h3 className="font-semibold mb-4">Alerts by Severity</h3>
                  <div className="space-y-2">
                    {['critical', 'high', 'medium', 'low'].map((severity) => {
                      const count = stats?.alerts?.bySeverity?.[severity] || 0;
                      return (
                        <div key={severity} className="flex items-center justify-between">
                          <span className="capitalize">{severity}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  severity === 'critical' ? 'bg-red-600' :
                                  severity === 'high' ? 'bg-orange-500' :
                                  severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${(count / Math.max(stats?.alerts?.total || 1, 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 w-8">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alert Form Modal */}
      {showAlertForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full my-8">
            <AlertForm
              onSuccess={handleAlertCreated}
              onCancel={() => setShowAlertForm(false)}
            />
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {moderatingReport && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold">Reject Report</h3>
            <p className="text-gray-500 text-sm mt-1">
              Provide a reason for rejecting "{moderatingReport.title}"
            </p>
            <textarea
              value={moderationReason}
              onChange={(e) => setModerationReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full mt-4 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setModeratingReport(null);
                  setModerationReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleModerateReport(moderatingReport._id, 'rejected')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

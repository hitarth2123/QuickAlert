import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsApi, alertsApi, analyticsApi, usersApi } from '../../services/api';
import AlertForm from '../Forms/AlertForm';

const AdminPanel = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingReports, setPendingReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [moderatingReport, setModeratingReport] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  
  // Report filters
  const [reportFilters, setReportFilters] = useState({
    status: 'all',
    category: 'all',
    startDate: '',
    endDate: '',
  });
  
  // User management
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAction, setUserAction] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Fetch reports when filters change
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchFilteredReports();
    }
  }, [reportFilters, activeTab]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch analytics
      const [populationRes, reportsStatsRes, alertsStatsRes] = await Promise.all([
        analyticsApi.getPopulation({ radius: 100, lat: 0, lng: 0 }).catch(() => ({ data: { data: {} } })),
        analyticsApi.getReportStats().catch(() => ({ data: { data: {} } })),
        analyticsApi.getAlertStats().catch(() => ({ data: { data: {} } })),
      ]);

      setStats({
        population: populationRes.data.data,
        reports: reportsStatsRes.data.data,
        alerts: alertsStatsRes.data.data,
      });

      // Fetch pending reports
      const pendingRes = await reportsApi.getAll({ status: 'pending', limit: 10, includeAll: true });
      setPendingReports(pendingRes.data.data || []);

      // Fetch recent alerts (include all for admin view)
      const alertsRes = await alertsApi.getAll({ limit: 5, sort: '-createdAt', includeAll: true });
      setRecentAlerts(alertsRes.data.data || []);

      // Fetch users if super admin
      if (isSuperAdmin) {
        try {
          const usersRes = await usersApi.getAll({ limit: 50 });
          setUsers(usersRes.data.data || []);
        } catch (err) {
          console.log('Users API not available');
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredReports = async () => {
    try {
      const params = { limit: 50, includeAll: true };
      if (reportFilters.status !== 'all') params.status = reportFilters.status;
      if (reportFilters.category !== 'all') params.category = reportFilters.category;
      if (reportFilters.startDate) params.startDate = reportFilters.startDate;
      if (reportFilters.endDate) params.endDate = reportFilters.endDate;

      const res = await reportsApi.getAll(params);
      setAllReports(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const handleModerateReport = async (reportId, status) => {
    try {
      await reportsApi.moderate(reportId, status, moderationReason);
      setPendingReports((prev) => prev.filter((r) => r._id !== reportId));
      setAllReports((prev) => prev.map((r) => 
        r._id === reportId ? { ...r, status, moderatedAt: new Date() } : r
      ));
      setModeratingReport(null);
      setModerationReason('');
    } catch (error) {
      console.error('Moderation failed:', error);
      alert('Failed to moderate report');
    }
  };

  const handleFlagReport = async (reportId) => {
    try {
      await reportsApi.moderate(reportId, 'flagged', 'Flagged for review');
      setAllReports((prev) => prev.map((r) => 
        r._id === reportId ? { ...r, status: 'flagged' } : r
      ));
    } catch (error) {
      console.error('Flag failed:', error);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      switch (action) {
        case 'promote':
          await usersApi.updateRole(userId, 'alert');
          break;
        case 'demote':
          await usersApi.updateRole(userId, 'user');
          break;
        case 'ban':
          await usersApi.ban(userId);
          break;
        case 'unban':
          await usersApi.unban(userId);
          break;
      }
      // Refresh users
      const usersRes = await usersApi.getAll({ limit: 50 });
      setUsers(usersRes.data.data || []);
      setSelectedUser(null);
      setUserAction(null);
    } catch (error) {
      console.error('User action failed:', error);
      alert('Failed to perform action');
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

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      unverified: 'bg-gray-100 text-gray-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      dismissed: 'bg-gray-100 text-gray-600',
      flagged: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
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
    { id: 'reports', label: 'All Reports', icon: '📝' },
    { id: 'pending', label: 'Pending', icon: '⏳', count: pendingReports.length },
    { id: 'alerts', label: 'Alerts', icon: '🚨' },
    { id: 'users', label: 'Users', icon: '👥', show: isSuperAdmin },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ].filter((tab) => tab.show !== false);

  // Calculate analytics cards data
  const last24hReports = stats?.reports?.overTime?.slice(-1)[0]?.count || 0;
  const verificationRate = stats?.reports?.total 
    ? ((stats?.reports?.verified || 0) / stats.reports.total * 100).toFixed(1)
    : 0;
  const activeUsersCount = stats?.population?.activeUsers || stats?.population?.population || 0;
  const avgResponseTime = stats?.reports?.resolution?.avgResolutionTimeHours?.toFixed(1) || 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 md:p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-300 text-sm md:text-base mt-1">
              Manage reports, alerts, and monitor activity
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin/manage"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              🛡️ Resolve Reports/Alerts
            </Link>
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-400">Logged in as</p>
              <p className="font-medium">{user?.name}</p>
              <span className="inline-block px-2 py-0.5 bg-red-600 rounded text-xs mt-1">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b overflow-x-auto">
          <nav className="flex space-x-1 p-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 md:p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Analytics cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-blue-50 rounded-xl p-3 md:p-4">
                  <p className="text-blue-600 text-xs md:text-sm font-medium">Reports (24h)</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-900">
                    {last24hReports}
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    Total: {stats?.reports?.total || 0}
                  </p>
                </div>

                <div className="bg-green-50 rounded-xl p-3 md:p-4">
                  <p className="text-green-600 text-xs md:text-sm font-medium">Verification Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-900">
                    {verificationRate}%
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    {stats?.reports?.verified || 0} verified
                  </p>
                </div>

                <div className="bg-purple-50 rounded-xl p-3 md:p-4">
                  <p className="text-purple-600 text-xs md:text-sm font-medium">Active Users</p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-900">
                    {activeUsersCount}
                  </p>
                  <p className="text-purple-600 text-xs mt-1">
                    In monitored area
                  </p>
                </div>

                <div className="bg-orange-50 rounded-xl p-3 md:p-4">
                  <p className="text-orange-600 text-xs md:text-sm font-medium">Avg Response</p>
                  <p className="text-2xl md:text-3xl font-bold text-orange-900">
                    {avgResponseTime}h
                  </p>
                  <p className="text-orange-600 text-xs mt-1">
                    Resolution time
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 md:gap-3">
                <button
                  onClick={() => setShowAlertForm(true)}
                  className="px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm md:text-base"
                >
                  🚨 Create Alert
                </button>
                <Link
                  to="/map"
                  className="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm md:text-base"
                >
                  🗺️ View Map
                </Link>
                <button
                  onClick={() => setActiveTab('pending')}
                  className="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm md:text-base"
                >
                  📝 Review ({pendingReports.length})
                </button>
              </div>

              {/* Recent activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Recent alerts */}
                <div className="border rounded-xl overflow-hidden">
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
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm line-clamp-1">{alert.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ml-2 ${
                            alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(alert.createdAt)}</p>
                      </Link>
                    ))}
                    {recentAlerts.length === 0 && (
                      <p className="p-4 text-gray-500 text-center text-sm">No recent alerts</p>
                    )}
                  </div>
                </div>

                {/* Pending reports preview */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold">Pending Reports</h3>
                  </div>
                  <div className="divide-y">
                    {pendingReports.slice(0, 3).map((report) => (
                      <div key={report._id} className="p-3">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm line-clamp-1">{report.title}</span>
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">
                            pending
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {report.category} • {formatDate(report.createdAt)}
                        </p>
                      </div>
                    ))}
                    {pendingReports.length === 0 && (
                      <p className="p-4 text-gray-500 text-center text-sm">No pending reports</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Reports Tab with Filters */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={reportFilters.status}
                      onChange={(e) => setReportFilters((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="unverified">Unverified</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select
                      value={reportFilters.category}
                      onChange={(e) => setReportFilters((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="accident">Accident</option>
                      <option value="fire">Fire</option>
                      <option value="crime">Crime</option>
                      <option value="medical">Medical</option>
                      <option value="natural_disaster">Natural Disaster</option>
                      <option value="infrastructure">Infrastructure</option>
                      <option value="traffic">Traffic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={reportFilters.startDate}
                      onChange={(e) => setReportFilters((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={reportFilters.endDate}
                      onChange={(e) => setReportFilters((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => setReportFilters({ status: 'all', category: 'all', startDate: '', endDate: '' })}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Reports table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allReports.map((report) => (
                      <tr key={report._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{report.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{report.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm capitalize">{report.category?.replace('_', ' ')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded ${getStatusColor(report.status)}`}>
                              {report.status}
                            </span>
                            {report.adminVerified && (
                              <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                                🛡️ Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(report.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleModerateReport(report._id, 'verified')}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setModeratingReport(report);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Reject"
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleFlagReport(report._id)}
                              className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                              title="Flag for review"
                            >
                              🚩
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allReports.length === 0 && (
                  <p className="text-center py-8 text-gray-500">No reports match the current filters</p>
                )}
              </div>
            </div>
          )}

          {/* Pending Reports Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingReports.length > 0 ? (
                pendingReports.map((report) => (
                  <div key={report._id} className="border rounded-xl p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{report.title}</h3>
                        <p className="text-gray-600 mt-1 text-sm line-clamp-2">{report.description}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>📁 {report.category}</span>
                          <span>🕐 {formatDate(report.createdAt)}</span>
                          <span>👥 {report.verificationCount || 0} verifications</span>
                        </div>
                        {report.imageUrl && (
                          <img
                            src={report.imageUrl}
                            alt="Report"
                            className="mt-3 w-32 md:w-48 h-24 md:h-32 object-cover rounded-lg"
                          />
                        )}
                      </div>
                      
                      <div className="flex md:flex-col gap-2">
                        <button
                          onClick={() => handleModerateReport(report._id, 'verified')}
                          className="flex-1 md:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium min-h-[44px]"
                        >
                          ✓ Verify
                        </button>
                        <button
                          onClick={() => setModeratingReport(report)}
                          className="flex-1 md:flex-none px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium min-h-[44px]"
                        >
                          ✕ Reject
                        </button>
                        <button
                          onClick={() => handleFlagReport(report._id)}
                          className="flex-1 md:flex-none px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-sm font-medium min-h-[44px]"
                        >
                          🚩 Flag
                        </button>
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
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium min-h-[44px]"
                >
                  + Create Alert
                </button>
              </div>
              
              {recentAlerts.map((alert) => (
                <div key={alert._id} className="border rounded-xl p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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
                          className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 min-h-[44px]"
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
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 min-h-[44px]"
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

          {/* Users Tab (Super Admin Only) */}
          {activeTab === 'users' && isSuperAdmin && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">User Management</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'admin' ? 'bg-red-100 text-red-800' :
                            u.role === 'alert' || u.role === 'responder' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            u.isBanned ? 'bg-red-100 text-red-800' :
                            u.isActive ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {u.isBanned ? 'Banned' : u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.role === 'user' && (
                              <button
                                onClick={() => handleUserAction(u._id, 'promote')}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Promote to Alert role"
                              >
                                ↑ Promote
                              </button>
                            )}
                            {(u.role === 'alert' || u.role === 'responder') && (
                              <button
                                onClick={() => handleUserAction(u._id, 'demote')}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                title="Demote to User"
                              >
                                ↓ Demote
                              </button>
                            )}
                            {!u.isBanned && u.role !== 'super_admin' && (
                              <button
                                onClick={() => handleUserAction(u._id, 'ban')}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Ban
                              </button>
                            )}
                            {u.isBanned && (
                              <button
                                onClick={() => handleUserAction(u._id, 'unban')}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                Unban
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="text-center py-8 text-gray-500">No users found</p>
                )}
              </div>
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
                        <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{
                                width: `${(count / (stats?.reports?.total || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-8">{count}</span>
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
                          <span className="text-sm capitalize">{severity}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 md:w-32 bg-gray-200 rounded-full h-2">
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
                            <span className="text-xs text-gray-600 w-8">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reports over time */}
              {stats?.reports?.overTime && stats.reports.overTime.length > 0 && (
                <div className="border rounded-xl p-4">
                  <h3 className="font-semibold mb-4">Reports Over Time (Last 30 Days)</h3>
                  <div className="h-40 flex items-end justify-between gap-1">
                    {stats.reports.overTime.slice(-14).map((day, i) => (
                      <div key={day._id} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-red-500 rounded-t"
                          style={{
                            height: `${(day.count / Math.max(...stats.reports.overTime.map(d => d.count))) * 100}%`,
                            minHeight: day.count > 0 ? '4px' : '0',
                          }}
                        />
                        <span className="text-[10px] text-gray-400 mt-1 hidden md:block">
                          {new Date(day._id).getDate()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                className="px-4 py-2 text-gray-600 hover:text-gray-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleModerateReport(moderatingReport._id, 'rejected')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 min-h-[44px]"
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

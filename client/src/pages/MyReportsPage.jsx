import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { notify } from '../components/Shared/Notification';

const MyReportsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const fetchMyReports = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userId = user._id || user.id;
      const response = await reportsApi.getAll({ 
        reporter: userId,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: sortBy === 'newest' ? 'desc' : 'asc'
      });
      setReports(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      notify.error('Failed to load your reports');
    } finally {
      setLoading(false);
    }
  }, [user, sortBy]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMyReports();
    }
  }, [isAuthenticated, user, fetchMyReports]);

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      resolved: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      flagged: 'bg-orange-100 text-orange-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      verified: '✅',
      rejected: '❌',
      resolved: '✔️',
      in_progress: '🔄',
      flagged: '🚩',
    };
    return icons[status] || '📋';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      accident: '🚗',
      fire: '🔥',
      flood: '🌊',
      crime: '🚨',
      medical: '🏥',
      infrastructure: '🏗️',
      weather: '⛈️',
      other: '📋',
    };
    return icons[category] || '📋';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredReports = reports.filter(report => {
    if (filter === 'all') return true;
    return report.status === filter;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    verified: reports.filter(r => r.status === 'verified').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Reports</h1>
          <p className="text-gray-600 mt-1">Track and manage your submitted incident reports</p>
        </div>
        <button
          onClick={() => navigate('/report')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          <span>➕</span>
          New Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
          <p className="text-gray-500 text-sm">Total Reports</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-400">
          <p className="text-gray-500 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-400">
          <p className="text-gray-500 text-sm">Verified</p>
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400">
          <p className="text-gray-500 text-sm">Resolved</p>
          <p className="text-2xl font-bold text-blue-600">{stats.resolved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'verified', 'resolved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <span className="text-6xl mb-4 block">📋</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {filter === 'all' ? 'No reports yet' : `No ${filter} reports`}
          </h3>
          <p className="text-gray-600 mb-6">
            {filter === 'all' 
              ? "You haven't submitted any incident reports yet. Help your community by reporting incidents you witness."
              : `You don't have any reports with "${filter}" status.`
            }
          </p>
          {filter === 'all' && (
            <button
              onClick={() => navigate('/report')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <span>📝</span>
              Submit Your First Report
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Link
              key={report._id}
              to={`/reports/${report._id}`}
              className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Category Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      {getCategoryIcon(report.category)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(report.status)}`}>
                        {getStatusIcon(report.status)} {report.status}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {report.category}
                      </span>
                      {report.adminVerified && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          🛡️ Admin Verified
                        </span>
                      )}
                      {(report.communityVerified || (report.verificationStatus === 'verified' && !report.adminVerified)) && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          👥 Community Verified
                        </span>
                      )}
                      {report.isAnonymous && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          🔒 Anonymous
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {report.title || `${report.category} Incident`}
                    </h3>
                    
                    {report.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                        {report.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        🕐 {formatDate(report.createdAt)}
                      </span>
                      {report.locationDescription && (
                        <span className="flex items-center gap-1 truncate">
                          📍 {report.locationDescription}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        👍 {report.votes?.up || 0} / 👎 {report.votes?.down || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Image Preview (if available) */}
                  {report.imageUrl && (
                    <div className="flex-shrink-0 hidden sm:block">
                      <img
                        src={report.imageUrl}
                        alt="Report"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Status bar at bottom */}
              {report.status === 'verified' && report.alertId && (
                <div className="bg-green-50 px-5 py-2 border-t border-green-100">
                  <span className="text-sm text-green-700">
                    ✅ This report was verified and an alert was created
                  </span>
                </div>
              )}
              {report.status === 'pending' && (
                <div className="bg-yellow-50 px-5 py-2 border-t border-yellow-100">
                  <span className="text-sm text-yellow-700">
                    ⏳ Waiting for community verification ({report.votes?.up || 0}/4 confirmations)
                  </span>
                </div>
              )}
              {report.status === 'rejected' && report.rejectionReason && (
                <div className="bg-red-50 px-5 py-2 border-t border-red-100">
                  <span className="text-sm text-red-700">
                    ❌ Rejected: {report.rejectionReason}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
      
      {/* Help Section */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How Report Verification Works</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <span className="text-xl">1️⃣</span>
            <p>Submit a report about an incident you witness in your area.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xl">2️⃣</span>
            <p>Community members nearby can verify or deny your report.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xl">3️⃣</span>
            <p>Once 4+ people confirm, it gets "Community Verified" badge and an alert is created.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyReportsPage;

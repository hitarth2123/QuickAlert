import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation as useGeoLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { alertsApi } from '../../services/api';
import MapView from '../Map/MapView';
import GeoFenceTool from '../Map/GeoFenceTool';
import FileUpload from '../Shared/FileUpload';
import { notify } from '../Shared/Notification';

const categories = [
  { value: 'accident', label: 'Accident', emoji: '🚗' },
  { value: 'fire', label: 'Fire', emoji: '🔥' },
  { value: 'crime', label: 'Crime', emoji: '🚨' },
  { value: 'medical', label: 'Medical', emoji: '🏥' },
  { value: 'natural_disaster', label: 'Natural Disaster', emoji: '🌊' },
  { value: 'infrastructure', label: 'Infrastructure', emoji: '🏗️' },
  { value: 'traffic', label: 'Traffic', emoji: '🚦' },
  { value: 'weather', label: 'Weather', emoji: '🌧️' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

const severityLevels = [
  { value: 'low', label: 'Info', color: 'bg-blue-500', description: 'Minor impact, awareness only' },
  { value: 'medium', label: 'Warning', color: 'bg-yellow-500', description: 'Moderate impact, caution advised' },
  { value: 'high', label: 'High', color: 'bg-orange-500', description: 'Significant impact, action may be needed' },
  { value: 'critical', label: 'Critical', color: 'bg-red-600', description: 'Severe impact, immediate action required' },
];

const AlertForm = ({ onSuccess, onCancel, editingAlert = null }) => {
  const { location: userLocation } = useGeoLocation();
  const { isAuthenticated, user, isResponder, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Check if user has alert role (responder, admin, or super_admin)
  const hasAlertRole = isResponder || isAdmin || user?.role === 'responder' || user?.role === 'admin' || user?.role === 'super_admin';
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: 'medium',
    location: null,
    affectedArea: { type: 'circle', radius: 5000 },
    instructions: [],
    expiresAt: '',
  });
  
  const [newInstruction, setNewInstruction] = useState({ text: '', priority: 'medium' });
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Redirect if user doesn't have proper role
  useEffect(() => {
    if (!isAuthenticated) {
      notify.warning('Please sign in to create alerts');
      navigate('/login', { state: { from: { pathname: '/admin' } } });
      return;
    }
    
    if (!hasAlertRole) {
      notify.error('You do not have permission to create official alerts');
      navigate('/unauthorized');
    }
  }, [isAuthenticated, hasAlertRole, navigate]);

  // Load editing alert data
  useEffect(() => {
    if (editingAlert) {
      const [lng, lat] = editingAlert.location.coordinates;
      setFormData({
        title: editingAlert.title,
        description: editingAlert.description || '',
        category: editingAlert.category,
        severity: editingAlert.severity,
        location: { lat, lng },
        affectedArea: editingAlert.affectedArea || { type: 'circle', radius: 5000 },
        instructions: editingAlert.instructions || [],
        expiresAt: editingAlert.expiresAt 
          ? new Date(editingAlert.expiresAt).toISOString().slice(0, 16) 
          : '',
      });
    }
  }, [editingAlert]);

  // Use user's location as default
  useEffect(() => {
    if (!editingAlert && userLocation && !formData.location) {
      setFormData((prev) => ({
        ...prev,
        location: {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        },
      }));
    }
  }, [userLocation, editingAlert]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleMediaUpload = (files) => {
    setUploadedMedia(prev => [...prev, ...files]);
  };

  const handleMediaError = (error) => {
    setError(error.message || 'Failed to upload media');
  };

  const removeMedia = (index) => {
    setUploadedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({ ...prev, location }));
    setShowMap(false);
  };

  const handleGeoFenceCreate = (geoFence) => {
    if (geoFence.type === 'circle') {
      setFormData((prev) => ({
        ...prev,
        location: geoFence.center,
        affectedArea: {
          type: 'circle',
          radius: geoFence.radius,
        },
      }));
    }
  };

  const handleAddInstruction = () => {
    if (!newInstruction.text.trim()) return;
    
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, { ...newInstruction }],
    }));
    setNewInstruction({ text: '', priority: 'medium' });
  };

  const handleRemoveInstruction = (index) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Please enter a title');
      return false;
    }
    if (!formData.category) {
      setError('Please select a category');
      return false;
    }
    if (!formData.location) {
      setError('Please select a location');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Double-check authorization
    if (!hasAlertRole) {
      setError('You are not authorized to create alerts');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const alertData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.category,
        severity: formData.severity,
        targetArea: {
          coordinates: [formData.location.lng, formData.location.lat],
          radius: formData.affectedArea?.radius ? formData.affectedArea.radius / 1000 : 10, // Convert to km
        },
        instructions: formData.instructions.length > 0 ? formData.instructions : undefined,
        effectiveUntil: formData.expiresAt || undefined,
        // Include uploaded media from UploadThing
        media: uploadedMedia.map(m => ({
          url: m.url,
          key: m.key,
          type: m.type,
        })),
      };

      let response;
      if (editingAlert) {
        response = await alertsApi.update(editingAlert._id, alertData);
        notify.success('Alert updated successfully');
      } else {
        response = await alertsApi.create(alertData);
        notify.success('Alert published! Users in the affected area will be notified.');
      }

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Alert submission error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create alert. Please try again.';
      setError(errorMessage);
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user doesn't have permission
  if (!hasAlertRole) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <span className="text-6xl">🔒</span>
        <h2 className="text-xl font-bold text-gray-900 mt-4">Access Denied</h2>
        <p className="text-gray-600 mt-2">
          Only authorized personnel (responders and administrators) can create official alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🚨</span>
          {editingAlert ? 'Edit Alert' : 'Create Official Alert'}
        </h2>
        <p className="text-red-100 text-sm mt-1">
          Issue an official emergency alert to notify users in the affected area
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Brief, clear title for the alert"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            maxLength={100}
          />
        </div>

        {/* Category & Severity row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.emoji} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity Level *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {severityLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, severity: level.value }))}
                  className={`px-3 py-2 rounded-lg text-white text-sm font-medium transition-all ${level.color} ${
                    formData.severity === level.value
                      ? 'ring-2 ring-offset-2 ring-gray-500'
                      : 'opacity-60 hover:opacity-80'
                  }`}
                  title={level.description}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detailed description of the emergency situation..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            maxLength={2000}
          />
        </div>

        {/* Location & Affected Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location & Affected Area *
          </label>
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-500 transition-colors text-gray-600 hover:text-red-600"
          >
            {formData.location ? (
              <span>
                📍 Location set ({formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}) - 
                Radius: {(formData.affectedArea.radius / 1000).toFixed(1)}km
              </span>
            ) : (
              <span>🗺️ Click to select location and draw affected area</span>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Safety Instructions
          </label>
          
          {/* Existing instructions */}
          {formData.instructions.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.instructions.map((inst, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    inst.priority === 'high'
                      ? 'bg-red-50 border border-red-200'
                      : inst.priority === 'medium'
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="text-sm">{inst.text}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInstruction(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new instruction */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newInstruction.text}
              onChange={(e) => setNewInstruction((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="Add safety instruction..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInstruction())}
            />
            <select
              value={newInstruction.priority}
              onChange={(e) => setNewInstruction((prev) => ({ ...prev, priority: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button
              type="button"
              onClick={handleAddInstruction}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Media (optional)
          </label>
          
          {/* Uploaded media preview */}
          {uploadedMedia.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedMedia.map((media, index) => (
                <div key={index} className="relative group">
                  {media.type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🎬</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <FileUpload
            onUploadComplete={handleMediaUpload}
            onUploadError={handleMediaError}
            maxFiles={3}
            disabled={uploadedMedia.length >= 3}
          />
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert Expiration (optional)
          </label>
          <input
            type="datetime-local"
            name="expiresAt"
            value={formData.expiresAt}
            onChange={handleChange}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty for no automatic expiration
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Publishing...' : editingAlert ? 'Update Alert' : 'Publish Alert'}
          </button>
        </div>
      </form>

      {/* Map modal for location selection */}
      {showMap && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-medium">Select Location & Affected Area</h3>
                <p className="text-sm text-gray-500">
                  Draw a circle to define the affected area
                </p>
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 relative">
              <MapView
                selectedLocation={formData.location}
                zoom={formData.location ? 13 : 10}
              >
                <GeoFenceTool
                  onGeoFenceCreate={handleGeoFenceCreate}
                  enableCircle={true}
                  enablePolygon={false}
                  initialGeoFence={
                    formData.location
                      ? {
                          type: 'circle',
                          center: formData.location,
                          radius: formData.affectedArea.radius,
                        }
                      : null
                  }
                  color="#EF4444"
                />
              </MapView>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {formData.location ? (
                    <span>
                      📍 {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)} | 
                      Radius: {(formData.affectedArea.radius / 1000).toFixed(1)}km
                    </span>
                  ) : (
                    <span>Use the circle tool in the top-right to draw the affected area</span>
                  )}
                </div>
                <button
                  onClick={() => setShowMap(false)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertForm;

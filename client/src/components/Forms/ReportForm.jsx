import { useState, useEffect } from 'react';
import { useLocation as useGeoLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { reportsApi } from '../../services/api';
import MapView from '../Map/MapView';
import FileUpload from '../Shared/FileUpload';

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

const ReportForm = ({ onSuccess, onCancel, initialLocation = null }) => {
  const { isAuthenticated } = useAuth();
  const { location: userLocation, getLocation } = useGeoLocation();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: initialLocation || null,
    anonymous: false,
  });
  const [uploadedMedia, setUploadedMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [step, setStep] = useState(1);

  // Use user's location as default if no initial location
  useEffect(() => {
    if (!initialLocation && userLocation && !formData.location) {
      setFormData((prev) => ({
        ...prev,
        location: {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        },
      }));
    }
  }, [userLocation, initialLocation]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({ ...prev, category }));
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

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await getLocation();
      if (loc) {
        setFormData((prev) => ({
          ...prev,
          location: { lat: loc.latitude, lng: loc.longitude },
        }));
      }
    } catch (err) {
      setError('Could not get your location. Please enable location services.');
    }
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

    setLoading(true);
    setError(null);

    try {
      const reportData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        location: {
          type: 'Point',
          coordinates: [formData.location.lng, formData.location.lat],
        },
        isAnonymous: !isAuthenticated || formData.anonymous,
        // Include uploaded media from UploadThing
        media: uploadedMedia.map(m => ({
          url: m.url,
          key: m.key,
          type: m.type,
        })),
      };

      const response = await reportsApi.create(reportData);

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Report submission error:', err);
      setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !formData.category) {
      setError('Please select a category');
      return;
    }
    if (step === 2 && !formData.title.trim()) {
      setError('Please enter a title');
      return;
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>📝</span>
          Report an Incident
        </h2>
        <p className="text-red-100 text-sm mt-1">
          Help keep your community safe by reporting incidents
        </p>
      </div>

      {/* Progress indicator */}
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                  step >= s
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 sm:w-24 h-1 mx-2 ${
                    step > s ? 'bg-red-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>Category</span>
          <span>Details</span>
          <span>Location</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 pt-0">
        {/* Step 1: Category */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">What type of incident?</h3>
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleCategorySelect(cat.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.category === cat.value
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{cat.emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Brief description of the incident"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide more details about what happened..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>

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
              
              {/* File upload component */}
              <FileUpload
                onUploadComplete={handleMediaUpload}
                onUploadError={handleMediaError}
                maxFiles={5}
                disabled={uploadedMedia.length >= 5}
              />
            </div>

            {isAuthenticated && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="anonymous"
                  id="anonymous"
                  checked={formData.anonymous}
                  onChange={handleChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="anonymous" className="ml-2 text-sm text-gray-700">
                  Submit anonymously
                </label>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Where did this happen?</h3>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
              >
                📍 Use My Location
              </button>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                🗺️ Select on Map
              </button>
            </div>

            {formData.location && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <span>✓</span>
                  Location selected: {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
                </p>
              </div>
            )}

            {/* Mini map preview */}
            {formData.location && (
              <div className="h-48 rounded-lg overflow-hidden border border-gray-200">
                <MapView
                  center={[formData.location.lat, formData.location.lng]}
                  zoom={15}
                  selectedLocation={formData.location}
                  showUserLocation={false}
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
            )}
            {onCancel && step === 1 && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            )}
          </div>
          
          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.location}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Full screen map modal */}
      {showMap && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-medium">Select Location</h3>
              <button
                onClick={() => setShowMap(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-60px)]">
              <MapView
                enableSelection={true}
                onMapClick={handleLocationSelect}
                selectedLocation={formData.location}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportForm;

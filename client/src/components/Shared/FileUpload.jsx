import { useState, useCallback } from 'react';
import { useUploadThing, validateFiles, formatFileSize, ACCEPTED_MEDIA_TYPES } from '../../services/uploadthing';

/**
 * FileUpload Component
 * Reusable file upload component using UploadThing
 */
const FileUpload = ({ 
  onUploadComplete, 
  onUploadError,
  maxFiles = 5,
  acceptedTypes = ACCEPTED_MEDIA_TYPES,
  className = '',
  disabled = false,
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState([]);

  const { startUpload, isUploading } = useUploadThing('mediaUploader', {
    onClientUploadComplete: (res) => {
      setUploading(false);
      setFiles([]);
      setUploadProgress({});
      
      // Format response for parent component
      const uploadedFiles = res.map(file => ({
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.serverData?.type || 'image',
      }));
      
      onUploadComplete?.(uploadedFiles);
    },
    onUploadError: (error) => {
      setUploading(false);
      setErrors([error.message]);
      onUploadError?.(error);
    },
    onUploadProgress: (progress) => {
      setUploadProgress(prev => ({ ...prev, total: progress }));
    },
  });

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    
    // Validate files
    const validationErrors = validateFiles(selectedFiles);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Check max files
    if (selectedFiles.length > maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed`]);
      return;
    }
    
    setErrors([]);
    setFiles(selectedFiles);
  }, [maxFiles]);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setErrors([]);
    
    try {
      await startUpload(files);
    } catch (error) {
      setUploading(false);
      setErrors([error.message || 'Upload failed']);
    }
  }, [files, startUpload]);

  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setErrors([]);
    setUploadProgress({});
  }, []);

  return (
    <div className={`file-upload ${className}`}>
      {/* File Input */}
      <div className="upload-area">
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="file-input"
          id="file-upload-input"
        />
        <label 
          htmlFor="file-upload-input" 
          className={`upload-label ${disabled || uploading ? 'disabled' : ''}`}
        >
          <div className="upload-icon">📁</div>
          <span className="upload-text">
            {uploading ? 'Uploading...' : 'Click or drag files here'}
          </span>
          <span className="upload-hint">
            Images (max 4MB) • Videos (max 16MB) • Max {maxFiles} files
          </span>
        </label>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="upload-errors">
          {errors.map((error, i) => (
            <p key={i} className="error-message">⚠️ {error}</p>
          ))}
        </div>
      )}

      {/* Selected Files Preview */}
      {files.length > 0 && (
        <div className="selected-files">
          <div className="files-header">
            <span>{files.length} file(s) selected</span>
            <button type="button" onClick={clearAll} className="clear-btn">
              Clear all
            </button>
          </div>
          
          <ul className="files-list">
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <div className="file-preview">
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="preview-image"
                    />
                  ) : (
                    <div className="preview-video">🎬</div>
                  )}
                </div>
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => removeFile(index)}
                  className="remove-btn"
                  disabled={uploading}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {/* Upload Progress */}
          {uploading && uploadProgress.total > 0 && (
            <div className="upload-progress">
              <div 
                className="progress-bar" 
                style={{ width: `${uploadProgress.total}%` }}
              />
              <span className="progress-text">{uploadProgress.total}%</span>
            </div>
          )}

          {/* Upload Button */}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="upload-btn"
          >
            {uploading ? (
              <>
                <span className="spinner"></span>
                Uploading...
              </>
            ) : (
              <>📤 Upload Files</>
            )}
          </button>
        </div>
      )}

      <style>{`
        .file-upload {
          width: 100%;
        }
        
        .upload-area {
          position: relative;
        }
        
        .file-input {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          z-index: 10;
        }
        
        .upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          border: 2px dashed #cbd5e1;
          border-radius: 0.75rem;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .upload-label:hover:not(.disabled) {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        
        .upload-label.disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .upload-icon {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }
        
        .upload-text {
          font-size: 1rem;
          font-weight: 500;
          color: #475569;
        }
        
        .upload-hint {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }
        
        .upload-errors {
          margin-top: 0.5rem;
          padding: 0.75rem;
          background: #fef2f2;
          border-radius: 0.5rem;
        }
        
        .error-message {
          color: #dc2626;
          font-size: 0.875rem;
          margin: 0;
        }
        
        .selected-files {
          margin-top: 1rem;
          padding: 1rem;
          background: #f1f5f9;
          border-radius: 0.75rem;
        }
        
        .files-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          font-weight: 500;
        }
        
        .clear-btn {
          font-size: 0.75rem;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .clear-btn:hover {
          color: #dc2626;
        }
        
        .files-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .file-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: white;
          border-radius: 0.5rem;
        }
        
        .file-preview {
          width: 48px;
          height: 48px;
          border-radius: 0.375rem;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .preview-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .preview-video {
          font-size: 1.5rem;
        }
        
        .file-info {
          flex: 1;
          min-width: 0;
        }
        
        .file-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .file-size {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .remove-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.75rem;
        }
        
        .remove-btn:hover:not(:disabled) {
          background: #fecaca;
        }
        
        .remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .upload-progress {
          margin-top: 0.75rem;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s;
        }
        
        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.625rem;
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        .upload-btn {
          width: 100%;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          font-weight: 600;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .upload-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        
        .upload-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FileUpload;

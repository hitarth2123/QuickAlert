import { useEffect, useRef } from 'react';

/**
 * BottomSheet component for mobile-friendly modals
 * Slides up from the bottom on mobile, centered modal on desktop
 */
const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '90vh',
  showHandle = true,
}) => {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Handle touch start for swipe-to-close
  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;
    
    if (diff > 100) {
      // Swipe down threshold reached, close the sheet
      onClose();
    } else if (sheetRef.current) {
      // Reset position
      sheetRef.current.style.transform = '';
    }
    
    startY.current = 0;
    currentY.current = 0;
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet container */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 
                   bg-white rounded-t-2xl sm:rounded-2xl shadow-xl 
                   transition-transform duration-300 ease-out
                   w-full sm:max-w-lg"
        style={{ maxHeight }}
        onTouchStart={showHandle ? handleTouchStart : undefined}
        onTouchMove={showHandle ? handleTouchMove : undefined}
        onTouchEnd={showHandle ? handleTouchEnd : undefined}
      >
        {/* Drag handle (mobile only) */}
        {showHandle && (
          <div className="sm:hidden flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;

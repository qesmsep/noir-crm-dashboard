import { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/AddSecondaryMemberModal.module.css';

interface PhotoCropUploadProps {
  onPhotoSelected: (photoDataUrl: string) => void;
  currentPhoto?: string;
  buttonClassName?: string;
  showEditButton?: boolean; // Show edit button for existing photo
}

export default function PhotoCropUpload({
  onPhotoSelected,
  currentPhoto,
  buttonClassName,
  showEditButton = false
}: PhotoCropUploadProps) {
  const { toast } = useToast();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const cropPreviewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Good quality size for profile photos
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;

          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with 0.75 quality for good balance
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file',
        variant: 'error',
      });
      return;
    }

    // Check file size (max 10MB for raw upload)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Image must be less than 10MB',
        variant: 'error',
      });
      return;
    }

    setUploadingPhoto(true);

    try {
      // Compress the image first
      const compressedDataUrl = await compressImage(file);
      setTempImage(compressedDataUrl);
      setCropPosition({ x: 0, y: 0 });
      setScale(1);
      setShowCropModal(true);
      setUploadingPhoto(false);
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photo',
        variant: 'error',
      });
      setUploadingPhoto(false);
    }
  };

  const handleCropSave = () => {
    if (!tempImage || !cropPreviewRef.current) return;

    const img = new Image();
    // Set crossOrigin to avoid CORS issues with external images
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 400; // Good size for profile photos
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Get the preview container dimensions
      const previewElement = cropPreviewRef.current;
      if (!previewElement) return;

      const containerSize = previewElement.clientWidth; // Should be square

      // backgroundSize is scale * 100%, so the displayed image size is:
      const displayedImageSize = containerSize * scale;

      // The ratio between the actual image size and displayed size
      const ratio = img.width / displayedImageSize;

      // Convert the CSS background-position to source coordinates
      // When background-position is positive, the image shifts right/down
      // which means we see LESS of the left/top edges
      // So source x should be the OPPOSITE (negative) of the position, scaled to image coordinates
      const sourceX = Math.max(0, -cropPosition.x * ratio);
      const sourceY = Math.max(0, -cropPosition.y * ratio);

      // The amount of the image visible in the container
      const sourceSize = containerSize * ratio;

      // Draw the cropped portion to the canvas
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        SIZE,
        SIZE
      );

      // Good quality: 0.8 quality (80%)
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Pass the cropped photo to parent
      onPhotoSelected(croppedDataUrl);

      setShowCropModal(false);
      setTempImage(null);

      toast({
        title: 'Photo Saved',
        description: 'Profile photo has been set',
      });
    };
    img.src = tempImage;
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setTempImage(null);
    setCropPosition({ x: 0, y: 0 });
    setScale(1);
  };

  const handleEditCurrentPhoto = () => {
    if (!currentPhoto) return;
    setTempImage(currentPhoto);
    setCropPosition({ x: 0, y: 0 });
    setScale(1);
    setShowCropModal(true);
  };

  const handleUploadNewPhoto = () => {
    fileInputRef.current?.click();
  };

  // Add touch event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const element = cropPreviewRef.current;
    if (!element || !showCropModal) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const startX = touch.clientX - cropPosition.x;
      const startY = touch.clientY - cropPosition.y;

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        setCropPosition({
          x: touch.clientX - startX,
          y: touch.clientY - startY,
        });
      };

      const handleTouchEnd = () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
    };
  }, [showCropModal, cropPosition.x, cropPosition.y]);

  return (
    <>
      {/* Edit or Upload Button */}
      {showEditButton && currentPhoto ? (
        <button
          onClick={handleEditCurrentPhoto}
          className={buttonClassName || styles.uploadButton}
          type="button"
        >
          <Camera className="w-5 h-5" />
        </button>
      ) : (
        <label
          htmlFor="photo-crop-upload"
          className={buttonClassName || styles.uploadButton}
        >
          {uploadingPhoto ? 'Uploading...' : <Camera className="w-5 h-5" />}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id="photo-crop-upload"
        accept="image/*"
        onChange={handleFileUpload}
        className={styles.fileInput}
        disabled={uploadingPhoto}
        style={{ display: 'none' }}
      />

      {/* Crop Modal */}
      {showCropModal && tempImage && (
        <div className={styles.cropModalOverlay} onClick={handleCropCancel}>
          <div className={styles.cropModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropModalHeader}>
              <h3 className={styles.cropModalTitle}>Position Your Photo</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {showEditButton && (
                  <button
                    onClick={handleUploadNewPhoto}
                    className={styles.uploadNewButton}
                    type="button"
                  >
                    Upload New
                  </button>
                )}
                <button
                  onClick={handleCropCancel}
                  className={styles.closeButton}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.cropContainer}>
              <p className={styles.cropHint}>Drag to reposition • Use slider to zoom</p>
              <div className={styles.cropPreview}>
                <div
                  ref={cropPreviewRef}
                  className={styles.cropImageWrapper}
                  style={{
                    backgroundImage: `url(${tempImage})`,
                    backgroundPosition: `${cropPosition.x}px ${cropPosition.y}px`,
                    backgroundSize: `${scale * 100}%`,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX - cropPosition.x;
                    const startY = e.clientY - cropPosition.y;

                    const handleMouseMove = (e: MouseEvent) => {
                      setCropPosition({
                        x: e.clientX - startX,
                        y: e.clientY - startY,
                      });
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </div>

              <div className={styles.cropControls}>
                <label className={styles.cropControlLabel}>
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className={styles.cropSlider}
                  />
                </label>
              </div>
            </div>

            <div className={styles.cropModalActions}>
              <button
                onClick={handleCropCancel}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                className={styles.submitButton}
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

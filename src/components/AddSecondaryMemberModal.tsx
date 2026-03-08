import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/AddSecondaryMemberModal.module.css';

interface Props {
  accountId: string;
  onClose: () => void;
  onSuccess: () => void;
  additionalMemberFee?: number;
}

export default function AddSecondaryMemberModal({ accountId, onClose, onSuccess, additionalMemberFee = 25 }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [calculatedFee, setCalculatedFee] = useState(additionalMemberFee);

  // Fetch account subscription to determine the fee rate
  useEffect(() => {
    const fetchAccountSubscription = async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}`);
        const result = await response.json();

        if (result.data && result.data.stripe_subscription_id) {
          // Fetch Stripe subscription details to get the base plan amount
          const subResponse = await fetch(`/api/subscriptions/${result.data.stripe_subscription_id}`);
          const subData = await subResponse.json();

          if (subData.subscription?.items?.data?.[0]?.price?.unit_amount) {
            const baseMRR = subData.subscription.items.data[0].price.unit_amount / 100;
            // Skyline Membership ($10/month) has $0 additional member fees
            const feeRate = baseMRR === 10 ? 0 : 25;
            setCalculatedFee(feeRate);
          }
        }
      } catch (error) {
        console.error('Error fetching subscription for fee calculation:', error);
        // Keep default fee if fetch fails
      }
    };

    fetchAccountSubscription();
  }, [accountId, additionalMemberFee]);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dob: '',
    photo: '',
    company: '',
  });

  const formatPhoneNumber = (value: string) => {
    // Strip all non-digits and limit to 10 digits
    const phone = value.replace(/\D/g, '').substring(0, 10);

    // Progressive formatting
    const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

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
    if (!tempImage) return;

    const img = new Image();
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

      // Calculate dimensions based on scale
      const scaledWidth = img.width / scale;
      const scaledHeight = img.height / scale;

      // Draw the image with the crop position
      ctx.drawImage(
        img,
        -cropPosition.x / scale,
        -cropPosition.y / scale,
        scaledWidth,
        scaledHeight,
        0,
        0,
        SIZE,
        SIZE
      );

      // Good quality: 0.8 quality (80%)
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setFormData(prev => ({ ...prev, photo: croppedDataUrl }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.dob) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields',
        variant: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/members/add-to-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          member_data: {
            ...formData,
            member_type: 'secondary',
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to add secondary member');
      }

      toast({
        title: 'Success',
        description: calculatedFee > 0
          ? `Member added successfully. Account will be charged $${calculatedFee}/month for this additional member.`
          : 'Member added successfully. No additional fees for this account.',
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add member',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Member to Account</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="first_name" className={styles.label}>
                First Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="last_name" className={styles.label}>
                Last Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone" className={styles.label}>
                Phone <span className={styles.required}>*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="(555) 555-5555"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="dob" className={styles.label}>
                Date of Birth <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                id="dob"
                name="dob"
                value={formData.dob}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="company" className={styles.label}>
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="photo" className={styles.label}>
              Photo
            </label>
            <div className={styles.photoUploadContainer}>
              {formData.photo && (
                <div className={styles.photoPreview}>
                  <img src={formData.photo} alt="Preview" className={styles.photoPreviewImage} />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                    className={styles.photoRemoveButton}
                    title="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className={styles.photoUploadButtons}>
                <label htmlFor="photo-upload" className={styles.uploadButton}>
                  {uploadingPhoto ? 'Uploading...' : '📷 Upload Photo'}
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className={styles.fileInput}
                    disabled={uploadingPhoto}
                  />
                </label>
                <span className={styles.photoUploadOr}>or</span>
                <input
                  type="url"
                  id="photo"
                  name="photo"
                  value={formData.photo}
                  onChange={handleInputChange}
                  className={styles.photoUrlInput}
                  placeholder="Enter URL"
                  disabled={uploadingPhoto}
                />
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          {calculatedFee > 0 ? (
            <div className={styles.pricingNotice}>
              <div className={styles.pricingIcon}>💳</div>
              <div className={styles.pricingText}>
                <strong>${calculatedFee}/month administration fee</strong>
                <p className={styles.pricingSubtext}>
                  This additional member will increase monthly dues by ${calculatedFee}.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.pricingNotice} style={{ backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }}>
              <div className={styles.pricingIcon}>✨</div>
              <div className={styles.pricingText}>
                <strong>No additional fee</strong>
                <p className={styles.pricingSubtext}>
                  Additional members are included at no extra cost for this plan.
                </p>
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Adding Member...' : calculatedFee > 0 ? `Add Member (+$${calculatedFee}/mo)` : 'Add Member (Free)'}
            </button>
          </div>
        </form>
      </div>

      {/* Crop Modal */}
      {showCropModal && tempImage && (
        <div className={styles.cropModalOverlay} onClick={handleCropCancel}>
          <div className={styles.cropModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cropModalHeader}>
              <h3 className={styles.cropModalTitle}>Position Your Photo</h3>
              <button
                onClick={handleCropCancel}
                className={styles.closeButton}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.cropContainer}>
              <p className={styles.cropHint}>Drag to reposition • Use slider to zoom</p>
              <div className={styles.cropPreview}>
                <div
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
                  onTouchStart={(e) => {
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

                    document.addEventListener('touchmove', handleTouchMove);
                    document.addEventListener('touchend', handleTouchEnd);
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
    </div>
  );
}

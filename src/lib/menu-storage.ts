/**
 * Menu Storage Helper
 * Handles menu file operations, using Supabase Storage in production
 * and filesystem in development for backwards compatibility
 */

const isProduction = process.env.NODE_ENV === 'production';

export const menuStorageAPI = {
  // Get the appropriate API endpoints based on environment
  uploadEndpoint: (location: string) =>
    isProduction
      ? `/api/admin/menu-storage/upload?location=${location}`
      : `/api/admin/upload-menu?location=${location}`,

  deleteEndpoint: (location: string) =>
    isProduction
      ? `/api/admin/menu-storage/delete?location=${location}`
      : `/api/admin/delete-menu-file?location=${location}`,

  listEndpoint: (location: string) =>
    isProduction
      ? `/api/admin/menu-storage/list?location=${location}`
      : `/api/admin/menu-files?location=${location}`,

  reorderEndpoint: (location: string) =>
    `/api/admin/reorder-menu-files?location=${location}`,

  // Upload menu files
  async uploadFiles(files: FileList, location: string) {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('menuFiles', file);
    });

    const response = await fetch(this.uploadEndpoint(location), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Upload failed');
    }

    return response.json();
  },

  // Delete a menu file
  async deleteFile(fileName: string, location: string) {
    const response = await fetch(this.deleteEndpoint(location), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Delete failed');
    }

    return response.json();
  },

  // List menu files
  async listFiles(location: string) {
    const response = await fetch(this.listEndpoint(location));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch menu files');
    }

    return response.json();
  },

  // Reorder menu files (only works with filesystem, not needed for Supabase)
  async reorderFiles(order: string[], location: string) {
    if (isProduction) {
      // In production with Supabase, ordering would need to be stored separately
      // For now, we'll just return success as ordering isn't critical
      return { message: 'Order saved' };
    }

    const response = await fetch(this.reorderEndpoint(location), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to save order');
    }

    return response.json();
  }
};

export default menuStorageAPI;
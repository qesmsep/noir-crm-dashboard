import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { Trash2 } from 'lucide-react';

interface MenuFile {
  name: string;
  path: string;
  size: number;
}

export default function HomePageAdmin() {
  const [menuFiles, setMenuFiles] = useState<MenuFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMenuFiles();
  }, []);

  const fetchMenuFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/menu-files');
      if (!response.ok) {
        throw new Error('Failed to fetch menu files');
      }
      const menuData = await response.json();
      setMenuFiles(menuData);
    } catch (error) {
      console.error('Error fetching menu files:', error);
      toast({
        title: 'Error loading menu images',
        description: 'Failed to load menu images',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('menuFiles', file);
      });

      const response = await fetch('/api/admin/upload-menu', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        title: 'Menu images uploaded',
        description: 'New images are now available on the homepage menu.',
      });
      fetchMenuFiles();
    } catch (error) {
      console.error('Error uploading menu images:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload menu images',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMenuFile = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      const response = await fetch('/api/admin/delete-menu-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast({
        title: 'Image deleted',
      });
      fetchMenuFiles();
    } catch (error) {
      console.error('Error deleting menu file:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete menu image',
        variant: 'error',
      });
    }
  };

  return (
    <AdminLayout>
      <div className="bg-[#F6F5F2] min-h-screen py-6 md:py-10">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8">
          <div className="flex flex-col gap-6 md:gap-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1F1F1F]" style={{ fontFamily: 'IvyJournal, serif' }}>
                  HomePage
                </h1>
                <p className="mt-2 text-gray-600 text-sm">
                  Manage the menu images shown on the homepage carousel.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={fetchMenuFiles}
                  disabled={loading}
                  className="border-[#DAD7D0] text-[#2C2C2C] hover:bg-white"
                >
                  {loading && <Spinner size="sm" className="mr-2" />}
                  Refresh
                </Button>
                <Button
                  asChild
                  disabled={uploading}
                  className="bg-[#1F1F1F] text-white hover:bg-[#2A2A2A]"
                >
                  <label htmlFor="menu-upload" className="cursor-pointer">
                    {uploading && <Spinner size="sm" className="mr-2" />}
                    Upload Images
                    <input
                      id="menu-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      multiple
                      className="hidden"
                      onChange={handleMenuUpload}
                    />
                  </label>
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#ECEAE5] shadow-sm">
              <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-[#1F1F1F]">Homepage Menu Images</h2>
                  <Badge className="bg-[#F3F1EC] text-[#8C7C6D] border border-[#E6E0D8] px-2 py-1 font-semibold">
                    {menuFiles.length} images
                  </Badge>
                </div>
              </div>
              <div className="border-t border-[#ECEAE5]" />
              <div className="px-4 md:px-6 py-4 md:py-6">
                {loading ? (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Spinner size="sm" />
                    <span>Loading images...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {menuFiles.length === 0 && (
                      <div>
                        <p className="text-gray-600">No menu images uploaded yet.</p>
                      </div>
                    )}
                    {menuFiles.map((file) => (
                      <div
                        key={file.name}
                        className="border border-[#EFEDE8] rounded-lg overflow-hidden bg-[#FBFBFA]"
                      >
                        <div className="bg-white border-b border-[#EFEDE8] px-4 py-3">
                          <p className="font-semibold text-[#1F1F1F] truncate">
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="bg-[#F7F6F3] px-4 py-3 flex justify-center">
                          <img
                            src={file.path}
                            alt={file.name}
                            className="w-full max-h-[120px] md:max-h-[140px] object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="text-[#5A5A5A] hover:bg-[#F0EEE9]"
                          >
                            <a
                              href={file.path}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#8B4A4A] hover:bg-[#F3E7E7]"
                            onClick={() => handleDeleteMenuFile(file.name)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

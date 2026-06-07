import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MenuFile {
  name: string;
  path: string;
  size: number;
}

function SortableMenuItem({ file, onDelete, pageNumber }: { file: MenuFile; onDelete: (name: string) => void; pageNumber: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-[#EFEDE8] rounded-lg overflow-hidden bg-white hover:border-[#BCA892] transition-colors relative"
    >
      {/* Page Number Badge */}
      <div className="absolute top-2 left-2 z-10">
        <div className="w-7 h-7 rounded-full bg-[#BCA892] text-white flex items-center justify-center text-xs font-bold shadow-md">
          {pageNumber}
        </div>
      </div>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing text-[#8C7C6D] hover:text-[#BCA892] transition-colors bg-white/80 rounded p-1"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Thumbnail */}
      <div className="w-full aspect-[2/3] bg-[#F7F6F3] overflow-hidden">
        <img
          src={file.path}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* File Info & Actions */}
      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-[#1F1F1F] truncate text-sm">
            {file.name}
          </p>
          <p className="text-xs text-gray-500">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-[#5A5A5A] hover:bg-[#F0EEE9] flex-1"
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
            onClick={() => onDelete(file.name)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function HomePageAdmin() {
  const [menuFiles, setMenuFiles] = useState<MenuFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('noirkc');
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchMenuFiles();
  }, [selectedLocation]);

  const fetchMenuFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/menu-files?location=${selectedLocation}`);
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

      const response = await fetch(`/api/admin/upload-menu?location=${selectedLocation}`, {
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
      const response = await fetch(`/api/admin/delete-menu-file?location=${selectedLocation}`, {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = menuFiles.findIndex((file) => file.name === active.id);
      const newIndex = menuFiles.findIndex((file) => file.name === over.id);

      const newOrder = arrayMove(menuFiles, oldIndex, newIndex);
      setMenuFiles(newOrder);

      // Save the new order to the server
      setReordering(true);
      try {
        const response = await fetch(`/api/admin/reorder-menu-files?location=${selectedLocation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: newOrder.map((file) => file.name),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save order');
        }

        toast({
          title: 'Order updated',
          description: 'Menu page order has been saved.',
        });
      } catch (error) {
        console.error('Error saving menu order:', error);
        toast({
          title: 'Failed to save order',
          description: 'Could not save the new menu order. Please try again.',
          variant: 'error',
        });
        // Revert to original order
        fetchMenuFiles();
      } finally {
        setReordering(false);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="bg-[#F6F5F2] min-h-screen py-6 md:py-10">
        <div className="max-w-[900px] mx-auto px-4 md:px-8">
          <div className="flex flex-col gap-6 md:gap-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1F1F1F]" style={{ fontFamily: 'IvyJournal, serif' }}>
                  Menu Pages
                </h1>
                <p className="mt-2 text-gray-600 text-sm">
                  Drag to reorder • First page is the cover
                </p>

                {/* Location Selector */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedLocation('noirkc')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedLocation === 'noirkc'
                        ? 'bg-[#1F1F1F] text-white'
                        : 'bg-white text-[#2C2C2C] border border-[#DAD7D0] hover:bg-[#F6F5F2]'
                    }`}
                  >
                    Noir KC
                  </button>
                  <button
                    onClick={() => setSelectedLocation('rooftopkc')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedLocation === 'rooftopkc'
                        ? 'bg-[#1F1F1F] text-white'
                        : 'bg-white text-[#2C2C2C] border border-[#DAD7D0] hover:bg-[#F6F5F2]'
                    }`}
                  >
                    RooftopKC
                  </button>
                </div>
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
                  <h2 className="text-xl font-semibold text-[#1F1F1F]">Menu Images</h2>
                  <Badge className="bg-[#F3F1EC] text-[#8C7C6D] border border-[#E6E0D8] px-2 py-1 font-semibold">
                    {menuFiles.length} pages
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
                ) : menuFiles.length === 0 ? (
                  <div>
                    <p className="text-gray-600">No menu images uploaded yet.</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={menuFiles.map((file) => file.name)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {menuFiles.map((file, index) => (
                          <SortableMenuItem
                            key={file.name}
                            file={file}
                            pageNumber={index + 1}
                            onDelete={handleDeleteMenuFile}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                {reordering && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[#8C7C6D]">
                    <Spinner size="sm" />
                    <span>Saving new order...</span>
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

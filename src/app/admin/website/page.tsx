'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/layouts/AdminLayout';
import { Box, VStack, HStack, Text, Button, Heading, Divider, Alert, AlertIcon, useToast, Spinner, Image, Grid, GridItem } from '@chakra-ui/react';
import { UploadIcon, DeleteIcon, ViewIcon } from '@chakra-ui/icons';

interface MenuFile {
  name: string;
  path: string;
  size: number;
}

interface HomePageImage {
  name: string;
  path: string;
  current: boolean;
}

export default function WebsiteAdmin() {
  const [menuFiles, setMenuFiles] = useState<MenuFile[]>([]);
  const [homePageImages, setHomePageImages] = useState<HomePageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [menuResponse, imagesResponse] = await Promise.all([
        fetch('/api/admin/menu-files'),
        fetch('/api/admin/homepage-images')
      ]);

      if (menuResponse.ok) {
        const menuData = await menuResponse.json();
        setMenuFiles(menuData);
      }

      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        setHomePageImages(imagesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load website data',
        status: 'error',
        duration: 3000,
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
      Array.from(files).forEach(file => {
        formData.append('menuFiles', file);
      });

      const response = await fetch('/api/admin/upload-menu', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: 'Menu files uploaded successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload menu files',
        status: 'error',
        duration: 3000,
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

      if (response.ok) {
        toast({
          title: 'File deleted successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete menu file',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleHomePageImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });
      formData.append('type', 'homepage');

      const response = await fetch('/api/admin/upload-images', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: `${result.files.length} image(s) uploaded successfully`,
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload images',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSetCurrentImage = async (imagePath: string) => {
    try {
      const response = await fetch('/api/admin/set-current-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath }),
      });

      if (response.ok) {
        toast({
          title: 'Image updated successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update current image',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box p={8}>
          <HStack spacing={4}>
            <Spinner size="lg" />
            <Text>Loading website data...</Text>
          </HStack>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box p={8}>
        <VStack spacing={8} align="stretch">
          <Box>
            <Heading size="lg" mb={4}>Website Management</Heading>
            <Text color="gray.600">
              Manage home page images and menu files for your website.
            </Text>
          </Box>

          {/* Home Page Images Section */}
          <Box>
            <Heading size="md" mb={4}>Home Page Images</Heading>
            <Alert status="info" mb={4}>
              <AlertIcon />
              Upload images to use on your home page. The current image is highlighted.
            </Alert>
            
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2} fontWeight="medium">Upload New Images</Text>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleHomePageImageUpload}
                  disabled={uploading}
                  style={{ marginBottom: '8px' }}
                />
                {uploading && <Text color="blue.500">Uploading...</Text>}
              </Box>

              <Divider />

              <Box>
                <Text mb={4} fontWeight="medium">Available Images</Text>
                <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
                  {homePageImages.map((image) => (
                    <GridItem key={image.path}>
                      <Box
                        border={image.current ? "2px solid" : "1px solid"}
                        borderColor={image.current ? "blue.500" : "gray.200"}
                        borderRadius="md"
                        p={2}
                        bg={image.current ? "blue.50" : "white"}
                      >
                        <Image
                          src={image.path}
                          alt={image.name}
                          boxSize="150px"
                          objectFit="cover"
                          borderRadius="md"
                          mb={2}
                        />
                        <Text fontSize="sm" fontWeight="medium" mb={2}>
                          {image.name}
                        </Text>
                        {image.current && (
                          <Text fontSize="xs" color="blue.600" fontWeight="bold" mb={2}>
                            CURRENT IMAGE
                          </Text>
                        )}
                        <Button
                          size="sm"
                          colorScheme={image.current ? "gray" : "blue"}
                          onClick={() => handleSetCurrentImage(image.path)}
                          isDisabled={image.current}
                          width="100%"
                        >
                          {image.current ? "Current" : "Set as Current"}
                        </Button>
                      </Box>
                    </GridItem>
                  ))}
                </Grid>
              </Box>
            </VStack>
          </Box>

          <Divider />

          {/* Menu Management Section */}
          <Box>
            <Heading size="md" mb={4}>Menu Management</Heading>
            <Alert status="info" mb={4}>
              <AlertIcon />
              Upload menu files to update your restaurant menu. All image files in the menu folder will be displayed.
            </Alert>
            
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2} fontWeight="medium">Upload Menu Files</Text>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMenuUpload}
                  disabled={uploading}
                  style={{ marginBottom: '8px' }}
                />
                {uploading && <Text color="blue.500">Uploading...</Text>}
              </Box>

              <Divider />

              <Box>
                <Text mb={4} fontWeight="medium">Current Menu Files ({menuFiles.length})</Text>
                <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
                  {menuFiles.map((file) => (
                    <GridItem key={file.path}>
                      <Box
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                        p={2}
                        bg="white"
                      >
                        <Image
                          src={file.path}
                          alt={file.name}
                          boxSize="150px"
                          objectFit="cover"
                          borderRadius="md"
                          mb={2}
                        />
                        <Text fontSize="sm" fontWeight="medium" mb={1}>
                          {file.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mb={2}>
                          {(file.size / 1024).toFixed(1)} KB
                        </Text>
                        <Button
                          size="sm"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => handleDeleteMenuFile(file.name)}
                          width="100%"
                          leftIcon={<DeleteIcon />}
                        >
                          Delete
                        </Button>
                      </Box>
                    </GridItem>
                  ))}
                </Grid>
              </Box>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </AdminLayout>
  );
}

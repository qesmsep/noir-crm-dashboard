import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  Badge,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Heading,
  Flex,
  Spinner,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Checkbox,
  Alert,
  AlertIcon,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  EditIcon, 
  DeleteIcon, 
  AddIcon,
  CalendarIcon,
  TimeIcon,
  CheckIcon,
  CloseIcon
} from '@chakra-ui/icons';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../context/SettingsContext';
import AdminLayout from '../../components/layouts/AdminLayout';

interface CustomDay {
  id: string;
  date: string;
  type: 'exceptional_open' | 'exceptional_closure';
  full_day: boolean;
  time_ranges: Array<{
    start_time: string;
    end_time: string;
  }> | null;
  created_at: string;
  updated_at: string;
}

interface CustomDayFormData {
  date: string;
  type: 'exceptional_open' | 'exceptional_closure';
  full_day: boolean;
  time_ranges: Array<{
    start_time: string;
    end_time: string;
  }>;
}

export default function CustomDays() {
  const [customDays, setCustomDays] = useState<CustomDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState<CustomDayFormData>({
    date: '',
    type: 'exceptional_open',
    full_day: true,
    time_ranges: [{ start_time: '09:00', end_time: '17:00' }]
  });

  useEffect(() => {
    fetchCustomDays();
  }, []);

  const fetchCustomDays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_hours')
        .select('*')
        .in('type', ['exceptional_open', 'exceptional_closure'])
        .order('date', { ascending: false });

      if (error) throw error;
      setCustomDays(data || []);
    } catch (error) {
      console.error('Error fetching custom days:', error);
      toast({
        title: 'Error',
        description: 'Failed to load custom days',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CustomDayFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTimeRangeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const newTimeRanges = [...formData.time_ranges];
    newTimeRanges[index] = {
      ...newTimeRanges[index],
      [field]: value
    };
    handleInputChange('time_ranges', newTimeRanges);
  };

  const addTimeRange = () => {
    setFormData(prev => ({
      ...prev,
      time_ranges: [...prev.time_ranges, { start_time: '09:00', end_time: '17:00' }]
    }));
  };

  const removeTimeRange = (index: number) => {
    if (formData.time_ranges.length > 1) {
      const newTimeRanges = formData.time_ranges.filter((_, i) => i !== index);
      handleInputChange('time_ranges', newTimeRanges);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate required fields
      if (!formData.date) {
        toast({
          title: 'Validation Error',
          description: 'Please select a date',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (!formData.full_day && formData.time_ranges.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please add at least one time range',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Create custom day data
      const customDayData = {
        date: formData.date,
        type: formData.type,
        full_day: formData.full_day,
        time_ranges: formData.full_day ? null : formData.time_ranges
      };

      if (editingId) {
        // Update existing custom day
        const { error: updateError } = await supabase
          .from('venue_hours')
          .update(customDayData)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Create new custom day
        const { error: insertError } = await supabase
          .from('venue_hours')
          .insert(customDayData);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: editingId ? 'Custom day updated successfully' : 'Custom day created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      resetForm();
      fetchCustomDays();
    } catch (error) {
      console.error('Error saving custom day:', error);
      toast({
        title: 'Error',
        description: 'Failed to save custom day',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customDay: CustomDay) => {
    setEditingId(customDay.id);
    setFormData({
      date: customDay.date,
      type: customDay.type,
      full_day: customDay.full_day,
      time_ranges: customDay.time_ranges || [{ start_time: '09:00', end_time: '17:00' }]
    });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDelete = async (customDayId: string) => {
    if (!confirm('Are you sure you want to delete this custom day?')) return;

    try {
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', customDayId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Custom day deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchCustomDays();
    } catch (error) {
      console.error('Error deleting custom day:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete custom day',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      type: 'exceptional_open',
      full_day: true,
      time_ranges: [{ start_time: '09:00', end_time: '17:00' }]
    });
    setEditingId(null);
  };

  const openNewCustomDay = () => {
    resetForm();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTypeColor = (type: string) => {
    return type === 'exceptional_open' ? 'green' : 'red';
  };

  const getTypeLabel = (type: string) => {
    return type === 'exceptional_open' ? 'Open Day' : 'Closed Day';
  };

  const getTypeIcon = (type: string) => {
    return type === 'exceptional_open' ? <CheckIcon /> : <CloseIcon />;
  };

  return (
    <AdminLayout>
      <Box p={6} maxW="1400px" mx="auto">
        {/* Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="nightSky">Custom Days</Heading>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={openNewCustomDay}
          >
            Add Custom Day
          </Button>
        </Flex>

        {/* Custom Day Form */}
        {(editingId || !customDays.length) && (
          <Box 
            bg="white" 
            borderRadius="lg" 
            p={6} 
            mb={6}
            border="1px solid"
            borderColor="gray.200"
            boxShadow="sm"
          >
            <Heading size="md" mb={4} color="nightSky">
              {editingId ? 'Edit Custom Day' : 'Add Custom Day'}
            </Heading>
            <form onSubmit={handleSubmit}>
              <VStack spacing={4} align="stretch">
                <HStack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                    >
                      <option value="exceptional_open">Open Day</option>
                      <option value="exceptional_closure">Closed Day</option>
                    </Select>
                  </FormControl>
                </HStack>

                <FormControl>
                  <Checkbox
                    isChecked={formData.full_day}
                    onChange={(e) => handleInputChange('full_day', e.target.checked)}
                  >
                    Full Day
                  </Checkbox>
                </FormControl>

                {!formData.full_day && (
                  <Box>
                    <Text fontWeight="600" mb={3}>Time Ranges</Text>
                    <VStack spacing={3} align="stretch">
                      {formData.time_ranges.map((range, index) => (
                        <HStack key={index} spacing={3}>
                          <FormControl>
                            <FormLabel>Start Time</FormLabel>
                            <Input
                              type="time"
                              value={range.start_time}
                              onChange={(e) => handleTimeRangeChange(index, 'start_time', e.target.value)}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>End Time</FormLabel>
                            <Input
                              type="time"
                              value={range.end_time}
                              onChange={(e) => handleTimeRangeChange(index, 'end_time', e.target.value)}
                            />
                          </FormControl>
                          {formData.time_ranges.length > 1 && (
                            <IconButton
                              aria-label="Remove time range"
                              icon={<DeleteIcon />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => removeTimeRange(index)}
                            />
                          )}
                        </HStack>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addTimeRange}
                        leftIcon={<AddIcon />}
                      >
                        Add Time Range
                      </Button>
                    </VStack>
                  </Box>
                )}

                <HStack spacing={4}>
                  <Button
                    type="submit"
                    colorScheme="blue"
                    isLoading={saving}
                    loadingText="Saving..."
                  >
                    {editingId ? 'Update Custom Day' : 'Add Custom Day'}
                  </Button>
                  {editingId && (
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
                </HStack>
              </VStack>
            </form>
          </Box>
        )}

        {/* Custom Days List */}
        {loading ? (
          <Box textAlign="center" py={8}>
            <Spinner size="lg" />
            <Text mt={4}>Loading custom days...</Text>
          </Box>
        ) : (
          <Box 
            bg="white" 
            borderRadius="lg" 
            p={6}
            border="1px solid"
            borderColor="gray.200"
            boxShadow="sm"
          >
            <Heading size="md" mb={4} color="nightSky">All Custom Days</Heading>
            {customDays.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>
                No custom days found. Add your first custom day above.
              </Text>
            ) : (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Schedule</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {customDays.map((customDay) => (
                    <Tr key={customDay.id}>
                      <Td>
                        <Text fontWeight="600">{formatDate(customDay.date)}</Text>
                      </Td>
                      <Td>
                        <HStack>
                          {getTypeIcon(customDay.type)}
                          <Badge colorScheme={getTypeColor(customDay.type)}>
                            {getTypeLabel(customDay.type)}
                          </Badge>
                        </HStack>
                      </Td>
                      <Td>
                        {customDay.full_day ? (
                          <Text color="gray.600">Full Day</Text>
                        ) : (
                          <VStack align="start" spacing={1}>
                            {customDay.time_ranges?.map((range, index) => (
                              <Text key={index} fontSize="sm">
                                {range.start_time} - {range.end_time}
                              </Text>
                            ))}
                          </VStack>
                        )}
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="Edit custom day"
                            icon={<EditIcon />}
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(customDay)}
                          />
                          <IconButton
                            aria-label="Delete custom day"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(customDay.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Box>
        )}
      </Box>
    </AdminLayout>
  );
} 
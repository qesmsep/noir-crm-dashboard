import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabase } from '../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';

interface Admin {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  access_level: string;
  status: 'active' | 'inactive';
  created_at: string;
  last_login_at?: string;
}

interface AdminFormData {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  access_level: string;
  password?: string;
}

interface AdminFilters {
  search: string;
  status: string;
  access_level: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormData>({
    email: '',
    phone: '',
    first_name: '',
    last_name: '',
    access_level: 'admin',
  });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminFilters>({
    search: '',
    status: '',
    access_level: '',
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const { toast } = useToast();

  // Check super admin access and fetch admins on component mount
  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      setCheckingAccess(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setIsSuperAdmin(false);
        setError('Authentication required');
        return;
      }

      // Check if current user is a super admin
      const { data: adminData, error } = await supabase
        .from('admins')
        .select('access_level, status')
        .eq('auth_user_id', session.user.id)
        .eq('status', 'active')
        .single();

      if (error || !adminData) {
        setIsSuperAdmin(false);
        setError('Admin access required');
        return;
      }

      if (adminData.access_level !== 'super_admin') {
        setIsSuperAdmin(false);
        setError('Super admin access required to manage admins');
        return;
      }

      setIsSuperAdmin(true);
      setError(null);
      fetchAdmins();
    } catch (err: any) {
      console.error('Error checking super admin access:', err);
      setIsSuperAdmin(false);
      setError('Failed to verify access');
    } finally {
      setCheckingAccess(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admins');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch admins');
      }

      setAdmins(result.data || []);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load admins',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      phone: '',
      first_name: '',
      last_name: '',
      access_level: 'admin',
    });
    setEditingAdmin(null);
  };

  const handleAddAdmin = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleEditAdmin = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      phone: admin.phone,
      first_name: admin.first_name,
      last_name: admin.last_name,
      access_level: admin.access_level,
    });
    setIsOpen(true);
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!window.confirm(`Are you sure you want to remove ${admin.first_name} ${admin.last_name} as an admin?`)) {
      return;
    }

    try {
      setSaving(true);

      // Get current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admins?id=${admin.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Super admin access required to remove admins');
        }
        throw new Error(result.error || 'Failed to remove admin');
      }

      toast({
        title: 'Success',
        description: 'Admin removed successfully',
      });

      fetchAdmins();
    } catch (err: any) {
      console.error('Error removing admin:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove admin',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!formData.email || !formData.first_name || !formData.last_name) {
        setError('Please fill in all required fields');
        return;
      }

      // Get current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const method = editingAdmin ? 'PUT' : 'POST';
      const body = editingAdmin
        ? { id: editingAdmin.id, ...formData }
        : formData;

      const response = await fetch('/api/admins', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Super admin access required to manage admins');
        }
        throw new Error(result.error || 'Failed to save admin');
      }

      toast({
        title: 'Success',
        description: editingAdmin ? 'Admin updated successfully' : 'Admin created successfully',
      });

      setIsOpen(false);
      resetForm();
      fetchAdmins();
    } catch (err: any) {
      console.error('Error saving admin:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save admin',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter admins based on search and filters
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = !filters.search ||
      admin.first_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.last_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.email.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.phone.includes(filters.search);

    const matchesStatus = !filters.status || admin.status === filters.status;
    const matchesAccessLevel = !filters.access_level || admin.access_level === filters.access_level;

    return matchesSearch && matchesStatus && matchesAccessLevel;
  });

  if (checkingAccess) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="xl" />
            <p className="text-sm">Checking access...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-xl text-red-600 font-semibold">Access Denied</p>
            <p className="text-sm">{error || 'Super admin access required to manage admins'}</p>
            <p className="text-xs text-gray-500">
              Only super admins can access this page. Contact your system administrator.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen p-8">
          <Spinner size="xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#353535] text-[#ECEDE8] p-4">
        <div className="relative ml-10 mr-10 z-10 pt-28">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-bold text-cork">Admin Management</h1>
              <p className="text-xs md:text-sm text-gray-400">Manage admin users and their access levels</p>
            </div>
            <Button onClick={handleAddAdmin} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Admin
            </Button>
          </div>

          {/* Admin Statistics */}
          <div className="bg-cork p-4 rounded-lg mb-6 border border-[#ecede8]">
            <div className="flex justify-around text-center gap-4">
              <div className="flex flex-col">
                <p className="text-2xl font-bold text-white">{admins.length}</p>
                <p className="text-sm text-white">Total Admins</p>
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold text-white">{admins.filter(a => a.status === 'active').length}</p>
                <p className="text-sm text-white">Active Admins</p>
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold text-white">{admins.filter(a => a.access_level === 'super_admin').length}</p>
                <p className="text-sm text-white">Super Admins</p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-lg mb-6 shadow-sm">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-[300px]">
                <Label htmlFor="search" className="text-sm text-[#353535] mb-1">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, email, or phone..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
              <div className="w-[200px]">
                <Label htmlFor="status-filter" className="text-sm text-[#353535] mb-1">Status</Label>
                <Select
                  id="status-filter"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="text-sm h-9"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
              <div className="w-[200px]">
                <Label htmlFor="access-filter" className="text-sm text-[#353535] mb-1">Access Level</Label>
                <Select
                  id="access-filter"
                  value={filters.access_level}
                  onChange={(e) => setFilters({ ...filters, access_level: e.target.value })}
                  className="text-sm h-9"
                >
                  <option value="">All Levels</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ search: '', status: '', access_level: '' })}
                  className="text-sm h-9"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <Alert className="mb-4 bg-red-50 border-red-200 text-red-800">
              {error}
            </Alert>
          )}

          <div className="bg-white rounded-lg overflow-hidden shadow-lg w-[90%] mx-auto">
            <table className="w-full">
              <thead className="bg-cork">
                <tr>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[15%]">Name</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[20%]">Email</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[12%]">Phone</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[12%]">Access Level</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[10%]">Status</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[15%]">Last Login</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-semibold w-[16%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-[#353535] text-sm">
                      {admin.first_name} {admin.last_name}
                    </td>
                    <td className="px-4 py-3 text-[#353535] text-sm">{admin.email}</td>
                    <td className="px-4 py-3 text-[#353535] text-sm">{admin.phone}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-gray-100 text-[#353535] text-xs hover:bg-gray-100">
                        {admin.access_level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${admin.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} hover:bg-opacity-100`}>
                        {admin.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#353535] text-sm">
                      {admin.last_login_at ? formatDate(admin.last_login_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleEditAdmin(admin)}
                                className="h-8 w-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Admin</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleDeleteAdmin(admin)}
                                disabled={saving}
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove Admin</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAdmins.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">
                {admins.length === 0
                  ? 'No admins found. Click "Add Admin" to create the first admin.'
                  : 'No admins match your current filters. Try adjusting your search criteria.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Admin Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="bg-[#ecede8] max-w-[350px] p-6">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-2xl font-bold text-[#353535]">
              {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first-name" className="text-xs font-semibold text-[#353535] mb-1">First Name *</Label>
                <Input
                  id="first-name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="text-xs font-semibold text-[#353535] mb-1">Last Name *</Label>
                <Input
                  id="last-name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="email" className="text-xs font-semibold text-[#353535] mb-1">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-sm h-9"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="phone" className="text-xs font-semibold text-[#353535] mb-1">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="text-sm h-9"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="access-level" className="text-xs font-semibold text-[#353535] mb-1">Access Level</Label>
                <Select
                  id="access-level"
                  value={formData.access_level}
                  onChange={(e) => setFormData({ ...formData, access_level: e.target.value })}
                  className="text-sm h-9"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.access_level === 'admin'
                    ? 'Can manage members, reservations, settings, and templates'
                    : 'Can manage everything including other admins and system settings'
                  }
                </p>
              </div>
              {!editingAdmin && (
                <div className="col-span-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-[#353535] mb-1">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-sm h-9"
                  />
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="mt-6 pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="text-sm h-9">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#353535] hover:bg-[#2a2a2a] text-[#ecede8] text-sm h-9"
            >
              {editingAdmin ? 'Update' : 'Create'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

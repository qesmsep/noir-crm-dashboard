'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { Plus, Edit } from 'lucide-react';

interface Agreement {
  id: string;
  title: string;
  content: string;
  version: number;
  status: 'active' | 'inactive' | 'draft';
  is_current: boolean;
}

export default function AgreementManager() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      const response = await fetch('/api/membership/agreements');
      if (response.ok) {
        const data = await response.json();
        setAgreements(data);
      } else {
        setAgreements([{
          id: '1',
          title: 'Noir Membership Agreement',
          content: 'Standard membership agreement content...',
          version: 1,
          status: 'active',
          is_current: true
        }]);
      }
    } catch (error) {
      setAgreements([{
        id: '1',
        title: 'Noir Membership Agreement',
        content: 'Standard membership agreement content...',
        version: 1,
        status: 'active',
        is_current: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgreement({
      id: '',
      title: '',
      content: '',
      version: 1,
      status: 'draft',
      is_current: false
    });
    setIsOpen(true);
  };

  const handleEdit = (agreement: Agreement) => {
    setEditingAgreement({ ...agreement });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!editingAgreement?.title || !editingAgreement?.content) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'error',
      });
      return;
    }

    try {
      const method = editingAgreement.id ? 'PUT' : 'POST';
      const response = await fetch('/api/membership/agreements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAgreement)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Agreement saved successfully',
        });
        setIsOpen(false);
        loadAgreements();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save agreement',
        variant: 'error',
      });
    }
  };

  if (loading) {
    return <p className="text-text-muted">Loading agreements...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5 flex-1">
          <h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F]">Agreements</h2>
          <p className="text-xs md:text-sm text-text-muted">
            Manage membership agreements
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-cork text-white hover:bg-cork-dark rounded-lg shadow-lg text-sm px-3 py-2"
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Create Agreement</span>
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-border-cream-1">
        <table className="w-full">
          <thead className="bg-bg-cream-1">
            <tr>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Title</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Version</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Current</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => (
              <tr key={agreement.id} className="hover:bg-[#FBFBFA] transition-colors">
                <td className="p-4 border-b border-[#EFEDE8]">
                  <span className="font-semibold text-[#1F1F1F]">{agreement.title}</span>
                </td>
                <td className="p-4 border-b border-[#EFEDE8] text-[#2C2C2C]">v{agreement.version}</td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  <Badge className={`px-2 py-1 rounded ${
                    agreement.status === 'active' ? 'bg-green-100 text-green-800' :
                    agreement.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {agreement.status}
                  </Badge>
                </td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  {agreement.is_current && (
                    <Badge className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Current</Badge>
                  )}
                </td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  <Button
                    size="sm"
                    onClick={() => handleEdit(agreement)}
                    className="bg-cork text-white hover:bg-cork-dark shadow-sm"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="flex md:hidden flex-col gap-3">
        {agreements.map((agreement) => (
          <Card key={agreement.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border-cream-1">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-sm text-[#1F1F1F]">{agreement.title}</span>
              <Button
                size="sm"
                onClick={() => handleEdit(agreement)}
                className="bg-cork text-white hover:bg-cork-dark"
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className="px-2 py-1 rounded text-xs">v{agreement.version}</Badge>
              <Badge className={`px-2 py-1 rounded text-xs ${
                agreement.status === 'active' ? 'bg-green-100 text-green-800' :
                agreement.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {agreement.status}
              </Badge>
              {agreement.is_current && (
                <Badge className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Current</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[450px] overflow-y-auto bg-white p-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg font-semibold text-[#353535]">
              {editingAgreement?.id ? 'Edit Agreement' : 'Create Agreement'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 mt-3">
            <div>
              <Label htmlFor="title" className="text-xs font-semibold text-[#353535]">Title</Label>
              <Input
                id="title"
                value={editingAgreement?.title || ''}
                onChange={(e) => setEditingAgreement(prev => ({ ...prev!, title: e.target.value }))}
                placeholder="Enter agreement title"
                className="mt-1 text-sm h-9"
              />
            </div>

            <div>
              <Label htmlFor="status" className="text-xs font-semibold text-[#353535]">Status</Label>
              <Select
                id="status"
                value={editingAgreement?.status || 'draft'}
                onChange={(e) => setEditingAgreement(prev => ({ ...prev!, status: e.target.value as any }))}
                className="mt-1 text-sm h-9"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is-current"
                checked={editingAgreement?.is_current || false}
                onCheckedChange={(checked) => setEditingAgreement(prev => ({ ...prev!, is_current: checked as boolean }))}
              />
              <Label htmlFor="is-current" className="text-xs font-medium text-[#353535] cursor-pointer">
                Set as current agreement
              </Label>
            </div>

            <div>
              <Label htmlFor="content" className="text-xs font-semibold text-[#353535]">Content (HTML)</Label>
              <Textarea
                id="content"
                value={editingAgreement?.content || ''}
                onChange={(e) => setEditingAgreement(prev => ({ ...prev!, content: e.target.value }))}
                placeholder="Enter agreement content (HTML supported)"
                rows={12}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="text-sm h-8"
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

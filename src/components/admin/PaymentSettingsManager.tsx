'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { AlertCircle } from 'lucide-react';

interface PaymentSettings {
  id: string;
  membership_fee: number;
  currency: string;
  stripe_price_id?: string;
  is_active: boolean;
}

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/membership/payment');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment settings',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/membership/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Payment settings saved successfully',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save payment settings',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  if (loading) {
    return <p className="text-text-muted">Loading payment settings...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F]">Payment Settings</h2>
        <p className="text-xs md:text-sm text-text-muted">
          Configure membership fees and payment processing
        </p>
      </div>

      <Card className="bg-white border border-border-cream-1 p-3 md:p-4">
        <div className="flex flex-col gap-4">
          <Alert className="bg-blue-50 border border-blue-200 text-[#353535] p-2">
            <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
            <div className="text-xs ml-2">
              These settings control the membership application fee and payment processing configuration.
            </div>
          </Alert>

          <div>
            <Label htmlFor="membership-fee" className="text-xs font-semibold text-[#353535]">
              Membership Fee (in cents)
            </Label>
            <Input
              id="membership-fee"
              type="number"
              value={settings?.membership_fee || 0}
              onChange={(e) => setSettings(prev => ({ ...prev!, membership_fee: parseInt(e.target.value) || 0 }))}
              placeholder="10000 for $100.00"
              className="mt-1 text-sm h-9"
            />
            <p className="text-xs text-text-muted mt-1">
              Current fee: {formatAmount(settings?.membership_fee || 0)}
            </p>
          </div>

          <div>
            <Label htmlFor="currency" className="text-xs font-semibold text-[#353535]">
              Currency
            </Label>
            <Select
              id="currency"
              value={settings?.currency || 'usd'}
              onChange={(e) => setSettings(prev => ({ ...prev!, currency: e.target.value }))}
              className="mt-1 text-sm h-9"
            >
              <option value="usd">USD - US Dollar</option>
              <option value="eur">EUR - Euro</option>
              <option value="gbp">GBP - British Pound</option>
              <option value="cad">CAD - Canadian Dollar</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="stripe-price-id" className="text-xs font-semibold text-[#353535]">
              Stripe Price ID (Optional)
            </Label>
            <Input
              id="stripe-price-id"
              value={settings?.stripe_price_id || ''}
              onChange={(e) => setSettings(prev => ({ ...prev!, stripe_price_id: e.target.value }))}
              placeholder="price_1234567890"
              className="mt-1 text-sm h-9"
            />
            <p className="text-xs text-text-muted mt-1">
              If you have a specific Stripe price ID, enter it here. Otherwise, a new price will be created.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-active"
                checked={settings?.is_active ?? true}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev!, is_active: checked as boolean }))}
              />
              <Label htmlFor="is-active" className="text-xs font-medium text-[#353535] cursor-pointer">
                Active
              </Label>
            </div>
            <p className="text-xs text-text-muted mt-1 ml-6">
              When inactive, new applications cannot be processed
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-sm h-8"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTripModal({ open, onOpenChange }: CreateTripModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // CRITICAL: Get session first to ensure token is loaded
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        sessionError
      });

      if (!session || !session.access_token) {
        setError('Not authenticated - please log in again');
        setLoading(false);
        router.push('/login');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user) {
        setError('Not authenticated - please log in again');
        setLoading(false);
        router.push('/login');
        return;
      }

      console.log('User ID:', user.id);
      console.log('Creating trip via RPC function...');

      // Use the database function to create trip and add member
      // This bypasses RLS issues with auth.uid()
      const { data, error: insertError } = await (supabase.rpc as any)('create_trip_with_member', {
        p_title: title,
        p_destination: destination || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      console.log('RPC result:', { data, insertError });

      if (insertError) {
        console.error('Insert error:', insertError);
        setError(`Failed to create trip: ${insertError.message}`);
        setLoading(false);
      } else if (data && data.length > 0) {
        console.log('Success! Redirecting to trip:', data[0].id);
        onOpenChange(false);
        router.push(`/trip/${data[0].id}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Trip Title *
            </label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
              placeholder="Summer in Europe"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="destination" className="block text-sm font-medium text-gray-700">
              Destination
            </label>
            <Input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={loading}
              placeholder="Paris, France"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

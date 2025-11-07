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
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);
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
      console.log('Creating trip...');

      // Insert trip directly - trigger will automatically add owner to trip_members
      const { data, error: insertError } = await supabase
        .from('trips')
        .insert({
          owner_id: user.id,
          title,
          destination: destination || null,
          start_date: startDate || null,
          end_date: endDate || null,
          description: description || null,
          cover_url: coverUrl || null,
        } as any)
        .select()
        .single();

      console.log('Insert result:', { data, insertError });

      if (insertError) {
        console.error('Insert error:', insertError);
        setError(`Failed to create trip: ${insertError.message}`);
        setLoading(false);
      } else if (data) {
        const created = data as { id: string };

        // create invitations if any
        const emails = invitees
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && e.includes('@'));
        if (emails.length > 0) {
          const invites = emails.map((email) => ({
            trip_id: created.id,
            email,
            invited_by: user.id,
            status: 'pending',
          }));
          await supabase.from('trip_invitations').insert(invites as any);
        }

        console.log('Success! Redirecting to trip:', created.id);
        onOpenChange(false);
        router.push(`/trip/${created.id}`);
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
              placeholder="Rome Group Trip"
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
              placeholder="Rome, Italy"
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

          <div className="space-y-2">
            <label htmlFor="cover" className="block text-sm font-medium text-gray-700">
              Cover image URL
            </label>
            <Input
              id="cover"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              disabled={loading}
              placeholder="https://..."
            />
            {coverUrl && (
              <div className="mt-2 flex items-center gap-3">
                <div className="w-28 h-16 rounded-lg overflow-hidden bg-gray-200">
                  <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
                <div className="text-sm text-gray-600">Preview</div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
              placeholder="A collaborative trip to explore the ancient wonders of Rome..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Invite participants</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter email addresses"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const email = inviteInput.trim();
                  if (!email || !email.includes('@')) return;
                  if (!invitees.includes(email)) setInvitees([...invitees, email]);
                  setInviteInput('');
                }}
                disabled={loading}
              >
                Add
              </Button>
            </div>
            {invitees.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {invitees.map((email) => (
                  <span key={email} className="inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                    {email}
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => setInvitees(invitees.filter((e) => e !== email))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/i18n/I18nProvider';

interface CreateTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTripModal({ open, onOpenChange }: CreateTripModalProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [destPreds, setDestPreds] = useState<{ description: string; place_id: string }[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const destDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
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
        setError(t('trip.create.auth'));
        setLoading(false);
        router.push('/login');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user) {
        setError(t('trip.create.auth'));
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
          destination: (destQuery || destination) || null,
          start_date: startDate || null,
          end_date: endDate || null,
          description: description || null,
          cover_url: coverUrl || null,
          place_id: placeId || null,
          lat: coords.lat,
          lng: coords.lng,
        } as any)
        .select()
        .single();

      console.log('Insert result:', { data, insertError });

      if (insertError) {
        console.error('Insert error:', insertError);
        setError(`${t('trip.create.failed')}: ${insertError.message}`);
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
      setError(t('common.unexpected'));
      setLoading(false);
    }
  };

  // Destinations Autocomplete
  useEffect(() => {
    // seed query when modal opens
    if (open) setDestQuery(destination);
  }, [open]);

  useEffect(() => {
    if (!destQuery || destQuery.length < 2) {
      setDestPreds([]);
      return;
    }
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    destDebounceRef.current = setTimeout(async () => {
      try {
        setDestLoading(true);
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(destQuery)}`);
        const json = await res.json();
        setDestPreds(json.predictions || []);
      } catch (e) {
        setDestPreds([]);
      } finally {
        setDestLoading(false);
      }
    }, 250);
  }, [destQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('trip.create.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-muted-foreground">
              {t('trip.create.titleLabel')}
            </label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
              placeholder={t('trip.create.titlePlaceholder')}
            />
          </div>

          <div className="space-y-2 relative">
            <label htmlFor="destination" className="block text-sm font-medium text-muted-foreground">
              {t('trip.create.destination')}
            </label>
            <Input
              id="destination"
              type="text"
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              disabled={loading}
              placeholder={t('trip.create.destinationPlaceholder')}
              autoComplete="off"
            />
            {destQuery && destPreds.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-sm max-h-56 overflow-auto">
                {destPreds.map((p) => (
                  <button
                    type="button"
                    key={p.place_id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/30"
                    onClick={async () => {
                      setDestination(p.description);
                      setDestQuery(p.description);
                      setDestPreds([]);
                      setPlaceId(p.place_id);
                      // fetch details for coords
                      try {
                        const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(p.place_id)}`);
                        const json = await res.json();
                        if (json && json.lat != null && json.lng != null) {
                          setCoords({ lat: json.lat, lng: json.lng });
                        } else {
                          setCoords({ lat: null, lng: null });
                        }
                      } catch {
                        setCoords({ lat: null, lng: null });
                      }
                    }}
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
            {destLoading && (
              <div className="text-xs text-muted-foreground">{t('common.searching')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="startDate" className="block text-sm font-medium text-muted-foreground">
                {t('trip.create.startDate')}
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
              <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground">
                {t('trip.create.endDate')}
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
            <label htmlFor="cover" className="block text-sm font-medium text-muted-foreground">
              {t('trip.create.cover')}
            </label>
            <Input
              id="cover"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              disabled={loading}
              placeholder={t('trip.create.coverPlaceholder')}
            />
            {coverUrl && (
              <div className="mt-2 flex items-center gap-3">
                <div className="w-28 h-16 rounded-lg overflow-hidden bg-muted">
                  <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
                <div className="text-sm text-muted-foreground">{t('trip.create.preview')}</div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">
              {t('trip.create.description')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
              placeholder={t('trip.create.descriptionPlaceholder')}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-semibold text-foreground mb-2">{t('trip.create.inviteTitle')}</h3>
            <div className="flex gap-2">
              <Input
                placeholder={t('trip.create.invitePlaceholder')}
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
                {t('common.add')}
              </Button>
            </div>
            {invitees.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {invitees.map((email) => (
                  <span key={email} className="inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full bg-muted text-foreground">
                    {email}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-muted-foreground"
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
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('trip.create.loading') : t('trip.create.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

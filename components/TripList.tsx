'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Edit, Trash2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Reveal } from '@/components/motion/Reveal';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface Trip {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  cover_url: string | null;
  description?: string | null;
}

interface TripListProps {
  onCreateTrip?: () => void;
}

type FilterTab = 'all' | 'planning' | 'active' | 'past';

export function TripList({ onCreateTrip }: TripListProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    loadTrips();

    // Listen for invitation acceptance to reload trips
    const handleInvitationAccepted = () => {
      loadTrips();
    };

    window.addEventListener('trip-invitation-accepted', handleInvitationAccepted);

    return () => {
      window.removeEventListener('trip-invitation-accepted', handleInvitationAccepted);
    };
  }, []);

  const loadTrips = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Get only trips where the user is a member
    const { data: memberTrips } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', user.id);

    if (!memberTrips || memberTrips.length === 0) {
      setTrips([]);
      setLoading(false);
      try { window.dispatchEvent(new CustomEvent('dashboard-section-loaded', { detail: 'trips' })); } catch { }
      return;
    }

    const tripIds = (memberTrips as { trip_id: string }[]).map((m) => m.trip_id);

    const { data } = await supabase
      .from('trips')
      .select('*')
      .in('id', tripIds)
      .order('created_at', { ascending: false });

    if (data) {
      setTrips(data);
    }

    setLoading(false);
    try { window.dispatchEvent(new CustomEvent('dashboard-section-loaded', { detail: 'trips' })); } catch { }
  };

  const statusOf = (t: Trip): 'planning' | 'active' | 'past' => {
    const now = new Date();
    const start = t.start_date ? new Date(t.start_date) : null;
    const end = t.end_date ? new Date(t.end_date) : null;
    if (!start || !end) return 'planning';
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (today < s) return 'planning';
    if (today > e) return 'past';
    return 'active';
  };

  const filteredAndSorted = useMemo(() => {
    const now = new Date();
    let list = trips;

    if (filter === 'planning') {
      list = trips.filter((t) => statusOf(t) === 'planning');
    } else if (filter === 'active') {
      list = trips.filter((t) => {
        return statusOf(t) === 'active';
      });
    } else if (filter === 'past') {
      list = trips.filter((t) => statusOf(t) === 'past');
    }

    list = [...list].sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      return sortBy === 'date_desc' ? bDate - aDate : aDate - bDate;
    });

    return list;
  }, [trips, filter, sortBy]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 bg-muted rounded-full animate-pulse" />
            <div className="h-7 w-16 bg-muted rounded-full animate-pulse" />
            <div className="h-7 w-16 bg-muted rounded-full animate-pulse" />
          </div>
          <div className="h-7 w-36 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 sm:p-5 rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-4">
                <div className="w-40 h-24 rounded-xl bg-muted animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-60 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-20 bg-muted rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{t('triplist.empty')}</p>
        {onCreateTrip && (
          <button onClick={onCreateTrip} className="px-4 py-2 rounded-md bg-primary text-primary-foreground">{t('triplist.create')}</button>
        )}
      </div>
    );
  }

  async function handleDelete(trip: Trip) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const confirmMsg = t('triplist.delete.confirm');
      const confirmLeaveMsg = t('triplist.leave.confirm');

      // Check if current user is owner
      const { data: tripRow } = await supabase
        .from('trips')
        .select('owner_id')
        .eq('id', trip.id)
        .single();

      const isOwner = (tripRow as any)?.owner_id === user.id;

      if (isOwner) {
        toast({
          title: t('triplist.delete.title'),
          description: confirmMsg,
          action: (
            <ToastAction
              altText={t('triplist.delete.action')}
              onClick={async () => {
                const { error: delErr } = await supabase
                  .rpc('delete_trip', { p_trip_id: trip.id } as any);
                if (delErr) {
                  toast({ variant: 'destructive', title: t('triplist.delete.failed'), description: delErr.message });
                } else {
                  toast({ title: t('triplist.delete.success') });
                  await loadTrips();
                }
              }}
            >
              {t('triplist.delete.action')}
            </ToastAction>
          ),
        });
        return;
      } else {
        toast({
          title: t('triplist.leave.title'),
          description: confirmLeaveMsg,
          action: (
            <ToastAction
              altText={t('triplist.leave.action')}
              onClick={async () => {
                const { error: leaveErr } = await supabase
                  .from('trip_members')
                  .delete()
                  .eq('trip_id', trip.id)
                  .eq('user_id', user.id);
                if (leaveErr) {
                  toast({ variant: 'destructive', title: t('triplist.leave.failed'), description: leaveErr.message });
                } else {
                  toast({ title: t('triplist.leave.success') });
                  await loadTrips();
                }
              }}
            >
              {t('triplist.leave.action')}
            </ToastAction>
          ),
        });
        return;
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('triplist.operationFailed'), description: e?.message || t('triplist.operationFailedDesc') });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Reveal variant="fade">
          <div className="flex items-center gap-2">
            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-sm ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t('triplist.filter.all')}</button>
            <button onClick={() => setFilter('planning')} className={`px-3 py-1 rounded-full text-sm ${filter === 'planning' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t('triplist.filter.planning')}</button>
            <button onClick={() => setFilter('active')} className={`px-3 py-1 rounded-full text-sm ${filter === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t('triplist.filter.active')}</button>
            <button onClick={() => setFilter('past')} className={`px-3 py-1 rounded-full text-sm ${filter === 'past' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t('triplist.filter.past')}</button>
          </div>
        </Reveal>
        <Reveal variant="slideIn" delayMs={80}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('triplist.sort.label')}</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc')}
                className="text-sm appearance-none rounded-lg border border-border bg-background/90 px-3 py-2 pr-9 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
              >
                <option value="date_desc">{t('triplist.sort.newest')}</option>
                <option value="date_asc">{t('triplist.sort.oldest')}</option>
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="space-y-5">
        {filteredAndSorted.map((trip, i) => (
          <Reveal key={trip.id} variant="slideUp" delayMs={i * 60}>
            <Card
              className="p-4 sm:p-5 hover:shadow-lg transition-shadow cursor-pointer rounded-2xl"
              onClick={() => router.push(`/trip/${trip.id}`)}
            >
              <div className="flex items-start gap-4">
                <div className="w-40 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${trip.cover_url || 'https://images.unsplash.com/photo-1526481280698-8fcc13fdca73?q=80&w=800&auto=format&fit=crop'})`,
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground truncate">{trip.title}</h3>
                        {(() => {
                          const st = statusOf(trip);
                          return (
                            <Badge
                              className={
                                st === 'active'
                                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                  : st === 'planning'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                    : 'bg-muted text-muted-foreground border-border'
                              }
                              variant="outline"
                            >
                              {st === 'active' ? t('triplist.filter.active') : st === 'planning' ? t('triplist.filter.planning') : t('triplist.filter.past')}
                            </Badge>
                          );
                        })()}
                      </div>
                      {trip.destination && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">{trip.destination}</span>
                        </div>
                      )}
                      {trip.start_date && trip.end_date && (
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}`); }}
                        title={t('trip.view')}
                      >
                        {t('trip.view')}
                      </button>
                      <button
                        className="p-2 rounded-full bg-muted hover:bg-muted/80"
                        onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}?edit=1`); }}
                        title={t('trip.edit')}
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        className="p-2 rounded-full bg-muted hover:bg-muted/80"
                        onClick={(e) => { e.stopPropagation(); handleDelete(trip); }}
                        title={t('trip.delete')}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

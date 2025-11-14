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
      try { window.dispatchEvent(new CustomEvent('dashboard-section-loaded', { detail: 'trips' })); } catch {}
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
    try { window.dispatchEvent(new CustomEvent('dashboard-section-loaded', { detail: 'trips' })); } catch {}
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
            <div className="h-7 w-16 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-7 w-16 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-7 w-16 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="h-7 w-36 bg-gray-200 rounded-md animate-pulse" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 sm:p-5 rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-start gap-4">
                <div className="w-40 h-24 rounded-xl bg-gray-200 animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-60 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-20 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
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
        <p className="text-gray-600 mb-4">No trips yet. Create your first trip!</p>
        {onCreateTrip && (
          <button onClick={onCreateTrip} className="px-4 py-2 rounded-md bg-gray-900 text-white">Create new trip</button>
        )}
      </div>
    );
  }

  async function handleDelete(trip: Trip) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const confirmMsg = 'Are you sure you want to delete this trip? This action cannot be undone.';
      const confirmLeaveMsg = 'Do you want to leave this trip? You will be removed as a participant.';

      // Check if current user is owner
      const { data: tripRow } = await supabase
        .from('trips')
        .select('owner_id')
        .eq('id', trip.id)
        .single();

      const isOwner = (tripRow as any)?.owner_id === user.id;

      if (isOwner) {
        const t = toast({
          title: 'Delete trip?',
          description: confirmMsg,
          action: (
            <ToastAction
              altText="Delete"
              onClick={async () => {
                const { error: delErr } = await supabase
                  .from('trips')
                  .delete()
                  .eq('id', trip.id);
                if (delErr) {
                  toast({ variant: 'destructive', title: 'Delete failed', description: delErr.message });
                } else {
                  toast({ title: 'Trip deleted' });
                  await loadTrips();
                }
              }}
            >
              Delete
            </ToastAction>
          ),
        });
        return;
      } else {
        const t = toast({
          title: 'Leave trip?',
          description: confirmLeaveMsg,
          action: (
            <ToastAction
              altText="Leave"
              onClick={async () => {
                const { error: leaveErr } = await supabase
                  .from('trip_members')
                  .delete()
                  .eq('trip_id', trip.id)
                  .eq('user_id', user.id);
                if (leaveErr) {
                  toast({ variant: 'destructive', title: 'Leave failed', description: leaveErr.message });
                } else {
                  toast({ title: 'You left the trip' });
                  await loadTrips();
                }
              }}
            >
              Leave
            </ToastAction>
          ),
        });
        return;
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation failed', description: e?.message || 'Failed to delete/leave trip' });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Reveal variant="fade">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-xs sm:text-sm ${filter==='all'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('planning')} className={`px-3 py-1 rounded-full text-xs sm:text-sm ${filter==='planning'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>Planning</button>
            <button onClick={() => setFilter('active')} className={`px-3 py-1 rounded-full text-xs sm:text-sm ${filter==='active'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>Active</button>
            <button onClick={() => setFilter('past')} className={`px-3 py-1 rounded-full text-xs sm:text-sm ${filter==='past'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>Past</button>
          </div>
        </Reveal>
        <Reveal variant="slideIn" delayMs={80}>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600">Sort by:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc')}
                className="text-xs sm:text-sm appearance-none rounded-lg border border-gray-300 bg-white/90 px-2 sm:px-3 py-1.5 sm:py-2 pr-8 sm:pr-9 shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
              >
                <option value="date_desc">Date (newest)</option>
                <option value="date_asc">Date (oldest)</option>
              </select>
              <svg
                className="pointer-events-none absolute right-2 sm:right-2.5 top-1/2 h-3 w-3 sm:h-4 sm:w-4 -translate-y-1/2 text-gray-500"
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
              className="p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-shadow cursor-pointer rounded-2xl"
              onClick={() => router.push(`/trip/${trip.id}`)}
            >
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="w-full sm:w-32 md:w-40 h-32 sm:h-20 md:h-24 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${trip.cover_url || 'https://images.unsplash.com/photo-1526481280698-8fcc13fdca73?q=80&w=800&auto=format&fit=crop'})`,
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{trip.title}</h3>
                            {(() => {
                              const st = statusOf(trip);
                              return (
                                <Badge
                                  className={
                                    st === 'active'
                                      ? 'bg-green-100 text-green-700 border-green-200'
                                      : st === 'planning'
                                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                                      : 'bg-gray-100 text-gray-700 border-gray-200'
                                  }
                                  variant="outline"
                                >
                                  {st === 'active' ? 'Active' : st === 'planning' ? 'Planning' : 'Past'}
                                </Badge>
                              );
                            })()}
                          </div>
                          {trip.destination && (
                            <div className="flex items-center gap-1.5 text-gray-600 mt-1">
                              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm truncate">{trip.destination}</span>
                            </div>
                          )}
                          {trip.start_date && trip.end_date && (
                            <div className="flex items-center gap-1.5 text-gray-600 mt-1">
                              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">
                                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <button
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-black text-white hover:bg-black/90"
                          onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}`); }}
                          title={t('trip.view')}
                        >
                          {t('trip.view')}
                        </button>
                        <button
                          className="p-1.5 sm:p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                          onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}?edit=1`); }}
                          title={t('trip.edit')}
                        >
                          <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                        </button>
                        <button
                          className="p-1.5 sm:p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                          onClick={(e) => { e.stopPropagation(); handleDelete(trip); }}
                          title={t('trip.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
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

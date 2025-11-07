'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Edit, Trash2, Filter } from 'lucide-react';
import { format } from 'date-fns';

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

type FilterTab = 'all' | 'active' | 'past';

export function TripList({ onCreateTrip }: TripListProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');

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
  };

  const filteredAndSorted = useMemo(() => {
    const now = new Date();
    let list = trips;

    if (filter === 'active') {
      list = trips.filter((t) => {
        const start = t.start_date ? new Date(t.start_date) : null;
        const end = t.end_date ? new Date(t.end_date) : null;
        if (!start || !end) return true; // si faltan fechas, lo mostramos como activo por simplicidad
        return start <= now && now <= end;
      });
    } else if (filter === 'past') {
      list = trips.filter((t) => {
        const end = t.end_date ? new Date(t.end_date) : null;
        return end ? end < now : false;
      });
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
      <div className="text-center py-12 text-gray-600">
        Loading trips...
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"> 
          <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-sm ${filter==='all'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>All</button>
          <button onClick={() => setFilter('active')} className={`px-3 py-1 rounded-full text-sm ${filter==='active'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>Active</button>
          <button onClick={() => setFilter('past')} className={`px-3 py-1 rounded-full text-sm ${filter==='past'?'bg-gray-900 text-white':'bg-gray-100 text-gray-700'}`}>Past</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc')}
            className="text-sm border rounded-md px-2 py-1 bg-white"
          >
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
          </select>
        </div>
      </div>

      <div className="space-y-5">
        {filteredAndSorted.map((trip) => (
          <Link key={trip.id} href={`/trip/${trip.id}`}>
            <Card className="p-4 sm:p-5 hover:shadow-lg transition-shadow cursor-pointer rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-40 h-24 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
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
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{trip.title}</h3>
                      {trip.destination && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">{trip.destination}</span>
                        </div>
                      )}
                      {trip.start_date && trip.end_date && (
                        <div className="flex items-center gap-2 text-gray-600 mt-1">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-black text-white hover:bg-black/90">View trip</Badge>
                      <button className="p-2 rounded-full bg-gray-100"><Edit className="w-4 h-4 text-gray-600" /></button>
                      <button className="p-2 rounded-full bg-gray-100"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface Trip {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export function TripList() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

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

    const tripIds = memberTrips.map((m) => m.trip_id);

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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {trips.map((trip) => (
        <Link key={trip.id} href={`/trip/${trip.id}`}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {trip.title}
            </h3>

            {trip.destination && (
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{trip.destination}</span>
              </div>
            )}

            {trip.start_date && trip.end_date && (
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {format(new Date(trip.start_date), 'MMM d')} -{' '}
                  {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              </div>
            )}

            <Badge variant="secondary" className="mt-2">
              View Trip
            </Badge>
          </Card>
        </Link>
      ))}
    </div>
  );
}

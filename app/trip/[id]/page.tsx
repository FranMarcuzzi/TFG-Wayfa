'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { Itinerary } from '@/components/Itinerary';
import { TripMetaEditor } from '@/components/TripMetaEditor';

export default function TripPage() {
  const params = useParams();
  const tripId = params.id as string;
  const search = useSearchParams();
  const showEdit = (search.get('edit') === '1');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background relative">
        <NavBar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {showEdit && <TripMetaEditor tripId={tripId} />}
          <Itinerary tripId={tripId} />
        </main>
      </div>
    </AuthGuard>
  );
}

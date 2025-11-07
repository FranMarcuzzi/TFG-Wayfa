'use client';

import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { Itinerary } from '@/components/Itinerary';

export default function TripPage() {
  const params = useParams();
  const tripId = params.id as string;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Itinerary tripId={tripId} />
        </main>
      </div>
    </AuthGuard>
  );
}

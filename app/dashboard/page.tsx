'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { TripList } from '@/components/TripList';
import { CreateTripModal } from '@/components/CreateTripModal';
import { InvitationsList } from '@/components/InvitationsList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function DashboardPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Welcome back, Francisco!</h1>
              <p className="text-gray-600 mt-3">Ready for your next adventure?</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="mt-2 flex items-center gap-2 shadow-[0_6px_0_rgba(0,0,0,0.2)]">
              <Plus className="h-4 w-4" />
              Create new trip
            </Button>
          </div>

          <div className="space-y-6">
            <InvitationsList />
            <TripList onCreateTrip={() => setShowCreateModal(true)} />
          </div>
        </main>

        <CreateTripModal open={showCreateModal} onOpenChange={setShowCreateModal} />
      </div>
    </AuthGuard>
  );
}

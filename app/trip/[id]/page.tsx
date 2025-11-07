'use client';

import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { NavBar } from '@/components/NavBar';
import { Itinerary } from '@/components/Itinerary';
import { Chat } from '@/components/Chat';
import { Polls } from '@/components/Polls';
import { TripMembers } from '@/components/TripMembers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TripPage() {
  const params = useParams();
  const tripId = params.id as string;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Itinerary tripId={tripId} />
            </div>

            <div className="space-y-6">
              <TripMembers tripId={tripId} />

              <Tabs defaultValue="chat" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="chat" className="flex-1">
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="polls" className="flex-1">
                    Polls
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="mt-4">
                  <Chat tripId={tripId} />
                </TabsContent>

                <TabsContent value="polls" className="mt-4">
                  <Polls tripId={tripId} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

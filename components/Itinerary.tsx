'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Clock, MapPin, X } from 'lucide-react';

interface Activity {
  id: string;
  day_id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
}

interface Day {
  id: string;
  trip_id: string;
  day_index: number;
  date: string | null;
  activities: Activity[];
}

interface ItineraryProps {
  tripId: string;
}

export function Itinerary({ tripId }: ItineraryProps) {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [newActivityDayId, setNewActivityDayId] = useState<string | null>(null);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityLocation, setNewActivityLocation] = useState('');
  const [newActivityStartTime, setNewActivityStartTime] = useState('');
  const [newActivityEndTime, setNewActivityEndTime] = useState('');

  useEffect(() => {
    loadDays();
    subscribeToChanges();
  }, [tripId]);

  const loadDays = async () => {
    const { data: daysData } = await supabase
      .from('days')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_index');

    if (daysData) {
      const daysWithActivities = await Promise.all(
        daysData.map(async (day: any) => {
          const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('day_id', day.id)
            .order('starts_at');

          return {
            ...day,
            activities: activities || [],
          };
        })
      );

      setDays(daysWithActivities);
    }

    setLoading(false);
  };

  const subscribeToChanges = () => {
    const activitiesChannel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
        },
        () => {
          loadDays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
    };
  };

  const addDay = async () => {
    const nextIndex = days.length > 0 ? Math.max(...days.map((d) => d.day_index)) + 1 : 1;

    const { error } = await supabase.from('days').insert({
      trip_id: tripId,
      day_index: nextIndex,
    } as any);

    if (!error) {
      loadDays();
    }
  };

  const addActivity = async (dayId: string) => {
    if (!newActivityTitle.trim()) return;

    const { error } = await supabase.from('activities').insert({
      day_id: dayId,
      title: newActivityTitle,
      location: newActivityLocation || null,
      starts_at: newActivityStartTime || null,
      ends_at: newActivityEndTime || null,
    } as any);

    if (!error) {
      setNewActivityDayId(null);
      setNewActivityTitle('');
      setNewActivityLocation('');
      setNewActivityStartTime('');
      setNewActivityEndTime('');
    }
  };

  const deleteActivity = async (activityId: string) => {
    await supabase.from('activities').delete().eq('id', activityId);
  };

  if (loading) {
    return <div className="text-gray-600">Loading itinerary...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Itinerary</h2>
        <Button onClick={addDay} size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Day
        </Button>
      </div>

      {days.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No days yet. Add a day to start planning!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day.id} className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Day {day.day_index}
                {day.date && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({new Date(day.date).toLocaleDateString()})
                  </span>
                )}
              </h3>

              <div className="space-y-3">
                {day.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{activity.title}</div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {activity.starts_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activity.starts_at}
                            {activity.ends_at && ` - ${activity.ends_at}`}
                          </div>
                        )}
                        {activity.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {activity.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteActivity(activity.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {newActivityDayId === day.id ? (
                  <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <Input
                      placeholder="Activity title"
                      value={newActivityTitle}
                      onChange={(e) => setNewActivityTitle(e.target.value)}
                    />
                    <Input
                      placeholder="Location"
                      value={newActivityLocation}
                      onChange={(e) => setNewActivityLocation(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        placeholder="Start time"
                        value={newActivityStartTime}
                        onChange={(e) => setNewActivityStartTime(e.target.value)}
                      />
                      <Input
                        type="time"
                        placeholder="End time"
                        value={newActivityEndTime}
                        onChange={(e) => setNewActivityEndTime(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => addActivity(day.id)} size="sm">
                        Add
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNewActivityDayId(null)}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewActivityDayId(day.id)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

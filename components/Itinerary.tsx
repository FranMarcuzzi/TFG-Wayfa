'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Clock, MapPin, X, Sun, Plane, Users, ThumbsUp, MessageCircle } from 'lucide-react';

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
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

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
      if (!selectedDayId && daysWithActivities.length > 0) {
        setSelectedDayId(daysWithActivities[0].id);
      }
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
    const nextIndex = days.length > 0 ? Math.max(...days.map((d: Day) => d.day_index)) + 1 : 1;

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
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Itinerary</h3>
            <Button onClick={addDay} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Day
            </Button>
          </div>
          {days.length === 0 ? (
            <div className="text-sm text-gray-600">No days yet.</div>
          ) : (
            <div className="space-y-2">
              {days.map((day: Day) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className={`w-full text-left px-3 py-2 rounded-md border transition ${
                    selectedDayId === day.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Day {day.day_index}</div>
                    {selectedDayId === day.id && <div className="text-xs opacity-80">Selected</div>}
                  </div>
                  {day.date && (
                    <div className={`text-xs mt-1 ${selectedDayId === day.id ? 'text-gray-200' : 'text-gray-500'}`}>
                      {new Date(day.date).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="h-48 bg-teal-700 flex items-center justify-center">
            <div className="text-white text-sm">Map Preview</div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="font-semibold text-gray-900">Ask Wayfa AI</div>
          <div className="text-sm text-gray-700 p-3 rounded-md bg-gray-50">
            What's the best way to get to Trastevere from the Colosseum?
          </div>
          <div className="text-sm text-gray-500 p-3 rounded-md bg-gray-50">
            The best way is by bus (line 75) or a scenic 30-minute walk.
          </div>
          <Input placeholder="Ask something..." />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-gray-900">Expense Summary</div>
            <div className="text-gray-500">$</div>
          </div>
          <div className="text-sm text-gray-600">Total Trip Expenses</div>
          <div className="text-3xl font-bold my-1">$1,200.00</div>
          <div className="text-sm text-green-600">$400.00</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm">View details</Button>
            <Button size="sm">Add expense</Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {(() => {
          const currentDay = days.find((d: Day) => d.id === selectedDayId) || days[0];
          if (!currentDay) return (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No days yet. Add a day to start planning!</p>
            </Card>
          );

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">Day {currentDay.day_index}: {currentDay.date ? new Date(currentDay.date).toLocaleDateString() : 'Plan'}</h2>
                <Button className="gap-2" onClick={() => setNewActivityDayId(currentDay.id)}>
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-3xl font-semibold text-gray-900">
                        25°C
                        <Sun className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div className="text-sm text-gray-600">Sunny intervals</div>
                    </div>
                    <div className="text-sm text-gray-500">Weather Forecast</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4 text-center text-sm text-gray-600">
                    <div>Mon<br/>24°</div>
                    <div>Tue<br/>26°</div>
                    <div>Wed<br/>22°</div>
                    <div>Thu<br/>20°</div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Flight Status</div>
                      <div className="font-semibold text-gray-900">Flight AZ 611</div>
                      <div className="text-sm text-gray-600">Rome → Buenos Aires</div>
                      <div className="text-sm mt-2"><span className="text-green-600 font-medium">On time</span></div>
                    </div>
                    <Plane className="h-6 w-6 text-gray-400" />
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                {currentDay.activities.map((activity: Activity) => (
                  <Card key={activity.id} className="p-0 overflow-hidden shadow-sm border-gray-200">
                    <div className="p-5 flex items-start gap-4">
                      <div className="text-xs text-gray-600 w-32 shrink-0">
                        {activity.starts_at ? (
                          <div>
                            {activity.starts_at}
                            {activity.ends_at && (
                              <span> - {activity.ends_at}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>No time</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{activity.title}</div>
                            {activity.location && (
                              <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                                <MapPin className="h-3 w-3" />
                                {activity.location}
                              </div>
                            )}
                          </div>
                          <div className="w-24 h-16 rounded-lg bg-gray-200" />
                        </div>
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1"><Users className="h-4 w-4" />3</div>
                            <div className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />2</div>
                            <div className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />1</div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => deleteActivity(activity.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {newActivityDayId === currentDay.id && (
                  <Card className="p-4 space-y-2">
                    <Input
                      placeholder="Activity title"
                      value={newActivityTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityTitle(e.target.value)}
                    />
                    <Input
                      placeholder="Location"
                      value={newActivityLocation}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityLocation(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        placeholder="Start time"
                        value={newActivityStartTime}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityStartTime(e.target.value)}
                      />
                      <Input
                        type="time"
                        placeholder="End time"
                        value={newActivityEndTime}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityEndTime(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => addActivity(currentDay.id)} size="sm">Add</Button>
                      <Button variant="outline" onClick={() => setNewActivityDayId(null)} size="sm">Cancel</Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

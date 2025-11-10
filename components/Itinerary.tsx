'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Clock, MapPin, X, Sun, Plane, Users, ThumbsUp, MessageCircle } from 'lucide-react';
import { TripMembers } from '@/components/TripMembers';

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
  // Weather widget state
  const [weatherQuery, setWeatherQuery] = useState<string>('');
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string>('');
  const [weather, setWeather] = useState<{ name: string; country?: string; temp: number; description?: string | null; icon?: string | null } | null>(null);
  const [forecast, setForecast] = useState<Array<{ dt: number; min: number; max: number; icon: string | null; description: string | null; precip?: number; wind?: number }>>([]);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string>('');
  // Flight widget state
  const [flightQuery, setFlightQuery] = useState<string>('');
  const [flightLoading, setFlightLoading] = useState<boolean>(false);
  const [flightError, setFlightError] = useState<string>('');
  const [flight, setFlight] = useState<{
    flight?: string | null;
    airline?: string | null;
    departure?: {
      airport?: string | null;
      scheduled?: string | null;
      estimated?: string | null;
      actual?: string | null;
      gate?: string | null;
      terminal?: string | null;
      timezone?: string | null;
      delay?: number | null;
    };
    arrival?: {
      airport?: string | null;
      scheduled?: string | null;
      estimated?: string | null;
      actual?: string | null;
      gate?: string | null;
      terminal?: string | null;
      timezone?: string | null;
      delay?: number | null;
    };
    status?: string | null;
  } | null>(null);
  const [trip, setTrip] = useState<{ destination: string | null; lat: number | null; lng: number | null } | null>(null);

  useEffect(() => {
    loadDays();
    subscribeToChanges();
    loadTrip();
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

  const loadTrip = async () => {
    const { data } = await supabase
      .from('trips')
      .select('destination, lat, lng')
      .eq('id', tripId)
      .maybeSingle();

    if (data) {
      setTrip({ destination: (data as any).destination ?? null, lat: (data as any).lat ?? null, lng: (data as any).lng ?? null });
      // Pre-fill weather if we have a destination text
      const dest = (data as any).destination as string | null;
      if (dest && !weather) {
        setWeatherQuery(dest);
        try {
          setWeatherLoading(true);
          setWeatherError('');
          const res = await fetch(`/api/weather?q=${encodeURIComponent(dest)}`);
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(json.error || 'Failed');
          setWeather(json);
        } catch (err: any) {
          setWeather(null);
          setWeatherError(err?.message || 'Failed to fetch weather');
        } finally {
          setWeatherLoading(false);
        }
      }

      // Load 7-day forecast using lat/lng if available, otherwise fallback to destination name
      const lat = (data as any).lat as number | null;
      const lng = (data as any).lng as number | null;
      if (lat != null && lng != null) {
        fetchForecast(lat, lng, null);
      } else if (dest) {
        fetchForecast(null, null, dest);
      }
    }
  };

  const fetchForecast = async (lat: number | null, lng: number | null, q: string | null) => {
    try {
      setForecastLoading(true);
      setForecastError('');
      const params = lat != null && lng != null ? `lat=${lat}&lng=${lng}` : q ? `q=${encodeURIComponent(q)}` : '';
      if (!params) return;
      const res = await fetch(`/api/weather/forecast?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed');
      setForecast(Array.isArray(json.daily) ? json.daily : []);
    } catch (err: any) {
      setForecast([]);
      setForecastError(err?.message || 'Failed to fetch forecast');
    } finally {
      setForecastLoading(false);
    }
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

        <TripMembers tripId={tripId} />
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-3xl font-semibold text-gray-900">
                        {weather ? (
                          <>
                            {weather.temp}°C
                            <Sun className="h-6 w-6 text-yellow-500" />
                          </>
                        ) : (
                          <>
                            --°C <Sun className="h-6 w-6 text-yellow-500" />
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {weather
                          ? `${weather.name}${weather.country ? ', ' + weather.country : ''} • ${weather.description ?? 'Weather'}`
                          : 'Enter a city to fetch the weather'}
                      </div>
                      {weatherError && (
                        <div className="text-xs text-red-600 mt-1">{weatherError}</div>
                      )}
                      {forecastError && (
                        <div className="text-xs text-red-600 mt-1">{forecastError}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder="City (e.g., Rome,IT)"
                          value={weatherQuery}
                          onChange={(e) => setWeatherQuery(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={weatherLoading || !weatherQuery}
                          onClick={async () => {
                            try {
                              setWeatherLoading(true);
                              setWeatherError('');
                              const res = await fetch(`/api/weather?q=${encodeURIComponent(weatherQuery)}`);
                              const json = await res.json();
                              if (!res.ok || json.error) throw new Error(json.error || 'Failed');
                              setWeather(json);
                              // also refresh forecast based on query
                              fetchForecast(null, null, weatherQuery);
                            } catch (err: any) {
                              setWeather(null);
                              setWeatherError(err?.message || 'Failed to fetch weather');
                            } finally {
                              setWeatherLoading(false);
                            }
                          }}
                        >
                          {weatherLoading ? 'Loading...' : 'Get'}
                        </Button>
                      </div>
                      <div className="mt-4">
                        {forecastLoading ? (
                          <div className="text-xs text-gray-500">Loading 7-day forecast...</div>
                        ) : forecast && forecast.length > 0 ? (
                          <div className="grid grid-cols-7 gap-2">
                            {forecast.map((d) => (
                              <div key={d.dt} className="text-center text-xs p-2 border rounded-md">
                                <div className="font-medium">{new Date(d.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                <div className="text-gray-500">{new Date(d.dt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                <div className="my-1">
                                  {d.icon ? (
                                    <img alt={d.description || 'weather'} className="mx-auto h-6 w-6" src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`} />
                                  ) : (
                                    <Sun className="h-5 w-5 text-yellow-500 mx-auto" />
                                  )}
                                </div>
                                <div className="font-semibold">{d.max}°</div>
                                <div className="text-gray-500">{d.min}°</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No forecast available</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">Weather</div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">Flight Status</div>
                      <div className="font-semibold text-gray-900">{flight?.flight || 'Enter flight code'}</div>
                      {flight?.departure?.airport && flight?.arrival?.airport && (
                        <div className="text-sm text-gray-600">
                          {flight.departure.airport} → {flight.arrival.airport}
                        </div>
                      )}
                      {flight?.status && (
                        <div className="text-sm mt-2">
                          <span className={flight.status === 'cancelled' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {flight.status}
                          </span>
                        </div>
                      )}
                      {flight && (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700">
                          <div>
                            <div className="font-semibold text-gray-900">Departure</div>
                            {flight.departure?.scheduled && <div>Scheduled: {new Date(flight.departure.scheduled).toLocaleString()}</div>}
                            {flight.departure?.estimated && <div>Estimated: {new Date(flight.departure.estimated).toLocaleString()}</div>}
                            {flight.departure?.actual && <div>Actual: {new Date(flight.departure.actual).toLocaleString()}</div>}
                            {(flight.departure?.terminal || flight.departure?.gate) && (
                              <div>Terminal/Gate: {flight.departure.terminal || '-'} / {flight.departure.gate || '-'}</div>
                            )}
                            {typeof flight.departure?.delay === 'number' && <div>Delay: {flight.departure.delay} min</div>}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">Arrival</div>
                            {flight.arrival?.scheduled && <div>Scheduled: {new Date(flight.arrival.scheduled).toLocaleString()}</div>}
                            {flight.arrival?.estimated && <div>Estimated: {new Date(flight.arrival.estimated).toLocaleString()}</div>}
                            {flight.arrival?.actual && <div>Actual: {new Date(flight.arrival.actual).toLocaleString()}</div>}
                            {(flight.arrival?.terminal || flight.arrival?.gate) && (
                              <div>Terminal/Gate: {flight.arrival.terminal || '-'} / {flight.arrival.gate || '-'}</div>
                            )}
                            {typeof flight.arrival?.delay === 'number' && <div>Delay: {flight.arrival.delay} min</div>}
                          </div>
                        </div>
                      )}
                      {flightError && (
                        <div className="text-xs text-red-600 mt-1">{flightError}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder="Flight IATA (e.g., AZ611)"
                          value={flightQuery}
                          onChange={(e) => setFlightQuery(e.target.value.toUpperCase())}
                        />
                        <Button
                          size="sm"
                          disabled={flightLoading || !flightQuery}
                          onClick={async () => {
                            try {
                              setFlightLoading(true);
                              setFlightError('');
                              const res = await fetch(`/api/flight?flight=${encodeURIComponent(flightQuery)}`);
                              const json = await res.json();
                              if (!res.ok || json.error) throw new Error(json.error || 'Failed');
                              if (json.notFound) {
                                setFlight(null);
                                setFlightError('Flight not found');
                              } else {
                                setFlight(json);
                              }
                            } catch (err: any) {
                              setFlight(null);
                              setFlightError(err?.message || 'Failed to fetch flight');
                            } finally {
                              setFlightLoading(false);
                            }
                          }}
                        >
                          {flightLoading ? 'Loading...' : 'Get'}
                        </Button>
                      </div>
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

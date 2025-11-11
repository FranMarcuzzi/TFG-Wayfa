'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [newActivityType, setNewActivityType] = useState<'food' | 'museum' | 'sightseeing' | 'transport' | 'other'>('other');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [placePreds, setPlacePreds] = useState<{ description: string; place_id: string }[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const placeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [placeIdForActivity, setPlaceIdForActivity] = useState<string | null>(null);
  const [placeCoordsForActivity, setPlaceCoordsForActivity] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  // Per-day Weather widget state
  type WeatherInfo = { name: string; country?: string; temp: number; description?: string | null; icon?: string | null } | null;
  type ForecastItem = { dt: number; min: number; max: number; icon: string | null; description: string | null; precip?: number; wind?: number };
  const [weatherByDay, setWeatherByDay] = useState<Record<string, {
    query: string;
    loading: boolean;
    error: string;
    weather: WeatherInfo;
    forecast: ForecastItem[];
    forecastLoading: boolean;
    forecastError: string;
  }>>({});
  // Per-day Flight widget state
  const [flightByDay, setFlightByDay] = useState<Record<string, {
    query: string;
    loading: boolean;
    error: string;
    flight: {
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
    } | null;
  }>>({});
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
      // No prefill per-day here; user sets city per day.
    }
  };

  const ensureDayWeather = (dayId: string) => {
    setWeatherByDay((prev) => (
      prev[dayId]
        ? prev
        : { ...prev, [dayId]: { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' } }
    ));
  };

  const fetchForecastForDay = async (dayId: string, lat: number | null, lng: number | null, q: string | null) => {
    setWeatherByDay((prev) => ({
      ...prev,
      [dayId]: { ...(prev[dayId] || { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' }), forecastLoading: true, forecastError: '' },
    }));
    try {
      const params = lat != null && lng != null ? `lat=${lat}&lng=${lng}` : q ? `q=${encodeURIComponent(q)}` : '';
      if (!params) throw new Error('Missing query');
      const res = await fetch(`/api/weather/forecast?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed');
      setWeatherByDay((prev) => ({
        ...prev,
        [dayId]: { ...(prev[dayId] as any), forecast: Array.isArray(json.daily) ? json.daily : [], forecastLoading: false },
      }));
    } catch (err: any) {
      setWeatherByDay((prev) => ({
        ...prev,
        [dayId]: { ...(prev[dayId] as any), forecast: [], forecastLoading: false, forecastError: err?.message || 'Failed to fetch forecast' },
      }));
    }
  };

  const getWeatherForDay = async (dayId: string) => {
    const state = weatherByDay[dayId];
    const query = state?.query || '';
    if (!query) return;
    setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), loading: true, error: '' } }));
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed');
      setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json, loading: false } }));
      await fetchForecastForDay(dayId, null, null, query);
    } catch (err: any) {
      setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: null, loading: false, error: err?.message || 'Failed to fetch weather' } }));
    }
  };

  const ensureDayFlight = (dayId: string) => {
    setFlightByDay((prev) => (prev[dayId] ? prev : { ...prev, [dayId]: { query: '', loading: false, error: '', flight: null } }));
  };

  const getFlightForDay = async (dayId: string) => {
    const state = flightByDay[dayId];
    const query = state?.query || '';
    if (!query) return;
    setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), loading: true, error: '' } }));
    try {
      const res = await fetch(`/api/flight?flight=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed');
      if (json.notFound) throw new Error('Flight not found');
      setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), flight: json, loading: false } }));
    } catch (err: any) {
      setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), flight: null, loading: false, error: err?.message || 'Failed to fetch flight' } }));
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
    const dayBefore = days.find((d: Day) => d.id === dayId);
    const wasFirst = dayBefore ? (dayBefore.activities?.length || 0) === 0 : false;
    const { error } = await supabase.from('activities').insert({
      day_id: dayId,
      title: newActivityTitle,
      location: newActivityLocation || null,
      starts_at: newActivityStartTime || null,
      ends_at: newActivityEndTime || null,
      type: newActivityType,
    } as any);

    if (!error) {
      setNewActivityDayId(null);
      setNewActivityTitle('');
      setNewActivityLocation('');
      setNewActivityStartTime('');
      setNewActivityEndTime('');
      setNewActivityType('other');
      setPlacePreds([]);
      setPlaceIdForActivity(null);
      setPlaceCoordsForActivity({ lat: null, lng: null });
      if (wasFirst && (newActivityLocation || placeIdForActivity)) {
        const query = newActivityLocation;
        const coords = placeCoordsForActivity;
        setWeatherByDay((prev) => ({
          ...prev,
          [dayId]: {
            ...(prev[dayId] || { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' }),
            query,
          },
        }));
        try {
          const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (res.ok && !json.error) {
            setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json } }));
          }
        } catch {}
        if (coords.lat != null && coords.lng != null) {
          await fetchForecastForDay(dayId, coords.lat, coords.lng, null);
        } else if (query) {
          await fetchForecastForDay(dayId, null, null, query);
        }
      }
      // refresh activities list
      await loadDays();
    }
  };

  const deleteActivity = async (activityId: string) => {
    await supabase.from('activities').delete().eq('id', activityId);
    await loadDays();
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
                      {(() => {
                        const W = weatherByDay[currentDay.id] || { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' };
                        return (
                          <>
                      <div className="flex items-center gap-2 text-3xl font-semibold text-gray-900">
                        {W?.weather ? (
                          <>
                            {W.weather.temp}°C
                            <Sun className="h-6 w-6 text-yellow-500" />
                          </>
                        ) : (
                          <>
                            --°C <Sun className="h-6 w-6 text-yellow-500" />
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {W?.weather
                          ? `${W.weather.name}${W.weather.country ? ', ' + W.weather.country : ''} • ${W.weather.description ?? 'Weather'}`
                          : 'Enter a city to fetch the weather'}
                      </div>
                      {W?.error && (
                        <div className="text-xs text-red-600 mt-1">{W.error}</div>
                      )}
                      {W?.forecastError && (
                        <div className="text-xs text-red-600 mt-1">{W.forecastError}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder="City (e.g., Rome,IT)"
                          value={W?.query || ''}
                          onChange={(e) => setWeatherByDay((prev) => ({ ...prev, [currentDay.id]: { ...(prev[currentDay.id] as any), query: e.target.value } }))}
                        />
                        <Button
                          size="sm"
                          disabled={W?.loading || !(W?.query)}
                          onClick={() => getWeatherForDay(currentDay.id)}
                        >
                          {W?.loading ? 'Loading...' : 'Get'}
                        </Button>
                      </div>
                      <div className="mt-4">
                        {W?.forecastLoading ? (
                          <div className="text-xs text-gray-500">Loading forecast...</div>
                        ) : W?.forecast && W.forecast.length > 0 ? (
                          <div className="grid grid-cols-7 gap-2">
                            {W.forecast.map((d) => (
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
                                {typeof d.precip === 'number' && <div className="text-blue-600">{d.precip} mm</div>}
                                {typeof d.wind === 'number' && <div className="text-gray-600">{d.wind} km/h</div>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No forecast available</div>
                        )}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-sm text-gray-500">Weather</div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {(() => {
                        const F = flightByDay[currentDay.id] || { query: '', loading: false, error: '', flight: null };
                        return (
                          <>
                      <div className="text-sm text-gray-500">Flight Status</div>
                      <div className="font-semibold text-gray-900">{F?.flight?.flight || 'Enter flight code'}</div>
                      {F?.flight?.departure?.airport && F?.flight?.arrival?.airport && (
                        <div className="text-sm text-gray-600">
                          {F.flight!.departure!.airport} → {F.flight!.arrival!.airport}
                        </div>
                      )}
                      {F?.flight?.status && (
                        <div className="text-sm mt-2">
                          <span className={F.flight!.status === 'cancelled' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {F.flight!.status}
                          </span>
                        </div>
                      )}
                      {F?.flight && (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700">
                          <div>
                            <div className="font-semibold text-gray-900">Departure</div>
                            {F.flight.departure?.scheduled && <div>Scheduled: {new Date(F.flight.departure.scheduled).toLocaleString()}</div>}
                            {F.flight.departure?.estimated && <div>Estimated: {new Date(F.flight.departure.estimated).toLocaleString()}</div>}
                            {F.flight.departure?.actual && <div>Actual: {new Date(F.flight.departure.actual).toLocaleString()}</div>}
                            {(F.flight.departure?.terminal || F.flight.departure?.gate) && (
                              <div>Terminal/Gate: {F.flight.departure.terminal || '-'} / {F.flight.departure.gate || '-'}</div>
                            )}
                            {typeof F.flight.departure?.delay === 'number' && <div>Delay: {F.flight.departure.delay} min</div>}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">Arrival</div>
                            {F.flight.arrival?.scheduled && <div>Scheduled: {new Date(F.flight.arrival.scheduled).toLocaleString()}</div>}
                            {F.flight.arrival?.estimated && <div>Estimated: {new Date(F.flight.arrival.estimated).toLocaleString()}</div>}
                            {F.flight.arrival?.actual && <div>Actual: {new Date(F.flight.arrival.actual).toLocaleString()}</div>}
                            {(F.flight.arrival?.terminal || F.flight.arrival?.gate) && (
                              <div>Terminal/Gate: {F.flight.arrival.terminal || '-'} / {F.flight.arrival.gate || '-'}</div>
                            )}
                            {typeof F.flight.arrival?.delay === 'number' && <div>Delay: {F.flight.arrival.delay} min</div>}
                          </div>
                        </div>
                      )}
                      {F?.error && (
                        <div className="text-xs text-red-600 mt-1">{F.error}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder="Flight IATA (e.g., AZ611)"
                          value={(F?.query || '').toUpperCase()}
                          onChange={(e) => setFlightByDay((prev) => ({ ...prev, [currentDay.id]: { ...(prev[currentDay.id] as any), query: e.target.value.toUpperCase() } }))}
                        />
                        <Button
                          size="sm"
                          disabled={F?.loading || !(F?.query)}
                          onClick={() => getFlightForDay(currentDay.id)}
                        >
                          {F?.loading ? 'Loading...' : 'Get'}
                        </Button>
                      </div>
                          </>
                        );
                      })()}
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
                          <div className="w-24 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                            {(() => {
                              const t = (activity as any).type as string | undefined;
                              const map: Record<string, string> = { food: 'Food', museum: 'Museum', sightseeing: 'Sight', transport: 'Transport', other: 'Other' };
                              return t ? <span className="text-[10px] font-medium bg-gray-900 text-white px-2 py-1 rounded">{map[t] || 'Other'}</span> : null;
                            })()}
                          </div>
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
                    <div>
                      <label className="text-xs text-gray-600">Type</label>
                      <select
                        className="mt-1 w-full border rounded-md px-2 py-2 text-sm"
                        value={newActivityType}
                        onChange={(e) => setNewActivityType(e.target.value as any)}
                      >
                        <option value="food">Food</option>
                        <option value="museum">Museum</option>
                        <option value="sightseeing">Sightseeing</option>
                        <option value="transport">Transport</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Input
                        placeholder="Location"
                        value={newActivityLocation}
                        onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = e.target.value;
                          setNewActivityLocation(v);
                          setPlaceIdForActivity(null);
                          setPlaceCoordsForActivity({ lat: null, lng: null });
                          if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current as any);
                          const t = setTimeout(async () => {
                            if (!v || v.length < 2) {
                              setPlacePreds([]);
                              return;
                            }
                            try {
                              setPlaceLoading(true);
                              const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(v)}`);
                              const json = await res.json();
                              setPlacePreds(Array.isArray(json?.predictions) ? json.predictions : []);
                            } finally {
                              setPlaceLoading(false);
                            }
                          }, 300) as any;
                          placeDebounceRef.current = t;
                        }}
                      />
                      {newActivityLocation && placePreds.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-56 overflow-auto">
                          {placePreds.map((p) => (
                            <button
                              type="button"
                              key={p.place_id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={async () => {
                                setNewActivityLocation(p.description);
                                setPlacePreds([]);
                                setPlaceIdForActivity(p.place_id);
                                try {
                                  const r = await fetch(`/api/places/details?place_id=${encodeURIComponent(p.place_id)}`);
                                  const j = await r.json();
                                  if (j && j.lat != null && j.lng != null) {
                                    setPlaceCoordsForActivity({ lat: j.lat, lng: j.lng });
                                  } else {
                                    setPlaceCoordsForActivity({ lat: null, lng: null });
                                  }
                                } catch {
                                  setPlaceCoordsForActivity({ lat: null, lng: null });
                                }
                              }}
                            >
                              {p.description}
                            </button>
                          ))}
                        </div>
                      )}
                      {placeLoading && (
                        <div className="text-xs text-gray-500 mt-1">Searching...</div>
                      )}
                    </div>
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

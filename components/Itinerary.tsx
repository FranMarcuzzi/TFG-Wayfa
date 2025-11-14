'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Clock, MapPin, X, Sun, Plane, ThumbsUp, MessageCircle, Utensils, Landmark, Camera, Bus, Trash2, Calendar, BarChart3 } from 'lucide-react';
import { Polls } from '@/components/Polls';
import { TripMembers } from '@/components/TripMembers';
import { DayMap } from '@/components/DayMap';
import { Expenses } from '@/components/Expenses';
import { Chat } from '@/components/Chat';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Reveal } from '@/components/motion/Reveal';
import Player from 'lottie-react';
import loadingAnim from '@/public/animations/loading.json';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

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
  const { t, locale } = useI18n();
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
  // Flight widget typings to avoid complex inline generics in TSX
  type FlightLeg = {
    best?: string | null;
    airport?: string | null;
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
    gate?: string | null;
    terminal?: string | null;
    timezone?: string | null;
    delay?: number | null;
  };

  const fmtHM = (s?: string | null) => {
    if (!s) return '';
    const m = String(s);
    return m.length >= 5 ? m.slice(0, 5) : m;
  };

  // Countdown state for trip start
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // trip-dependent helpers are declared later, after `trip` state

  const askAI = async () => {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    // push user message and clear input
    setAiMessages((prev) => [...prev, { role: 'user', content: q }]);
    setAiQuery('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, locale }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'AI error');
      setAiMessages((prev) => [...prev, { role: 'assistant', content: String(json.answer || '') }]);
    } catch (e: any) {
      setAiError(e?.message || 'AI error');
    } finally {
      setAiLoading(false);
    }
  };

  // Resolve and persist missing coordinates for activities that have a place_id
  const backfillMissingCoords = async (daysList: Day[]) => {
    const key = `wayfa:actcoords:${tripId}`;
    let saved: Record<string, Record<string, { lat: number; lng: number }>> = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}

    let changed = false;
    for (const d of daysList) {
      const acts = (d.activities || []) as any[];
      for (const a of acts) {
        const hasCoords = typeof a.lat === 'number' && typeof a.lng === 'number';
        if (hasCoords) continue;
        const pid = (a as any).place_id as string | null | undefined;
        if (pid) {
          try {
            const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(pid)}`);
            const json = await res.json();
            const lat = json?.lat ?? json?.result?.geometry?.location?.lat ?? null;
            const lng = json?.lng ?? json?.result?.geometry?.location?.lng ?? null;
            if (typeof lat === 'number' && typeof lng === 'number') {
          // @ts-expect-error - Supabase type issue
              await supabase.from('activities').update({ lat, lng }).eq('id', a.id);
              saved[d.id] = saved[d.id] || {};
              saved[d.id][a.id] = { lat, lng };
              changed = true;
              setDays((prev) => prev.map((day) => day.id === d.id ? ({
                ...day,
                activities: (day.activities || []).map((act: any) => act.id === a.id ? { ...act, lat, lng } : act)
              }) : day));
              continue;
            }
          } catch {}
        }
        // Fallback: try resolving by location text
        const locName = (a as any).location as string | null | undefined;
        if (locName) {
          try {
            const ac = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(locName)}&limit=1`);
            const sug = await ac.json();
            const first = Array.isArray(sug?.predictions) ? sug.predictions[0] : (Array.isArray(sug) ? sug[0] : null);
            const pid2 = first?.place_id || first?.placeId;
            if (pid2) {
              const det = await fetch(`/api/places/details?place_id=${encodeURIComponent(pid2)}`);
              const js = await det.json();
              const lat = js?.lat ?? js?.result?.geometry?.location?.lat ?? null;
              const lng = js?.lng ?? js?.result?.geometry?.location?.lng ?? null;
              if (typeof lat === 'number' && typeof lng === 'number') {
                // @ts-expect-error - Supabase type issue
                await supabase.from('activities').update({ lat, lng, place_id: pid2 }).eq('id', a.id);
                saved[d.id] = saved[d.id] || {};
                saved[d.id][a.id] = { lat, lng };
                changed = true;
                setDays((prev) => prev.map((day) => day.id === d.id ? ({
                  ...day,
                  activities: (day.activities || []).map((act: any) => act.id === a.id ? { ...act, lat, lng, place_id: pid2 } : act)
                }) : day));
              }
            }
          } catch {}
        }
      }
    }
    if (changed) {
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
    }
  };
  type FlightInfo = {
    flight?: string | null;
    airline?: string | null;
    departure?: FlightLeg;
    arrival?: FlightLeg;
    status?: string | null;
  } | null;
  type FlightState = {
    query: string;
    loading: boolean;
    error: string;
    flight: FlightInfo;
  };
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
  const [flightByDay, setFlightByDay] = useState<Record<string, FlightState>>({});
  const [trip, setTrip] = useState<{ destination: string | null; lat: number | null; lng: number | null; start_date: string | null; end_date: string | null } | null>(null);
  // Helpers that depend on `trip`
  const startDate = trip?.start_date ? new Date(trip.start_date) : null;
  const endDate = trip?.end_date ? new Date(trip.end_date) : null;
  const diffToStartMs = startDate ? startDate.getTime() - nowTs : null;
  const diffToEndMs = endDate ? endDate.getTime() - nowTs : null;
  const relFmt = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    try {
      return new Intl.RelativeTimeFormat(locale as any, { numeric: 'auto' }).format(value, unit);
    } catch {
      return `${value} ${unit}`;
    }
  };
  const partsFromMs = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return { days, hours, minutes };
  };
  const tripStatus = (): 'planning' | 'active' | 'past' | null => {
    if (!trip) return null;
    const now = new Date();
    const start = trip.start_date ? new Date(trip.start_date) : null;
    const end = trip.end_date ? new Date(trip.end_date) : null;
    if (!start || !end) return 'planning';
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (today < s) return 'planning';
    if (today > e) return 'past';
    return 'active';
  };
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPollsOpen, setIsPollsOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likesByActivity, setLikesByActivity] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [commentsCountByActivity, setCommentsCountByActivity] = useState<Record<string, number>>({});
  const [openCommentsFor, setOpenCommentsFor] = useState<Record<string, boolean>>({});
  const [commentsByActivity, setCommentsByActivity] = useState<Record<string, Array<{ id: string; user_id: string; content: string; created_at: string; user_name?: string; user_email?: string }>>>({});
  const [newCommentByActivity, setNewCommentByActivity] = useState<Record<string, string>>({});
  const [mediaUploadingByActivity, setMediaUploadingByActivity] = useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  // Ask Wayfa AI state (simple chat)
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  // Expenses summary state
  const [expenseTotalCents, setExpenseTotalCents] = useState<number>(0);
  const [expenseUserBalanceCents, setExpenseUserBalanceCents] = useState<number>(0);

  // Helpers
  const formatInTZ = (iso?: string | null, tz?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const base = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: tz || 'UTC',
      }).format(d);
      let gmt = '';
      try {
        const parts = new Intl.DateTimeFormat(undefined, {
          timeZone: tz || 'UTC',
          timeZoneName: 'shortOffset',
        }).formatToParts(d);
        const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
        if (tzPart) gmt = tzPart.replace('UTC', 'GMT');
      } catch {}
      if (tz) return `${base} (${tz}${gmt ? `, ${gmt}` : ''})`;
      return gmt ? `${base} (${gmt})` : base;
    } catch {
      return new Date(iso).toLocaleString();
    }
  };

  // Reactions and comments helpers
  const refreshReactions = async (activities: Activity[]) => {
    if (!activities || activities.length === 0) return;
    const uid = (await supabase.auth.getUser()).data.user?.id || currentUserId;
    const likesEntries: Record<string, { count: number; liked: boolean }> = {};
    const commentsEntries: Record<string, number> = {};
    for (const a of activities) {
      const likesRes = await supabase
        .from('activity_likes')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', a.id);
      const likedRes = uid
        ? await supabase
            .from('activity_likes')
            .select('user_id')
            .eq('activity_id', a.id)
            .eq('user_id', uid)
            .maybeSingle()
        : ({ data: null } as any);
      const commentsRes = await supabase
        .from('activity_comments')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', a.id);
      likesEntries[a.id] = { count: (likesRes as any).count || 0, liked: !!(likedRes as any).data };
      commentsEntries[a.id] = (commentsRes as any).count || 0;
    }
    setLikesByActivity(likesEntries);
    setCommentsCountByActivity(commentsEntries);
  };

  const toggleLike = async (activityId: string) => {
    if (!currentUserId) return;
    const liked = likesByActivity[activityId]?.liked;
    if (liked) {
      await supabase.from('activity_likes').delete().eq('activity_id', activityId).eq('user_id', currentUserId);
    } else {
      await supabase.from('activity_likes').insert({ activity_id: activityId, user_id: currentUserId } as any);
    }
    const countRes = await supabase
      .from('activity_likes')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activityId);
    setLikesByActivity((prev) => ({
      ...prev,
      [activityId]: { count: (countRes as any).count || 0, liked: !liked },
    }));
  };

  const loadCommentsFor = async (activityId: string) => {
    const { data } = await supabase
      .from('activity_comments')
      .select(`*, user_profiles!activity_comments_user_id_fkey ( email, display_name )`)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });
    const mapped = (data || []).map((c: any) => ({
      id: c.id,
      activity_id: c.activity_id,
      user_id: c.user_id,
      content: c.content,
      created_at: c.created_at,
      user_name: c.user_profiles?.display_name || null,
      user_email: c.user_profiles?.email || 'Unknown',
    }));
    setCommentsByActivity((prev) => ({ ...prev, [activityId]: mapped }));
  };

  const toggleComments = async (activityId: string) => {
    const isOpen = !!openCommentsFor[activityId];
    setOpenCommentsFor((prev) => ({ ...prev, [activityId]: !isOpen }));
    if (!isOpen) await loadCommentsFor(activityId);
  };

  const addComment = async (activityId: string) => {
    if (!currentUserId) return;
    const content = newCommentByActivity[activityId]?.trim();
    if (!content) return;
    const { error } = await supabase.from('activity_comments').insert({ activity_id: activityId, user_id: currentUserId, content } as any);
    if (!error) {
      setNewCommentByActivity((prev) => ({ ...prev, [activityId]: '' }));
      await loadCommentsFor(activityId);
      const countRes = await supabase
        .from('activity_comments')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId);
      setCommentsCountByActivity((prev) => ({ ...prev, [activityId]: (countRes as any).count || 0 }));
    }
  };

  useEffect(() => {
    loadDays();
    subscribeToChanges();
    loadTrip();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, [tripId]);

  useEffect(() => {
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  useEffect(() => {
    // Load expense summary once user is known
    if (!currentUserId) return;
    loadExpenseSummary();
    const ch = supabase
      .channel('trip-expenses-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses', filter: `trip_id=eq.${tripId}` }, () => loadExpenseSummary())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expense_splits' }, () => loadExpenseSummary())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tripId, currentUserId]);

  const loadExpenseSummary = async () => {
    const { data: expenses } = await supabase
      .from('trip_expenses')
      .select('*')
      .eq('trip_id', tripId);
    const exp = (expenses || []) as any[];
    const totalCents = exp.filter((e) => e.currency === 'USD').reduce((acc, e) => acc + (e.amount_cents || 0), 0);
    setExpenseTotalCents(totalCents);
    const ids = exp.map((e) => e.id);
    let userBalance = 0;
    if (currentUserId) {
      const paid = exp.filter((e) => e.paid_by === currentUserId && e.currency === 'USD').reduce((acc, e) => acc + (e.amount_cents || 0), 0);
      if (ids.length > 0) {
        const { data: splits } = await supabase
          .from('trip_expense_splits')
          .select('user_id, share_cents, expense_id')
          .in('expense_id', ids);
        const owes = (splits || []).filter((s: any) => s.user_id === currentUserId).reduce((acc: number, s: any) => acc + (s.share_cents || 0), 0);
        userBalance = paid - owes;
      } else {
        userBalance = paid;
      }
    }
    setExpenseUserBalanceCents(userBalance);
  };

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

          // enrich activities with stored coords from localStorage (if present)
          const baseActs: any[] = (activities || []) as any[];
          let enriched: any[] = baseActs;
          try {
            const key = `wayfa:actcoords:${tripId}`;
            const saved: Record<string, Record<string, { lat: number; lng: number }>> = JSON.parse(localStorage.getItem(key) || '{}');
            const byDay = saved[day.id] || {};
            enriched = baseActs.map((a: any) => {
              const c = byDay[a.id];
              return c ? { ...a, lat: c.lat, lng: c.lng } : a;
            });
          } catch {}

          return {
            ...day,
            activities: enriched,
          };
        })
      );

      setDays(daysWithActivities);
      // Restore persisted weather and flights first
      await restoreSavedWeather(daysWithActivities as any);
      await restoreSavedFlights(daysWithActivities as any);
      // Initialize weather per day from first activity location when available (only if not restored)
      try {
        for (const d of daysWithActivities) {
          const first = (d.activities || [])[0];
          if (!first || !first.location) continue;
          // Skip if already set
          if (weatherByDay[d.id]?.weather) continue;
          const q = String(first.location);
          const hasCoords = typeof (first as any).lat === 'number' && typeof (first as any).lng === 'number';
          setWeatherByDay((prev) => ({
            ...prev,
            [d.id]: {
              ...(prev[d.id] || { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' }),
              query: q,
            },
          }));
          if (hasCoords) {
            try {
              const res = await fetch(`/api/weather?lat=${(first as any).lat}&lng=${(first as any).lng}`);
              const json = await res.json();
              if (res.ok && !json.error) {
                setWeatherByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] as any), weather: json } }));
                persistWeather(d.id, q, (first as any).lat, (first as any).lng);
              }
            } catch {}
            await fetchForecastForDay(d.id, (first as any).lat, (first as any).lng, null);
          } else {
            try {
              const res = await fetch(`/api/weather?q=${encodeURIComponent(q)}`);
              const json = await res.json();
              if (res.ok && !json.error) {
                setWeatherByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] as any), weather: json } }));
                persistWeather(d.id, q, null, null);
              }
            } catch {}
            await fetchForecastForDay(d.id, null, null, q);
          }
        }
      } catch {}
      // Backfill coords for activities missing lat/lng when place_id exists
      try {
        await backfillMissingCoords(daysWithActivities as any);
      } catch {}
      const allActs = daysWithActivities.flatMap((d: any) => d.activities || []);
      await refreshReactions(allActs as any);
      if (!selectedDayId && daysWithActivities.length > 0) {
        setSelectedDayId(daysWithActivities[0].id);
      }
    }

    setLoading(false);
  };

  const loadTrip = async () => {
    const { data } = await supabase
      .from('trips')
      .select('destination, lat, lng, start_date, end_date')
      .eq('id', tripId)
      .maybeSingle();

    if (data) {
      setTrip({
        destination: (data as any).destination ?? null,
        lat: (data as any).lat ?? null,
        lng: (data as any).lng ?? null,
        start_date: (data as any).start_date ?? null,
        end_date: (data as any).end_date ?? null,
      });
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

  // persist weather (query and optional coords) per day
  const persistWeather = (dayId: string, q: string | null, lat: number | null, lng: number | null) => {
    try {
      const key = `wayfa:weather:${tripId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      saved[dayId] = { q: q || '', lat, lng };
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {}
  };

  // restore saved weather per day
  const restoreSavedWeather = async (daysList: Day[]) => {
    try {
      const key = `wayfa:weather:${tripId}`;
      const saved: Record<string, { q: string; lat: number | null; lng: number | null }> = JSON.parse(localStorage.getItem(key) || '{}');
      for (const d of daysList) {
        const item = saved[d.id];
        if (!item || !item.q) continue;
        setWeatherByDay((prev) => ({
          ...prev,
          [d.id]: {
            ...(prev[d.id] || { query: '', loading: false, error: '', weather: null, forecast: [], forecastLoading: false, forecastError: '' }),
            query: item.q,
          },
        }));
        try {
          // weather current by q
          const res = await fetch(`/api/weather?q=${encodeURIComponent(item.q)}`);
          const json = await res.json();
          if (res.ok && !json.error) {
            setWeatherByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] as any), weather: json } }));
          }
        } catch {}
        // forecast prefers coords if present
        await fetchForecastForDay(d.id, item.lat, item.lng, item.lat != null && item.lng != null ? null : item.q);
      }
    } catch {}
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
      persistWeather(dayId, query, null, null);
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
      // persist flight query per day
      try {
        const key = `wayfa:flight:${tripId}`;
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        saved[dayId] = query;
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {}
    } catch (err: any) {
      setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), flight: null, loading: false, error: err?.message || 'Failed to fetch flight' } }));
    }
  };

  // restore saved flights when loading days
  const restoreSavedFlights = async (daysList: Day[]) => {
    try {
      const key = `wayfa:flight:${tripId}`;
      const saved: Record<string, string> = JSON.parse(localStorage.getItem(key) || '{}');
      for (const d of daysList) {
        const q = saved[d.id];
        if (!q) continue;
        setFlightByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] || { query: '', loading: false, error: '', flight: null }), query: q } }));
        // fetch flight details
        try {
          const res = await fetch(`/api/flight?flight=${encodeURIComponent(q)}`);
          const json = await res.json();
          if (res.ok && !json.error && !json.notFound) {
            setFlightByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] as any), flight: json } }));
          }
        } catch {}
      }
    } catch {}
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

    const messagesChannel = supabase
      .channel(`trip-${tripId}-msgs`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          setUnreadCount((prev) => (isChatOpen ? prev : prev + 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(messagesChannel);
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
    const { data: inserted, error } = await supabase.from('activities').insert({
      day_id: dayId,
      title: newActivityTitle,
      location: newActivityLocation || null,
      starts_at: newActivityStartTime || null,
      ends_at: newActivityEndTime || null,
      place_id: placeIdForActivity || null,
      lat: placeCoordsForActivity.lat,
      lng: placeCoordsForActivity.lng,
      type: newActivityType,
    } as any).select('*').single();

    if (!error) {
      const newActId = (inserted as any)?.id as string | undefined;
      // Persist per-activity coords for map rendering
      if (newActId && placeCoordsForActivity.lat != null && placeCoordsForActivity.lng != null) {
        try {
          const key = `wayfa:actcoords:${tripId}`;
          const saved = JSON.parse(localStorage.getItem(key) || '{}');
          saved[dayId] = saved[dayId] || {};
          saved[dayId][newActId] = { lat: placeCoordsForActivity.lat as number, lng: placeCoordsForActivity.lng as number };
          localStorage.setItem(key, JSON.stringify(saved));
        } catch {}
      }
      setNewActivityDayId(null);
      setNewActivityTitle('');
      setNewActivityLocation('');
      setNewActivityStartTime('');
      setNewActivityEndTime('');
      setNewActivityType('other');
      setPlacePreds([]);
      setPlaceIdForActivity(null);
      // keep coords around for persistence below
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
        // Persist and fetch weather/forecast preferring coords when present
        if (coords.lat != null && coords.lng != null) {
          persistWeather(dayId, query, coords.lat, coords.lng);
          try {
            const res = await fetch(`/api/weather?lat=${coords.lat}&lng=${coords.lng}`);
            const json = await res.json();
            if (res.ok && !json.error) {
              setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json } }));
            }
          } catch {}
          await fetchForecastForDay(dayId, coords.lat, coords.lng, null);
        } else if (query) {
          persistWeather(dayId, query, null, null);
          try {
            const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (res.ok && !json.error) {
              setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json } }));
            }
          } catch {}
          await fetchForecastForDay(dayId, null, null, query);
        }
      }
      // refresh activities list
      await loadDays();
      // finally clear coords state
      setPlaceCoordsForActivity({ lat: null, lng: null });
    }
  };

  const deleteActivity = async (activityId: string) => {
    await supabase.from('activities').delete().eq('id', activityId);
    await loadDays();
  };

  const deleteDay = async (dayId: string) => {
    try {
      await supabase.from('activities').delete().eq('day_id', dayId);
      await supabase.from('days').delete().eq('id', dayId);
      await loadDays();
      if (selectedDayId === dayId) {
        const next = days.find((d) => d.id !== dayId)?.id || null;
        setSelectedDayId(next);
      }
    } catch {}
  };

  const confirmDeleteDay = (day: Day) => {
    const desc = day.date ? new Date(day.date).toLocaleDateString() : t('itinerary.plan');
    toast({
      title: t('itinerary.deleteDayTitle'),
      description: `${t('itinerary.dayLabel', { n: String(day.day_index) })} • ${desc}`,
      action: (
        <ToastAction altText={t('itinerary.delete')} onClick={() => deleteDay(day.id)}>
          {t('itinerary.delete')}
        </ToastAction>
      ),
    });
  };

  const uploadMedia = async (activityId: string, file: File) => {
    try {
      setMediaUploadingByActivity((p) => ({ ...p, [activityId]: true }));
      const bucket = 'activity-media';
      const path = `${tripId}/${activityId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = data.publicUrl;
      await supabase.from('activity_comments').insert({ activity_id: activityId, user_id: currentUserId, content: url } as any);
      await loadCommentsFor(activityId);
    } catch (e) {
      // Error handled silently
    } finally {
      setMediaUploadingByActivity((p) => ({ ...p, [activityId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="relative">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <Player autoplay loop animationData={loadingAnim as any} style={{ width: 280, height: 280 }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-4 p-4">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="space-y-4 p-4">
            <div className="h-40 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-40 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
      <div className="space-y-4 lg:space-y-6">
        {/* Trip start countdown */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-800">Trip countdown</div>
            <Calendar className="h-4 w-4 text-gray-600" />
          </div>
          {startDate ? (
            (() => {
              const hasStarted = diffToStartMs! <= 0;
              const isActive = hasStarted && (!!endDate ? nowTs <= endDate.getTime() : true);
              const isPast = !!endDate && nowTs > endDate.getTime();
              const showMs = hasStarted ? (diffToEndMs ?? 0) : (diffToStartMs ?? 0);
              const { days, hours, minutes } = partsFromMs(showMs);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/80 backdrop-blur px-3 py-2 text-center border border-white/60 shadow-sm">
                      <div className="text-2xl font-bold text-gray-900">{days}</div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-600">Days</div>
                    </div>
                    <div className="rounded-lg bg-white/80 backdrop-blur px-3 py-2 text-center border border-white/60 shadow-sm">
                      <div className="text-2xl font-bold text-gray-900">{hours}</div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-600">Hours</div>
                    </div>
                    <div className="rounded-lg bg-white/80 backdrop-blur px-3 py-2 text-center border border-white/60 shadow-sm">
                      <div className="text-2xl font-bold text-gray-900">{minutes}</div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-600">Minutes</div>
                    </div>
                  </div>
                  {/* Intentionally no relative/start text per UX request */}
                </>
              );
            })()
          ) : (
            <div className="text-xs text-gray-600">Set a start date to see the countdown</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{t('itinerary.title')}</h3>
            </div>
            <Button onClick={addDay} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('itinerary.addDay')}
            </Button>
          </div>
          {days.length === 0 ? (
            <div className="text-sm text-gray-600">{t('itinerary.noDays')}</div>
          ) : (
            <div className="space-y-2">
              {days.map((day: Day, idx: number) => (
                <Reveal key={day.id} variant="slideUp" delayMs={idx * 70}>
                  <button
                    onClick={() => setSelectedDayId(day.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border transition ${
                      selectedDayId === day.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t('itinerary.dayLabel', { n: String(day.day_index) })}</div>
                      {(() => {
                        const dstr = day.date
                          ? new Date(day.date).toLocaleDateString()
                          : (trip?.start_date
                              ? (() => { const base = new Date(trip!.start_date!); base.setDate(base.getDate() + (day.day_index - 1)); return base.toLocaleDateString(); })()
                              : null);
                        return dstr ? (
                          <div className={`text-xs ${selectedDayId === day.id ? 'text-gray-200' : 'text-gray-500'}`}>{dstr}</div>
                        ) : null;
                      })()}
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          )}
        </Card>

        <Reveal>
          <Card className="overflow-hidden">
          {(() => {
            const currentDay = days.find((d: Day) => d.id === selectedDayId) || days[0];
            const acts = (currentDay?.activities || []) as any[];
            let centerHint: { lat: number; lng: number } | null = null;
            // Prefer first activity coords
            const firstWithCoords = acts.find((a) => typeof a?.lat === 'number' && typeof a?.lng === 'number');
            if (firstWithCoords) {
              centerHint = { lat: firstWithCoords.lat, lng: firstWithCoords.lng };
            } else {
              // Fallback to persisted weather coords for the day
              try {
                const key = `wayfa:weather:${tripId}`;
                const saved: Record<string, { q: string; lat: number | null; lng: number | null }> = JSON.parse(localStorage.getItem(key) || '{}');
                const entry = saved[currentDay?.id || ''];
                if (entry && typeof entry.lat === 'number' && typeof entry.lng === 'number') {
                  centerHint = { lat: entry.lat, lng: entry.lng };
                }
              } catch {}
              // Fallback to trip coords
              if (!centerHint && trip && typeof trip.lat === 'number' && typeof trip.lng === 'number') {
                centerHint = { lat: trip.lat!, lng: trip.lng! };
              }
            }
            return <DayMap activities={acts as any} className="w-full" height={192} centerHint={centerHint} />;
          })()}
          </Card>
        </Reveal>

        <Reveal>
          <Card className="p-4 space-y-3">
          <div className="font-semibold text-gray-900">{t('ai.title')}</div>
          {aiMessages.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 rounded-md bg-gray-50">{t('ai.sample')}</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto pr-1">
              {aiMessages.map((m, idx) => (
                <div key={idx} className={`text-sm whitespace-pre-wrap p-3 rounded-md ${m.role === 'assistant' ? 'bg-gray-50 text-gray-700' : 'bg-white border text-gray-800'}`}>
                  {m.content}
                </div>
              ))}
            </div>
          )}
          {aiError && <div className="text-xs text-red-600">{aiError}</div>}
          <div className="flex gap-2">
            <Input
              placeholder={t('ai.placeholder')}
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') askAI(); }}
            />
            <Button size="sm" onClick={askAI} disabled={aiLoading || !aiQuery.trim()}>
              {aiLoading ? t('common.loading') : t('ai.ask')}
            </Button>
          </div>
          </Card>
        </Reveal>

        <Reveal>
          <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-gray-900">{t('expenses.summary')}</div>
            <div className="text-gray-500">$</div>
          </div>
          <div className="text-sm text-gray-600">{t('expenses.total')}</div>
          <div className="text-3xl font-bold text-gray-900">${(expenseTotalCents/100).toFixed(2)}</div>
          <div className="text-sm text-green-600">
            {(expenseUserBalanceCents >= 0 ? '' : '-')}${(Math.abs(expenseUserBalanceCents)/100).toFixed(2)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExpensesOpen(true)}>{t('expenses.viewDetails')}</Button>
            <Button size="sm" onClick={() => setIsExpensesOpen(true)}>{t('expenses.openForm')}</Button>
          </div>
          </Card>
        </Reveal>

        <TripMembers tripId={tripId} />
      </div>

      <div className="space-y-6">
        {(() => {
          const currentDay = days.find((d: Day) => d.id === selectedDayId) || days[0];
          if (!currentDay) return (
            <Card className="p-8 text-center">
              <p className="text-gray-600">{t('itinerary.noDaysCta')}</p>
            </Card>
          );

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">{t('itinerary.dayHeading', { n: String(currentDay.day_index), date: currentDay.date ? new Date(currentDay.date).toLocaleDateString() : t('itinerary.plan') })}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => setNewActivityDayId(currentDay.id)}>
                    <Plus className="h-4 w-4" />
                    {t('itinerary.addActivity')}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => confirmDeleteDay(currentDay)} aria-label="Delete day">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Reveal>
                  <Reveal>
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
                          ? `${W.weather.name}${W.weather.country ? ', ' + W.weather.country : ''} • ${W.weather.description ?? t('itinerary.weather')}`
                          : t('itinerary.enterCity')}
                      </div>
                      {W?.error && (
                        <div className="text-xs text-red-600 mt-1">{W.error}</div>
                      )}
                      {W?.forecastError && (
                        <div className="text-xs text-red-600 mt-1">{W.forecastError}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder={t('itinerary.cityPlaceholder')}
                          value={W?.query || ''}
                          onChange={(e) => setWeatherByDay((prev) => ({ ...prev, [currentDay.id]: { ...(prev[currentDay.id] as any), query: e.target.value } }))}
                        />
                        <Button
                          size="sm"
                          disabled={W?.loading || !(W?.query)}
                          onClick={() => getWeatherForDay(currentDay.id)}
                        >
                          {W?.loading ? t('common.loading') : t('common.get')}
                        </Button>
                      </div>
                      <div className="mt-4">
                        {W?.forecastLoading ? (
                          <div className="text-xs text-gray-500">{t('itinerary.loadingForecast')}</div>
                        ) : W?.forecast && W.forecast.length > 0 ? (
                          <div className="grid grid-cols-7 gap-2">
                            {W.forecast.map((d) => (
                              <div key={d.dt} className="text-center text-xs p-2 border rounded-md">
                                <div className="font-medium">{new Date(d.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                <div className="text-gray-500">{new Date(d.dt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                <div className="my-1">
                                  {d.icon ? (
                                    <img alt={d.description || t('itinerary.weather')} className="mx-auto h-6 w-6" src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`} />
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
                          <div className="text-xs text-gray-500">{t('itinerary.noForecast')}</div>
                        )}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-sm text-gray-500">{t('itinerary.weather')}</div>
                  </div>
                    </Card>
                </Reveal>
                </Reveal>

                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {(() => {
                        const F = flightByDay[currentDay.id] || { query: '', loading: false, error: '', flight: null };
                        return (
                          <>
                      <div className="text-sm text-gray-500">{t('itinerary.flightStatus')}</div>
                      <div className="font-semibold text-gray-900">{F?.flight?.flight || t('itinerary.enterFlight')}</div>
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
                            <div className="font-semibold text-gray-900">{t('itinerary.departure')}</div>
                            {(() => {
                              const leg = F.flight?.departure;
                              const timePick = leg?.best || leg?.estimated || leg?.scheduled || leg?.actual;
                              const str = formatInTZ(timePick, leg?.timezone);
                              return <div>{t('itinerary.time')}: {str || '—'}</div>;
                            })()}
                            {F.flight.departure?.scheduled && <div>{t('itinerary.scheduled')}: {formatInTZ(F.flight.departure.scheduled, F.flight.departure.timezone)}</div>}
                            {F.flight.departure?.estimated && <div>{t('itinerary.estimated')}: {formatInTZ(F.flight.departure.estimated, F.flight.departure.timezone)}</div>}
                            {F.flight.departure?.actual && <div>{t('itinerary.actual')}: {formatInTZ(F.flight.departure.actual, F.flight.departure.timezone)}</div>}
                            {(F.flight.departure?.terminal || F.flight.departure?.gate) && (
                              <div>{t('itinerary.terminalGate')}: {F.flight.departure.terminal || '-'} / {F.flight.departure.gate || '-'}</div>
                            )}
                            {typeof F.flight.departure?.delay === 'number' && <div>{t('itinerary.delay')}: {F.flight.departure.delay} min</div>}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{t('itinerary.arrival')}</div>
                            {(() => {
                              const leg = F.flight?.arrival;
                              const timePick = leg?.best || leg?.estimated || leg?.scheduled || leg?.actual;
                              const str = formatInTZ(timePick, leg?.timezone);
                              return <div>{t('itinerary.time')}: {str || '—'}</div>;
                            })()}
                            {F.flight.arrival?.scheduled && <div>{t('itinerary.scheduled')}: {formatInTZ(F.flight.arrival.scheduled, F.flight.arrival.timezone)}</div>}
                            {F.flight.arrival?.estimated && <div>{t('itinerary.estimated')}: {formatInTZ(F.flight.arrival.estimated, F.flight.arrival.timezone)}</div>}
                            {F.flight.arrival?.actual && <div>{t('itinerary.actual')}: {formatInTZ(F.flight.arrival.actual, F.flight.arrival.timezone)}</div>}
                            {(F.flight.arrival?.terminal || F.flight.arrival?.gate) && (
                              <div>{t('itinerary.terminalGate')}: {F.flight.arrival.terminal || '-'} / {F.flight.arrival.gate || '-'}</div>
                            )}
                            {typeof F.flight.arrival?.delay === 'number' && <div>{t('itinerary.delay')}: {F.flight.arrival.delay} min</div>}
                          </div>
                        </div>
                      )}
                      {F?.error && (
                        <div className="text-xs text-red-600 mt-1">{F.error}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Input
                          placeholder={t('itinerary.flightPlaceholder')}
                          value={(F?.query || '').toUpperCase()}
                          onChange={(e) => setFlightByDay((prev) => ({ ...prev, [currentDay.id]: { ...(prev[currentDay.id] as any), query: e.target.value.toUpperCase() } }))}
                        />
                        <Button
                          size="sm"
                          disabled={F?.loading || !(F?.query)}
                          onClick={() => getFlightForDay(currentDay.id)}
                        >
                          {F?.loading ? t('common.loading') : t('common.get')}
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
                  <Reveal key={activity.id} delayMs={0}>
                    <div className="space-y-2">
                      <Card className="p-0 overflow-hidden shadow-sm border-gray-200">
                      <div className="p-5 flex items-start gap-4">
                        <div className="w-32 shrink-0">
                          {activity.starts_at ? (
                            <div className="flex w-full items-center justify-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
                              <Clock className="h-3 w-3" />
                              <span>
                                {fmtHM(activity.starts_at)}{activity.ends_at ? ` - ${fmtHM(activity.ends_at)}` : ''}
                              </span>
                            </div>
                          ) : (
                            <div className="flex w-full items-center justify-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
                              <Clock className="h-3 w-3" />
                              <span>{t('itinerary.noTime')}</span>
                            </div>
                          )}
                          {(() => {
                            const t = (activity as any).type as string | undefined;
                            const Icon = t === 'food' ? Utensils : t === 'museum' ? Landmark : t === 'sightseeing' ? Camera : t === 'transport' ? Bus : null;
                            return Icon ? (
                              <div className="mt-2 h-16 w-full rounded-lg bg-gray-200 flex items-center justify-center">
                                <Icon className="h-8 w-8 text-gray-700" />
                              </div>
                            ) : null;
                          })()}
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
                            {/* removed right-side type icon per UX request */}
                          </div>
                          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                              <button className={`flex items-center gap-1 ${likesByActivity[activity.id]?.liked ? 'text-blue-600' : ''}`} onClick={() => toggleLike(activity.id)}>
                                <ThumbsUp className="h-4 w-4" />{likesByActivity[activity.id]?.count ?? 0}
                              </button>
                              <button className="flex items-center gap-1" onClick={() => toggleComments(activity.id)}>
                                <MessageCircle className="h-4 w-4" />{commentsCountByActivity[activity.id] ?? 0}
                              </button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => deleteActivity(activity.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      </Card>
                    {openCommentsFor[activity.id] && (
                      <Card className="p-4">
                        <div className="space-y-3">
                          <div className="space-y-2 max-h-52 overflow-auto">
                            {(commentsByActivity[activity.id] || []).map((c) => {
                              const isUrl = typeof c.content === 'string' && /^https?:\/\//i.test(c.content);
                              const lower = (c.content || '').toLowerCase();
                              const isImage = isUrl && (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp'));
                              const isVideo = isUrl && (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg'));
                              const isAudio = isUrl && (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a') || lower.endsWith('.ogg'));
                              return (
                                <div key={c.id} className="text-sm space-y-1">
                                  <div className="text-gray-900 font-medium">{c.user_name || (c.user_email ? c.user_email.split('@')[0] : t('itinerary.user'))}</div>
                                  {isUrl ? (
                                    isImage ? (
                                      <a href={c.content} target="_blank" rel="noreferrer" className="block">
                                        <img src={c.content} alt="attachment" className="max-h-48 rounded border" />
                                      </a>
                                    ) : isVideo ? (
                                      <video controls className="max-h-64 rounded border">
                                        <source src={c.content} />
                                      </video>
                                    ) : isAudio ? (
                                      <audio controls className="w-full">
                                        <source src={c.content} />
                                      </audio>
                                    ) : (
                                      <a href={c.content} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{c.content}</a>
                                    )
                                  ) : (
                                    <div className="text-gray-700 break-words">{c.content}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder={t('itinerary.commentPlaceholder')}
                              value={newCommentByActivity[activity.id] || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCommentByActivity((prev) => ({ ...prev, [activity.id]: e.target.value }))}
                            />
                            <Button size="sm" onClick={() => addComment(activity.id)} disabled={!(newCommentByActivity[activity.id] || '').trim()}>{t('common.send')}</Button>
                            <label className="inline-flex items-center justify-center px-3 text-sm border rounded-md cursor-pointer bg-white">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadMedia(activity.id, f);
                                }}
                                accept="image/*,video/*,audio/*,application/pdf"
                              />
                              {mediaUploadingByActivity[activity.id] ? t('common.loading') : 'Upload'}
                            </label>
                          </div>
                        </div>
                      </Card>
                    )}
                    </div>
                  </Reveal>
                ))}
              </div>

              {newActivityDayId === currentDay.id && (
                <Card className="p-4 space-y-2 relative" onKeyDown={(e) => { if (e.key === 'Escape') {
                  setNewActivityDayId(null);
                  setNewActivityTitle('');
                  setNewActivityLocation('');
                  setNewActivityStartTime('');
                  setNewActivityEndTime('');
                  setNewActivityType('other');
                  setPlacePreds([]);
                }}}>
                  <button
                    type="button"
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-900"
                    onClick={() => {
                      setNewActivityDayId(null);
                      setNewActivityTitle('');
                      setNewActivityLocation('');
                      setNewActivityStartTime('');
                      setNewActivityEndTime('');
                      setNewActivityType('other');
                      setPlacePreds([]);
                    }}
                    aria-label="Close add activity form"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Input
                    placeholder={t('itinerary.activityTitle')}
                    value={newActivityTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityTitle(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white/90 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                  />
                  <div>
                    <label className="text-xs text-gray-600">{t('itinerary.type')}</label>
                    <div className="relative mt-1">
                      <select
                        className="appearance-none w-full rounded-lg border border-gray-300 bg-white/90 px-3 py-2 pr-9 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                        value={newActivityType}
                        onChange={(e) => setNewActivityType(e.target.value as any)}
                      >
                        <option value="food">{t('itinerary.type.food')}</option>
                        <option value="museum">{t('itinerary.type.museum')}</option>
                        <option value="sightseeing">{t('itinerary.type.sightseeing')}</option>
                        <option value="transport">{t('itinerary.type.transport')}</option>
                        <option value="other">{t('itinerary.type.other')}</option>
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      placeholder={t('itinerary.location')}
                      value={newActivityLocation}
                      className="rounded-lg border border-gray-300 bg-white/90 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                      onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        setNewActivityLocation(v);
                        setPlaceIdForActivity(null);
                        setPlaceCoordsForActivity({ lat: null, lng: null });
                        if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current as any);
                        const timerId = setTimeout(async () => {
                          if (!v || v.length < 2) {
                            setPlacePreds([]);
                            return;
                          }
                          try {
                            setPlaceLoading(true);
                            const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(v)}`);
                            const json = await res.json();
                            const preds = Array.isArray(json?.predictions) ? (json.predictions as any[]).map((p: any) => ({
                              description: String(p?.description ?? p?.structured_formatting?.main_text ?? ''),
                              place_id: String(p?.place_id ?? p?.placeId ?? ''),
                            })) : [];
                            setPlacePreds(preds);
                          } finally {
                            setPlaceLoading(false);
                          }
                        }, 300) as any;
                        placeDebounceRef.current = timerId;
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
                      <div className="text-xs text-gray-500 mt-1">{t('common.searching')}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      placeholder={t('itinerary.startTime')}
                      value={newActivityStartTime}
                      className="rounded-lg border border-gray-300 bg-white/90 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityStartTime(e.target.value)}
                    />
                    <Input
                      type="time"
                      placeholder={t('itinerary.endTime')}
                      value={newActivityEndTime}
                      className="rounded-lg border border-gray-300 bg-white/90 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityEndTime(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => addActivity(currentDay.id)} size="sm">{t('common.add')}</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewActivityDayId(null);
                        setNewActivityTitle('');
                        setNewActivityLocation('');
                        setNewActivityStartTime('');
                        setNewActivityEndTime('');
                        setNewActivityType('other');
                        setPlacePreds([]);
                      }}
                      size="sm"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
        );
      })()}
      </div>
    </div>

      {/* Floating launchers: Polls (above) and Chat (below) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2 sm:gap-3">
        <Button
          className="relative rounded-full shadow-lg h-11 w-11 sm:h-12 sm:w-12 p-0"
          size="icon"
          onClick={() => setIsPollsOpen((v) => !v)}
          aria-label="Open polls"
        >
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button
          className="relative rounded-full shadow-lg h-11 w-11 sm:h-12 sm:w-12 p-0"
          size="icon"
          onClick={() => { setIsChatOpen(true); setUnreadCount(0); }}
          aria-label="Open chat"
        >
          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-600 text-white text-[9px] sm:text-[10px] leading-none px-1 sm:px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Compact bottom-right chat box */}
      {isChatOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[340px] md:w-[380px] max-w-[95vw] h-[70vh] sm:h-[65vh] max-h-[560px] flex flex-col">
          <Chat tripId={tripId} compact />
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
            <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} aria-label="Close chat" className="h-7 w-7 sm:h-8 sm:w-8">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Compact bottom-right polls box (stacked a bit higher) */}
      {isPollsOpen && (
        <div className="fixed bottom-[72px] right-4 sm:bottom-[90px] sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[360px] md:w-[420px] max-w-[95vw] max-h-[70vh] overflow-hidden flex flex-col">
          <Card className="p-0 overflow-hidden w-full h-full">
            <div className="relative p-2.5 sm:p-3 border-b flex items-center justify-between">
              <div className="text-sm sm:text-base font-medium text-gray-900">Encuestas</div>
              <Button variant="ghost" size="icon" onClick={() => setIsPollsOpen(false)} aria-label="Close polls" className="h-7 w-7 sm:h-8 sm:w-8">
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
            <div className="p-2.5 sm:p-3 overflow-auto" style={{ maxHeight: '60vh' }}>
              <Polls tripId={tripId} />
            </div>
          </Card>
        </div>
      )}

      {/* Expenses modal (restores previous behavior) */}
      <Dialog open={isExpensesOpen} onOpenChange={setIsExpensesOpen}>
        <DialogContent className="max-w-2xl p-0">
          <Expenses tripId={tripId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

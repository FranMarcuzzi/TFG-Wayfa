'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Clock, MapPin, X, Sun, Plane, ThumbsUp, MessageCircle, Utensils, Landmark, Camera, Bus, Trash2, Calendar, BarChart3, Bed, Download, Edit, ListTodo } from 'lucide-react';
import { Polls } from '@/components/Polls';
import { TripMembers } from '@/components/TripMembers';
import { DayMap } from '@/components/DayMap';
import { Expenses } from '@/components/Expenses';
import { Chat } from '@/components/Chat';
import { TaskListSheet } from '@/components/tasks/TaskListSheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  const [newActivityType, setNewActivityType] = useState<'food' | 'museum' | 'sightseeing' | 'transport' | 'hotel' | 'flight' | 'other'>('other');
  const [hotelStartDate, setHotelStartDate] = useState('');
  const [hotelEndDate, setHotelEndDate] = useState('');
  const [flightCode, setFlightCode] = useState('');
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
      if (!res.ok || json.error) throw new Error(json.error || t('ai.error'));
      setAiMessages((prev) => [...prev, { role: 'assistant', content: String(json.answer || '') }]);
    } catch (e: any) {
      setAiError(e?.message || t('ai.error'));
    } finally {
      setAiLoading(false);
    }
  };

  // Resolve and persist missing coordinates for activities that have a place_id
  const backfillMissingCoords = async (daysList: Day[]) => {
    const key = `wayfa:actcoords:${tripId}`;
    let saved: Record<string, Record<string, { lat: number; lng: number }>> = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { }

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
              await (supabase.from('activities') as any).update({ lat, lng } as any).eq('id', a.id);
              saved[d.id] = saved[d.id] || {};
              saved[d.id][a.id] = { lat, lng };
              changed = true;
              setDays((prev) => prev.map((day) => day.id === d.id ? ({
                ...day,
                activities: (day.activities || []).map((act: any) => act.id === a.id ? { ...act, lat, lng } : act)
              }) : day));
              continue;
            }
          } catch { }
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
                await (supabase.from('activities') as any).update({ lat, lng, place_id: pid2 } as any).eq('id', a.id);
                saved[d.id] = saved[d.id] || {};
                saved[d.id][a.id] = { lat, lng };
                changed = true;
                setDays((prev) => prev.map((day) => day.id === d.id ? ({
                  ...day,
                  activities: (day.activities || []).map((act: any) => act.id === a.id ? { ...act, lat, lng, place_id: pid2 } : act)
                }) : day));
              }
            }
          } catch { }
        }
      }
    }
    if (changed) {
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch { }
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
  const [trip, setTrip] = useState<{ title: string | null; destination: string | null; lat: number | null; lng: number | null; start_date: string | null; end_date: string | null } | null>(null);
  // Helpers that depend on `trip`
  const parseDateOnly = (s?: string | null) => {
    if (!s) return null;
    const raw = String(s).split('T')[0];
    const parts = raw.split('-').map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => !isFinite(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  };

  const addDays = (d: Date, n: number) => {
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    base.setDate(base.getDate() + n);
    return base;
  };

  const getLogoData = async () => {
    if (logoCacheRef.current) return logoCacheRef.current;
    const res = await fetch('/brand/wayfa-logo.png');
    if (!res.ok) throw new Error(t('itinerary.pdf.errorDesc'));
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(blob);
    });
    const img = new Image();
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('image_failed'));
      img.src = dataUrl;
    });
    const payload = { dataUrl, width: dims.width, height: dims.height };
    logoCacheRef.current = payload;
    return payload;
  };

  const timeToMinutes = (v?: string | null) => {
    if (!v) return NaN;
    const raw = String(v).slice(0, 5);
    const parts = raw.split(':').map((p) => parseInt(p, 10));
    if (parts.length !== 2 || parts.some((n) => !isFinite(n))) return NaN;
    return parts[0] * 60 + parts[1];
  };
  const startDate = trip?.start_date ? parseDateOnly(trip.start_date) : null;
  const endDate = trip?.end_date ? parseDateOnly(trip.end_date) : null;
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
    const start = trip.start_date ? parseDateOnly(trip.start_date) : null;
    const end = trip.end_date ? parseDateOnly(trip.end_date) : null;
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
  const [isTasksOpen, setIsTasksOpen] = useState(false);
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfAllLoading, setPdfAllLoading] = useState(false);
  const logoCacheRef = useRef<{ dataUrl: string; width: number; height: number } | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editType, setEditType] = useState<'food' | 'museum' | 'sightseeing' | 'transport' | 'hotel' | 'flight' | 'other'>('other');
  const [editHotelStartDate, setEditHotelStartDate] = useState('');
  const [editHotelEndDate, setEditHotelEndDate] = useState('');
  const [editApplyAll, setEditApplyAll] = useState(true);

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
      } catch { }
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
      user_email: c.user_profiles?.email || t('common.unknown'),
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
    const ensureTripMembership = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user?.id || !user.email) return;
        const email = user.email.toLowerCase();

        const { data: existing } = await (supabase.from('trip_members') as any)
          .select('user_id')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (existing) return;

        const { data: invite } = await (supabase.from('trip_invitations') as any)
          .select('id, status')
          .eq('trip_id', tripId)
          .eq('email', email)
          .in('status', ['pending', 'accepted'])
          .maybeSingle();
        if (!invite) return;

        await (supabase.from('user_profiles') as any).upsert({
          user_id: user.id,
          email,
          display_name: (user.user_metadata as any)?.display_name || (user.user_metadata as any)?.full_name || email.split('@')[0],
        }, { onConflict: 'user_id' });

        const { error: insertErr } = await (supabase.from('trip_members') as any).insert({
          trip_id: tripId,
          user_id: user.id,
          role: 'participant',
        } as any);
        if (insertErr && (insertErr as any).code !== '23505') {
          console.error('Error inserting trip member:', insertErr);
        }

        if (invite.status === 'pending') {
          await (supabase.from('trip_invitations') as any)
            .update({ status: 'accepted' } as any)
            .eq('id', invite.id);
        }
      } catch (e) {
        console.error('Error ensuring trip membership:', e);
      }
    };

    loadDays();
    subscribeToChanges();
    loadTrip();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    void ensureTripMembership();
  }, [tripId]);

  useEffect(() => {
    if (!trip?.start_date && !trip?.end_date) return;
    loadDays();
  }, [trip?.start_date, trip?.end_date]);

  useEffect(() => {
    if (newActivityType !== 'hotel') return;
    const currentDay = days.find((d: Day) => d.id === selectedDayId) || days[0];
    if (!currentDay) return;
    const startFallback = getDayDateValue(currentDay);
    const endFallback = trip?.end_date ? parseDateOnly(trip.end_date) : startFallback;
    if (!hotelStartDate && startFallback) setHotelStartDate(toISODate(startFallback));
    if (!hotelEndDate && endFallback) setHotelEndDate(toISODate(endFallback));
  }, [newActivityType, selectedDayId, days, trip?.end_date]);

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
    const { data: daysData } = await (supabase
      .from('days') as any)
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
          } catch { }

          return {
            ...day,
            activities: enriched,
          };
        })
      );

      daysWithActivities.sort((a: Day, b: Day) => {
        const aD = parseDateOnly(a.date);
        const bD = parseDateOnly(b.date);
        const aDate = aD ? aD.getTime() : Number.POSITIVE_INFINITY;
        const bDate = bD ? bD.getTime() : Number.POSITIVE_INFINITY;
        if (isFinite(aDate) && isFinite(bDate)) return aDate - bDate;
        if (isFinite(aDate)) return -1;
        if (isFinite(bDate)) return 1;
        return (a.day_index ?? 0) - (b.day_index ?? 0);
      });
      let finalDays = daysWithActivities;
      if (trip?.start_date && trip?.end_date) {
        const start = parseDateOnly(trip.start_date);
        const end = parseDateOnly(trip.end_date);
        if (start && end) {
          finalDays = daysWithActivities.filter((d: Day) => {
            if (!d.date) return true;
            const dd = parseDateOnly(d.date);
            if (!dd) return true;
            return dd >= start && dd <= end;
          });
        }
      }
      setDays(finalDays);
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
            } catch { }
            await fetchForecastForDay(d.id, (first as any).lat, (first as any).lng, null);
          } else {
            try {
              const res = await fetch(`/api/weather?q=${encodeURIComponent(q)}`);
              const json = await res.json();
              if (res.ok && !json.error) {
                setWeatherByDay((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] as any), weather: json } }));
                persistWeather(d.id, q, null, null);
              }
            } catch { }
            await fetchForecastForDay(d.id, null, null, q);
          }
        }
      } catch { }
      // Backfill coords for activities missing lat/lng when place_id exists
      try {
        await backfillMissingCoords(daysWithActivities as any);
      } catch { }
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
      .select('title, destination, lat, lng, start_date, end_date')
      .eq('id', tripId)
      .maybeSingle();

    if (data) {
      setTrip({
        title: (data as any).title ?? null,
        destination: (data as any).destination ?? null,
        lat: (data as any).lat ?? null,
        lng: (data as any).lng ?? null,
        start_date: (data as any).start_date ?? null,
        end_date: (data as any).end_date ?? null,
      });
      // No prefill per-day here; user sets city per day.
    }
  };

  const getDayDateLabel = (day: Day) => {
    const dayDate = parseDateOnly(day.date);
    if (dayDate) return dayDate.toLocaleDateString();
    if (trip?.start_date) {
      const idx = days.findIndex((d) => d.id === day.id);
      const offset = idx >= 0 ? idx : Math.max(0, (day.day_index ?? 1) - 1);
      const base = parseDateOnly(trip.start_date);
      if (!base) return t('itinerary.plan');
      return addDays(base, offset).toLocaleDateString();
    }
    return t('itinerary.plan');
  };

  const getDayDateValue = (day: Day): Date | null => {
    const dayDate = parseDateOnly(day.date);
    if (dayDate) return dayDate;
    if (trip?.start_date) {
      const idx = days.findIndex((d) => d.id === day.id);
      const offset = idx >= 0 ? idx : Math.max(0, (day.day_index ?? 1) - 1);
      const base = parseDateOnly(trip.start_date);
      if (!base) return null;
      return addDays(base, offset);
    }
    return null;
  };

  const toISODate = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const displayDayNumber = (day: Day) => {
    const idx = days.findIndex((d) => d.id === day.id);
    if (idx >= 0) return idx + 1;
    return (day.day_index || 0) + 1;
  };

  const enumerateDates = (start: Date, end: Date) => {
    const out: Date[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= last) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const getDayMapById = () => {
    const map = new Map<string, Day>();
    for (const d of days) map.set(d.id, d);
    return map;
  };

  const getHotelGroupIds = (activity: Activity) => {
    if (!activity) return [] as string[];
    const actAny = activity as any;
    const title = activity.title || '';
    const location = activity.location || '';
    const starts = activity.starts_at || null;
    const ends = activity.ends_at || null;
    const placeId = actAny.place_id || null;
    const dayIds = days.map((d) => d.id);
    const ids: string[] = [];
    for (const d of days) {
      const acts = (d.activities || []) as any[];
      for (const a of acts) {
        if ((a.type || '') !== 'hotel') continue;
        if (a.title !== title) continue;
        if ((a.location || '') !== location) continue;
        if ((a.starts_at || null) !== starts) continue;
        if ((a.ends_at || null) !== ends) continue;
        if ((a.place_id || null) !== placeId) continue;
        ids.push(a.id);
      }
    }
    return ids;
  };

  const getHotelRangeFromGroup = (activity: Activity) => {
    const ids = new Set(getHotelGroupIds(activity));
    if (ids.size === 0) return { start: null as Date | null, end: null as Date | null };
    const dayMap = getDayMapById();
    let min: Date | null = null;
    let max: Date | null = null;
    for (const d of days) {
      const has = (d.activities || []).some((a: any) => ids.has(a.id));
      if (!has) continue;
      const dt = getDayDateValue(d);
      if (!dt) continue;
      const t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      if (!min || t < min) min = t;
      if (!max || t > max) max = t;
    }
    return { start: min, end: max };
  };

  const openEditActivity = (activity: Activity) => {
    const actAny = activity as any;
    setEditActivity(activity);
    setEditTitle(activity.title || '');
    setEditLocation(activity.location || '');
    setEditStartTime(activity.starts_at || '');
    setEditEndTime(activity.ends_at || '');
    setEditType((actAny.type as any) || 'other');
    if ((actAny.type as any) === 'hotel') {
      const range = getHotelRangeFromGroup(activity);
      setEditHotelStartDate(range.start ? toISODate(range.start) : '');
      setEditHotelEndDate(range.end ? toISODate(range.end) : '');
      setEditApplyAll(true);
    } else {
      setEditHotelStartDate('');
      setEditHotelEndDate('');
      setEditApplyAll(false);
    }
    setIsEditOpen(true);
  };

  const saveEditedActivity = async () => {
    if (!editActivity) return;
    const actAny = editActivity as any;
    const payloadBase = {
      title: editTitle.trim(),
      location: editLocation || null,
      starts_at: editType === 'hotel' ? null : (editStartTime || null),
      ends_at: editType === 'hotel' ? null : (editEndTime || null),
      type: editType,
      place_id: actAny.place_id || null,
      lat: actAny.lat ?? null,
      lng: actAny.lng ?? null,
    };
    if (!payloadBase.title) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('itinerary.error.titleRequired') });
      return;
    }

    try {
      const isHotel = editType === 'hotel';
      const wasHotel = (actAny.type as any) === 'hotel';
      if (isHotel && editApplyAll) {
        const start = editHotelStartDate ? new Date(editHotelStartDate) : null;
        const end = editHotelEndDate ? new Date(editHotelEndDate) : null;
        if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
          toast({ variant: 'destructive', title: t('common.error'), description: t('itinerary.error.invalidRange') });
          return;
        }
        const ss = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const ee = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const needed = enumerateDates(ss, ee);

        // delete previous hotel group if existed
        if (wasHotel) {
          const ids = getHotelGroupIds(editActivity);
          if (ids.length > 0) {
            await supabase.from('activities').delete().in('id', ids);
          }
        } else {
          await supabase.from('activities').delete().eq('id', editActivity.id);
        }

        // ensure days exist
        const existingByDate = new Map<string, Day>();
        for (const d of days) {
          const dDate = getDayDateValue(d);
          if (!dDate) continue;
          existingByDate.set(dateKey(dDate), d);
        }
        const missingDates = needed.filter((d) => !existingByDate.has(dateKey(d)));
        if (missingDates.length > 0) {
          const maxIndex = days.length > 0 ? Math.max(...days.map((d) => d.day_index)) : 0;
          const tripStart = trip?.start_date ? parseDateOnly(trip.start_date) : null;
          let appendIndex = maxIndex + 1;
          const newDaysPayload = missingDates.map((d) => {
            const idx = tripStart
              ? Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(tripStart.getFullYear(), tripStart.getMonth(), tripStart.getDate()).getTime()) / 86400000) + 1
              : appendIndex++;
            return { trip_id: tripId, day_index: idx, date: toISODate(d) };
          });
          const { data: insertedDays, error: insertDayErr } = await (supabase
            .from('days') as any)
            .insert(newDaysPayload as any)
            .select('*');
          if (insertDayErr) throw insertDayErr;
          for (const d of insertedDays || []) {
            const key = d.date ? String(d.date) : '';
            if (key) existingByDate.set(key, d as any);
          }
        }

        const payloads: any[] = [];
        for (const d of needed) {
          const dayRow = existingByDate.get(dateKey(d));
          if (!dayRow) continue;
          payloads.push({ day_id: dayRow.id, ...payloadBase, type: 'hotel' });
        }
        const { error } = await supabase.from('activities').insert(payloads as any);
        if (error) throw error;
      } else if (wasHotel && editApplyAll) {
        const ids = getHotelGroupIds(editActivity);
        if (ids.length > 0) {
          const { error } = await (supabase.from('activities') as any).update(payloadBase as any).in('id', ids);
          if (error) throw error;
        }
      } else {
        const { error } = await (supabase.from('activities') as any).update(payloadBase as any).eq('id', editActivity.id);
        if (error) throw error;
      }

      setIsEditOpen(false);
      setEditActivity(null);
      await loadDays();
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: e?.message || t('itinerary.error.saveFailed') });
    }
  };

  const activityTypeLabel = (type?: string | null) => {
    if (type === 'food') return t('itinerary.type.food');
    if (type === 'museum') return t('itinerary.type.museum');
    if (type === 'sightseeing') return t('itinerary.type.sightseeing');
    if (type === 'transport') return t('itinerary.type.transport');
    if (type === 'hotel') return t('itinerary.type.hotel');
    if (type === 'flight') return t('itinerary.type.flight');
    return t('itinerary.type.other');
  };

  const downloadCurrentDayPdf = async () => {
    const currentDay = days.find((d: Day) => d.id === selectedDayId) || days[0];
    if (!currentDay || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const marginTop = 36;
      const headerH = 64;
      const contentW = pageW - marginX * 2;
      const lineH = 14;
      const mapsLabel = t('itinerary.pdf.maps');
      const mapsUrlFor = (act: any) => {
        const lat = act?.lat;
        const lng = act?.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
        const loc = act?.location || '';
        if (loc) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(loc))}`;
        }
        return '';
      };
      const drawLink = (label: string, x: number, yPos: number, url: string) => {
        doc.setTextColor(37, 99, 235);
        if ((doc as any).textWithLink) {
          (doc as any).textWithLink(label, x, yPos, { url });
        } else {
          doc.text(label, x, yPos);
          const w = doc.getTextWidth(label);
          doc.link(x, yPos - 10, w, 12, { url });
        }
        doc.setTextColor(31, 41, 55);
      };

      const dayLabel = t('itinerary.dayLabel', { n: String(displayDayNumber(currentDay)) });
      const dayDate = getDayDateLabel(currentDay);
      const tripTitle = (trip?.title || '').trim() || 'Wayfa';
      const destination = trip?.destination || '';

      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageW, headerH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Wayfa', marginX, 28);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const titleLines = doc.splitTextToSize(tripTitle, pageW - marginX * 2 - 140);
      doc.text(titleLines.slice(0, 2), marginX, 48);
      doc.setFontSize(11);
      doc.text(`${dayLabel} • ${dayDate}`, pageW - marginX, 38, { align: 'right' });

      let y = headerH + 26;
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(t('itinerary.pdf.title'), marginX, y);
      y += 10;

      const summaryH = 64;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(marginX, y + 10, contentW, summaryH, 8, 8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(t('itinerary.pdf.summary'), marginX + 12, y + 28);
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      const summaryLeft = marginX + 12;
      const summaryRight = marginX + contentW / 2 + 6;
      const destLabel = `${t('itinerary.pdf.destination')}: ${destination || '-'}`;
      const destLines = doc.splitTextToSize(destLabel, contentW / 2 - 12);
      doc.text(destLines.slice(0, 2), summaryLeft, y + 48);
      const allActivities = (currentDay.activities || []) as any[];
      const hotelActs = allActivities.filter((a) => (a as any).type === 'hotel');
      const nonHotelActs = allActivities.filter((a) => (a as any).type !== 'hotel');
      doc.text(`${t('itinerary.pdf.totalActivities')}: ${nonHotelActs.length}`, summaryRight, y + 48);

      y += summaryH + 26;
      if (hotelActs.length > 0) {
        const primaryHotel = hotelActs[0];
        const hotelTitle = String(primaryHotel.title || '');
        const hotelLoc = String(primaryHotel.location || '');
        const hotelUrl = mapsUrlFor(primaryHotel);
        const hotelBoxH = 80;
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(marginX, y, contentW, hotelBoxH, 8, 8, 'F');
        doc.setDrawColor(251, 191, 36);
        doc.roundedRect(marginX, y, contentW, hotelBoxH, 8, 8, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(t('itinerary.pdf.hotel'), marginX + 12, y + 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const hotelLines = doc.splitTextToSize(hotelTitle || '-', contentW - 24);
        doc.text(hotelLines.slice(0, 1), marginX + 12, y + 34);
        const addrLines = doc.splitTextToSize(`${t('itinerary.pdf.address')}: ${hotelLoc || '-'}`, contentW - 24);
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(addrLines.slice(0, 2), marginX + 12, y + 50);
        if (hotelUrl) {
          drawLink(mapsLabel, marginX + 12, y + 70, hotelUrl);
        }
        y += hotelBoxH + 16;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(t('itinerary.pdf.activities'), marginX, y);
      y += 12;

      const colTime = 90;
      const colType = 90;
      const colLocation = 190;
      const colActivity = Math.max(140, contentW - colTime - colType - colLocation);

      const drawTableHeader = (yy: number) => {
        doc.setFillColor(229, 231, 235);
        doc.rect(marginX, yy, contentW, 22, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        doc.text(t('itinerary.pdf.time'), marginX + 8, yy + 14);
        doc.text(t('itinerary.pdf.activity'), marginX + colTime + 8, yy + 14);
        doc.text(t('itinerary.pdf.location'), marginX + colTime + colActivity + 8, yy + 14);
        doc.text(t('itinerary.pdf.type'), marginX + colTime + colActivity + colLocation + 8, yy + 14);
      };

      const ensureSpace = (needed: number) => {
        if (y + needed <= pageH - marginTop) return;
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(`${dayLabel} • ${dayDate}`, marginX, marginTop);
        y = marginTop + 12;
      };

      const timeToMinutes = (v?: string | null) => {
        if (!v) return NaN;
        const raw = String(v).slice(0, 5);
        const parts = raw.split(':').map((p) => parseInt(p, 10));
        if (parts.length !== 2 || parts.some((n) => !isFinite(n))) return NaN;
        return parts[0] * 60 + parts[1];
      };

      const activities = [...nonHotelActs].sort((a: any, b: any) => {
        const at = timeToMinutes(a.starts_at);
        const bt = timeToMinutes(b.starts_at);
        if (isFinite(at) && isFinite(bt)) return at - bt;
        if (isFinite(at)) return -1;
        if (isFinite(bt)) return 1;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });

      if (activities.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(107, 114, 128);
        doc.text(t('itinerary.pdf.noActivities'), marginX, y + 20);
      } else {
        ensureSpace(30);
        drawTableHeader(y);
        y += 22;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        for (const act of activities) {
          const timeLabel = act.starts_at ? `${fmtHM(act.starts_at)}${act.ends_at ? ` - ${fmtHM(act.ends_at)}` : ''}` : t('itinerary.noTime');
          const title = String(act.title || '');
          const location = String(act.location || '');
          const typeLabel = activityTypeLabel((act as any).type);
          const mapUrl = mapsUrlFor(act);

          const titleLines = doc.splitTextToSize(title || '-', colActivity - 16);
          const locLines = doc.splitTextToSize(location || '-', colLocation - 16);
          const linkLineIndex = mapUrl ? locLines.length + 1 : -1;
          if (mapUrl) {
            locLines.push(''); // spacer line before link
            locLines.push(''); // placeholder for hyperlink
          }
          const typeLines = doc.splitTextToSize(typeLabel || '-', colType - 16);
          const timeLines = doc.splitTextToSize(timeLabel || '-', colTime - 16);
          const rows = Math.max(titleLines.length, locLines.length, typeLines.length, timeLines.length);
          const rowH = Math.max(20, rows * lineH + 10);

          ensureSpace(rowH + 6);
          doc.setDrawColor(229, 231, 235);
          doc.rect(marginX, y, contentW, rowH);
          doc.setTextColor(31, 41, 55);
          doc.text(timeLines, marginX + 8, y + 14);
          doc.text(titleLines, marginX + colTime + 8, y + 14);
          doc.text(locLines, marginX + colTime + colActivity + 8, y + 14);
          doc.text(typeLines, marginX + colTime + colActivity + colLocation + 8, y + 14);
          if (mapUrl && linkLineIndex >= 0) {
            const linkY = y + 14 + (linkLineIndex * lineH);
            drawLink(mapsLabel, marginX + colTime + colActivity + 8, linkY, mapUrl);
          }
          y += rowH;
        }
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`${t('itinerary.pdf.generated')} ${new Date().toLocaleString()}`, marginX, pageH - 24);

      const safeDate = dayDate.replace(/\//g, '-');
      doc.save(`wayfa-${dayLabel.toLowerCase().replace(/\s+/g, '-')}-${safeDate}.pdf`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('itinerary.pdf.errorTitle'), description: err?.message || t('itinerary.pdf.errorDesc') });
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadFullItineraryPdf = async () => {
    if (!days || days.length === 0 || pdfAllLoading) return;
    setPdfAllLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const marginTop = 36;
      const headerH = 64;
      const contentW = pageW - marginX * 2;
      const lineH = 14;
      const mapsLabel = t('itinerary.pdf.maps');

      const mapsUrlFor = (act: any) => {
        const lat = act?.lat;
        const lng = act?.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
        const loc = act?.location || '';
        if (loc) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(loc))}`;
        }
        return '';
      };

      const drawLink = (label: string, x: number, yPos: number, url: string) => {
        doc.setTextColor(37, 99, 235);
        if ((doc as any).textWithLink) {
          (doc as any).textWithLink(label, x, yPos, { url });
        } else {
          doc.text(label, x, yPos);
          const w = doc.getTextWidth(label);
          doc.link(x, yPos - 10, w, 12, { url });
        }
        doc.setTextColor(31, 41, 55);
      };

      const tripTitle = (trip?.title || '').trim() || 'Wayfa';
      const destination = trip?.destination || '';
      const sortedDays = [...days].sort((a, b) => {
        const ad = getDayDateValue(a);
        const bd = getDayDateValue(b);
        if (ad && bd) return ad.getTime() - bd.getTime();
        return a.day_index - b.day_index;
      });

      // Cover/header
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageW, headerH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Wayfa', marginX, 28);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const titleLines = doc.splitTextToSize(tripTitle, pageW - marginX * 2 - 140);
      doc.text(titleLines.slice(0, 2), marginX, 48);
      doc.setFontSize(11);
      doc.text(t('itinerary.pdf.fullTitle'), pageW - marginX, 38, { align: 'right' });

      let y = headerH + 26;
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(t('itinerary.pdf.fullTitle'), marginX, y);
      y += 10;

      const summaryH = 64;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(marginX, y + 10, contentW, summaryH, 8, 8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(t('itinerary.pdf.summary'), marginX + 12, y + 28);
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      const summaryLeft = marginX + 12;
      const summaryRight = marginX + contentW / 2 + 6;
      const destLabel = `${t('itinerary.pdf.destination')}: ${destination || '-'}`;
      const destLines = doc.splitTextToSize(destLabel, contentW / 2 - 12);
      doc.text(destLines.slice(0, 2), summaryLeft, y + 48);
      doc.text(`${t('itinerary.pdf.totalActivities')}: ${sortedDays.reduce((acc, d) => acc + ((d.activities || []).filter((a: any) => (a as any).type !== 'hotel').length), 0)}`, summaryRight, y + 48);

      y += summaryH + 26;

      const colTime = 90;
      const colType = 90;
      const colLocation = 190;
      const colActivity = Math.max(140, contentW - colTime - colType - colLocation);

      const drawTableHeader = (yy: number) => {
        doc.setFillColor(229, 231, 235);
        doc.rect(marginX, yy, contentW, 22, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        doc.text(t('itinerary.pdf.time'), marginX + 8, yy + 14);
        doc.text(t('itinerary.pdf.activity'), marginX + colTime + 8, yy + 14);
        doc.text(t('itinerary.pdf.location'), marginX + colTime + colActivity + 8, yy + 14);
        doc.text(t('itinerary.pdf.type'), marginX + colTime + colActivity + colLocation + 8, yy + 14);
      };

      const ensureSpace = (needed: number) => {
        if (y + needed <= pageH - marginTop) return;
        doc.addPage();
        y = marginTop + 12;
      };

      for (const day of sortedDays) {
        const dayLabel = t('itinerary.dayLabel', { n: String(displayDayNumber(day)) });
        const dayDate = getDayDateLabel(day);
        const allActs = (day.activities || []) as any[];
        const hotelActs = allActs.filter((a) => (a as any).type === 'hotel');
        const nonHotelActs = allActs.filter((a) => (a as any).type !== 'hotel');

        ensureSpace(36);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(17, 24, 39);
        doc.text(`${dayLabel} • ${dayDate}`, marginX, y + 10);
        y += 18;

        if (hotelActs.length > 0) {
          const primaryHotel = hotelActs[0];
          const hotelTitle = String(primaryHotel.title || '');
          const hotelLoc = String(primaryHotel.location || '');
          const hotelUrl = mapsUrlFor(primaryHotel);
          const hotelBoxH = 80;
          ensureSpace(hotelBoxH + 12);
          doc.setFillColor(255, 247, 237);
          doc.roundedRect(marginX, y, contentW, hotelBoxH, 8, 8, 'F');
          doc.setDrawColor(251, 191, 36);
          doc.roundedRect(marginX, y, contentW, hotelBoxH, 8, 8, 'S');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(17, 24, 39);
          doc.text(t('itinerary.pdf.hotel'), marginX + 12, y + 18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const hotelLines = doc.splitTextToSize(hotelTitle || '-', contentW - 24);
          doc.text(hotelLines.slice(0, 1), marginX + 12, y + 34);
          const addrLines = doc.splitTextToSize(`${t('itinerary.pdf.address')}: ${hotelLoc || '-'}`, contentW - 24);
          doc.setFontSize(10);
          doc.setTextColor(75, 85, 99);
          doc.text(addrLines.slice(0, 2), marginX + 12, y + 50);
          if (hotelUrl) {
            drawLink(mapsLabel, marginX + 12, y + 70, hotelUrl);
          }
          y += hotelBoxH + 12;
        }

        if (nonHotelActs.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(107, 114, 128);
          doc.text(t('itinerary.pdf.noActivities'), marginX, y + 12);
          y += 24;
          continue;
        }

        const activities = [...nonHotelActs].sort((a: any, b: any) => {
          const at = timeToMinutes(a.starts_at);
          const bt = timeToMinutes(b.starts_at);
          if (isFinite(at) && isFinite(bt)) return at - bt;
          if (isFinite(at)) return -1;
          if (isFinite(bt)) return 1;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

        ensureSpace(30);
        drawTableHeader(y);
        y += 22;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        for (const act of activities) {
          const timeLabel = act.starts_at ? `${fmtHM(act.starts_at)}${act.ends_at ? ` - ${fmtHM(act.ends_at)}` : ''}` : t('itinerary.noTime');
          const title = String(act.title || '');
          const location = String(act.location || '');
          const typeLabel = activityTypeLabel((act as any).type);
          const mapUrl = mapsUrlFor(act);

          const titleLines = doc.splitTextToSize(title || '-', colActivity - 16);
          const locLines = doc.splitTextToSize(location || '-', colLocation - 16);
          const linkLineIndex = mapUrl ? locLines.length + 1 : -1;
          if (mapUrl) {
            locLines.push('');
            locLines.push('');
          }
          const typeLines = doc.splitTextToSize(typeLabel || '-', colType - 16);
          const timeLines = doc.splitTextToSize(timeLabel || '-', colTime - 16);
          const rows = Math.max(titleLines.length, locLines.length, typeLines.length, timeLines.length);
          const rowH = Math.max(20, rows * lineH + 10);

          ensureSpace(rowH + 6);
          doc.setDrawColor(229, 231, 235);
          doc.rect(marginX, y, contentW, rowH);
          doc.setTextColor(31, 41, 55);
          doc.text(timeLines, marginX + 8, y + 14);
          doc.text(titleLines, marginX + colTime + 8, y + 14);
          doc.text(locLines, marginX + colTime + colActivity + 8, y + 14);
          doc.text(typeLines, marginX + colTime + colActivity + colLocation + 8, y + 14);
          if (mapUrl && linkLineIndex >= 0) {
            const linkY = y + 14 + (linkLineIndex * lineH);
            drawLink(mapsLabel, marginX + colTime + colActivity + 8, linkY, mapUrl);
          }
          y += rowH;
        }

        y += 10;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`${t('itinerary.pdf.generated')} ${new Date().toLocaleString()}`, marginX, pageH - 24);

      const safeTitle = tripTitle.toLowerCase().replace(/\s+/g, '-');
      doc.save(`wayfa-itinerario-${safeTitle}.pdf`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('itinerary.pdf.errorTitle'), description: err?.message || t('itinerary.pdf.errorDesc') });
    } finally {
      setPdfAllLoading(false);
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
      if (!params) throw new Error(t('itinerary.error.missingQuery'));
      const res = await fetch(`/api/weather/forecast?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || t('itinerary.error.fetchFailed'));
      setWeatherByDay((prev) => ({
        ...prev,
        [dayId]: { ...(prev[dayId] as any), forecast: Array.isArray(json.daily) ? json.daily : [], forecastLoading: false },
      }));
    } catch (err: any) {
      setWeatherByDay((prev) => ({
        ...prev,
        [dayId]: { ...(prev[dayId] as any), forecast: [], forecastLoading: false, forecastError: err?.message || t('itinerary.error.fetchForecast') },
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
    } catch { }
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
        } catch { }
        // forecast prefers coords if present
        await fetchForecastForDay(d.id, item.lat, item.lng, item.lat != null && item.lng != null ? null : item.q);
      }
    } catch { }
  };

  const getWeatherForDay = async (dayId: string) => {
    const state = weatherByDay[dayId];
    const query = state?.query || '';
    if (!query) return;
    setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), loading: true, error: '' } }));
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || t('itinerary.error.fetchFailed'));
      setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json, loading: false } }));
      persistWeather(dayId, query, null, null);
      await fetchForecastForDay(dayId, null, null, query);
    } catch (err: any) {
      setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: null, loading: false, error: err?.message || t('itinerary.error.fetchWeather') } }));
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
      if (!res.ok || json.error) throw new Error(json.error || t('itinerary.error.fetchFailed'));
      if (json.notFound) throw new Error(t('itinerary.error.flightNotFound'));
      setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), flight: json, loading: false } }));
      // persist flight query per day
      try {
        const key = `wayfa:flight:${tripId}`;
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        saved[dayId] = query;
        localStorage.setItem(key, JSON.stringify(saved));
      } catch { }
    } catch (err: any) {
      setFlightByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), flight: null, loading: false, error: err?.message || t('itinerary.error.fetchFlight') } }));
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
        } catch { }
      }
    } catch { }
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
    if (trip?.start_date && trip?.end_date) {
      const start = parseDateOnly(trip.start_date);
      const end = parseDateOnly(trip.end_date);
      if (!start || !end) {
        toast({ title: t('common.error'), description: t('itinerary.error.invalidTripDates') });
        return;
      }
      const nextDate = addDays(start, nextIndex - 1);
      if (nextDate > end) {
        toast({ title: t('common.error'), description: t('itinerary.error.outOfRangeDays') });
        return;
      }
    }

    const { error } = await (supabase.from('days') as any).insert({
      trip_id: tripId,
      day_index: nextIndex,
      date: trip?.start_date ? toISODate(addDays(parseDateOnly(trip.start_date)!, nextIndex - 1)) : null,
    } as any);

    if (!error) {
      loadDays();
    }
  };

  const addActivity = async (dayId: string) => {
    if (!newActivityTitle.trim()) {
      toast({
        title: t('common.error'),
        description: t('itinerary.error.activityTitleRequired'),
      });
      return;
    }

    // Special handling for hotel: replicate across date range (pinned until checkout)
    if (newActivityType === 'hotel') {
      const currentDay = days.find((d: Day) => d.id === dayId) || days[0];
      const startFallback = currentDay ? getDayDateValue(currentDay) : null;
      const endFallback = trip?.end_date ? parseDateOnly(trip.end_date) : startFallback;
      const startStr = hotelStartDate || toISODate(startFallback);
      const endStr = hotelEndDate || toISODate(endFallback || startFallback);

      if (!startStr) {
        toast({ title: t('common.error'), description: t('itinerary.error.hotelCheckinRequired') });
        return;
      }
      if (!endStr) {
        toast({ title: t('common.error'), description: t('itinerary.error.hotelCheckoutRequired') });
        return;
      }

      try {
        const start = parseDateOnly(startStr);
        const end = parseDateOnly(endStr);
        if (start && end && start <= end) {
          if (trip?.start_date && trip?.end_date) {
            const ts = parseDateOnly(trip.start_date);
            const te = parseDateOnly(trip.end_date);
            if (ts && te && (start < ts || end > te)) {
              toast({ title: t('common.error'), description: t('itinerary.error.hotelRangeOutOfTrip') });
              return;
            }
          }
          const ss = start;
          const ee = end;
          const neededDates = enumerateDates(ss, ee);

          // Map existing days by date
          const existingByDate = new Map<string, Day>();
          for (const d of days) {
            const dDate = getDayDateValue(d);
            if (!dDate) continue;
            existingByDate.set(dateKey(dDate), d);
          }

          // Create missing days if needed
          const missingDates = neededDates.filter((d) => !existingByDate.has(dateKey(d)));
          if (missingDates.length > 0) {
            const maxIndex = days.length > 0 ? Math.max(...days.map((d) => d.day_index)) : 0;
            const tripStart = trip?.start_date ? parseDateOnly(trip.start_date) : null;
            let appendIndex = maxIndex + 1;
            const newDaysPayload = missingDates.map((d) => {
              const idx = tripStart
                ? Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(tripStart.getFullYear(), tripStart.getMonth(), tripStart.getDate()).getTime()) / 86400000) + 1
                : appendIndex++;
              return {
                trip_id: tripId,
                day_index: idx,
                date: toISODate(d),
              };
            });
            const { data: insertedDays, error: insertDayErr } = await (supabase
              .from('days') as any)
              .insert(newDaysPayload as any)
              .select('*');
            if (insertDayErr) {
              toast({ title: t('common.error'), description: t('itinerary.error.hotelCreateDaysFailed') });
              return;
            }
            for (const d of insertedDays || []) {
              const key = d.date ? String(d.date) : '';
              if (key) existingByDate.set(key, d as any);
            }
          }

          const payloads: any[] = [];
          for (const d of neededDates) {
            const key = dateKey(d);
            const dayRow = existingByDate.get(key);
            if (!dayRow) continue;
            payloads.push({
              day_id: dayRow.id,
              title: newActivityTitle,
              location: newActivityLocation || null,
              starts_at: null,
              ends_at: null,
              place_id: placeIdForActivity || null,
              lat: placeCoordsForActivity.lat,
              lng: placeCoordsForActivity.lng,
              type: newActivityType,
            });
          }

          if (payloads.length > 0) {
            const { error: hotelErr } = await supabase.from('activities').insert(payloads as any);
            if (!hotelErr) {
              setNewActivityDayId(null);
              setNewActivityTitle('');
              setNewActivityLocation('');
              setNewActivityStartTime('');
              setNewActivityEndTime('');
              setNewActivityType('other');
              setPlacePreds([]);
              setPlaceIdForActivity(null);
              setPlaceCoordsForActivity({ lat: null, lng: null });
              setHotelStartDate('');
              setHotelEndDate('');
              setFlightCode('');
              await loadDays();
              return;
            } else {
              toast({
                title: t('common.error'),
                description: t('itinerary.error.hotelSaveFailed'),
              });
            }
          }
        }
      } catch {
        // fall through to single-day insertion
      }
    }

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
        } catch { }
      }

      // If this is a flight activity, wire it into the per-day flight widget
      if (newActivityType === 'flight' && flightCode.trim()) {
        const code = flightCode.trim().toUpperCase();
        setFlightByDay((prev) => ({
          ...prev,
          [dayId]: {
            ...(prev[dayId] || { query: '', loading: false, error: '', flight: null }),
            query: code,
          },
        }));
        try {
          const key = `wayfa:flight:${tripId}`;
          const saved = JSON.parse(localStorage.getItem(key) || '{}');
          saved[dayId] = code;
          localStorage.setItem(key, JSON.stringify(saved));
        } catch { }
        await getFlightForDay(dayId);
      }
      setNewActivityDayId(null);
      setNewActivityTitle('');
      setNewActivityLocation('');
      setNewActivityStartTime('');
      setNewActivityEndTime('');
      setNewActivityType('other');
      setPlacePreds([]);
      setPlaceIdForActivity(null);
      setHotelStartDate('');
      setHotelEndDate('');
      setFlightCode('');
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
          } catch { }
          await fetchForecastForDay(dayId, coords.lat, coords.lng, null);
        } else if (query) {
          persistWeather(dayId, query, null, null);
          try {
            const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (res.ok && !json.error) {
              setWeatherByDay((prev) => ({ ...prev, [dayId]: { ...(prev[dayId] as any), weather: json } }));
            }
          } catch { }
          await fetchForecastForDay(dayId, null, null, query);
        }
      }
      // refresh activities list
      await loadDays();
      // finally clear coords state
      setPlaceCoordsForActivity({ lat: null, lng: null });
    } else {
      toast({
        title: t('common.error'),
        description: t('itinerary.error.activityCreateFailed'),
      });
    }
  };

  const deleteActivity = async (activityId: string, activity?: Activity) => {
    if (activity && (activity as any).type === 'hotel') {
      const ids = getHotelGroupIds(activity);
      if (ids.length > 0) {
        await supabase.from('activities').delete().in('id', ids);
      } else {
        await supabase.from('activities').delete().eq('id', activityId);
      }
    } else {
      await supabase.from('activities').delete().eq('id', activityId);
    }
    await loadDays();
  };

  const deleteDay = async (dayId: string) => {
    try {
      await supabase.from('activities').delete().eq('day_id', dayId);
      await (supabase.from('days') as any).delete().eq('id', dayId);
      await loadDays();
      if (selectedDayId === dayId) {
        const next = days.find((d) => d.id !== dayId)?.id || null;
        setSelectedDayId(next);
      }
    } catch { }
  };

  const confirmDeleteDay = (day: Day) => {
    const desc = getDayDateLabel(day);
    toast({
      title: t('itinerary.deleteDayTitle'),
      description: `${t('itinerary.dayLabel', { n: String(displayDayNumber(day)) })} • ${desc}`,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Player autoplay loop animationData={loadingAnim as any} style={{ width: 280, height: 280 }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-4 p-4">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-4 p-4">
            <div className="h-40 w-full bg-muted rounded animate-pulse" />
            <div className="h-40 w-full bg-muted rounded animate-pulse" />
            <div className="h-24 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-6">
          {/* Trip start countdown */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">{t('itinerary.countdown.title')}</div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
                      <div className="rounded-lg bg-background/80 backdrop-blur px-3 py-2 text-center border border-border/60 shadow-sm">
                        <div className="text-2xl font-bold text-foreground">{days}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('itinerary.countdown.days')}</div>
                      </div>
                      <div className="rounded-lg bg-background/80 backdrop-blur px-3 py-2 text-center border border-border/60 shadow-sm">
                        <div className="text-2xl font-bold text-foreground">{hours}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('itinerary.countdown.hours')}</div>
                      </div>
                      <div className="rounded-lg bg-background/80 backdrop-blur px-3 py-2 text-center border border-border/60 shadow-sm">
                        <div className="text-2xl font-bold text-foreground">{minutes}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('itinerary.countdown.minutes')}</div>
                      </div>
                    </div>
                    {/* Intentionally no relative/start text per UX request */}
                  </>
                );
              })()
            ) : (
              <div className="text-xs text-muted-foreground">{t('itinerary.countdown.setStart')}</div>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{t('itinerary.title')}</h3>
              </div>
              <Button onClick={addDay} size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('itinerary.addDay')}
              </Button>
            </div>
            {days.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('itinerary.noDays')}</div>
            ) : (
              <div className="space-y-2">
                {days.map((day: Day, idx: number) => (
                  <Reveal key={day.id} variant="slideUp" delayMs={idx * 70}>
                    <button
                      onClick={() => setSelectedDayId(day.id)}
                      className={`w-full text-left px-3 py-2 rounded-md border transition ${selectedDayId === day.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent border-border'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{t('itinerary.dayLabel', { n: String(displayDayNumber(day)) })}</div>
                        {(() => {
                          const dstr = getDayDateLabel(day);
                          return dstr ? (
                            <div className={`text-xs ${selectedDayId === day.id ? 'text-gray-200' : 'text-muted-foreground'}`}>{dstr}</div>
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
                  } catch { }
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
              <div className="font-semibold text-foreground">{t('ai.title')}</div>
              {aiMessages.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted/30">{t('ai.sample')}</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto pr-1">
                  {aiMessages.map((m, idx) => (
                    <div key={idx} className={`text-sm whitespace-pre-wrap p-3 rounded-md ${m.role === 'assistant' ? 'bg-muted/30 text-muted-foreground' : 'bg-card border text-foreground'}`}>
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
                <div className="font-semibold text-foreground">{t('expenses.summary')}</div>
                <div className="text-muted-foreground">$</div>
              </div>
              <div className="text-sm text-muted-foreground">{t('expenses.total')}</div>
              <div className="text-3xl font-bold text-foreground">${(expenseTotalCents / 100).toFixed(2)}</div>
              <div className="text-sm text-green-600">
                {(expenseUserBalanceCents >= 0 ? '' : '-')}${(Math.abs(expenseUserBalanceCents) / 100).toFixed(2)}
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
                <p className="text-muted-foreground">{t('itinerary.noDaysCta')}</p>
              </Card>
            );

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {t('itinerary.dayHeading', {
                      n: String(displayDayNumber(currentDay)),
                      date: getDayDateLabel(currentDay),
                    })}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setNewActivityDayId(currentDay.id)}>
                      <Plus className="h-4 w-4" />
                      {t('itinerary.addActivity')}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2" disabled={pdfLoading || pdfAllLoading}>
                          <Download className="h-4 w-4" />
                          {(pdfLoading || pdfAllLoading) ? t('common.loading') : t('itinerary.downloadMenu')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={downloadCurrentDayPdf}>
                          {t('itinerary.downloadDay')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={downloadFullItineraryPdf}>
                          {t('itinerary.downloadAll')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" onClick={() => confirmDeleteDay(currentDay)} aria-label={t('itinerary.deleteDayTitle')}>
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
                                  <div className="flex items-center gap-2 text-3xl font-semibold text-foreground">
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
                                  <div className="text-sm text-muted-foreground">
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
                                      <div className="text-xs text-muted-foreground">{t('itinerary.loadingForecast')}</div>
                                    ) : W?.forecast && W.forecast.length > 0 ? (
                                      <div className="grid grid-cols-7 gap-2">
                                        {W.forecast.map((d) => (
                                          <div key={d.dt} className="text-center text-xs p-2 border rounded-md">
                                            <div className="font-medium">{new Date(d.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                            <div className="text-muted-foreground">{new Date(d.dt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                                            <div className="my-1">
                                              {d.icon ? (
                                                <img alt={d.description || t('itinerary.weather')} className="mx-auto h-6 w-6" src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`} />
                                              ) : (
                                                <Sun className="h-5 w-5 text-yellow-500 mx-auto" />
                                              )}
                                            </div>
                                            <div className="font-semibold">{d.max}°</div>
                                            <div className="text-muted-foreground">{d.min}°</div>
                                            {typeof d.precip === 'number' && <div className="text-blue-500">{d.precip} mm</div>}
                                            {typeof d.wind === 'number' && <div className="text-muted-foreground">{d.wind} km/h</div>}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground">{t('itinerary.noForecast')}</div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <div className="text-sm text-muted-foreground">{t('itinerary.weather')}</div>
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
                              <div className="text-sm text-muted-foreground">{t('itinerary.flightStatus')}</div>
                              <div className="font-semibold text-foreground">{F?.flight?.flight || t('itinerary.enterFlight')}</div>
                              {F?.flight?.departure?.airport && F?.flight?.arrival?.airport && (
                                <div className="text-sm text-muted-foreground">
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
                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                                  <div>
                                    <div className="font-semibold text-foreground">{t('itinerary.departure')}</div>
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
                                    <div className="font-semibold text-foreground">{t('itinerary.arrival')}</div>
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
                      <Plane className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const ordered = [...(currentDay.activities || [])].sort((a: any, b: any) => {
                      const atype = (a as any).type;
                      const btype = (b as any).type;
                      if (atype === 'hotel' && btype !== 'hotel') return -1;
                      if (btype === 'hotel' && atype !== 'hotel') return 1;
                      const at = timeToMinutes(a.starts_at);
                      const bt = timeToMinutes(b.starts_at);
                      if (isFinite(at) && isFinite(bt)) return at - bt;
                      if (isFinite(at)) return -1;
                      if (isFinite(bt)) return 1;
                      return String(a.title || '').localeCompare(String(b.title || ''));
                    });
                    return ordered.map((activity: Activity) => (
                      <Reveal key={activity.id} delayMs={0}>
                        <div className="space-y-2">
                          <Card className="p-0 overflow-hidden shadow-sm border-border">
                            <div className="p-5 flex items-start gap-4">
                              <div className="w-32 shrink-0">
                                {activity.starts_at ? (
                                  <div className="flex w-full items-center justify-center gap-1 px-2 py-1 rounded-full bg-muted text-foreground text-xs">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {fmtHM(activity.starts_at)}{activity.ends_at ? ` - ${fmtHM(activity.ends_at)}` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex w-full items-center justify-center gap-1 px-2 py-1 rounded-full bg-muted text-foreground text-xs">
                                    <Clock className="h-3 w-3" />
                                    <span>{t('itinerary.noTime')}</span>
                                  </div>
                                )}
                                {(() => {
                                  const t = (activity as any).type as string | undefined;
                                  const Icon =
                                    t === 'food' ? Utensils :
                                      t === 'museum' ? Landmark :
                                        t === 'sightseeing' ? Camera :
                                          t === 'transport' ? Bus :
                                            t === 'hotel' ? Bed :
                                              t === 'flight' ? Plane :
                                                null;
                                  return Icon ? (
                                    <div className="mt-2 h-16 w-full rounded-lg bg-muted/50 flex items-center justify-center">
                                      <Icon className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-lg font-semibold text-foreground">{activity.title}</div>
                                      {(activity as any).type === 'hotel' && (
                                        <button
                                          type="button"
                                          onClick={() => openEditActivity(activity)}
                                          className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 hover:bg-amber-200"
                                          title={t('itinerary.editActivity')}
                                        >
                                          {t('itinerary.pinned')}
                                        </button>
                                      )}
                                    </div>
                                    {activity.location && (
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                        <MapPin className="h-3 w-3" />
                                        {activity.location}
                                      </div>
                                    )}
                                    {(activity as any).type === 'hotel' && (() => {
                                      const r = getHotelRangeFromGroup(activity);
                                      if (!r.start || !r.end) return null;
                                      const label = `${r.start.toLocaleDateString()} – ${r.end.toLocaleDateString()}`;
                                      return (
                                        <div className="text-xs text-amber-700 mt-1">
                                          {label}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {/* removed right-side type icon per UX request */}
                                </div>
                                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-4">
                                    <button className={`flex items-center gap-1 ${likesByActivity[activity.id]?.liked ? 'text-blue-500' : ''}`} onClick={() => toggleLike(activity.id)}>
                                      <ThumbsUp className="h-4 w-4" />{likesByActivity[activity.id]?.count ?? 0}
                                    </button>
                                    <button className="flex items-center gap-1" onClick={() => toggleComments(activity.id)}>
                                      <MessageCircle className="h-4 w-4" />{commentsCountByActivity[activity.id] ?? 0}
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEditActivity(activity)} title={t('common.edit')}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => deleteActivity(activity.id, activity)} title={t('common.delete')}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
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
                                        <div className="text-foreground font-medium">{c.user_name || (c.user_email ? c.user_email.split('@')[0] : t('itinerary.user'))}</div>
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
                                            <a href={c.content} target="_blank" rel="noreferrer" className="text-blue-500 underline break-all">{c.content}</a>
                                          )
                                        ) : (
                                          <div className="text-muted-foreground break-words">{c.content}</div>
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
                                  <label className="inline-flex items-center justify-center px-3 text-sm border rounded-md cursor-pointer bg-card">
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) uploadMedia(activity.id, f);
                                      }}
                                      accept="image/*,video/*,audio/*,application/pdf"
                                    />
                                    {mediaUploadingByActivity[activity.id] ? t('common.loading') : t('common.upload')}
                                  </label>
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                      </Reveal>
                    ));
                  })()}
                </div>

                {newActivityDayId === currentDay.id && (
                  <Card className="p-4 space-y-2 relative" onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setNewActivityDayId(null);
                      setNewActivityTitle('');
                      setNewActivityLocation('');
                      setNewActivityStartTime('');
                      setNewActivityEndTime('');
                      setNewActivityType('other');
                      setPlacePreds([]);
                      setHotelStartDate('');
                      setHotelEndDate('');
                      setFlightCode('');
                    }
                  }}>
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setNewActivityDayId(null);
                        setNewActivityTitle('');
                        setNewActivityLocation('');
                        setNewActivityStartTime('');
                        setNewActivityEndTime('');
                        setNewActivityType('other');
                        setPlacePreds([]);
                        setHotelStartDate('');
                        setHotelEndDate('');
                        setFlightCode('');
                      }}
                      aria-label={t('itinerary.closeAddActivity')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Input
                      placeholder={t('itinerary.activityTitle')}
                      value={newActivityTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityTitle(e.target.value)}
                      className="rounded-lg border border-input bg-background/90 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
                    />
                    <div>
                      <label className="text-xs text-muted-foreground">{t('itinerary.type')}</label>
                      <div className="relative mt-1">
                        <select
                          className="appearance-none w-full rounded-lg border border-input bg-background/90 px-3 py-2 pr-9 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
                          value={newActivityType}
                          onChange={(e) => setNewActivityType(e.target.value as any)}
                        >
                          <option value="food">{t('itinerary.type.food')}</option>
                          <option value="museum">{t('itinerary.type.museum')}</option>
                          <option value="sightseeing">{t('itinerary.type.sightseeing')}</option>
                          <option value="transport">{t('itinerary.type.transport')}</option>
                          <option value="hotel">{t('itinerary.type.hotel')}</option>
                          <option value="flight">{t('itinerary.type.flight')}</option>
                          <option value="other">{t('itinerary.type.other')}</option>
                        </select>
                        <svg
                          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                        className="rounded-lg border border-input bg-background/90 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
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
                        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-sm max-h-56 overflow-auto">
                          {placePreds.map((p) => (
                            <button
                              type="button"
                              key={p.place_id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={async () => {
                                setPlacePreds([]);
                                setPlaceIdForActivity(p.place_id);
                                try {
                                  const r = await fetch(`/api/places/details?place_id=${encodeURIComponent(p.place_id)}`);
                                  const j = await r.json();
                                  const result = (j && j.result) ? j.result : j;
                                  const name = result?.name || p.description;
                                  const address = result?.formatted_address || result?.vicinity || p.description;

                                  if (newActivityType === 'hotel') {
                                    setNewActivityTitle(name || '');
                                    setNewActivityLocation(address || '');
                                  } else {
                                    setNewActivityLocation(address || '');
                                  }

                                  const lat = j?.lat ?? result?.geometry?.location?.lat ?? null;
                                  const lng = j?.lng ?? result?.geometry?.location?.lng ?? null;
                                  if (lat != null && lng != null) {
                                    setPlaceCoordsForActivity({ lat, lng });
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
                        <div className="text-xs text-muted-foreground mt-1">{t('common.searching')}</div>
                      )}
                    </div>
                    {newActivityType === 'hotel' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={hotelStartDate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHotelStartDate(e.target.value)}
                          placeholder="Desde"
                        />
                        <Input
                          type="date"
                          value={hotelEndDate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHotelEndDate(e.target.value)}
                          placeholder="Hasta"
                        />
                      </div>
                    )}
                    {newActivityType === 'flight' && (
                      <div>
                        <Input
                          placeholder="Código de vuelo (ej. AR1234)"
                          value={flightCode}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFlightCode(e.target.value.toUpperCase())}
                        />
                      </div>
                    )}
                    {newActivityType !== 'hotel' && (
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          placeholder={t('itinerary.startTime')}
                          value={newActivityStartTime}
                          className="rounded-lg border border-input bg-background/90 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityStartTime(e.target.value)}
                        />
                        <Input
                          type="time"
                          placeholder={t('itinerary.endTime')}
                          value={newActivityEndTime}
                          className="rounded-lg border border-input bg-background/90 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActivityEndTime(e.target.value)}
                        />
                      </div>
                    )}
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
                          setHotelStartDate('');
                          setHotelEndDate('');
                          setFlightCode('');
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

      {/* Floating launchers: Tasks (top), Polls (middle), and Chat (bottom) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <Button
          className="relative rounded-full shadow-lg h-12 w-12 p-0"
          size="icon"
          onClick={() => setIsTasksOpen((v) => !v)}
          aria-label={t('tasks.title')}
        >
          <ListTodo className="h-5 w-5" />
        </Button>
        <Button
          className="relative rounded-full shadow-lg h-12 w-12 p-0"
          size="icon"
          onClick={() => setIsPollsOpen((v) => !v)}
          aria-label={t('polls.open')}
        >
          <BarChart3 className="h-5 w-5" />
        </Button>
        <Button
          className="relative rounded-full shadow-lg h-12 w-12 p-0"
          size="icon"
          onClick={() => { setIsChatOpen(true); setUnreadCount(0); }}
          aria-label={t('chat.open')}
        >
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-primary-foreground text-[10px] leading-none px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Compact bottom-right chat box */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] max-w-[95vw] h-[65vh] max-h-[560px] flex flex-col">
          <Chat tripId={tripId} compact />
          <div className="absolute top-2 right-2">
            <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} aria-label={t('chat.close')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Compact bottom-right tasks box (stacked above polls) */}
      <TaskListSheet open={isTasksOpen} onOpenChange={setIsTasksOpen} tripId={tripId} />

      {/* Compact bottom-right polls box (stacked a bit higher) */}
      {isPollsOpen && (
        <div className="fixed bottom-[90px] right-6 z-50 w-[360px] sm:w-[420px] max-w-[95vw] max-h-[70vh] overflow-hidden flex flex-col">
          <Card className="p-0 overflow-hidden w-full h-full">
            <div className="relative p-3 border-b flex items-center justify-between">
              <div className="font-medium text-foreground">{t('itinerary.polls')}</div>
              <Button variant="ghost" size="icon" onClick={() => setIsPollsOpen(false)} aria-label={t('polls.close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: '60vh' }}>
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('itinerary.editActivity')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('itinerary.activityTitle')}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Input
              placeholder={t('itinerary.location')}
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
            />
            {editType !== 'hotel' && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  placeholder={t('itinerary.startTime')}
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
                <Input
                  type="time"
                  placeholder={t('itinerary.endTime')}
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">{t('itinerary.type')}</label>
              <div className="relative mt-1">
                <select
                  className="appearance-none w-full rounded-lg border border-input bg-card px-3 py-2 pr-9 text-sm shadow-sm"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                >
                  <option value="food">{t('itinerary.type.food')}</option>
                  <option value="museum">{t('itinerary.type.museum')}</option>
                  <option value="sightseeing">{t('itinerary.type.sightseeing')}</option>
                  <option value="transport">{t('itinerary.type.transport')}</option>
                  <option value="hotel">{t('itinerary.type.hotel')}</option>
                  <option value="flight">{t('itinerary.type.flight')}</option>
                  <option value="other">{t('itinerary.type.other')}</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            {editType === 'hotel' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={editHotelStartDate}
                    onChange={(e) => setEditHotelStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={editHotelEndDate}
                    onChange={(e) => setEditHotelEndDate(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editApplyAll}
                    onChange={(e) => setEditApplyAll(e.target.checked)}
                  />
                  {t('itinerary.applyAllDays')}
                </label>
              </>
            )}
            {(editType !== 'hotel' && (editActivity as any)?.type === 'hotel') && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editApplyAll}
                  onChange={(e) => setEditApplyAll(e.target.checked)}
                />
                {t('itinerary.applyAllDays')}
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={saveEditedActivity}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

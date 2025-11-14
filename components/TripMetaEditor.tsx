"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TripMetaEditor({ tripId }: { tripId: string }) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }
        const { data: trip, error: tripErr } = await supabase
          .from("trips")
          .select("id, owner_id, title, destination, start_date, end_date, description")
          .eq("id", tripId)
          .single();
        if (tripErr) throw tripErr;
        if (!mounted || !trip) return;
        setTitle((trip as any).title || "");
        setDestination((trip as any).destination || null);
        setStartDate((trip as any).start_date || null);
        setEndDate((trip as any).end_date || null);
        setDescription((trip as any).description || null);
        let can = (trip as any).owner_id === user.id;
        if (!can) {
          const { data: member } = await supabase
            .from("trip_members")
            .select("user_id")
            .eq("trip_id", tripId)
            .eq("user_id", user.id)
            .maybeSingle();
          can = !!member;
        }
        setCanEdit(can);
      } catch (e: any) {
        setError(e?.message || "Failed to load trip");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [tripId]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      // Only owner can edit meta
      const payload = {
        title: title || undefined,
        destination: destination || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        description: description || undefined,
      } as Partial<Database['public']['Tables']['trips']['Update']>;
      if (!canEdit) throw new Error("You don't have permission to edit this trip");
      const tripsTable = supabase.from("trips") as any;
      const { error: upErr } = await tripsTable
        .update(payload as any)
        .eq("id", tripId);
      if (upErr) throw upErr;
    } catch (e: any) {
      setError(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Trip details</h2>
        <Button onClick={onSave} disabled={!canEdit || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-md p-2">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="trip-title" className="text-sm text-gray-700">Title</label>
          <Input id="trip-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || loading} />
        </div>
        <div className="space-y-2">
          <label htmlFor="trip-destination" className="text-sm text-gray-700">Destination</label>
          <Input id="trip-destination" value={destination || ""} onChange={(e) => setDestination(e.target.value)} disabled={!canEdit || loading} />
        </div>
        <div className="space-y-2">
          <label htmlFor="trip-start" className="text-sm text-gray-700">Start date</label>
          <Input id="trip-start" type="date" value={startDate || ""} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit || loading} />
        </div>
        <div className="space-y-2">
          <label htmlFor="trip-end" className="text-sm text-gray-700">End date</label>
          <Input id="trip-end" type="date" value={endDate || ""} onChange={(e) => setEndDate(e.target.value)} disabled={!canEdit || loading} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="trip-desc" className="text-sm text-gray-700">Description</label>
          <textarea
            id="trip-desc"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            value={description || ""}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit || loading}
          />
        </div>
      </div>
      {!canEdit && (
        <div className="mt-2 text-xs text-gray-500">Only the trip owner can edit these fields.</div>
      )}
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface ExpenseRow {
  id: string;
  trip_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  paid_by: string; // user_id
  created_at: string;
}

interface SplitRow {
  id: string;
  expense_id: string;
  user_id: string;
  share_cents: number;
}

export function Expenses({ tripId }: { tripId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // add expense form state
  const [openForm, setOpenForm] = useState(false);
  const [title, setTitle] = useState("");
  const [srcAmount, setSrcAmount] = useState<string>("");
  const [srcCurrency, setSrcCurrency] = useState<string>("USD");
  const [usdAmount, setUsdAmount] = useState<number | null>(null);
  const [paidBy, setPaidBy] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [converting, setConverting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      await loadMembers();
      await loadExpenses();
      setLoading(false);
      subscribe();
    })();
    return () => {
      supabase.getChannels().forEach((c) => supabase.removeChannel(c));
    };
  }, [tripId]);

  const subscribe = () => {
    const ch1 = supabase
      .channel("trip-expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_expenses", filter: `trip_id=eq.${tripId}` }, loadExpenses)
      .subscribe();
    return ch1;
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from("trip_members")
      .select(
        `user_id, user_profiles:user_id ( email, display_name )`
      )
      .eq("trip_id", tripId);
    const m: Member[] = (data || []).map((r: any) => ({
      user_id: r.user_id,
      email: r.user_profiles?.email ?? null,
      display_name: r.user_profiles?.display_name ?? null,
    }));
    setMembers(m);
    if (m.length > 0) {
      setPaidBy(currentUserId || m[0].user_id);
      setSelected(Object.fromEntries(m.map((mm) => [mm.user_id, true])));
    }
  };

  const loadExpenses = async () => {
    const { data: e } = await supabase
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    const exp = (e || []) as any[];
    setExpenses(exp as any);
    const ids = exp.map((x: any) => x.id);
    if (ids.length === 0) {
      setSplits([]);
      return;
    }
    const { data: s } = await supabase
      .from("trip_expense_splits")
      .select("*")
      .in("expense_id", ids);
    setSplits((s || []) as any);
  };

  const totalUsd = useMemo(() => expenses.reduce((acc, x) => acc + (x.currency === "USD" ? x.amount_cents : 0), 0) / 100, [expenses]);
  const perPerson = useMemo(() => (members.length ? totalUsd / members.length : 0), [totalUsd, members.length]);

  const balances = useMemo(() => {
    const byUser: Record<string, { paid: number; owes: number }> = {};
    members.forEach((m) => (byUser[m.user_id] = { paid: 0, owes: 0 }));
    expenses.forEach((e) => {
      if (e.currency === "USD") byUser[e.paid_by] = { ...(byUser[e.paid_by] || { paid: 0, owes: 0 }), paid: (byUser[e.paid_by]?.paid || 0) + e.amount_cents };
    });
    splits.forEach((s) => {
      byUser[s.user_id] = { ...(byUser[s.user_id] || { paid: 0, owes: 0 }), owes: (byUser[s.user_id]?.owes || 0) + s.share_cents };
    });
    return byUser; // cents
  }, [members, expenses, splits]);

  const convertToUsd = async () => {
    const amt = parseFloat(srcAmount);
    if (!isFinite(amt) || amt <= 0) return;
    if (srcCurrency.toUpperCase() === "USD") {
      setUsdAmount(Math.round(amt * 100) / 100);
      return;
    }
    try {
      setConverting(true);
      const res = await fetch(`/api/exchange/convert?from=${encodeURIComponent(srcCurrency)}&to=USD&amount=${encodeURIComponent(String(amt))}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "FX error");
      const out = typeof json.result === "number" ? json.result : 0;
      setUsdAmount(Math.round(out * 100) / 100);
    } catch (e) {
      alert((e as any)?.message || "FX failed");
    } finally {
      setConverting(false);
    }
  };

  const toggleParticipant = (uid: string) => {
    setSelected((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const addExpense = async () => {
    const amt = usdAmount ?? (srcCurrency.toUpperCase() === "USD" ? parseFloat(srcAmount) : NaN);
    if (!title.trim() || !isFinite(amt) || !paidBy) return;
    const amountCents = Math.round(amt * 100);
    const active = members.filter((m) => selected[m.user_id]);
    if (active.length === 0) return;
    const equalShare = Math.floor(amountCents / active.length);
    const remainder = amountCents - equalShare * active.length;

    const { data: exp, error } = await supabase
      .from("trip_expenses")
      .insert({ trip_id: tripId, title, amount_cents: amountCents, currency: "USD", paid_by: paidBy } as any)
      .select("*")
      .single();
    if (error) {
      alert(error.message);
      return;
    }

    const rows: any[] = active.map((m, idx) => ({
      expense_id: (exp as any).id,
      user_id: m.user_id,
      share_cents: equalShare + (idx === 0 ? remainder : 0),
    }));
    const { error: e2 } = await supabase.from("trip_expense_splits").insert(rows as any);
    if (e2) {
      alert(e2.message);
      return;
    }

    // reset
    setOpenForm(false);
    setTitle("");
    setSrcAmount("");
    setUsdAmount(null);
  };

  if (loading) return <Card className="p-4">Loading expenses…</Card>;

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold text-gray-900">Expenses</div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="p-2 rounded-md border">
          <div className="text-gray-600">Total Trip Expenses</div>
          <div className="text-xl font-bold">${totalUsd.toFixed(2)}</div>
        </div>
        <div className="p-2 rounded-md border">
          <div className="text-gray-600">Average Per Person</div>
          <div className="text-xl font-bold">${perPerson.toFixed(2)}</div>
        </div>
        <div className="p-2 rounded-md border">
          <div className="text-gray-600">Your Balance</div>
          <div className="text-xl font-bold">
            {(() => {
              const uid = currentUserId || (members[0] && members[0].user_id) || "";
              const b = balances[uid] || { paid: 0, owes: 0 };
              const v = (b.paid - b.owes) / 100;
              return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
            })()}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">Latest expenses</div>
        <Button size="sm" onClick={() => setOpenForm((o) => !o)}>{openForm ? "Close" : "Add expense"}</Button>
      </div>

      {openForm && (
        <div className="p-3 rounded-md border space-y-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Amount" value={srcAmount} onChange={(e) => setSrcAmount(e.target.value)} className="w-40" />
            <select className="border rounded-md px-2" value={srcCurrency} onChange={(e) => setSrcCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
            <Button size="sm" onClick={convertToUsd} disabled={converting}>{converting ? "Converting…" : "Convert to USD"}</Button>
            <div className="text-sm text-gray-700 flex items-center">{usdAmount != null ? `≈ $${usdAmount.toFixed(2)} USD` : null}</div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="text-sm text-gray-600">Paid by</div>
            <select className="border rounded-md px-2 py-1" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.display_name || m.email || m.user_id.slice(0,6)}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">Participants</div>
          <div className="grid grid-cols-2 gap-1">
            {members.map((m) => (
              <button key={m.user_id} type="button" onClick={() => toggleParticipant(m.user_id)} className={`text-left px-2 py-1 rounded border ${selected[m.user_id] ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}>
                {m.display_name || m.email || m.user_id.slice(0,6)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={addExpense}>Save</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {expenses.slice(0,5).map((e) => (
          <div key={e.id} className="flex items-center justify-between text-sm border rounded-md p-2">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-gray-600">Paid by {members.find(m=>m.user_id===e.paid_by)?.display_name || 'User'}</div>
            </div>
            <div className="font-semibold">${(e.amount_cents/100).toFixed(2)} USD</div>
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="text-sm text-gray-500">No expenses yet</div>
        )}
      </div>
    </Card>
  );
}

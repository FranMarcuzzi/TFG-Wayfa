"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useI18n } from '@/components/i18n/I18nProvider';

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
  const { t } = useI18n();
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
  // inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editAmountUsd, setEditAmountUsd] = useState<string>('');

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

  const startEdit = (e: ExpenseRow) => {
    setEditingId(e.id);
    setEditTitle(e.title);
    setEditAmountUsd((e.amount_cents / 100).toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditAmountUsd('');
  };

  const saveEdit = async (e: ExpenseRow) => {
    const n = parseFloat(editAmountUsd);
    if (!isFinite(n) || n <= 0 || !editTitle.trim()) return;
    const newCents = Math.round(n * 100);
    try {
      const { error: upErr } = await supabase
        .from('trip_expenses')
        // @ts-expect-error - Supabase type issue
        .update({ title: editTitle, amount_cents: newCents })
        .eq('id', e.id);
      if (upErr) throw upErr;

      // Re-split equally across existing splits for this expense
      const currentSplits = splits.filter((s) => s.expense_id === e.id);
      if (currentSplits.length > 0) {
        const eq = Math.floor(newCents / currentSplits.length);
        const remainder = newCents - eq * currentSplits.length;
        const updates = currentSplits.map((s, idx) => ({ id: s.id, share_cents: eq + (idx === 0 ? remainder : 0) }));
        // Perform update in batch
        const { error: up2 } = await supabase.from('trip_expense_splits')
          // @ts-expect-error - Supabase type issue
          .upsert(updates);
        if (up2) throw up2;
      }

      toast({ title: 'Expense updated' });
      await loadExpenses();
      cancelEdit();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: err?.message || 'Error updating expense' });
    }
  };

  const deleteExpense = async (e: ExpenseRow) => {
    try {
      // delete splits then expense
      await supabase.from('trip_expense_splits').delete().eq('expense_id', e.id);
      const { error: delErr } = await supabase.from('trip_expenses').delete().eq('id', e.id);
      if (delErr) throw delErr;
      toast({ title: 'Expense deleted' });
      await loadExpenses();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err?.message || 'Error deleting expense' });
    }
  };

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
  const perPerson = useMemo(() => {
    if (members.length === 0) return 0;
    return totalUsd / members.length;
  }, [members, totalUsd]);
  const nameOf = (userId: string) => {
    const m = members.find((mm) => mm.user_id === userId);
    return m?.display_name || (m?.email ? m.email.split('@')[0] : userId.slice(0,6));
  };

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
      const msg = (e as any)?.message || "FX failed";
      toast({ variant: 'destructive', title: 'Conversion failed', description: msg });
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
      toast({ variant: 'destructive', title: 'Expense error', description: error.message });
      return;
    }

    const rows: any[] = active.map((m, idx) => ({
      expense_id: (exp as any).id,
      user_id: m.user_id,
      share_cents: equalShare + (idx === 0 ? remainder : 0),
    }));
    const { error: e2 } = await supabase.from("trip_expense_splits").insert(rows as any);
    if (e2) {
      toast({ variant: 'destructive', title: 'Split error', description: e2.message });
      return;
    }

    // reset
    setOpenForm(false);
    setTitle("");
    setSrcAmount("");
    setUsdAmount(null);
  };

  if (loading) return <Card className="p-4">{t('common.loading')}</Card>;

  return (
    <Card className="p-3 sm:p-4 space-y-3">
      <div className="text-sm sm:text-base font-semibold text-gray-900">{t('expenses.title')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <div className="p-2 sm:p-3 rounded-md border">
          <div className="text-xs sm:text-sm text-gray-600">{t('expenses.total')}</div>
          <div className="text-lg sm:text-xl font-bold">${totalUsd.toFixed(2)}</div>
        </div>
        <div className="p-2 sm:p-3 rounded-md border">
          <div className="text-xs sm:text-sm text-gray-600">{t('expenses.average')}</div>
          <div className="text-lg sm:text-xl font-bold">${perPerson.toFixed(2)}</div>
        </div>
        <div className="p-2 sm:p-3 rounded-md border">
          <div className="text-xs sm:text-sm text-gray-600">{t('expenses.balance')}</div>
          <div className="text-lg sm:text-xl font-bold">
            {(() => {
              const uid = currentUserId || (members[0] && members[0].user_id) || "";
              const b = balances[uid] || { paid: 0, owes: 0 };
              const v = (b.paid - b.owes) / 100;
              return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
            })()}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm text-gray-600">{t('expenses.latest')}</div>
        <Button size="sm" onClick={() => setOpenForm((o) => !o)} className="text-xs sm:text-sm w-full sm:w-auto">{openForm ? t('expenses.closeForm') : t('expenses.openForm')}</Button>
      </div>

      {openForm && (
        <div className="p-3 rounded-md border space-y-2">
          <Input placeholder={t('expenses.form.title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Input
              placeholder={t('expenses.form.amount')}
              value={srcAmount}
              onChange={(e) => setSrcAmount(e.target.value)}
              className="w-full sm:w-40 rounded-lg border border-gray-300 bg-white/90 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur text-sm"
            />
            <div className="relative">
              <select
                className="appearance-none rounded-lg border border-gray-300 bg-white/90 px-3 py-2 pr-9 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                value={srcCurrency}
                onChange={(e) => setSrcCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
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
            <Button size="sm" onClick={convertToUsd} disabled={converting} className="text-xs sm:text-sm w-full sm:w-auto">{converting ? t('common.loading') : t('expenses.form.convert')}</Button>
            <div className="text-xs sm:text-sm text-gray-700 flex items-center justify-center sm:justify-start">{usdAmount != null ? `≈ $${usdAmount.toFixed(2)} USD` : null}</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="text-xs sm:text-sm text-gray-600">{t('expenses.form.paidBy')}</div>
            <div className="relative">
              <select
                className="appearance-none rounded-lg border border-gray-300 bg-white/90 px-3 py-2 pr-9 text-sm shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 backdrop-blur"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name || (m.email ? m.email.split('@')[0] : m.user_id.slice(0,6))}</option>
                ))}
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
          <div className="text-xs sm:text-sm text-gray-600">{t('expenses.form.participants')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {members.map((m) => (
              <button key={m.user_id} type="button" onClick={() => toggleParticipant(m.user_id)} className={`px-2 py-1 rounded-md border text-xs sm:text-sm ${selected[m.user_id] ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-900 border-gray-300'}`}>
                {m.display_name || (m.email ? m.email.split('@')[0] : m.user_id.slice(0,6))}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={addExpense} className="text-xs sm:text-sm w-full sm:w-auto">{t('expenses.form.save')}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {expenses.slice(0,10).map((e) => (
          <div key={e.id} className="text-xs sm:text-sm border rounded-md p-2">
            {editingId === e.id ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  className="border rounded px-2 py-1 text-xs sm:text-sm flex-1"
                  value={editTitle}
                  onChange={(ev) => setEditTitle(ev.target.value)}
                />
                <input
                  className="border rounded px-2 py-1 text-xs sm:text-sm w-full sm:w-28"
                  value={editAmountUsd}
                  onChange={(ev) => setEditAmountUsd(ev.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(e)} className="text-xs flex-1 sm:flex-none">Save</Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit} className="text-xs flex-1 sm:flex-none">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm sm:text-base">{e.title}</div>
                  <div className="text-gray-600 text-xs">{t('expenses.paidByUser', { name: nameOf(e.paid_by) })}</div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  <div className="font-semibold text-sm sm:text-base">${(e.amount_cents/100).toFixed(2)} USD</div>
                  <Button size="sm" variant="outline" onClick={() => startEdit(e)} className="text-xs">{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteExpense(e)} className="text-xs">{t('common.delete')}</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="text-xs sm:text-sm text-gray-500">{t('expenses.none')}</div>
        )}
      </div>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Check, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useI18n } from '@/components/i18n/I18nProvider';

interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  trip_id: string;
  question: string;
  created_by: string;
  created_at: string;
  options: PollOption[];
  userVote: string | null;
  creator_name?: string;
  creator_email?: string;
}

interface PollsProps {
  tripId: string;
}

export function Polls({ tripId }: PollsProps) {
  const { t } = useI18n();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
    loadPolls();
    subscribeToChanges();
    const t = setTimeout(() => { loadPolls(); }, 300);
    return () => { try { clearTimeout(t); } catch { } };
  }, [tripId]);

  useEffect(() => {
    if (!showCreateForm) {
      // when form closes, refresh list
      loadPolls();
    }
  }, [showCreateForm]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadPolls = async () => {
    try {
      let pollsData: any[] | null = null;
      // First try with join to user_profiles (may fail if relation name differs)
      const joined = await supabase
        .from('polls')
        .select(`
          *,
          user_profiles!polls_created_by_fkey (
            email,
            display_name
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (!joined.error) {
        pollsData = joined.data as any[];
      } else {
        // Fallback: simple select without join
        const simple = await supabase
          .from('polls')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });
        if (simple.error) throw simple.error;
        pollsData = simple.data as any[];
      }

      const safePolls = Array.isArray(pollsData) ? pollsData : [];
      const pollsWithOptions = await Promise.all(
        safePolls.map(async (poll: any) => {
          try {
            const { data: options } = await supabase
              .from('poll_options')
              .select('*')
              .eq('poll_id', poll.id);

            const optionsWithVotes = await Promise.all(
              (options || []).map(async (option: any) => {
                try {
                  const { count } = await supabase
                    .from('poll_votes')
                    .select('*', { count: 'exact', head: true })
                    .eq('option_id', option.id);
                  return { ...option, votes: count || 0 };
                } catch {
                  return { ...option, votes: 0 };
                }
              })
            );

            let userVote = null;
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: vote } = await supabase
                  .from('poll_votes')
                  .select('option_id')
                  .eq('poll_id', poll.id)
                  .eq('user_id', user.id)
                  .maybeSingle();
                if (vote) userVote = (vote as any).option_id;
              }
            } catch { }

            return {
              ...poll,
              options: optionsWithVotes,
              userVote,
              creator_name: poll.user_profiles?.display_name || null,
              creator_email: poll.user_profiles?.email || t('common.unknown'),
            };
          } catch {
            return {
              ...poll,
              options: [],
              userVote: null,
              creator_name: poll.user_profiles?.display_name || null,
              creator_email: poll.user_profiles?.email || t('common.unknown'),
            };
          }
        })
      );

      setPolls(pollsWithOptions);
      // debug length toast (non-destructive)
      // toast({ title: `Loaded polls: ${pollsWithOptions.length}` });
    } catch {
      setPolls([]);
    }
  };

  const subscribeToChanges = () => {
    const pollsChannel = supabase
      .channel('polls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
        },
        () => {
          loadPolls();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_options',
        },
        () => {
          loadPolls();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
        },
        () => {
          loadPolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
    };
  };

  const createPoll = async () => {
    if (!newQuestion.trim()) {
      toast({ variant: 'destructive', title: t('polls.missingQuestionTitle'), description: t('polls.missingQuestionDesc') });
      return;
    }
    if (!currentUserId) {
      toast({ variant: 'destructive', title: t('polls.notSignedInTitle'), description: t('polls.notSignedInDesc') });
      return;
    }

    const validOptions = newOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      toast({ variant: 'destructive', title: t('polls.addMoreOptionsTitle'), description: t('polls.addMoreOptionsDesc') });
      return;
    }

    try {
      setCreating(true);
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          trip_id: tripId,
          question: newQuestion,
          created_by: currentUserId,
        } as any)
        .select()
        .single();

      if (pollError || !poll) {
        throw new Error(pollError?.message || t('polls.createFailedDesc'));
      }

      const optionsToInsert = validOptions.map((label) => ({
        poll_id: (poll as any).id,
        label,
      }));

      const { error: optErr } = await supabase.from('poll_options').insert(optionsToInsert as any);
      if (optErr) throw optErr;

      toast({ title: t('polls.created') });
      setNewQuestion('');
      setNewOptions(['', '']);
      setShowCreateForm(false);
      await loadPolls();
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('polls.createFailedTitle'), description: e?.message || t('polls.createFailedDesc') });
    } finally {
      setCreating(false);
    }
  };

  const vote = async (pollId: string, optionId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase.from('poll_votes').upsert({
      poll_id: pollId,
      option_id: optionId,
      user_id: currentUserId,
    } as any);

    if (!error) {
      loadPolls();
    }
  };

  const addOptionField = () => {
    setNewOptions([...newOptions, '']);
  };

  const removeOptionField = (index: number) => {
    setNewOptions(newOptions.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...newOptions];
    updated[index] = value;
    setNewOptions(updated);
  };

  const deletePoll = async (pollId: string) => {
    try {
      setDeletingId(pollId);
      // Delete votes, options, then poll
      await supabase.from('poll_votes').delete().eq('poll_id', pollId);
      await supabase.from('poll_options').delete().eq('poll_id', pollId);
      const { error } = await supabase.from('polls').delete().eq('id', pollId);
      if (error) throw error;
      toast({ title: t('polls.deleted') });
      await loadPolls();
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('polls.deleteFailedTitle'), description: e?.message || t('polls.deleteFailedDesc') });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">{t('polls.title')}</h3>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            {t('polls.new')}
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card className="p-4 space-y-3">
          <Input
            placeholder={t('polls.questionPlaceholder')}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />

          <div className="space-y-2">
            {newOptions.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={t('polls.optionPlaceholder', { n: index + 1 })}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                />
                {newOptions.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOptionField(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={addOptionField} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('polls.addOption')}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={createPoll} size="sm" disabled={creating}>
              {creating ? t('polls.creating') : t('polls.create')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setNewQuestion('');
                setNewOptions(['', '']);
              }}
              size="sm"
            >
              {t('polls.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {polls.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t('polls.empty')}
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const totalVotes = (poll.options || []).reduce((sum, opt) => sum + opt.votes, 0);

            return (
              <Card key={poll.id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-foreground">{poll.question}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('polls.createdBy', { name: poll.creator_name || poll.creator_email?.split('@')[0] || t('common.unknown') })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePoll(poll.id)}
                    disabled={deletingId === poll.id}
                    aria-label={t('polls.deleteAria')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {poll.options.map((option) => {
                    const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                    const isUserVote = poll.userVote === option.id;

                    return (
                      <button
                        key={option.id}
                        onClick={() => vote(poll.id, option.id)}
                        className="w-full text-left"
                      >
                        <div className="relative">
                          <div
                            className={`absolute inset-0 rounded transition-all ${isUserVote ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                              }`}
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isUserVote && <Check className="h-4 w-4 text-primary" />}
                              <span className="font-medium">{option.label}</span>
                            </div>
                            <Badge variant="secondary">
                              {option.votes} {option.votes === 1 ? t('polls.vote') : t('polls.votes')}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-sm text-muted-foreground">
                  {t('polls.totalVotes', { count: totalVotes })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

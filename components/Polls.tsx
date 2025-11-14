'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Check, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
    return () => { try { clearTimeout(t); } catch {} };
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
            } catch {}

            return {
              ...poll,
              options: optionsWithVotes,
              userVote,
              creator_name: poll.user_profiles?.display_name || null,
              creator_email: poll.user_profiles?.email || 'Unknown',
            };
          } catch {
            return {
              ...poll,
              options: [],
              userVote: null,
              creator_name: poll.user_profiles?.display_name || null,
              creator_email: poll.user_profiles?.email || 'Unknown',
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
      toast({ variant: 'destructive', title: 'Missing question', description: 'Please enter a question' });
      return;
    }
    if (!currentUserId) {
      toast({ variant: 'destructive', title: 'Not signed in', description: 'Please sign in to create a poll' });
      return;
    }

    const validOptions = newOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      toast({ variant: 'destructive', title: 'Add more options', description: 'Please add at least 2 options' });
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
        throw new Error(pollError?.message || 'Failed to create poll');
      }

      const optionsToInsert = validOptions.map((label) => ({
        poll_id: (poll as any).id,
        label,
      }));

      const { error: optErr } = await supabase.from('poll_options').insert(optionsToInsert as any);
      if (optErr) throw optErr;

      toast({ title: 'Poll created' });
      setNewQuestion('');
      setNewOptions(['', '']);
      setShowCreateForm(false);
      await loadPolls();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create failed', description: e?.message || 'Could not create poll' });
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
      toast({ title: 'Poll deleted' });
      await loadPolls();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e?.message || 'Could not delete poll' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">Polls</h3>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} size="sm" variant="outline" className="text-xs sm:text-sm px-2 sm:px-3">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">New Poll</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          <Input
            placeholder="Poll question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />

          <div className="space-y-2">
            {newOptions.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Option ${index + 1}`}
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
              Add Option
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={createPoll} size="sm" disabled={creating}>
              {creating ? 'Creating…' : 'Create Poll'}
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
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {polls.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">
          No polls yet. Create one to get group input!
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const totalVotes = (poll.options || []).reduce((sum, opt) => sum + opt.votes, 0);

            return (
              <Card key={poll.id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{poll.question}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Created by {poll.creator_name || poll.creator_email?.split('@')[0] || 'Unknown'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePoll(poll.id)}
                    disabled={deletingId === poll.id}
                    aria-label="Delete poll"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
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
                            className={`absolute inset-0 rounded transition-all ${
                              isUserVote ? 'bg-blue-100' : 'bg-gray-100'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isUserVote && <Check className="h-4 w-4 text-blue-600" />}
                              <span className="font-medium">{option.label}</span>
                            </div>
                            <Badge variant="secondary">
                              {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-sm text-gray-500">
                  Total votes: {totalVotes}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Check } from 'lucide-react';

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

  useEffect(() => {
    getCurrentUser();
    loadPolls();
    subscribeToChanges();
  }, [tripId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadPolls = async () => {
    const { data: pollsData } = await supabase
      .from('polls')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (pollsData) {
      const pollsWithOptions = await Promise.all(
        pollsData.map(async (poll: any) => {
          const { data: options } = await supabase
            .from('poll_options')
            .select('*')
            .eq('poll_id', poll.id);

          const optionsWithVotes = await Promise.all(
            (options || []).map(async (option: any) => {
              const { count } = await supabase
                .from('poll_votes')
                .select('*', { count: 'exact', head: true })
                .eq('option_id', option.id);

              return {
                ...option,
                votes: count || 0,
              };
            })
          );

          const { data: { user } } = await supabase.auth.getUser();
          let userVote = null;
          if (user) {
            const { data: vote } = await supabase
              .from('poll_votes')
              .select('option_id')
              .eq('poll_id', poll.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (vote) {
              userVote = (vote as any).option_id;
            }
          }

          return {
            ...poll,
            options: optionsWithVotes,
            userVote,
          };
        })
      );

      setPolls(pollsWithOptions);
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
    if (!newQuestion.trim() || !currentUserId) return;

    const validOptions = newOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      alert('Please add at least 2 options');
      return;
    }

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({
        trip_id: tripId,
        question: newQuestion,
        created_by: currentUserId,
      } as any)
      .select()
      .single();

    if (pollError || !poll) return;

    const optionsToInsert = validOptions.map((label) => ({
      poll_id: (poll as any).id,
      label,
    }));

    await supabase.from('poll_options').insert(optionsToInsert as any);

    setNewQuestion('');
    setNewOptions(['', '']);
    setShowCreateForm(false);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Polls</h3>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Poll
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card className="p-4 space-y-3">
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
            <Button onClick={createPoll} size="sm">
              Create Poll
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
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

            return (
              <Card key={poll.id} className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">{poll.question}</h4>

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

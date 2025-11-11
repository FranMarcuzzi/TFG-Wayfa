'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Users } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  trip_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_email?: string;
}

interface ChatProps {
  tripId: string;
}

export function Chat({ tripId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadMessages();
    getCurrentUser();
    ensureProfile();
    setupRealtimeChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tripId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const ensureProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          email: user.email || `user-${user.id.substring(0, 8)}@example.com`,
          display_name: (user.user_metadata && (user.user_metadata as any).display_name) || null,
        } as any, { onConflict: 'user_id' } as any);
    } catch (e) {
      // ignore
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        user_profiles!messages_author_id_fkey (
          email,
          display_name
        )
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (data) {
      const messagesWithAuthors = data.map((msg: any) => ({
        ...msg,
        author_name: msg.user_profiles?.display_name || null,
        author_email: msg.user_profiles?.email || 'Unknown',
      }));
      setMessages(messagesWithAuthors);
    }
  };

  const setupRealtimeChannel = () => {
    const channel = supabase.channel(`trip-${tripId}`, {
      config: {
        presence: {
          key: 'user_id',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        }
      });

    channelRef.current = channel;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !currentUserId) return;

    const tryInsert = async () => supabase
      .from('messages')
      .insert({
        trip_id: tripId,
        author_id: currentUserId,
        content: newMessage,
      } as any)
      .select('*')
      .single();

    let { error, data } = await tryInsert();
    if (error) {
      // If FK fails due to missing user_profiles, try to upsert profile then retry once
      await ensureProfile();
      const retry = await tryInsert();
      error = retry.error;
      data = retry.data as any;
    }

    if (error) {
      console.error('Failed to send message:', error);
      alert(error.message || 'Failed to send message');
      return;
    }

    // Optimistically append the new message
    if (data) {
      setMessages((prev) => [
        ...prev,
        {
          ...(data as any),
          author_name: undefined,
          author_email: undefined,
        } as any,
      ]);
    } else {
      // Fallback: reload
      loadMessages();
    }

    setNewMessage('');
    scrollToBottom();
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Chat</h3>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {onlineCount} online
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.author_id === currentUserId ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.author_id === currentUserId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.author_id !== currentUserId && (
                  <div className="text-xs font-semibold mb-1 text-gray-700">
                    {message.author_name || message.author_email?.split('@')[0] || 'Unknown'}
                  </div>
                )}
                <div className="break-words">{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.author_id === currentUserId ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {format(new Date(message.created_at), 'h:mm a')}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}

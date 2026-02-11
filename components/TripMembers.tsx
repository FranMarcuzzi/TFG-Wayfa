'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/i18n/I18nProvider';

interface TripMember {
  trip_id: string;
  user_id: string;
  role: 'organizer' | 'participant';
  email: string;
  display_name: string | null;
}

interface TripMembersProps {
  tripId: string;
}

export function TripMembers({ tripId }: TripMembersProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    loadMembers();
    checkUserRole();
    const channel = supabase
      .channel('trip-members-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
        () => {
          loadMembers();
          checkUserRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .single();

    setIsOrganizer((data as any)?.role === 'organizer');
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          trip_id,
          user_id,
          role,
          user_profiles!trip_members_user_id_fkey (
            email,
            display_name
          )
        `)
        .eq('trip_id', tripId)
        .order('role', { ascending: true });

      if (error) {
        console.error('Error loading members:', error);
        throw error;
      }

      console.log('Raw members data:', data);

      // Map the data to include user profile info
      const membersWithProfiles = (data || []).map((member: any) => {
        console.log('Processing member:', member);
        return {
          trip_id: member.trip_id,
          user_id: member.user_id,
          role: member.role,
          email: member.user_profiles?.email || t('common.unknown'),
          display_name: member.user_profiles?.display_name || null,
        };
      });

      console.log('Processed members:', membersWithProfiles);
      setMembers(membersWithProfiles);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      // Validate email
      if (!inviteEmail || !inviteEmail.includes('@')) {
        setInviteError(t('members.inviteInvalidEmail'));
        setInviteLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInviteError(t('members.inviteMustLogin'));
        setInviteLoading(false);
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', tripId)
        .limit(1);

      // Check if there's already a pending invitation for this email on THIS trip
      const { data: existingInvite } = await supabase
        .from('trip_invitations')
        .select('id')
        .eq('trip_id', tripId)
        .eq('email', inviteEmail.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        setInviteError(t('members.inviteDuplicate'));
        setInviteLoading(false);
        return;
      }

      // Create invitation record for THIS specific trip
      const { error: inviteError } = await supabase
        .from('trip_invitations')
        .insert({
          trip_id: tripId,
          email: inviteEmail.toLowerCase(),
          invited_by: user.id,
          status: 'pending',
        } as any);

      if (inviteError) throw inviteError;

      // Success!
      setInviteError('');
      setInviteEmail('');
      setIsDialogOpen(false);
      toast({ title: t('members.inviteSentTitle'), description: t('members.inviteSentDesc', { email: inviteEmail }) });

    } catch (error: any) {
      console.error('Error inviting member:', error);
      setInviteError(error.message || t('members.inviteFailed'));
    } finally {
      setInviteLoading(false);
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!isOrganizer) return;
    if (memberUserId === currentUserId) {
      toast({ variant: 'destructive', title: t('members.removeNotAllowedTitle'), description: t('members.removeNotAllowedDesc') });
      return;
    }

    const target = members.find((m) => m.user_id === memberUserId);
    const name = target ? getDisplayName(target) : t('members.thisUser');
    toast({
      title: t('members.removeConfirmTitle'),
      description: t('members.removeConfirmDesc', { name }),
      action: (
        <ToastAction
          altText={t('members.removeAction')}
          onClick={async () => {
            try {
              const { error } = await supabase
                .from('trip_members')
                .delete()
                .eq('trip_id', tripId)
                .eq('user_id', memberUserId);
              if (error) throw error;
              setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
              toast({ title: t('members.removeSuccess') });
            } catch (e: any) {
              toast({ variant: 'destructive', title: t('members.removeFailed'), description: e?.message || t('common.unexpected') });
            }
          }}
        >
          {t('members.removeAction')}
        </ToastAction>
      ),
    });
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'organizer' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-muted text-muted-foreground';
  };

  const getRoleLabel = (role: string) => {
    return role === 'organizer' ? t('members.role.organizer') : t('members.role.participant');
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (member: TripMember) => {
    return member.display_name || member.email.split('@')[0];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{t('members.title')}</CardTitle>
          {isOrganizer && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  {t('members.invite')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('members.inviteTitle')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4">
                  {inviteError && (
                    <div className="p-3 text-sm bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-lg">
                      {inviteError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
                      {t('members.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('members.emailPlaceholder')}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={inviteLoading}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={inviteLoading}
                    >
                      {t('members.cancel')}
                    </Button>
                    <Button type="submit" disabled={inviteLoading}>
                      {inviteLoading ? t('members.sending') : t('members.send')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('members.noMembers')}</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-primary-foreground">
                      {getInitials(getDisplayName(member))}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {getDisplayName(member)}
                      {member.user_id === currentUserId && (
                        <span className="text-muted-foreground ml-1">({t('members.you')})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={getRoleBadgeColor(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {isOrganizer && member.user_id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(member.user_id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

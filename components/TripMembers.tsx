'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

    setIsOrganizer(data?.role === 'organizer');
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
          user_profiles (
            email,
            display_name
          )
        `)
        .eq('trip_id', tripId)
        .order('role', { ascending: true });

      if (error) throw error;

      // Map the data to include user profile info
      const membersWithProfiles = (data || []).map((member: any) => ({
        trip_id: member.trip_id,
        user_id: member.user_id,
        role: member.role,
        email: member.user_profiles?.email || 'Unknown User',
        display_name: member.user_profiles?.display_name || null,
      }));

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
        setInviteError('Please enter a valid email address');
        setInviteLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInviteError('You must be logged in to send invitations');
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
        setInviteError('An invitation has already been sent to this email for this trip');
        setInviteLoading(false);
        return;
      }

      // Create invitation record for THIS specific trip
      const { error: inviteError } = await supabase
        .from('trip_invitations')
        .insert({
          trip_id: tripId, // CRITICAL: Must be specific to this trip
          email: inviteEmail.toLowerCase(),
          invited_by: user.id,
          status: 'pending',
        });

      if (inviteError) throw inviteError;

      // Success!
      setInviteError('');
      setInviteEmail('');
      setIsDialogOpen(false);
      alert(`Invitation sent to ${inviteEmail}! They will see it when they log in.`);

    } catch (error: any) {
      console.error('Error inviting member:', error);
      setInviteError(error.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!isOrganizer) return;
    if (memberUserId === currentUserId) {
      alert('You cannot remove yourself as organizer');
      return;
    }

    try {
      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', memberUserId);

      if (error) throw error;

      setMembers(members.filter(m => m.user_id !== memberUserId));
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'organizer' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
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
          <CardTitle className="text-xl font-semibold">Trip Members</CardTitle>
          {isOrganizer && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Someone to Trip</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4">
                  {inviteError && (
                    <div className="p-3 text-sm bg-blue-50 text-blue-800 rounded-lg">
                      {inviteError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="friend@example.com"
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
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteLoading}>
                      {inviteLoading ? 'Sending...' : 'Send Invitation'}
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
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No members yet</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getInitials(getDisplayName(member))}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getDisplayName(member)}
                      {member.user_id === currentUserId && (
                        <span className="text-gray-500 ml-1">(You)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={getRoleBadgeColor(member.role)}>
                        {member.role}
                      </Badge>
                      <span className="text-xs text-gray-500">{member.email}</span>
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

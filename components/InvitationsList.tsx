'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Check, X } from 'lucide-react';
import type { Database } from '@/lib/supabase/types';
import { toast } from '@/hooks/use-toast';

interface Invitation {
  id: string;
  trip_id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  trip_title?: string;
  trip_destination?: string;
}

export function InvitationsList() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Normalize email to lowercase to avoid case-sensitive mismatches
      const normalizedEmail = user.email.toLowerCase();
      setCurrentUserEmail(normalizedEmail);

      // Get all pending invitations for this user's email
      const { data: invitationsData, error } = await supabase
        .from('trip_invitations')
        .select('id, trip_id, email, status, created_at')
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get trip details for each invitation
      if (invitationsData && invitationsData.length > 0) {
        const invitationsWithTrips = await Promise.all(
          invitationsData.map(async (inv) => {
            const { data: tripData } = await supabase
              .from('trips')
              .select('title, destination')
              .eq('id', (inv as Database['public']['Tables']['trip_invitations']['Row']).trip_id)
              .single();

            return {
              ...(inv as any),
              trip_title: (tripData as any)?.title,
              trip_destination: (tripData as any)?.destination,
            } as Invitation;
          })
        );

        setInvitations(invitationsWithTrips);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast({ variant: 'destructive', title: 'Failed to load invitations' });
    } finally {
      setLoading(false);
      try { window.dispatchEvent(new CustomEvent('dashboard-section-loaded', { detail: 'invitations' })); } catch {}
    }
  };

  const handleAccept = async (invitation: Invitation) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', invitation.trip_id)
        .eq('user_id', user.id)
        .maybeSingle();

      // Add user to trip_members only if not already a member
      if (!existingMember) {
        const { error: memberError } = await supabase
          .from('trip_members')
          .insert({
            trip_id: invitation.trip_id,
            user_id: user.id,
            role: 'participant',
          } as any);

        if (memberError) {
          // If it's a duplicate key error, continue anyway (user is already a member)
          if ((memberError as any).code !== '23505') {
            throw memberError;
          }
        }
      }

      // Update invitation status
      const { error: inviteError } = await supabase
        .from('trip_invitations')
        // @ts-expect-error - Supabase type issue
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (inviteError) {
        // If another invitation for same (trip_id, email) is already accepted
        // the unique constraint on (trip_id, email, status) triggers 23505.
        // In that case, we can just delete this pending one and proceed.
        if ((inviteError as any).code === '23505') {
          await supabase
            .from('trip_invitations')
            .delete()
            .eq('id', invitation.id);
        } else {
          throw inviteError;
        }
      }

      // Remove from list
      setInvitations(invitations.filter((inv) => inv.id !== invitation.id));

      // Redirect to the trip page
      router.push(`/trip/${invitation.trip_id}`);
      router.refresh();
      toast({ title: 'Invitation accepted', description: 'You joined the trip.' });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      const message = error?.message || JSON.stringify(error);
      toast({ variant: 'destructive', title: 'Failed to accept invitation', description: message });
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('trip_invitations')
        // @ts-expect-error - Supabase type issue
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      setInvitations(invitations.filter((inv) => inv.id !== invitationId));
      toast({ title: 'Invitation declined' });
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast({ variant: 'destructive', title: 'Failed to decline invitation' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Trip Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show card if no invitations
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Trip Invitations
          <Badge variant="secondary" className="ml-auto">
            {invitations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="bg-white p-4 rounded-lg border border-blue-200 space-y-3"
          >
            <div>
              <h3 className="font-semibold text-gray-900">
                {invitation.trip_title || 'Untitled Trip'}
              </h3>
              {invitation.trip_destination && (
                <p className="text-sm text-gray-600">{invitation.trip_destination}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAccept(invitation)}
                className="flex-1 gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(invitation.id)}
                className="flex-1 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

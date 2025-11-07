export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          destination: string | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          destination?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          destination?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
        };
      };
      trip_members: {
        Row: {
          trip_id: string;
          user_id: string;
          role: 'organizer' | 'participant';
        };
        Insert: {
          trip_id: string;
          user_id: string;
          role?: 'organizer' | 'participant';
        };
        Update: {
          trip_id?: string;
          user_id?: string;
          role?: 'organizer' | 'participant';
        };
      };
      days: {
        Row: {
          id: string;
          trip_id: string;
          day_index: number;
          date: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          day_index: number;
          date?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          day_index?: number;
          date?: string | null;
        };
      };
      activities: {
        Row: {
          id: string;
          day_id: string;
          title: string;
          starts_at: string | null;
          ends_at: string | null;
          location: string | null;
        };
        Insert: {
          id?: string;
          day_id: string;
          title: string;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
        };
        Update: {
          id?: string;
          day_id?: string;
          title?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          trip_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          author_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      polls: {
        Row: {
          id: string;
          trip_id: string;
          question: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          question: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          question?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          label: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          label?: string;
        };
      };
      poll_votes: {
        Row: {
          poll_id: string;
          option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          poll_id: string;
          option_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          poll_id?: string;
          option_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      trip_invitations: {
        Row: {
          id: string;
          trip_id: string;
          email: string;
          invited_by: string;
          status: 'pending' | 'accepted' | 'declined';
          token: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          email: string;
          invited_by: string;
          status?: 'pending' | 'accepted' | 'declined';
          token?: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          email?: string;
          invited_by?: string;
          status?: 'pending' | 'accepted' | 'declined';
          token?: string;
          created_at?: string;
          expires_at?: string;
        };
      };
    };
  };
};

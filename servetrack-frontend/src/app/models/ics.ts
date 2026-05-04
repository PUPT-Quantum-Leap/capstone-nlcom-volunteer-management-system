export interface Ics {
  readonly id: number;
  readonly rsvp_id: number;
  readonly rsvp: {
    readonly id: number;
    readonly title: string;
    readonly date: string;
  } | null;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  status: 'draft' | 'active' | 'completed';
  ai_suggestions: AiSuggestion[] | null;
  teams: Team[] | null;
  volunteers: IcsVolunteer[] | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Team {
  id: number;
  name: string;
}

export interface IcsVolunteer {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  team_id: number | null;
  role: string | null;
  assigned_at: string | null;
  skills: string[] | null;
  isNew: boolean;
  isDriver: boolean;
  isLeader: boolean;
}

export interface AiSuggestion {
  readonly volunteer_id: number;
  readonly volunteer_name: string;
  readonly team_id: number;
  readonly team_name: string;
  readonly role: string;
  readonly skills: string[];
  readonly confidence: number;
}

export interface CreateIcsRequest {
  rsvp_id: number;
  name: string;
  description?: string;
  location?: string;
  status?: 'draft' | 'active' | 'completed';
  team_ids?: number[];
}

export interface UpdateIcsRequest {
  name?: string;
  description?: string;
  location?: string;
  status?: 'draft' | 'active' | 'completed';
  team_ids?: number[];
  ai_suggestions?: AiSuggestion[];
}

export interface AssignVolunteerRequest {
  volunteer_id: number;
  team_id?: number;
  role?: string;
}

export interface RsvpVolunteer {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string | null;
  skills: { id: number; name: string }[] | null;
  positions: { id: number; name: string }[] | null;
  experiences: { id: number; name: string }[] | null;
}

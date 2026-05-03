export interface Ics {
  readonly id: number;
  readonly rsvp_id: number;
  readonly rsvp?: {
    readonly id: number;
    readonly title: string;
    readonly date: string;
  };
  name: string;
  description?: string;
  date: string;
  location?: string;
  status: 'draft' | 'active' | 'completed';
  ai_suggestions?: AiSuggestion[];
  teams?: Team[];
  volunteers?: IcsVolunteer[];
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface Team {
  id: number;
  name: string;
}

export interface IcsVolunteer {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  team_id?: number;
  role?: string;
  assigned_at?: string;
  skills?: string[];
  isNew?: boolean;
  isDriver?: boolean;
  isLeader?: boolean;
}

export interface AiSuggestion {
  volunteer_id: number;
  volunteer_name: string;
  team_id: number;
  team_name: string;
  role: string;
  skills: string[];
  confidence: number;
}

export interface AiSuggestionsResponse {
  message: string;
  total_volunteers: number;
  assignments: AiSuggestion[];
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
  full_name?: string;
  skills?: { id: number; name: string }[];
  positions?: { id: number; name: string }[];
  experiences?: { id: number; name: string }[];
}

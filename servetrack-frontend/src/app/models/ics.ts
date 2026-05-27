export interface AiSuggestion {
  volunteer_id: number;
  volunteer_name: string;
  team_id: number;
  team_name: string;
  role: string;
  skills: string[];
  confidence: number;
  reasoning?: string | null;
}

export interface AiSuggestionsResponse {
  data: AiSuggestion[];
  meta: {
    message: string | null;
    total_volunteers: number;
  };
}

export interface IcsTeamSummary {
  id: number;
  name: string;
}

export interface IcsRecord {
  id: number;
  rsvp_id: number;
  rsvp?: { id: number; title: string; date: string } | null;
  name: string;
  description?: string | null;
  date: string;
  location?: string | null;
  status: 'draft' | 'active' | 'completed';
  ai_suggestions?: AiSuggestion[] | null;
  teams?: IcsTeamSummary[] | null;
  volunteers?: unknown[] | null;
  created_at: string;
  updated_at: string;
}

/** Alias used by ics.service.ts */
export type Ics = IcsRecord;

export interface IcsResourceResponse {
  data: IcsRecord;
}

export interface ApplySuggestionPayload {
  volunteer_id: number;
  team_id: number;
  role?: string;
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
}

export interface AssignVolunteerRequest {
  volunteer_id: number;
  team_id: number;
  role?: string;
}

export interface RsvpVolunteer {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  skills: string[];
  positions: string[];
  experiences: string[];
  trainings: string[];
}

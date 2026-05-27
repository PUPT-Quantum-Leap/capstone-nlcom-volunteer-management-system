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
  name: string;
  description?: string | null;
  date: string;
  location?: string | null;
  status: 'draft' | 'active' | 'completed';
  ai_suggestions?: AiSuggestion[] | null;
  teams?: IcsTeamSummary[];
  created_at: string;
  updated_at: string;
}

export interface IcsResourceResponse {
  data: IcsRecord;
}

export interface ApplySuggestionPayload {
  volunteer_id: number;
  team_id: number;
  role?: string;
}

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

export interface AiCandidate {
  volunteer_id: number;
  name: string;
  role: string;
  confidence: number;
  skills: string[];
  reasoning?: string | null;
}

export interface IcsCommandRole {
  key: string;
  title: string;
  assigned_name: string | null;
  volunteer_id: number | null;
}

export interface IcsAssignedVolunteer {
  id: number;
  name: string;
  role: string | null;
  is_driver: boolean;
  is_leader: boolean;
  skills: string[];
}

export interface IcsDashboardTeam {
  id: number;
  key: string;
  name: string;
  branch_key: string;
  vehicle: string | null;
  assigned_volunteers: IcsAssignedVolunteer[];
  ai_suggestion: {
    rationale: string[];
    candidates: AiCandidate[];
  };
}

export interface IcsDashboardBranch {
  key: string;
  title: string;
  teams: IcsDashboardTeam[];
}

export interface IcsVehicleAssignment {
  team_key: string;
  team_name: string;
  vehicle: string;
}

export interface IcsDashboard {
  ics_id: number;
  metadata: IcsMetadata;
  rsvp: {
    id: number;
    title: string;
    date: string;
    location: string | null;
  };
  command_roles: IcsCommandRole[];
  branches: IcsDashboardBranch[];
  vehicles: IcsVehicleAssignment[];
}

export interface IcsMetadata {
  objective: number | null;
  menu: string | null;
  meal_breakfast: number;
  meal_lunch: number;
  meal_snacks: number;
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

export interface MoveVolunteerRequest {
  volunteer_id: number;
  from_team_id: number;
  to_team_id: number;
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
  is_driver?: boolean;
  is_leader?: boolean;
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

/**
 * Represents a node in the org chart hierarchy
 * Used for Responsible Official, Incident Commander, Section Chiefs, and Branch Directors
 */
export interface CommandRoleNode {
  role: string; // "Responsible Official", "Incident Commander", etc.
  name: string; // Editable name of the person in this role
  level?: number; // Optional: hierarchy level (1-4)
}

/**
 * Represents a volunteer assigned to a team with assignment metadata
 */
export interface AssignedVolunteer {
  id: number; // volunteer_id from backend
  name: string;
  team_id: number;
  role: string; // e.g., "Team Member", "Team Leader"
  skills: string[];
  isNew?: boolean; // Display flag: new volunteer
  isDriver?: boolean; // Display flag: assigned driver
  isLeader?: boolean; // Display flag: team leader
  rationale?: string; // AI reasoning for assignment
  alternatives?: string[]; // Alternative volunteer suggestions
}

/**
 * Represents a team with assigned volunteers and AI suggestions
 */
export interface TeamCard {
  id: number;
  name: string;
  volunteers: AssignedVolunteer[];
  aiSuggestions?: AiSuggestion[]; // AI-generated suggestions for this team from backend
}

/**
 * Represents an operational branch (column) containing teams and a branch director
 * Examples: Mobile Kitchen, AM Distribution, PM Distribution
 */
export interface BranchColumn {
  title: string; // Display title
  leader: string; // Branch Director name
  label: string; // Unique identifier: "mobileKitchen", "amDistribution", "pmDistribution"
  teams: TeamCard[];
}

/**
 * Complete ICS data model combining org chart, operational structure, and assignments
 * This is the shape that components receive after backend data is loaded
 */
export interface IcsDataModel {
  id: number;
  rsvp_id: number;
  // Org chart hierarchy (4 levels)
  responsibleOfficial: CommandRoleNode;
  incidentCommander: CommandRoleNode;
  sectionChiefs: CommandRoleNode[]; // Planning, Purchasing, MWC Coordinator, Safety & Emergency
  // Operational columns with teams
  branches: BranchColumn[];
  // Meal breakdown statistics
  mealBreakdown: {
    breakfast: number;
    lunch: number;
    snacks: number;
  };
  // Vehicle assignments
  vehicles: {
    code: string;
    vehicle: string;
  }[];
}

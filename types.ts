export type TournamentFormat = 'single_elim' | 'double_elim' | 'round_robin' | 'swiss';
export type MatchStatus = 'pending' | 'grabbed' | 'in_progress' | 'logged' | 'submitted';
export type TournamentStatus = 'active' | 'completed';

export interface Player {
  id: string;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  region: string;
  club: string;
  ranking_points: number;
  email?: string;
  has_password?: boolean;
  startgg_user_id?: string;
  team_id?: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  is_custom: boolean;
  created_at: string;
}

export interface Permissions {
  can_view_rankings: boolean;
  can_view_profiles: boolean;
  can_edit_own_profile: boolean;
  can_grab_matches: boolean;
  can_score_matches: boolean;
  can_submit_matches: boolean;
  can_create_tournaments: boolean;
  can_complete_tournaments: boolean;
  can_manage_refs: boolean;
  can_manage_players: boolean;
  can_manage_roles: boolean;
  can_access_admin_panel: boolean;
  can_view_bracket: boolean;
  can_view_meta: boolean;
  can_manage_own_parts: boolean;
  can_manage_own_decks: boolean;
  can_register_for_tournaments: boolean;
  can_declare_deck: boolean;
  can_manage_courts: boolean;
  can_approve_registrations: boolean;
  can_approve_decks: boolean;
  can_edit_points_scale: boolean;
}

export interface UserRole {
  id: string;
  player_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
}

export type StageType = 'single' | 'two_stage';

export interface Tournament {
  id: string;
  name: string;
  stage_type: StageType;
  stage1_format: TournamentFormat;
  stage2_format: TournamentFormat | null;
  stage1_fixed_decks: boolean;
  stage2_fixed_decks: boolean;
  /** held_at is the real DB column name for the event date */
  held_at: string;
  is_ranking_tournament: boolean;
  status: TournamentStatus;
  fixed_decks: boolean;
  format?: TournamentFormat;
  location?: string;
  description?: string;
  discord_webhook_url?: string;
  organiser_id?: string;
  top_cut_size?: number;
  /** Legacy column name, now stores start.gg slug or url */
  evaroon_id?: string;
  bracket_data?: any;
  created_at: string;
}

export interface Bracket {
  id: string;
  tournament_id: string;
  data: any;
  created_at: string;
  updated_at: string;
}

// matches row — player info lives in match_players, not here
export interface Match {
  id: string;
  tournament_id: string;
  status: MatchStatus;
  /** ref_id is the real DB column (not referee_id) */
  ref_id?: string;
  court_id?: string;
  stage?: string;
  /** Legacy column name, now stores start.gg match id */
  evaroon_match_id?: string;
  played_at?: string;
  notes?: string;
  created_at: string;
}

// One row per player per match
export interface MatchPlayer {
  id: string;
  match_id: string;
  player_id: string;
  sets_won: number;
  total_points: number;
  winner: boolean;
}

// Individual finish event logged by the scorer (replaces MatchLog)
export interface FinishEvent {
  id: string;
  match_id: string;
  scorer_player_id: string;
  finish_type: 'EXT' | 'OVR' | 'BUR' | 'SPN' | 'WRN' | 'PEN';
  points: number;
  set_number: number;
  bey_id?: string;
  created_at: string;
}

/** @deprecated Use FinishEvent — match_logs does not exist in the DB */
export type MatchLog = FinishEvent;

export interface Referee {
  id: string;
  player_id: string;
  auth_user_id: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  player_id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface Part {
  id: string;
  player_id: string;
  name: string;
  type: 'blade' | 'ratchet' | 'bit';
  created_at: string;
}

export interface Beyblade {
  id: string;
  player_id: string;
  name: string;
  blade_id: string;
  ratchet_id: string;
  bit_id: string;
  created_at: string;
  blade?: Part;
  ratchet?: Part;
  bit?: Part;
}

export interface Deck {
  id: string;
  player_id: string;
  name: string;
  bey1_id: string;
  bey2_id: string;
  bey3_id: string;
  created_at: string;
  bey1?: Beyblade;
  bey2?: Beyblade;
  bey3?: Beyblade;
}

export interface TournamentDeck {
  id: string;
  tournament_id: string;
  player_id: string;
  deck_id: string;
  is_fixed: boolean;
  status: 'pending' | 'approved' | 'flagged';
  declared_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface TournamentEntrant {
  id: string;
  tournament_id: string;
  player_id: string;
  seed?: number;
  placement?: number;
  points_awarded?: number;
  startgg_entrant_id?: string;
}

export interface AccountClaim {
  id: string;
  auth_user_id: string;
  player_id: string;
  status: 'pending' | 'approved' | 'denied';
  discord_username: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  player?: Player;
}

export interface Court {
  id: string;
  tournament_id: string;
  name: string;
  current_match_id?: string;
  created_at: string;
}

export interface PlacementPoint {
  id: string;
  tournament_size_min: number;
  tournament_size_max: number;
  placement: number;
  points: number;
}

export interface PointsScale {
  id: string;
  placement: string;
  points: number;
  updated_at: string;
}

export interface PlayerStats {
  id: string;
  player_id: string;
  matches_played: number;
  matches_won: number;
  win_rate: number;
  ext_count: number;
  ovr_count: number;
  bur_count: number;
  spn_count: number;
  wrn_count: number;
  pen_count: number;
  tournaments_entered: number;
  best_placement?: number;
  updated_at: string;
}

export type SimulationAreaType = "parlimen" | "dun";
export type SimulationScopeArea = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

export type GainLossParam = { group: string; pct: number };
export type TransferParam = { from: string; to: string; pct: number };
export type GroupingParam = { label: string; members: string[] };

export type PartyRow = {
  group: string;
  party: string;
  vote_won: number;
  majority?: number;
  verdict?: string;
  gainloss_pct?: number;
  sim_vote_won?: number;
  sim_vote_diff?: number;
  sim_transfer_in?: number;
  sim_transfer_out?: number;
  simulation_party?: string;
  historical_party?: string;
  display_party?: string;
  has_party_override?: boolean;
  group_logo?: string;
};

export type VerdictSide = {
  group: string;
  party: string;
  vote_won: number;
  majority?: number;
  historical_party?: string;
  display_party?: string;
  has_party_override?: boolean;
  group_logo?: string;
};

export type SimulationSeat = {
  parliament_code: string;
  parliament_name: string;
  election_type: string;
  election_year: string;
  election_state: string;
  total_electorate: number;
  total_ballots: number;
  tov: number;
  election_verdict: {
    menang: VerdictSide | Record<string, never>;
    kalah: VerdictSide[];
  };
  parties: PartyRow[];
  simulation?: {
    total_votes: number;
    vote_change: number;
    tov: number;
    menang: VerdictSide | Record<string, never>;
    kalah: VerdictSide[];
  };
  simulation_grouped?: {
    groups: Array<{ label: string; members: string[]; votes: number }>;
    menang: {
      label: string;
      votes: number;
      members: string[];
      majority: number;
    } | Record<string, never>;
    kalah: Array<{
      label: string;
      votes: number;
      members: string[];
    }>;
  };
  simulation_source?: string;
  individual_sim_name?: string;
};

export type SimulationChart = {
  labels: string[];
  values: number[];
  colors: string[];
};

export type SimulationMeta = {
  government_parties?: string[];
  all_parties?: string[];
  transfer_parties?: string[];
  total_selected_parliament?: number;
  simulation_mode?: string;
  gainloss?: Record<string, number>;
  transfer?: TransferParam[];
  individual_overrides_applied?: string[];
};

export type BatchSimulationResult = {
  meta: SimulationMeta;
  parliament: SimulationSeat[];
  chart: SimulationChart;
  summary?: {
    asal: SimulationChart;
    simulasi: SimulationChart;
  };
};

export type CandidateRow = {
  parliament_code: string;
  parliament_name: string;
  dun_name?: string;
  map_code: string;
  dun_code: string;
  candidate_election: string;
  candidate_year: number;
  candidate_state: string;
  candidate_group: string;
  candidate_party: string;
  candidate_verdict: string;
  candidate_vote_won: number;
  candidate_majority_won: number;
  total_electorate: number;
  total_ballots: number;
  total_unreturned: number;
  total_rejected: number;
};

export type PartyChangeRow = {
  candidate_id: number;
  candidate_group: string;
  historical_party: string;
  simulation_party: string;
};

export type PartyChangeByGroup = Record<
  string,
  {
    simulation_party: string;
    historical_party: string;
    display_party: string;
    has_party_override: boolean;
  }
>;

export type SeatSimulationParams = {
  gainlossMap: Record<string, number>;
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  fromIndividual: boolean;
  simName: string;
};

export type PartyConfigEntry = {
  party_name: string;
  party_gov: boolean;
  party_gov_dun: boolean;
  party_color: string;
  effective_gov: boolean;
  overridden: boolean;
};

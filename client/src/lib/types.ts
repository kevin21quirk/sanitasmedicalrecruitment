export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  initials: string;
  color: string;
}

export interface Candidate {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  nmc_pin: string | null;
  address: string | null;
  town: string | null;
  postcode: string | null;
  status: 'compliant' | 'on_assignment' | 'in_progress' | 'dormant' | 'do_not_use';
  compliance_score: number;
  pay_min: string | null;
  pay_max: string | null;
  preferred_shift: string | null;
  employment_pref: string | null;
  travel_miles: number | null;
  has_transport: boolean;
  source: string | null;
  rating: string | null;
  tags: string[];
  owner_id: number | null;
  owner_name?: string;
  owner_initials?: string;
  owner_color?: string;
  notes: string | null;
  registered_at: string;
  last_worked_at: string | null;
  docs_attention?: number;
  created_at: string;
}

export interface ComplianceDoc {
  id: number;
  candidate_id: number;
  type: string;
  reference_no: string | null;
  status: 'valid' | 'expiring' | 'expired' | 'pending' | 'missing';
  issue_date: string | null;
  expiry_date: string | null;
  verified_by: number | null;
  verified_by_name?: string;
  notes: string | null;
  candidate_name?: string;
  candidate_role?: string;
  candidate_status?: string;
}

export interface Client {
  id: number;
  name: string;
  group_name: string | null;
  type: string;
  address: string | null;
  town: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  beds: number | null;
  cqc_rating: string | null;
  status: 'active' | 'prospect' | 'inactive';
  payment_terms: number;
  account_manager_id: number | null;
  am_name?: string;
  am_initials?: string;
  am_color?: string;
  notes: string | null;
  open_vacancies?: number;
  active_workers?: number;
  contact_count?: number;
  created_at: string;
}

export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export type VacancyStage = 'open' | 'sourcing' | 'shortlisted' | 'interview' | 'offer' | 'filled' | 'on_hold' | 'lost';

export interface Vacancy {
  id: number;
  client_id: number;
  client_name?: string;
  client_town?: string;
  cqc_rating?: string;
  title: string;
  role: string;
  employment_type: string;
  shift_pattern: string | null;
  hours_per_week: number | null;
  pay_rate: string | null;
  charge_rate: string | null;
  stage: VacancyStage;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  openings: number;
  start_date: string | null;
  posted_at: string;
  closes_at: string | null;
  filled_at: string | null;
  description: string | null;
  requirements: string[];
  owner_id: number | null;
  owner_name?: string;
  owner_initials?: string;
  owner_color?: string;
  submissions?: number;
}

export type PlacementStage = 'submitted' | 'screening' | 'compliance_check' | 'interview' | 'offer' | 'placed' | 'active' | 'ended' | 'rejected';

export interface Placement {
  id: number;
  vacancy_id: number | null;
  vacancy_title?: string;
  candidate_id: number;
  candidate_name?: string;
  candidate_role?: string;
  client_id: number;
  client_name?: string;
  stage: PlacementStage;
  pay_rate: string | null;
  charge_rate: string | null;
  submitted_at: string;
  placed_at: string | null;
  start_date: string | null;
  end_date: string | null;
  end_reason: string | null;
  owner_id: number | null;
  owner_name?: string;
  owner_initials?: string;
  owner_color?: string;
  notes: string | null;
}

export interface Shift {
  id: number;
  placement_id: number | null;
  candidate_id: number;
  candidate_name?: string;
  candidate_role?: string;
  client_id: number;
  client_name?: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  hours: string;
  shift_type: 'day' | 'night' | 'early' | 'late' | 'long_day';
  pay_rate: string | null;
  charge_rate: string | null;
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  timesheet_status: 'not_submitted' | 'submitted' | 'approved' | 'paid';
  pay_amount?: string;
  charge_amount?: string;
}

export interface Activity {
  id: number;
  entity_type: 'candidate' | 'client' | 'vacancy' | 'placement';
  entity_id: number;
  entity_name?: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'sms' | 'status_change';
  subject: string | null;
  body: string | null;
  direction: 'inbound' | 'outbound' | null;
  user_id: number | null;
  user_name?: string;
  initials?: string;
  color?: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number | null;
  user_name?: string;
  initials?: string;
  color?: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'done';
  entity_type: string | null;
  entity_id: number | null;
  entity_name?: string;
  created_at: string;
}

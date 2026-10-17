export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  initials: string;
  color: string;
  photo_file_id?: number | null;
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
  suspended: boolean;
  compliance_score: number;
  pay_min: string | null;
  pay_max: string | null;
  preferred_shift: string | null;
  employment_pref: string | null;
  engagement_type: 'paye' | 'ltd';
  payroll_ref: string | null;
  travel_miles: number | null;
  has_transport: boolean;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  rtw_status: string | null;
  rtw_expiry: string | null;
  driving: string | null;
  uniform_size: string | null;
  willing_client_ids: number[];
  custom_fields: Record<string, string>;
  first_choice_since: string | null;
  source: string | null;
  rating: string | null;
  tags: string[];
  owner_id: number | null;
  owner_name?: string;
  owner_initials?: string;
  owner_color?: string;
  owner_photo_file_id?: number | null;
  photo_file_id?: number | null;
  notes: string | null;
  registered_at: string;
  last_worked_at: string | null;
  docs_attention?: number;
  created_at: string;
}

export interface OhRecord {
  id: number;
  candidate_id: number;
  kind: 'immunisation' | 'screening' | 'clearance' | 'fitness';
  name: string;
  record_date: string | null;
  expiry_date: string | null;
  result: string | null;
  notes: string | null;
}

export interface RegisterCheck {
  id: number;
  candidate_id: number;
  register: 'dbs_update_service' | 'nmc';
  identifier: string | null;
  checked_at: string;
  result: 'clear' | 'not_found' | 'lapsed' | 'error';
  checked_by_name?: string | null;
  notes: string | null;
}

export interface CandidateBlock {
  id: number;
  candidate_id: number;
  client_id: number | null;
  individual_id: number | null;
  client_name?: string | null;
  individual_name?: string | null;
  reason: string | null;
  created_at: string;
}

export interface Individual {
  id: number;
  client_id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
}

export interface ClientRequirement {
  id: number;
  client_id: number;
  doc_type: string;
  required: boolean;
}

export interface Availability {
  id: number;
  candidate_id: number;
  candidate_name?: string;
  date: string;
  shift_type: 'any' | 'day' | 'night' | 'early' | 'late' | 'long_day';
  status: 'available' | 'unavailable';
  source: 'worker' | 'office';
  notes: string | null;
}

export interface ShiftRequest {
  id: number;
  client_id: number;
  client_name?: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  hours: string | null;
  shift_type: string;
  role: string | null;
  qty: number;
  individual_id: number | null;
  individual_name?: string | null;
  status: 'pending' | 'filled' | 'cancelled';
  urgency: 'normal' | 'urgent';
  source: string;
  notes: string | null;
  offers?: Offer[];
  filled_count?: number;
  filled_by?: string | null;
  pending_offers?: number;
}

export interface Offer {
  id: number;
  request_id: number | null;
  shift_id: number | null;
  candidate_id: number;
  candidate_name?: string;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
  sent_at: string;
  responded_at: string | null;
  request_date?: string;
  client_name?: string;
  start_time?: string | null;
  end_time?: string | null;
  shift_type?: string;
  individual_name?: string | null;
  decline_reason?: string | null;
}

export interface Message {
  id: number;
  direction: string;
  channel: 'email' | 'whatsapp' | 'system';
  to_name: string | null;
  to_contact: string | null;
  subject: string | null;
  body: string;
  status: 'queued' | 'sent' | 'logged' | 'failed';
  entity_type: string | null;
  entity_id: number | null;
  created_by_name?: string | null;
  sent_at: string | null;
  created_at: string;
  wa_link?: string | null;
  mailto_link?: string | null;
}

export interface Invoice {
  id: number;
  client_id: number;
  client_name?: string;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  issue_date: string;
  due_date: string | null;
  subtotal: string;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  lines?: InvoiceLine[];
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  shift_id: number | null;
  description: string | null;
  hours: string | null;
  rate: string | null;
  amount: string;
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
  file_id: number | null;
  file_name?: string | null;
  dbs_update_service: boolean;
  last_checked_at: string | null;
  check_result: string | null;
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
  logo_file_id?: number | null;
  notes: string | null;
  standing_instructions: string | null;
  share_profile_fields: Record<string, boolean> | null;
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
  is_signatory: boolean;
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
  timesheet_status: 'not_submitted' | 'submitted' | 'approved' | 'paid' | 'queried';
  pay_amount?: string;
  charge_amount?: string;
  request_id: number | null;
  individual_id: number | null;
  individual_name?: string | null;
  allocated_by: number | null;
  worker_confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  actual_start: string | null;
  actual_end: string | null;
  actual_hours: string | null;
  signatory_notes: string | null;
  worker_sig_name: string | null;
  worker_sig_at: string | null;
  client_sig_name: string | null;
  client_sig_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  timesheet_locked: boolean;
  invoice_id: number | null;
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

export interface CvMatchItem {
  item: string;
  evidence?: string;
  importance?: 'essential' | 'desirable';
  note?: string;
}

export interface CvMatch {
  id: number;
  vacancy_id: number;
  candidate_id: number | null;
  filename: string | null;
  candidate_name: string | null;
  score: number;
  verdict: 'strong' | 'good' | 'partial' | 'weak';
  matched: CvMatchItem[];
  missing: CvMatchItem[];
  summary: string;
  engine: 'claude' | 'heuristic';
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

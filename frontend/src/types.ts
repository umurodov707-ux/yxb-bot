export type UserRole = 'admin' | 'user';
export type RegStatus = 'pending' | 'approved' | 'rejected';
export type RecordType = 'spravka' | 'document' | 'message' | 'urgent' | 'broadcast';
export type RecordStatus = 'sent' | 'seen_by_admin';

export interface Department {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  parent_id: number | null;
  read_only_broadcast: boolean;
  children?: Department[];
}

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  full_name: string;
  position: string;
  phone: string | null;
  role: UserRole;
  reg_status: RegStatus;
  department_id: number | null;
  department_name: string | null;
  is_blocked: boolean;
  is_dept_head?: boolean;
  created_at: string;
}

export interface AttachedFile {
  id: number;
  original_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  tg_file_id: string | null;
  local_path?: string | null;
  url?: string | null;
  download_url?: string | null;
}

export interface FeedRecord {
  id: number;
  title: string;
  body: string | null;
  record_type: RecordType;
  status: RecordStatus;
  department_id: number;
  department_name: string | null;
  source_department_id?: number | null;
  source_department_name?: string | null;
  is_reply?: boolean;
  author_id: number | null;
  author_name: string | null;
  broadcast_to: number[] | null;
  record_date: string;
  created_at: string;
  files: AttachedFile[];
}

export interface RegistrationRequest {
  id: number;
  telegram_id: number;
  username: string | null;
  full_name: string;
  position: string;
  phone: string | null;
  department_id: number | null;
  department_name: string | null;
  status: RegStatus;
  created_at: string;
}

export interface SvodkaRow {
  department_id: number;
  department_name: string;
  has_submitted: boolean;
  record_count: number;
  last_at: string | null;
}

export interface SvodkaResponse {
  date_from: string;
  date_to: string;
  rows: SvodkaRow[];
  total: number;
  submitted: number;
  pending: number;
}

export interface DeptSummary {
  department_id: number;
  name: string;
  code: string;
  parent_id: number | null;
  sort_order: number;
  read_only: boolean;
  total: number;
  today: number;
  unread: number;
  last_title: string | null;
  last_author: string | null;
  last_type: RecordType | null;
  last_has_files: boolean;
  last_at: string | null;
}

export interface UnitRow {
  department_id: number;
  name: string;
  code: string;
  parent_id: number | null;
  total: number;
  today_in: number;
  unread: number;
  last_title: string | null;
  last_author: string | null;
  last_at: string | null;
  last_has_files: boolean;
  last_is_reply: boolean;
}

export type TaskStatus = 'pending' | 'submitted' | 'accepted' | 'returned';

export interface TaskListItem {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  deadline: string | null;
  has_files: boolean;
  // admin
  total?: number;
  accepted?: number;
  submitted?: number;
  returned?: number;
  pending?: number;
  overdue?: number | boolean;
  // bo'linma
  status?: TaskStatus;
  review_note?: string | null;
}

export interface AssignmentRow {
  unit_id: number;
  unit_name: string | null;
  unit_code: string | null;
  status: TaskStatus;
  overdue: boolean;
  report_text: string | null;
  report: FeedRecord | null;
  submitted_by: string | null;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
}

export interface TaskCounts { total: number; accepted: number; submitted: number; returned: number; pending: number; overdue: number }

export interface TaskDetail {
  task: FeedRecord;
  deadline: string | null;
  counts?: TaskCounts;
  assignments?: AssignmentRow[];
  mine?: AssignmentRow;
}

export interface TaskUnit { id: number; name: string; group: string }

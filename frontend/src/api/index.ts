import api from './client';
import type { Department, User, FeedRecord, RegistrationRequest, SvodkaResponse, RecordType, DeptSummary, UnitRow } from '../types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getMe = () => api.get<User>('/auth/me');

export const register = (data: {
  full_name: string;
  position: string;
  department_id: number;
  phone?: string;
}) => api.post<{ ok: boolean; msg: string }>('/auth/register', data);

// ── Departments ───────────────────────────────────────────────────────────────
export const getDeptTree = () => api.get<Department[]>('/departments/tree');
export const getDeptFlat = () => api.get<Department[]>('/departments/flat');

// ── Records ───────────────────────────────────────────────────────────────────
export interface RecordFilters {
  department_id?: number;
  record_type?: RecordType;
  date_from?: string;
  date_to?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  source_id?: number;
}

export const getRecords = (filters?: RecordFilters) =>
  api.get<FeedRecord[]>('/records', { params: filters });

export const getRecord = (id: number) => api.get< FeedRecord>(`/records/${id}`);

export const createRecord = (formData: FormData) =>
  api.post<FeedRecord>('/records', formData, { timeout: 180_000 });

export const broadcastRecord = (formData: FormData) =>
  api.post<FeedRecord[]>('/records/broadcast', formData, { timeout: 180_000 });

export const updateRecord = (id: number, data: Partial<Pick<FeedRecord, 'title' | 'body' | 'record_type'>>) =>
  api.patch< FeedRecord>(`/records/${id}`, data);

export const getDeptSummary = () => api.get<DeptSummary[]>('/records/summary');

export const markDeptSeen = (department_id: number, source_id?: number) =>
  api.post('/records/seen', { department_id, source_id });

export const getUnits = (department_id: number) =>
  api.get<UnitRow[]>('/records/units', { params: { department_id } });

export const remindUnits = (department_id: number, unit_ids: number[]) =>
  api.post<{ ok: boolean; msg: string }>('/records/remind', { department_id, unit_ids });

export const deleteRecord = (id: number) =>
  api.delete<{ ok: boolean; msg: string }>(`/records/${id}`);

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getPendingRequests = () =>
  api.get<RegistrationRequest[]>('/admin/requests');

export const reviewRequest = (data: {
  request_id: number;
  approve: boolean;
  rejection_reason?: string;
}) => api.post<{ ok: boolean; msg: string }>('/admin/requests/review', data);

export const getUsers = () => api.get<User[]>('/admin/users');

export const blockUser = (user_id: number, blocked: boolean) =>
  api.post(`/admin/users/${user_id}/block`, { blocked });

export const setDeptHead = (user_id: number, head: boolean) =>
  api.post<{ ok: boolean; msg: string }>(`/admin/users/${user_id}/head`, { head });

export const transferUser = (user_id: number, department_id: number) =>
  api.post(`/admin/users/${user_id}/transfer`, { department_id });

export const getSvodka = (params: {
  group: 'PC' | 'PMS';
  date_from?: string;
  date_to?: string;
}) => api.get<SvodkaResponse>('/admin/svodka', { params });

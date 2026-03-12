export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'volunteer';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

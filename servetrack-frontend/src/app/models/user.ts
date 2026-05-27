export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'coordinator' | 'volunteer';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface VolunteerUser {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  facebook_name: string | null;
  email: string;
  mobile_number: string;
  birthdate: string | null;
  address: string;
  educational_attainment: string;
  last_medical_examination: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
  positions?: string[];
}


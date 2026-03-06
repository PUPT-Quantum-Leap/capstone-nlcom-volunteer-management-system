export interface Position {
  position_id: number;
  name: string;
}

export interface VolunteerProfile {
  id: number;
  firstName: string;
  lastName: string;
  facebookName: string;
  email: string;
  mobileNumber: string;
  birthdate: string;
  lastMedicalExam: string;
  completeAddress: string;
  educationalAttainment: string;
  trainingExperience: string;
  skillsHobbies: string;
  classesTraining: string;
  volunteerPreference: string;
  otherPreference: string;
  photoUrl: string;
  /** Assigned team/positions from the backend */
  positions?: Position[];
}

/** Shape returned by GET /api/volunteer/profile */
export interface VolunteerProfileResponse {
  volunteer_id: number;
  first_name: string;
  last_name: string;
  facebook_name: string | null;
  email: string;
  mobile_number: string;
  birthdate: string;
  last_medical_examination: string;
  address: string;
  educational_attainment: string;
  /** Training experience from trainings table */
  training_experience: string;
  /** Skills and hobbies from skills table */
  skills_hobbies: string;
  /** Classes/training attended from trainings table */
  classes_training: string;
  positions: Position[];
  experiences?: Experience[];
  skills?: Skill[];
  trainings?: Training[];
  availabilities?: any[];
  lifegroups?: any[];
  emergency_contact?: any;
}

export interface Experience {
  experience_id: number;
  description: string;
}

export interface Skill {
  skill_id: number;
  name: string;
}

export interface Training {
  training_id: number;
  name: string;
}

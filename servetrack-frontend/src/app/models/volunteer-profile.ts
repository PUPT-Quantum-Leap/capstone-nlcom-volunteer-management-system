export type Position = {
  position_id: number;
  name: string;
};

export type VolunteerProfile = {
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
};

/** Shape returned by GET /api/volunteer/profile */
export type VolunteerProfileResponse = {
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
  positions: Position[];
};


export const MAJOR_SUBJECTS = [
  { id: 'medicine', name: 'Medicine' },
  { id: 'surgery', name: 'Surgery' },
  { id: 'obgyn', name: 'Obstetrics & Gynaecology' },
  { id: 'paediatrics', name: 'Paediatrics' },
];

export const SPECIALTY_SUBJECTS = [
  { id: 'orthopaedics', name: 'Orthopaedics' },
  { id: 'ophthalmology', name: 'Ophthalmology' },
  { id: 'ent', name: 'ENT' },
  { id: 'radiology', name: 'Radiology' },
  { id: 'dermatology', name: 'Dermatology' },
  { id: 'psychiatry', name: 'Psychiatry' },
  { id: 'anesthesiology', name: 'Anesthesiology' },
];

export const ALL_SUBJECTS = [...MAJOR_SUBJECTS, ...SPECIALTY_SUBJECTS];

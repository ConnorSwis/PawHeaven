export type Role = 'user' | 'staff' | 'admin';

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type PetStatus = 'Available' | 'Pending' | 'Adopted';

export type Pet = {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  daysInShelter: number;
  intakeDate: string;
  tags: string[];
  status: PetStatus;
  summary: string;
  imageUrl: string | null;
};

export type PetInput = Pick<Pet, 'name' | 'type' | 'breed' | 'age' | 'intakeDate' | 'tags' | 'status' | 'summary'>;

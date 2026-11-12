import type { UserRole } from '@/shared/types';

export interface User {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Settings {
  productionApprovalRequired: boolean;
}

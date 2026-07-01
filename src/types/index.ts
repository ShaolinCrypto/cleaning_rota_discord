export type AssignmentStatus = 'Assigned' | 'Accepted' | 'Complete' | 'Not Complete';

export interface Task {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  active: boolean;
}

export interface RotaUser {
  id: number;
  userId: string;
  addedAt: string;
}

export interface Assignment {
  id: number;
  weekDate: string;
  taskId: number;
  userId: string;
  status: AssignmentStatus;
  messageId: string | null;
  channelId: string | null;
  createdAt: string;
}

export interface AssignmentWithDetails extends Assignment {
  taskTitle: string;
  taskDescription: string;
}

export interface WeeklyAssignmentResult {
  assignments: AssignmentWithDetails[];
  warnings: string[];
}

export interface ReportRow {
  date: string;
  taskAssigned: string;
  userId: string;
  username: string;
  completionStatus: AssignmentStatus;
}

export interface AppConfig {
  discordToken: string;
  clientId: string;
  rotaChannelId: string;
  binChannelId: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSsl: boolean;
  premisesId?: string;
}

export type ButtonAction = 'accept' | 'complete' | 'not_complete';

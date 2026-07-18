export interface User {
  id: number;
  username: string;
  role: string;
}

export interface Member {
  MemberID: number;
  FullName: string;
  Phone: string;
  PlanName: string | null;
  EndDate: string | null;
  DaysLeft: number | null;
}

export interface MembershipPlan {
  PlanID: number;
  PlanName: string;
  Price: number;
  DurationDays: number;
}

export interface Payment {
  PaymentID: number;
  Amount: number;
  PaymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  PaymentDate: string;
  FullName: string | null;
  PlanName: string | null;
}

export interface DashboardStats {
  activeMembers: number;
  expiringSoon: number;
  monthlyRevenue: number;
  lifetimeRevenue: number;
  todayRevenue: number;
  paymentsCount: number;
  averageTicket: number;
  expiringList: Array<Pick<Member, 'MemberID' | 'FullName' | 'PlanName' | 'DaysLeft'>>;
  revenueHistory: Array<{ MonthKey: string; Total: number }>;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
  created_at: string;
}

export interface ExerciseMeta {
  total: number;
  categories: string[];
  equipment: string[];
  targets: string[];
  languages: string[];
}

export interface ExerciseResponse {
  items: Exercise[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface AiPlan {
  PlanID: number;
  PlanType: string;
  PlanContent: string;
  CreatedAt: string;
}

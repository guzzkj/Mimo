// Formato das respostas da API (espelha server/domain/*). Dinheiro em centavos.

export interface UsuarioApi {
  id: string;
  email: string;
  name: string;
  avatar: number;
  monthlyIncomeCents: number;
  plan: "solo" | "duo" | null;
  emailVerified: boolean;
  onboarded: boolean;
}

export interface MembroApi { userId: string; name: string; avatar: number; role: "owner" | "partner"; isMe: boolean }

export interface ContaApi {
  id: string;
  kind: "solo" | "duo";
  role: "owner" | "partner";
  closed: boolean;
  members: MembroApi[];
}

export interface ConviteRecebidoApi { id: string; accountId: string; inviterName: string; message: string | null; expiresAt: string }

export interface MeApi { user: UsuarioApi; accounts: ContaApi[]; pendingInvites: ConviteRecebidoApi[] }

export interface MovimentacaoApi {
  id: number;
  type: "income" | "expense";
  description: string;
  category: string;
  amountCents: number;
  occurredOn: string;
  status: "paid" | "pending";
  method: "account" | "card";
  groupId: number | null;
  installment: { number: number; total: number } | null;
  recurring: boolean;
  authorUserId: string | null;
  isPrivate: boolean;
  split: boolean;
  redacted: boolean;
}

export type MovimentacaoEntrada = Omit<MovimentacaoApi, "id" | "groupId" | "redacted">;

export interface AjustesApi {
  accountId: string;
  kind: "solo" | "duo";
  closed: boolean;
  spendingLimitCents: number;
  customCategories: { name: string; color: string }[];
  budgetsCents: Record<string, number>;
  card: { closingDay: number; dueDay: number };
  leisureMode: "together" | "half";
  leisurePending: boolean;
  alerts: { bills: boolean; billsDaysAhead: number; limit: boolean; limitThreshold: "80" | "100"; goals: boolean; email: boolean; partner: boolean };
  startHidden: boolean;
  me: { userId: string; name: string; email: string; avatar: number; monthlyIncomeCents: number };
  partner: { userId: string; name: string; avatar: number; monthlyIncomeCents: number } | null;
}

export interface MetaApi {
  id: string;
  name: string;
  icon: string;
  targetCents: number;
  deadlineMonth: string | null;
  archived: boolean;
  savedCents: number;
  items: { id: string; name: string; valueCents: number; priority: string | null }[];
  contributions: { id: string; userId: string | null; amountCents: number; contributedOn: string; note: string | null }[];
}

export interface AcertoApi { id: string; month: string; paidOn: string; fromUserId: string | null; toUserId: string | null; amountCents: number }

export interface ConviteApi { id: string; email: string; message: string | null; status: "pending" | "accepted" | "declined" | "revoked"; expired: boolean; expiresAt: string; lastSentAt: string }

export interface AvisoApi { id: string; accountId: string | null; kind: string; title: string; body: string; data: Record<string, unknown>; read: boolean; createdAt: string }

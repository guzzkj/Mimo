import { useSyncExternalStore } from "react";
import { api } from "./api";
import { CATS } from "./constants";
import { avisarFalha } from "./falhas";
import { MODO_API } from "./modo";
import { paraAjustes, separarPatchAjustes } from "./remoto/mapear";
import type { AjustesApi, UsuarioApi } from "./remoto/tipos";
import { contaDoTipo, definirSessao, lerSessao } from "./sessao";

// Ajustes de cada conta (perfil, renda, limite, categorias próprias, orçamentos,
// cartão, avisos e privacidade). É a fonte única que o painel, o topo, as
// Configurações e as notificações leem, para os números baterem.
// Backend real: vêm de /api/accounts/:id/settings (perfil em /api/me) e cada
// alteração é gravada lá. Protótipo (VITE_DATA_MODE=local): ficam no navegador.

export type ContaAjustes = "solo" | "duo";

export interface CategoriaPropria { nome: string; cor: string }

/** Quais avisos o sino gera (Configurações > Notificações). */
export interface PrefsAvisos {
  conta: boolean;
  /** Avisa contas que vencem em até N dias (e as atrasadas). */
  contaDias: number;
  limite: boolean;
  /** "80": aos 80% e aos 100%; "100": só ao estourar. */
  limiteQuando: "80" | "100";
  meta: boolean;
  email: boolean;
  parceira: boolean;
}

export interface Ajustes {
  nome: string;
  email: string;
  avatar: number;
  renda: number;
  limite: number;
  categorias: CategoriaPropria[];
  /** Orçamento mensal por categoria de saída. No Duo, o de Lazer é o limite de lazer do casal. */
  orcamentos: Record<string, number>;
  /** Dia de fechamento e de vencimento da fatura do cartão. */
  cartao: { fecha: number; vence: number };
  avisos: PrefsAvisos;
  /** Abre o painel com os valores ocultos. */
  abrirOculto: boolean;
  /** Conta Duo: renda da parceira (regra proporcional da divisão). */
  rendaParceira: number;
  /** Conta Duo: como o limite de lazer é controlado e se Suelen ainda precisa confirmar. */
  lazerModo: "juntos" | "metade";
  lazerPendente: boolean;
}

const AVISOS: PrefsAvisos = { conta: true, contaDias: 3, limite: true, limiteQuando: "80", meta: true, email: false, parceira: true };

const PADRAO: Record<ContaAjustes, Ajustes> = {
  solo: {
    nome: "Gustavo Barros",
    email: "gustavo.barros@gmail.com",
    avatar: 0,
    renda: 3200,
    limite: 2000,
    categorias: [{ nome: "Pets", cor: "#d98a5f" }, { nome: "Presentes", cor: "#f2a3ad" }],
    orcamentos: { Moradia: 1200, Mercado: 350, Transporte: 250, Lazer: 150, Assinaturas: 60 },
    cartao: { fecha: 3, vence: 10 },
    avisos: AVISOS,
    abrirOculto: false,
    rendaParceira: 0,
    lazerModo: "juntos",
    lazerPendente: false,
  },
  duo: {
    nome: "Gustavo Barros",
    email: "gustavo.barros@gmail.com",
    avatar: 0,
    renda: 6200,
    limite: 6000,
    categorias: [{ nome: "Pets", cor: "#d98a5f" }, { nome: "Presentes", cor: "#f2a3ad" }],
    orcamentos: { Moradia: 2500, Mercado: 1200, Lazer: 800, Transporte: 300 },
    cartao: { fecha: 3, vence: 10 },
    avisos: AVISOS,
    abrirOculto: false,
    rendaParceira: 5400,
    lazerModo: "juntos",
    lazerPendente: false,
  },
};

const chave = (conta: ContaAjustes) => `mimo.ajustes.${conta}.v1`;
const cache: Partial<Record<ContaAjustes, Ajustes>> = {};
const ouvintes = new Set<() => void>();

// Antes da primeira resposta da API: padrões neutros, sem os dados de exemplo.
const padraoApi = (conta: ContaAjustes): Ajustes => {
  const s = lerSessao();
  const user = s.status === "ok" ? s.user : null;
  return {
    ...PADRAO[conta],
    nome: user?.name ?? "",
    email: user?.email ?? "",
    avatar: user?.avatar ?? 0,
    renda: (user?.monthlyIncomeCents ?? 0) / 100,
    categorias: [],
    orcamentos: {},
    rendaParceira: 0,
  };
};

export const lerAjustes = (conta: ContaAjustes): Ajustes => {
  const salvo = cache[conta];
  if (salvo) return salvo;
  if (MODO_API) {
    const p = padraoApi(conta);
    cache[conta] = p;
    return p;
  }
  let lido: Ajustes = PADRAO[conta];
  try {
    const bruto = localStorage.getItem(chave(conta));
    if (bruto) {
      const json = JSON.parse(bruto);
      lido = { ...PADRAO[conta], ...json, avisos: { ...AVISOS, ...json.avisos } };
    }
  } catch {
    // sem armazenamento, vale o padrão
  }
  cache[conta] = lido;
  return lido;
};

export function salvarAjustes(conta: ContaAjustes, patch: Partial<Ajustes>) {
  const novo = { ...lerAjustes(conta), ...patch };
  cache[conta] = novo;
  if (MODO_API) {
    // nome, avatar e renda são da pessoa: valem nas duas contas
    const { perfil } = separarPatchAjustes(patch);
    if (Object.keys(perfil).length) {
      for (const outra of ["solo", "duo"] as ContaAjustes[]) {
        if (outra !== conta && cache[outra]) cache[outra] = { ...cache[outra]!, ...pick(patch, ["nome", "avatar", "renda"]) };
      }
    }
    ouvintes.forEach((avisar) => avisar());
    void gravarRemoto(conta, patch);
    return;
  }
  try {
    localStorage.setItem(chave(conta), JSON.stringify(novo));
  } catch {
    // segue só em memória
  }
  ouvintes.forEach((avisar) => avisar());
}

const pick = (p: Partial<Ajustes>, chaves: (keyof Ajustes)[]) =>
  Object.fromEntries(chaves.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) as Partial<Ajustes>;

async function gravarRemoto(conta: ContaAjustes, patch: Partial<Ajustes>) {
  const { perfil, conta: daConta } = separarPatchAjustes(patch);
  const alvo = contaDoTipo(conta);
  try {
    if (Object.keys(perfil).length) {
      const { user } = await api.patch<{ user: UsuarioApi }>("/me", perfil);
      const s = lerSessao();
      if (s.status === "ok") definirSessao({ ...s, user });
    }
    if (alvo && Object.keys(daConta).length) {
      const resposta = await api.patch<AjustesApi>(`/accounts/${alvo.id}/settings`, daConta);
      cache[conta] = paraAjustes(resposta);
      ouvintes.forEach((avisar) => avisar());
    }
  } catch (e) {
    // volta para o que está no servidor em vez de mostrar um valor que não foi salvo
    avisarFalha("Não foi possível salvar seus ajustes.", e);
    await hidratarAjustes();
  }
}

/** Busca os ajustes das contas da pessoa (chamado quando a sessão carrega). */
export async function hidratarAjustes() {
  if (!MODO_API) return;
  await Promise.all((["solo", "duo"] as ContaAjustes[]).map(async (conta) => {
    const alvo = contaDoTipo(conta);
    if (!alvo) return;
    try {
      cache[conta] = paraAjustes(await api.get<AjustesApi>(`/accounts/${alvo.id}/settings`));
    } catch (e) {
      avisarFalha("Não foi possível carregar seus ajustes.", e);
    }
  }));
  ouvintes.forEach((avisar) => avisar());
}

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => { ouvintes.delete(avisar); };
};

export const useAjustes = (conta: ContaAjustes) => useSyncExternalStore(assinar, () => lerAjustes(conta), () => PADRAO[conta]);

/** Categorias disponíveis no formulário: as padrão do Mimo e as criadas pela pessoa. */
export const categoriasDe = (a: Ajustes) => [...CATS, ...a.categorias.map((c) => c.nome).filter((n) => !CATS.includes(n))];

/** Cores das categorias padrão; as mesmas da tela Configurações > Categorias. */
export const CORES_CAT: Record<string, string> = {
  "Salário": "#0e7f6d", Freelance: "#10a88f", Investimentos: "#5b8def",
  Moradia: "#6f5cf0", Mercado: "#10a88f", Transporte: "#5b8def", Lazer: "#e2a24f",
  "Saúde": "#d94f6e", Assinaturas: "#c58bff", "Educação": "#4e9e79", Outros: "#8790a6",
};

/** Cor fixa por categoria: a mesma em todos os meses, gráficos e listas. */
export const corDaCategoria = (a: Ajustes, nome: string) => (
  a.categorias.find((c) => c.nome === nome)?.cor ?? CORES_CAT[nome] ?? "#8790a6"
);

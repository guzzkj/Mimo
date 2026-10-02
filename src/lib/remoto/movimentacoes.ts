import type { Item } from "../../types";
import { api } from "../api";
import { contaDoTipo, lerSessao, pessoasDaConta, type Sessao } from "../sessao";
import { diffItens, diffVazio, paraEntrada, paraItem, type ContextoPessoas, type DiffItens } from "./mapear";
import type { MovimentacaoApi } from "./tipos";

// Movimentações no backend. O motor (useMimoApp) continua trabalhando com a
// lista inteira em memória; aqui ela é carregada da API e cada mudança vira um
// lote (criar/editar/excluir) enviado em ordem, numa transação no servidor.

export interface ContaRemota { contaId: string; ctx: ContextoPessoas }

export function contaRemota(tipo: "solo" | "duo", sessao: Sessao = lerSessao()): ContaRemota | null {
  const conta = contaDoTipo(tipo, sessao);
  if (!conta) return null;
  const { meId, parId } = pessoasDaConta(conta, sessao);
  return { contaId: conta.id, ctx: { duo: tipo === "duo", meId, parId } };
}

// Última lista conhecida por conta: reabrir uma tela mostra os dados na hora
// e a busca na API só confirma.
const cache = new Map<string, Item[]>();
export const itensEmCache = (contaId: string) => cache.get(contaId) ?? null;
export const guardarEmCache = (contaId: string, itens: Item[]) => { cache.set(contaId, itens); };

export async function carregarMovimentacoes({ contaId, ctx }: ContaRemota): Promise<Item[]> {
  const { transactions } = await api.get<{ transactions: MovimentacaoApi[] }>(`/accounts/${contaId}/transactions`);
  const itens = transactions.map((t) => paraItem(t, ctx));
  cache.set(contaId, itens);
  return itens;
}

// Ids temporários (negativos) para o que ainda não chegou no servidor:
// nunca colidem com os ids reais, que são positivos.
let proximoTemporario = -1;
/** Reserva `quantos` ids seguidos (inicio, inicio-1, ...) e devolve o primeiro. */
export function idTemporario(quantos = 1) {
  const inicio = proximoTemporario;
  proximoTemporario -= Math.max(1, quantos);
  return inicio;
}

interface RespostaLote {
  created: { ref: string; transaction: MovimentacaoApi }[];
  groups: Record<string, number>;
}

export interface Remapeamento { ids: Map<number, number>; grupos: Map<number, number> }

export function aplicarRemapeamento(itens: Item[], r: Remapeamento): Item[] {
  if (!r.ids.size && !r.grupos.size) return itens;
  return itens.map((i) => {
    const id = r.ids.get(i.id);
    const grupo = i.grupo != null ? r.grupos.get(i.grupo) : undefined;
    return id === undefined && grupo === undefined ? i : { ...i, ...(id !== undefined ? { id } : {}), ...(grupo !== undefined ? { grupo } : {}) };
  });
}

/**
 * Fila de envio de uma conta. Lotes saem um de cada vez; ids temporários de
 * lotes anteriores são traduzidos para os reais antes de cada envio.
 */
export function criarSincronizador(remota: ContaRemota, aoRemapear: (r: Remapeamento) => void, aoFalhar: (e: unknown) => void) {
  const ids = new Map<number, number>();
  const grupos = new Map<number, number>();
  let fila: Promise<void> = Promise.resolve();
  let pendentes = 0;
  // depois de uma falha a lista é recarregada do servidor: lotes calculados
  // antes disso ficam velhos e são descartados
  let geracao = 0;

  const enviarLote = async (d: DiffItens) => {
    const id = (x: number) => ids.get(x) ?? x;
    const grupo = (g: number) => grupos.get(g) ?? g;
    const body = {
      create: d.criar.map((i) => {
        const g = i.grupo != null ? grupo(i.grupo) : null;
        return {
          ref: String(i.id),
          ...paraEntrada(i, remota.ctx),
          ...(g == null ? {} : g > 0 ? { groupId: g } : { groupRef: String(g) }),
        };
      }),
      update: d.atualizar.map((i) => ({ id: id(i.id), ...paraEntrada(i, remota.ctx) })).filter((u) => u.id > 0),
      delete: d.excluir.map(id).filter((x) => x > 0),
    };
    if (!body.create.length && !body.update.length && !body.delete.length) return;
    const res = await api.post<RespostaLote>(`/accounts/${remota.contaId}/transactions/batch`, body);
    const r: Remapeamento = { ids: new Map(), grupos: new Map() };
    for (const c of res.created) { ids.set(Number(c.ref), c.transaction.id); r.ids.set(Number(c.ref), c.transaction.id); }
    for (const [ref, g] of Object.entries(res.groups)) { grupos.set(Number(ref), g); r.grupos.set(Number(ref), g); }
    // grupo reaproveitado (groupId) que o servidor trocou por um novo
    for (const c of res.created) {
      const original = d.criar.find((i) => String(i.id) === c.ref);
      if (original?.grupo != null && original.grupo > 0 && c.transaction.groupId != null && c.transaction.groupId !== original.grupo) {
        r.grupos.set(original.grupo, c.transaction.groupId);
      }
    }
    aoRemapear(r);
  };

  return {
    /** Compara e enfileira o que mudou. Devolve false se não havia nada a enviar. */
    enviar(antes: Item[], depois: Item[]) {
      const d = diffItens(antes, depois, remota.ctx);
      if (diffVazio(d)) return false;
      pendentes++;
      const minha = geracao;
      fila = fila
        .then(() => (minha === geracao ? enviarLote(d) : undefined))
        .catch((e) => { geracao++; aoFalhar(e); })
        .finally(() => { pendentes--; });
      return true;
    },
    get ocupado() { return pendentes > 0; },
  };
}

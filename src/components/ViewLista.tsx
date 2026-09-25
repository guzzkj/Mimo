import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, CreditCard, Pencil, Trash2, X } from "lucide-react";
import { Fragment, useMemo } from "react";
import { MESES_LONGOS } from "../lib/helpers";
import type { Derivado, ItemDecorado, StatusMovimentacao, TipoMovimentacao } from "../types";
import { TagsMovimentacao } from "./TagsMovimentacao";

interface Props {
  derivado: Derivado;
  itensTotal: number;
  tipoFiltro: "todos" | TipoMovimentacao;
  statusFiltro: "todos" | StatusMovimentacao;
  query: string;
  fmt: (v: number) => string;
  onQuery: (q: string) => void;
  onFiltroTipo: (v: "todos" | TipoMovimentacao) => void;
  onFiltroStatus: (v: "todos" | StatusMovimentacao) => void;
  onEditar: (id: number) => void;
  onExcluir: (id: number) => void;
  onPaginaAnterior: () => void;
  onPaginaProxima: () => void;
  /** Coluna extra logo depois de Descrição (conta Duo: quem fez). */
  colunaExtra?: { titulo: string; celula: (it: ItemDecorado) => ReactNode };
  /** Linha de filtros extra abaixo dos filtros padrão (conta Duo: por autor). */
  filtrosExtras?: ReactNode;
  /** Filtro por categoria ("" = todas) e só compras no cartão. */
  categoriaFiltro?: string;
  cartaoFiltro?: boolean;
  categorias?: string[];
  onFiltroCategoria?: (categoria: string) => void;
  onFiltroCartao?: (cartao: boolean) => void;
  /** Marca como pagas todas as pendências da lista filtrada. */
  onMarcarPagas?: (ids: number[]) => void;
}

const chipClasse = (ativo: boolean) => `chip${ativo ? " is-on" : ""}`;

export function ViewLista({
  derivado: d, itensTotal, tipoFiltro, statusFiltro, query, fmt,
  onQuery, onFiltroTipo, onFiltroStatus, onEditar, onExcluir, onPaginaAnterior, onPaginaProxima,
  colunaExtra, filtrosExtras, categoriaFiltro = "", cartaoFiltro = false, categorias, onFiltroCategoria, onFiltroCartao, onMarcarPagas,
}: Props) {
  const pendentesVisiveis = d.visiveis.filter((i) => i.status === "pendente" && i.categoria !== "Privado");
  const somaTipo = (tipo: TipoMovimentacao) => d.visiveis.filter((i) => i.tipo === tipo).reduce((t, i) => t + i.valor, 0);
  const saldoFinal = d.visiveis.reduce((total, i) => total + (i.tipo === "entrada" ? i.valor : -i.valor), 0);
  const temItens = d.visiveis.length > 0;

  const linhas = useMemo(() => {
    let mesDaLinha = "";
    return d.daPagina.map((it, indice) => {
      const chave = it.data.slice(0, 7);
      const trocouDeMes = chave !== mesDaLinha;
      mesDaLinha = chave;
      const [ano, numero] = chave.split("-");
      return (
        <Fragment key={it.id}>
          {trocouDeMes && (
            <div className="table__mes"><span>{`${MESES_LONGOS[Number(numero) - 1]} de ${ano}`}</span></div>
          )}
          <div className="table__row" style={{ "--i": indice } as CSSProperties}>
            <div className="table__desc">
              <span className={`badge ${it.classeCor}`} style={{ background: it.iconBg }}>{it.sinal}</span>
              <strong>{it.descricao}</strong>
              <TagsMovimentacao item={it} />
            </div>
            {colunaExtra && <span className="table__cell table__extra">{colunaExtra.celula(it)}</span>}
            <span className="table__cell">{it.categoria}</span>
            <span className="table__cell">{it.dataLabel}</span>
            <span className={`recent__status ${it.statusClasse}`}>{it.statusLabel}</span>
            <span className={`table__value ${it.classeCor}`}>{it.valorFmt}</span>
            <div className="table__actions">
              <button className="icon-button" type="button" title="Editar" aria-label={`Editar ${it.descricao}`} onClick={() => onEditar(it.id)}>
                <Pencil />
              </button>
              <button className="icon-button icon-button--danger" type="button" title="Excluir" aria-label={`Excluir ${it.descricao}`} onClick={() => onExcluir(it.id)}>
                <Trash2 />
              </button>
            </div>
          </div>
        </Fragment>
      );
    });
  }, [d.daPagina, onEditar, onExcluir, colunaExtra]);

  return (
    <section className="view view--list" aria-label="Movimentações">
      <div className="filters">
        <label className="sr-only" htmlFor="busca">Buscar movimentações</label>
        <input
          className="search"
          id="busca"
          type="search"
          placeholder="Buscar por descrição ou categoria"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <div className="chips">
          {([["Tudo", "todos"], ["Entradas", "entrada"], ["Saídas", "saida"]] as const).map(([label, valor]) => (
            <button key={valor} className={chipClasse(tipoFiltro === valor)} type="button" onClick={() => onFiltroTipo(valor)}>{label}</button>
          ))}
        </div>
        <div className="chips">
          {([["Todos", "todos"], ["Concluídos", "pago"], ["Pendentes", "pendente"]] as const).map(([label, valor]) => (
            <button key={valor} className={chipClasse(statusFiltro === valor)} type="button" onClick={() => onFiltroStatus(valor)}>{label}</button>
          ))}
        </div>
      </div>

      {(onFiltroCategoria || onFiltroCartao) && (
        <div className="filters filters--extra">
          {onFiltroCategoria && categorias && (
            <label className="filtro-cat">
              <span className="sr-only">Categoria</span>
              <select value={categoriaFiltro} onChange={(e) => onFiltroCategoria(e.target.value)} className={categoriaFiltro ? "is-on" : undefined}>
                <option value="">Todas as categorias</option>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {onFiltroCartao && (
            <button type="button" className={chipClasse(cartaoFiltro)} aria-pressed={cartaoFiltro} onClick={() => onFiltroCartao(!cartaoFiltro)}>
              <CreditCard aria-hidden="true" className="chip__icone" />Só cartão
            </button>
          )}
          {(categoriaFiltro || cartaoFiltro) && (
            <button type="button" className="chip chip--limpar" onClick={() => { onFiltroCategoria?.(""); onFiltroCartao?.(false); }}>
              <X aria-hidden="true" className="chip__icone" />Limpar
            </button>
          )}
          {onMarcarPagas && pendentesVisiveis.length > 1 && (
            <button type="button" className="chip chip--acao" onClick={() => onMarcarPagas(pendentesVisiveis.map((i) => i.id))}>
              <Check aria-hidden="true" className="chip__icone" />{`Marcar ${pendentesVisiveis.length} pendentes como pagas`}
            </button>
          )}
        </div>
      )}

      {filtrosExtras}

      <div className="table-head-row">
        <h2 className="section__title">Todas as movimentações</h2>
        <span className="section__sub">
          {d.paginas > 1
            ? `${d.visiveis.length} de ${itensTotal} registros · página ${d.pagina} de ${d.paginas}`
            : `${d.visiveis.length} de ${itensTotal} registros`}
        </span>
      </div>

      <div className="table-wrap">
        <div className={`mv-table${colunaExtra ? " mv-table--extra" : ""}`}>
          <div className="table__cols">
            <span>Descrição</span>{colunaExtra && <span>{colunaExtra.titulo}</span>}<span>Categoria</span><span>Data</span><span>Status</span>
            <span className="cols-end">Valor</span><span className="cols-end">Ações</span>
          </div>
          <div>{linhas}</div>

          {temItens && (
            <div className="table__totals">
              <span className="eyebrow">Totais</span>
              <span className="total">
                <small className="eyebrow">Total de entradas</small>
                <span className="is-in-text">{`+ ${fmt(somaTipo("entrada"))}`}</span>
              </span>
              <span className="total">
                <small className="eyebrow">Total de saídas</small>
                <span className="is-out-text">{`- ${fmt(somaTipo("saida"))}`}</span>
              </span>
              <span />
              <span className="total total--end">
                <small className="eyebrow">Saldo final</small>
                <span className="table__value">{fmt(saldoFinal)}</span>
              </span>
              <span />
            </div>
          )}

          {d.paginas >= 2 && (
            <div className="paginacao">
              <button className="paginacao__botao" type="button" aria-label="Página anterior" disabled={d.pagina <= 1} onClick={onPaginaAnterior}>
                <ChevronLeft />
              </button>
              <span className="paginacao__rotulo">{`${d.pagina} de ${d.paginas}`}</span>
              <button className="paginacao__botao" type="button" aria-label="Próxima página" disabled={d.pagina >= d.paginas} onClick={onPaginaProxima}>
                <ChevronRight />
              </button>
            </div>
          )}

          {!temItens && (
            <div className="table__empty">
              <div className="mascote mascote--tabela">
                <svg viewBox="0 0 472 344" aria-hidden="true">
                  <g className="mascote__inclina">
                    <use href="#mimo-gato-atento" x="0" y="30" width="320" height="300" />
                  </g>
                  <g className="mascote__lupa">
                    <circle cx="382" cy="244" r="48" fill="#f4f7f4" opacity=".18" />
                    <circle cx="382" cy="244" r="48" fill="none" stroke="var(--gato-traco)" strokeWidth="12" />
                    <path d="M416 278 L452 314" stroke="var(--gato-traco)" strokeWidth="18" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              <div className="table__empty-texto">
                <strong>Nenhuma movimentação encontrada</strong>
                <span>Ajuste os filtros ou registre uma nova movimentação.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

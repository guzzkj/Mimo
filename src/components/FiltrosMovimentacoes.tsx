import { Check, CreditCard, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogo } from "../hooks/useDialogo";
import { limparFiltros, type FiltrosProps } from "../lib/filtrosMovimentacoes";

const TIPOS = [["Tudo", "todos"], ["Entradas", "entrada"], ["Saídas", "saida"]] as const;
const STATUS = [["Todos", "todos"], ["Concluídos", "pago"], ["Pendentes", "pendente"]] as const;
const MOBILE = "(max-width: 720px)";

const chipClasse = (ativo: boolean) => `chip${ativo ? " is-on" : ""}`;

// Busca com lupa e botão de limpar (o "x" nativo do type=search é escondido
// no CSS para não aparecer em dobro).
function Busca({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const campoRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`busca${query ? " tem-texto" : ""}`}>
      <Search className="busca__icone" aria-hidden="true" />
      <label className="sr-only" htmlFor="busca">Buscar movimentações por descrição ou categoria</label>
      <input
        ref={campoRef}
        className="search busca__campo"
        id="busca"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Buscar movimentações"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); onQuery(""); } }}
      />
      {query && (
        <button type="button" className="busca__limpar" aria-label="Limpar busca" onClick={() => { onQuery(""); campoRef.current?.focus(); }}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Filtros da tela de movimentações (Solo e Duo). No computador os controles
// ficam à vista, como sempre foram. No celular (até 720px) tudo cabe numa
// linha fixa no topo: busca + botão "Filtros", que abre uma folha inferior;
// os filtros ligados aparecem logo abaixo como chips removíveis.
// Só muda a apresentação: o estado e a semântica dos filtros são os do app.
export function FiltrosMovimentacoes(p: FiltrosProps) {
  const { query, tipoFiltro, statusFiltro, categoriaFiltro, cartaoFiltro, categorias, autor, pendentes, onQuery, onFiltroTipo, onFiltroStatus, onFiltroCategoria, onFiltroCartao, onMarcarPagas } = p;
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [grudada, setGrudada] = useState(false);
  const sentinelaRef = useRef<HTMLDivElement>(null);
  const fecharFolha = useCallback(() => setFolhaAberta(false), []);

  // Barra grudada no topo ganha borda e sombra; um sentinela logo acima dela
  // avisa quando ela deixa de estar no fluxo normal.
  useEffect(() => {
    const el = sentinelaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setGrudada(!e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Rótulos dos filtros ligados, para os chips removíveis e a contagem.
  const ativos: { chave: string; label: string; remover: () => void }[] = [];
  if (tipoFiltro !== "todos") ativos.push({ chave: "tipo", label: tipoFiltro === "entrada" ? "Entradas" : "Saídas", remover: () => onFiltroTipo("todos") });
  if (statusFiltro !== "todos") ativos.push({ chave: "status", label: statusFiltro === "pago" ? "Concluídos" : "Pendentes", remover: () => onFiltroStatus("todos") });
  if (autor && autor.valor !== "todos") {
    const opcao = autor.opcoes.find((o) => o.valor === autor.valor);
    ativos.push({ chave: "autor", label: opcao?.label ?? autor.valor, remover: () => autor.onChange("todos") });
  }
  if (categoriaFiltro && onFiltroCategoria) ativos.push({ chave: "categoria", label: categoriaFiltro, remover: () => onFiltroCategoria("") });
  if (cartaoFiltro && onFiltroCartao) ativos.push({ chave: "cartao", label: "Só cartão", remover: () => onFiltroCartao(false) });

  const limparTudo = () => limparFiltros(p);

  const n = ativos.length;
  const marcarPagas = onMarcarPagas && pendentes.length > 1
    ? () => onMarcarPagas(pendentes)
    : undefined;

  return (
    <div className="filtros-mov">
      <div ref={sentinelaRef} className="filtros-mov__sentinela" aria-hidden="true" />
      <div className={`filters filtros-mov__barra${grudada ? " is-grudada" : ""}`}>
        <Busca query={query} onQuery={onQuery} />
        <div className="chips filtros-desk" role="group" aria-label="Tipo">
          {TIPOS.map(([label, valor]) => (
            <button key={valor} className={chipClasse(tipoFiltro === valor)} type="button" aria-pressed={tipoFiltro === valor} onClick={() => onFiltroTipo(valor)}>{label}</button>
          ))}
        </div>
        <div className="chips filtros-desk" role="group" aria-label="Status">
          {STATUS.map(([label, valor]) => (
            <button key={valor} className={chipClasse(statusFiltro === valor)} type="button" aria-pressed={statusFiltro === valor} onClick={() => onFiltroStatus(valor)}>{label}</button>
          ))}
        </div>
        <button
          type="button"
          className={`filtros-m__abrir${n ? " is-on" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={folhaAberta}
          aria-label={n ? `Filtros, ${n} ${n === 1 ? "ativo" : "ativos"}` : "Filtros"}
          onClick={() => setFolhaAberta(true)}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span className="filtros-m__rotulo">Filtros</span>
          {n > 0 && <b className="filtros-m__badge" aria-hidden="true">{n}</b>}
        </button>
      </div>

      {(onFiltroCategoria || onFiltroCartao || marcarPagas) && (
        <div className="filters filters--extra filtros-desk">
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
          {marcarPagas && (
            <button type="button" className="chip chip--acao" onClick={marcarPagas}>
              <Check aria-hidden="true" className="chip__icone" />{`Marcar ${pendentes.length} pendentes como pagas`}
            </button>
          )}
        </div>
      )}

      {autor && (
        <div className="filtro-quem filtros-desk" role="group" aria-label="Quem lançou">
          {autor.opcoes.map((o) => {
            const on = autor.valor === o.valor;
            return (
              <button key={o.valor} type="button" className={`filtro-quem__opcao${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => autor.onChange(o.valor)}>
                {o.icone}
                {o.label}
                <span className="filtro-quem__n">{o.contagem}</span>
              </button>
            );
          })}
        </div>
      )}

      {(n > 0 || marcarPagas) && (
        <div className="filtros-m__ativos" role="group" aria-label="Filtros ativos">
          {ativos.map((a) => (
            <button key={a.chave} type="button" className="filtro-ativo" aria-label={`Remover filtro ${a.label}`} onClick={a.remover}>
              {a.label}<X aria-hidden="true" />
            </button>
          ))}
          {n > 1 && (
            <button type="button" className="filtro-ativo filtro-ativo--limpar" onClick={limparTudo}>Limpar tudo</button>
          )}
          {marcarPagas && (
            <button type="button" className="filtro-ativo filtro-ativo--acao" aria-label={`Marcar ${pendentes.length} pendentes como pagas`} onClick={marcarPagas}>
              <Check aria-hidden="true" />{`Marcar ${pendentes.length} como pagas`}
            </button>
          )}
        </div>
      )}

      {folhaAberta && (
        <FolhaFiltros
          {...p}
          ativos={n}
          onLimpar={limparTudo}
          onFechar={fecharFolha}
        />
      )}
    </div>
  );
}

interface FolhaProps extends FiltrosProps {
  ativos: number;
  onLimpar: () => void;
  onFechar: () => void;
}

// Folha inferior do celular com todos os filtros. Os filtros valem na hora
// (a lista por trás já se atualiza), então o botão principal só confirma e
// mostra quantos resultados a combinação atual encontra.
function FolhaFiltros({ tipoFiltro, statusFiltro, categoriaFiltro, cartaoFiltro, categorias, autor, resultados, ativos, onFiltroTipo, onFiltroStatus, onFiltroCategoria, onFiltroCartao, onLimpar, onFechar }: FolhaProps) {
  const caixaRef = useDialogo<HTMLDivElement>(true);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", aoTeclar);
    // a página por trás não rola enquanto a folha está aberta
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // se a janela crescer para o layout de computador, os filtros já estão à vista
    const mq = matchMedia(MOBILE);
    const aoMudar = () => { if (!mq.matches) onFechar(); };
    mq.addEventListener("change", aoMudar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
      mq.removeEventListener("change", aoMudar);
    };
  }, [onFechar]);

  const opcao = (on: boolean) => `folha-opcao${on ? " is-on" : ""}`;
  const verRotulo = resultados === 0 ? "Nenhum resultado" : `Ver ${resultados} ${resultados === 1 ? "resultado" : "resultados"}`;

  return createPortal(
    <div className="folha-fundo" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="folha-filtros" id="folha-filtros" role="dialog" aria-modal="true" aria-labelledby="folha-filtros-titulo" ref={caixaRef}>
        <div className="folha-filtros__alca" aria-hidden="true" />
        <div className="folha-filtros__topo">
          <h2 className="folha-filtros__titulo" id="folha-filtros-titulo">Filtros</h2>
          <button type="button" className="folha-filtros__fechar" aria-label="Fechar filtros" onClick={onFechar}><X aria-hidden="true" /></button>
        </div>

        <div className="folha-filtros__corpo">
          <fieldset className="folha-grupo">
            <legend>Tipo</legend>
            <div className="folha-opcoes folha-opcoes--seg">
              {TIPOS.map(([label, valor]) => (
                <button key={valor} type="button" className={opcao(tipoFiltro === valor)} aria-pressed={tipoFiltro === valor} onClick={() => onFiltroTipo(valor)}>{label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="folha-grupo">
            <legend>Status</legend>
            <div className="folha-opcoes folha-opcoes--seg">
              {STATUS.map(([label, valor]) => (
                <button key={valor} type="button" className={opcao(statusFiltro === valor)} aria-pressed={statusFiltro === valor} onClick={() => onFiltroStatus(valor)}>{label}</button>
              ))}
            </div>
          </fieldset>

          {autor && (
            <fieldset className="folha-grupo">
              <legend>Quem lançou</legend>
              <div className="folha-opcoes folha-opcoes--duas">
                {autor.opcoes.map((o) => (
                  <button key={o.valor} type="button" className={`${opcao(autor.valor === o.valor)} folha-opcao--pessoa`} aria-pressed={autor.valor === o.valor} onClick={() => autor.onChange(o.valor)}>
                    {o.icone}
                    <span className="folha-opcao__texto">{o.label}</span>
                    <span className="folha-opcao__n">{o.contagem}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {onFiltroCategoria && categorias && (
            <fieldset className="folha-grupo">
              <legend>Categoria</legend>
              <div className="folha-opcoes">
                <button type="button" className={opcao(!categoriaFiltro)} aria-pressed={!categoriaFiltro} onClick={() => onFiltroCategoria("")}>Todas</button>
                {categorias.map((c) => (
                  <button key={c} type="button" className={opcao(categoriaFiltro === c)} aria-pressed={categoriaFiltro === c} onClick={() => onFiltroCategoria(categoriaFiltro === c ? "" : c)}>{c}</button>
                ))}
              </div>
            </fieldset>
          )}

          {onFiltroCartao && (
            <fieldset className="folha-grupo">
              <legend>Forma de pagamento</legend>
              <div className="folha-opcoes">
                <button type="button" className={opcao(cartaoFiltro)} aria-pressed={cartaoFiltro} onClick={() => onFiltroCartao(!cartaoFiltro)}>
                  <CreditCard aria-hidden="true" className="folha-opcao__icone" />Só compras no cartão
                </button>
              </div>
            </fieldset>
          )}
        </div>

        <p className="sr-only" aria-live="polite">{verRotulo.replace("Ver ", "")}</p>
        <div className="folha-filtros__rodape">
          <button type="button" className="btn folha-filtros__limpar" disabled={!ativos} onClick={onLimpar}>Limpar</button>
          <button type="button" className="btn btn--primary folha-filtros__ver" onClick={onFechar}>{verRotulo}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

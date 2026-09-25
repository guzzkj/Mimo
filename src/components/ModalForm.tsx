import { Calendar, Lock, Users, X } from "lucide-react";
import { useRef } from "react";
import { useDialogo } from "../hooks/useDialogo";
import { CATS, MAX_PARCELAS } from "../lib/constants";
import { HOJE_ISO, dataBr, dividirEmParcelas, isoDeBr, mascaraData, mascaraMoeda, parseNum } from "../lib/helpers";
import type { Autor, FormState } from "../types";

interface Props {
  aberto: boolean;
  editando: boolean;
  /** Editando uma ocorrência de parcela ou conta recorrente: oferece "aplicar às próximas". */
  grupo?: "parcela" | "recorrente" | null;
  form: FormState;
  erro: string;
  fmt: (v: number) => string;
  onFechar: () => void;
  onSalvar: () => void;
  onSetForm: (patch: Partial<FormState>) => void;
  /** Conta Duo: permite escolher quem fez, quem vê e se entra na divisão. */
  autores?: { valor: Autor; label: string }[];
  /** Categorias padrão + as criadas em Configurações. */
  categorias?: string[];
}

const PARCELAS_OPCOES = Array.from({ length: MAX_PARCELAS - 1 }, (_, i) => i + 2);

export function ModalForm({ aberto, editando, grupo, form, erro, fmt, onFechar, onSalvar, onSetForm, autores, categorias = CATS }: Props) {
  const nativoRef = useRef<HTMLInputElement>(null);
  const caixaRef = useDialogo<HTMLDivElement>(aberto);

  if (!aberto) return null;

  const totalDigitado = parseNum(form.valor);
  const qtd = Number(form.parcelas);
  const dicaParcelas = form.parcelado && !Number.isNaN(totalDigitado) && totalDigitado > 0
    ? `${qtd}× de ${fmt(dividirEmParcelas(totalDigitado, qtd)[qtd - 1])}`
    : "";

  const abrirCalendarioNativo = () => {
    const nativo = nativoRef.current;
    if (!nativo) return;
    nativo.value = isoDeBr(form.data) || HOJE_ISO;
    try {
      nativo.showPicker?.();
    } catch {
      nativo.focus();
    }
  };

  const conjunta = form.quem === "conjunta";
  const podeDividir = form.tipo === "saida" && !conjunta && !form.privado;

  return (
    <div
      className="overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={caixaRef}>
        <div className="modal__head">
          <div>
            <h3 className="modal__title" id="modal-titulo">{editando ? "Editar movimentação" : "Nova movimentação"}</h3>
            <p className="modal__sub">{editando ? "Ajuste os dados e salve as alterações." : autores ? "Registre uma entrada ou saída da conta de vocês." : "Registre uma entrada ou saída da sua carteira."}</p>
          </div>
          <button className="modal__close" type="button" title="Fechar" aria-label="Fechar" onClick={onFechar}>
            <X />
          </button>
        </div>

        <div className="switch" role="radiogroup" aria-label="Tipo">
          <button
            className={`switch__option${form.tipo === "entrada" ? " is-on" : ""}`}
            type="button"
            role="radio"
            aria-checked={form.tipo === "entrada"}
            data-type="entrada"
            onClick={() => onSetForm({ tipo: "entrada", categoria: "Salário" })}
          >
            Entrada
          </button>
          <button
            className={`switch__option${form.tipo === "saida" ? " is-on" : ""}`}
            type="button"
            role="radio"
            aria-checked={form.tipo === "saida"}
            data-type="saida"
            onClick={() => onSetForm({ tipo: "saida", categoria: "Mercado" })}
          >
            Saída
          </button>
        </div>

        <div className="form-grid">
          <label className="field field--wide">Descrição
            <input
              type="text"
              placeholder="Salário, mercado, aluguel"
              autoComplete="off"
              value={form.descricao}
              onChange={(e) => onSetForm({ descricao: e.target.value })}
            />
          </label>
          <label className="field">Valor
            <span className="campo-moeda">
              <span aria-hidden="true">R$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => onSetForm({ valor: mascaraMoeda(e.target.value) })}
              />
            </span>
          </label>
          <label className="field">Data
            <span className="campo-data">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="dd/mm/aaaa"
                autoComplete="off"
                value={form.data}
                onChange={(e) => onSetForm({ data: mascaraData(e.target.value) })}
              />
              <button className="campo-data__botao" type="button" title="Escolher no calendário" aria-label="Escolher no calendário" onClick={abrirCalendarioNativo}>
                <Calendar />
              </button>
              <input
                className="sr-only"
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                ref={nativoRef}
                onChange={(e) => { if (e.target.value) onSetForm({ data: dataBr(e.target.value) }); }}
              />
            </span>
          </label>
          <label className="field">Categoria
            <select value={form.categoria} onChange={(e) => onSetForm({ categoria: e.target.value })}>
              {categorias.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </label>
          <label className="field">Status
            <select value={form.status} onChange={(e) => onSetForm({ status: e.target.value as FormState["status"] })}>
              <option value="pago">Concluído</option>
              <option value="pendente">Pendente</option>
            </select>
          </label>
          {form.tipo === "saida" && (
            <div className="field field--wide">Pago com
              <div className="switch switch--meio" role="radiogroup" aria-label="Pago com">
                {([["conta", "Débito / Pix"], ["cartao", "Cartão de crédito"]] as const).map(([valor, label]) => (
                  <button
                    key={valor}
                    className={`switch__option${form.meio === valor ? " is-on" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={form.meio === valor}
                    onClick={() => onSetForm({ meio: valor })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {autores && (
            <label className="field field--wide">Quem fez
              <select value={form.quem ?? autores[0]?.valor} onChange={(e) => onSetForm({ quem: e.target.value as Autor, ...(e.target.value === "conjunta" ? { privado: false } : {}) })}>
                {autores.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
              </select>
            </label>
          )}
          {autores && (
            <div className="field field--wide">Quem vê
              <div className="visib" role="radiogroup" aria-label="Quem vê este lançamento">
                {([
                  [false, "Compartilhado", "Suelen vê valor, descrição e categoria.", <Users key="i" aria-hidden="true" />],
                  [true, "Privado", "Só você vê. Para Suelen, entra só no seu total, sem detalhes.", <Lock key="i" aria-hidden="true" />],
                ] as const).map(([valor, label, desc, icone]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={form.privado === valor}
                    disabled={valor && conjunta}
                    className={`visib__op${form.privado === valor ? " is-on" : ""}`}
                    onClick={() => onSetForm({ privado: valor, ...(valor ? { dividir: false } : {}) })}
                  >
                    <strong>{icone}{label}</strong>
                    <span>{valor && conjunta ? "Lançamentos da conta conjunta são sempre compartilhados." : desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {autores && podeDividir && (
            <label className="check field--wide visib__dividir">
              <input type="checkbox" checked={form.dividir} onChange={(e) => onSetForm({ dividir: e.target.checked })} />
              <span>
                <strong>Dividir com {form.quem === "suelen" ? "Gustavo" : "Suelen"}</strong>
                <small>Entra na divisão de despesas do mês.</small>
              </span>
            </label>
          )}
        </div>

        {!editando && (
          <div className="parcelamento">
            <label className="check">
              <input
                type="checkbox"
                checked={form.parcelado}
                onChange={(e) => onSetForm({ parcelado: e.target.checked, ...(e.target.checked ? { recorrente: false } : {}) })}
              />
              <span>Compra parcelada</span>
            </label>

            {!form.parcelado && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={(e) => onSetForm({ recorrente: e.target.checked })}
                />
                <span>Repete todo mês</span>
              </label>
            )}

            {form.parcelado && (
              <label className="check__qtd">
                <span>Parcelas</span>
                <select value={form.parcelas} onChange={(e) => onSetForm({ parcelas: e.target.value })}>
                  {PARCELAS_OPCOES.map((n) => <option key={n} value={n}>{`${n}x`}</option>)}
                </select>
              </label>
            )}

            <span className="parcelamento__dica">
              {dicaParcelas || (form.recorrente ? "Cria os próximos 12 meses como contas a pagar" : "")}
              {form.parcelado && form.meio === "cartao" && form.tipo === "saida" ? " · uma por fatura" : ""}
            </span>
          </div>
        )}

        {editando && grupo && (
          <div className="parcelamento">
            <label className="check">
              <input type="checkbox" checked={form.aplicarProximas} onChange={(e) => onSetForm({ aplicarProximas: e.target.checked })} />
              <span>{grupo === "parcela" ? "Aplicar também às próximas parcelas" : "Aplicar também aos próximos meses"}</span>
            </label>
            <span className="parcelamento__dica">Data e status de cada uma continuam como estão.</span>
          </div>
        )}

        {erro && <div className="form-error" role="alert">{erro}</div>}

        <div className="modal__actions">
          <button className="btn" type="button" onClick={onFechar}>Cancelar</button>
          <button className="btn btn--primary" type="button" onClick={onSalvar}>{editando ? "Salvar alterações" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

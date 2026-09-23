import { Calendar, X } from "lucide-react";
import { useRef } from "react";
import { CATS, MAX_PARCELAS } from "../lib/constants";
import { HOJE_ISO, dataBr, dividirEmParcelas, isoDeBr, mascaraData, parseNum } from "../lib/helpers";
import type { FormState } from "../types";

interface Props {
  aberto: boolean;
  editando: boolean;
  form: FormState;
  erro: string;
  fmt: (v: number) => string;
  onFechar: () => void;
  onSalvar: () => void;
  onSetForm: (patch: Partial<FormState>) => void;
}

const PARCELAS_OPCOES = Array.from({ length: MAX_PARCELAS - 1 }, (_, i) => i + 2);

export function ModalForm({ aberto, editando, form, erro, fmt, onFechar, onSalvar, onSetForm }: Props) {
  const nativoRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className="overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <div className="modal__head">
          <div>
            <h3 className="modal__title" id="modal-titulo">{editando ? "Editar movimentação" : "Nova movimentação"}</h3>
            <p className="modal__sub">{editando ? "Ajuste os dados e salve as alterações." : "Registre uma entrada ou saída da sua carteira."}</p>
          </div>
          <button className="modal__close" type="button" title="Fechar" aria-label="Fechar" onClick={onFechar}>
            <X />
          </button>
        </div>

        <div className="switch">
          <button
            className={`switch__option${form.tipo === "entrada" ? " is-on" : ""}`}
            type="button"
            data-type="entrada"
            onClick={() => onSetForm({ tipo: "entrada", categoria: "Salário" })}
          >
            Entrada
          </button>
          <button
            className={`switch__option${form.tipo === "saida" ? " is-on" : ""}`}
            type="button"
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
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => onSetForm({ valor: e.target.value })}
            />
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
              {CATS.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </label>
          <label className="field">Status
            <select value={form.status} onChange={(e) => onSetForm({ status: e.target.value as FormState["status"] })}>
              <option value="pago">Concluído</option>
              <option value="pendente">Pendente</option>
            </select>
          </label>
        </div>

        {!editando && (
          <div className="parcelamento">
            <label className="check">
              <input
                type="checkbox"
                checked={form.parcelado}
                onChange={(e) => onSetForm({ parcelado: e.target.checked })}
              />
              <span>Compra parcelada</span>
            </label>

            {form.parcelado && (
              <label className="check__qtd">
                <span>Parcelas</span>
                <select value={form.parcelas} onChange={(e) => onSetForm({ parcelas: e.target.value })}>
                  {PARCELAS_OPCOES.map((n) => <option key={n} value={n}>{`${n}x`}</option>)}
                </select>
              </label>
            )}

            <span className="parcelamento__dica">{dicaParcelas}</span>
          </div>
        )}

        {erro && <div className="form-error">{erro}</div>}

        <div className="modal__actions">
          <button className="btn" type="button" onClick={onFechar}>Cancelar</button>
          <button className="btn btn--primary" type="button" onClick={onSalvar}>{editando ? "Salvar alterações" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

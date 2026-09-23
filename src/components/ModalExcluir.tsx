import type { Item } from "../types";

interface Props {
  item: Item | null;
  fmt: (v: number) => string;
  onManter: () => void;
  onConfirmar: () => void;
}

export function ModalExcluir({ item, fmt, onManter, onConfirmar }: Props) {
  if (!item) return null;

  return (
    <div
      className="overlay overlay--danger"
      onClick={(e) => { if (e.target === e.currentTarget) onManter(); }}
    >
      <div className="modal modal--danger" role="alertdialog" aria-modal="true" aria-labelledby="excluir-titulo">
        <h3 className="modal__title" id="excluir-titulo">Excluir movimentação</h3>
        <p className="modal__sub">{`"${item.descricao}" no valor de ${fmt(item.valor)} será removida do painel. A ação não pode ser desfeita.`}</p>
        <div className="modal__actions">
          <button className="btn" type="button" onClick={onManter}>Manter</button>
          <button className="btn btn--danger" type="button" onClick={onConfirmar}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

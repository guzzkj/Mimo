import { useDialogo } from "../hooks/useDialogo";
import type { Item } from "../types";

interface Props {
  item: Item | null;
  fmt: (v: number) => string;
  onManter: () => void;
  onConfirmar: () => void;
}

export function ModalExcluir({ item, fmt, onManter, onConfirmar }: Props) {
  const caixaRef = useDialogo<HTMLDivElement>(Boolean(item));
  if (!item) return null;

  return (
    <div
      className="overlay overlay--danger"
      onClick={(e) => { if (e.target === e.currentTarget) onManter(); }}
    >
      <div className="modal modal--danger" role="alertdialog" aria-modal="true" aria-labelledby="excluir-titulo" aria-describedby="excluir-texto" ref={caixaRef}>
        <h3 className="modal__title" id="excluir-titulo">Excluir movimentação</h3>
        <p className="modal__sub" id="excluir-texto">{`"${item.descricao}" no valor de ${fmt(item.valor)} será removida do painel. Dá para desfazer logo depois, pelo aviso.`}</p>
        <div className="modal__actions">
          <button className="btn" type="button" onClick={onManter}>Manter</button>
          <button className="btn btn--danger" type="button" onClick={onConfirmar}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

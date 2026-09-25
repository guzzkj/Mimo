import type { Toast } from "../hooks/useToasts";

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast${t.saindo ? " is-saindo" : ""}${t.acao ? " toast--acao" : ""}`} role="status" key={t.id}>
          <span className="toast__gato"><svg viewBox="0 0 320 300" aria-hidden="true"><use href={t.rosto} /></svg></span>
          <span>{t.texto}</span>
          {t.acao && <button className="toast__acao" type="button" onClick={t.acao.onClick}>{t.acao.label}</button>}
        </div>
      ))}
    </div>
  );
}

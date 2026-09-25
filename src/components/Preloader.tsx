import { useEffect, useState } from "react";

const JA_ABRIU = "mimo.preloader.visto";

// Só na primeira carga da sessão: quem volta ao painel (ex.: vindo de Metas)
// não espera a animação de novo.
const primeiraVez = () => {
  try {
    return !sessionStorage.getItem(JA_ABRIU);
  } catch {
    return true;
  }
};

// Tela de abertura: some sozinha ~1.15s depois de montar, igual ao original.
export function Preloader() {
  const [mostrar] = useState(primeiraVez);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(!mostrar);

  useEffect(() => {
    if (!mostrar) return;
    try {
      sessionStorage.setItem(JA_ABRIU, "1");
    } catch {
      // sem armazenamento, mostra sempre
    }
    const t1 = setTimeout(() => setLeaving(true), 1150);
    const t2 = setTimeout(() => setHidden(true), 1750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [mostrar]);

  if (hidden) return null;

  return (
    <div className={`preloader${leaving ? " is-leaving" : ""}`}>
      <div className="preloader__stack">
        <img className="preloader__logo" src="/assets/mimo-logo.png" alt="Mimo" />
        <div className="preloader__track"><div className="preloader__bar" /></div>
      </div>
    </div>
  );
}

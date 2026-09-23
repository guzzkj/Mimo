import { useEffect, useState } from "react";

// Tela de abertura: some sozinha ~1.15s depois de montar, igual ao original.
export function Preloader() {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1150);
    const t2 = setTimeout(() => setHidden(true), 1750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

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

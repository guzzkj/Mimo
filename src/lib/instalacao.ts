import { useSyncExternalStore } from "react";

// Convite para instalar o Mimo como app (PWA) no celular.
// O Chrome/Android dispara `beforeinstallprompt` uma vez, cedo, e só deixa
// abrir o prompt nativo a partir desse evento: por isso o listener fica no
// nível do módulo (importado pelo main.tsx) e não dentro de um componente.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISPENSADO_KEY = "mimo.instalar.dispensado"; // "não mostrar novamente"
const ADIADO_KEY = "mimo.instalar.adiado"; // "agora não": vale só nesta sessão

let promptGuardado: BeforeInstallPromptEvent | null = null;
let instalado = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // sem isso o Chrome mostra a própria mini-barra; o convite é o nosso
    e.preventDefault();
    promptGuardado = e as BeforeInstallPromptEvent;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    instalado = true;
    promptGuardado = null;
    // a aba do navegador continua aberta depois de instalar: não convida de novo
    dispensarConvite();
    avisar();
  });
}

const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
};

export interface EstadoInstalacao {
  podeInstalarNativo: boolean;
  instalado: boolean;
}

let instantaneo: EstadoInstalacao = { podeInstalarNativo: false, instalado: false };
const ler = () => {
  const podeInstalarNativo = Boolean(promptGuardado);
  if (instantaneo.podeInstalarNativo !== podeInstalarNativo || instantaneo.instalado !== instalado) {
    instantaneo = { podeInstalarNativo, instalado };
  }
  return instantaneo;
};
const SERVIDOR: EstadoInstalacao = { podeInstalarNativo: false, instalado: false };

export const useEstadoInstalacao = () => useSyncExternalStore(assinar, ler, () => SERVIDOR);

// Abre o prompt nativo. O evento só pode ser usado uma vez.
export async function pedirInstalacao(): Promise<"accepted" | "dismissed" | "indisponivel"> {
  const evento = promptGuardado;
  if (!evento) return "indisponivel";
  promptGuardado = null;
  avisar();
  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome;
  } catch {
    return "indisponivel";
  }
}

// --- ambiente ---------------------------------------------------------------

const mq = (q: string) => {
  try {
    return matchMedia(q).matches;
  } catch {
    return false;
  }
};

// Já aberto como app (tela inicial): no iOS vem por navigator.standalone.
export const rodandoInstalado = () =>
  mq("(display-mode: standalone)") ||
  mq("(display-mode: fullscreen)") ||
  mq("(display-mode: minimal-ui)") ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ua = () => navigator.userAgent || "";

// iPadOS se apresenta como Mac; o toque denuncia.
export const ehIOS = () =>
  /iPhone|iPad|iPod/i.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const ehSafariIOS = () => ehIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua());

// Navegadores embutidos (Instagram, Facebook, TikTok...) não instalam nada.
export const ehNavegadorEmbutido = () => /FBAN|FBAV|Instagram|Line\/|musical_ly|TikTok|; wv\)/i.test(ua());

export const ehMobile = () => {
  const dica = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  if (dica) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua()) || ehIOS()) return true;
  // sem UA conclusivo: tela de toque e estreita
  return mq("(pointer: coarse)") && mq("(max-width: 900px)");
};

// --- preferência do usuário ---------------------------------------------------

const lerChave = (store: () => Storage, chave: string) => {
  try {
    return store().getItem(chave) === "1";
  } catch {
    return false;
  }
};
const gravarChave = (store: () => Storage, chave: string) => {
  try {
    store().setItem(chave, "1");
  } catch {
    // armazenamento bloqueado: o convite some só enquanto a página estiver aberta
  }
};

export const conviteDispensado = () => lerChave(() => localStorage, DISPENSADO_KEY);
export const conviteAdiado = () => lerChave(() => sessionStorage, ADIADO_KEY);
export const dispensarConvite = () => gravarChave(() => localStorage, DISPENSADO_KEY);
export const adiarConvite = () => gravarChave(() => sessionStorage, ADIADO_KEY);

export const deveConvidar = () => ehMobile() && !rodandoInstalado() && !conviteDispensado() && !conviteAdiado();

// Service worker: só no build de produção (no dev atrapalharia o HMR do Vite).
export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sem SW o app segue funcionando, só não abre offline
    });
  });
}

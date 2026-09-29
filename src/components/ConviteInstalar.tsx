import { useEffect, useState } from "react";
import { Download, EllipsisVertical, House, Maximize, Share, SquarePlus, WifiOff } from "lucide-react";
import { useDialogo } from "../hooks/useDialogo";
import {
  adiarConvite,
  deveConvidar,
  dispensarConvite,
  ehIOS,
  ehNavegadorEmbutido,
  ehSafariIOS,
  pedirInstalacao,
  useEstadoInstalacao,
} from "../lib/instalacao";

// Depois do preloader (~1.75s), para o convite não brigar com a abertura.
const ATRASO_MS = 2200;

const BENEFICIOS = [
  { Icone: House, titulo: "Abre direto da tela inicial", texto: "Um toque no ícone do Mimo, sem digitar endereço nem caçar aba." },
  { Icone: Maximize, titulo: "Tela cheia, jeito de app", texto: "Sem a barra do navegador: sobra mais espaço para o seu painel." },
  { Icone: WifiOff, titulo: "Funciona sem internet", texto: "Seus lançamentos ficam no aparelho e o painel abre mesmo offline." },
];

// Convite para instalar o Mimo, só no celular e só fora do app instalado.
// Android/Chromium: botão que abre o prompt nativo. iOS: passo a passo do
// "Adicionar à Tela de Início", porque o Safari não tem prompt.
export function ConviteInstalar() {
  const { podeInstalarNativo, instalado } = useEstadoInstalacao();
  const [aberto, setAberto] = useState(false);
  const visivel = aberto && !instalado;
  const caixaRef = useDialogo<HTMLDivElement>(visivel);

  useEffect(() => {
    if (!deveConvidar()) return;
    const t = window.setTimeout(() => setAberto(true), ATRASO_MS);
    return () => window.clearTimeout(t);
  }, []);

  const agoraNao = () => { adiarConvite(); setAberto(false); };
  const naoMostrarMais = () => { dispensarConvite(); setAberto(false); };

  const instalar = async () => {
    const resultado = await pedirInstalacao();
    if (resultado === "accepted") naoMostrarMais();
    else if (resultado === "dismissed") agoraNao();
  };

  useEffect(() => {
    if (!visivel) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") { adiarConvite(); setAberto(false); }
    };
    document.addEventListener("keydown", aoTeclar);
    // a página por trás não rola enquanto a folha está aberta
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [visivel]);

  if (!visivel) return null;

  // iOS antes do prompt nativo: nenhum navegador do iOS instala por prompt,
  // e a emulação do DevTools (UA de iPhone sobre Chrome) dispara o evento mesmo assim.
  const modo = ehNavegadorEmbutido() ? "embutido" : ehIOS() ? "ios" : podeInstalarNativo ? "nativo" : "manual";

  return (
    <div className="instalar" onClick={(e) => { if (e.target === e.currentTarget) agoraNao(); }}>
      <div
        className="instalar__folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instalar-titulo"
        aria-describedby="instalar-texto"
        ref={caixaRef}
      >
        <div className="instalar__gato" aria-hidden="true">
          <svg viewBox="0 0 320 300"><use href="#mimo-gato" /></svg>
        </div>

        <div className="instalar__conteudo">
          <h2 className="instalar__titulo" id="instalar-titulo">Leve o Mimo na tela inicial</h2>
          <p className="instalar__sub" id="instalar-texto">
            Instale o app e confira seus gastos com um toque, sem passar pelo navegador.
          </p>

          <ul className="instalar__beneficios">
            {BENEFICIOS.map(({ Icone, titulo, texto }) => (
              <li key={titulo}>
                <span className="instalar__icone" aria-hidden="true"><Icone /></span>
                <span><strong>{titulo}</strong>{texto}</span>
              </li>
            ))}
          </ul>

          {modo === "ios" && (
            <div className="instalar__passos">
              <p className="instalar__passos-titulo">Para instalar no iPhone</p>
              <ol>
                <li>Toque em <strong>Compartilhar</strong> <Share className="instalar__inline" aria-label="(ícone de quadrado com seta)" /> na barra do Safari.</li>
                <li>Escolha <strong>Adicionar à Tela de Início</strong> <SquarePlus className="instalar__inline" aria-hidden="true" />.</li>
                <li>Confirme em <strong>Adicionar</strong>.</li>
              </ol>
              {!ehSafariIOS() && (
                <p className="instalar__nota">Em outro navegador, o Compartilhar fica na barra de endereço ou no menu. Se não aparecer, abra o Mimo no Safari.</p>
              )}
              <p className="instalar__nota">No iPhone, o app instalado guarda os dados separado do Safari.</p>
            </div>
          )}

          {modo === "manual" && (
            <div className="instalar__passos">
              <p className="instalar__passos-titulo">Para instalar</p>
              <p className="instalar__nota instalar__nota--forte">
                Abra o menu do navegador <EllipsisVertical className="instalar__inline" aria-label="(três pontinhos)" /> e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
            </div>
          )}

          {modo === "embutido" && (
            <div className="instalar__passos">
              <p className="instalar__nota instalar__nota--forte">
                Você está no navegador de outro app. Abra o Mimo no Chrome ou no Safari para instalar.
              </p>
            </div>
          )}

          <div className="instalar__acoes">
            <button className="btn" type="button" onClick={agoraNao}>Agora não</button>
            {modo === "nativo" && (
              <button className="btn btn--primary instalar__btn-instalar" type="button" onClick={instalar}>
                <Download aria-hidden="true" />
                Instalar
              </button>
            )}
          </div>
          <button className="instalar__nunca" type="button" onClick={naoMostrarMais}>Não mostrar novamente</button>
        </div>
      </div>
    </div>
  );
}

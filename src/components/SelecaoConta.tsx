import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";

type TipoConta = "solo" | "duo";

type GatoProps = {
  cor: string;
  respiraDur: string;
  orelhaEDur: string;
  orelhaDDur: string;
  olhoDur: string;
};

function Gato({ cor, respiraDur, orelhaEDur, orelhaDDur, olhoDur }: GatoProps) {
  // ids únicos por instância: o clip das pálpebras não pode colidir entre gatos
  const id = useId().replace(/:/g, "");
  const olhoE = `olhoE-${id}`;
  const olhoD = `olhoD-${id}`;
  const piscar = { animation: `catBlink ${olhoDur} ease-in-out infinite`, transformBox: "fill-box", transformOrigin: "50% 0%" } as const;

  return (
    <svg viewBox="0 0 320 250" width="100%" aria-hidden="true">
      <g style={{ animation: `catBreath ${respiraDur} ease-in-out infinite`, transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        <g style={{ animation: `catEarL ${orelhaEDur} ease-in-out infinite`, transformBox: "fill-box", transformOrigin: "80% 100%" }}>
          <path d="M94 122 C84 88 86 54 100 40 Q110 32 118 48 L156 90 Z" fill={cor} stroke="#16233d" strokeWidth="7" strokeLinejoin="round" />
          <path d="M108 106 C102 82 104 62 112 54 Q118 50 122 62 L138 88 Z" fill="#f2a3ad" />
        </g>
        <g style={{ animation: `catEarR ${orelhaDDur} ease-in-out infinite`, transformBox: "fill-box", transformOrigin: "20% 100%" }}>
          <path d="M226 122 C236 88 234 54 220 40 Q210 32 202 48 L164 90 Z" fill={cor} stroke="#16233d" strokeWidth="7" strokeLinejoin="round" />
          <path d="M212 106 C218 82 216 62 208 54 Q202 50 198 62 L182 88 Z" fill="#f2a3ad" />
        </g>
        <path d="M160 60 C218 60 256 98 256 156 C256 214 216 246 160 246 C104 246 64 214 64 156 C64 98 102 60 160 60 Z" fill={cor} stroke="#16233d" strokeWidth="7" />
        <clipPath id={olhoE}><ellipse cx="126" cy="152" rx="27" ry="31" /></clipPath>
        <clipPath id={olhoD}><ellipse cx="194" cy="152" rx="27" ry="31" /></clipPath>
        <ellipse cx="126" cy="152" rx="27" ry="31" fill="#16233d" />
        <ellipse cx="194" cy="152" rx="27" ry="31" fill="#16233d" />
        <circle cx="117" cy="140" r="8.5" fill="#f4f7f4" />
        <circle cx="185" cy="140" r="8.5" fill="#f4f7f4" />
        <g clipPath={`url(#${olhoE})`}><rect x="98" y="119" width="56" height="66" fill={cor} style={piscar} /></g>
        <g clipPath={`url(#${olhoD})`}><rect x="166" y="119" width="56" height="66" fill={cor} style={piscar} /></g>
        <ellipse cx="160" cy="196" rx="35" ry="23" fill="#f4f7f4" stroke="#16233d" strokeWidth="5" />
        <path d="M151 188 Q160 184 169 188 Q166 198 160 200 Q154 198 151 188 Z" fill="#f2a3ad" stroke="#16233d" strokeWidth="3" strokeLinejoin="round" />
        <path d="M160 199 C160 206 154 208 150 204" fill="none" stroke="#16233d" strokeWidth="4" strokeLinecap="round" />
        <path d="M160 199 C160 206 166 208 170 204" fill="none" stroke="#16233d" strokeWidth="4" strokeLinecap="round" />
        <g stroke="#3d4a63" strokeWidth="5" strokeLinecap="round" opacity=".8">
          <path d="M96 182 L36 172" />
          <path d="M96 192 L32 194" />
          <path d="M224 182 L284 172" />
          <path d="M224 192 L288 194" />
        </g>
      </g>
    </svg>
  );
}

const RECURSOS_SOLO = [
  "Carteiras, limites e metas individuais",
  "Relatórios mensais privados",
  "Lançamentos rápidos em um toque",
];

const RECURSOS_DUO = [
  "Carteira compartilhada e saldos separados",
  "Divisão automática das despesas fixas",
  "Cada um vê quem pagou o quê",
];

const sombra = (ativo: boolean, outro: boolean) =>
  ativo
    ? "0 34px 70px -28px rgba(28,31,43,.36)"
    : outro
      ? "0 10px 26px -20px rgba(28,31,43,.20)"
      : "0 18px 44px -30px rgba(28,31,43,.30)";

const CARD = "relative z-[1] h-full flex flex-col gap-5 pt-[34px] px-[30px] pb-[30px] rounded-[26px] border border-solid bg-white transition-[box-shadow,border-color] duration-[420ms] ease-[ease]";
const WRAP = "relative flex-[1_1_340px] max-w-[400px] cursor-pointer transition-transform duration-[420ms] ease-[cubic-bezier(.2,.8,.2,1)]";
const GATO_WRAP = "absolute left-1/2 bottom-full pointer-events-none [transition:transform_.46s_cubic-bezier(.22,1.2,.36,1),opacity_.3s_ease]";
const EXTRA = "overflow-hidden [transition:max-height_.42s_cubic-bezier(.2,.8,.2,1),opacity_.32s_ease]";
const EXTRA_P = "mt-1 mb-0 pt-4 border-t border-dashed border-[rgba(28,31,43,.14)] text-[13.5px] leading-[1.6] text-[#606a80]";
const TITULO = "m-0 font-['Sora',sans-serif] text-[27px] font-normal tracking-[-.035em] leading-[1.2]";
const BOTAO = "mt-auto py-3.5 px-5 border-none rounded-[14px] bg-[#1c1f2b] text-white text-[14.5px] font-semibold cursor-pointer transition-[background] duration-[250ms] ease-[ease]";

export type SelecaoContaProps = {
  onEscolher?: (tipo: TipoConta) => void;
};

export function SelecaoConta({ onEscolher }: SelecaoContaProps) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<TipoConta | null>(null);
  const [escolha, setEscolha] = useState<TipoConta | null>(null);

  const selecionar = (tipo: TipoConta) => {
    setEscolha(tipo);
    onEscolher?.(tipo);
  };

  // o card só marca a escolha (como no protótipo); o botão confirma e segue o fluxo
  const confirmar = (tipo: TipoConta) => {
    selecionar(tipo);
    navigate(tipo === "solo" ? "/" : "/acesso/config-duo");
  };

  const soloAtivo = hover === "solo";
  const duoAtivo = hover === "duo";
  const soloOutro = hover !== null && !soloAtivo;
  const duoOutro = hover !== null && !duoAtivo;

  const escolhaLabel = escolha === "solo" ? "Conta solo" : escolha === "duo" ? "Conta duo" : "nenhuma ainda";

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-[54px] pt-[90px] px-8 pb-20 font-['Manrope',system-ui,sans-serif] text-[#1c1f2b] bg-[#f5f6fb] overflow-x-hidden selection:bg-[rgba(111,92,240,.22)]">
      <div className="pointer-events-none absolute -top-[180px] left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-[50%] bg-[rgba(78,158,121,.10)] blur-[10px]" />

      <header className="relative flex flex-col items-center gap-4 text-center max-w-[620px] [animation:mRise_.7s_cubic-bezier(.2,.8,.2,1)_both]">
        <img src="/uploads/Untitled-removebg-preview-4dfda8a5.png" alt="Mimo" className="block h-[62px] w-auto" />
        <h1 className="mt-1.5 mb-0 font-['Sora',sans-serif] text-[40px] font-light tracking-[-.04em] leading-[1.15] text-pretty">
          Como você quer usar o Mimo?
        </h1>
        <p className="m-0 text-[15.5px] leading-[1.6] text-[#606a80] text-pretty">
          Escolha o tipo de conta agora. Dá para mudar depois nas configurações.
        </p>
      </header>

      <div className="relative flex flex-wrap items-stretch justify-center gap-[30px] w-full max-w-[860px] pt-[150px]">
        <div
          onMouseEnter={() => setHover("solo")}
          onMouseLeave={() => setHover(null)}
          onClick={() => selecionar("solo")}
          className={WRAP}
          style={{ transform: soloAtivo ? "translateY(-14px) scale(1.035)" : soloOutro ? "scale(.98)" : "none" }}
        >
          <div
            className={`${GATO_WRAP} w-[186px] -mb-[26px]`}
            style={{
              transform: soloAtivo ? "translateX(-50%) translateY(0) rotate(-2deg)" : "translateX(-50%) translateY(56px) scale(.9)",
              opacity: soloAtivo ? 1 : 0,
            }}
          >
            <Gato cor="#4e9e79" respiraDur="4.8s" orelhaEDur="9s" orelhaDDur="11s" olhoDur="7.5s" />
          </div>

          <div
            className={CARD}
            style={{
              boxShadow: sombra(soloAtivo, soloOutro),
              borderColor: soloAtivo ? "rgba(78,158,121,.55)" : "rgba(28,31,43,.09)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] tracking-[.12em] uppercase text-[#8790a6]">Conta solo</span>
              <span className="px-[11px] py-[5px] rounded-full bg-[rgba(78,158,121,.12)] text-[#2f7d5c] text-[11.5px] font-bold">1 pessoa</span>
            </div>
            <h2 className={TITULO}>
              Só o seu dinheiro,
              <br />
              do seu jeito
            </h2>
            <div className="flex flex-col gap-[11px] text-sm leading-[1.5] text-[#4a5468]">
              {RECURSOS_SOLO.map((item) => (
                <div key={item} className="flex gap-2.5">
                  <span className="text-[#4e9e79] font-bold">—</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className={EXTRA} style={{ maxHeight: soloAtivo ? 150 : 0, opacity: soloAtivo ? 1 : 0 }}>
              <p className={EXTRA_P}>
                O painel abre direto no seu saldo. Nenhuma movimentação é compartilhada com outra pessoa.
              </p>
            </div>
            <button type="button" onClick={() => confirmar("solo")} className={`${BOTAO} hover:bg-[#2f7d5c]`}>
              Começar sozinho
            </button>
          </div>
        </div>

        <div
          onMouseEnter={() => setHover("duo")}
          onMouseLeave={() => setHover(null)}
          onClick={() => selecionar("duo")}
          className={WRAP}
          style={{ transform: duoAtivo ? "translateY(-14px) scale(1.035)" : duoOutro ? "scale(.98)" : "none" }}
        >
          <div
            className={`${GATO_WRAP} w-[172px] -mb-[22px]`}
            style={{
              transform: duoAtivo ? "translateX(-96%) translateY(0) rotate(-6deg)" : "translateX(-70%) translateY(58px) scale(.9)",
              opacity: duoAtivo ? 1 : 0,
            }}
          >
            <Gato cor="#4e9e79" respiraDur="5.4s" orelhaEDur="9s" orelhaDDur="11s" olhoDur="6.2s" />
          </div>
          <div
            className={`${GATO_WRAP} w-[172px] -mb-[26px] [transition-delay:.07s]`}
            style={{
              transform: duoAtivo ? "translateX(-4%) translateY(0) rotate(7deg)" : "translateX(-30%) translateY(60px) scale(.9)",
              opacity: duoAtivo ? 1 : 0,
            }}
          >
            <Gato cor="#e2a24f" respiraDur="4.2s" orelhaEDur="10.4s" orelhaDDur="8.2s" olhoDur="8.6s" />
          </div>

          <div
            className={CARD}
            style={{
              boxShadow: sombra(duoAtivo, duoOutro),
              borderColor: duoAtivo ? "rgba(226,162,79,.6)" : "rgba(28,31,43,.09)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] tracking-[.12em] uppercase text-[#8790a6]">Conta duo</span>
              <span className="px-[11px] py-[5px] rounded-full bg-[rgba(226,162,79,.16)] text-[#9a6a15] text-[11.5px] font-bold">2 pessoas</span>
            </div>
            <h2 className={TITULO}>
              As contas da casa,
              <br />
              divididas em dois
            </h2>
            <div className="flex flex-col gap-[11px] text-sm leading-[1.5] text-[#4a5468]">
              {RECURSOS_DUO.map((item) => (
                <div key={item} className="flex gap-2.5">
                  <span className="text-[#e2a24f] font-bold">—</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className={EXTRA} style={{ maxHeight: duoAtivo ? 150 : 0, opacity: duoAtivo ? 1 : 0 }}>
              <p className={EXTRA_P}>
                Convide a outra pessoa por e-mail. Cada perfil mantém seus lançamentos pessoais fora da carteira comum.
              </p>
            </div>
            <button type="button" onClick={() => confirmar("duo")} className={`${BOTAO} hover:bg-[#b8801f]`}>
              Convidar alguém
            </button>
          </div>
        </div>
      </div>

      <p className="relative m-0 text-[13px] text-[#8790a6]">
        Selecionado: <strong className="text-[#1c1f2b] font-semibold">{escolhaLabel}</strong>
      </p>
    </div>
  );
}

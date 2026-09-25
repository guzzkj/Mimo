import { useId } from "react";

// Mascote portado de docs/ref/Gato.dc.html: cores, variante "tabby" (listras
// do gato âmbar da conta Duo), versão só com a cabeça (corpo=false) e as cinco
// expressões, que trocam por cross-fade de opacidade como no protótipo.
// Os keyframes catBreath/catEarL/catEarR/catBlink vêm de legacy-desktop.css.

export type Expressao = "padrao" | "curioso" | "atento" | "feliz" | "preocupado";

interface Props {
  cor?: string;
  expressao?: Expressao;
  tabby?: boolean;
  corpo?: boolean;
  corListra?: string;
}

const TRACO = "var(--gato-traco, #16233d)";
const op = (on: boolean) => ({ opacity: on ? 1 : 0, transition: "opacity .22s ease" });

export function Gato({ cor = "#4e9e79", expressao = "padrao", tabby = false, corpo = true, corListra = "#b8801f" }: Props) {
  const uid = useId().replace(/:/g, "");
  const idE = `${uid}E`;
  const idD = `${uid}D`;
  const e = expressao;

  return (
    <svg viewBox={corpo ? "0 0 320 300" : "0 0 320 250"} width="100%" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <g style={{ animation: "catBreath 4.8s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        <g style={{ animation: "catEarL 9s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "80% 100%" }}>
          <path d="M94 122 C84 88 86 54 100 40 Q110 32 118 48 L156 90 Z" fill={cor} stroke={TRACO} strokeWidth="7" strokeLinejoin="round" />
          <path d="M108 106 C102 82 104 62 112 54 Q118 50 122 62 L138 88 Z" fill="#f2a3ad" />
        </g>
        <g style={{ animation: "catEarR 11s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "20% 100%" }}>
          <path d="M226 122 C236 88 234 54 220 40 Q210 32 202 48 L164 90 Z" fill={cor} stroke={TRACO} strokeWidth="7" strokeLinejoin="round" />
          <path d="M212 106 C218 82 216 62 208 54 Q202 50 198 62 L182 88 Z" fill="#f2a3ad" />
        </g>
        {corpo && (
          <g>
            <path d="M60 300 C60 240 100 214 160 214 C220 214 260 240 260 300 Z" fill={cor} stroke={TRACO} strokeWidth="7" strokeLinejoin="round" />
            <path d="M160 214 C188 214 210 221 226 232 C208 268 186 288 160 300 C134 288 112 268 94 232 C110 221 132 214 160 214 Z" fill="#f4f7f4" stroke={TRACO} strokeWidth="6" strokeLinejoin="round" />
          </g>
        )}
        <path d="M160 60 C218 60 256 98 256 156 C256 214 216 246 160 246 C104 246 64 214 64 156 C64 98 102 60 160 60 Z" fill={cor} stroke={TRACO} strokeWidth="7" />
        {tabby && (
          <g opacity={0.85} stroke={corListra} strokeWidth="7" strokeLinecap="round" fill="none">
            <path d="M142 74 Q146 86 144 98" />
            <path d="M160 70 L160 96" />
            <path d="M178 74 Q174 86 176 98" />
          </g>
        )}

        <g style={op(e === "padrao")}>
          <clipPath id={idE}><ellipse cx="126" cy="152" rx="27" ry="31" /></clipPath>
          <clipPath id={idD}><ellipse cx="194" cy="152" rx="27" ry="31" /></clipPath>
          <ellipse cx="126" cy="152" rx="27" ry="31" fill="#16233d" />
          <ellipse cx="194" cy="152" rx="27" ry="31" fill="#16233d" />
          <circle cx="117" cy="140" r="8.5" fill="#f4f7f4" />
          <circle cx="185" cy="140" r="8.5" fill="#f4f7f4" />
          <circle cx="133" cy="164" r="4" fill="#f4f7f4" opacity=".75" />
          <circle cx="201" cy="164" r="4" fill="#f4f7f4" opacity=".75" />
          <g clipPath={`url(#${idE})`}><rect x="98" y="119" width="56" height="66" fill={cor} style={{ animation: "catBlink 7.5s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "50% 0%" }} /></g>
          <g clipPath={`url(#${idD})`}><rect x="166" y="119" width="56" height="66" fill={cor} style={{ animation: "catBlink 7.5s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "50% 0%" }} /></g>
        </g>

        <g style={op(e === "curioso")}>
          <ellipse cx="126" cy="152" rx="27" ry="31" fill="#16233d" />
          <ellipse cx="194" cy="152" rx="27" ry="31" fill="#16233d" />
          <circle cx="134" cy="136" r="8.5" fill="#f4f7f4" />
          <circle cx="202" cy="136" r="8.5" fill="#f4f7f4" />
          <circle cx="118" cy="164" r="3.5" fill="#f4f7f4" opacity=".55" />
          <circle cx="186" cy="164" r="3.5" fill="#f4f7f4" opacity=".55" />
          <path d="M176 104 Q196 94 216 106" fill="none" stroke={TRACO} strokeWidth="6" strokeLinecap="round" />
        </g>

        <g style={op(e === "atento")}>
          <ellipse cx="126" cy="156" rx="26" ry="17" fill="#16233d" />
          <ellipse cx="194" cy="156" rx="26" ry="17" fill="#16233d" />
          <circle cx="117" cy="150" r="6" fill="#f4f7f4" />
          <circle cx="185" cy="150" r="6" fill="#f4f7f4" />
          <path d="M100 122 Q126 112 150 120" fill="none" stroke={TRACO} strokeWidth="6" strokeLinecap="round" />
          <path d="M170 120 Q194 112 220 122" fill="none" stroke={TRACO} strokeWidth="6" strokeLinecap="round" />
        </g>

        <g style={op(e === "feliz")} fill="none" stroke="#16233d" strokeWidth="8" strokeLinecap="round">
          <path d="M104 160 Q126 136 148 160" />
          <path d="M172 160 Q194 136 216 160" />
        </g>

        <g style={op(e === "preocupado")}>
          <ellipse cx="126" cy="158" rx="25" ry="27" fill="#16233d" />
          <ellipse cx="194" cy="158" rx="25" ry="27" fill="#16233d" />
          <circle cx="118" cy="148" r="7" fill="#f4f7f4" />
          <circle cx="186" cy="148" r="7" fill="#f4f7f4" />
          <path d="M102 126 Q124 116 148 110" fill="none" stroke={TRACO} strokeWidth="6" strokeLinecap="round" />
          <path d="M172 110 Q196 116 218 126" fill="none" stroke={TRACO} strokeWidth="6" strokeLinecap="round" />
        </g>

        <ellipse cx="160" cy="196" rx="35" ry="23" fill="#f4f7f4" stroke={TRACO} strokeWidth="5" />
        <path d="M151 188 Q160 184 169 188 Q166 198 160 200 Q154 198 151 188 Z" fill="#f2a3ad" stroke={TRACO} strokeWidth="3" strokeLinejoin="round" />
        <path d="M160 199 C160 206 154 208 150 204" fill="none" stroke={TRACO} strokeWidth="4" strokeLinecap="round" />
        <path d="M160 199 C160 206 166 208 170 204" fill="none" stroke={TRACO} strokeWidth="4" strokeLinecap="round" />
        <g stroke="var(--gato-bigode, #3d4a63)" strokeWidth="5" strokeLinecap="round" opacity=".8">
          <path d="M96 182 L36 172" />
          <path d="M96 192 L32 194" />
          <path d="M98 202 L38 216" />
          <path d="M224 182 L284 172" />
          <path d="M224 192 L288 194" />
          <path d="M222 202 L282 216" />
        </g>
      </g>
    </svg>
  );
}

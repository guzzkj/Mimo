// Definições SVG do mascote Mimo, portadas 1:1 do index.html original.
// O corpo é desenhado uma vez (symbol #mimo-corpo) e reusado via <use> em
// cada expressão, exatamente como no app vanilla.
export function MascotDefs() {
  return (
    <svg className="mimo-defs" aria-hidden="true" focusable="false">
      <symbol id="mimo-corpo" viewBox="0 0 320 300">
        <g className="mascot__ear-l">
          <path d="M94 122 C84 88 86 54 100 40 Q110 32 118 48 L156 90 Z" fill="#4e9e79" stroke="var(--gato-traco)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M108 106 C102 82 104 62 112 54 Q118 50 122 62 L138 88 Z" fill="#f2a3ad" />
        </g>
        <g className="mascot__ear-r">
          <path d="M226 122 C236 88 234 54 220 40 Q210 32 202 48 L164 90 Z" fill="#4e9e79" stroke="var(--gato-traco)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M212 106 C218 82 216 62 208 54 Q202 50 198 62 L182 88 Z" fill="#f2a3ad" />
        </g>
        <path d="M60 300 C60 240 100 214 160 214 C220 214 260 240 260 300 Z" fill="#4e9e79" stroke="var(--gato-traco)" strokeWidth="7" strokeLinejoin="round" />
        <path d="M160 214 C188 214 210 221 226 232 C208 268 186 288 160 300 C134 288 112 268 94 232 C110 221 132 214 160 214 Z" fill="#f4f7f4" stroke="var(--gato-traco)" strokeWidth="6" strokeLinejoin="round" />
        <path d="M160 60 C218 60 256 98 256 156 C256 214 216 246 160 246 C104 246 64 214 64 156 C64 98 102 60 160 60 Z" fill="#4e9e79" stroke="var(--gato-traco)" strokeWidth="7" />
        <ellipse cx="160" cy="196" rx="35" ry="23" fill="#f4f7f4" stroke="var(--gato-traco)" strokeWidth="5" />
        <path d="M151 188 Q160 184 169 188 Q166 198 160 200 Q154 198 151 188 Z" fill="#f2a3ad" stroke="var(--gato-traco)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M160 199 C160 206 154 208 150 204" fill="none" stroke="var(--gato-traco)" strokeWidth="4" strokeLinecap="round" />
        <path d="M160 199 C160 206 166 208 170 204" fill="none" stroke="var(--gato-traco)" strokeWidth="4" strokeLinecap="round" />
        <g stroke="var(--gato-bigode)" strokeWidth="5" strokeLinecap="round" opacity=".8">
          <path d="M96 182 L36 172" />
          <path d="M96 192 L32 194" />
          <path d="M98 202 L38 216" />
          <path d="M224 182 L284 172" />
          <path d="M224 192 L288 194" />
          <path d="M222 202 L282 216" />
        </g>
      </symbol>

      {/* Padrão: olhos redondos, que piscam */}
      <symbol id="mimo-gato" viewBox="0 0 320 300">
        <g className="mascot__body">
          <use href="#mimo-corpo" />
          <clipPath id="mimoOlhoE"><ellipse cx="126" cy="152" rx="27" ry="31" /></clipPath>
          <clipPath id="mimoOlhoD"><ellipse cx="194" cy="152" rx="27" ry="31" /></clipPath>
          <ellipse cx="126" cy="152" rx="27" ry="31" fill="#16233d" />
          <ellipse cx="194" cy="152" rx="27" ry="31" fill="#16233d" />
          <circle cx="117" cy="140" r="8.5" fill="#f4f7f4" />
          <circle cx="185" cy="140" r="8.5" fill="#f4f7f4" />
          <circle cx="133" cy="164" r="4" fill="#f4f7f4" opacity=".75" />
          <circle cx="201" cy="164" r="4" fill="#f4f7f4" opacity=".75" />
          <g clipPath="url(#mimoOlhoE)"><rect className="mascot__lid" x="98" y="119" width="56" height="66" fill="#4e9e79" /></g>
          <g clipPath="url(#mimoOlhoD)"><rect className="mascot__lid" x="166" y="119" width="56" height="66" fill="#4e9e79" /></g>
        </g>
      </symbol>

      {/* Curioso: olhando para cima, uma sobrancelha erguida */}
      <symbol id="mimo-gato-curioso" viewBox="0 0 320 300">
        <g className="mascot__body">
          <use href="#mimo-corpo" />
          <ellipse cx="126" cy="152" rx="27" ry="31" fill="#16233d" />
          <ellipse cx="194" cy="152" rx="27" ry="31" fill="#16233d" />
          <circle cx="134" cy="136" r="8.5" fill="#f4f7f4" />
          <circle cx="202" cy="136" r="8.5" fill="#f4f7f4" />
          <circle cx="118" cy="164" r="3.5" fill="#f4f7f4" opacity=".55" />
          <circle cx="186" cy="164" r="3.5" fill="#f4f7f4" opacity=".55" />
          <path d="M176 104 Q196 94 216 106" fill="none" stroke="var(--gato-traco)" strokeWidth="6" strokeLinecap="round" />
        </g>
      </symbol>

      {/* Atento: olhos apertados de quem está procurando */}
      <symbol id="mimo-gato-atento" viewBox="0 0 320 300">
        <g className="mascot__body">
          <use href="#mimo-corpo" />
          <ellipse cx="126" cy="156" rx="26" ry="17" fill="#16233d" />
          <ellipse cx="194" cy="156" rx="26" ry="17" fill="#16233d" />
          <circle cx="117" cy="150" r="6" fill="#f4f7f4" />
          <circle cx="185" cy="150" r="6" fill="#f4f7f4" />
          <path d="M100 122 Q126 112 150 120" fill="none" stroke="var(--gato-traco)" strokeWidth="6" strokeLinecap="round" />
          <path d="M170 120 Q194 112 220 122" fill="none" stroke="var(--gato-traco)" strokeWidth="6" strokeLinecap="round" />
        </g>
      </symbol>

      {/* Tranquilo: olhos fechados em arco */}
      <symbol id="mimo-gato-feliz" viewBox="0 0 320 300">
        <g className="mascot__body">
          <use href="#mimo-corpo" />
          <g fill="none" stroke="#16233d" strokeWidth="8" strokeLinecap="round">
            <path d="M104 160 Q126 136 148 160" />
            <path d="M172 160 Q194 136 216 160" />
          </g>
        </g>
      </symbol>

      {/* Apreensivo: só aparece quando as saídas passam as entradas no mês */}
      <symbol id="mimo-gato-preocupado" viewBox="0 0 320 300">
        <g className="mascot__body">
          <use href="#mimo-corpo" />
          <ellipse cx="126" cy="158" rx="25" ry="27" fill="#16233d" />
          <ellipse cx="194" cy="158" rx="25" ry="27" fill="#16233d" />
          <circle cx="118" cy="148" r="7" fill="#f4f7f4" />
          <circle cx="186" cy="148" r="7" fill="#f4f7f4" />
          <path d="M102 126 Q124 116 148 110" fill="none" stroke="var(--gato-traco)" strokeWidth="6" strokeLinecap="round" />
          <path d="M172 110 Q196 116 218 126" fill="none" stroke="var(--gato-traco)" strokeWidth="6" strokeLinecap="round" />
        </g>
      </symbol>

      {/* Coração do ronronar */}
      <symbol id="mimo-coracao" viewBox="0 0 32 30">
        <path d="M16 27.5 C4.5 19 2 12 6 7 C10 2 16 4.5 16 9 C16 4.5 22 2 26 7 C30 12 27.5 19 16 27.5 Z" fill="#e8324c" stroke="var(--gato-traco)" strokeWidth="2.6" strokeLinejoin="round" />
      </symbol>

      <symbol id="mimo-rabo" viewBox="0 0 200 150">
        <g className="mascot__tail-g">
          <path d="M6 96 C64 104 116 92 138 62 C156 38 148 16 126 14 C108 12 98 26 106 38" fill="none" stroke="var(--gato-traco)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 96 C64 104 116 92 138 62 C156 38 148 16 126 14 C108 12 98 26 106 38" fill="none" stroke="#4e9e79" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M126 16 C140 18 146 32 138 48" fill="none" stroke="#f4f7f4" strokeWidth="14" strokeLinecap="round" />
        </g>
      </symbol>
    </svg>
  );
}

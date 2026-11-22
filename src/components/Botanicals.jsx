/**
 * Decorative wedding artwork from the approved prototype.
 * <SvgDefs /> renders the shared symbols once; the other components reference them.
 * Colors are set as attributes inside the symbols because page CSS cannot reach
 * into a <use> shadow tree.
 */

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="sprig" viewBox="0 0 120 120">
          <path d="M8 114 C 34 90, 62 58, 112 8" fill="none" stroke="#7D987F" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse fill="#B5C7B2" cx="30" cy="99" rx="11" ry="4.6" transform="rotate(18 30 99)" />
          <ellipse fill="#CFDCCB" cx="33" cy="80" rx="11" ry="4.6" transform="rotate(72 33 80)" />
          <ellipse fill="#B5C7B2" cx="56" cy="74" rx="12" ry="5" transform="rotate(14 56 74)" />
          <ellipse fill="#CFDCCB" cx="58" cy="52" rx="12" ry="5" transform="rotate(76 58 52)" />
          <ellipse fill="#B5C7B2" cx="82" cy="45" rx="11" ry="4.6" transform="rotate(12 82 45)" />
          <ellipse fill="#CFDCCB" cx="84" cy="25" rx="11" ry="4.6" transform="rotate(78 84 25)" />
          <ellipse fill="#B5C7B2" cx="106" cy="16" rx="8" ry="3.6" transform="rotate(40 106 16)" />
        </symbol>
        <symbol id="blossom" viewBox="0 0 40 40">
          <ellipse fill="#EDB8B0" cx="20" cy="10.5" rx="6" ry="9" />
          <ellipse fill="#F9E2DE" cx="20" cy="10.5" rx="6" ry="9" transform="rotate(72 20 20)" />
          <ellipse fill="#EDB8B0" cx="20" cy="10.5" rx="6" ry="9" transform="rotate(144 20 20)" />
          <ellipse fill="#F9E2DE" cx="20" cy="10.5" rx="6" ry="9" transform="rotate(216 20 20)" />
          <ellipse fill="#EDB8B0" cx="20" cy="10.5" rx="6" ry="9" transform="rotate(288 20 20)" />
          <circle fill="#C4A065" cx="20" cy="20" r="3.6" />
        </symbol>
        <symbol id="rings" viewBox="0 0 48 48">
          <g fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="18.5" cy="28" r="11" />
            <circle cx="29.5" cy="28" r="11" />
            <path d="M26 11.5l3.5-4.5 3.5 4.5-3.5 3.5z" strokeLinejoin="round" />
          </g>
        </symbol>
        <symbol id="heart" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z" />
        </symbol>
      </defs>
    </svg>
  )
}

function UseSymbol({ id, viewBox, className, style }) {
  return (
    <svg className={className} style={style} viewBox={viewBox} aria-hidden="true" focusable="false">
      <use href={`#${id}`} />
    </svg>
  )
}

export const Sprig = (props) => <UseSymbol id="sprig" viewBox="0 0 120 120" {...props} />
export const Blossom = (props) => <UseSymbol id="blossom" viewBox="0 0 40 40" {...props} />
export const Rings = (props) => <UseSymbol id="rings" viewBox="0 0 48 48" {...props} />
export const Heart = (props) => <UseSymbol id="heart" viewBox="0 0 24 24" {...props} />

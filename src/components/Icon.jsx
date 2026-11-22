/**
 * Line icons from the approved prototype, as a single component.
 * Icons are decorative by default (aria-hidden); give meaning via visible text or aria-label on the control.
 */
const PATHS = {
  up: <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />,
  down: <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />,
  even: <path d="M6 9.5h12M6 14.5h12" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  chevron: <path d="M15 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
  warning: <><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  edit: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.5 7.5l3 3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  dish: <><path d="M4 11h16a8 8 0 0 1-16 0z" /><path d="M12 7V4M9 7.5 8 5.5M15 7.5l1-2" /><path d="M2.5 19.5h19" /></>,
  gift: <><rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M3.5 13h17M12 9v11.5" /><path d="M12 9c-2-3.5-6-4-6-1.5S10 9 12 9zm0 0c2-3.5 6-4 6-1.5S14 9 12 9z" /></>,
  star: <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />,
  sparkle: <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />,
  sun: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  camera: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.8" /></>,
  dress: <><path d="M9 3l1.5 4h3L15 3" /><path d="M10.5 7 9 11l-4.5 10h15L15 11l-1.5-4" /><path d="M9 11h6" /></>,
  flower: <><circle cx="12" cy="9" r="2.2" /><path d="M12 6.8c0-3 3.6-3 3.6-.6 0 1.7-2 2.6-3.6 2.8M12 6.8c0-3-3.6-3-3.6-.6 0 1.7 2 2.6 3.6 2.8M14.2 9c2.6.6 2.6 4-.2 4-1.5 0-2-1.6-2-1.8M9.8 9c-2.6.6-2.6 4 .2 4 1.5 0 2-1.6 2-1.8" /><path d="M12 13.5V21M12 18c-2-2.5-4.5-2.5-5.5-1.5M12 17c1.5-2 4-2.3 5-1.3" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  car: <><path d="M5 16.5V12l2-5h10l2 5v4.5" /><path d="M3.5 12h17v4.5h-17z" /><circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></>,
}

/**
 * @param {{ name: keyof typeof PATHS, className?: string, strokeWidth?: number }} props
 */
export default function Icon({ name, className, strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.sparkle}
    </svg>
  )
}

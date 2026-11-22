import './Dock.css'

/**
 * Sticky bottom area for transient UI: the undo toast now, and the mobile balance bar (M7).
 * @param {{ children?: React.ReactNode }} props
 */
export default function Dock({ children }) {
  return <div className="dock">{children}</div>
}

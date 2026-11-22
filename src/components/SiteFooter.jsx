import { Heart, Rings } from './Botanicals.jsx'
import './SiteFooter.css'

/**
 * Shared footer: ornament and signature, plus page-specific content (disclaimers, actions).
 * @param {{ children?: React.ReactNode }} props
 */
export default function SiteFooter({ children }) {
  return (
    <footer className="site-footer">
      <div className="ornament" aria-hidden="true"><Rings className="footer-rings" /></div>
      <p className="footer-sign"><Heart />נבנה באהבה, לקראת החתונה שלנו</p>
      {children}
    </footer>
  )
}

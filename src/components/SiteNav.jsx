import { Link, NavLink } from 'react-router'
import Icon from './Icon.jsx'
import { Rings } from './Botanicals.jsx'
import './SiteNav.css'

/** Sticky top navigation shared by both pages. NavLink sets aria-current="page" on the active link. */
export default function SiteNav() {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="brand" aria-label="מתחתנים בראש שקט — לדף הבית">
          <span className="brand-mark" aria-hidden="true"><Rings /></span>
          <span className="brand-name" aria-hidden="true">מתחתנים בראש שקט</span>
        </Link>
        <nav aria-label="ניווט ראשי">
          <ul className="nav-links">
            <li>
              <NavLink to="/" end className="nav-link">
                <Icon name="gift" />
                מחשבון חתונה
              </NavLink>
            </li>
            <li>
              <NavLink to="/tasks" className="nav-link">
                <Icon name="check" strokeWidth={2.2} />
                המשימות שלנו
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

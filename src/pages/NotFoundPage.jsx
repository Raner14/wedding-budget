import { Link } from 'react-router'
import { Rings } from '../components/Botanicals.jsx'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <div className="app-inner">
      <main id="main-content" tabIndex={-1} className="not-found card">
        <div className="not-found-art" aria-hidden="true"><Rings /></div>
        <h1 id="page-title" tabIndex={-1}>הדף הזה לא נמצא</h1>
        <p>אולי הקישור השתנה. אפשר לחזור לאחד הדפים שלנו:</p>
        <div className="not-found-actions">
          <Link className="btn btn-gold" to="/">למחשבון החתונה</Link>
          <Link className="btn btn-soft" to="/tasks">למשימות שלנו</Link>
        </div>
      </main>
    </div>
  )
}

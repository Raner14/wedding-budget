import { useState } from 'react'
import Reveal from '../Reveal.jsx'
import { Heart, Sprig } from '../Botanicals.jsx'

/** Compact page header for the task planner, echoing the calculator hero (arch photo, serif title). */
export default function TasksHeader() {
  const [photoFailed, setPhotoFailed] = useState(false)
  return (
    <Reveal as="section" className="tasks-hero" aria-labelledby="page-title">
      <div className="tasks-hero-copy">
        <p className="tasks-eyebrow"><Heart />רשימת המשימות</p>
        <h1 id="page-title" tabIndex={-1}>המשימות <span>שלנו</span></h1>
        <p className="tasks-hero-sub">צעד אחר צעד, עד החופה. מוסיפים, מסמנים ונהנים מהדרך.</p>
      </div>
      <div className="mini-arch" aria-hidden="true">
        <div>
          {!photoFailed && (
            <img
              src="/images/couple-640.jpg"
              width="640"
              height="360"
              alt=""
              decoding="async"
              onError={() => setPhotoFailed(true)}
            />
          )}
        </div>
      </div>
      <Sprig className="sprig tasks-hero-sprig" />
    </Reveal>
  )
}

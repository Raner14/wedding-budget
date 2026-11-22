import { useState } from 'react'
import Reveal from '../Reveal.jsx'
import { Heart, Sprig } from '../Botanicals.jsx'

/** The small arch crops by height: ~107px tall on phones, ~175px from 640px → rendered width × 16/9. */
const MINI_SIZES = '(min-width: 640px) 311px, 191px'

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
            <picture>
              <source type="image/webp" srcSet="/images/couple-400.webp 400w, /images/couple-640.webp 640w" sizes={MINI_SIZES} />
              <img
                src="/images/couple-400.jpg"
                srcSet="/images/couple-400.jpg 400w, /images/couple-640.jpg 640w"
                sizes={MINI_SIZES}
                width="400"
                height="225"
                alt=""
                decoding="async"
                onError={() => setPhotoFailed(true)}
              />
            </picture>
          )}
        </div>
      </div>
      <Sprig className="sprig tasks-hero-sprig" />
    </Reveal>
  )
}

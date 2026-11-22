import { useState } from 'react'
import Icon from './Icon.jsx'
import Reveal from './Reveal.jsx'
import { Blossom, Heart, Rings, Sprig } from './Botanicals.jsx'
import './Hero.css'

const PHOTO_SRCSET = '/images/couple-640.jpg 640w, /images/couple-1280.jpg 1280w, /images/couple-1672.jpg 1672w'
/*
 * The frame crops with object-fit: cover by HEIGHT, so the rendered image width is
 * frame height × 16:9 → mobile 300px → ~533px, tablet 400px → ~711px, desktop 580px → ~1030px.
 */
const PHOTO_SIZES = '(min-width: 1024px) 1030px, (min-width: 640px) 711px, 533px'

export default function Hero() {
  const [photoFailed, setPhotoFailed] = useState(false)

  return (
    <section className="hero" aria-labelledby="page-title">
      <div className="hero-grid">
        <Reveal className="hero-copy">
          <p className="hero-eyebrow"><Heart />מחשבון תקציב חתונה</p>
          <h1 className="hero-title" id="page-title" tabIndex={-1}>
            מתחתנים{' '}
            <span className="hl">
              בראש שקט
              <svg className="swash" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M3 11 C 45 3, 105 2, 197 9" />
              </svg>
            </span>
          </h1>
          <p className="hero-sub">מתכננים את חתונת החלומות, בלי הפתעות בתקציב.</p>
          <div className="hero-cta">
            <a className="btn btn-gold btn-lg" href="#calculator">
              בואו נחשב את החתונה שלנו
              <Icon name="arrowDown" strokeWidth={2} />
            </a>
          </div>
          <ul className="hero-perks" aria-label="יתרונות">
            <li><Icon name="check" strokeWidth={2.2} />בלי הרשמה</li>
            <li><Icon name="lock" strokeWidth={2} />הנתונים נשארים אצלכם</li>
            <li><Icon name="clock" strokeWidth={2} />שלוש דקות</li>
          </ul>
        </Reveal>

        <Reveal as="figure" className="hero-photo">
          <div className="photo-frame">
            {photoFailed ? (
              <div className="photo-fallback" aria-hidden="true"><Rings className="photo-fallback-icon" />התמונה שלנו</div>
            ) : (
              <picture>
                <img
                  src="/images/couple-1280.jpg"
                  srcSet={PHOTO_SRCSET}
                  sizes={PHOTO_SIZES}
                  width="1672"
                  height="941"
                  alt="אנחנו, הזוג שמאחורי האתר, מחובקים ומחייכים מול שקיעה על חוף הים"
                  fetchPriority="high"
                  decoding="async"
                  onError={() => setPhotoFailed(true)}
                />
              </picture>
            )}
          </div>
          <Sprig className="sprig sprig-a" />
          <Sprig className="sprig sprig-b" />
          <Blossom className="blossom-a" />
          <figcaption className="love-note"><Heart />נבנה באהבה, לקראת החתונה שלנו</figcaption>
        </Reveal>
      </div>
    </section>
  )
}

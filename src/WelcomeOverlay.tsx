import React, { useState, useCallback, useEffect } from 'react';
import { X, ArrowRight, Smartphone, Layers, Compass, ShieldCheck } from 'lucide-react';
import { productCopy } from './productCopy';

export const STORAGE_KEY = 'devsnapkit_welcome_seen';

interface WelcomeOverlayProps {
  onOpenLegal: () => void;
  onOpenLegalPrivacy: () => void;
}

const FEATURE_CARDS = [
  {
    id: 'feature-mockup',
    badge: 'Device Frames',
    title: 'Realistic Device Frames',
    desc: 'Precision-crafted mockups: MacBook Pro, Studio Display, iPhone 17 Pro, Safari Browser, and Clay styles.',
    img: '/welcome/feature-mockup.webp',
    fallbackGrad: 'from-blue-600 via-indigo-600 to-violet-700',
    icon: Smartphone,
  },
  {
    id: 'feature-duo',
    badge: 'Dual Shots',
    title: 'Two-Image Layouts',
    desc: 'Display two screenshots in one cohesive frame with Side-by-Side, Stacked, Hero, and Vertical compositions.',
    img: '/welcome/feature-duo.webp',
    fallbackGrad: 'from-cyan-500 via-blue-600 to-indigo-700',
    icon: Layers,
  },
  {
    id: 'feature-3d',
    badge: 'Live 3D Angles',
    title: '3D Angles & Compositions',
    desc: 'Transform flat screens into studio-grade product visuals with 6 instant 3D perspective presets.',
    img: '/welcome/feature-3d.webp',
    fallbackGrad: 'from-indigo-600 via-purple-600 to-pink-600',
    icon: Compass,
  },
  {
    id: 'feature-brand',
    badge: 'Included in Free',
    title: 'Logo & QR — Free',
    desc: productCopy.free,
    img: '/welcome/feature-brand.webp',
    fallbackGrad: 'from-amber-500 via-orange-600 to-rose-600',
    icon: ShieldCheck,
  },
];

const SHOWCASE_ITEMS = [
  { id: '1', title: 'Limited Sneaker Drop', desc: 'E-commerce • Safari Light', img: '/welcome/showcase-1.webp' },
  { id: '2', title: 'SaaS Growth Dashboard', desc: 'Analytics • Emerald Glow', img: '/welcome/showcase-2.webp' },
  { id: '3', title: 'Nova Music Player', desc: 'Mobile • Retro Synthwave', img: '/welcome/showcase-3.webp' },
  { id: '4', title: 'Code Terminal Release', desc: 'Developer • Deep Slate', img: '/welcome/showcase-4.webp' },
  { id: '5', title: 'Dual Cross-Platform Duo', desc: 'Web & Mobile • Ocean', img: '/welcome/showcase-5.webp' },
  { id: '6', title: 'Light Churn Analytics', desc: 'Dashboard • Studio Silver', img: '/welcome/showcase-6.webp' },
  { id: '7', title: 'Artisan Food & Coffee', desc: 'Lifestyle • Clay Phone', img: '/welcome/showcase-7.webp' },
  { id: '8', title: 'Branded Launch Graphic', desc: 'Custom Logo + QR • Tokyo Dusk', img: '/welcome/showcase-8.webp' },
];

const HERO_SLIDES = [
  { id: '1', src: '/welcome/welcome-bg.webp', alt: 'DevSnapKit Multi-Device Studio' },
  { id: '2', src: '/welcome/welcome-bg-2.webp', alt: 'DevSnapKit 3D Perspective Studio' },
  { id: '3', src: '/welcome/welcome-bg-3.webp', alt: 'DevSnapKit Dual-Shot Cross-Platform' },
];

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  onOpenLegal,
  onOpenLegalPrivacy,
}) => {
  const [heroIndex, setHeroIndex] = useState(0);
  const [visible, setVisible] = useState<boolean>(() => {
    if (new URLSearchParams(window.location.search).get('editor') === '1') return false;
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const close = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // safe fallback for private browsing
    }
    setVisible(false);
  }, []);

  const handleLegal = useCallback(
    (type: 'terms' | 'privacy') => {
      close();
      if (type === 'terms') {
        onOpenLegal();
      } else {
        onOpenLegalPrivacy();
      }
    },
    [close, onOpenLegal, onOpenLegalPrivacy]
  );

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, close]);

  // Auto-cycle hero background slides with smooth crossfade
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="welcome-container" data-testid="welcome-overlay">
      <div className="welcome-modal">
        {/* Skip button (X) */}
        <button
          type="button"
          onClick={close}
          className="welcome-skip"
          title="Skip and go to editor (Esc)"
          aria-label="Close welcome overlay"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Container */}
        <div className="welcome-scroll">
          {/* SECTION 1: HERO */}
          <section className="welcome-hero">
            {/* Ken Burns Carousel Backgrounds */}
            <div className="welcome-hero-bg">
              {HERO_SLIDES.map((slide, idx) => (
                <div
                  key={slide.id}
                  className={`welcome-hero-slide ${idx === heroIndex ? 'active' : ''}`}
                >
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    aria-hidden="true"
                    className="welcome-kenburns-img"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
              <div className="welcome-hero-scrim" />
            </div>

            {/* Hero Foreground Content */}
            <div className="welcome-hero-content">
              {/* Brand Logo */}
              <div className="welcome-logo-pill">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <div className="w-3.5 h-3.5 rounded border border-white/90 bg-white/20" />
                </div>
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  DevSnap<span className="text-indigo-600">Kit</span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
                  Studio
                </span>
              </div>

              <h1 className="welcome-hero-title">
                Turn Screenshots into Beautiful Product Mockups
              </h1>

              <p className="welcome-hero-subtitle">
                Add device frames, backgrounds, and 3D angles to your screenshots. Create polished launch visuals directly in your browser.
              </p>

              {/* Carousel Indicators */}
              <div className="welcome-hero-dots" role="tablist" aria-label="Hero background slides">
                {HERO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === heroIndex}
                    aria-label={`Show slide ${idx + 1}`}
                    onClick={() => setHeroIndex(idx)}
                    className={`welcome-hero-dot ${idx === heroIndex ? 'active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 2: 4 FEATURE CARDS */}
          <section className="welcome-section welcome-features-section">
            <div className="welcome-section-header">
              <h2 className="welcome-section-title">Your Studio-Grade Design Companion</h2>
              <p className="welcome-section-subtitle">
                Engineered for developers, founders, and creators who need fast, professional product assets.
              </p>
            </div>

            <div className="welcome-features-grid">
              {FEATURE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.id} className="welcome-feature-card">
                    <div className="welcome-card-img-wrap">
                      <div className={`welcome-card-placeholder bg-gradient-to-tr ${card.fallbackGrad}`}>
                        <Icon className="w-12 h-12 text-white/30" />
                      </div>
                      <img
                        src={card.img}
                        alt={card.title}
                        className="welcome-card-img"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="welcome-card-badge">{card.badge}</span>
                    </div>
                    <div className="welcome-card-body">
                      <h3 className="welcome-card-title">{card.title}</h3>
                      <p className="welcome-card-desc">{card.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: SHOWCASE PRESET WALL */}
          <section className="welcome-section welcome-showcase-section">
            <div className="welcome-section-header">
              <h2 className="welcome-section-title">A Big Collection of Presets</h2>
              <p className="welcome-section-subtitle">
                The perfect result is one click away. Ready-to-export templates for any screen.
              </p>
            </div>

            <div className="welcome-showcase-grid">
              {SHOWCASE_ITEMS.map((item, idx) => (
                <div key={item.id} className="welcome-showcase-item">
                  <div className="welcome-showcase-img-wrap">
                    <div className={`welcome-showcase-placeholder bg-gradient-to-br ${
                      idx % 4 === 0 ? 'from-amber-500 via-rose-500 to-purple-600' :
                      idx % 4 === 1 ? 'from-emerald-500 via-teal-600 to-sky-600' :
                      idx % 4 === 2 ? 'from-fuchsia-600 via-purple-700 to-blue-600' :
                      'from-amber-400 via-yellow-500 to-orange-600'
                    }`}>
                      <div className="text-xs font-mono text-white/40">Demo {idx + 1}</div>
                    </div>
                    <img
                      src={item.img}
                      alt={item.title}
                      className="welcome-showcase-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="welcome-showcase-meta">
                    <div className="font-semibold text-xs text-slate-800 truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={close}
                className="welcome-secondary-explore-btn"
              >
                <span>Explore Presets</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* SECTION 4: BRAND IT — OWN IT */}
          <section className="welcome-section welcome-brand-section">
            <div className="welcome-brand-card">
              <div className="welcome-brand-content">
                <span className="welcome-brand-tag">Included in Free</span>
                <h2 className="welcome-brand-title">Logo &amp; QR — Free</h2>
                <p className="welcome-brand-desc">
                  {productCopy.free} Upload your logo and add a static QR code linking to your website.
                </p>
                <div className="welcome-brand-pricing">
                  <span className="welcome-brand-nopay">Create a branded visual for free.</span>
                </div>
              </div>
              <div className="welcome-brand-visual">
                <div className="welcome-brand-placeholder bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900">
                  <ShieldCheck className="w-16 h-16 text-amber-400/40 mb-2" />
                  <span className="text-xs font-mono text-white/50">Logo &amp; QR — Free</span>
                </div>
                <img
                  src="/welcome/welcome-brand.webp"
                  alt="Brand Customization"
                  className="welcome-brand-img"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Fixed CTA Overlay */}
        <div className="welcome-cta">
          <button
            type="button"
            onClick={close}
            className="welcome-start-btn"
          >
            Create Your First Mockup
          </button>
          <p className="welcome-legal">
            By clicking "Create Your First Mockup" you agree to our{' '}
            <button
              type="button"
              onClick={() => handleLegal('terms')}
              className="hover:underline font-medium"
            >
              Terms
            </button>{' '}
            &{' '}
            <button
              type="button"
              onClick={() => handleLegal('privacy')}
              className="hover:underline font-medium"
            >
              Privacy Policy
            </button>
          </p>
          <a href="/screenshot-beautifier/" className="text-[11px] text-slate-600 underline hover:text-slate-900">
            Explore the screenshot beautifier
          </a>
        </div>
      </div>
    </div>
  );
};

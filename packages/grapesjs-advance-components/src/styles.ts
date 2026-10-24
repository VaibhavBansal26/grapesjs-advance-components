/**
 * Base stylesheet for the blocks.
 *
 * Theming: every colour and the corner radius read a CSS custom property with a built-in
 * fallback, so with no setup the blocks look finished and a one-line override re-skins them:
 *   :root { --aac-accent: #0ea5e9; --aac-radius: 4px; }
 * Dark pages: put `data-aac-theme="dark"` on any ancestor (e.g. <body>).
 * Tokens: --aac-accent, --aac-accent-hover, --aac-accent-fg, --aac-fg, --aac-muted, --aac-border,
 *         --aac-bg (soft surface), --aac-surface, --aac-track, --aac-ring, --aac-radius, --aac-radius-lg.
 *
 * GrapesJS's CSS parser silently drops a SHORTHAND (background, border-color, border-radius,
 * outline, …) whose value contains var(). So var() only ever appears in longhand properties here,
 * built through the helpers below; test/styles.test.ts enforces it.
 */

const accent = 'var(--aac-accent,#4f46e5)';
const accentHover = 'var(--aac-accent-hover,#4338ca)';
const accentFg = 'var(--aac-accent-fg,#ffffff)';
const fg = 'var(--aac-fg,inherit)';
const muted = 'var(--aac-muted,#71717a)';
const border = 'var(--aac-border,#e4e4e7)';
const soft = 'var(--aac-bg,#fafafa)';
const surface = 'var(--aac-surface,#ffffff)';
const track = 'var(--aac-track,#e4e4e7)';
const ring = 'var(--aac-ring,rgba(79,70,229,.35))';

const SIDES = ['top', 'right', 'bottom', 'left'];
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
/** All four border colours. `border-color: var()` would be dropped, so this expands to longhands. */
const bc = (c: string) => SIDES.map((s) => `border-${s}-color:${c}`).join(';');
const box = (c: string, w = '1px') => `border-width:${w};border-style:solid;${bc(c)}`;
const side = (s: string, c: string, w = '1px') => `border-${s}-width:${w};border-${s}-style:solid;border-${s}-color:${c}`;
const rad = (v: string) => CORNERS.map((k) => `border-${k}-radius:${v}`).join(';');
const r = rad('var(--aac-radius,8px)');
const rLg = rad('var(--aac-radius-lg,14px)');
/** Shared by every block root. Folded into each rule: GrapesJS keeps only the LAST rule per selector. */
const base = `box-sizing:border-box;color:${fg}`;
const control = `width:100%;box-sizing:border-box;min-height:42px;padding:10px 12px;${box(border)};${r};background-color:${surface};color:${fg};font:inherit;transition:box-shadow .15s ease`;
const focusRing = `outline-width:2px;outline-style:solid;outline-color:${ring};outline-offset:2px`;

export const baseCss = `
.aac-faq{${base};margin:24px 0;${box(border)};${r};background-color:${surface};overflow:hidden}
.aac-faq details{${side('bottom', border)}}
.aac-faq details:last-child{border-bottom-width:0}
.aac-faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;list-style:none;font-weight:600;padding:16px 20px}
.aac-faq summary::-webkit-details-marker{display:none}
.aac-faq summary:hover{background-color:${soft}}
.aac-faq summary:focus-visible{${focusRing};outline-offset:-2px}
.aac-faq summary::after{content:"";flex:none;width:8px;height:8px;margin-right:4px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s ease;opacity:.6}
.aac-faq details[open]>summary::after{transform:rotate(225deg)}
.aac-faq details>div{padding:0 20px 18px;color:${muted};line-height:1.65}

.aac-divider{border-top-width:1px;border-top-style:solid;border-top-color:${border};border-bottom-width:0;margin:32px 0}

.aac-progress{${base};height:12px;margin:16px 0;background-color:${track};border-radius:999px;overflow:hidden}
.aac-progress-inner{height:100%;width:65%;border-radius:999px;background-color:${accent};transition:width .4s ease}

.aac-field{${base};display:flex;flex-direction:column;gap:6px;margin:16px 0}
.aac-field label{font-size:.875rem;font-weight:600}
.aac-field input:not([type=checkbox]):not([type=radio]),.aac-field select{${control}}
.aac-field textarea{${control};min-height:110px;resize:vertical}
.aac-field input:focus-visible,.aac-field select:focus-visible,.aac-field textarea:focus-visible{${bc(accent)};box-shadow:0 0 0 3px ${ring};outline-style:none}
.aac-field input[type=checkbox],.aac-field input[type=radio]{width:18px;height:18px;margin:0;accent-color:${accent}}
.aac-field--inline{flex-direction:row;align-items:center;gap:10px}
.aac-field--inline label{font-weight:500}

.aac-button{display:inline-block;margin:8px 0;padding:11px 22px;border-width:0;${r};background-color:${accent};color:${accentFg};font:inherit;font-weight:600;line-height:1.2;text-align:center;text-decoration:none;cursor:pointer;transition:background-color .15s ease,transform .05s ease,box-shadow .15s ease}
.aac-button:hover{background-color:${accentHover}}
.aac-button:active{transform:translateY(1px)}
.aac-button:focus-visible{${focusRing}}
.aac-button--outline{background-color:transparent;color:${accent};${box(accent)}}
.aac-button--outline:hover{background-color:${soft}}
.aac-checkout[aria-busy=true]{opacity:.6;cursor:progress}
.aac-checkout[data-error]::after{content:attr(data-error);display:block;font-size:.8rem;font-weight:500;margin-top:6px;color:#dc2626}

.aac-pricing{${base};width:100%;max-width:340px;margin:24px auto;padding:32px 28px;${box(border)};${rLg};background-color:${surface};box-shadow:var(--aac-shadow,0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.06));text-align:center}
.aac-pricing h3{margin:0;font-size:1.05rem;letter-spacing:.02em;color:${muted}}
.aac-pricing-price{margin:10px 0 20px;font-size:2.75rem;line-height:1;font-weight:700}
.aac-pricing-amount{letter-spacing:-.02em}
.aac-pricing-price small{font-size:1rem;font-weight:500;color:${muted}}
.aac-pricing ul{margin:0 0 24px;padding:0;list-style:none;text-align:left}
.aac-pricing li{display:flex;gap:10px;align-items:baseline;padding:7px 0}
.aac-pricing li::before{content:"\\2713";flex:none;font-weight:700;color:${accent}}
.aac-pricing .aac-button{display:block;width:100%;margin:0;box-sizing:border-box}

.aac-slider{${base};display:flex;margin:24px 0;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;${box(border)};${rLg};background-color:${soft}}
.aac-slide{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;margin:0;padding:56px 40px;text-align:center}
.aac-slide-quote{max-width:42ch;margin:0 auto 16px;font-size:1.4rem;line-height:1.45;font-weight:500}
.aac-slide-source{margin:0;font-size:.9rem;color:${muted}}

.aac-quote{${base};margin:28px 0;padding:6px 0 6px 20px;${side('left', accent, '4px')};font-size:1.2rem;line-height:1.55;font-style:italic}
.aac-quote cite{display:block;margin-top:10px;font-size:.9rem;font-style:normal;color:${muted}}

.aac-header{${base};display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 28px;padding:18px 28px;background-color:${surface};${side('bottom', border)}}
.aac-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 28px;padding:18px 28px;background-color:${surface};${side('top', border)};box-sizing:border-box;color:${muted};font-size:.9rem}
.aac-header nav,.aac-footer nav{display:flex;flex-wrap:wrap;gap:6px 22px}
.aac-header a,.aac-footer a{color:${muted};text-decoration:none;font-weight:500}
.aac-header a:hover,.aac-footer a:hover{color:${accent}}
.aac-header a:focus-visible,.aac-footer a:focus-visible{${focusRing};border-radius:4px}

.aac-form{${base};max-width:560px;margin:24px auto}
.aac-form .aac-button{margin-top:8px}
.aac-form[aria-busy=true] .aac-button{opacity:.6;cursor:progress}
.aac-form-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.aac-form-row .aac-field{flex:1 1 220px;margin:0}
.aac-form-row .aac-button{margin:0}
.aac-form-status{min-height:1.4em;margin:10px 0 0;font-size:.9rem}
.aac-form-status[data-state=success]{color:#16a34a}
.aac-form-status[data-state=error]{color:#dc2626}
.aac-form-status[data-state=pending]{color:${muted}}
.aac-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}

.aac-hero{${base};padding:88px 24px;text-align:center}
.aac-hero h1{max-width:20ch;margin:0 auto 16px;font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;letter-spacing:-.02em}
.aac-hero p{max-width:52ch;margin:0 auto 28px;font-size:1.15rem;line-height:1.6;color:${muted}}
.aac-hero-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.aac-hero-actions .aac-button{margin:0}

.aac-features{${base};display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px;padding:24px 0}
.aac-feature{padding:24px;${box(border)};${rLg};background-color:${surface}}
.aac-feature h3{margin:0 0 8px;font-size:1.1rem}
.aac-feature p{margin:0;color:${muted};line-height:1.6}

.aac-cta{${base};margin:32px 0;padding:56px 24px;${rLg};background-color:${soft};text-align:center}
.aac-cta h2{margin:0 0 8px;font-size:1.75rem}
.aac-cta p{margin:0 0 22px;color:${muted}}
.aac-cta .aac-button{margin:0}

.aac-section-title{margin:64px 0 12px;text-align:center;font-size:1.75rem;line-height:1.2}
.aac-prose{max-width:68ch;margin:40px auto;line-height:1.7}
.aac-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;align-items:stretch;justify-items:center;margin:24px 0}
.aac-pricing-grid .aac-pricing{margin:0}
.aac-cols-1{grid-template-columns:minmax(0,1fr)}
.aac-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.aac-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}

.aac-testimonials{${base};display:grid;gap:20px;margin:24px 0}
.aac-testimonial{margin:0;padding:24px;${box(border)};${rLg};background-color:${surface}}
.aac-testimonial blockquote{margin:0 0 16px;line-height:1.6}
.aac-testimonial figcaption{display:flex;flex-direction:column;gap:2px}
.aac-testimonial strong{font-weight:600}
.aac-testimonial figcaption span{font-size:.875rem;color:${muted}}

.aac-logos{${base};margin:32px 0;text-align:center}
.aac-logos-title{margin:0 0 16px;font-size:.875rem;letter-spacing:.06em;text-transform:uppercase;color:${muted}}
.aac-logos-list{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 40px;margin:0;padding:0;list-style:none}
.aac-logos-list li{font-size:1.35rem;font-weight:700;letter-spacing:-.01em}
.aac-logos--muted .aac-logos-list li{opacity:.55}

.aac-team{${base};display:grid;gap:20px;margin:24px 0}
.aac-member{padding:24px;${box(border)};${rLg};background-color:${surface};text-align:center}
.aac-avatar{display:flex;align-items:center;justify-content:center;width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background-color:${soft};${box(border)};font-weight:700;font-size:1.25rem;color:${accent}}
.aac-member h3{margin:0 0 4px;font-size:1.05rem}
.aac-member p{margin:0;color:${muted}}

.aac-blog{${base};display:grid;gap:20px;margin:24px 0}
.aac-blog--list{grid-template-columns:minmax(0,1fr)}
.aac-blog--grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.aac-post{padding:22px 24px;${box(border)};${rLg};background-color:${surface}}
.aac-post-meta{margin:0 0 6px;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:${muted}}
.aac-post h3{margin:0 0 8px;font-size:1.2rem;line-height:1.3}
.aac-post h3 a{color:inherit;text-decoration:none}
.aac-post h3 a:hover{color:${accent}}
.aac-post-excerpt{margin:0;color:${muted};line-height:1.6}

.aac-site{min-height:100vh}
.aac-page{max-width:1040px;margin:0 auto;padding:0 24px 64px}

[data-aac-theme=dark]{--aac-fg:#f4f4f5;--aac-muted:#a1a1aa;--aac-border:#3f3f46;--aac-bg:#1c1c21;--aac-surface:#141418;--aac-track:#3f3f46;--aac-accent:#8b84ff;--aac-accent-hover:#a39dff;--aac-accent-fg:#101014;--aac-ring:rgba(139,132,255,.45);background-color:#0e0e11;color:#f4f4f5}

@media (max-width:640px){
.aac-hero{padding:56px 18px}
.aac-header{padding:14px 18px}
.aac-footer{padding:14px 18px}
.aac-slide{padding:36px 22px}
.aac-slide-quote{font-size:1.15rem}
.aac-pricing{max-width:none}
.aac-cols-2,.aac-cols-3{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){
.aac-faq summary::after,.aac-progress-inner,.aac-button,.aac-field input,.aac-field select,.aac-field textarea{transition:none}
}
`;

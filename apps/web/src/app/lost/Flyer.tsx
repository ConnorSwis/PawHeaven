import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './flyer.css';
import { callLine, fitSize, formatPhone, hasPetFacts, headlineText, longDate, reachText, tabLines, type FlyerData } from './flyer-text';

const MIN_FIT = 0.6;
const MAX_FIT = 1.5;
const STEP = 0.04;

/**
 * The sheet that gets printed. It is always laid out at its printed size (816 x 1054 px) and the preview is that same
 * drawing scaled down, so wrapping, the fit below, and the printed page agree exactly. Every field is optional:
 * whatever is empty is left out of the printed sheet, and on screen a dashed hint shows where it will go. The facts
 * column grows its text to fill the space and shrinks it again if there is too much, so nothing is cut off.
 */
export function Flyer({ data, photoUrl, onOverflow }: { data: FlyerData; photoUrl: string | null; onOverflow?: (overflowing: boolean) => void }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const last = useRef<boolean | null>(null);
  const report = useRef(onOverflow);
  report.current = onOverflow;

  const fit = () => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    let scale = MAX_FIT;
    content.style.setProperty('--fit', String(scale));
    while (scale > MIN_FIT && content.offsetHeight > box.clientHeight - 2) {
      scale = Math.round((scale - STEP) * 100) / 100;
      content.style.setProperty('--fit', String(scale));
    }
    const overflowing = content.offsetHeight > box.clientHeight - 2;
    if (last.current !== overflowing) { last.current = overflowing; report.current?.(overflowing); }
  };

  // Refit whenever the words change, when the font arrives, and just before printing.
  useLayoutEffect(fit);
  useEffect(() => {
    void document.fonts?.ready.then(() => fit());
    window.addEventListener('beforeprint', fit);
    return () => window.removeEventListener('beforeprint', fit);
  }, []);

  // The preview is the printed sheet scaled to the width it has been given.
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth) setScale(element.clientWidth / 816); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const v = (value: string) => value.trim();
  const headline = headlineText(data);
  const name = v(data.petName);
  const reach = reachText(data);
  const phone = formatPhone(data.contactPhone);
  const when = longDate(data.lastSeenWhen);
  const where = v(data.lastSeenWhere);
  const who = [v(data.contactName), phone && v(data.contactEmail)].filter(Boolean).join(' · ');
  const tab = data.tabs ? tabLines(data) : null;
  const factsEmpty = !hasPetFacts(data);
  const reachSize = fitSize(phone || v(data.contactEmail), 44, 4.2, 1.8, 0.62);

  return (
    <div className="fl-frame" ref={frame} style={{ '--s': scale } as CSSProperties}>
    <div className="fl-scaler">
    <article id="lost-pet-flyer" aria-label="Flyer preview" className="fl">
      <p className="fl-head" style={{ fontSize: `${fitSize(headline, 44, 6.6, 2.6)}em` }}>{headline}</p>

      <div className="fl-main" data-photo={photoUrl ? 'yes' : 'none'}>
        {photoUrl && (
          <div className="fl-photo" data-fit={data.wholePhoto ? 'whole' : 'fill'}>
            <img src={photoUrl} alt={name ? `Photo of ${name}` : 'Photo of the lost pet'} />
          </div>
        )}
        <div className="fl-facts" ref={outer}>
          <div className="fl-facts-in" ref={inner}>
            {!photoUrl && <p className="fl-ghost fl-ghost-strip">A clear, recent photo helps the most. Add one in the form.</p>}
            {name && (
              <div>
                <p className="fl-answers">Answers to</p>
                <p className="fl-name" style={{ fontSize: `${name.length <= 8 ? 3.2 : name.length <= 14 ? 2.4 : 1.9}em` }}>{name}</p>
              </div>
            )}
            <dl style={{ display: 'grid', gap: '0.75em' }}>
              {v(data.breed) && <div className="fl-fact"><dt>Breed</dt><dd>{v(data.breed)}</dd></div>}
              {(v(data.age) || data.sex) && (
                <div className="fl-pair">
                  {v(data.age) && <div className="fl-fact"><dt>Age</dt><dd>{v(data.age)}</dd></div>}
                  {data.sex && <div className="fl-fact"><dt>Sex</dt><dd>{data.sex}</dd></div>}
                </div>
              )}
              {v(data.appearance) && <div className="fl-fact"><dt>Color and markings</dt><dd>{v(data.appearance)}</dd></div>}
              {v(data.distinguishing) && <div className="fl-fact"><dt>Collar, microchip, other details</dt><dd>{v(data.distinguishing)}</dd></div>}
            </dl>
            {where || when ? (
              <div className="fl-seen">
                <p className="fl-seen-label">Last seen</p>
                {where && <p className="fl-seen-where" style={{ fontSize: `${where.length <= 28 ? 1.4 : where.length <= 60 ? 1.15 : 1}em` }}>{where}</p>}
                {when && <p className="fl-seen-when">{when}</p>}
              </div>
            ) : (
              <p className="fl-ghost">Where and when you last saw your pet will show up here.</p>
            )}
            {data.reward && <p className="fl-reward">Reward offered</p>}
            {v(data.note) && <p className="fl-note">{v(data.note)}</p>}
            {factsEmpty && <p className="fl-ghost">Your pet’s name, breed, color, markings and collar will show up here.</p>}
          </div>
        </div>
      </div>

      {reach ? (
        <div className="fl-contact">
          <p className="fl-call">{callLine(data)}</p>
          <p className="fl-phone" style={{ fontSize: `${reachSize}em` }}>{reach}</p>
          {who && <p className="fl-who">{who}</p>}
        </div>
      ) : (
        <p className="fl-ghost fl-ghost-strip">Add a phone number or email so people can reach you. It will be the biggest thing at the bottom.</p>
      )}

      {tab && (
        <div className="fl-tabs" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="fl-tab"><span style={{ fontSize: `${fitSize(tab[1], 7, 1.1, 0.65, 0.6)}em` }}><small>{tab[0]}</small><br />{tab[1]}</span></div>)}
        </div>
      )}
    </article>
    </div>
    </div>
  );
}

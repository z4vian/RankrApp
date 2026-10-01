import { useState } from 'react';
import Head from 'expo-router/head';
import '../lib/landing.css';

import media from '../lib/marketing-media.json';
type Category = 'Movies' | 'TV shows' | 'Games' | 'Music' | 'Books';
const categories: Category[] = ['Movies', 'TV shows', 'Games', 'Music', 'Books'];
const catalog = Object.fromEntries(categories.map(c => [c, media.filter(m => m.category === c)])) as Record<Category, typeof media>;
type IconName = 'movies' | 'tv' | 'games' | 'music' | 'books' | 'lists' | 'compare' | 'friends' | 'arrow' | 'home';
const icons: Record<IconName, React.ReactNode> = {
  movies: <><circle cx="12" cy="10" r="8" /><circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="16" cy="12" r="1" /><path d="M12 18h8v3" /></>,
  tv: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m8 2 4 3 4-3M8 22h8" /></>,
  games: <><path d="M7 7h10c3 0 4 4 5 10 0 3-3 3-5-1H7c-2 4-5 4-5 1C3 11 4 7 7 7Z" /><path d="M7 10v5m-2-2h5m6-2h.01m3 3h.01" /></>,
  music: <><path d="M9 18V5l12-3v13M9 9l12-3" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="18" cy="15" rx="3" ry="2" /></>,
  books: <><path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v16" /></>,
  lists: <><path d="M4 5h16M4 10h10M4 15h8m6-2v8m-4-4h8" /></>,
  compare: <><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /></>,
  friends: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  home: <><path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z" /></>,
};
function Icon({ name }: { name: IconName }) { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>; }
function Logo() { return <a href="/landing" className="wordmark" aria-label="Rankr home"><svg width="27" height="30" viewBox="0 0 27 30" aria-hidden="true"><rect x="1" y="12" width="10" height="17" rx="2" fill="#8b6af4" /><rect x="15" y="1" width="11" height="28" rx="2" fill="#7651e4" /></svg>Rankr</a>; }
function Cover({ index, title, decorative = false }: { index: number; title: string; decorative?: boolean }) {
  const item = media.find(m => m.title === title) ?? media[index % media.length];
  return <img src={item.image} alt={decorative ? '' : item.alt} width="256" height="384" loading={index > 5 ? 'lazy' : 'eager'} />;
}
const featureList = [
  { icon: 'lists' as const, title: 'Build your lists.', body: 'Collect your favorite movies, TV shows, games, music and books in one place.', link: '#collections' },
  { icon: 'compare' as const, title: 'Rank head-to-head.', body: 'Compare two favorites at a time to find your own order.', link: '#ranking' },
  { icon: 'friends' as const, title: 'Discover with friends.', body: 'Share your lists and see what your friends love.', link: '#friends' },
];
export default function Landing() {
  const [category, setCategory] = useState<Category>('Movies');
  const [winner, setWinner] = useState<number | null>(null);
  const titles = catalog[category].map(m => m.title);
  const selectCategory = (c: Category) => { setCategory(c); setWinner(null); };
  const order = Array.from({ length: titles.length }, (_, i) => i);
  if (winner === 1 && titles.length > 1) [order[0], order[1]] = [order[1], order[0]];
  return <div className="rankr-site">
    <Head><title>Rankr — Your favorites, all in order.</title><meta name="description" content="Create ranked lists of movies, TV shows, games, music, and books. Compare favorites head-to-head and discover what your friends love." /></Head>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-nav wrap"><Logo /><nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a></nav><div className="account-nav"><a href="/login">Log in</a><a className="button small" href="/signup">Start your list</a></div></header>
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap hero-intro"><h1 id="hero-title">Your favorites, all in order.</h1>
          <div className="category-tabs" role="group" aria-label="Preview a media category">{categories.map((c, i) => <button key={c} onClick={() => selectCategory(c)} aria-pressed={category === c}><Icon name={(['movies', 'tv', 'games', 'music', 'books'] as IconName[])[i]} />{c}</button>)}</div>
          <div id="features" className="features">{featureList.map(f => <a className="feature" key={f.title} href={f.link}><span className="feature-icon"><Icon name={f.icon} /></span><span><h2>{f.title}</h2><p>{f.body}</p></span></a>)}</div>
          <a className="button hero-cta" href="/signup">Start your list <Icon name="arrow" /></a>
        </div>
        <div className="preview-stage">
          <div className="side-covers side-left" aria-hidden="true"><Cover index={2} title="" decorative /><Cover index={4} title="" decorative /><Cover index={1} title="" decorative /></div>
          <div className="side-covers side-right" aria-hidden="true"><Cover index={5} title="" decorative /><Cover index={9} title="" decorative /><Cover index={11} title="" decorative /></div>
          <div className="app-preview" aria-label={`Sample ${category.toLowerCase()} collection with real titles`}>
            <aside className="preview-sidebar" aria-label="Sample collection categories"><Logo /><p className="sidebar-label">Preview collections</p>{categories.map((c, i) => <button key={c} onClick={() => selectCategory(c)} aria-pressed={category === c}><Icon name={(['movies', 'tv', 'games', 'music', 'books'] as IconName[])[i]} />{c}</button>)}<p className="sidebar-note">A glimpse of your<br />personal collection.</p><a href="#ranking">Try a comparison <Icon name="arrow" /></a></aside>
            <div className="preview-main"><div className="preview-heading"><div><p className="sample-label">Sample list · Real favorites</p><h2>My Favorite {category === 'Music' ? 'Songs' : category === 'TV shows' ? 'TV Shows' : category}</h2><p>Ranked · {titles.length} items</p></div><a href="/signup" className="preview-create">Create yours</a></div>
              <ol className="cover-grid">{order.map((index, rank) => <li key={`${category}-${index}`}><div className="cover-wrap"><Cover index={index} title={titles[index]} /><span className="rank-badge" aria-label={`Rank ${rank + 1}`}>{rank + 1}</span></div><h3>{titles[index]}</h3><p>{category}</p></li>)}</ol>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-section wrap" aria-labelledby="how-title"><h2 id="how-title">How it works</h2><ol className="steps">{[
        ['Search for a favorite', 'Find the film, track, game, show, or book you want to remember.'],
        ['Choose between two', 'Make a few head-to-head picks. Your comparisons build your ranking.'],
        ['Make the list yours', 'Keep adding favorites, revisit your order, and choose what to share.'],
      ].map(([title, body], i) => <li key={title}><span className="step-number">{i + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol></section>
      <section id="collections" className="collection-section wrap"><div><h2>Every favorite.<br />A place of its own.</h2><p>From the songs you keep on repeat to the games you couldn’t put down. Create a list, add a note, and keep your personal canon close.</p><a className="text-link" href="/signup">Create your first collection <Icon name="arrow" /></a></div><div className="collection-art" aria-hidden="true">{[0, 1, 2].map(i => <Cover key={i} index={i} title="" decorative />)}</div></section>
      <section id="ranking" className="ranking-section wrap" aria-labelledby="ranking-title"><div><h2 id="ranking-title">Which one stays<br />with you?</h2><p>Forget finding the perfect star rating. Pick a favorite and see it move to the top of the sample list.</p><p className="demo-note">An interactive demo with openly licensed films. Your choices stay in this page and are never saved or sent.</p></div><div className="comparison"><div className="comparison-heading"><h3>Choose your favorite</h3><button className="reset-demo" onClick={() => setWinner(null)} disabled={winner === null}>Reset</button></div><div className="matchup">{catalog.Movies.slice(0, 2).map(({ title }, i) => <button className="choice" key={title} onClick={() => { setCategory('Movies'); setWinner(i); }} aria-pressed={winner === i} aria-label={`Choose ${title}`}><Cover index={i} title={title} /><span>{title}</span><small>{winner === i ? 'Your pick' : 'Choose this one'}</small></button>)}</div><p className="demo-result" role="status">{winner === null ? 'Your opinion is the only right answer.' : `${catalog.Movies[winner].title} is now number one in the sample list.`}</p></div></section>
      <section id="friends" className="friends-section wrap"><Icon name="friends" /><h2>Good taste is better shared.</h2><p>Follow friends, explore their public lists, and leave a comment on a new discovery. Keep personal lists private when you want them to be just for you.</p><a className="button" href="/signup">Find your people <Icon name="arrow" /></a></section>
    </main>
    <footer className="site-footer wrap"><div><Logo /><p>Your taste. Your point of view.</p></div><nav aria-label="Legal and account"><a href="/privacy">Privacy policy</a><a href="/terms">Terms & conditions</a><a href="/cookies">Cookie policy</a><a href="/image-credits">Image credits</a><a href="/feedback">Contact & feedback</a></nav><div className="footer-bottom"><span>© {new Date().getFullYear()} Rankr</span><span>No advertising or analytics trackers in this web app.</span></div></footer>
  </div>;
}

import { Navigation } from "./Navigation";

export function ModePage({
  active,
  title,
  subtitle,
  cards,
}: {
  active: string;
  title: string;
  subtitle: string;
  cards: { title: string; body: string }[];
}) {
  return (
    <main className="app-shell">
      <Navigation active={active} />
      <section className="mode-page">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="mode-page-grid">
          {cards.map((card) => (
            <article className="panel" key={card.title}>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

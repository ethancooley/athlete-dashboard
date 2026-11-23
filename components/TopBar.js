export default function TopBar({ active, title }) {
  const links = [["/", "Dashboard"], ["/history", "History"], ["/records", "Records"], ["/admin", "Admin"]];
  return (
    <header className="top"><div className="in">
      <div className="brand">{title || "Training"}</div>
      <nav aria-label="Pages">{links.map(([h, t]) => <a key={h} href={h} className={active === h ? "on" : ""} aria-current={active === h ? "page" : undefined}>{t}</a>)}</nav>
    </div></header>
  );
}

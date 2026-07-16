import { Link } from "react-router-dom";

export function WorkspaceHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-copy">
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <span>{description}</span> : null}
      </div>
      {actions ? <div className="workspace-header-actions">{actions}</div> : null}
    </header>
  );
}

export function WorkspaceTabs({ tabs, active }) {
  return (
    <nav aria-label="Visões da página" className="workspace-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link aria-current={active === tab.id ? "page" : undefined} className={active === tab.id ? "active" : ""} key={tab.id} to={tab.to}>
            {Icon ? <Icon size={17} /> : null}
            <span>{tab.label}</span>
            {tab.badge ? <small>{tab.badge}</small> : null}
          </Link>
        );
      })}
    </nav>
  );
}

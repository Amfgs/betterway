import { useEffect, useState } from "react";
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

export function GuidedSectionHeader({ icon: Icon, title, description, className = "" }) {
  return (
    <header className={`guided-section-header ${className}`.trim()}>
      {Icon ? <span className="guided-section-icon"><Icon aria-hidden="true" size={20} /></span> : null}
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function WorkspacePeriodControl({ label, value, onChange, description }) {
  return (
    <section aria-label={label} className="workspace-period-strip">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <label>
        <span>Alterar mês</span>
        <input aria-label={label} onChange={(event) => onChange(event.target.value)} type="month" value={value} />
      </label>
    </section>
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

export function MobileSectionNav({ sections }) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");
  const sectionIds = sections.map((section) => section.id).join("|");

  useEffect(() => {
    const elements = sectionIds
      .split("|")
      .map((sectionId) => document.getElementById(sectionId))
      .filter(Boolean);
    if (!elements.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target?.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-126px 0px -58% 0px", threshold: [0.08, 0.3, 0.65] }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectionIds]);

  function jumpTo(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${sectionId}`);
    setActiveSection(sectionId);
  }

  return (
    <nav aria-label="Atalhos desta página" className="mobile-section-nav">
      {sections.map((section) => (
        <button
          aria-current={activeSection === section.id ? "location" : undefined}
          key={section.id}
          onClick={() => jumpTo(section.id)}
          type="button"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

function formattedMonth(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return "Escolha o mês";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function shiftedMonth(value, amount) {
  const [year, month] = String(value || "").split("-").map(Number);
  const date = year && month ? new Date(year, month - 1 + amount, 1) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

export function WorkspacePeriodControl({ icon: Icon = CalendarRange, label, value, onChange, description, controlLabel = "Alterar mês", stacked = false, variant = "default" }) {
  return (
    <section aria-label={label} className={`workspace-period-strip workspace-period-${variant} ${stacked ? "workspace-period-stacked" : ""}`.trim()}>
      <div className="workspace-period-copy">
        <span className="workspace-period-icon"><Icon aria-hidden="true" size={19} /></span>
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
      </div>
      <div className="workspace-period-navigator">
        <button aria-label="Mês anterior" onClick={() => onChange(shiftedMonth(value, -1))} title="Mês anterior" type="button"><ChevronLeft size={18} /></button>
        <label>
          <span>{controlLabel}</span>
          <strong>{formattedMonth(value)}</strong>
          <input aria-label={label} onChange={(event) => onChange(event.target.value)} type="month" value={value} />
        </label>
        <button aria-label="Próximo mês" onClick={() => onChange(shiftedMonth(value, 1))} title="Próximo mês" type="button"><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

export function WorkspaceTabs({ tabs, active, compactMobile = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const currentTab = tabs.find((tab) => tab.id === active) || tabs[0];
  const CurrentIcon = currentTab?.icon;

  useEffect(() => {
    setPickerOpen(false);
  }, [active]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    function closePicker(event) {
      if (!pickerRef.current?.contains(event.target)) setPickerOpen(false);
    }
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
  }, [pickerOpen]);

  return (
    <>
      <nav aria-label="Visões da página" className={`workspace-tabs ${compactMobile ? "workspace-tabs-compact-mobile" : ""}`.trim()}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link aria-current={active === tab.id ? "page" : undefined} className={active === tab.id ? "active" : ""} data-tour={tab.tourId} key={tab.id} to={tab.to}>
              {Icon ? <Icon size={17} /> : null}
              <span>{tab.label}</span>
              {tab.badge ? <small>{tab.badge}</small> : null}
            </Link>
          );
        })}
      </nav>
      {compactMobile ? (
        <div className={`workspace-view-picker ${pickerOpen ? "open" : ""}`} ref={pickerRef}>
          <button aria-expanded={pickerOpen} aria-haspopup="menu" data-tour={currentTab?.tourId} onClick={() => setPickerOpen((current) => !current)} type="button">
            <span className="workspace-view-picker-icon">{CurrentIcon ? <CurrentIcon size={18} /> : null}</span>
            <span><small>Visão de investimentos</small><strong>{currentTab?.label}</strong></span>
            <ChevronDown aria-hidden="true" size={17} />
          </button>
          {pickerOpen ? (
            <nav aria-label="Escolher visão de investimentos" className="workspace-view-picker-menu">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Link aria-current={active === tab.id ? "page" : undefined} className={active === tab.id ? "active" : ""} key={tab.id} onClick={() => setPickerOpen(false)} to={tab.to}>
                    <span>{Icon ? <Icon size={17} /> : null}</span>
                    <strong>{tab.label}</strong>
                    {active === tab.id ? <i>Atual</i> : null}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      ) : null}
    </>
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

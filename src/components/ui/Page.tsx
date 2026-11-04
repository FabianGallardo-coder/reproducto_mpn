import type { ReactNode } from "react";

interface PageProps {
  /** Short slug used for the CSS modifier and heading id. */
  name: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Page({ name, title, subtitle, actions, children }: PageProps) {
  const headingId = `page-${name}-title`;
  return (
    <section className={`page page--${name}`} aria-labelledby={headingId}>
      <header className="page__header">
        <div className="page__heading">
          <h1 id={headingId} className="page__title">{title}</h1>
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      <div className="page__body">{children}</div>
    </section>
  );
}

interface SectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, icon, action, children }: SectionProps) {
  const headingId = `section-${id}-title`;
  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section__header">
        <h2 id={headingId} className="section__title">
          {icon && <span className="section__icon" aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        {action && <div className="section__action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ active = false, onClick, children }: ChipProps) {
  return (
    <button type="button" className={`chip ${active ? "chip--active" : ""}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state__icon" aria-hidden="true">{icon}</span>}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__text">{description}</p>}
      {action}
    </div>
  );
}

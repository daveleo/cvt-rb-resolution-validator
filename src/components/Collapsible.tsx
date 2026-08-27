import type { ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** A plain <details>/<summary> disclosure – keyboard friendly, no animation,
 *  works without JavaScript. */
export function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  return (
    <details className="collapsible" open={defaultOpen}>
      <summary className="collapsible__summary">
        <span>{title}</span>
        <span className="collapsible__chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}

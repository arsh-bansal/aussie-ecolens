interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-6 lg:px-8 py-6"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

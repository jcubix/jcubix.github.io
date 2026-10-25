export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton-line" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
  );
}

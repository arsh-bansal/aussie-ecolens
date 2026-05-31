export default function FloatingLeaves() {
  return (
    <div className="leaf-bg" aria-hidden="true">
      {/* Eucalyptus leaf SVG — inline so no external request */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`leaf-${i}`} style={{ color: 'var(--primary-light)', opacity: 0.18 }}>
          <svg width="28" height="56" viewBox="0 0 28 56" fill="none">
            <path
              d="M14 1C9 1 1 13 1 27C1 41 7 55 14 55C21 55 27 41 27 27C27 13 19 1 14 1Z"
              fill="currentColor"
              opacity="0.9"
            />
            <line x1="14" y1="3" x2="14" y2="53" stroke="white" strokeWidth="0.7" opacity="0.5" />
            <line x1="9"  y1="14" x2="14" y2="12" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="8"  y1="22" x2="14" y2="20" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="9"  y1="30" x2="14" y2="28" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="9"  y1="38" x2="14" y2="36" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="19" y1="14" x2="14" y2="12" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="20" y1="22" x2="14" y2="20" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="19" y1="30" x2="14" y2="28" stroke="white" strokeWidth="0.5" opacity="0.35" />
            <line x1="19" y1="38" x2="14" y2="36" stroke="white" strokeWidth="0.5" opacity="0.35" />
          </svg>
        </div>
      ))}
    </div>
  );
}

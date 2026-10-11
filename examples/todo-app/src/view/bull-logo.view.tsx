/** The Bull logo: three facets for the three layers. */
export function BullLogoView(props: { size?: number }) {
  const size = props.size ?? 28;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Bull">
      <path d="M19 20C10.5 20 4.5 15 4 5.5c3.5 5.8 9 8.6 17 9.2Z" fill="#ffc9a8" />
      <path d="M45 20c8.5 0 14.5-5 15-14.5c-3.5 5.8-9 8.6-17 9.2Z" fill="#ffc9a8" />
      <path d="M18 15h28L32 36Z" fill="#a78bfa" />
      <path d="M18 15l14 21v21h-6L20.5 34Z" fill="#6b4dff" />
      <path d="M46 15 32 36v21h6l5.5-23Z" fill="#f0507c" />
      <rect x="23" y="45" width="18" height="12" rx="6" fill="#33224a" />
      <path d="M28.5 56.5a3.5 3.5 0 0 0 7 0" fill="none" stroke="#ffc9a8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

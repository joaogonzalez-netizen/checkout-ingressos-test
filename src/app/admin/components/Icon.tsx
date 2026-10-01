// Ícones do backoffice: traço único de 1.75px, 24×24, herdam a cor do texto.
const PATHS = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h12A2.5 2.5 0 0 1 20.5 8v2a2 2 0 0 0 0 4v2a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 16v-2a2 2 0 0 0 0-4z" />
      <path d="M14.5 6.5v11" strokeDasharray="1.5 2.5" />
    </>
  ),
  scan: <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7.5 12h9" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.4-3.2 2.8-5 5.5-5s5.1 1.8 5.5 5M15.5 5.6a3 3 0 0 1 0 5.8M17 14.8c1.9.5 3.2 2.1 3.5 4.7" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  chevron: <path d="M6 9l6 6 6-6" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="bo-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

function Svg({ children, size = 18, className = '', strokeWidth = 2, ...props }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            {...props}
        >
            {children}
        </svg>
    );
}

export function IconIssues({ size, className = '', strokeWidth }) {
    return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
            <path d="M12 11h4" />
            <path d="M12 16h4" />
            <path d="M8 11h.01" />
            <path d="M8 16h.01" />
        </Svg>
    );
}

export function IconChart({ size, className = '', strokeWidth }) {
    return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 4-10" />
        </Svg>
    );
}

export function IconCalendar({ size, className = '', strokeWidth }) {
    return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
        </Svg>
    );
}

export function IconSettings({ size, className = '', strokeWidth }) {
    return (
        <Svg size={size} className={className} strokeWidth={strokeWidth}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </Svg>
    );
}

export function IconSearch({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </Svg>
    );
}

export function IconPlus({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </Svg>
    );
}

export function IconX({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </Svg>
    );
}

export function IconChevronDown({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="m6 9 6 6 6-6" />
        </Svg>
    );
}

export function IconChevronRight({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="m9 18 6-6-6-6" />
        </Svg>
    );
}

export function IconChevronLeft({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="m15 18-6-6 6-6" />
        </Svg>
    );
}

export function IconRefresh({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
        </Svg>
    );
}

export function IconPlay({ size, className = '' }) {
    return (
        <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" className={className} aria-hidden="true">
            <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function IconStop({ size, className = '' }) {
    return (
        <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function IconPin({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 2-2H6a2 2 0 0 0 2 2 1 1 0 0 1 1 1Z" />
        </Svg>
    );
}

export function IconCheck({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M20 6 9 17l-5-5" />
        </Svg>
    );
}

export function IconTrash({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </Svg>
    );
}

export function IconDownload({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </Svg>
    );
}

export function IconClock({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </Svg>
    );
}

export function IconExternalLink({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </Svg>
    );
}

export function IconGitHub({ size = 24, className = '' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            aria-hidden="true"
        >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

export function IconUnpin({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="m2 2 20 20" />
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79" />
            <path d="M15 7V5a1 1 0 0 0 1-1 2 2 0 0 0 2-2H6" />
        </Svg>
    );
}

export function IconSun({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </Svg>
    );
}

export function IconMoon({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </Svg>
    );
}

export function IconMonitor({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
        </Svg>
    );
}

export function IconUser({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </Svg>
    );
}

export function IconUsers({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
    );
}

export function IconEdit({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </Svg>
    );
}

export function IconTrendingUp({ size, className = '' }) {
    return (
        <Svg size={size} className={className}>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </Svg>
    );
}

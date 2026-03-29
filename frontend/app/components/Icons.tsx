/* Minimal, aesthetic inline SVG icons — no external font dependency */

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function wrap(
  children: React.ReactNode,
  { size = 24, className, style }: IconProps,
  viewBox = "0 0 24 24"
) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

/* ── Node type icons ── */
export function SparkleIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" stroke="none" />
    </>,
    p
  );
}

export function PdfIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v6h6" />
      <path d="M9 15h6" />
      <path d="M9 18h4" />
    </>,
    p
  );
}

export function PlayCircleIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
    </>,
    p
  );
}

export function ArticleIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </>,
    p
  );
}

export function ImageIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </>,
    p
  );
}

export function FlashcardIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="2" y="6" width="16" height="14" rx="2" />
      <rect x="6" y="4" width="16" height="14" rx="2" />
    </>,
    p
  );
}

/* ── Actions ── */
export function ShareIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98" />
      <path d="M15.41 6.51l-6.82 3.98" />
    </>,
    p
  );
}

export function GroupIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 21v-1.5a3 3 0 0 0-2.5-2.96" />
    </>,
    p
  );
}

export function CheckCircleIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </>,
    p
  );
}

export function ArrowBackIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </>,
    p
  );
}

export function ArrowUpIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </>,
    p
  );
}

export function ArrowForwardIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </>,
    p
  );
}

export function BranchIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>,
    p
  );
}

export function CopyIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
    p
  );
}

export function ThumbUpIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      <path d="M14 2l-3 7h5.5a2 2 0 0 1 1.86 2.73l-2.36 6A2 2 0 0 1 14.14 20H7V11l3.5-9z" />
    </>,
    p
  );
}

export function CheckIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M20 6L9 17l-5-5" />
    </>,
    p
  );
}

export function AddCircleIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </>,
    p
  );
}

export function GlobeIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>,
    p
  );
}

export function HubIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="21" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 9V4.5" />
      <path d="M14.5 10.5L18.5 8.5" />
      <path d="M14.5 13.5L18.5 15.5" />
      <path d="M12 15v4.5" />
      <path d="M9.5 13.5L5.5 15.5" />
      <path d="M9.5 10.5L5.5 8.5" />
    </>,
    p
  );
}

export function LocationIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>,
    p
  );
}

export function UploadIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>,
    p
  );
}

export function ExpandIcon(p: IconProps) {
  return wrap(
    <>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </>,
    p
  );
}

export function CollapseIcon(p: IconProps) {
  return wrap(
    <>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </>,
    p
  );
}

export function DownloadIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
    p
  );
}

export function LoadingIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </>,
    p
  );
}

export function AddPhotoIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2" fill="currentColor" stroke="none" />
      <path d="M21 17l-4-4-9 9" />
      <path d="M17 1v4" />
      <path d="M15 3h4" />
    </>,
    p
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M15 18l-6-6 6-6" />
    </>,
    p
  );
}

export function ChevronRightIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M9 18l6-6-6-6" />
    </>,
    p
  );
}

export function DescriptionIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>,
    p
  );
}


export function TextIcon(p: IconProps) {
  return wrap(
    <>
      <path d="M4 7V4h16v3" />
      <path d="M12 4v16" />
      <path d="M8 20h8" />
    </>,
    p
  );
}

export function QuizIcon(p: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
    p
  );
}

export function MarkdownIcon(p: IconProps) {
  return wrap(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8v8l3-3 3 3V8" />
      <path d="M18 16l-2-3h-1v-5h2v3l2-3v8" />
    </>,
    p
  );
}

/** The Rift Graphs mark (dark variant of the brand kit) for the generated Open Graph images. */
export function OgMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M26 94 V32 Q26 26 32 26 H94" stroke="#5B74FF" strokeWidth={7} />
      <path d="M26 94 H88 Q94 94 94 88 V26" stroke="#FF5A6E" strokeWidth={7} />
      <path d="M26 94 L46 68 L58 78 L76 48 L94 26" stroke="#F2F4FF" strokeWidth={8} />
      <circle cx={26} cy={94} r={7} fill="#F2F4FF" />
      <circle cx={94} cy={26} r={7} fill="#F2F4FF" />
    </svg>
  );
}

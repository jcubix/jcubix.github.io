import "../whiteboard.css";

export function Pitch() {
  return (
    <g aria-hidden="true">
      <rect width="1000" height="640" fill="#17483e" />
      <g stroke="#e1efe8" strokeWidth="2.5" fill="none" opacity="0.8">
        <rect x="32" y="32" width="936" height="576" />
        <path d="M500 32V608M32 165H190V475H32M968 165H810V475H968M32 245H95V395H32M968 245H905V395H968" />
        <circle cx="500" cy="320" r="78" />
        <path d="M190 255A78 78 0 0 1 190 385M810 255A78 78 0 0 0 810 385M32 300H18V340H32M968 300H982V340H968" />
      </g>
      <g fill="#e1efe8">
        <circle cx="500" cy="320" r="4" />
        <circle cx="140" cy="320" r="4" />
        <circle cx="860" cy="320" r="4" />
      </g>
    </g>
  );
}

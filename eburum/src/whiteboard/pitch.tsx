export function Pitch({ white, half }: { white: boolean; half: boolean }) {
  const line = white ? "#4b5563" : "#e1efe8";
  return (
    <g aria-hidden="true">
      <rect width="1000" height="640" fill={white ? "#ffffff" : "#17483e"} />
      <g stroke={line} strokeWidth="2.5" fill="none" opacity={white ? 1 : 0.8}>
        <rect x="32" y="32" width="936" height="576" />
        <path d="M32 300H18V340H32" />
        <path
          d={
            half
              ? "M32 165H305V475H32M32 245H123V395H32M305 255A78 78 0 0 1 305 385"
              : "M32 165H190V475H32M32 245H95V395H32M190 255A78 78 0 0 1 190 385"
          }
        />
        {half ? (
          <path d="M968 242A78 78 0 0 0 968 398" />
        ) : (
          <>
            <path d="M500 32V608M968 165H810V475H968M968 245H905V395H968M810 255A78 78 0 0 0 810 385M968 300H982V340H968" />
            <circle cx="500" cy="320" r="78" />
          </>
        )}
      </g>
      <g fill={line}>
        <circle cx={half ? 968 : 500} cy="320" r="4" />
        <circle cx={half ? 212 : 140} cy="320" r="4" />
        {half ? null : <circle cx="860" cy="320" r="4" />}
      </g>
    </g>
  );
}

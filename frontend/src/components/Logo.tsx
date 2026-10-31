/** Rows of Mistral's pixel "M", top to bottom: colour and [column, width] runs. */
const ROWS: [string, [number, number][]][] = [
  ["#FFAF01", [[1, 1], [5, 1]]],
  ["#FF8204", [[1, 2], [4, 2]]],
  ["#FA500F", [[1, 5]]],
  ["#E51300", [[1, 1], [3, 1], [5, 1]]],
  ["#C4001D", [[0, 3], [4, 3]]],
];

/**
 * Mistral's pixel mark, drawn in the official gradient (yellow to red, top
 * to bottom) as the brand guidelines prefer. `mono` renders it in one colour
 * from the `fill-*` class instead, for use on a coloured badge.
 */
export function MistralLogo({
  size = 24, className, mono = false,
}: {
  size?: number;
  className?: string;
  mono?: boolean;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * (5 / 7))}
      viewBox="0 0 7 5"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Mistral"
      className={className}
    >
      {ROWS.flatMap(([color, runs], y) => runs.map(([x, width]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height={1} fill={mono ? undefined : color} />
      )))}
    </svg>
  );
}

/** The ReVibe RV monogram, from packaging/brand/make_logo.py: rows top to bottom. */
const REVIBE_BITMAP = [
  "XXXXXXX...XX...XX", "XXXXXXXX..XX...XX", "XX....XX..XX...XX", "XX....XX..XX...XX", "XXXXXXXX...XX.XX.",
  "XXXXXXX....XX.XX.", "XX..XX.....XX.XX.", "XX...XX.....XXX..", "XX....XX....XXX..", "XX....XX.....X...",
];
const REVIBE_RAMP = ["#FFD800", "#FFC800", "#FFB600", "#FFA301", "#FF8F04", "#FF7A06", "#FA640A", "#F44B0C", "#EC2E09", "#E10500"];

/** ReVibe's mark: the pixel RV in the yellow-to-red ramp, optionally on its dark tile. */
export function ReVibeLogo({ size = 24, tile = false, className }: { size?: number; tile?: boolean; className?: string }) {
  const cells = REVIBE_BITMAP.flatMap((line, r) => [...line].map((ch, c) => ch === "X"
    ? <rect key={`${r}-${c}`} x={c + 0.05} y={r + 0.05} width={0.9} height={0.9} rx={0.14} fill={REVIBE_RAMP[r]} /> : null));
  return (
    <svg width={size} height={size} viewBox={tile ? "-2.2 -6.1 21.4 21.4" : "-0.2 -3.6 17.4 17.4"} xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="ReVibe" className={className}>
      {tile && <rect x={-2.2} y={-6.1} width={21.4} height={21.4} rx={4.7} fill="#18181b" />}
      {cells}
    </svg>
  );
}

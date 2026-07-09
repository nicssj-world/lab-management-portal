interface SpinnerProps {
  size?: number
  style?: React.CSSProperties
}

export function Spinner({ size = 14, style }: SpinnerProps) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, ...style }}
    />
  )
}

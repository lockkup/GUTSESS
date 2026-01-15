type Props = {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function BackButton({
  onClick,
  label = "ย้อนกลับ",
  className = "",
  disabled = false,
  ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      className={`guts-back-btn ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </button>
  );
}

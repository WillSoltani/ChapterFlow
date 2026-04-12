import styles from "./PulseCTA.module.css";

export function PulseCTA({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.pulse} ${className}`.trim()}>{children}</div>
  );
}

import styles from "./ActionButtons.module.css";

type ActionButtonsProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
};

export function ActionButtons({
  cancelLabel = "取消",
  confirmLabel = "确认",
  onCancel,
  onConfirm,
  disabled = false,
}: ActionButtonsProps) {
  return (
    <div className={styles.grid}>
      <button type="button" onClick={onCancel} className={styles.secondaryButton}>
        <svg viewBox="0 0 24 24" fill="none" className={styles.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
        {cancelLabel}
      </button>
      <button type="button" onClick={onConfirm} disabled={disabled} className={styles.primaryButton}>
        <svg viewBox="0 0 24 24" fill="none" className={styles.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17l9-10" />
        </svg>
        {confirmLabel}
      </button>
    </div>
  );
}
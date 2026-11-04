import { useState } from "react";

interface Props {
  label: string;
  confirmLabel: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Destructive action with an inline confirm/cancel step (no blocking window.confirm). */
export function ConfirmAction({ label, confirmLabel, disabled = false, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="button" disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-action" role="group" aria-label={label}>
      <button
        type="button"
        className="button button--danger"
        onClick={async () => {
          await onConfirm();
          setConfirming(false);
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="button" onClick={() => setConfirming(false)}>
        Cancelar
      </button>
    </span>
  );
}

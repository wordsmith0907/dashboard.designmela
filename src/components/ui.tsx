"use client";
import { ReactNode, useEffect, useRef, useId } from "react";
import { X, Inbox } from "lucide-react";
export function Badge({ children }: { children: ReactNode }) {
  const value = String(children);
  return (
    <span
      className={`badge ${/Failed|Lost|High|Overdue/.test(value) ? "danger" : /Won|Published|Approved|Completed|Successful/.test(value) ? "success" : /Review|Proposal|approval|Waiting|Qualified/.test(value) ? "purple" : ""}`}
    >
      {children}
    </span>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Add a record to get started.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
export function Skeleton() {
  return (
    <div
      className="skeleton-grid"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const titleId=useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${wide ? "modal wide" : "modal"} ${drawer?'crm-drawer':''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  text,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="form-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button destructive"
          disabled={busy}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-row">
      <progress value={value} max={100} aria-label={`${value}% complete`} />
      <span>{value}%</span>
    </div>
  );
}

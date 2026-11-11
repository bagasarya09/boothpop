import { useEffect, useId, useRef, useState } from 'react';
import './confirmation.css';

// Share the same confirmation UI across the photobooth and development admin.
export function useConfirmation(language: 'id' | 'en' = 'id') {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId(), messageId = useId();
  const text = (id: string, en: string) => language === 'id' ? id : en;

  function finish(accepted: boolean) {
    dialog.current?.close();
    const resolve = resolver.current;
    resolver.current = null;
    setMessage(null);
    resolve?.(accepted);
  }

  function askConfirmation(description: string): Promise<boolean> {
    if (resolver.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setMessage(description);
    });
  }

  useEffect(() => {
    if (message === null) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    cancelButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [message]);

  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);

  const confirmationDialog = message !== null ? (
    <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); finish(false); }}
      onClose={() => { if (resolver.current) finish(false); }}>
      <span className="pill yellow">{text('SEBELUM MELANJUTKAN', 'BEFORE YOU CONTINUE')}</span>
      <h2 id={titleId}>{text('Lanjutkan perubahan?', 'Continue with this change?')}</h2>
      <p id={messageId}>{message}</p>
      <div className="confirmation-actions">
        <button ref={cancelButton} type="button" onClick={() => finish(false)}>{text('Batal', 'Cancel')}</button>
        <button className="primary" type="button" onClick={() => finish(true)}>{text('Ya, lanjutkan', 'Yes, continue')}</button>
      </div>
    </dialog>
  ) : null;

  return { askConfirmation, confirmationDialog };
}

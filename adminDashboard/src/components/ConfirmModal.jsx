import Modal from './Modal';

const ConfirmModal = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  confirmClass = 'bg-brand hover:bg-brand-dark text-white',
}) => {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-sm text-muted">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${confirmClass}`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
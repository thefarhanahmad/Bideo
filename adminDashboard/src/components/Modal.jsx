
const Modal = ({ title, children, onClose, maxWidth = "max-w-md" }) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col border border-line`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-line">
          <h3 className="font-display font-bold text-ink text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
import { useEffect } from "react";

const Modal = ({ title, children, onClose, maxWidth = "max-w-md", zIndex = "z-50" }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center ${zIndex} p-3 sm:p-4`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[92vh] flex flex-col border border-line overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-surface/30 shrink-0">
          <h3 className="font-display font-bold text-ink text-base sm:text-lg truncate pr-3">{title}</h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="grid h-8 w-8 place-items-center rounded-xl text-muted hover:bg-surface hover:text-ink transition-colors shrink-0 text-lg font-bold"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
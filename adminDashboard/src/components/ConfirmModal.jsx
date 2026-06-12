import Modal from './Modal';

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-4">{message}</p>
      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
        <button onClick={onConfirm} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
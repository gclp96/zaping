import type { ReactNode } from 'react';

import Button from './Button';
import Modal from './Modal';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  loading?: boolean;
  confirmText?: string;
  loadingText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  loading = false,
  confirmText = 'Eliminar',
  loadingText = 'Procesando...',
  cancelText = 'Cancelar',
  confirmVariant = 'danger',
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      <div className="space-y-6">
        <div className="text-gray-700">
          {message}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={loading}
            onClick={onClose}
          >
            {cancelText}
          </Button>

          <Button
            variant={confirmVariant}
            loading={loading}
            loadingText={loadingText}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
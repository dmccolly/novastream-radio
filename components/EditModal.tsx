import React, { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Track } from '../types';
import EditPanel from './EditPanel';

interface EditModalProps {
  track: Track | null;
  onSave: () => void;
  onClose: () => void;
  onChange: (track: Track) => void;
}

const EditModal = memo(({ track, onSave, onClose, onChange }: EditModalProps) => {
  useEffect(() => {
    if (track) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [track]);

  if (!track) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <EditPanel
          track={track}
          onChange={onChange}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
});

EditModal.displayName = 'EditModal';

export default EditModal;

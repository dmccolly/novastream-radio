import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Track } from '../types';

interface EditContextType {
  editingTrack: Track | null;
  setEditingTrack: (track: Track | null) => void;
}

const EditContext = createContext<EditContextType | undefined>(undefined);

export const EditProvider = ({ children }: { children: ReactNode }) => {
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  return (
    <EditContext.Provider value={{ editingTrack, setEditingTrack }}>
      {children}
    </EditContext.Provider>
  );
};

export const useEdit = () => {
  const context = useContext(EditContext);
  if (!context) {
    throw new Error('useEdit must be used within EditProvider');
  }
  return context;
};

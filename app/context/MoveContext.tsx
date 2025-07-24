import React, { createContext, ReactNode, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { Item, moveItem } from '../utils/folderHelpers';

type MoveState = {
  isMoving: boolean;
  itemToMove: Item | null;
  sourceParentId: string | null;
};

type MoveContextType = {
  moveState: MoveState;
  enterMoveMode: (item: Item, sourceParentId: string | null) => void;
  confirmMove: (destinationParentId: string | null) => boolean;
  exitMoveMode: () => void;
};

const MoveContext = createContext<MoveContextType | undefined>(undefined);

export const MoveContextProvider = ({ children }: { children: ReactNode }) => {
  const [moveState, setMoveState] = useState<MoveState>({
    isMoving: false,
    itemToMove: null,
    sourceParentId: null,
  });

  const enterMoveMode = (item: Item, sourceParentId: string | null) => {
    setMoveState({ isMoving: true, itemToMove: item, sourceParentId });
  };

  const exitMoveMode = () => {
    setMoveState({ isMoving: false, itemToMove: null, sourceParentId: null });
  };

  const confirmMove = (destinationParentId: string | null): boolean => {
    if (moveState.itemToMove) {
      // Prevent moving a folder into itself or its own children (not implemented, but good to consider)
      if (moveState.itemToMove.type === 'folder' && moveState.itemToMove.id === destinationParentId) {
        Alert.alert("Invalid Move", "You cannot move a folder into itself.");
        exitMoveMode();
        return false;
      }
      moveItem(moveState.itemToMove, moveState.sourceParentId, destinationParentId);
    }
    exitMoveMode();
    return true;
  };

  return (
    <MoveContext.Provider value={{ moveState, enterMoveMode, confirmMove, exitMoveMode }}>
      {children}
    </MoveContext.Provider>
  );
};

export const useMove = () => {
  const context = useContext(MoveContext);
  if (context === undefined) {
    throw new Error('useMove must be used within a MoveContextProvider');
  }
  return context;
};
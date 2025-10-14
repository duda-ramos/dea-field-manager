import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { ConflictDetails } from '@/lib/conflictUtils';

interface ConflictState {
  // Current conflict being shown
  currentConflict: ConflictDetails | null;
  showConflictAlert: boolean;
  
  // Queue of pending conflicts
  pendingConflicts: ConflictDetails[];
  
  // Actions
  addConflict: (conflict: ConflictDetails) => void;
  showNextConflict: () => void;
  hideConflictAlert: () => void;
  resolveCurrentConflict: () => void;
  showConflictNotification: () => void;
  clearAllConflicts: () => void;
  getPendingCount: () => number;
}

export const conflictStore = create<ConflictState>()(
  persist(
    (set, get) => ({
      currentConflict: null,
      showConflictAlert: false,
      pendingConflicts: [],

      addConflict: (conflict) => {
        set((state) => {
          // Check if conflict already exists
          const exists = state.pendingConflicts.some(
            (c) =>
              c.recordType === conflict.recordType &&
              c.localVersion.id === conflict.localVersion.id
          );

          if (exists) {
            return state;
          }

          const newConflicts = [...state.pendingConflicts, conflict];
          
          // If no current conflict is showing, show this one
          if (!state.currentConflict) {
            return {
              pendingConflicts: newConflicts,
              currentConflict: conflict,
              showConflictAlert: true,
            };
          }

          return { pendingConflicts: newConflicts };
        });
      },

      showNextConflict: () => {
        set((state) => {
          if (state.pendingConflicts.length === 0) {
            return {
              currentConflict: null,
              showConflictAlert: false,
            };
          }

          const [next, ...remaining] = state.pendingConflicts;
          return {
            currentConflict: next,
            pendingConflicts: remaining,
            showConflictAlert: true,
          };
        });
      },

      hideConflictAlert: () => {
        set({ showConflictAlert: false });
      },

      resolveCurrentConflict: () => {
        const { showNextConflict } = get();
        showNextConflict();
      },

      showConflictNotification: () => {
        const pendingCount = get().pendingConflicts.length;
        const currentShowing = get().currentConflict ? 1 : 0;
        const totalConflicts = pendingCount + currentShowing;

        if (totalConflicts > 0) {
          toast.warning(
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <div>
                <p className="font-medium">
                  {totalConflicts} {totalConflicts === 1 ? 'edição simultânea detectada' : 'edições simultâneas detectadas'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para resolver
                </p>
              </div>
            </div>,
            {
              action: {
                label: 'Resolver',
                onClick: () => {
                  const state = get();
                  if (!state.showConflictAlert && state.currentConflict) {
                    set({ showConflictAlert: true });
                  }
                },
              },
              duration: 10000,
            }
          );
        }
      },

      clearAllConflicts: () => {
        set({
          currentConflict: null,
          showConflictAlert: false,
          pendingConflicts: [],
        });
      },

      getPendingCount: () => {
        const state = get();
        return state.pendingConflicts.length + (state.currentConflict ? 1 : 0);
      },
    }),
    {
      name: 'conflict-storage',
      partialize: (state) => ({
        pendingConflicts: state.pendingConflicts,
        currentConflict: state.currentConflict,
      }),
    }
  )
);
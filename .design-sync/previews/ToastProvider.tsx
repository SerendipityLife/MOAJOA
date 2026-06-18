import { ToastProvider, useToast } from '@moajoa/web';
import { useEffect } from 'react';

// ToastProvider renders a fixed snackbar layer at the bottom. Fire a sticky
// toast on mount so the card shows the actual snackbar. Bounded stage keeps
// the fixed layer inside the card.
const stage: React.CSSProperties = {
  position: 'relative',
  width: 380,
  height: 220,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 16,
  background: '#eef1f5',
};

function Fire({ message, variant }: { message: string; variant: 'default' | 'success' | 'error' | 'info' }) {
  const { toast } = useToast();
  useEffect(() => {
    toast(message, { variant, duration: 0 });
  }, [message, variant, toast]);
  return null;
}

/** A success snackbar fired via useToast(). */
export function Success() {
  return (
    <div style={stage}>
      <ToastProvider>
        <Fire message="보드에 저장했어요" variant="success" />
      </ToastProvider>
    </div>
  );
}

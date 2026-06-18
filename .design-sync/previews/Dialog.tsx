import { Dialog } from '@moajoa/web';

// Dialog uses `position: fixed` to cover the viewport. In a preview card we
// give it a bounded "stage": a sized wrapper whose `transform` makes it the
// containing block for the fixed layer, so the dimmed backdrop and the
// centered dialog render inside the card instead of escaping it.
const stage: React.CSSProperties = {
  position: 'relative',
  width: 460,
  height: 300,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 16,
  background: '#eef1f5',
};

/** Confirm dialog — title, description, and footer actions over a dimmed backdrop. */
export function Confirm() {
  return (
    <div style={stage}>
      <Dialog
        open
        onClose={() => {}}
        title="이 장소를 삭제할까요?"
        description="삭제하면 보드에서 사라지고, 친구들의 투표 기록도 함께 지워져요. 이 동작은 되돌릴 수 없어요."
        actions={[
          { label: '취소', onClick: () => {}, variant: 'text' },
          { label: '삭제', onClick: () => {}, variant: 'primary' },
        ]}
      />
    </div>
  );
}

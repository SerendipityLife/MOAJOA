import { BottomSheet } from '@moajoa/web';

// BottomSheet uses `position: fixed` and slides up from the bottom edge. Give
// it a bounded stage (transform makes it the containing block for the fixed
// layer) so the sheet + dimmed backdrop render inside the card.
const stage: React.CSSProperties = {
  position: 'relative',
  width: 440,
  height: 420,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 16,
  background: '#eef1f5',
};

const item: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  background: '#f3f4f6',
  fontSize: 14,
  color: '#111827',
};

/** Sheet open — pick a board to add the place to. */
export function Open() {
  return (
    <div style={stage}>
      <BottomSheet open onClose={() => {}} title="보드에 추가">
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={item}>제주 카페 투어</div>
          <div style={item}>도쿄 3박 4일 맛집</div>
          <div style={item}>주말 데이트 코스</div>
        </div>
      </BottomSheet>
    </div>
  );
}

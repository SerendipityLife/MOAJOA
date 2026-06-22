import { Button } from '@moajoa/web';

const row: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
};

/** primary / outline / text — the three button styles. */
export function Variants() {
  return (
    <div style={row}>
      <Button variant="primary">장소 저장</Button>
      <Button variant="outline">보드 공유</Button>
      <Button variant="text">취소</Button>
    </div>
  );
}

/** md (default) and sm sizes. */
export function Sizes() {
  return (
    <div style={row}>
      <Button size="md">투표 시작하기</Button>
      <Button size="sm">추가</Button>
    </div>
  );
}

/** Enabled vs. disabled, per variant. */
export function States() {
  return (
    <div style={row}>
      <Button variant="primary" disabled>
        저장됨
      </Button>
      <Button variant="outline" disabled>
        공유 불가
      </Button>
    </div>
  );
}

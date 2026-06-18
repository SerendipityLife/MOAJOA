import { Card } from '@moajoa/web';

const title: React.CSSProperties = { fontWeight: 700, fontSize: 16, color: '#111827' };
const meta: React.CSSProperties = { fontSize: 13, color: '#6b7280', marginTop: 4 };
const body: React.CSSProperties = { fontSize: 13, color: '#374151', marginTop: 10, lineHeight: 1.5 };

/** A place card — the design system's primary surface. */
export function Place() {
  return (
    <Card style={{ width: 320 }}>
      <div style={title}>스시 사이토</div>
      <div style={meta}>도쿄 미나토구 · 오마카세</div>
      <div style={body}>영상 속에서 3명이 추천한 장소예요. 친구들과 투표로 갈지 정해보세요.</div>
    </Card>
  );
}

/** Rendered as a semantic article element. */
export function AsArticle() {
  return (
    <Card as="article" style={{ width: 320 }}>
      <div style={title}>제주 카페 투어</div>
      <div style={meta}>저장한 장소 8곳 · 투표 진행중</div>
    </Card>
  );
}

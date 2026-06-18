import { Chip } from '@moajoa/web';

const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

/** A row of category filter chips — one selected. */
export function Categories() {
  return (
    <div style={row}>
      <Chip selected>맛집</Chip>
      <Chip>카페</Chip>
      <Chip>명소</Chip>
      <Chip>쇼핑</Chip>
    </div>
  );
}

/** Selected vs. unselected, side by side. */
export function Selected() {
  return (
    <div style={row}>
      <Chip selected>가고 싶어요</Chip>
      <Chip>관심 없어요</Chip>
    </div>
  );
}

import { Input } from '@moajoa/web';

const field: React.CSSProperties = { width: 300, display: 'grid', gap: 6 };
const label: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
};

/** Default empty field with placeholder. */
export function Default() {
  return (
    <div style={field}>
      <span style={label}>보드 이름</span>
      <Input placeholder="예: 도쿄 3박 4일 맛집" />
    </div>
  );
}

/** Filled with a value. */
export function Filled() {
  return (
    <div style={field}>
      <span style={label}>보드 이름</span>
      <Input defaultValue="제주 카페 투어" />
    </div>
  );
}

/** Invalid state — danger border. */
export function Invalid() {
  return (
    <div style={field}>
      <span style={label}>보드 이름</span>
      <Input invalid defaultValue="" placeholder="이름을 입력해 주세요" />
    </div>
  );
}

/** Disabled. */
export function Disabled() {
  return (
    <div style={field}>
      <span style={label}>보드 이름</span>
      <Input disabled defaultValue="잠긴 보드" />
    </div>
  );
}

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@moajoa/web';

/** Open select — trigger uses the input radius; menu mirrors the card surface. */
export function Open() {
  return (
    <div style={{ width: 240, paddingBottom: 200 }}>
      <Select defaultOpen defaultValue="tokyo">
        <SelectTrigger style={{ width: '100%' }}>
          <SelectValue placeholder="도시 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tokyo">도쿄</SelectItem>
          <SelectItem value="osaka">오사카</SelectItem>
          <SelectItem value="jeju">제주</SelectItem>
          <SelectItem value="seoul">서울</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

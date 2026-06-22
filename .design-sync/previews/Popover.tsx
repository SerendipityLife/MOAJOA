import { Popover, PopoverTrigger, PopoverContent, Button } from '@moajoa/web';

/** Open popover — white card surface matching Card. */
export function Open() {
  return (
    <div style={{ paddingBottom: 180 }}>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline">정렬 · 필터</Button>
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 8 }}>
            정렬 기준
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#374151' }}>
            <div>투표 많은 순</div>
            <div>최근 추가 순</div>
            <div>거리 가까운 순</div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

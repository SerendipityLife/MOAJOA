import { Tabs, TabsList, TabsTrigger, TabsContent } from '@moajoa/web';

const panel: React.CSSProperties = {
  padding: '14px 4px',
  fontSize: 14,
  color: '#374151',
};

/** Segmented control — active tab lifts to a white pill. */
export function Segmented() {
  return (
    <div style={{ width: 380 }}>
      <Tabs defaultValue="saved">
        <TabsList>
          <TabsTrigger value="saved">저장한 곳</TabsTrigger>
          <TabsTrigger value="voting">투표중</TabsTrigger>
          <TabsTrigger value="visited">다녀온 곳</TabsTrigger>
        </TabsList>
        <TabsContent value="saved">
          <div style={panel}>저장한 장소 12곳 · 최근 추가: 스시 사이토</div>
        </TabsContent>
        <TabsContent value="voting">
          <div style={panel}>투표 진행중인 보드 3개</div>
        </TabsContent>
        <TabsContent value="visited">
          <div style={panel}>다녀온 장소 5곳</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

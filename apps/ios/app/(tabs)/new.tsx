// 하단 탭바 가운데 ＋ 슬롯 자리만 차지하는 더미 라우트.
// 실제 동작은 _layout.tsx의 커스텀 tabBarButton이 /boards/new 로 보내므로
// 이 스크린은 렌더되지 않는다.
export default function NewBoardTabPlaceholder() {
  return null;
}

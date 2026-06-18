import { Tooltip, TooltipTrigger, TooltipContent, Button } from '@moajoa/web';

/** Open tooltip — neutral-900 surface, white text. */
export function Hint() {
  return (
    <div style={{ paddingTop: 80, display: 'flex', justifyContent: 'center' }}>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">추천 정보</Button>
        </TooltipTrigger>
        <TooltipContent>영상 속에서 3명이 추천한 장소예요</TooltipContent>
      </Tooltip>
    </div>
  );
}

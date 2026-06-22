import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Button,
} from '@moajoa/web';

/** Open menu — board actions, with a destructive item. */
export function Open() {
  return (
    <div style={{ paddingBottom: 200 }}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">보드 메뉴</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>보드</DropdownMenuLabel>
          <DropdownMenuItem>이름 변경</DropdownMenuItem>
          <DropdownMenuItem>공유 링크 복사</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">보드 삭제</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

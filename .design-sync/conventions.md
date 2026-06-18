# MOAJOA UI — how to build with this design system

MOAJOA turns video/blog/Insta links into map boards of places that friends vote on.
This library is a **headless Tailwind v4** system: components ship no CSS of their own —
they are styled entirely by **Tailwind utility classes**, and every class plus the full
token palette is in `styles.css`. Build layouts with the utility classes below.

## Setup & wrapping

- **No global theme provider is needed for styling** — utilities resolve from `styles.css`.
- **Toasts:** wrap the subtree in `<ToastProvider>` and call `useToast()` →
  `toast(message, { variant?: "default"|"success"|"error"|"info"; duration?: number })`.
- **Tooltip** has its provider built in — use `<Tooltip>` directly (no separate provider).
- **Radix-backed compounds** are composed from parts: `Select` + `SelectTrigger`/`SelectValue`/
  `SelectContent`/`SelectItem`; `DropdownMenu` + `DropdownMenuTrigger`/`Content`/`Item`/`Label`/
  `Separator` (Item takes `variant="destructive"`); `Popover` + `PopoverTrigger`/`PopoverContent`;
  `Tabs` + `TabsList`/`TabsTrigger`/`TabsContent`. Triggers wrap a `Button` via `asChild`.

## Styling idiom — Tailwind utility classes (use these token names)

Color utilities take `bg-`, `text-`, `border-` (e.g. `bg-brand-600`, `text-neutral-900`,
`border-neutral-200`):

| Family | Values | Use for |
|---|---|---|
| `brand-{50,100,200,300,400,500,600,700,800,900}` | blue | `brand-600` primary action, `brand-500` accent, `brand-50/100` tints |
| `neutral-{0,50,100,200,300,400,500,600,700,800,900,950}` | grayscale | text (`neutral-900` body, `neutral-500/600` secondary), borders (`neutral-200/300`), fills |
| `success` `warning` `danger` `info` | semantic | status; `danger` for destructive |
| `surface-background` `surface-raised` | scaffold vs card | page bg vs raised surfaces |
| `pin-{candidate,loved,confirmed,hidden}` | map-pin vote states | place pins on the map |
| `category-{nature,food,culture,wellness,shopping}` | place-category badges | chips on place cards |
| `medal-{gold,silver,bronze}` | ranking | leaderboard medals |

- **Radius:** `rounded-lg` (12px — buttons, inputs), `rounded-xl` (16px — cards), `rounded-2xl`
  (24px — dialogs), `rounded-3xl` (28px — bottom sheet), `rounded-full` (chips, FAB).
- **Shadow:** flat by default; `shadow-fab` and `shadow-nav` only for floating elements.
- **Type:** `font-sans` is Pretendard. Weights `font-medium|semibold|bold`; sizes `text-xs…text-4xl`.
- Spacing is the standard numeric Tailwind scale (`p-4`, `px-6`, `gap-2`).

## Where the truth lives

- `styles.css` (and its `@import` of `_ds_bundle.css`) — every token + utility. Read it before styling.
- `components/<group>/<Name>/<Name>.d.ts` — the component's prop contract.
- `components/<group>/<Name>/<Name>.prompt.md` — usage and composition.

## Idiomatic example

```tsx
import { Card, Chip, Button } from "@moajoa/web";

<Card className="rounded-xl border border-neutral-200">
  <h3 className="text-lg font-semibold text-neutral-900">스시 사이토</h3>
  <p className="mt-1 text-sm text-neutral-500">도쿄 미나토구 · 오마카세</p>
  <div className="mt-3 flex gap-2">
    <Chip selected>맛집</Chip>
    <Chip>가고 싶어요</Chip>
  </div>
  <Button variant="primary" className="mt-4 w-full">투표하기</Button>
</Card>
```

import { inventorySlots } from "@/lib/builds";
import { itemIconUrl, runeIconUrl, spellIconUrl, type LoadoutIndex } from "@/lib/sources/loadout";
import { cn } from "@/lib/utils";

/**
 * Item, rune and summoner spell icons from Data Dragon. A name the index does not know becomes a muted box with the
 * name as its tooltip, so a missing icon never breaks a row.
 */

/** Pixel size for the image request, and the classes that set the drawn size (some grow from phone to desktop). */
const SIZES = {
  xs: { px: 16, cls: "size-4" },
  sm: { px: 20, cls: "size-5" },
  md: { px: 24, cls: "size-6" },
  lg: { px: 32, cls: "size-8" },
  "fluid-sm": { px: 20, cls: "size-4 sm:size-5" },
  fluid: { px: 28, cls: "size-5 sm:size-7" },
  "fluid-lg": { px: 32, cls: "size-6 sm:size-8" },
} as const;
type Size = keyof typeof SIZES;

function Icon({
  src,
  name,
  size,
  round = false,
  className,
}: {
  src: string | null;
  name: string;
  size: Size;
  round?: boolean;
  className?: string;
}) {
  const { px, cls } = SIZES[size];
  const shape = round ? "rounded-full" : "rounded-[4px]";
  if (!src)
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        className={cn("inline-block shrink-0 border border-border bg-muted", cls, shape, className)}
      />
    );
  // A plain img: hundreds of these on a series page, and next/image adds markup to each without optimising them.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote 64 px icon, fixed box
    <img
      src={src}
      alt={name}
      title={name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 bg-muted", cls, shape, className)}
    />
  );
}

export function ItemIcon({
  name,
  loadout,
  size = "md",
  className,
}: {
  name: string;
  loadout: LoadoutIndex;
  size?: Size;
  className?: string;
}) {
  const item = loadout.items[name];
  return (
    <Icon
      src={item && loadout.version ? itemIconUrl(loadout.version, item.id) : null}
      name={name}
      size={size}
      className={className}
    />
  );
}

/** An empty inventory slot, the size of an item icon. */
export function EmptySlot({ size = "md", className }: { size?: Size; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-[4px] border border-dashed border-border/70",
        SIZES[size].cls,
        className,
      )}
    />
  );
}

export function RuneIcon({
  name,
  loadout,
  size = "md",
  shard = false,
  className,
}: {
  name: string;
  loadout: LoadoutIndex;
  size?: Size;
  /** Stat shards sit on a dark disc, as in the client. */
  shard?: boolean;
  className?: string;
}) {
  const icon = loadout.runes[name];
  return (
    <Icon
      src={icon ? runeIconUrl(icon) : null}
      name={name}
      size={size}
      round
      className={cn(shard ? "bg-neutral-900 p-0.5" : "bg-transparent", className)}
    />
  );
}

export function SpellIcon({
  name,
  loadout,
  size = "sm",
  className,
}: {
  name: string;
  loadout: LoadoutIndex;
  size?: Size;
  className?: string;
}) {
  const id = loadout.spells[name];
  return (
    <Icon
      src={id && loadout.version ? spellIconUrl(loadout.version, id) : null}
      name={name}
      size={size}
      className={className}
    />
  );
}

/** Six inventory slots and the trinket, in one row. */
export function Inventory({
  items,
  trinket,
  loadout,
  size = "md",
  className,
}: {
  items: string[];
  trinket: string | null;
  loadout: LoadoutIndex;
  size?: Size;
  className?: string;
}) {
  const slots = inventorySlots(items);
  return (
    <span className={cn("inline-flex items-center gap-0.5 sm:gap-1", className)}>
      {slots.map((name, i) =>
        name ? <ItemIcon key={i} name={name} loadout={loadout} size={size} /> : <EmptySlot key={i} size={size} />,
      )}
      <span className="ml-0.5 inline-flex sm:ml-1">
        {trinket ? (
          <ItemIcon name={trinket} loadout={loadout} size={size} className="rounded-full" />
        ) : (
          <EmptySlot size={size} className="rounded-full" />
        )}
      </span>
    </span>
  );
}

import {
  BookOpen, CloudFog, Coins, Crown, Droplet, Flame, Footprints, Gem, Ghost, Hammer, Heart, HeartPulse, CircleHelp,
  Rewind, Shield, Skull, Snowflake, Sparkles, Store, Sword, Swords, Zap, type LucideIcon,
} from 'lucide-react';
import type { NodeKind } from '../../game/map';
import { UPGRADES, type UpgradeId } from '../../game/upgrades';

const BY_NAME: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ghost: Ghost,
  zap: Zap,
  shield: Shield,
  rewind: Rewind,
  crown: Crown,
  sparkles: Sparkles,
  swords: Swords,
  sword: Sword,
  heart: Heart,
  snowflake: Snowflake,
  'cloud-fog': CloudFog,
  droplet: Droplet,
  coins: Coins,
  footprints: Footprints,
  'book-open': BookOpen,
};

export function UpgradeIcon({ id, size = 18, className }: { id: UpgradeId; size?: number; className?: string }) {
  const I = BY_NAME[UPGRADES[id].icon] ?? Sparkles;
  return <I size={size} className={className} strokeWidth={2} />;
}

export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  battle: Swords,
  elite: Skull,
  boss: Crown,
  treasure: Gem,
  upgrade: Hammer,
  rest: Flame,
  event: CircleHelp,
  shop: Store,
};

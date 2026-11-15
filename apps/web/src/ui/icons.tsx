import type { SVGProps } from 'react';
import { ArrowRightIcon as PhArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import { ArrowSquareOutIcon as PhArrowSquareOut } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut';
import { ArrowsDownUpIcon as PhArrowsDownUp } from '@phosphor-icons/react/dist/ssr/ArrowsDownUp';
import { BabyIcon as PhBaby } from '@phosphor-icons/react/dist/ssr/Baby';
import { CalendarBlankIcon as PhCalendarBlank } from '@phosphor-icons/react/dist/ssr/CalendarBlank';
import { CaretDownIcon as PhCaretDown } from '@phosphor-icons/react/dist/ssr/CaretDown';
import { CaretLeftIcon as PhCaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import { CaretRightIcon as PhCaretRight } from '@phosphor-icons/react/dist/ssr/CaretRight';
import { CatIcon as PhCat } from '@phosphor-icons/react/dist/ssr/Cat';
import { CheckIcon as PhCheck } from '@phosphor-icons/react/dist/ssr/Check';
import { ClockIcon as PhClock } from '@phosphor-icons/react/dist/ssr/Clock';
import { CoinsIcon as PhCoins } from '@phosphor-icons/react/dist/ssr/Coins';
import { DogIcon as PhDog } from '@phosphor-icons/react/dist/ssr/Dog';
import { EnvelopeIcon as PhEnvelope } from '@phosphor-icons/react/dist/ssr/Envelope';
import { GearSixIcon as PhGearSix } from '@phosphor-icons/react/dist/ssr/GearSix';
import { GenderIntersexIcon as PhGenderIntersex } from '@phosphor-icons/react/dist/ssr/GenderIntersex';
import { HeartIcon as PhHeart } from '@phosphor-icons/react/dist/ssr/Heart';
import { HouseIcon as PhHouse } from '@phosphor-icons/react/dist/ssr/House';
import { InfoIcon as PhInfo } from '@phosphor-icons/react/dist/ssr/Info';
import { LightningIcon as PhLightning } from '@phosphor-icons/react/dist/ssr/Lightning';
import { ListIcon as PhList } from '@phosphor-icons/react/dist/ssr/List';
import { MagnifyingGlassIcon as PhMagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import { MapPinIcon as PhMapPin } from '@phosphor-icons/react/dist/ssr/MapPin';
import { PawPrintIcon as PhPawPrint } from '@phosphor-icons/react/dist/ssr/PawPrint';
import { PhoneIcon as PhPhone } from '@phosphor-icons/react/dist/ssr/Phone';
import { PlusIcon as PhPlus } from '@phosphor-icons/react/dist/ssr/Plus';
import { RulerIcon as PhRuler } from '@phosphor-icons/react/dist/ssr/Ruler';
import { ShareNetworkIcon as PhShareNetwork } from '@phosphor-icons/react/dist/ssr/ShareNetwork';
import { ShieldCheckIcon as PhShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck';
import { SparkleIcon as PhSparkle } from '@phosphor-icons/react/dist/ssr/Sparkle';
import { TrayIcon as PhTray } from '@phosphor-icons/react/dist/ssr/Tray';
import { UsersIcon as PhUsers } from '@phosphor-icons/react/dist/ssr/Users';
import { WarningIcon as PhWarning } from '@phosphor-icons/react/dist/ssr/Warning';
import { XIcon as PhX } from '@phosphor-icons/react/dist/ssr/X';

/**
 * Soft Clay icons: thin wrappers around Phosphor glyphs. Each export keeps the old name, accepts SVG props
 * (width, height, className, ...) and defaults to 20px. They paint with currentColor, so the surrounding text
 * color (and every theme) decides the color. Duotone glyphs add a 20% tint of the same color behind the line;
 * small utility glyphs use bold so they stay crisp at 12-16px, and duotone glyphs switch to bold at 20px or smaller. The /ssr entry points are plain components
 * (no context), so they render the same in Astro's server pass and in the browser, and each icon is its own
 * module, so only the ones used end up in a bundle. Add a glyph by importing it above and adding a line below.
 */
type Weight = 'regular' | 'bold' | 'duotone' | 'fill';
type Glyph = typeof PhPawPrint;
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'>;

const DEFAULT_SIZE = 20;
/** Duotone glyphs keep the same 1px-at-16px line as regular, which is too faint for small UI. At this size or smaller they switch to bold. */
const SMALL_MAX = 20;

const icon = (Glyph: Glyph, weight: Weight, name: string) => {
  const Component = (props: IconProps) => {
    const px = Number(props.width ?? props.height ?? DEFAULT_SIZE);
    const w: Weight = weight === 'duotone' && px <= SMALL_MAX ? 'bold' : weight;
    return <Glyph weight={w} width={DEFAULT_SIZE} height={DEFAULT_SIZE} aria-hidden="true" focusable="false" {...props} />;
  };
  Component.displayName = name;
  return Component;
};

export const SearchIcon = /* @__PURE__ */ icon(PhMagnifyingGlass, 'bold', 'SearchIcon');
export const CloseIcon = /* @__PURE__ */ icon(PhX, 'bold', 'CloseIcon');
export const CheckIcon = /* @__PURE__ */ icon(PhCheck, 'bold', 'CheckIcon');
export const PlusIcon = /* @__PURE__ */ icon(PhPlus, 'bold', 'PlusIcon');
export const MenuIcon = /* @__PURE__ */ icon(PhList, 'bold', 'MenuIcon');
export const SortIcon = /* @__PURE__ */ icon(PhArrowsDownUp, 'bold', 'SortIcon');
export const ExternalIcon = /* @__PURE__ */ icon(PhArrowSquareOut, 'bold', 'ExternalIcon');
export const ArrowRightIcon = /* @__PURE__ */ icon(PhArrowRight, 'bold', 'ArrowRightIcon');
export const ChevronLeftIcon = /* @__PURE__ */ icon(PhCaretLeft, 'bold', 'ChevronLeftIcon');
export const ChevronRightIcon = /* @__PURE__ */ icon(PhCaretRight, 'bold', 'ChevronRightIcon');
export const ChevronDownIcon = /* @__PURE__ */ icon(PhCaretDown, 'bold', 'ChevronDownIcon');
export const HeartIcon = /* @__PURE__ */ icon(PhHeart, 'bold', 'HeartIcon');
export const HeartFilledIcon = /* @__PURE__ */ icon(PhHeart, 'fill', 'HeartFilledIcon');
export const PawIcon = /* @__PURE__ */ icon(PhPawPrint, 'duotone', 'PawIcon');
export const HomeIcon = /* @__PURE__ */ icon(PhHouse, 'duotone', 'HomeIcon');
export const HouseIcon = /* @__PURE__ */ icon(PhHouse, 'duotone', 'HouseIcon');
export const InboxIcon = /* @__PURE__ */ icon(PhTray, 'duotone', 'InboxIcon');
export const CoinIcon = /* @__PURE__ */ icon(PhCoins, 'duotone', 'CoinIcon');
export const SettingsIcon = /* @__PURE__ */ icon(PhGearSix, 'duotone', 'SettingsIcon');
export const CalendarIcon = /* @__PURE__ */ icon(PhCalendarBlank, 'duotone', 'CalendarIcon');
export const ClockIcon = /* @__PURE__ */ icon(PhClock, 'duotone', 'ClockIcon');
export const PinIcon = /* @__PURE__ */ icon(PhMapPin, 'duotone', 'PinIcon');
export const MapPinIcon = /* @__PURE__ */ icon(PhMapPin, 'duotone', 'MapPinIcon');
export const PhoneIcon = /* @__PURE__ */ icon(PhPhone, 'duotone', 'PhoneIcon');
export const MailIcon = /* @__PURE__ */ icon(PhEnvelope, 'duotone', 'MailIcon');
export const RulerIcon = /* @__PURE__ */ icon(PhRuler, 'duotone', 'RulerIcon');
export const SexIcon = /* @__PURE__ */ icon(PhGenderIntersex, 'duotone', 'SexIcon');
export const LightningIcon = /* @__PURE__ */ icon(PhLightning, 'duotone', 'LightningIcon');
export const BabyIcon = /* @__PURE__ */ icon(PhBaby, 'duotone', 'BabyIcon');
export const UsersIcon = /* @__PURE__ */ icon(PhUsers, 'duotone', 'UsersIcon');
export const DogIcon = /* @__PURE__ */ icon(PhDog, 'duotone', 'DogIcon');
export const CatIcon = /* @__PURE__ */ icon(PhCat, 'duotone', 'CatIcon');
export const ShieldCheckIcon = /* @__PURE__ */ icon(PhShieldCheck, 'duotone', 'ShieldCheckIcon');
export const SparkleIcon = /* @__PURE__ */ icon(PhSparkle, 'duotone', 'SparkleIcon');
export const ShareIcon = /* @__PURE__ */ icon(PhShareNetwork, 'duotone', 'ShareIcon');
export const InfoIcon = /* @__PURE__ */ icon(PhInfo, 'duotone', 'InfoIcon');
export const WarningIcon = /* @__PURE__ */ icon(PhWarning, 'duotone', 'WarningIcon');

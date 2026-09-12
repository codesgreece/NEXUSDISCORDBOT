/**
 * Central category ↔ Discord channel mapping.
 * Change this file (or DB overrides later) — do not scatter channel names elsewhere.
 */

export type ProductCategoryKey =
  | 'WEBSITES'
  | 'DISCORD_BOTS'
  | 'DESIGNS'
  | 'SERVICES'
  | 'DIGITAL_PRODUCTS'
  | 'PROJECTS'
  | 'REVIEWS'
  | 'PORTFOLIO'
  | 'BOT_SERVICES'
  | 'FEATURES'
  | 'BOT_PROJECTS'
  | 'BOT_REVIEWS';

export type ContentPageKey =
  | 'welcome'
  | 'rules'
  | 'announcements'
  | 'services'
  | 'pricing'
  | 'websites'
  | 'designs'
  | 'projects'
  | 'reviews'
  | 'portfolio'
  | 'bots'
  | 'bot-services'
  | 'features'
  | 'bot-projects'
  | 'bot-reviews'
  | 'general';

export interface CategoryDefinition {
  key: ProductCategoryKey;
  name: string;
  emoji: string;
  /** Exact Discord text channel name (must already exist) */
  channelName: string;
  /** Shown in /shop menu */
  shopVisible: boolean;
  sortOrder: number;
}

export interface ContentChannelDefinition {
  key: ContentPageKey;
  channelName: string;
  label: string;
}

/** Product categories — dynamic list, keyed for DB + Discord */
export const PRODUCT_CATEGORIES: CategoryDefinition[] = [
  {
    key: 'DISCORD_BOTS',
    name: 'Discord Bots',
    emoji: '🤖',
    channelName: '🤖・bots',
    shopVisible: true,
    sortOrder: 1,
  },
  {
    key: 'WEBSITES',
    name: 'Websites',
    emoji: '🌐',
    channelName: '🖥️・websites',
    shopVisible: true,
    sortOrder: 2,
  },
  {
    key: 'DESIGNS',
    name: 'Designs',
    emoji: '🎨',
    channelName: '🎨・designs',
    shopVisible: true,
    sortOrder: 3,
  },
  {
    key: 'SERVICES',
    name: 'Services',
    emoji: '⚙️',
    channelName: '💼・services',
    shopVisible: true,
    sortOrder: 4,
  },
  {
    key: 'DIGITAL_PRODUCTS',
    name: 'Digital Products',
    emoji: '📦',
    channelName: '📁・portfolio',
    shopVisible: true,
    sortOrder: 5,
  },
  {
    key: 'PROJECTS',
    name: 'Projects',
    emoji: '🚀',
    channelName: '🚀・projects',
    shopVisible: false,
    sortOrder: 10,
  },
  {
    key: 'REVIEWS',
    name: 'Reviews',
    emoji: '⭐',
    channelName: '⭐・reviews',
    shopVisible: false,
    sortOrder: 11,
  },
  {
    key: 'PORTFOLIO',
    name: 'Portfolio',
    emoji: '📁',
    channelName: '📁・portfolio',
    shopVisible: false,
    sortOrder: 12,
  },
  {
    key: 'BOT_SERVICES',
    name: 'Bot Services',
    emoji: '⚙️',
    channelName: '⚙️・bot-services',
    shopVisible: false,
    sortOrder: 13,
  },
  {
    key: 'FEATURES',
    name: 'Bot Features',
    emoji: '🧩',
    channelName: '🧩・features',
    shopVisible: false,
    sortOrder: 14,
  },
  {
    key: 'BOT_PROJECTS',
    name: 'Bot Projects',
    emoji: '🚀',
    channelName: '🚀・bot-projects',
    shopVisible: false,
    sortOrder: 15,
  },
  {
    key: 'BOT_REVIEWS',
    name: 'Bot Reviews',
    emoji: '⭐',
    channelName: '⭐・bot-reviews',
    shopVisible: false,
    sortOrder: 16,
  },
];

/** Informational / page channels (existing structure only) */
export const CONTENT_CHANNELS: ContentChannelDefinition[] = [
  { key: 'welcome', channelName: '👋・welcome', label: 'Welcome' },
  { key: 'rules', channelName: '📜・rules', label: 'Rules' },
  { key: 'announcements', channelName: '📢・announcements', label: 'Announcements' },
  { key: 'services', channelName: '💼・services', label: 'Services' },
  { key: 'pricing', channelName: '💰・pricing', label: 'Pricing' },
  { key: 'websites', channelName: '🖥️・websites', label: 'Websites' },
  { key: 'designs', channelName: '🎨・designs', label: 'Designs' },
  { key: 'projects', channelName: '🚀・projects', label: 'Projects' },
  { key: 'reviews', channelName: '⭐・reviews', label: 'Reviews' },
  { key: 'portfolio', channelName: '📁・portfolio', label: 'Portfolio' },
  { key: 'bots', channelName: '🤖・bots', label: 'Discord Bots' },
  { key: 'bot-services', channelName: '⚙️・bot-services', label: 'Bot Services' },
  { key: 'features', channelName: '🧩・features', label: 'Features' },
  { key: 'bot-projects', channelName: '🚀・bot-projects', label: 'Bot Projects' },
  { key: 'bot-reviews', channelName: '⭐・bot-reviews', label: 'Bot Reviews' },
  { key: 'general', channelName: '💬・general', label: 'General' },
];

export function getCategoryDefinition(key: string): CategoryDefinition | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.key === key);
}

export function getShopCategories(): CategoryDefinition[] {
  return PRODUCT_CATEGORIES.filter((c) => c.shopVisible).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function channelNameForCategory(key: string): string | null {
  return getCategoryDefinition(key)?.channelName ?? null;
}

/** Interaction custom ID prefixes */
export const NEXUS_IDS = {
  CONTENT_ROOT: 'nexus:content:root',
  CONTENT_ANNOUNCEMENTS: 'nexus:content:announcements',
  CONTENT_PRODUCTS: 'nexus:content:products',
  CONTENT_PAGES: 'nexus:content:pages',
  CONTENT_REVIEWS: 'nexus:content:reviews',
  CONTENT_PROJECTS: 'nexus:content:projects',
  CONTENT_SYNC: 'nexus:content:sync',
  PRODUCT_NEW: 'nexus:product:new',
  PRODUCT_EDIT: 'nexus:product:edit',
  PRODUCT_DELETE: 'nexus:product:delete',
  PRODUCT_TOGGLE: 'nexus:product:toggle',
  PRODUCT_SYNC: 'nexus:product:sync',
  PRODUCT_SELECT_EDIT: 'nexus:product:select:edit',
  PRODUCT_SELECT_DELETE: 'nexus:product:select:delete',
  PRODUCT_SELECT_TOGGLE: 'nexus:product:select:toggle',
  PRODUCT_CAT_CREATE: 'nexus:product:cat:create',
  PRODUCT_MODAL_CREATE: 'nexus:product:modal:create',
  PRODUCT_MODAL_EDIT: 'nexus:product:modal:edit',
  SHOP_ROOT: 'nexus:shop:root',
  SHOP_CAT: 'nexus:shop:cat',
  BUY: 'nexus:buy',
  BUY_CONFIRM: 'nexus:buy:confirm',
  BUY_CANCEL: 'nexus:buy:cancel',
  INFO: 'nexus:info',
} as const;

export function isNexusCustomId(id: string): boolean {
  return id.startsWith('nexus:');
}

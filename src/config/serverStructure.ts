export const BRAND = {
  name: 'NEXUS | DEVELOPMENT',
  tagline: 'Websites • Discord Bots • Digital Solutions',
  color: 0x2b2d31,
  accent: 0x5865f2,
  success: 0x57f287,
  danger: 0xed4245,
  warning: 0xfee75c,
} as const;

export interface RoleDefinition {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  /** Higher = closer to top of hierarchy */
  position: number;
}

export interface ChannelDefinition {
  name: string;
  topic?: string;
  staffOnly?: boolean;
}

export interface CategoryDefinition {
  name: string;
  staffOnly?: boolean;
  channels: ChannelDefinition[];
}

/** Staff roles that can access staff channels and tickets */
export const STAFF_ROLE_NAMES = [
  '👑 Owner',
  '🛡️ Administrator',
  '🔨 Developer',
  '🎨 Designer',
  '💼 Manager',
  '🧪 Tester',
] as const;

export const ROLES: RoleDefinition[] = [
  { name: '👑 Owner', color: 0xe74c3c, hoist: true, mentionable: false, position: 10 },
  { name: '🛡️ Administrator', color: 0xe67e22, hoist: true, mentionable: false, position: 9 },
  { name: '🔨 Developer', color: 0x3498db, hoist: true, mentionable: false, position: 8 },
  { name: '🎨 Designer', color: 0x9b59b6, hoist: true, mentionable: false, position: 7 },
  { name: '💼 Manager', color: 0x1abc9c, hoist: true, mentionable: false, position: 6 },
  { name: '🧪 Tester', color: 0xf1c40f, hoist: true, mentionable: false, position: 5 },
  { name: '🤝 Partner', color: 0x2ecc71, hoist: true, mentionable: true, position: 4 },
  { name: '⭐ Client', color: 0xf39c12, hoist: true, mentionable: false, position: 3 },
  { name: '👤 Member', color: 0x95a5a6, hoist: true, mentionable: false, position: 2 },
  { name: '🤖 Bot', color: 0x7289da, hoist: true, mentionable: false, position: 1 },
];

export const CATEGORIES: CategoryDefinition[] = [
  {
    name: '📌 INFORMATION',
    channels: [
      { name: '👋・welcome', topic: 'Welcome to NEXUS | DEVELOPMENT' },
      { name: '📜・rules', topic: 'Server rules and guidelines' },
      { name: '📢・announcements', topic: 'Official announcements' },
      { name: '💼・services', topic: 'Our services' },
      { name: '💰・pricing', topic: 'Custom pricing information' },
    ],
  },
  {
    name: '🌐 WEBSITES',
    channels: [
      { name: '🖥️・websites', topic: 'Website projects and showcases' },
      { name: '🎨・designs', topic: 'Web design work' },
      { name: '🚀・projects', topic: 'Active website projects' },
      { name: '⭐・reviews', topic: 'Client reviews for websites' },
      { name: '📁・portfolio', topic: 'Website portfolio' },
    ],
  },
  {
    name: '🤖 DISCORD BOTS',
    channels: [
      { name: '🤖・bots', topic: 'Discord bot projects' },
      { name: '⚙️・bot-services', topic: 'Bot services overview' },
      { name: '🧩・features', topic: 'Bot features and capabilities' },
      { name: '🚀・bot-projects', topic: 'Active bot projects' },
      { name: '⭐・bot-reviews', topic: 'Client reviews for bots' },
    ],
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      { name: '💬・general', topic: 'General community chat' },
      { name: '💡・ideas', topic: 'Share your ideas' },
      { name: '🆘・support', topic: 'Community support' },
      { name: '📸・showcase', topic: 'Showcase your work' },
    ],
  },
  {
    name: '🎫 SUPPORT',
    channels: [
      { name: '🎫・create-ticket', topic: 'Open a support ticket' },
      { name: '📋・orders', topic: 'Order status updates' },
      { name: '📞・contact', topic: 'Contact information' },
    ],
  },
  {
    name: '🔒 STAFF',
    staffOnly: true,
    channels: [
      { name: '🔧・staff-chat', topic: 'Staff discussion', staffOnly: true },
      { name: '📦・orders', topic: 'Staff order management', staffOnly: true },
      { name: '💳・payments', topic: 'Payment tracking', staffOnly: true },
      { name: '📝・logs', topic: 'Bot and moderation logs', staffOnly: true },
    ],
  },
];

export const TICKET_TYPES = {
  website: { label: 'Website', emoji: '🌐', prefix: 'ticket-website' },
  bot: { label: 'Discord Bot', emoji: '🤖', prefix: 'ticket-bot' },
  pricing: { label: 'Pricing', emoji: '💰', prefix: 'ticket-pricing' },
  support: { label: 'Support', emoji: '🛠️', prefix: 'ticket-support' },
  partnership: { label: 'Partnership', emoji: '🤝', prefix: 'ticket-partnership' },
} as const;

export type TicketType = keyof typeof TICKET_TYPES;

/** Custom IDs for button interactions */
export const CUSTOM_IDS = {
  TICKET_WEBSITE: 'ticket:website',
  TICKET_BOT: 'ticket:bot',
  TICKET_PRICING: 'ticket:pricing',
  TICKET_SUPPORT: 'ticket:support',
  TICKET_PARTNERSHIP: 'ticket:partnership',
  TICKET_CLOSE: 'ticket:close',
  TICKET_DELETE: 'ticket:delete',
  TICKET_DELETE_CONFIRM: 'ticket:delete_confirm',
  TICKET_DELETE_CANCEL: 'ticket:delete_cancel',
} as const;

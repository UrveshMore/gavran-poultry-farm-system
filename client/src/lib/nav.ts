/** Farmer-facing groups. A screen is shown only when the person has one of its permissions. */

export const GROUP_IDS = ['daily', 'birds', 'incubator', 'health', 'feed', 'money', 'reports', 'people', 'settings'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export type ScreenId =
  | 'today'
  | 'yard'
  | 'tasks'
  | 'workforce'
  | 'notices'
  | 'batches'
  | 'eggs'
  | 'lots'
  | 'trays'
  | 'birdsBook'
  | 'losses'
  | 'parentage'
  | 'incubators'
  | 'incubation'
  | 'health'
  | 'medicines'
  | 'stock'
  | 'sales'
  | 'expenses'
  | 'income'
  | 'suppliers'
  | 'invoices'
  | 'reports'
  | 'people'
  | 'profile'
  | 'sheds'
  | 'documents'
  | 'schedules'
  | 'safeguards'
  | 'offline'
  | 'search'
  | 'saathi'
  | 'activity';

export type ScreenDef = {
  id: ScreenId;
  group: GroupId;
  /** Path after `/farms/:farmId/`. */
  path: string;
  anyPermission: string[];
};

export const SCREENS: ScreenDef[] = [
  { id: 'today', group: 'daily', path: 'today', anyPermission: ['task.read', 'egg.read', 'attendance.read', 'yard.read'] },
  { id: 'saathi', group: 'daily', path: 'saathi', anyPermission: ['farm.read'] },
  { id: 'yard', group: 'daily', path: 'yard', anyPermission: ['yard.read'] },
  { id: 'tasks', group: 'daily', path: 'tasks', anyPermission: ['task.read'] },
  { id: 'workforce', group: 'daily', path: 'workforce', anyPermission: ['attendance.read', 'training.read'] },
  { id: 'notices', group: 'daily', path: 'notices', anyPermission: ['notification.read'] },
  { id: 'batches', group: 'birds', path: 'batches', anyPermission: ['batch.read'] },
  { id: 'eggs', group: 'birds', path: 'eggs', anyPermission: ['egg.read'] },
  { id: 'lots', group: 'birds', path: 'egg-lots', anyPermission: ['egg.read'] },
  { id: 'birdsBook', group: 'birds', path: 'birds', anyPermission: ['loss.read'] },
  { id: 'losses', group: 'birds', path: 'losses', anyPermission: ['loss.read'] },
  // new-flow: parentage stays in the app and the route. It is not in the menu.
  // { id: 'parentage', group: 'birds', path: 'parentage', anyPermission: ['breeding.read'] },
  { id: 'trays', group: 'incubator', path: 'trays', anyPermission: ['incubator.read'] },
  { id: 'incubators', group: 'incubator', path: 'incubators', anyPermission: ['incubator.read'] },
  { id: 'incubation', group: 'incubator', path: 'incubation', anyPermission: ['incubation.read'] },
  { id: 'health', group: 'health', path: 'health', anyPermission: ['health.read'] },
  { id: 'medicines', group: 'health', path: 'medicines', anyPermission: ['health.approve'] },
  { id: 'stock', group: 'feed', path: 'stock', anyPermission: ['stock.read'] },
  { id: 'sales', group: 'money', path: 'sales', anyPermission: ['sale.read'] },
  { id: 'expenses', group: 'money', path: 'expenses', anyPermission: ['expense.read'] },
  { id: 'income', group: 'money', path: 'income', anyPermission: ['expense.read', 'sale.read'] },
  { id: 'suppliers', group: 'money', path: 'suppliers', anyPermission: ['supplier.read'] },
  { id: 'invoices', group: 'money', path: 'invoice-documents', anyPermission: ['sale.read'] },
  { id: 'reports', group: 'reports', path: 'reports', anyPermission: ['report.read'] },
  { id: 'people', group: 'people', path: 'people', anyPermission: ['user.read'] },
  { id: 'profile', group: 'settings', path: 'profile', anyPermission: ['farm.read'] },
  { id: 'sheds', group: 'settings', path: 'sheds', anyPermission: ['shed.read'] },
  { id: 'documents', group: 'settings', path: 'documents', anyPermission: ['document.read'] },
  { id: 'schedules', group: 'settings', path: 'report-schedules', anyPermission: ['report.read'] },
  { id: 'safeguards', group: 'settings', path: 'safeguards', anyPermission: ['audit.read'] },
  { id: 'offline', group: 'settings', path: 'offline', anyPermission: ['attendance.read'] },
  { id: 'search', group: 'settings', path: 'search', anyPermission: ['farm.read'] },
  { id: 'activity', group: 'settings', path: 'activity', anyPermission: ['audit.read'] },
];

export function visibleScreens(permissions: readonly string[]): ScreenDef[] {
  return SCREENS.filter((screen) => screen.anyPermission.some((code) => permissions.includes(code)));
}

export function screensInGroup(group: GroupId, permissions: readonly string[]): ScreenDef[] {
  return visibleScreens(permissions).filter((screen) => screen.group === group);
}

export function visibleGroups(permissions: readonly string[]): GroupId[] {
  return GROUP_IDS.filter((group) => screensInGroup(group, permissions).length > 0);
}

export function screenByPath(path: string): ScreenDef | undefined {
  return SCREENS.find((screen) => screen.path === path);
}

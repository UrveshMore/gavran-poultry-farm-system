import { LocalNotifications } from '@capacitor/local-notifications';
import { planPhoneAlerts, type PhoneAlertKind } from '@gavran/shared';
import type { DashboardData } from '@/components/DashboardCards';
import { isNativeApp } from '@/lib/serverAddress';

const titles: Record<PhoneAlertKind, string> = {
  morning: 'Morning medicine',
  evening: 'Evening medicine',
  low_stock: 'Feed is low',
  eggs: "Today's eggs are not written",
};

function bodyFor(kind: PhoneAlertKind, count: number): string {
  if (kind === 'morning') return `${count} morning lines are still open.`;
  if (kind === 'evening') return `${count} evening lines are still open.`;
  if (kind === 'low_stock') return `${count} feed items are under the number you set.`;
  return "Write today's eggs when you can.";
}

export async function schedulePhoneAlerts(data: DashboardData): Promise<void> {
  if (!isNativeApp()) return;
  const lines = data.doses?.approved ? data.doses.groups.flatMap((group) => group.lines) : [];
  const plans = planPhoneAlerts({
    now: new Date(),
    morningDue: lines.filter((line) => !line.given && (line.slot === 'morning' || line.slot === 'full_day')).length,
    eveningDue: lines.filter((line) => !line.given && line.slot === 'evening').length,
    lowStock: data.stock?.low.length ?? 0,
    eggsMissing: data.alerts.some((alert) => alert.code === 'eggs_missing'),
  });
  if (plans.length === 0) return;
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return;
  const day = data.today;
  const fresh = plans.filter((plan) => localStorage.getItem(`gavran.phone.${day}.${plan.id}`) !== '1');
  if (fresh.length === 0) return;
  await LocalNotifications.schedule({
    notifications: fresh.map((plan) => ({
      id: plan.id,
      title: titles[plan.kind],
      body: bodyFor(plan.kind, plan.count),
      schedule: { at: new Date(plan.at), allowWhileIdle: true },
    })),
  });
  for (const plan of fresh) localStorage.setItem(`gavran.phone.${day}.${plan.id}`, '1');
}

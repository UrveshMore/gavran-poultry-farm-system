import { LocalNotifications } from '@capacitor/local-notifications';
import { dailyPhoneNotices, type PhoneAlertKind } from '@gavran/shared';
import type { DashboardData } from '@/components/DashboardCards';
import { isNativeApp } from '@/lib/serverAddress';

const titles: Record<PhoneAlertKind, string> = {
  morning: 'Morning medicine',
  evening: 'Evening medicine',
  low_stock: 'Feed is low',
  eggs: "Today's egg entry pending",
};

function bodyFor(kind: PhoneAlertKind, count: number): string {
  if (kind === 'morning') return count > 0 ? `${count} morning lines are still open.` : 'Check morning medicine in Gavran.';
  if (kind === 'evening') return count > 0 ? `${count} evening lines are still open.` : 'Check evening medicine in Gavran.';
  if (kind === 'low_stock') return count > 0 ? `${count} feed items are under the number you set.` : 'Check feed on hand.';
  return count > 0 ? "Today's egg entry is still pending." : "Write today's eggs if you have not yet.";
}

/** Refresh the 8:00 and 17:00 alarms once per farm day. The phone keeps them after the app closes. */
export async function schedulePhoneAlerts(farmId: string, data: DashboardData): Promise<void> {
  if (!isNativeApp()) return;
  const phone = data.phone ?? {
    morningOn: true,
    eveningOn: true,
    lowStockOn: true,
    eggsOn: true,
    morningMinute: 480,
    eveningMinute: 1020,
  };
  const stamp = `${data.today}.${phone.morningOn}.${phone.eveningOn}.${phone.lowStockOn}.${phone.eggsOn}.${phone.morningMinute}.${phone.eveningMinute}`;
  const syncKey = `gavran.phone.sync.${farmId}.${stamp}`;
  if (localStorage.getItem(syncKey) === '1') return;
  const lines = data.doses?.groups.flatMap((group) => group.lines) ?? [];
  const notices = dailyPhoneNotices({
    morningDue: lines.filter((line) => !line.given && (line.slot === 'morning' || line.slot === 'full_day')).length,
    eveningDue: lines.filter((line) => !line.given && line.slot === 'evening').length,
    lowStock: data.stock?.low.length ?? 0,
    eggsMissing: data.alerts.some((alert) => alert.code === 'eggs_missing'),
    ...phone,
  });
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return;
  await LocalNotifications.cancel({ notifications: [{ id: 800 }, { id: 801 }, { id: 1700 }, { id: 1701 }] });
  if (notices.length > 0) {
    await LocalNotifications.schedule({
      notifications: notices.map((notice) => ({
        id: notice.id,
        title: titles[notice.kind],
        body: bodyFor(notice.kind, notice.count),
        schedule: { on: { hour: notice.hour, minute: notice.minute }, repeats: true, allowWhileIdle: true },
      })),
    });
  }
  localStorage.setItem(syncKey, '1');
}

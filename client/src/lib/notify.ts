/** Show a notice without waiting for a service worker that is not registered in dev. */
export async function showFarmNotice(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    throw new Error('unavailable');
  }
  const container = navigator.serviceWorker;
  if (container) {
    const regs = await container.getRegistrations();
    const active = regs.find((reg) => reg.active);
    if (active) {
      await active.showNotification(title, { body });
      return;
    }
  }
  new Notification(title, { body });
}

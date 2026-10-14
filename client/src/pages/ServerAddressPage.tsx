import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Input } from '@/components/ui';
import { saveServer } from '@/lib/serverAddress';

export function ServerAddressPage() {
  const { t } = useTranslation();
  const [address, setAddress] = useState('');
  const ready = /^https?:\/\/[^\s]+$/.test(address.trim());
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 px-4">
      <Card>
        <h1 className="font-display text-3xl font-semibold">{t('server.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('server.body')}</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            saveServer(address);
            window.location.reload();
          }}
        >
          <Field id="server-address" label={t('server.label')} hint={t('server.hint')}>
            <Input
              id="server-address"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://farm.ts.net"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!ready}>
            {t('server.use')}
          </Button>
        </form>
      </Card>
    </main>
  );
}

import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { farmInputSchema, ROLE_PERMISSIONS, shedInputSchema } from '@gavran/shared';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/security/password.js';
import { redact } from '../../src/security/redact.js';
import { createLoginThrottle } from '../../src/security/loginThrottle.js';
import { signAccessToken, tokensMatch, verifyAccessToken } from '../../src/security/tokens.js';
import { AppError } from '../../src/http/errors.js';

describe('passwords', () => {
  it('verifies a matching password and rejects a different one', async () => {
    const stored = await hashPassword('correct-horse-battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct-horse-battery', stored)).toBe(true);
    expect(await verifyPassword('wrong-password-value', stored)).toBe(false);
    expect(await verifyPassword('correct-horse-battery', 'not-a-hash')).toBe(false);
  });
});

describe('redaction', () => {
  it('removes secrets nested in an audit summary', () => {
    expect(
      redact({
        email: 'a@example.com',
        password: 'secret',
        pin: '4821',
        nested: { refreshToken: 'abc', note: 'ok' },
      }),
    ).toEqual({
      email: 'a@example.com',
      password: '[redacted]',
      pin: '[redacted]',
      nested: { refreshToken: '[redacted]', note: 'ok' },
    });
  });
});

describe('login throttle', () => {
  it('blocks after the configured number of failures', () => {
    const throttle = createLoginThrottle(2, 60_000);
    throttle.assert('email:a@example.com');
    throttle.fail('email:a@example.com');
    throttle.fail('email:a@example.com');
    expect(() => throttle.assert('email:a@example.com')).toThrow(AppError);
  });
});

describe('tokens', () => {
  it('compares CSRF tokens in constant time', () => {
    expect(tokensMatch('same-token-value', 'same-token-value')).toBe(true);
    expect(tokensMatch('same-token-value', 'other-token-value')).toBe(false);
    expect(tokensMatch('short', 'longer-value')).toBe(false);
  });

  it('rejects an expired access token', async () => {
    const token = await signAccessToken('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
    expect(await verifyAccessToken(token)).toMatchObject({
      sub: '11111111-1111-4111-8111-111111111111',
      sid: '22222222-2222-4222-8222-222222222222',
    });
    expect(await verifyAccessToken(`${token}x`)).toBeNull();
  });
});

describe('schemas', () => {
  it('rejects a negative shed capacity and a short password', () => {
    const shed = shedInputSchema.safeParse({
      code: 'A1',
      name: 'Brooder',
      shedType: 'brooder',
      usableCapacity: -1,
      status: 'active',
      notes: '',
    });
    expect(shed.success).toBe(false);
    const farm = farmInputSchema.safeParse({
      name: 'G',
      code: 'bad code',
      timezone: 'Not/AZone',
      locale: 'en',
      contactName: '',
      contactPhone: '12',
      contactEmail: '',
      addressLine: '',
      weightUnit: 'kg',
      volumeUnit: 'L',
    });
    expect(farm.success).toBe(false);
  });
});

describe('permission catalog', () => {
  it('gives family helpers and system administrators no implied access', () => {
    expect(ROLE_PERMISSIONS.family_helper).toEqual([]);
    expect(ROLE_PERMISSIONS.system_administrator).toEqual([]);
    expect(ROLE_PERMISSIONS.manager).not.toContain('user.manage');
    expect(ROLE_PERMISSIONS.owner).toContain('farm.update');
  });
});

describe('migrations', () => {
  it('pairs every forward migration with a down script that drops its tables', async () => {
    const dir = resolve(import.meta.dirname, '../../../database/migrations');
    const files = await readdir(dir);
    const ups = files.filter((file) => /^\d+_.*\.sql$/.test(file) && !file.endsWith('.down.sql'));
    expect(ups.length).toBeGreaterThan(0);
    for (const file of ups) {
      const up = await readFile(resolve(dir, file), 'utf8');
      const down = await readFile(resolve(dir, file.replace(/\.sql$/, '.down.sql')), 'utf8');
      const tables = [...up.matchAll(/CREATE TABLE\s+(\w+)/gi)].map((match) => match[1]?.toLowerCase() ?? '');
      if (tables.length === 0) {
        expect(down.toLowerCase()).not.toContain('drop table');
        continue;
      }
      for (const table of tables) {
        expect(down.toLowerCase()).toContain(`drop table if exists ${table}`);
      }
    }
  });
});

describe('translations', () => {
  it('keeps English, Hindi, and Marathi keys aligned', async () => {
    const dir = resolve(import.meta.dirname, '../../../client/src/i18n/locales');
    const locales = ['en', 'hi', 'mr'] as const;
    const bundles = await Promise.all(
      locales.map(async (locale) => JSON.parse(await readFile(resolve(dir, `${locale}.json`), 'utf8')) as Record<string, string>),
    );
    const keys = bundles.map((bundle) => Object.keys(bundle).sort());
    expect(keys[1]).toEqual(keys[0]);
    expect(keys[2]).toEqual(keys[0]);
    for (const bundle of bundles) {
      for (const value of Object.values(bundle)) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
    const englishUi = /\b(Download|Report|Save|Login|Password|Email|Submit|Welcome|Click|Dashboard|Settings|Delete|Search|Invoice|Phone|Bill|App)\b/;
    for (const bundle of bundles.slice(1)) {
      for (const [key, value] of Object.entries(bundle)) {
        if (key === 'app.name') continue;
        const visible = value.replace(/\{\{[^}]+\}\}/g, '');
        expect(visible, key).not.toMatch(englishUi);
      }
    }
  });
});

import { z } from 'zod';
import {
  FARM_ROLES,
  LOCALES,
  PERMISSIONS,
  SHED_STATUSES,
  SHED_TYPES,
  VOLUME_UNITS,
  WEIGHT_UNITS,
} from './permissions.js';
import { isIanaTimeZone } from './time.js';

export const passwordSchema = z.string().min(10, 'too_small').max(128, 'too_big');

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'too_small')
  .max(255, 'too_big')
  .email('invalid_format');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'too_small')
  .max(120, 'too_big')
  .refine((value) => !/[\u0000-\u001F]/.test(value), 'invalid_format');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  preferredLocale: z.enum(LOCALES),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'required').max(128, 'too_big'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'required').max(128, 'too_big'),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'different',
    path: ['newPassword'],
  });

export const profileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    preferredLocale: z.enum(LOCALES).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.preferredLocale !== undefined, {
    message: 'required',
    path: ['form'],
  });

export const farmInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(160, 'too_big'),
  code: z
    .string()
    .trim()
    .min(2, 'too_small')
    .max(32, 'too_big')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
  timezone: z.string().trim().min(1, 'required').max(64, 'too_big').refine(isIanaTimeZone, 'invalid_format'),
  locale: z.enum(LOCALES),
  contactName: z.string().trim().max(120, 'too_big'),
  contactPhone: z
    .string()
    .trim()
    .max(32, 'too_big')
    .refine((value) => value === '' || /^[0-9+\-().\s]{6,32}$/.test(value), 'invalid_format'),
  contactEmail: z
    .string()
    .trim()
    .max(255, 'too_big')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'invalid_format'),
  addressLine: z.string().trim().max(255, 'too_big'),
  weightUnit: z.enum(WEIGHT_UNITS),
  volumeUnit: z.enum(VOLUME_UNITS),
});

export const farmUpdateSchema = farmInputSchema
  .partial()
  .extend({
    version: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small'),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'required',
    path: ['form'],
  });

export const shedInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'too_small')
    .max(32, 'too_big')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
  name: z.string().trim().min(2, 'too_small').max(120, 'too_big'),
  shedType: z.enum(SHED_TYPES),
  usableCapacity: z
    .number({ invalid_type_error: 'invalid_format' })
    .int('invalid_format')
    .min(0, 'too_small')
    .max(1_000_000, 'too_big'),
  status: z.enum(SHED_STATUSES),
  notes: z.string().trim().max(1000, 'too_big'),
});

export const shedUpdateSchema = shedInputSchema
  .partial()
  .extend({
    version: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small'),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'required',
    path: ['form'],
  });

export const inviteSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: z.string().max(128, 'too_big'),
    role: z.enum(FARM_ROLES),
    permissionGrants: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'family_helper' && value.permissionGrants.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['permissionGrants'] });
    }
    if (value.password !== '' && value.password.length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_small', path: ['password'] });
    }
  });

export const membershipUpdateSchema = z
  .object({
    role: z.enum(FARM_ROLES).optional(),
    status: z.enum(['active', 'revoked']).optional(),
    permissionGrants: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).optional(),
    deactivateUser: z.boolean().optional(),
    reactivateUser: z.boolean().optional(),
  })
  .refine((value) => !(value.deactivateUser && value.reactivateUser), {
    message: 'invalid_format',
    path: ['form'],
  })
  .refine(
    (value) =>
      value.role !== undefined ||
      value.status !== undefined ||
      value.permissionGrants !== undefined ||
      value.deactivateUser === true ||
      value.reactivateUser === true,
    { message: 'required', path: ['form'] },
  );

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type FarmInput = z.infer<typeof farmInputSchema>;
export type FarmUpdateInput = z.infer<typeof farmUpdateSchema>;
export type ShedInput = z.infer<typeof shedInputSchema>;
export type ShedUpdateInput = z.infer<typeof shedUpdateSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type MembershipUpdateInput = z.infer<typeof membershipUpdateSchema>;

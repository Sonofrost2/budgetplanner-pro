import { describe, it, expect } from 'vitest';
import { transactionSchema, transferSchema, validateForm } from '@/lib/validationSchemas';

const tFr = {
  descriptionRequired: 'Description requise',
  invalidAmount: 'Montant invalide',
  amountTooHigh: 'Montant trop élevé',
  dateRequired: 'Date requise',
  maxChars: (n: number) => `${n} caractères max`,
  transferSameAccount: 'Les comptes doivent être différents',
};

const today = new Date().toISOString().slice(0, 10);

type ValidationFailure = { success: false; errors: Record<string, string> };
type ValidationResult = { success: true; data: unknown } | ValidationFailure;

const expectValidationErrors = (result: ValidationResult): Record<string, string> => {
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error('expected failure');
  }
  return result.errors;
};

describe('transactionSchema', () => {
  it('accepts a valid expense payload', () => {
    const r = validateForm(transactionSchema(tFr, 'fr'), {
      description: 'Course', amount: '1500', type: 'expense',
      category_id: '', account_id: '', date: today, notes: '',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty description with shared message', () => {
    const r = validateForm(transactionSchema(tFr, 'fr'), {
      description: '', amount: '10', type: 'expense', date: today, notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.description).toBe(tFr.descriptionRequired);
  });

  it('rejects zero amount with shared message', () => {
    const r = validateForm(transactionSchema(tFr, 'fr'), {
      description: 'x', amount: '0', type: 'expense', date: today, notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.amount).toBe(tFr.invalidAmount);
  });

  it('rejects amount above cap', () => {
    const r = validateForm(transactionSchema(tFr, 'fr'), {
      description: 'x', amount: '9999999999', type: 'expense', date: today, notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.amount).toBe(tFr.amountTooHigh);
  });
});

describe('transferSchema', () => {
  it('accepts a valid transfer', () => {
    const r = validateForm(transferSchema(tFr, 'fr'), {
      description: 'Vers Wave', amount: '2000', date: today,
      from_account_id: 'a', to_account_id: 'b', notes: '',
    });
    expect(r.success).toBe(true);
  });

  it('reuses the same amount rules as transactions', () => {
    const r = validateForm(transferSchema(tFr, 'fr'), {
      description: 'x', amount: '0', date: today,
      from_account_id: 'a', to_account_id: 'b', notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.amount).toBe(tFr.invalidAmount);
  });

  it('requires distinct source and destination accounts', () => {
    const r = validateForm(transferSchema(tFr, 'fr'), {
      description: 'x', amount: '100', date: today,
      from_account_id: 'a', to_account_id: 'a', notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.to_account_id).toBe(tFr.transferSameAccount);
  });

  it('requires source account', () => {
    const r = validateForm(transferSchema(tFr, 'fr'), {
      description: 'x', amount: '100', date: today,
      from_account_id: '', to_account_id: 'b', notes: '',
    });
    const errors = expectValidationErrors(r);
    expect(errors.from_account_id).toBe('Compte source requis');
  });
});

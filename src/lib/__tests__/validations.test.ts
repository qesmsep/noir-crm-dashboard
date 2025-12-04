/**
 * Tests for Zod validation schemas
 * Ensures validation logic works correctly
 */

import {
  memberSchema,
  updateMemberSchema,
  reservationSchema,
  campaignSchema,
  privateEventSchema,
  ledgerEntrySchema,
  validateWithSchema,
  validate,
} from '../validations';

describe('Validation Schemas', () => {
  describe('memberSchema', () => {
    it('should validate a valid member', () => {
      const validMember = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+15555555555',
        email: 'john@example.com',
      };

      const result = validateWithSchema(memberSchema, validMember);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.first_name).toBe('John');
      }
    });

    it('should reject invalid phone numbers', () => {
      const invalidMember = {
        first_name: 'John',
        last_name: 'Doe',
        phone: 'invalid-phone',
        email: 'john@example.com',
      };

      const result = validateWithSchema(memberSchema, invalidMember);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.phone).toBeDefined();
      }
    });

    it('should reject invalid email addresses', () => {
      const invalidMember = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+15555555555',
        email: 'not-an-email',
      };

      const result = validateWithSchema(memberSchema, invalidMember);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });

    it('should require first and last name', () => {
      const invalidMember = {
        phone: '+15555555555',
      };

      const result = validateWithSchema(memberSchema, invalidMember);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.first_name).toBeDefined();
        expect(result.errors.last_name).toBeDefined();
      }
    });

    it('should allow optional fields', () => {
      const minimalMember = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+15555555555',
      };

      const result = validateWithSchema(memberSchema, minimalMember);
      expect(result.success).toBe(true);
    });
  });

  describe('reservationSchema', () => {
    it('should validate a valid reservation', () => {
      const validReservation = {
        start_time: '2025-10-08T18:00:00Z',
        end_time: '2025-10-08T20:00:00Z',
        party_size: 4,
      };

      const result = validateWithSchema(reservationSchema, validReservation);
      expect(result.success).toBe(true);
    });

    it('should reject end_time before start_time', () => {
      const invalidReservation = {
        start_time: '2025-10-08T20:00:00Z',
        end_time: '2025-10-08T18:00:00Z',
        party_size: 4,
      };

      const result = validateWithSchema(reservationSchema, invalidReservation);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.end_time).toBeDefined();
      }
    });

    it('should reject invalid party sizes', () => {
      const invalidReservation = {
        start_time: '2025-10-08T18:00:00Z',
        end_time: '2025-10-08T20:00:00Z',
        party_size: 0,
      };

      const result = validateWithSchema(reservationSchema, invalidReservation);
      expect(result.success).toBe(false);
    });

    it('should reject party sizes over 20', () => {
      const invalidReservation = {
        start_time: '2025-10-08T18:00:00Z',
        end_time: '2025-10-08T20:00:00Z',
        party_size: 25,
      };

      const result = validateWithSchema(reservationSchema, invalidReservation);
      expect(result.success).toBe(false);
    });
  });

  describe('campaignSchema', () => {
    it('should validate a valid campaign', () => {
      const validCampaign = {
        name: 'Birthday Campaign',
        trigger_type: 'reservation_created' as const,
        active: true,
      };

      const result = validateWithSchema(campaignSchema, validCampaign);
      expect(result.success).toBe(true);
    });

    it('should reject invalid trigger types', () => {
      const invalidCampaign = {
        name: 'Test Campaign',
        trigger_type: 'invalid_type',
        active: true,
      };

      const result = validateWithSchema(campaignSchema, invalidCampaign);
      expect(result.success).toBe(false);
    });

    it('should require campaign name', () => {
      const invalidCampaign = {
        trigger_type: 'recurring' as const,
        active: true,
      };

      const result = validateWithSchema(campaignSchema, invalidCampaign);
      expect(result.success).toBe(false);
    });
  });

  describe('privateEventSchema', () => {
    it('should validate a valid private event', () => {
      const validEvent = {
        name: 'Private Party',
        event_date: '2025-10-15',
        start_time: '18:00',
        end_time: '22:00',
      };

      const result = validateWithSchema(privateEventSchema, validEvent);
      expect(result.success).toBe(true);
    });

    it('should reject invalid time format', () => {
      const invalidEvent = {
        name: 'Private Party',
        event_date: '2025-10-15',
        start_time: '6pm',
        end_time: '10pm',
      };

      const result = validateWithSchema(privateEventSchema, invalidEvent);
      expect(result.success).toBe(false);
    });
  });

  describe('ledgerEntrySchema', () => {
    it('should validate a valid ledger entry', () => {
      const validEntry = {
        member_id: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        type: 'charge' as const,
        date: '2025-10-07',
      };

      const result = validateWithSchema(ledgerEntrySchema, validEntry);
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const invalidEntry = {
        member_id: '123e4567-e89b-12d3-a456-426614174000',
        amount: -50,
        type: 'charge' as const,
        date: '2025-10-07',
      };

      const result = validateWithSchema(ledgerEntrySchema, invalidEntry);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUIDs', () => {
      const invalidEntry = {
        member_id: 'not-a-uuid',
        amount: 100,
        type: 'charge' as const,
        date: '2025-10-07',
      };

      const result = validateWithSchema(ledgerEntrySchema, invalidEntry);
      expect(result.success).toBe(false);
    });
  });

  describe('validate helper function', () => {
    it('should return data on successful validation', () => {
      const validMember = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+15555555555',
      };

      const result = validate(memberSchema, validMember);
      expect(result.first_name).toBe('John');
    });

    it('should throw on validation failure', () => {
      const invalidMember = {
        first_name: 'John',
        phone: 'invalid',
      };

      expect(() => validate(memberSchema, invalidMember)).toThrow();
    });
  });

  describe('updateMemberSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        email: 'newemail@example.com',
      };

      const result = validateWithSchema(updateMemberSchema, partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should still validate the fields that are provided', () => {
      const invalidUpdate = {
        email: 'not-an-email',
      };

      const result = validateWithSchema(updateMemberSchema, invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});

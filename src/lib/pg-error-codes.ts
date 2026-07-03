/**
 * Postgres error codes used when translating DB failures into HTTP responses.
 * See https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

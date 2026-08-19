/**
 * Kept in its own module with no Node imports so middleware can read the cookie
 * name without pulling in the database or node:crypto.
 */
export const SESSION_COOKIE = "bh_session";

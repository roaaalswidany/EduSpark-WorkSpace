// Shared (client + server) quiz policy. Kept out of "use server" files because
// those may only export async functions.
export const QUIZ_MAX_ATTEMPTS_PER_WINDOW = 3;
export const QUIZ_ATTEMPT_WINDOW_HOURS = 24;

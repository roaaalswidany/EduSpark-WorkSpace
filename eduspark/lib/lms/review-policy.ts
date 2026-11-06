// eduspark/lib/lms/review-policy.ts
//
// A rating is only worth something if the rater actually took the course.
// Enrolling is free and instant, so «enrolled» alone lets throw-away accounts farm ratings.
// Progress is a percentage (0–100) stored on Enrollment.progress.
export const COURSE_REVIEW_MIN_PROGRESS = 25;

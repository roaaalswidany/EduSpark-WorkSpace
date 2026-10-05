-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('AI_DRAFTED', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "generatedBy" TEXT,
ADD COLUMN     "status" "QuestionStatus" NOT NULL DEFAULT 'PUBLISHED';

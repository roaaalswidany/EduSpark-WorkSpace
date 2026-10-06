/*
  Warnings:

  - A unique constraint covering the columns `[courseId]` on the table `chat_rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ChatRoomType" ADD VALUE 'COURSE';

-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "courseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_courseId_key" ON "chat_rooms"("courseId");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

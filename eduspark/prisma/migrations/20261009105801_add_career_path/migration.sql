-- CreateTable
CREATE TABLE "career_paths" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "estimatedWeeks" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_path_steps" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "courseId" TEXT,
    "estimatedWeeks" INTEGER NOT NULL,
    "skills" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_path_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "career_paths_userId_status_idx" ON "career_paths"("userId", "status");

-- CreateIndex
CREATE INDEX "career_paths_userId_createdAt_idx" ON "career_paths"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "career_path_steps_pathId_order_idx" ON "career_path_steps"("pathId", "order");

-- AddForeignKey
ALTER TABLE "career_paths" ADD CONSTRAINT "career_paths_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "career_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

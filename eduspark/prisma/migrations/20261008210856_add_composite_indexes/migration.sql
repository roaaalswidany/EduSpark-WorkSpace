-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "certificates_userId_issuedAt_idx" ON "certificates"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "chat_messages_chatRoomId_createdAt_idx" ON "chat_messages"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "courses_status_createdAt_idx" ON "courses"("status", "createdAt");

-- CreateIndex
CREATE INDEX "courses_categoryId_status_idx" ON "courses"("categoryId", "status");

-- CreateIndex
CREATE INDEX "enrollments_userId_updatedAt_idx" ON "enrollments"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "lessons_sectionId_order_idx" ON "lessons"("sectionId", "order");

-- CreateIndex
CREATE INDEX "milestones_projectId_order_idx" ON "milestones"("projectId", "order");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "order_messages_orderId_createdAt_idx" ON "order_messages"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_buyerId_updatedAt_idx" ON "orders"("buyerId", "updatedAt");

-- CreateIndex
CREATE INDEX "orders_sellerId_updatedAt_idx" ON "orders"("sellerId", "updatedAt");

-- CreateIndex
CREATE INDEX "projects_clientId_updatedAt_idx" ON "projects"("clientId", "updatedAt");

-- CreateIndex
CREATE INDEX "projects_creatorId_updatedAt_idx" ON "projects"("creatorId", "updatedAt");

-- CreateIndex
CREATE INDEX "quiz_attempts_userId_quizId_submittedAt_idx" ON "quiz_attempts"("userId", "quizId", "submittedAt");

-- CreateIndex
CREATE INDEX "reviews_courseId_createdAt_idx" ON "reviews"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "sections_courseId_order_idx" ON "sections"("courseId", "order");

-- CreateIndex
CREATE INDEX "services_status_createdAt_idx" ON "services"("status", "createdAt");

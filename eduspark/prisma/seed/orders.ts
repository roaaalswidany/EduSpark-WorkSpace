// eduspark/prisma/seed/orders.ts
import {
  MilestoneStatus,
  OrderStatus,
  ProjectStatus,
  type Order,
  type PrismaClient,
  type Project,
  type Proposal,
  type Service,
  type User,
} from "@prisma/client";
import {
  randomInt,
  randomFloat,
  randomItem,
  pickUnique,
  daysAgo,
  daysFromNow,
  logHeader,
  logSuccess,
  logInfo,
} from "./helpers";

// ─── Weighted random ─────────────────────────────────────────────────────────

function pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

const ORDER_STATUS_WEIGHTS = [
  { value: OrderStatus.PENDING, weight: 15 },
  { value: OrderStatus.IN_PROGRESS, weight: 30 },
  { value: OrderStatus.COMPLETED, weight: 45 },
  { value: OrderStatus.CANCELLED, weight: 5 },
  { value: OrderStatus.DISPUTED, weight: 5 },
];

function projectStatusFromOrder(status: OrderStatus): ProjectStatus {
  switch (status) {
    case OrderStatus.PENDING:      return ProjectStatus.PENDING;
    case OrderStatus.IN_PROGRESS:  return ProjectStatus.IN_PROGRESS;
    case OrderStatus.COMPLETED:    return ProjectStatus.COMPLETED;
    case OrderStatus.CANCELLED:    return ProjectStatus.CANCELLED;
    case OrderStatus.DISPUTED:     return ProjectStatus.DISPUTED;
    default:                       return ProjectStatus.PENDING;
  }
}

// ─── Content Pools ───────────────────────────────────────────────────────────

function pickRequirements(serviceTitle: string): string {
  const isArabic = /[\u0600-\u06FF]/.test(serviceTitle);
  if (isArabic) {
    return randomItem([
      "أحتاج التطبيق يدعم اللغة العربية بالكامل، مع لوحة تحكم إدارية.",
      "المشروع لمنصة تعليمية، يحتاج تصميم عصري وسهل الاستخدام.",
      "أحتاج دعماً بعد التسليم لمدة شهر، مع توثيق كامل.",
      "الموقع يستهدف السوق العربي، يفضّل دعم RTL.",
    ]);
  }
  return randomItem([
    "Looking for a clean, modern design with full mobile support.",
    "Need the project delivered with documentation and tests.",
    "Please include admin dashboard and authentication.",
    "Prefer React/Next.js stack. API integration required.",
  ]);
}

function pickProjectDescription(): string {
  return randomItem([
    "مشروع بناء تطبيق ويب متكامل لمنصة تعليمية عربية.",
    "تطوير لوحة تحكم إدارية لتطبيق تجارة إلكترونية.",
    "تصميم وتطوير واجهة مستخدم لتطبيق جوال.",
    "بناء API احترافي لمنصة SaaS.",
    "Building a full SaaS dashboard for a growing startup.",
    "Developing a mobile-first e-commerce experience.",
    "Creating a production-ready REST API with tests.",
    "Designing and building a modern marketing website.",
  ]);
}

const TAG_POOL: string[][] = [
  ["nextjs", "typescript"],
  ["react", "tailwind"],
  ["nodejs", "api"],
  ["ui", "ux"],
  ["ecommerce", "shopify"],
  ["mobile", "react-native"],
];

const MILESTONE_TITLES: string[][] = [
  ["التصميم الأولي", "التطوير الأساسي", "الاختبارات", "النشر النهائي"],
  ["Initial Design", "Core Development", "Testing & QA", "Final Deployment"],
  ["التخطيط", "التنفيذ", "المراجعة", "التسليم"],
  ["Planning", "Implementation", "Review", "Delivery"],
];

function pickOpenProjectTitle(): string {
  return randomItem([
    "مطلوب مطور Next.js لمنصة تعليمية",
    "أبحث عن مصمم UI/UX لتطبيق جوال",
    "مطلوب مطور React Native لتطبيق توصيل",
    "أبحث عن مطور Full-Stack لمشروع SaaS",
    "Looking for a Next.js developer for a SaaS platform",
    "Need a UI/UX designer for a mobile app",
    "Hiring a React Native developer for a delivery app",
    "Seeking a full-stack developer for a SaaS project",
  ]);
}

function pickOpenProjectDescription(): string {
  return randomItem([
    "مشروع جديد في مرحلة التخطيط، أبحث عن مطور محترف لتنفيذه.",
    "المنصة تستهدف السوق العربي، يفضّل خبرة في RTL.",
    "المشروع سريع، يحتاج مطور متفرغ لمدة شهر.",
    "New project in early planning phase. Looking for an experienced developer.",
    "The platform targets the MENA market. RTL experience preferred.",
    "Fast-paced project. Need a dedicated developer for one month.",
  ]);
}

function pickProposalContent(): string {
  return randomItem([
    "لدي خبرة 5 سنوات في هذا المجال، يمكنني تسليم المشروع بجودة عالية.",
    "أنا متحمس للمشروع، لدي أعمال مشابهة في معرض أعمالي.",
    "يمكنني البدء فوراً، التسليم خلال المدة المحددة.",
    "أقترح استخدام أحدث التقنيات لضمان أفضل أداء.",
    "I have 5 years of experience and can deliver high quality.",
    "Excited about this project. Similar work in my portfolio.",
    "Available to start immediately. Delivery within the specified time.",
    "I suggest using the latest tech stack to ensure best performance.",
  ]);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeededOrders {
  orders: Order[];
  projects: Project[];
  proposals: Proposal[];
  stats: {
    orders: number;
    projects: number;
    milestones: number;
    proposals: number;
    byOrderStatus: Record<string, number>;
    byProjectStatus: Record<string, number>;
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seedOrders(
  db: PrismaClient,
  users: {
    student: User;
    client: User;
    students: User[];
    creators: User[];
    instructor: User;
  },
  services: { all: Service[] }
): Promise<SeededOrders> {
  logHeader("🛒 Step 7: Orders + Projects + Milestones + Proposals");

  // ── Cleanup (cascade covers OrderMessage, Milestone, Proposal) ──
  logInfo("Cleaning up existing orders and projects...");
  await db.order.deleteMany({});
  await db.project.deleteMany({});

  // ── Pools ────────────────────────────────────────────────────
  const buyers = [users.student, users.client, ...users.students];
  const creatorPool = [users.instructor, ...users.creators];

  const ORDER_COUNT = 100;
  const OPEN_PROJECTS_COUNT = 20;

  // ─────────────────────────────────────────────────────────────
  // Orders
  // ─────────────────────────────────────────────────────────────
  logInfo(`Creating ${ORDER_COUNT} orders...`);

  const createdOrders: Order[] = [];
  const byOrderStatus: Record<string, number> = {};

  for (let i = 0; i < ORDER_COUNT; i++) {
    const service = services.all[i % services.all.length];
    const buyer = buyers[(i * 7) % buyers.length];

    if (buyer.id === service.creatorId) continue;

    const status = pickWeighted(ORDER_STATUS_WEIGHTS);
    const isCompleted = status === OrderStatus.COMPLETED;

    const order = await db.order.create({
      data: {
        buyerId: buyer.id,
        sellerId: service.creatorId,
        serviceId: service.id,
        status,
        totalAmount: service.price,
        escrowAmount: service.price,
        requirements: pickRequirements(service.title),
        deliveryDue: isCompleted
          ? daysAgo(randomInt(1, 60))
          : daysFromNow(randomInt(1, 30)),
        completedAt: isCompleted ? daysAgo(randomInt(1, 60)) : null,
        createdAt: daysAgo(randomInt(10, 200)),
      },
    });

    createdOrders.push(order);
    byOrderStatus[status] = (byOrderStatus[status] || 0) + 1;
  }

  logSuccess(`${createdOrders.length} orders created`);

  // ─────────────────────────────────────────────────────────────
  // Projects (from non-cancelled orders)
  // ─────────────────────────────────────────────────────────────
  logInfo("Creating projects + milestones...");

  const eligibleOrders = createdOrders.filter(
    (o) => o.status !== OrderStatus.CANCELLED
  );

  const createdProjects: Project[] = [];
  const byProjectStatus: Record<string, number> = {};
  let totalMilestones = 0;

  for (const order of eligibleOrders) {
    const projectStatus = projectStatusFromOrder(order.status);

    const project = await db.project.create({
      data: {
        title:
          order.requirements?.slice(0, 60) ??
          `Order ${order.id.slice(0, 8)}`,
        description: pickProjectDescription(),
        budget: order.totalAmount,
        deadline: order.deliveryDue,
        status: projectStatus,
        tags: randomItem(TAG_POOL),
        clientId: order.buyerId,
        creatorId: order.sellerId,
        serviceId: order.serviceId,
        createdAt: order.createdAt,
      },
    });

    createdProjects.push(project);
    byProjectStatus[projectStatus] =
      (byProjectStatus[projectStatus] || 0) + 1;

    // ── Milestones (3-4 per project) ─────────────────────────────
    const milestoneCount = randomInt(3, 4);
    const titles = randomItem(MILESTONE_TITLES);
    const amountPerMilestone =
      Number(order.totalAmount) / milestoneCount;

    const milestonesData: Array<{
      projectId: string;
      title: string;
      description: string;
      dueDate: Date;
      status: MilestoneStatus;
      order: number;
      amount: number;
      completedAt: Date | null;
    }> = [];

    for (let m = 0; m < milestoneCount; m++) {
      let msStatus: MilestoneStatus;

      if (projectStatus === ProjectStatus.COMPLETED) {
        msStatus = MilestoneStatus.APPROVED;
      } else if (projectStatus === ProjectStatus.IN_PROGRESS) {
        const progress = (m + 1) / milestoneCount;
        if (progress <= 0.4) msStatus = MilestoneStatus.APPROVED;
        else if (progress <= 0.7) msStatus = MilestoneStatus.IN_PROGRESS;
        else msStatus = MilestoneStatus.PENDING;
      } else if (projectStatus === ProjectStatus.DISPUTED) {
        msStatus = randomItem([
          MilestoneStatus.REVISION_NEEDED,
          MilestoneStatus.REVIEW_REQUESTED,
        ]);
      } else {
        msStatus = MilestoneStatus.PENDING;
      }

      const baseDue = order.deliveryDue ?? daysFromNow(30);
      const dueDate = new Date(
        baseDue.getTime() +
          (m - milestoneCount + 1) * 7 * 24 * 60 * 60 * 1000
      );

      milestonesData.push({
        projectId: project.id,
        title: titles[m % titles.length],
        description: `Milestone ${m + 1} of ${milestoneCount}`,
        dueDate,
        status: msStatus,
        order: m + 1,
        amount: Number(amountPerMilestone.toFixed(2)),
        completedAt:
          msStatus === MilestoneStatus.APPROVED
            ? daysAgo(randomInt(1, 90))
            : null,
      });
    }

    await db.milestone.createMany({ data: milestonesData });
    totalMilestones += milestonesData.length;
  }

  logSuccess(
    `${createdProjects.length} projects created with ${totalMilestones} milestones`
  );

  // ─────────────────────────────────────────────────────────────
  // Open Projects + Proposals
  // ─────────────────────────────────────────────────────────────
  logInfo(`Creating ${OPEN_PROJECTS_COUNT} open projects with proposals...`);

  const openProjectBuyers = pickUnique(buyers, OPEN_PROJECTS_COUNT);

  for (let i = 0; i < OPEN_PROJECTS_COUNT; i++) {
    const buyer = openProjectBuyers[i % openProjectBuyers.length];

    const project = await db.project.create({
      data: {
        title: pickOpenProjectTitle(),
        description: pickOpenProjectDescription(),
        budget: randomFloat(500, 5000),
        deadline: daysFromNow(randomInt(14, 90)),
        status: ProjectStatus.OPEN,
        tags: randomItem(TAG_POOL),
        clientId: buyer.id,
        createdAt: daysAgo(randomInt(1, 30)),
      },
    });

    createdProjects.push(project);
    byProjectStatus[ProjectStatus.OPEN] =
      (byProjectStatus[ProjectStatus.OPEN] || 0) + 1;

    const proposalCount = randomInt(2, 3);
    const proposalCreators = pickUnique(creatorPool, proposalCount);

    for (let p = 0; p < proposalCount; p++) {
      const creator = proposalCreators[p];
      const isAccepted = p === 0 && randomInt(1, 100) <= 20;

      await db.proposal.create({
        data: {
          projectId: project.id,
          creatorId: creator.id,
          content: pickProposalContent(),
          price: randomFloat(400, 4500),
          deliveryDays: randomInt(5, 30),
          isAccepted,
          createdAt: daysAgo(randomInt(1, 25)),
        },
      });
    }
  }

  const allProposals = await db.proposal.findMany();

  logSuccess(
    `${allProposals.length} proposals created across ${OPEN_PROJECTS_COUNT} open projects`
  );

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  logInfo("Orders by status:");
  for (const [status, count] of Object.entries(byOrderStatus)) {
    logInfo(`  ${status.padEnd(12)} → ${count}`);
  }

  logInfo("Projects by status:");
  for (const [status, count] of Object.entries(byProjectStatus)) {
    logInfo(`  ${status.padEnd(12)} → ${count}`);
  }

  return {
    orders: createdOrders,
    projects: createdProjects,
    proposals: allProposals,
    stats: {
      orders: createdOrders.length,
      projects: createdProjects.length,
      milestones: totalMilestones,
      proposals: allProposals.length,
      byOrderStatus,
      byProjectStatus,
    },
  };
}
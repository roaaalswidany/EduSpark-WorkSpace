import { createClient, type RedisClientType } from "redis";
import { env } from "./env";
import { logger } from "../lib/logger";

let pubClient: RedisClientType;
let subClient: RedisClientType;

async function createRedisClient(label: string): Promise<RedisClientType> {
  const client = createClient({
    url: env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error(`Redis ${label}: Max reconnection attempts reached`);
          return new Error("Max Redis reconnection attempts exceeded");
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis ${label}: Reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  }) as RedisClientType;

  client.on("error", (err: { message: any; }) => {
    logger.error(`Redis ${label} error`, { error: err.message });
  });

  client.on("connect", () => {
    logger.info(`Redis ${label}: Connected successfully`);
  });

  client.on("reconnecting", () => {
    logger.warn(`Redis ${label}: Reconnecting...`);
  });

  await client.connect();
  return client;
}

export async function initRedisClients(): Promise<{
  pubClient: RedisClientType;
  subClient: RedisClientType;
}> {
  pubClient = await createRedisClient("Publisher");
  subClient = await createRedisClient("Subscriber");

  return { pubClient, subClient };
}

export async function closeRedisClients(): Promise<void> {
  await Promise.allSettled([
    pubClient?.quit(),
    subClient?.quit(),
  ]);
  logger.info("Redis clients closed");
}
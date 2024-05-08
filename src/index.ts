import Redis from 'ioredis';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);
const REDIS_KEY_RATE_LIMIT_ERROR_CHECK = 'RATE_LIMIT_ERROR_CHECK';

interface ThrottlingConfiguration {
  maxErrorCount: number; // maximum acceptable errors
  windowSizeInSeconds: number; // how far do we look back for our error count
}

async function addRateLimitError(jobId: string) {
  const currentTimestamp = new Date().getTime();
  await redis.zadd(REDIS_KEY_RATE_LIMIT_ERROR_CHECK, currentTimestamp, jobId);
}

async function checkForThrottling(configuration: ThrottlingConfiguration) {
  console.log('checking for throttling...');
  const currentTimestamp = new Date().getTime();
  const lookbackTimestamp =
    currentTimestamp - configuration.windowSizeInSeconds * 1000;
  // Remove timestamps older than lookback
  await redis.zremrangebyscore(
    REDIS_KEY_RATE_LIMIT_ERROR_CHECK,
    '-inf',
    lookbackTimestamp,
  );
  // Count errors in the past period
  const errorCount = await redis.zcount(
    REDIS_KEY_RATE_LIMIT_ERROR_CHECK,
    lookbackTimestamp,
    '+inf',
  );
  if (errorCount >= configuration.maxErrorCount) {
    console.log('we need to backoff!');
  } else {
    console.log('we do not need to backoff!');
  }
}

async function main() {
  const config: ThrottlingConfiguration = {
    maxErrorCount: 10,
    windowSizeInSeconds: 10,
  };

  // cleanup before run, just for running the script easily, multiple times
  await redis.del(REDIS_KEY_RATE_LIMIT_ERROR_CHECK);

  // BEFORE: should pass our check, no need to backoff.
  await checkForThrottling(config);

  for (let i = 0; i < config.maxErrorCount; ++i) {
    console.log('adding rate limit error to our sorted set');
    await addRateLimitError(nanoid());
  }

  // AFTER: should fail our check and ask us to backoff.
  await checkForThrottling(config);
}

main();

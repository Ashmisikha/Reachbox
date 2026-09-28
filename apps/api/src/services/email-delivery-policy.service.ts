import { bullmqRedis } from '../queues/redis';

export interface DeliveryPolicyInput {
  senderId: string;
  hourlyLimit: number;
  minimumDelayMs: number;
}

export interface DeliveryPolicyResult {
  allowed: boolean;
  retryAfterMs: number;
}

const DELIVERY_POLICY_SCRIPT = `
local now = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minimumDelay = tonumber(ARGV[3])
local windowMs = 3600000

local rateKey = KEYS[1]
local spacingKey = KEYS[2]

local windowStart = redis.call("GET", rateKey)
local sendCount = 0

if windowStart then
    windowStart = tonumber(windowStart)
    sendCount = tonumber(redis.call("GET", rateKey .. ":count") or "0")

    if now - windowStart >= windowMs then
        redis.call("SET", rateKey, tostring(now), "PX", windowMs)
        redis.call("SET", rateKey .. ":count", "0", "PX", windowMs)
        sendCount = 0
    end
else
    redis.call("SET", rateKey, tostring(now), "PX", windowMs)
    redis.call("SET", rateKey .. ":count", "0", "PX", windowMs)
end

local lastSend = tonumber(redis.call("GET", spacingKey) or "0")

local spacingAllowedAt = math.max(
    now,
    lastSend + minimumDelay
)

if spacingAllowedAt > now then
    return {0, spacingAllowedAt - now}
end

if sendCount >= hourlyLimit then
    local remainingWindow = windowMs - (now - tonumber(redis.call("GET", rateKey)))
    return {0, math.max(remainingWindow, 1000)}
end

redis.call(
    "SET",
    spacingKey,
    tostring(now),
    "PX",
    math.max(minimumDelay, 1000)
)

local newCount = redis.call(
    "INCR",
    rateKey .. ":count"
)

redis.call(
    "PEXPIRE",
    rateKey .. ":count",
    windowMs
)

return {1, 0}
`;

export async function reserveDeliverySlot({
  senderId,
  hourlyLimit,
  minimumDelayMs,
}: DeliveryPolicyInput): Promise<DeliveryPolicyResult> {
  if (hourlyLimit <= 0) {
    throw new Error('Hourly email limit must be greater than zero');
  }

  if (minimumDelayMs < 0) {
    throw new Error('Minimum email delay cannot be negative');
  }

  const now = Date.now();

  const result = (await bullmqRedis.eval(
    DELIVERY_POLICY_SCRIPT,
    2,
    `email-rate:${senderId}`,
    `email-spacing:${senderId}`,
    now,
    hourlyLimit,
    minimumDelayMs
  )) as [number, number];

  return {
    allowed: Number(result[0]) === 1,
    retryAfterMs: Number(result[1]),
  };
}

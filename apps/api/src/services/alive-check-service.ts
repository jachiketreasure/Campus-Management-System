import { prisma } from '@cms/database';

export type ChallengeType = 'BUTTON_CLICK' | 'TYPE_WORD' | 'MATH_PUZZLE';

export type AliveCheckConfig = {
  checkInterval: number; // seconds between checks (default: 60)
  responseWindow: number; // seconds to respond (default: 15)
  maxMissedChecks: number; // max misses before action (default: 3)
  actionOnMaxMisses: 'WARN' | 'PAUSE_EXAM' | 'AUTO_SUBMIT' | 'FLAG_FOR_REVIEW';
  challengeTypes: ChallengeType[]; // Types of challenges to use
  initialDelay: number; // seconds before first check (default: 120)
};

const DEFAULT_CONFIG: AliveCheckConfig = {
  checkInterval: 60,
  responseWindow: 15,
  maxMissedChecks: 3,
  actionOnMaxMisses: 'FLAG_FOR_REVIEW',
  challengeTypes: ['BUTTON_CLICK', 'TYPE_WORD', 'MATH_PUZZLE'],
  initialDelay: 120,
};

/**
 * Generate a random challenge
 */
function generateChallenge(type: ChallengeType): { type: ChallengeType; data: any } {
  switch (type) {
    case 'BUTTON_CLICK':
      return {
        type: 'BUTTON_CLICK',
        data: { message: 'Click the button to confirm you are present' },
      };
    case 'TYPE_WORD':
      const words = ['ACTIVE', 'PRESENT', 'HERE', 'ALIVE', 'READY'];
      const word = words[Math.floor(Math.random() * words.length)];
      return {
        type: 'TYPE_WORD',
        data: { word, message: `Type the word: ${word}` },
      };
    case 'MATH_PUZZLE':
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const answer = num1 + num2;
      return {
        type: 'MATH_PUZZLE',
        data: { question: `${num1} + ${num2}`, answer, message: `What is ${num1} + ${num2}?` },
      };
    default:
      return generateChallenge('BUTTON_CLICK');
  }
}

/**
 * Get random challenge type from config
 */
function getRandomChallengeType(config: AliveCheckConfig): ChallengeType {
  const types = config.challengeTypes.length > 0 
    ? config.challengeTypes 
    : ['BUTTON_CLICK'];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Create a new alive check for a student
 */
export async function createAliveCheck(
  studentId: string,
  examSessionId?: string,
  monitoringSessionId?: string,
  config: Partial<AliveCheckConfig> = {}
): Promise<{
  id: string;
  challengeType: ChallengeType;
  challengeData: any;
  responseWindow: number;
}> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Get the last check number for this session
  const lastCheck = await prisma.aliveCheck.findFirst({
    where: {
      studentId,
      ...(examSessionId ? { examSessionId } : {}),
      ...(monitoringSessionId ? { monitoringSessionId } : {}),
    },
    orderBy: { checkNumber: 'desc' },
    select: { checkNumber: true, missedCount: true },
  });

  const checkNumber = (lastCheck?.checkNumber || 0) + 1;
  const missedCount = lastCheck?.missedCount || 0;

  // Check if max missed checks reached
  if (missedCount >= fullConfig.maxMissedChecks) {
    throw new Error(
      `Maximum missed checks (${fullConfig.maxMissedChecks}) reached. Action required: ${fullConfig.actionOnMaxMisses}`
    );
  }

  // Generate challenge
  const challengeType = getRandomChallengeType(fullConfig);
  const challenge = generateChallenge(challengeType);

  // Create the check
  const aliveCheck = await prisma.aliveCheck.create({
    data: {
      studentId,
      examSessionId: examSessionId || undefined,
      monitoringSessionId: monitoringSessionId || undefined,
      checkNumber,
      promptShownAt: new Date(),
      status: 'PENDING',
      challengeType: challenge.type,
      challengeData: challenge.data,
      missedCount,
    },
  });

  return {
    id: aliveCheck.id,
    challengeType: challenge.type,
    challengeData: challenge.data,
    responseWindow: fullConfig.responseWindow,
  };
}

/**
 * Respond to an alive check
 */
export async function respondToAliveCheck(
  checkId: string,
  studentId: string,
  response: string | number
): Promise<{ success: boolean; status: string; responseTime: number }> {
  const check = await prisma.aliveCheck.findUnique({
    where: { id: checkId },
  });

  if (!check) {
    throw new Error('Alive check not found');
  }

  if (check.studentId !== studentId) {
    throw new Error('Unauthorized: This check does not belong to you');
  }

  if (check.status !== 'PENDING') {
    throw new Error(`Check already ${check.status.toLowerCase()}`);
  }

  // Calculate response time
  const responseTime = Date.now() - check.promptShownAt.getTime();
  const responseWindowMs = 15000; // Default 15 seconds, should come from config
  const isLate = responseTime > responseWindowMs;

  // Validate response based on challenge type
  let isValid = false;
  if (check.challengeType === 'BUTTON_CLICK') {
    isValid = true; // Any response is valid for button click
  } else if (check.challengeType === 'TYPE_WORD') {
    const expectedWord = (check.challengeData as any)?.word;
    isValid = response.toString().toUpperCase().trim() === expectedWord?.toUpperCase();
  } else if (check.challengeType === 'MATH_PUZZLE') {
    const expectedAnswer = (check.challengeData as any)?.answer;
    isValid = Number(response) === expectedAnswer;
  }

  // Get current missed count from the most recent check for this session
  const sessionChecks = await prisma.aliveCheck.findMany({
    where: {
      studentId: check.studentId,
      ...(check.examSessionId ? { examSessionId: check.examSessionId } : {}),
      ...(check.monitoringSessionId ? { monitoringSessionId: check.monitoringSessionId } : {}),
    },
    orderBy: { checkNumber: 'desc' },
    take: 1,
    select: { missedCount: true },
  });

  const currentMissedCount = sessionChecks[0]?.missedCount || 0;
  const newMissedCount = isValid ? currentMissedCount : currentMissedCount + 1;

  // Update check
  const updated = await prisma.aliveCheck.update({
    where: { id: checkId },
    data: {
      respondedAt: new Date(),
      responseTime: Math.floor(responseTime),
      status: isValid ? (isLate ? 'LATE' : 'RESPONDED') : 'MISSED',
      missedCount: newMissedCount,
    },
  });

  return {
    success: isValid,
    status: updated.status,
    responseTime: Math.floor(responseTime),
  };
}

/**
 * Get alive check status for a student in a session
 */
export async function getAliveCheckStatus(
  studentId: string,
  examSessionId?: string,
  monitoringSessionId?: string
): Promise<{
  totalChecks: number;
  responded: number;
  missed: number;
  late: number;
  missedCount: number;
  lastCheckAt: Date | null;
  nextCheckDue: Date | null;
}> {
  const checks = await prisma.aliveCheck.findMany({
    where: {
      studentId,
      ...(examSessionId ? { examSessionId } : {}),
      ...(monitoringSessionId ? { monitoringSessionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  const lastCheck = checks[0];
  const totalChecks = checks.length;
  const responded = checks.filter((c) => c.status === 'RESPONDED').length;
  const missed = checks.filter((c) => c.status === 'MISSED').length;
  const late = checks.filter((c) => c.status === 'LATE').length;
  const missedCount = lastCheck?.missedCount || 0;

  return {
    totalChecks,
    responded,
    missed,
    late,
    missedCount,
    lastCheckAt: lastCheck?.promptShownAt || null,
    nextCheckDue: null, // Would need to calculate based on config
  };
}

/**
 * Get all alive checks for a session (for monitoring)
 */
export async function getAliveChecksForSession(
  examSessionId?: string,
  monitoringSessionId?: string
): Promise<any[]> {
  return prisma.aliveCheck.findMany({
    where: {
      ...(examSessionId ? { examSessionId } : {}),
      ...(monitoringSessionId ? { monitoringSessionId } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Mark pending checks as missed (called by a scheduled job)
 */
export async function markPendingChecksAsMissed(): Promise<number> {
  const fifteenSecondsAgo = new Date(Date.now() - 15000); // 15 seconds ago

  const result = await prisma.aliveCheck.updateMany({
    where: {
      status: 'PENDING',
      promptShownAt: {
        lt: fifteenSecondsAgo,
      },
    },
    data: {
      status: 'MISSED',
      // Increment missed count
    },
  });

  return result.count;
}


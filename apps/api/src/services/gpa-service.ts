import { prisma } from '@cms/database';
import { getStudentGrades, type CourseGradeDTO } from './grade-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type GPABreakdown = {
  semester: string;
  sessionId: string;
  sessionName: string;
  courses: {
    courseCode: string;
    courseTitle: string;
    units: number;
    letterGrade: string;
    gradePoint: number;
    totalScore: number;
  }[];
  totalUnits: number;
  totalGradePoints: number;
  gpa: number;
};

export type CGPABreakdown = {
  sessions: GPABreakdown[];
  cumulativeUnits: number;
  cumulativeGradePoints: number;
  cgpa: number;
  classOfDegree: string;
};

/**
 * Calculate GPA for a semester
 */
export async function calculateSemesterGPA(
  studentId: string,
  sessionId: string,
  semester: string
): Promise<GPABreakdown> {
  const grades = await getStudentGrades(studentId, sessionId, semester);

  const session = usePrismaStore
    ? await prisma.academicSession.findUnique({
        where: { id: sessionId },
        select: { name: true }
      })
    : null;

  const courses = grades
    .filter((grade) => grade.totalScore !== null && grade.totalScore !== undefined)
    .map((grade) => ({
      courseCode: grade.course?.code || '',
      courseTitle: grade.course?.title || '',
      units: grade.course?.units || 0,
      letterGrade: grade.letterGrade || 'F',
      gradePoint: grade.gradePoint || 0,
      totalScore: grade.totalScore || 0
    }));

  const totalUnits = courses.reduce((sum, course) => sum + course.units, 0);
  const totalGradePoints = courses.reduce(
    (sum, course) => sum + course.gradePoint * course.units,
    0
  );
  const gpa = totalUnits > 0 ? totalGradePoints / totalUnits : 0;

  return {
    semester,
    sessionId,
    sessionName: session?.name || sessionId,
    courses,
    totalUnits,
    totalGradePoints,
    gpa: Math.round(gpa * 100) / 100
  };
}

/**
 * Calculate CGPA across all sessions
 */
export async function calculateCGPA(studentId: string): Promise<CGPABreakdown> {
  const allGrades = await getStudentGrades(studentId);

  // Group by session and semester
  const sessionMap = new Map<string, Map<string, CourseGradeDTO[]>>();

  for (const grade of allGrades) {
    if (!sessionMap.has(grade.sessionId)) {
      sessionMap.set(grade.sessionId, new Map());
    }
    const semesterMap = sessionMap.get(grade.sessionId)!;
    if (!semesterMap.has(grade.semester)) {
      semesterMap.set(grade.semester, []);
    }
    semesterMap.get(grade.semester)!.push(grade);
  }

  const sessions: GPABreakdown[] = [];

  for (const [sessionId, semesterMap] of sessionMap.entries()) {
    const session = usePrismaStore
      ? await prisma.academicSession.findUnique({
          where: { id: sessionId },
          select: { name: true }
        })
      : null;

    for (const [semester, grades] of semesterMap.entries()) {
      const courses = grades
        .filter((grade) => grade.totalScore !== null && grade.totalScore !== undefined)
        .map((grade) => ({
          courseCode: grade.course?.code || '',
          courseTitle: grade.course?.title || '',
          units: grade.course?.units || 0,
          letterGrade: grade.letterGrade || 'F',
          gradePoint: grade.gradePoint || 0,
          totalScore: grade.totalScore || 0
        }));

      const totalUnits = courses.reduce((sum, course) => sum + course.units, 0);
      const totalGradePoints = courses.reduce(
        (sum, course) => sum + course.gradePoint * course.units,
        0
      );
      const gpa = totalUnits > 0 ? totalGradePoints / totalUnits : 0;

      sessions.push({
        semester,
        sessionId,
        sessionName: session?.name || sessionId,
        courses,
        totalUnits,
        totalGradePoints,
        gpa: Math.round(gpa * 100) / 100
      });
    }
  }

  // Calculate cumulative
  const cumulativeUnits = sessions.reduce((sum, session) => sum + session.totalUnits, 0);
  const cumulativeGradePoints = sessions.reduce(
    (sum, session) => sum + session.totalGradePoints,
    0
  );
  const cgpa = cumulativeUnits > 0 ? cumulativeGradePoints / cumulativeUnits : 0;
  const roundedCGPA = Math.round(cgpa * 100) / 100;

  // Calculate class of degree based on CGPA
  // CGPA Range → Class of Degree
  // 4.50 – 5.00 → First Class
  // 3.50 – 4.49 → Second Class (Upper Division / 2:1)
  // 2.40 – 3.49 → Second Class (Lower Division / 2:2)
  // 1.50 – 2.39 → Third Class
  // 0.00 – 1.49 → Fail / Probation
  let classOfDegree: string;
  if (roundedCGPA >= 4.50) {
    classOfDegree = 'First Class';
  } else if (roundedCGPA >= 3.50) {
    classOfDegree = 'Second Class (Upper Division / 2:1)';
  } else if (roundedCGPA >= 2.40) {
    classOfDegree = 'Second Class (Lower Division / 2:2)';
  } else if (roundedCGPA >= 1.50) {
    classOfDegree = 'Third Class';
  } else {
    classOfDegree = 'Fail / Probation';
  }

  return {
    sessions: sessions.sort((a, b) => {
      // Sort by session name, then semester
      if (a.sessionName !== b.sessionName) {
        return a.sessionName.localeCompare(b.sessionName);
      }
      return a.semester.localeCompare(b.semester);
    }),
    cumulativeUnits,
    cumulativeGradePoints,
    cgpa: roundedCGPA,
    classOfDegree
  };
}


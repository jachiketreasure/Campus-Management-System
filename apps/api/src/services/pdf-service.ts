import { getStudentGrades, getCGPA, type CourseGrade, type CGPABreakdown } from './grade-service';
import { prisma } from '@cms/database';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type StudentResultPDFData = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNumber: string | null;
    email: string;
  };
  session: {
    id: string;
    name: string;
  };
  grades: CourseGrade[];
  cgpa: CGPABreakdown;
  generatedAt: string;
};

/**
 * Get data for PDF generation
 */
export async function getStudentResultData(studentId: string, sessionId?: string): Promise<StudentResultPDFData> {
  const student = usePrismaStore
    ? await prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true,
          email: true
        }
      })
    : null;

  if (!student && usePrismaStore) {
    throw new Error('Student not found');
  }

  const grades = await getStudentGrades(studentId, sessionId);
  const cgpa = await getCGPA(studentId);

  const session = sessionId && usePrismaStore
    ? await prisma.academicSession.findUnique({
        where: { id: sessionId },
        select: { id: true, name: true }
      })
    : null;

  return {
    student: student || {
      id: studentId,
      firstName: 'Student',
      lastName: 'Name',
      registrationNumber: null,
      email: 'student@example.com'
    },
    session: session || {
      id: sessionId || 'current',
      name: 'Current Session'
    },
    grades,
    cgpa,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate PDF HTML template (for use with puppeteer or similar)
 */
export function generateResultPDFHTML(data: StudentResultPDFData): string {
  const { student, session, grades, cgpa } = data;

  // Group grades by semester
  const gradesBySemester = grades.reduce((acc, grade) => {
    const key = `${grade.sessionId}-${grade.semester}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(grade);
    return acc;
  }, {} as Record<string, CourseGrade[]>);

  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return '—';
    return score.toFixed(1);
  };

  const getGradeColor = (letterGrade: string | null | undefined): string => {
    if (!letterGrade) return '#94a3b8';
    switch (letterGrade) {
      case 'A': return '#10b981';
      case 'B': return '#3b82f6';
      case 'C': return '#eab308';
      case 'D': return '#f97316';
      case 'E':
      case 'F': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Academic Result - ${student.registrationNumber || student.email}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      color: #1e293b;
      line-height: 1.5;
      padding: 40px;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #1e293b;
      padding-bottom: 20px;
    }
    .school-name {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 5px;
    }
    .school-address {
      font-size: 11px;
      color: #64748b;
    }
    .student-info {
      margin-bottom: 25px;
      background: #f8fafc;
      padding: 15px;
      border-radius: 5px;
    }
    .student-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .student-info-label {
      font-weight: bold;
      color: #475569;
      width: 150px;
    }
    .student-info-value {
      color: #1e293b;
      flex: 1;
    }
    .grades-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      font-size: 11px;
    }
    .grades-table th {
      background: #1e293b;
      color: #fff;
      padding: 10px 8px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #334155;
    }
    .grades-table td {
      padding: 8px;
      border: 1px solid #cbd5e1;
      text-align: center;
    }
    .grades-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .grades-table .course-code {
      text-align: left;
      font-weight: 600;
    }
    .grades-table .course-title {
      text-align: left;
    }
    .grade-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: bold;
      color: #fff;
    }
    .gpa-section {
      margin-top: 30px;
      padding: 20px;
      background: #f1f5f9;
      border-radius: 5px;
    }
    .gpa-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .gpa-label {
      font-weight: bold;
      color: #475569;
    }
    .gpa-value {
      font-size: 16px;
      font-weight: bold;
      color: #1e293b;
    }
    .signatures {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      padding-top: 30px;
      border-top: 2px solid #cbd5e1;
    }
    .signature-box {
      width: 200px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #1e293b;
      margin-top: 50px;
      padding-top: 5px;
      font-size: 11px;
      font-weight: bold;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 15px;
    }
    .semester-header {
      background: #334155;
      color: #fff;
      padding: 8px;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="margin-bottom: 15px;">
      <!-- School Logo Placeholder -->
      <div style="width: 80px; height: 80px; margin: 0 auto 10px; border: 2px solid #cbd5e1; border-radius: 5px; display: flex; align-items: center; justify-content: center; background: #f8fafc;">
        <span style="font-size: 10px; color: #64748b; text-align: center;">LOGO</span>
      </div>
    </div>
    <div class="school-name">CAMPUS MANAGEMENT SYSTEM</div>
    <div class="school-address">Official Academic Result</div>
  </div>

  <div class="student-info">
    <div class="student-info-row">
      <span class="student-info-label">Student Name:</span>
      <span class="student-info-value">${student.firstName} ${student.lastName}</span>
    </div>
    <div class="student-info-row">
      <span class="student-info-label">Registration Number:</span>
      <span class="student-info-value">${student.registrationNumber || 'N/A'}</span>
    </div>
    <div class="student-info-row">
      <span class="student-info-label">Email:</span>
      <span class="student-info-value">${student.email}</span>
    </div>
    <div class="student-info-row">
      <span class="student-info-label">Academic Session:</span>
      <span class="student-info-value">${session.name}</span>
    </div>
  </div>

  ${Object.entries(gradesBySemester).map(([key, semesterGrades]) => {
    const [sessionId, semester] = key.split('-');
    return `
      <div class="semester-header">${semester} Semester</div>
      <table class="grades-table">
        <thead>
          <tr>
            <th style="width: 10%;">Course Code</th>
            <th style="width: 30%;">Course Title</th>
            <th style="width: 8%;">Att. (10)</th>
            <th style="width: 8%;">Test (10)</th>
            <th style="width: 8%;">Ass. (10)</th>
            <th style="width: 8%;">Exam (70)</th>
            <th style="width: 8%;">Total (100)</th>
            <th style="width: 10%;">Grade</th>
            <th style="width: 10%;">Units</th>
          </tr>
        </thead>
        <tbody>
          ${semesterGrades.map((grade) => `
            <tr>
              <td class="course-code">${grade.course?.code || 'N/A'}</td>
              <td class="course-title">${grade.course?.title || 'N/A'}</td>
              <td>${formatScore(grade.attendanceScore)}</td>
              <td>${formatScore(grade.testScore)}</td>
              <td>${formatScore(grade.assignmentScore)}</td>
              <td>${formatScore(grade.examScore)}</td>
              <td><strong>${formatScore(grade.totalScore)}</strong></td>
              <td>
                ${grade.letterGrade ? `<span class="grade-badge" style="background: ${getGradeColor(grade.letterGrade)}">${grade.letterGrade}</span>` : '—'}
              </td>
              <td>${grade.course?.units || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }).join('')}

  <div class="gpa-section">
    <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 20px; text-align: center; padding-bottom: 10px; border-bottom: 2px solid #1e293b;">
      ACADEMIC PERFORMANCE SUMMARY
    </div>
    
    <!-- Current Semester GPA -->
    ${cgpa.sessions.length > 0 ? `
    <div style="background: #eff6ff; padding: 12px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
      <div class="gpa-row" style="margin-bottom: 5px;">
        <span class="gpa-label" style="font-weight: 600;">Current Semester GPA:</span>
        <span class="gpa-value" style="color: #2563eb; font-size: 18px;">${cgpa.sessions[cgpa.sessions.length - 1]?.gpa.toFixed(2) || 'N/A'}</span>
      </div>
      <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
        ${cgpa.sessions[cgpa.sessions.length - 1]?.semester || 'N/A'} Semester • ${cgpa.sessions[cgpa.sessions.length - 1]?.totalUnits || 0} Units
      </div>
    </div>
    ` : ''}
    
    <!-- CGPA Section -->
    <div style="background: #f0fdf4; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #10b981;">
      <div class="gpa-row" style="margin-bottom: 10px;">
        <span class="gpa-label" style="font-weight: 600; font-size: 14px;">Cumulative GPA (CGPA):</span>
        <span class="gpa-value" style="color: #059669; font-size: 24px; font-weight: bold;">${cgpa.cgpa.toFixed(2)}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-top: 10px;">
        <div>
          <strong>Total Units:</strong> ${cgpa.cumulativeUnits}
        </div>
        <div>
          <strong>Total Grade Points:</strong> ${cgpa.cumulativeGradePoints.toFixed(1)}
        </div>
      </div>
    </div>
    
    <!-- Calculation Details -->
    <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 5px; border: 1px solid #cbd5e1;">
      <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
        <strong style="color: #1e293b;">Calculation Formula:</strong>
      </div>
      <div style="font-size: 11px; color: #64748b; font-family: monospace; background: white; padding: 8px; border-radius: 3px; border: 1px solid #e2e8f0;">
        CGPA = Total Grade Points ÷ Total Units<br/>
        CGPA = ${cgpa.cumulativeGradePoints.toFixed(1)} ÷ ${cgpa.cumulativeUnits} = ${cgpa.cgpa.toFixed(2)}
      </div>
    </div>
    
    <!-- Grade Point Scale -->
    <div style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 5px; border: 1px solid #fcd34d;">
      <div style="font-size: 10px; color: #92400e; font-weight: 600; margin-bottom: 5px;">Grade Point Scale:</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; font-size: 9px; color: #78350f;">
        <div>A = 5.0 (90-100%)</div>
        <div>B = 4.0 (80-89%)</div>
        <div>C = 3.0 (70-79%)</div>
        <div>D = 2.0 (60-69%)</div>
        <div>E = 1.0 (50-59%)</div>
        <div>F = 0.0 (&lt;50%)</div>
      </div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">Head of Department</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">Registrar</div>
    </div>
  </div>

  <div class="footer">
    Generated on ${new Date(data.generatedAt).toLocaleString()} | This is an official document
  </div>
</body>
</html>
  `;
}


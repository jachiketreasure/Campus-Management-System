import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from './index';

const DEFAULT_PASSWORD = 'ChangeMe123!';
const PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

async function seedRoles() {
  const roles = [
    { name: 'ADMIN', description: 'Platform administrators' },
    { name: 'LECTURER', description: 'Course lecturers and proctors' },
    { name: 'STUDENT', description: 'Students and freelancers' }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role
    });
  }
}

async function seedUsers() {
  const [admin, lecturer, student] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@example.edu' },
      update: {
        passwordHash: PASSWORD_HASH
      },
      create: {
        email: 'admin@example.edu',
        passwordHash: PASSWORD_HASH,
        firstName: 'Ada',
        lastName: 'Admin',
        profile: {
          create: {
            bio: 'System administrator for CMS',
            skills: ['Governance', 'Compliance']
          }
        }
      }
    }),
    prisma.user.upsert({
      where: { email: 'lecturer@example.edu' },
      update: {
        passwordHash: PASSWORD_HASH
      },
      create: {
        email: 'lecturer@example.edu',
        passwordHash: PASSWORD_HASH,
        firstName: 'Lola',
        lastName: 'Lecturer',
        profile: {
          create: {
            bio: 'Lecturer in Computer Science',
            skills: ['Proctoring', 'AI Ethics']
          }
        }
      }
    }),
    prisma.user.upsert({
      where: { email: 'student@example.edu' },
      update: {
        passwordHash: PASSWORD_HASH
      },
      create: {
        email: 'student@example.edu',
        passwordHash: PASSWORD_HASH,
        firstName: 'Sam',
        lastName: 'Student',
        profile: {
          create: {
            bio: 'Final year student available for freelance gigs',
            skills: ['React', 'Design']
          }
        }
      }
    })
  ]);

  const roles = await prisma.role.findMany({
    where: { name: { in: ['ADMIN', 'LECTURER', 'STUDENT'] } }
  });

  const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]));

  // MongoDB doesn't support createMany with skipDuplicates, use upsert instead
  await Promise.all([
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: roleMap.ADMIN
        }
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: roleMap.ADMIN
      }
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: lecturer.id,
          roleId: roleMap.LECTURER
        }
      },
      update: {},
      create: {
        userId: lecturer.id,
        roleId: roleMap.LECTURER
      }
    }),
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: student.id,
          roleId: roleMap.STUDENT
        }
      },
      update: {},
      create: {
        userId: student.id,
        roleId: roleMap.STUDENT
      }
    })
  ]);

  // Create wallets
  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, balance: 0, currency: 'NGN' }
  });

  await prisma.wallet.upsert({
    where: { userId: lecturer.id },
    update: {},
    create: { userId: lecturer.id, balance: 25000, currency: 'NGN' }
  });

  await prisma.wallet.upsert({
    where: { userId: student.id },
    update: {},
    create: { userId: student.id, balance: 15000, currency: 'NGN' }
  });

  return { admin, lecturer, student };
}

async function seedVisitors() {
  // Delete old admin email if it exists (to avoid conflicts)
  await prisma.visitor.deleteMany({
    where: { email: 'admin@example.edu' }
  }).catch(() => {
    // Ignore errors if it doesn't exist
  });

  const adminVisitor = await prisma.visitor.upsert({
    where: { email: 'admin@ebsu.edu' },
    update: {
      passwordHash: PASSWORD_HASH,
      status: 'ACTIVE',
      visitorType: 'ADMIN',
      name: 'Admin User'
    },
    create: {
      name: 'Admin User',
      email: 'admin@ebsu.edu',
      passwordHash: PASSWORD_HASH,
      visitorType: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  return { adminVisitor };
}

async function seedCourses(lecturerId: string) {
  return prisma.course.upsert({
    where: { code: 'CSC401' },
    update: {},
    create: {
      code: 'CSC401',
      title: 'Distributed Systems',
      description: 'Advanced course covering distributed system design.',
      lecturerId
    }
  });
}

async function seedFreelancerHub(lecturerId: string, studentId: string) {
  const gigId = 'seed-gig';
  const proposalId = 'seed-proposal';
  const orderId = 'seed-order';

  const gig = await prisma.gig.upsert({
    where: { id: gigId },
    update: {},
    create: {
      id: gigId,
      ownerId: studentId,
      title: 'UI/UX Design for Campus Portal',
      description: 'Responsive redesign of the campus portal with accessibility focus.',
      category: 'Design',
      price: new Prisma.Decimal(50000),
      currency: 'NGN',
      deliveryTimeDays: 7,
      attachments: [],
      tags: ['design', 'figma', 'ui'],
      status: 'ACTIVE'
    }
  });

  const proposal = await prisma.proposal.upsert({
    where: { id: proposalId },
    update: {
      status: 'ACCEPTED'
    },
    create: {
      id: proposalId,
      gigId: gig.id,
      proposerId: lecturerId,
      message: 'Offering mentorship and review with quick turnaround.',
      amount: new Prisma.Decimal(52000),
      deliveryTimeDays: 5,
      status: 'ACCEPTED'
    }
  });

  const order = await prisma.order.upsert({
    where: { id: orderId },
    update: {
      status: 'IN_PROGRESS'
    },
    create: {
      id: orderId,
      gigId: gig.id,
      buyerId: lecturerId,
      sellerId: studentId,
      proposalId: proposal.id,
      amount: proposal.amount,
      status: 'IN_PROGRESS'
    }
  });

  await prisma.review.upsert({
    where: { orderId: order.id },
    update: {
      rating: 5,
      comment: 'Excellent collaboration and timely delivery.'
    },
    create: {
      orderId: order.id,
      reviewerId: lecturerId,
      rating: 5,
      comment: 'Excellent collaboration and timely delivery.',
      visibility: 'PUBLIC'
    }
  });

  await prisma.transaction.upsert({
    where: { reference: `ESCROW-${order.id}` },
    update: {
      amount: order.amount,
      status: 'PENDING'
    },
    create: {
      wallet: { connect: { userId: studentId } },
      order: { connect: { id: order.id } },
      amount: order.amount,
      type: 'CREDIT',
      status: 'PENDING',
      reference: `ESCROW-${order.id}`
    }
  });

  return { gig, order };
}

async function seedAttendance(courseId: string, lecturerId: string, studentId: string) {
  const session = await prisma.attendanceSession.upsert({
    where: { id: 'seed-attendance-session' },
    update: {},
    create: {
      id: 'seed-attendance-session',
      courseId,
      lecturerId,
      scheduledAt: new Date(),
      mode: 'QR',
      status: 'OPEN',
      qrToken: 'SEED-QR-TOKEN'
    }
  });

  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId
      }
    },
    update: {
      status: 'PRESENT'
    },
    create: {
      sessionId: session.id,
      studentId,
      mode: 'QR',
      status: 'PRESENT'
    }
  });

  return session;
}

async function seedExamIntegrity(courseId: string, lecturerId: string, studentId: string) {
  const examSession = await prisma.examSession.upsert({
    where: { id: 'seed-exam-session' },
    update: {},
    create: {
      id: 'seed-exam-session',
      courseId,
      lecturerId,
      title: 'Mid-Semester Assessment',
      scheduledStart: new Date(Date.now() + 3600 * 1000),
      scheduledEnd: new Date(Date.now() + 3 * 3600 * 1000),
      proctoringEnabled: true,
      status: 'SCHEDULED',
      consentRequired: true
    }
  });

  await prisma.examConsent.upsert({
    where: {
      examSessionId_studentId: {
        examSessionId: examSession.id,
        studentId
      }
    },
    update: {},
    create: {
      examSessionId: examSession.id,
      studentId,
      consented: true
    }
  });

  const malpracticeEvent = await prisma.malpracticeEvent.upsert({
    where: { id: 'seed-malpractice-event' },
    update: {
      severity: 'MEDIUM',
      status: 'UNDER_REVIEW',
      confidenceScore: 0.78
    },
    create: {
      id: 'seed-malpractice-event',
      examSessionId: examSession.id,
      studentId,
      eventType: 'MULTIPLE_FACES_DETECTED',
      severity: 'MEDIUM',
      confidenceScore: 0.78,
      description: 'Detected multiple faces in frame during live session.',
      status: 'UNDER_REVIEW'
    }
  });

  await prisma.evidenceAsset.upsert({
    where: { id: 'seed-evidence-asset' },
    update: {
      url: 'https://example-bucket.s3.amazonaws.com/evidence/multi-face.jpg'
    },
    create: {
      id: 'seed-evidence-asset',
      eventId: malpracticeEvent.id,
      type: 'IMAGE',
      url: 'https://example-bucket.s3.amazonaws.com/evidence/multi-face.jpg',
      metadata: {
        frameTimestamp: '00:32:11'
      }
    }
  });

  await prisma.notification.upsert({
    where: { id: 'notif-student-malpractice' },
    update: {},
    create: {
      id: 'notif-student-malpractice',
      userId: studentId,
      title: 'Malpractice Alert',
      body: 'An anomaly was detected during your exam session. Review details and submit an appeal if necessary.',
      category: 'MALPRACTICE',
      malpracticeEventId: malpracticeEvent.id
    }
  });

  await prisma.notification.upsert({
    where: { id: 'notif-lecturer-exam-alert' },
    update: {},
    create: {
      id: 'notif-lecturer-exam-alert',
      userId: lecturerId,
      title: 'Proctor Alert',
      body: 'Review flagged malpractice event for Mid-Semester Assessment.',
      category: 'EXAM',
      malpracticeEventId: malpracticeEvent.id
    }
  });

  return examSession;
}

async function seedAuditLogs(adminId: string) {
  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-log' },
    update: {
      metadata: {
        message: 'Database seed refreshed.'
      }
    },
    create: {
      id: 'seed-audit-log',
      actorId: adminId,
      action: 'SYSTEM_SEED',
      entity: 'INITIAL_SETUP',
      metadata: {
        message: 'Database seeded with baseline roles, users, and sample data.'
      }
    }
  });
}

async function main() {
  console.log('⏳ Seeding database...');

  await seedRoles();
  const { admin, lecturer, student } = await seedUsers();
  await seedVisitors(); // Seed visitors (for exam integrity system)
  const course = await seedCourses(lecturer.id);

  await prisma.enrollment.upsert({
    where: {
      courseId_studentId: {
        courseId: course.id,
        studentId: student.id
      }
    },
    update: {},
    create: {
      courseId: course.id,
      studentId: student.id,
      status: 'ACTIVE'
    }
  });

  await seedFreelancerHub(lecturer.id, student.id);
  await seedAttendance(course.id, lecturer.id, student.id);
  await seedExamIntegrity(course.id, lecturer.id, student.id);
  await seedAuditLogs(admin.id);

  console.log(`✅ Seed complete. Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


/**
 * Pulse seed — realistic lab data so no screen is ever empty during development.
 * Run on a FRESH database only:  prisma db seed
 * All seeded users share the password: password123
 */
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions";
import { createBooking, todayPKT, pktDateTime, BookingConflictError } from "../lib/bookings";

const PASSWORD = "password123";

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Database already has users — skipping seed.");
    return;
  }

  const passwordHash = await hash(PASSWORD, 10);

  // ─── Roles ───
  const roleDefs = [
    { key: "ADMIN", name: "Admin", description: "Full access to everything", isSystem: true, scope: "GLOBAL" as const },
    { key: "LAB_INCHARGE", name: "Lab Incharge", description: "Admin powers within assigned labs", isSystem: true, scope: "LAB" as const },
    { key: "SUPERVISOR", name: "Supervisor", description: "Manages projects and reviews logbooks", isSystem: true, scope: "LAB" as const },
    { key: "INTERNEE", name: "Internee", description: "Works on projects, checks in, writes logbook", isSystem: true, scope: "LAB" as const },
  ];
  const roles: Record<string, { id: string }> = {};
  for (const r of roleDefs) {
    roles[r.key] = await prisma.role.create({
      data: {
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        scope: r.scope,
        permissions: DEFAULT_ROLE_PERMISSIONS[r.key] ?? [],
      },
    });
  }
  console.log("roles seeded");

  // ─── Organization & labs ───
  const org = await prisma.organization.create({ data: { name: "MEDD" } });
  const vibLab = await prisma.lab.create({
    data: { organizationId: org.id, name: "Vibration Lab", description: "Rotating machinery & condition monitoring" },
  });
  const desLab = await prisma.lab.create({
    data: { organizationId: org.id, name: "Design Office", description: "Design by analysis & drafting" },
  });
  console.log("org + labs seeded");

  // ─── Users ───
  const mkUser = (name: string, email: string, roleKey: string, labId?: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roleId: roles[roleKey].id,
        status: "ACTIVE",
        joinDate: new Date("2026-09-11"),
        labId: labId ?? null,
        ...extra,
      },
    });

  const admin = await mkUser("Lab Admin", "admin@pulse.local", "ADMIN");
  const incharge = await mkUser("Vibration Incharge", "incharge@pulse.local", "LAB_INCHARGE", vibLab.id);
  await prisma.labIncharge.create({ data: { labId: vibLab.id, userId: incharge.id } });
  const sup1 = await mkUser("Supervisor One", "sup1@pulse.local", "SUPERVISOR", vibLab.id);
  const sup2 = await mkUser("Supervisor Two", "sup2@pulse.local", "SUPERVISOR", desLab.id);

  const interneeNames = ["Ahmed Khan", "Sara Malik", "Bilal Ahmed", "Fatima Noor", "Usman Tariq", "Ayesha Siddiqui", "Hassan Raza", "Mahnoor Fatima"];
  const internees = [];
  for (let i = 0; i < interneeNames.length; i++) {
    const labId = i < 5 ? vibLab.id : desLab.id;
    internees.push(
      await mkUser(
        interneeNames[i],
        `intern${i + 1}@pulse.local`,
        "INTERNEE",
        labId,
        i === 6 ? { attendanceTracking: false } : {} // Hassan: external collaborator, no tracking
      )
    );
  }
  console.log("users seeded");

  // ─── Desks ───
  const desks: Record<string, { id: string; label: string }> = {};
  const addDesk = async (labId: string, label: string, status: "ACTIVE" | "MAINTENANCE" = "ACTIVE") => {
    desks[label] = await prisma.desk.create({ data: { labId, label, status } });
  };
  for (let i = 1; i <= 6; i++) await addDesk(vibLab.id, `VIB-0${i}`);
  await addDesk(vibLab.id, "Annex.VIB-07");
  await addDesk(vibLab.id, "Annex.VIB-08", "MAINTENANCE");
  for (let i = 1; i <= 6; i++) await addDesk(desLab.id, `DES-0${i}`);
  console.log("desks seeded");

  // ─── Project ───
  const project = await prisma.project.create({
    data: {
      name: "Portable vibration analyzer",
      description: "Dual-channel portable vibration monitoring & fault diagnostic analyzer (Raspberry Pi + IEPE DAQ).",
      labId: vibLab.id,
      status: "ACTIVE",
      leadId: sup1.id,
      startDate: new Date("2026-09-11"),
      endDate: new Date("2027-09-10"),
    },
  });
  for (const m of internees.slice(0, 5)) {
    await prisma.projectMember.create({ data: { projectId: project.id, userId: m.id, role: "member" } });
  }
  await prisma.projectMember.create({ data: { projectId: project.id, userId: sup1.id, role: "lead" } });

  const ms1 = await prisma.milestone.create({ data: { projectId: project.id, title: "M1: Sensor interface", dueDate: new Date("2026-11-30"), status: "IN_PROGRESS", sortOrder: 0 } });
  const ms2 = await prisma.milestone.create({ data: { projectId: project.id, title: "M2: DAQ firmware", dueDate: new Date("2027-02-28"), status: "PLANNED", sortOrder: 1 } });
  const ms3 = await prisma.milestone.create({ data: { projectId: project.id, title: "M3: Field validation", dueDate: new Date("2027-06-30"), status: "PLANNED", sortOrder: 2 } });

  const todoDefs: { title: string; milestoneId: string | null; status: "TODO" | "IN_PROGRESS" | "DONE"; assignee: number; start: string | null; end: string | null }[] = [
    { title: "Select IEPE accelerometers", milestoneId: ms1.id, status: "DONE", assignee: 0, start: "2026-09-11", end: "2026-09-25" },
    { title: "Design charge amplifier stage", milestoneId: ms1.id, status: "DONE", assignee: 1, start: "2026-09-20", end: "2026-10-10" },
    { title: "PCB layout for sensor HAT", milestoneId: ms1.id, status: "IN_PROGRESS", assignee: 0, start: "2026-10-05", end: "2026-10-25" },
    { title: "Calibrate against reference shaker", milestoneId: ms1.id, status: "TODO", assignee: 2, start: "2026-10-26", end: "2026-11-15" },
    { title: "MCC 172 driver integration", milestoneId: ms2.id, status: "IN_PROGRESS", assignee: 1, start: "2026-10-01", end: "2026-11-20" },
    { title: "51.2 kS/s streaming pipeline", milestoneId: ms2.id, status: "TODO", assignee: 3, start: "2026-11-01", end: "2026-12-15" },
    { title: "FFT + envelope spectrum module", milestoneId: ms2.id, status: "TODO", assignee: 0, start: "2026-12-01", end: "2027-01-15" },
    { title: "Fault-frequency cursor overlays", milestoneId: ms2.id, status: "TODO", assignee: 4, start: null, end: null },
    { title: "Rugged enclosure CAD", milestoneId: ms3.id, status: "TODO", assignee: 2, start: "2027-03-01", end: "2027-04-15" },
    { title: "Battery life test (8h target)", milestoneId: ms3.id, status: "TODO", assignee: 3, start: null, end: null },
    { title: "Field trial at compressor station", milestoneId: ms3.id, status: "TODO", assignee: 1, start: "2027-05-01", end: "2027-06-15" },
    // intentionally overdue:
    { title: "Order long-lead connectors", milestoneId: null, status: "TODO", assignee: 4, start: "2026-09-15", end: "2026-09-30" },
  ];
  for (let i = 0; i < todoDefs.length; i++) {
    const td = todoDefs[i];
    await prisma.todo.create({
      data: {
        projectId: project.id,
        milestoneId: td.milestoneId,
        title: td.title,
        status: td.status,
        assigneeId: internees[td.assignee].id,
        startDate: td.start ? new Date(td.start) : null,
        endDate: td.end ? new Date(td.end) : null,
        sortOrder: i,
        createdById: admin.id,
      },
    });
  }
  console.log("project seeded");

  // ─── Bookings ───
  const today = todayPKT();
  const plusDays = (n: number) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return d; };

  // Recurring Mon–Fri bookings for 3 internees (4 weeks)
  const recurringFor = [
    { user: internees[0], desk: "VIB-01" },
    { user: internees[1], desk: "VIB-02" },
    { user: internees[2], desk: "DES-01" },
  ];
  for (const r of recurringFor) {
    await createBooking({
      userId: r.user.id,
      type: "DESK",
      deskId: desks[r.desk].id,
      title: "Project work",
      projectId: project.id,
      timeStart: "08:00",
      timeEnd: "16:00",
      isRecurring: true,
      daysOfWeek: [1, 2, 3, 4, 5],
      validFrom: today,
      validTo: plusDays(27),
      createdById: admin.id,
    });
  }

  // Near-conflict pair: second booking must be rejected
  await createBooking({
    userId: internees[3].id,
    type: "DESK",
    deskId: desks["VIB-03"].id,
    timeStart: "08:00",
    timeEnd: "12:00",
    isRecurring: false,
    daysOfWeek: [],
    validFrom: plusDays(1),
    createdById: admin.id,
  });
  try {
    await createBooking({
      userId: internees[4].id,
      type: "DESK",
      deskId: desks["VIB-03"].id,
      timeStart: "10:00",
      timeEnd: "14:00",
      isRecurring: false,
      daysOfWeek: [],
      validFrom: plusDays(1),
      createdById: admin.id,
    });
    console.log("WARNING: conflict was NOT rejected!");
  } catch (e) {
    if (e instanceof BookingConflictError) console.log("conflict correctly rejected:", e.message);
    else throw e;
  }

  // Remote / WFH booking (Friday)
  const friday = plusDays(((5 - today.getUTCDay() + 7) % 7) || 7);
  await createBooking({
    userId: internees[4].id,
    type: "REMOTE",
    title: "Work from home — report writing",
    timeStart: "09:00",
    timeEnd: "15:00",
    isRecurring: false,
    daysOfWeek: [],
    validFrom: friday,
    createdById: admin.id,
  });
  console.log("bookings seeded");

  // ─── Attendance (past 2 weeks, weekdays) ───
  for (let back = 14; back >= 1; back--) {
    const day = plusDays(-back);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (let i = 0; i < 5; i++) {
      const u = internees[i];
      // one missed day for intern 3 (to demo "absent")
      if (i === 2 && back === 3) continue;
      await prisma.attendanceRecord.create({
        data: {
          userId: u.id,
          date: day,
          checkIn: pktDateTime(day, "08:0" + (i % 10)),
          checkOut: pktDateTime(day, "16:0" + (i % 10)),
          workMode: "ONSITE",
        },
      });
    }
  }
  console.log("attendance seeded");

  // ─── Logbook ───
  const samples = [
    ["Completed accelerometer shortlist; 100 mV/g shortlisted.", "Compared three IEPE models on sensitivity vs noise floor. Drafted selection memo for supervisor review."],
    ["Charge amplifier simulation done.", "LTspice sim of the charge amp stage shows flat response 2 Hz–20 kHz. Next: PCB layout."],
    ["Started MCC 172 driver spike.", "Got single-channel streaming at 51.2 kS/s on the Pi. Buffer overruns above 2 channels — investigating DMA settings."],
  ];
  for (let back = 10; back >= 1; back--) {
    const day = plusDays(-back);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const s = samples[back % samples.length];
    await prisma.logEntry.create({
      data: {
        userId: internees[back % 3].id,
        projectId: project.id,
        date: day,
        summary: s[0],
        details: s[1],
        status: back % 3 === 0 ? "REVIEWED" : back % 3 === 1 ? "SUBMITTED" : "DRAFT",
        ...(back % 3 === 0 ? { reviewedById: sup1.id, reviewedAt: new Date() } : {}),
      },
    });
  }
  console.log("logbook seeded");

  console.log("\nSeed complete. Logins (password: password123):");
  console.log("  admin@pulse.local / incharge@pulse.local / sup1@pulse.local / intern1@pulse.local ...");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@eleos/db";
import type {
  ActionRecord,
  CaseRecord,
  CheckInRecord,
  Incident,
  IncidentConfidence,
  InteractionRecord,
  Severity,
  UserProfile,
} from "@eleos/shared";
import { readWorkerEnv } from "../config/env";
import { pickHigherSeverity } from "../normalizers/incident-normalizer";

const confidenceRank: Record<IncidentConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface IncidentRepository {
  save(incident: Incident): Promise<Incident>;
  list(): Promise<Incident[]>;
}

export interface UserRepository {
  getPrimaryUser(): Promise<UserProfile>;
  updateUser(id: string, data: Partial<UserProfile>): Promise<UserProfile>;
}

export interface CaseRepository {
  save(caseRecord: CaseRecord): Promise<CaseRecord>;
  list(): Promise<CaseRecord[]>;
}

export interface ActionRepository {
  save(action: ActionRecord): Promise<ActionRecord>;
  list(): Promise<ActionRecord[]>;
}

export interface InteractionRepository {
  save(interaction: InteractionRecord): Promise<InteractionRecord>;
  list(): Promise<InteractionRecord[]>;
}

export interface CheckInRepository {
  save(checkIn: CheckInRecord): Promise<CheckInRecord>;
  list(): Promise<CheckInRecord[]>;
}

export class PrismaIncidentRepository implements IncidentRepository {
  async save(incident: Incident) {
    const existing = await prisma.incident.findUnique({
      where: { id: incident.id },
    });

    // For simplicity in MVP, we blindly upsert
    await prisma.incident.upsert({
      where: { id: incident.id },
      update: {
        incidentType: incident.incidentType,
        title: incident.title,
        description: incident.description ?? "",
        severity: incident.severity,
        status: incident.status,
        confidence: incident.confidence,
        sourceCount: incident.sourceCount,
        locationName: incident.locationName ?? "",
        centerLat: incident.centerLat,
        centerLng: incident.centerLng,
        radiusMeters: incident.radiusMeters,
        recommendedAction: incident.recommendedAction ?? "",
        firstSeenAt: new Date(incident.firstSeenAt),
        lastSeenAt: new Date(incident.lastSeenAt),
      },
      create: {
        id: incident.id,
        incidentType: incident.incidentType,
        title: incident.title,
        description: incident.description ?? "",
        severity: incident.severity,
        status: incident.status,
        confidence: incident.confidence,
        sourceCount: incident.sourceCount,
        locationName: incident.locationName ?? "",
        centerLat: incident.centerLat,
        centerLng: incident.centerLng,
        radiusMeters: incident.radiusMeters,
        recommendedAction: incident.recommendedAction ?? "",
        firstSeenAt: new Date(incident.firstSeenAt),
        lastSeenAt: new Date(incident.lastSeenAt),
      },
    });

    // Also sync sources roughly
    for (const s of incident.sources) {
      await prisma.incidentSource.upsert({
        where: { id: s.id },
        update: {
          sourceName: s.sourceName,
          sourceUrl: s.sourceUrl,
          rawTitle: s.rawTitle,
          retrievedAt: new Date(s.retrievedAt),
        },
        create: {
          id: s.id,
          incidentId: incident.id,
          sourceType: s.sourceType,
          sourceName: s.sourceName,
          sourceUrl: s.sourceUrl,
          rawTitle: s.rawTitle,
          retrievedAt: new Date(s.retrievedAt),
        },
      });
    }

    return incident;
  }

  async list() {
    const records = await prisma.incident.findMany({
      include: { sources: true },
    });
    return records.map((r: any) => ({
      ...r,
      incidentType: r.incidentType as any,
      severity: r.severity as any,
      status: r.status as any,
      confidence: r.confidence as any,
      description: r.description ?? "",
      locationName: r.locationName ?? "",
      recommendedAction: r.recommendedAction ?? "",
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      sources: r.sources.map((s: any) => ({
        ...s,
        sourceType: s.sourceType as any,
        publishedAt: s.publishedAt?.toISOString(),
        retrievedAt: s.retrievedAt.toISOString(),
      })),
    }) as unknown as Incident);
  }
}

export class PrismaUserRepository implements UserRepository {
  async getPrimaryUser(): Promise<UserProfile> {
    const env = readWorkerEnv();
    
    // Seed user if none exists
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: "user_oluwa",
          fullName: env.primaryUserName,
          primaryPhone: env.primaryUserPhone,
          primaryEmail: env.primaryUserEmail,
          homeLabel: env.primaryUserHomeLabel,
          homeLat: env.primaryUserHomeLat,
          homeLng: env.primaryUserHomeLng,
          currentLat: env.primaryUserCurrentLat,
          currentLng: env.primaryUserCurrentLng,
          transportMode: "car",
          timezone: "America/New_York",
          preferredChannel: "call",
        },
      });
    }

    // Always fetch emergency contacts
    const contacts = await prisma.emergencyContact.findMany({
      where: { userId: user.id },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      primaryPhone: user.primaryPhone,
      primaryEmail: user.primaryEmail ?? undefined,
      homeLabel: user.homeLabel ?? undefined,
      homeLat: user.homeLat,
      homeLng: user.homeLng,
      currentLat: user.currentLat ?? user.homeLat,
      currentLng: user.currentLng ?? user.homeLng,
      timezone: user.timezone,
      transportMode: "car",
      preferredChannel: "call",
      contacts: contacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        relationship: c.relationship,
        priorityOrder: c.priorityOrder,
        notifyEnabled: c.notifyEnabled
      })),
    };
  }

  async updateUser(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        primaryPhone: data.primaryPhone,
        primaryEmail: data.primaryEmail,
        homeLabel: data.homeLabel,
        homeLat: data.homeLat,
        homeLng: data.homeLng,
        currentLat: data.currentLat,
        currentLng: data.currentLng,
        locationUpdatedAt: new Date(),
      },
    });

    const contacts = await prisma.emergencyContact.findMany({
      where: { userId: updated.id },
    });

    return {
      id: updated.id,
      fullName: updated.fullName,
      primaryPhone: updated.primaryPhone,
      primaryEmail: updated.primaryEmail ?? undefined,
      homeLabel: updated.homeLabel ?? undefined,
      homeLat: updated.homeLat,
      homeLng: updated.homeLng,
      currentLat: updated.currentLat ?? updated.homeLat,
      currentLng: updated.currentLng ?? updated.homeLng,
      timezone: updated.timezone,
      transportMode: "car",
      preferredChannel: "call",
      contacts: contacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        relationship: c.relationship,
        priorityOrder: c.priorityOrder,
        notifyEnabled: c.notifyEnabled
      })),
    } as UserProfile;
  }
}

export class PrismaCaseRepository implements CaseRepository {
  async save(caseRecord: CaseRecord) {
    await prisma.case.upsert({
      where: { id: caseRecord.id },
      update: {
        riskLevel: caseRecord.riskLevel,
        state: caseRecord.state,
        triggerReason: caseRecord.triggerReason,
        distanceMeters: caseRecord.distanceMeters,
        routeAffected: caseRecord.routeAffected,
        initialChannel: caseRecord.initialChannel,
        currentStatusSummary: caseRecord.currentStatusSummary,
        userSafetyStatus: caseRecord.userSafetyStatus,
        lastActionAt: caseRecord.lastActionAt ? new Date(caseRecord.lastActionAt) : null,
      },
      create: {
        id: caseRecord.id,
        userId: caseRecord.userId,
        incidentId: caseRecord.incidentId,
        riskLevel: caseRecord.riskLevel,
        state: caseRecord.state,
        triggerReason: caseRecord.triggerReason,
        distanceMeters: caseRecord.distanceMeters,
        routeAffected: caseRecord.routeAffected,
        initialChannel: caseRecord.initialChannel,
        currentStatusSummary: caseRecord.currentStatusSummary,
        userSafetyStatus: caseRecord.userSafetyStatus,
        openedAt: new Date(caseRecord.openedAt),
        lastActionAt: caseRecord.lastActionAt ? new Date(caseRecord.lastActionAt) : null,
      },
    });
    return caseRecord;
  }

  async list() {
    const records = await prisma.case.findMany();
    return records.map((r: any) => ({
      ...r,
      riskLevel: r.riskLevel as any,
      state: r.state as any,
      triggerReason: r.triggerReason ?? "",
      distanceMeters: r.distanceMeters ?? undefined,
      initialChannel: (r.initialChannel as any) ?? undefined,
      currentStatusSummary: r.currentStatusSummary ?? undefined,
      userSafetyStatus: r.userSafetyStatus ?? undefined,
      openedAt: r.openedAt.toISOString(),
      lastActionAt: r.lastActionAt?.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString(),
    }) as unknown as CaseRecord);
  }
}

export class PrismaActionRepository implements ActionRepository {
  async save(action: ActionRecord) {
    await prisma.action.upsert({
      where: { id: action.id },
      update: {
        status: action.status,
        resultSummary: action.resultSummary,
        executedAt: action.executedAt ? new Date(action.executedAt) : null,
      },
      create: {
        id: action.id,
        caseId: action.caseId,
        actionType: action.actionType,
        target: action.target,
        status: action.status,
        payloadJson: null,
        resultSummary: action.resultSummary,
        executedAt: action.executedAt ? new Date(action.executedAt) : null,
      },
    });
    return action;
  }

  async list() {
    const records = await prisma.action.findMany();
    return records.map((r: any) => ({
      ...r,
      actionType: r.actionType as any,
      status: r.status as any,
      target: r.target ?? undefined,
      // payload: removed since ActionRecord does not use it
      resultSummary: r.resultSummary ?? undefined,
      executedAt: r.executedAt?.toISOString(),
    }) as unknown as ActionRecord);
  }
}

export class PrismaInteractionRepository implements InteractionRepository {
  async save(interaction: InteractionRecord) {
    await prisma.interaction.upsert({
      where: { id: interaction.id },
      update: {
        deliveryStatus: interaction.deliveryStatus,
        endedAt: interaction.endedAt ? new Date(interaction.endedAt) : null,
        contentSummary: interaction.contentSummary,
        transcript: interaction.transcript,
      },
      create: {
        id: interaction.id,
        caseId: interaction.caseId,
        interactionType: interaction.interactionType,
        provider: interaction.provider,
        providerMessageId: interaction.providerMessageId,
        direction: interaction.direction,
        deliveryStatus: interaction.deliveryStatus,
        startedAt: new Date(interaction.startedAt),
        endedAt: interaction.endedAt ? new Date(interaction.endedAt) : null,
        contentSummary: interaction.contentSummary,
        transcript: interaction.transcript,
      },
    });
    return interaction;
  }

  async list() {
    const records = await prisma.interaction.findMany();
    return records.map((r: any) => ({
      ...r,
      interactionType: r.interactionType as any,
      provider: r.provider as any,
      providerMessageId: r.providerMessageId ?? undefined,
      direction: r.direction as any,
      deliveryStatus: r.deliveryStatus as any,
      contentSummary: r.contentSummary ?? undefined,
      transcript: r.transcript ?? undefined,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString(),
    }) as unknown as InteractionRecord);
  }
}

export class PrismaCheckInRepository implements CheckInRepository {
  async save(checkIn: CheckInRecord) {
    await prisma.checkIn.upsert({
      where: { id: checkIn.id },
      update: {
        status: checkIn.status,
        attemptCount: checkIn.attemptCount,
        lastAttemptAt: checkIn.lastAttemptAt ? new Date(checkIn.lastAttemptAt) : null,
        notes: checkIn.notes,
      },
      create: {
        id: checkIn.id,
        caseId: checkIn.caseId,
        scheduledFor: new Date(checkIn.scheduledFor),
        status: checkIn.status,
        attemptCount: checkIn.attemptCount,
        lastAttemptAt: checkIn.lastAttemptAt ? new Date(checkIn.lastAttemptAt) : null,
        notes: checkIn.notes,
      },
    });
    return checkIn;
  }

  async list() {
    const records = await prisma.checkIn.findMany();
    return records.map((r: any) => ({
      ...r,
      status: r.status as any,
      notes: r.notes ?? undefined,
      scheduledFor: r.scheduledFor.toISOString(),
      lastAttemptAt: r.lastAttemptAt?.toISOString(),
    }) as unknown as CheckInRecord);
  }
}

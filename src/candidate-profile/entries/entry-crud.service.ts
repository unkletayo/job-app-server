import { NotFoundException } from '@nestjs/common';

export interface EntryRecord {
  id: string;
  userId: string;
}

/**
 * The minimal shape every Prisma model delegate for an entry table satisfies.
 * Kept loosely typed (data/where as `any`) deliberately — Prisma's own
 * per-model input types differ too much to unify generically. Each section
 * service (e.g. ExperienceService) is the strongly-typed boundary; this class
 * is the shared engine behind all of them.
 */
export interface EntryDelegate<TEntry> {
  create(args: { data: any }): Promise<TEntry>;
  findMany(args: { where: { userId: string } }): Promise<TEntry[]>;
  findFirst(args: { where: { id: string; userId: string } }): Promise<TEntry | null>;
  updateMany(args: { where: { id: string; userId: string }; data: any }): Promise<{ count: number }>;
  deleteMany(args: { where: { id: string; userId: string } }): Promise<{ count: number }>;
}

/**
 * Shared CRUD + ownership engine for every Candidate Profile entry section
 * (experience, education, certifications, skills, projects, achievements,
 * links). Ownership is enforced here once: findOne 404s on a record that
 * doesn't exist OR belongs to another user — the same response either way,
 * so a request can never learn whether an id it doesn't own exists.
 */
export class EntryCrudService<TEntry extends EntryRecord> {
  constructor(private readonly delegate: EntryDelegate<TEntry>) {}

  protected create(data: object): Promise<TEntry> {
    return this.delegate.create({ data });
  }

  findAll(userId: string): Promise<TEntry[]> {
    return this.delegate.findMany({ where: { userId } });
  }

  async findOne(userId: string, id: string): Promise<TEntry> {
    const entry = await this.delegate.findFirst({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException('Entry not found.');
    }
    return entry;
  }

  // updateMany/deleteMany (not update/delete) so the ownership check is part
  // of the mutating query itself, atomically — not a separate read beforehand
  // that a future code path could skip. A future write path that goes through
  // this class inherits the guard by construction; one that bypasses it
  // entirely is a different, visible problem (not this one).
  protected async performUpdate(userId: string, id: string, data: object): Promise<TEntry> {
    const { count } = await this.delegate.updateMany({ where: { id, userId }, data });
    if (count === 0) {
      throw new NotFoundException('Entry not found.');
    }
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.delegate.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Entry not found.');
    }
  }
}

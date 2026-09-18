import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const PRISMA_TRANSACTION_WRITE_CONFLICT = 'P2034';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedUser> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      // Serializable isolation is the actual guard: if two requests both read
      // "no user yet" concurrently, the database aborts one of them on commit
      // (P2034) rather than letting both inserts through. This intentionally
      // doesn't use a schema-level cap on row count — the users table must stay
      // able to hold more than one row for multi-user to work later, per
      // 0005-solo-first-forward-compatible-ownership. The single-user rule is
      // an application policy enforced here, not a structural limit.
      const user = await this.prisma.$transaction(
        async (tx) => {
          const existingUserCount = await tx.user.count();
          if (existingUserCount > 0) {
            throw new ConflictException('This instance already has a local user.');
          }
          return tx.user.create({ data: { email: dto.email, passwordHash } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { id: user.id, email: user.email };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_TRANSACTION_WRITE_CONFLICT
      ) {
        throw new ConflictException('This instance already has a local user.');
      }
      throw error;
    }
  }

  async validateCredentials(dto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return { id: user.id, email: user.email };
  }

  issueAccessToken(user: AuthenticatedUser): { accessToken: string } {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken };
  }
}

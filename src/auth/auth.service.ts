import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
    const existingUserCount = await this.prisma.user.count();
    if (existingUserCount > 0) {
      throw new ConflictException('This instance already has a local user.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    return { id: user.id, email: user.email };
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

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { WatchedCompaniesService } from './watched-companies.service';
import { CreateWatchedCompanyDto } from './dto/create-watched-company.dto';

@Controller('discovery/watched-companies')
@UseGuards(JwtAuthGuard)
export class WatchedCompaniesController {
  constructor(private readonly watchedCompanies: WatchedCompaniesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.watchedCompanies.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWatchedCompanyDto) {
    return this.watchedCompanies.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.watchedCompanies.remove(user.id, id);
  }
}

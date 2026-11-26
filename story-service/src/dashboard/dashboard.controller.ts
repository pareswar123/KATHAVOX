import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { StoriesService } from '../stories/stories.service';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(
    private readonly stories: StoriesService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('author/dashboard')
  @Roles(UserRole.AUTHOR)
  @ApiOperation({ summary: 'Author dashboard counts' })
  authorDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.stories.authorCounts(user.id);
  }

  @Get('admin/dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin dashboard counts, with revenue from recorded payments' })
  async adminDashboard() {
    const [summary, authors, readers, revenue] = await Promise.all([
      this.stories.adminCounts(),
      this.stories.countUsersWithRole(UserRole.AUTHOR),
      this.stories.countUsersWithRole(UserRole.READER),
      this.payments.revenueSummary(),
    ]);
    return {
      ...summary,
      authors,
      readers,
      pendingApprovals: summary.pending,
      ...revenue,
    };
  }
}

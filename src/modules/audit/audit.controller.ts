import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from 'src/common/decorators/require-permissions.decorator';
import { AuditAction } from './audit-action.decorator';
import { AuditEventQueryDto } from './audit.dto';
import { AuditQueryService } from './audit-query.service';
import { AUDIT_PERMISSIONS } from './core/audit.types';

@ApiTags('audit-events')
@ApiBearerAuth()
@Controller('audit-events')
@RequirePermissions(AUDIT_PERMISSIONS.READ)
export class AuditController {
  constructor(private readonly queryService: AuditQueryService) {}

  @Get()
  @AuditAction({ action: 'audit.events.list', resourceType: 'audit_event' })
  list(@Query() query: AuditEventQueryDto) {
    return this.queryService.findMany(query);
  }

  @Get(':id')
  @AuditAction({ action: 'audit.events.read', resourceType: 'audit_event', resourceIdPath: 'id' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.queryService.findOne(id);
  }
}
